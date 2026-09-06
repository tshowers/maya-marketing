import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Params, RouterModule } from '@angular/router';
import { Subscription, combineLatest, of, switchMap } from 'rxjs';
import { take } from 'rxjs/operators';

import { AuthService } from '../../../../services/auth.service';
import { ArcGaugeComponent, ArcGaugeTone } from '../../../../shared/page/arc-gauge/arc-gauge.component';
import { PreloaderComponent } from '../../../../shared/page/preloader/preloader.component';
import { StatusLedComponent, StatusLedTone } from '../../../../shared/page/status-led/status-led.component';
import {
  DEFAULT_MARKETING_EMPLOYEE_ID,
  MarketingEmployeeRecord,
  MarketingPlanRecord
} from '../../models/marketing-employee.models';
import { MarketingEmployeeService, MayaDailyActionRecord, MayaRunStatusResponse } from '../../services/marketing-employee.service';

type StatusTone = 'positive' | 'attention' | 'warn' | 'info';

interface MayaGuideChecklistItem {
  id: string;
  label: string;
  detail: string;
  done: boolean;
  route?: string | null;
  queryParams?: Params | null;
  actionLabel?: string;
}

interface MayaActionLaneItem {
  id: string;
  title: string;
  detail: string;
  route: string | null;
  queryParams?: Params | null;
  routeLabel: string;
  checked: boolean;
}

interface MayaGuideStep {
  id: string;
  numberLabel: string;
  title: string;
  owner: string;
  countLabel: string;
  detail: string;
  summary: string;
  tone: StatusTone;
  complete: boolean;
  whatHappens: MayaGuideChecklistItem[];
  userDoes: MayaGuideChecklistItem[];
  itemsHeading: string;
  itemsSummary: string;
  emptyLabel: string;
  items: MayaActionLaneItem[];
}

interface MayaStatusMetric {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: StatusTone;
  progress: number;
}

interface MayaStuckItem {
  id: string;
  title: string;
  progress: number;
  latestNote: string;
  latestNoteAuthor: string;
  moveId: string | null;
}

@Component( {
  selector: 'app-marketing-employee-home',
  standalone: true,
  imports: [CommonModule, RouterModule, StatusLedComponent, ArcGaugeComponent, PreloaderComponent],
  templateUrl: './marketing-employee-home.component.html',
  styleUrls: ['./marketing-employee-home.component.css']
} )
export class MarketingEmployeeHomeComponent implements OnInit, OnDestroy {
  readonly employeeId = DEFAULT_MARKETING_EMPLOYEE_ID;
  activeView: 'pipeline' | 'scorecard' | 'work' = 'pipeline';

  loading = true;
  errorMessage = '';
  tenantId = '';
  userId = '';

  employee: MarketingEmployeeRecord | null = null;
  activePlan: MarketingPlanRecord | null = null;
  currentWork: MayaDailyActionRecord[] = [];
  pendingApprovals: MayaDailyActionRecord[] = [];
  completedWork: MayaDailyActionRecord[] = [];
  mayaRunStatus: MayaRunStatusResponse | null = null;
  mayaRunStatusAvailable = false;

  guideSteps: MayaGuideStep[] = [];
  statusMetrics: MayaStatusMetric[] = [];
  stuckItems: MayaStuckItem[] = [];
  activeStepId = 'maya-starts-day';

  private subscription?: Subscription;

  constructor (
    private readonly authService: AuthService,
    private readonly marketingEmployeeService: MarketingEmployeeService
  ) { }

  // Matches scheduledMarketingEmployeePlanner.js's todayPlanDate() exactly -
  // Pacific time, not raw UTC. Maya's whole schedule (6am planner, midday
  // check-in) is anchored to America/Los_Angeles; comparing against plain
  // UTC rolled "today" over up to 7-8 hours before her actual day ended,
  // making this page go blank every evening even on a day she'd genuinely
  // worked.
  private todayPlannedForDate (): string {
    return new Intl.DateTimeFormat( 'en-CA', { timeZone: 'America/Los_Angeles' } ).format( new Date() );
  }

  ngOnInit (): void {
    this.subscription = this.authService.getUser().pipe(
      switchMap( user => {
        const nextUserId = String( user?.uid || '' ).trim();

        if ( !nextUserId ) {
          return of( {
            userId: '',
            tenantId: '',
            employee: null as MarketingEmployeeRecord | null,
            plans: [] as MarketingPlanRecord[],
            currentWork: [] as MayaDailyActionRecord[],
            pendingApprovals: [] as MayaDailyActionRecord[],
            completedWork: [] as MayaDailyActionRecord[]
            , mayaRunStatus: null as MayaRunStatusResponse | null, mayaRunStatusAvailable: false
          } );
        }

        return this.authService.getTenantId().pipe(
          take( 1 ),
          switchMap( tenantId => {
            const nextTenantId = String( tenantId || '' ).trim();

            if ( !nextTenantId ) {
              return of( {
                userId: nextUserId,
                tenantId: '',
                employee: null as MarketingEmployeeRecord | null,
                plans: [] as MarketingPlanRecord[],
                currentWork: [] as MayaDailyActionRecord[],
                pendingApprovals: [] as MayaDailyActionRecord[],
                completedWork: [] as MayaDailyActionRecord[]
                , mayaRunStatus: null as MayaRunStatusResponse | null, mayaRunStatusAvailable: false
              } );
            }

            const todayOptions = { plannedForDate: this.todayPlannedForDate() };
            return combineLatest( [
              this.marketingEmployeeService.watchEmployee( nextTenantId, this.employeeId ),
              this.marketingEmployeeService.watchMarketingPlans( nextTenantId, this.employeeId, { status: 'active', limit: 6 } ),
              this.marketingEmployeeService.getMayaDailyActions( nextTenantId, todayOptions.plannedForDate ),
              this.marketingEmployeeService.getMayaRunStatus( nextTenantId, todayOptions.plannedForDate )
            ] ).pipe(
              switchMap( ( [employee, plans, dailyActions, runStatus] ) => of( {
                userId: nextUserId,
                tenantId: nextTenantId,
                employee,
                plans,
                currentWork: dailyActions?.data?.currentWork || [],
                pendingApprovals: dailyActions?.data?.pendingApprovals || [],
                completedWork: dailyActions?.data?.completedWork || [],
                mayaRunStatus: runStatus?.data || null,
                mayaRunStatusAvailable: !!runStatus?.success
              } ) )
            );
          } )
        );
      } )
    ).subscribe( {
      next: state => {
        this.userId = state.userId;
        this.tenantId = state.tenantId;
        this.employee = state.employee;
        this.activePlan = this.pickBestPlan( state.plans );
        this.currentWork = state.currentWork || [];
        this.pendingApprovals = state.pendingApprovals || [];
        this.completedWork = state.completedWork || [];
        this.mayaRunStatus = state.mayaRunStatus || null;
        this.mayaRunStatusAvailable = !!state.mayaRunStatusAvailable;
        this.loading = false;
        this.errorMessage = '';
        this.rebuildStatusBoard();
      },
      error: error => {
        console.error( '[MarketingEmployeeHome] load failed', error );
        this.loading = false;
        this.errorMessage = 'Maya status is not available right now.';
      }
    } );
  }

  ngOnDestroy (): void {
    this.subscription?.unsubscribe();
  }

  trackById ( _index: number, item: { id?: string | null; } ): string {
    return String( item?.id || _index );
  }

  get activeStep (): MayaGuideStep | null {
    return this.guideSteps.find( step => step.id === this.activeStepId ) || this.guideSteps[0] || null;
  }

  selectStep ( stepId: string ): void {
    if ( this.guideSteps.some( step => step.id === stepId ) ) {
      this.activeStepId = stepId;
    }
  }

  selectView ( view: 'pipeline' | 'scorecard' | 'work' ): void {
    this.activeView = view;
  }

  hasLaneRoute ( item: MayaActionLaneItem ): boolean {
    return !!String( item.route || '' ).trim();
  }

  getStatusLedTone ( tone: StatusTone ): StatusLedTone {
    if ( tone === 'positive' || tone === 'attention' || tone === 'warn' ) return tone;
    return 'info';
  }

  getStatusLedPulse ( tone: StatusTone ): boolean {
    return tone === 'attention' || tone === 'warn';
  }

  getGaugeTone ( tone: StatusTone ): ArcGaugeTone {
    if ( tone === 'positive' || tone === 'attention' || tone === 'warn' ) return tone;
    return 'info';
  }

  private rebuildStatusBoard (): void {
    this.stuckItems = this.buildStuckItems();
    const hasPlan = this.hasOperatorPlan();
    const allActions = [...this.currentWork, ...this.pendingApprovals, ...this.completedWork];
    const socialActions = allActions.filter( action => this.isActionType( action, ['social_post', 'blog'] ) );
    const outreachActions = allActions.filter( action => this.isActionType( action, ['email', 'campaign'] ) );
    const socialCount = socialActions.length;
    const outreachCount = outreachActions.length;
    const reviewCount = this.pendingApprovals.length;
    const currentCount = this.currentWork.length;
    const completedCount = this.completedWork.length;
    const approvedItems = this.currentWork.filter( action => this.normalizeStatus( action.status ) === 'approved' );
    const approvedCount = approvedItems.length;
    const morningCount = currentCount + reviewCount + completedCount;
    const outreachDrafts = this.currentWork.filter( action =>
      this.isActionType( action, ['email', 'campaign'] ) && this.normalizeStatus( action.status ) === 'draft'
    );
    const socialNeedsReview = this.pendingApprovals.filter( action => this.isActionType( action, ['social_post', 'blog'] ) );
    const socialApproved = [...this.currentWork, ...this.completedWork].filter( action =>
      this.isActionType( action, ['social_post', 'blog'] ) && ['approved', 'completed'].includes( this.normalizeStatus( action.status ) )
    );
    const outreachCompleted = this.completedWork.filter( action => this.isActionType( action, ['email', 'campaign'] ) );

    const activeStepId = !hasPlan
      ? 'maya-starts-day'
      : reviewCount > 0
        ? 'outbox-review-and-approval'
        : outreachDrafts.length > 0
          ? 'maya-writes-first-pass-outreach-drafts'
          : approvedCount > 0
            ? 'auto-send-eligible-items-move-forward'
            : completedCount > 0
              ? 'afternoon-results-review'
              : socialCount > 0
                ? 'maya-social-queue-pass'
                : outreachCount > 0
                  ? 'maya-outreach-batch-selection'
                  : 'maya-starts-day';

    this.guideSteps = [
      this.buildGuideStep( {
        id: 'maya-starts-day',
        numberLabel: '1',
        title: 'Maya Starts The Day',
        owner: 'Maya',
        countLabel: hasPlan ? 'Ready' : 'Blocked',
        detail: hasPlan
          ? `${morningCount} visible item${morningCount === 1 ? '' : 's'} now prove the day started.`
          : 'Maya still needs a real plan or valid configuration before the day is truly started.',
        summary: 'At Maya’s configured morning start, she should begin the day, resolve identity, and stage the first visible work.',
        tone: hasPlan && morningCount > 0 ? 'positive' : hasPlan ? 'info' : 'warn',
        whatHappens: [
          this.buildChecklistItem( 'step1-enabled', 'Verifies Maya is enabled', this.isBackendStepCompleted( 'window_check' ), 'A grey light means today’s run has not verified this yet; it does not mean Maya is disabled.' ),
          this.buildChecklistItem( 'step1-window', 'Confirms the allowed run window', this.isBackendStepCompleted( 'window_check' ), 'Maya should only stage work inside her configured run window.' ),
          this.buildChecklistItem( 'step1-identity', 'Resolves the sender identity for the day', this.isBackendStepCompleted( 'sender_resolution' ), 'This is how Maya knows what identity and policy she is operating under.' ),
          this.buildChecklistItem( 'step1-run', 'Creates or updates the daily Maya run record', !!this.mayaRunStatus?.latestRun, 'The persisted run record is the proof that the morning run actually landed.' )
        ],
        userDoes: [
          this.buildChecklistItem( 'step1-user-none', 'Usually do nothing at this stage', hasPlan, 'This part of the flow should usually be automatic.' ),
          this.buildChecklistItem( 'step1-user-fix', 'Intervene only if Maya is blocked by configuration, sender setup, or policy', hasPlan, 'If the day did not start cleanly, use the shared footer to return to Maya rather than manually recreating the morning.' )
        ],
        itemsHeading: 'Morning proof',
        itemsSummary: 'These are the visible items proving Maya’s workday actually started.',
        emptyLabel: 'No visible morning proof is available yet.',
        items: allActions.slice( 0, 4 ).map( action => this.toLaneItem( action, this.normalizeStatus( action.status ) === 'completed' ) )
      } ),
      this.buildGuideStep( {
        id: 'maya-social-queue-pass',
        numberLabel: '2',
        title: 'Maya Social Queue Pass',
        owner: 'Maya',
        countLabel: socialCount > 0 ? `${socialCount} visible` : 'Waiting',
        detail: socialCount > 0
          ? `${socialCount} social item${socialCount === 1 ? '' : 's'} are visible across draft, review, queue, or proof.`
          : 'No social queue pass is visible yet today.',
        summary: 'Maya should choose the source material, check connected accounts, write the first social drafts, and create the review or publishing queue.',
        tone: socialCount > 0 ? 'positive' : 'info',
        whatHappens: [
          this.buildChecklistItem( 'step2-source', 'Chooses the source material for social work', socialCount > 0, 'If there are no social items, this step has not visibly landed yet.' ),
          this.buildChecklistItem( 'step2-accounts', 'Checks connected social accounts', socialCount > 0, 'Connected accounts are part of Maya’s queue pass, not something the user should rebuild manually.', '/outreach/social/accounts', null, 'Open Accounts' ),
          this.buildChecklistItem( 'step2-drafts', 'Writes one account-specific post per connected account', socialCount > 0, 'The user should not be the first drafter here.' ),
          this.buildChecklistItem( 'step2-queue', 'Creates queue items for review or publishing', socialNeedsReview.length > 0 || socialApproved.length > 0, 'Once the drafts exist, they should be visible in Drafts or Approved.' )
        ],
        userDoes: [
          this.buildChecklistItem( 'step2-user-review', 'Review posts when oversight is needed', socialNeedsReview.length === 0 && socialCount > 0, 'The user reviews Maya’s draft instead of writing the first post.', '/outreach/social/calendar', null, 'Open Social Calendar' ),
          this.buildChecklistItem( 'step2-user-approve', 'Approve or reject posts', socialNeedsReview.length === 0 && socialCount > 0, 'Approval or rejection is the user’s job only after Maya creates the drafts.', '/outreach/social/calendar', null, 'Review Calendar' ),
          this.buildChecklistItem( 'step2-user-queue', 'Allow approved items to remain queued or be published according to policy', socialApproved.length > 0, 'Approved social items belong in the Approved queue.', '/outreach/social/queue', null, 'Open Approved Queue' )
        ],
        itemsHeading: 'Social items',
        itemsSummary: 'These are the visible social items Maya created or advanced in today’s social pass.',
        emptyLabel: 'No visible social items are attached to Maya’s run yet.',
        items: socialActions.slice( 0, 6 ).map( action => this.toLaneItem( action, ['approved', 'completed'].includes( this.normalizeStatus( action.status ) ) ) )
      } ),
      this.buildGuideStep( {
        id: 'maya-outreach-batch-selection',
        numberLabel: '3',
        title: 'Maya Outreach Batch Selection',
        owner: 'Maya',
        countLabel: outreachCount > 0 ? `${outreachCount} selected` : 'Waiting',
        detail: outreachCount > 0
          ? `${outreachCount} outreach item${outreachCount === 1 ? '' : 's'} are visible in the batch Maya selected for the day.`
          : 'No visible outreach batch is selected yet.',
        summary: 'Maya should select who gets worked today, why they were selected, and who belongs in auto-send versus approval-first handling.',
        tone: outreachCount > 0 ? 'positive' : 'info',
        whatHappens: [
          this.buildChecklistItem( 'step3-select', 'Selects the contacts for the daily outreach batch', outreachCount > 0, 'The important question here is whether Maya already picked the batch.' ),
          this.buildChecklistItem( 'step3-priority', 'Uses prioritization and eligibility logic', outreachCount > 0, 'The batch should already reflect who is safe or important to work.' ),
          this.buildChecklistItem( 'step3-size', 'Sizes the batch for the day', outreachCount > 0, 'This should be a curated batch, not a raw list.' ),
          this.buildChecklistItem( 'step3-split', 'Splits the selected contacts into auto-send eligible and approval-first', reviewCount > 0 || approvedCount > 0, 'Downstream review and queue lanes are the proof that this split happened.' )
        ],
        userDoes: [
          this.buildChecklistItem( 'step3-user-batch', 'Review the selected batch, not manually build it', outreachCount > 0, 'The user should inspect the batch Maya chose rather than assembling it from scratch.' ),
          this.buildChecklistItem( 'step3-user-inspect', 'Inspect who was selected, why they were selected, and who is auto-send eligible versus approval-first', outreachCount > 0, 'The downstream Drafts and Outbox lanes should make that split visible.', '/signal-engine', { tab: 'plan' }, 'Open Outbox Plan' )
        ],
        itemsHeading: 'Selected outreach batch',
        itemsSummary: 'These are the outreach items Maya selected for the day.',
        emptyLabel: 'No outreach batch is visible yet.',
        items: outreachActions.slice( 0, 6 ).map( action => this.toLaneItem( action, ['approved', 'completed'].includes( this.normalizeStatus( action.status ) ) ) )
      } ),
      this.buildGuideStep( {
        id: 'maya-writes-first-pass-outreach-drafts',
        numberLabel: '4',
        title: 'Maya Writes The First-Pass Outreach Drafts',
        owner: 'Maya',
        countLabel: outreachDrafts.length > 0 ? `${outreachDrafts.length} ready` : 'Waiting',
        detail: outreachDrafts.length > 0
          ? `${outreachDrafts.length} first-pass outreach draft${outreachDrafts.length === 1 ? '' : 's'} are ready for review or routing.`
          : 'No first-pass outreach drafts are visible yet.',
        summary: 'Maya should write the first outreach draft and place it into the existing review or send pipeline, so the user is not the first drafter in the morning flow.',
        tone: outreachDrafts.length > 0 || reviewCount > 0 || approvedCount > 0 || outreachCompleted.length > 0 ? 'positive' : 'info',
        whatHappens: [
          this.buildChecklistItem( 'step4-write', 'Writes the first-pass outreach email drafts', outreachDrafts.length > 0 || reviewCount > 0 || approvedCount > 0 || outreachCompleted.length > 0, 'If this never lands, the user gets forced back into first drafting.' ),
          this.buildChecklistItem( 'step4-pipeline', 'Creates those drafts inside the existing review/send pipeline', outreachDrafts.length > 0 || reviewCount > 0 || approvedCount > 0, 'The user should find these in Outbox Drafts rather than a side channel.', '/signal-engine', { tab: 'drafts' }, 'Open Outbox Drafts' ),
          this.buildChecklistItem( 'step4-stage', 'Stages each contact into the appropriate lane', outreachDrafts.length > 0 || reviewCount > 0 || approvedCount > 0, 'Drafts, queue, and sent are the proof that the lanes exist.' )
        ],
        userDoes: [
          this.buildChecklistItem( 'step4-user-review', 'Review drafts that need judgment', reviewCount === 0 && outreachDrafts.length > 0, 'The user reviews Maya’s draft instead of authoring from scratch.', '/signal-engine', { tab: 'drafts' }, 'Open Drafts' ),
          this.buildChecklistItem( 'step4-user-approve', 'Approve drafts that are ready', reviewCount === 0 && approvedCount > 0, 'Ready drafts should move into queue or send behavior after approval.', '/signal-engine', { tab: 'drafts' }, 'Review Drafts' ),
          this.buildChecklistItem( 'step4-user-reject', 'Reject drafts that need rewriting or override poor drafts when needed', this.completedWork.some( action => this.isActionType( action, ['email', 'campaign'] ) && this.normalizeStatus( action.status ) === 'rejected' ), 'Rejection should route the work back through revision instead of stalling it.', '/signal-engine', { tab: 'drafts' }, 'Open Drafts' )
        ],
        itemsHeading: 'First-pass drafts',
        itemsSummary: 'These are the first-pass outreach drafts Maya has already written.',
        emptyLabel: 'No first-pass outreach drafts are visible yet.',
        items: outreachDrafts.slice( 0, 6 ).map( action => this.toLaneItem( action, false ) )
      } ),
      this.buildGuideStep( {
        id: 'outbox-review-and-approval',
        numberLabel: '5',
        title: 'Outbox Review And Approval',
        owner: 'User',
        countLabel: reviewCount > 0 ? `${reviewCount} need you` : 'Clear',
        detail: reviewCount > 0
          ? `${reviewCount} item${reviewCount === 1 ? '' : 's'} still need your judgment before they can move cleanly.`
          : 'Nothing is currently waiting on your explicit approval.',
        summary: 'This is the first major required user step in the daily email pipeline. If something is waiting on you, it should be linked here directly.',
        tone: reviewCount > 0 ? 'attention' : outreachDrafts.length > 0 || approvedCount > 0 || outreachCompleted.length > 0 ? 'positive' : 'info',
        whatHappens: [
          this.buildChecklistItem( 'step5-system-review', 'Outbox / Signal Engine acts as the review and send system', reviewCount > 0 || approvedCount > 0 || outreachCompleted.length > 0, 'This lane should allow review, approval, rejection, and send behavior.' ),
          this.buildChecklistItem( 'step5-system-visible', 'Keeps approval-first work visible in the review lane', reviewCount > 0, 'If approval-first work exists, the user should be able to open it from here.' )
        ],
        userDoes: [
          this.buildChecklistItem( 'step5-user-review', 'Review approval-first drafts', reviewCount === 0, 'This is the first major required user step in the daily email pipeline.' ),
          this.buildChecklistItem( 'step5-user-approve', 'Approve drafts that should go out', reviewCount === 0, 'Approved drafts should move forward into queue/send behavior.' ),
          this.buildChecklistItem( 'step5-user-reject', 'Reject drafts that should go back for rewrite or should not be sent', this.completedWork.some( action => this.normalizeStatus( action.status ) === 'rejected' ), 'Rejection is a real workflow outcome.' )
        ],
        itemsHeading: 'Items waiting on your judgment',
        itemsSummary: 'These are the actual review items you should be able to open and handle from here.',
        emptyLabel: 'Nothing is waiting on your judgment right now.',
        items: this.pendingApprovals.slice( 0, 6 ).map( action => this.toLaneItem( action, false ) )
      } ),
      this.buildGuideStep( {
        id: 'auto-send-eligible-items-move-forward',
        numberLabel: '6',
        title: 'Auto-Send Eligible Items Move Forward',
        owner: 'TODD, under policy',
        countLabel: approvedCount > 0 ? `${approvedCount} approved` : 'Waiting',
        detail: approvedCount > 0
          ? `${approvedCount} item${approvedCount === 1 ? '' : 's'} are approved and moving under queue or send policy.`
          : 'No approved items are visibly moving through queue/send behavior right now.',
        summary: 'Safe items should move without forcing the user to manually operate everything. The user should monitor these items rather than hand-hold them.',
        tone: approvedCount > 0 || outreachCompleted.length > 0 ? 'positive' : 'info',
        whatHappens: [
          this.buildChecklistItem( 'step6-queue', 'Moves policy-safe items through queue/send behavior', approvedCount > 0 || outreachCompleted.length > 0, 'Approved work should move forward without the queue being rebuilt manually.' ),
          this.buildChecklistItem( 'step6-policy', 'Applies send policy rules', approvedCount > 0 || outreachCompleted.length > 0, 'Queue/send is where policy-safe execution becomes visible.' ),
          this.buildChecklistItem( 'step6-send', 'Sends automatically where autonomy is allowed', outreachCompleted.length > 0, 'Completed send proof is one sign that policy-safe work advanced.' )
        ],
        userDoes: [
          this.buildChecklistItem( 'step6-user-monitor', 'Monitor rather than manually operate these items', approvedCount > 0 || outreachCompleted.length > 0, 'The user does not need to manually approve every safe item.', '/signal-engine', { tab: 'outbox' }, 'Open Outbox Queue' )
        ],
        itemsHeading: 'Approved items in motion',
        itemsSummary: 'These are the approved items already staged into queue/send behavior.',
        emptyLabel: 'No approved items are in visible queue/send behavior yet.',
        items: approvedItems.slice( 0, 6 ).map( action => this.toLaneItem( action, true ) )
      } ),
      this.buildGuideStep( {
        id: 'approval-first-items-wait-for-user-review-or-scheduled-release',
        numberLabel: '7',
        title: 'Approval-First Items Wait For User Review Or Scheduled Release',
        owner: 'User first, then TODD if policy allows',
        countLabel: reviewCount > 0 ? `${reviewCount} waiting` : approvedCount > 0 ? `${approvedCount} staged` : 'Clear',
        detail: reviewCount > 0
          ? `${reviewCount} approval-first item${reviewCount === 1 ? '' : 's'} are still waiting for your judgment.`
          : approvedCount > 0
            ? `${approvedCount} item${approvedCount === 1 ? '' : 's'} are staged under queue or release policy.`
            : 'No approval-first items are visibly waiting right now.',
        summary: 'This step should make it obvious whether an item is waiting on the user, waiting on TODD, or simply staged for a later release rule.',
        tone: reviewCount > 0 ? 'attention' : approvedCount > 0 ? 'positive' : 'info',
        whatHappens: [
          this.buildChecklistItem( 'step7-lane', 'Approval-first items stay in a waiting or review lane', reviewCount > 0 || approvedCount > 0, 'Approval-first items should not disappear into a hidden state.' ),
          this.buildChecklistItem( 'step7-release', 'Items remain staged until manual approval or a later release rule allows movement', approvedCount > 0, 'Some items should be visibly staged rather than looking lost.' )
        ],
        userDoes: [
          this.buildChecklistItem( 'step7-user-approve', 'Approve', reviewCount === 0 && approvedCount > 0, 'Approve the item if it should move now.' ),
          this.buildChecklistItem( 'step7-user-reject', 'Reject', this.completedWork.some( action => this.normalizeStatus( action.status ) === 'rejected' ), 'Reject the item if it needs rewrite or should not move.' ),
          this.buildChecklistItem( 'step7-user-send', 'Manually send or leave for scheduled release', approvedCount > 0, 'Not every good item needs to move immediately.', '/signal-engine', { tab: 'outbox' }, 'Open Outbox Queue' )
        ],
        itemsHeading: 'Approval-first items',
        itemsSummary: 'These are the approval-first items currently waiting on judgment or release.',
        emptyLabel: 'No approval-first items are visible right now.',
        items: [...this.pendingApprovals, ...approvedItems].slice( 0, 6 ).map( action => this.toLaneItem( action, this.normalizeStatus( action.status ) === 'approved' ) )
      } ),
      this.buildGuideStep( {
        id: 'sent-proof-is-recorded',
        numberLabel: '8',
        title: 'Sent Proof Is Recorded',
        owner: 'TODD',
        countLabel: completedCount > 0 ? `${completedCount} visible` : 'Waiting',
        detail: completedCount > 0
          ? `${completedCount} completed or rejected item${completedCount === 1 ? '' : 's'} now serve as proof that work moved.`
          : 'No visible sent proof is recorded yet.',
        summary: 'This is where the system should prove what truly went out or completed, not just what was drafted or planned.',
        tone: outreachCompleted.length > 0 ? 'positive' : 'info',
        whatHappens: [
          this.buildChecklistItem( 'step8-record', 'Records the sent email', outreachCompleted.length > 0, 'This is the first proof layer that the work truly moved.' ),
          this.buildChecklistItem( 'step8-track', 'Tracks proof of delivery and stores the sent message record', outreachCompleted.length > 0, 'The sent record should be inspectable after the fact.' ),
          this.buildChecklistItem( 'step8-surface', 'Surfaces sent history and proof', outreachCompleted.length > 0, 'Sent history should be visible in the right lane.', '/signal-engine', { tab: 'sent' }, 'Open Sent' )
        ],
        userDoes: [
          this.buildChecklistItem( 'step8-user-verify', 'Verify what was actually sent', outreachCompleted.length > 0, 'Use sent proof as the source of truth for morning outreach outcomes.' ),
          this.buildChecklistItem( 'step8-user-inspect', 'Inspect the result', outreachCompleted.length > 0, 'This step should answer what truly went out.' )
        ],
        itemsHeading: 'Sent proof',
        itemsSummary: 'These items are the visible proof that work moved.',
        emptyLabel: 'No sent proof is visible yet.',
        items: outreachCompleted.slice( 0, 6 ).map( action => this.toLaneItem( action, true ) )
      } ),
      this.buildGuideStep( {
        id: 'todd-takes-over-after-signals-appear',
        numberLabel: '9',
        title: 'TODD Takes Over After Signals Appear',
        owner: 'TODD',
        countLabel: outreachCompleted.length > 0 ? 'Watching' : 'Stand by',
        detail: outreachCompleted.length > 0
          ? 'After sends, TODD should own replies, opens, clicks, follow-up processing, and risky-thread escalation.'
          : 'No visible post-send thread signals are surfaced yet.',
        summary: 'This is the clearest ownership boundary in the guide: Maya creates first-draft work, then TODD owns the live thread after send and only brings the user back in when judgment is required.',
        tone: outreachCompleted.length > 0 ? 'positive' : 'info',
        whatHappens: [
          this.buildChecklistItem( 'step9-replies', 'Handles reply handling, open and click interpretation, follow-up processing, and thread signal interpretation', outreachCompleted.length > 0, 'TODD should take over thread behavior only after sends and signals exist.' ),
          this.buildChecklistItem( 'step9-escalate', 'Escalates risky or blocked threads to human review when needed', reviewCount > 0 || outreachCompleted.length > 0, 'The user should re-enter only for exception cases.', '/signal-engine', { tab: 'live_feed' }, 'Open Live Feed' )
        ],
        userDoes: [
          this.buildChecklistItem( 'step9-user-step-back', 'Step back from routine follow-up', outreachCompleted.length > 0, 'This stage should reduce human busywork.' ),
          this.buildChecklistItem( 'step9-user-step-in', 'Step in only for replies needing judgment, objections, handoffs, or risky threads', reviewCount === 0, 'TODD should surface the exceptions instead of making the user babysit every thread.', '/signal-engine', { tab: 'live_feed' }, 'Open Live Feed' )
        ],
        itemsHeading: 'Live thread signals',
        itemsSummary: 'These items represent the post-send thread lifecycle TODD should now be handling.',
        emptyLabel: 'No live thread signals are visible yet.',
        items: [...approvedItems, ...outreachCompleted].slice( 0, 6 ).map( action => this.toLaneItem( action, ['approved', 'completed'].includes( this.normalizeStatus( action.status ) ) ) )
      } ),
      this.buildGuideStep( {
        id: 'afternoon-results-review',
        numberLabel: '10',
        title: 'Afternoon Results Review',
        owner: 'User, assisted by TODD',
        countLabel: completedCount > 0 ? `${completedCount} outcomes` : 'Waiting',
        detail: completedCount > 0
          ? 'This is where the user closes the loop on what worked, what stalled, and what should influence tomorrow’s work.'
          : 'No visible outcomes are ready for afternoon review yet.',
        summary: 'Maya started the day, TODD ran the live threads after send, and now the user reviews the business outcome.',
        tone: completedCount > 0 ? 'positive' : 'info',
        whatHappens: [
          this.buildChecklistItem( 'step10-surface', 'Surfaces opens, clicks, replies, stalled threads, and advanced work', completedCount > 0, 'TODD should make the business outcome visible by this point.' ),
          this.buildChecklistItem( 'step10-decisions', 'Shows which work needs human review or next decisions', reviewCount > 0 || completedCount > 0, 'The next decisions should be visible instead of buried.' )
        ],
        userDoes: [
          this.buildChecklistItem( 'step10-review', 'Review what worked, what did not work, who replied, who clicked, and who stalled', completedCount > 0, 'This is the business review step, not a drafting step.' ),
          this.buildChecklistItem( 'step10-escalate', 'Review which threads need escalation, handoff, or revision', reviewCount === 0, 'This is where today’s outcome informs tomorrow’s work.' )
        ],
        itemsHeading: 'Outcome review items',
        itemsSummary: 'These are the visible outcomes feeding the afternoon review.',
        emptyLabel: 'No visible outcomes are ready for afternoon review yet.',
        items: this.completedWork.slice( 0, 6 ).map( action => this.toLaneItem( action, true ) )
      } )
    ];

    this.applyPersistedRunStatus();

    this.activeStepId = this.guideSteps.some( step => step.id === this.activeStepId )
      ? this.activeStepId
      : activeStepId;

    const completedSteps = this.guideSteps.filter( step => step.complete ).length;
    const overallProgress = Math.round( ( completedSteps / Math.max( this.guideSteps.length, 1 ) ) * 100 );

    this.statusMetrics = [
      {
        id: 'progress',
        label: 'Today',
        value: `${overallProgress}%`,
        detail: 'How much of the guide-visible pipeline is complete.',
        tone: overallProgress >= 70 ? 'positive' : overallProgress >= 35 ? 'attention' : 'info',
        progress: overallProgress
      },
      {
        id: 'working',
        label: 'Working',
        value: this.toCountLabel( currentCount ),
        detail: 'Open items Maya or TODD still have in motion today.',
        tone: currentCount > 0 ? 'info' : 'positive',
        progress: this.toMeter( currentCount, 6 )
      },
      {
        id: 'need-you',
        label: 'Need You',
        value: this.toCountLabel( reviewCount ),
        detail: reviewCount > 0 ? 'These items still need human judgment.' : 'Nothing is visibly waiting on your judgment right now.',
        tone: reviewCount > 0 ? 'attention' : 'positive',
        progress: this.toMeter( reviewCount, 4 )
      },
      {
        id: 'done',
        label: 'Done',
        value: this.toCountLabel( completedCount ),
        detail: 'Visible completed or rejected work for today.',
        tone: completedCount > 0 ? 'positive' : 'info',
        progress: this.toMeter( completedCount, 6 )
      }
    ];
  }

  private applyPersistedRunStatus (): void {
    const steps = this.mayaRunStatus?.latestRun?.steps || [];
    if ( steps.length === 0 ) return;
    const byKey = new Map( steps.map( step => [String( step.key || '' ), step] ) );
    const mapping: Record<string, string[]> = {
      'maya-starts-day': ['window_check', 'sender_resolution', 'task_sync'],
      'maya-social-queue-pass': ['social_queue'],
      'maya-outreach-batch-selection': ['outreach_batch'],
      'maya-writes-first-pass-outreach-drafts': ['outreach_drafting']
    };
    this.guideSteps = this.guideSteps.map( step => {
      const backendSteps = ( mapping[step.id] || [] ).map( key => byKey.get( key ) ).filter( Boolean ) as Array<{ status?: string; detail?: string }>;
      // The remaining cards describe downstream human/TODD workflow, not a
      // Maya backend duty. They must never turn green merely because work is
      // visible on the page.
      if ( backendSteps.length === 0 ) return step.tone === 'positive' ? { ...step, tone: 'info', complete: false } : step;
      const status = backendSteps.some( item => item.status === 'failed' ) ? 'warn' :
        backendSteps.some( item => item.status === 'blocked' ) ? 'attention' :
          backendSteps.every( item => item.status === 'completed' ) ? 'positive' : 'info';
      const detail = backendSteps.find( item => item.status === 'failed' || item.status === 'blocked' || item.status === 'processing' )?.detail;
      return { ...step, tone: status as StatusTone, complete: status === 'positive', detail: detail || step.detail };
    } );
  }

  private isBackendStepCompleted ( key: string ): boolean {
    return this.mayaRunStatus?.latestRun?.steps?.some( step => String( step.key || '' ) === key && step.status === 'completed' ) || false;
  }

  get mayaQueueBlocked (): boolean {
    return !!this.mayaRunStatus?.queueHealth?.blocked;
  }

  get mayaQueueWarningMessage (): string {
    const health = this.mayaRunStatus?.queueHealth;
    if ( !health ) return '';
    const parts: string[] = [];
    if ( health.draftBlocked ) parts.push( `${health.counts.openDraftCount} email drafts` );
    if ( health.taskBlocked ) parts.push( `${health.counts.openTaskCount} tasks` );
    if ( health.socialPostBlocked ) parts.push( `${health.counts.openSocialPostCount} social posts` );
    const queueSummary = parts.join( ', ' );
    return `Maya has stopped creating new work: you have ${queueSummary} waiting on your review. Clear them to let Maya continue. Anything left unreviewed for ${health.expiryDays} days is automatically expired.`;
  }

  private buildGuideStep ( step: Omit<MayaGuideStep, 'complete'> ): MayaGuideStep {
    return {
      ...step,
      complete: step.tone === 'positive'
    };
  }

  private buildChecklistItem (
    id: string,
    label: string,
    done: boolean,
    detail: string,
    route: string | null = null,
    queryParams: Params | null = null,
    actionLabel: string | undefined = undefined
  ): MayaGuideChecklistItem {
    return {
      id,
      label,
      detail,
      done,
      route,
      queryParams,
      actionLabel
    };
  }

  private toLaneItem ( action: MayaDailyActionRecord, checked: boolean ): MayaActionLaneItem {
    const destination = this.resolveActionDestination( action );
    return {
      id: String( action.id || action.title || Math.random() ),
      title: String( action.title || 'Untitled work item' ).trim(),
      detail: this.toSingleLine( action.description || 'No detail available yet.' ),
      route: destination.route,
      queryParams: destination.queryParams,
      routeLabel: destination.routeLabel,
      checked
    };
  }

  private pickBestPlan ( plans: MarketingPlanRecord[] ): MarketingPlanRecord | null {
    const activePlans = Array.isArray( plans ) ? plans : [];
    return activePlans.find( plan => String( plan?.sourceType || '' ).trim().toLowerCase() !== 'generated' ) || activePlans[0] || null;
  }

  private hasOperatorPlan (): boolean {
    return !!this.activePlan && String( this.activePlan.sourceType || '' ).trim().toLowerCase() !== 'generated';
  }

  private isActionType ( action: MayaDailyActionRecord, types: string[] ): boolean {
    const normalized = new Set( types.map( type => String( type || '' ).trim().toLowerCase() ) );
    return normalized.has( String( action.type || '' ).trim().toLowerCase() );
  }

  private resolveActionDestination ( action: MayaDailyActionRecord ): { route: string | null; queryParams: Params | null; routeLabel: string; } {
    const status = this.normalizeStatus( action.status );
    const type = String( action.type || '' ).trim().toLowerCase();

    if ( type === 'social_post' || type === 'blog' ) {
      if ( status === 'approved' || status === 'completed' ) {
        return { route: '/outreach/social/queue', queryParams: null, routeLabel: 'Open Approved' };
      }
      return { route: '/outreach/social/calendar', queryParams: null, routeLabel: 'Open Calendar' };
    }

    if ( type === 'email' || type === 'campaign' ) {
      if ( status === 'completed' || status === 'rejected' ) {
        return { route: '/signal-engine', queryParams: { tab: 'sent' }, routeLabel: 'Open Sent' };
      }
      if ( status === 'approved' ) {
        return { route: '/signal-engine', queryParams: { tab: 'outbox' }, routeLabel: 'Open Outbox' };
      }
      return { route: '/signal-engine', queryParams: { tab: 'drafts' }, routeLabel: 'Open Drafts' };
    }

    const route = String( action.monitorRoute || '' ).trim();
    return {
      route: route || null,
      queryParams: null,
      routeLabel: route ? 'Open' : ''
    };
  }

  // Today's real, not-yet-done work Maya planned - draft/needs_approval only
  // (completedWork is done, not "stuck"). Sourced from real momentumThreads/
  // outreach-social-posts records now, which don't carry a notes-log or a
  // percent-complete the way the old employee-actions checklist items did -
  // progress here is a coarse status-based indicator, not a tracked metric.
  private buildStuckItems (): MayaStuckItem[] {
    return [...this.currentWork, ...this.pendingApprovals]
      .map( action => {
        const status = this.normalizeStatus( action.status );
        const progress = status === 'approved' || status === 'needs_approval' ? 60 : 20;
        return {
          id: String( action.id || action.title || Math.random() ),
          title: String( action.title || 'Untitled work item' ).trim(),
          progress,
          latestNote: String( action.description || '' ).trim() || 'No detail available yet.',
          latestNoteAuthor: '',
          moveId: action.moveId ? String( action.moveId ) : null
        };
      } );
  }

  private normalizeStatus ( value: string | null | undefined ): string {
    return String( value || '' ).trim().toLowerCase();
  }

  private toCountLabel ( value: number ): string {
    return String( Math.max( 0, Number( value || 0 ) ) );
  }

  private toMeter ( value: number, max: number ): number {
    const safeValue = Math.max( 0, Number( value || 0 ) );
    const safeMax = Math.max( 1, Number( max || 1 ) );
    return Math.max( 6, Math.min( 100, Math.round( ( safeValue / safeMax ) * 100 ) ) );
  }

  private toSingleLine ( value: string ): string {
    return String( value || '' ).replace( /\s+/g, ' ' ).trim();
  }
}
