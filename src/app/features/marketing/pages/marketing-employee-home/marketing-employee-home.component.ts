import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Observable, Subscription, catchError, combineLatest, map, of, switchMap, take } from 'rxjs';

import { AuthService } from '../../../../services/auth.service';
import { DEFAULT_MARKETING_EMPLOYEE_ID, MarketingEmployeeActionRecord, MarketingPlanRecord } from '../../models/marketing-employee.models';
import {
  ActionRow,
  MOVES_URL,
  MayaNeed,
  OUTREACH_URL,
  StepView,
  againstPlanLabel,
  buildNeeds,
  currentStepView,
  forecastEnd,
  longDate,
  pickActivePlan,
  stepActionRows,
  stepViews,
  todayKey,
} from '../../models/maya-progress';
import { MarketingEmployeeService, MayaQueueHealth, MayaRunStatusResponse, MayaRunStepStatus } from '../../services/marketing-employee.service';

type StatusView = 'cols' | 'timeline';
type RunState = 'done' | 'doing' | 'stopped' | 'waiting' | 'todo';
type Owner = 'Maya' | 'TODD' | 'You';

/** One of the 10 pipeline steps, in plain words. */
interface RunStep {
  id: string;
  number: number;
  title: string;
  owner: Owner;
  state: RunState;
  time: string;
  detail: string;
  chip: string;
}

interface RunStepDefinition {
  id: string;
  title: string;
  owner: Owner;
  keys: string[];
  /** What the step does, for steps that haven't run. */
  plan: string;
  /** What happened, when the backend's own detail is only a placeholder. */
  done: string;
}

/** The run record's step keys (mayaBatchRunner.service.js) mapped to the design's 10 steps. */
const RUN_STEPS: RunStepDefinition[] = [
  { id: 'start', title: 'Start the day', owner: 'Maya', keys: ['window_check', 'sender_resolution', 'task_sync'], plan: 'I check that I’m enabled, my sender is set, and the plan is loaded.', done: 'Checked that I’m enabled, my sender is set, and the plan is loaded.' },
  { id: 'social', title: 'Social queue pass', owner: 'Maya', keys: ['social_queue'], plan: 'I draft the social posts for this week.', done: 'Queued this week’s social posts.' },
  { id: 'batch', title: 'Choose the outreach batch', owner: 'Maya', keys: ['outreach_batch'], plan: 'I pick today’s people to write to.', done: 'Picked today’s outreach batch.' },
  { id: 'drafts', title: 'Write first-pass drafts', owner: 'Maya', keys: ['outreach_drafting'], plan: 'I draft today’s outreach emails.', done: 'Drafted today’s outreach emails.' },
  { id: 'outbox', title: 'Outbox review', owner: 'You', keys: ['outbox_review'], plan: 'You approve or reject what I’ve drafted.', done: 'You reviewed today’s drafts.' },
  { id: 'auto', title: 'Auto-send eligible items', owner: 'TODD', keys: ['auto_send'], plan: 'Items you’ve allowed to go without review are sent.', done: 'Sent the items allowed to go without review.' },
  { id: 'hold', title: 'Hold approval-first items', owner: 'TODD', keys: ['approval_first_wait'], plan: 'Anything that needs your OK waits for you or its scheduled time.', done: 'Held approval-first items for you.' },
  { id: 'proof', title: 'Record proof of sending', owner: 'TODD', keys: ['sent_proof'], plan: 'Each sent item is logged against the plan.', done: 'Logged what was sent.' },
  { id: 'replies', title: 'Hand replies to TODD', owner: 'TODD', keys: ['signal_handoff'], plan: 'When someone replies or clicks, TODD takes over the follow-up.', done: 'Handed replies to TODD.' },
  { id: 'review', title: 'Afternoon results review', owner: 'Maya', keys: ['afternoon_review'], plan: 'I compare today’s results with the plan and set tomorrow.', done: 'Reviewed today’s results against the plan.' },
];

const VIEW_KEY = 'maya.statusView';

/**
 * Maya's status (design_handoff_maya_plan_status, 19a): what she has done,
 * is doing and will do next today, with one clear ask when she's blocked -
 * as columns or as today's run, step by step.
 */
@Component( {
  selector: 'app-marketing-employee-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './marketing-employee-home.component.html',
  styleUrls: ['./marketing-employee-home.component.css']
} )
export class MarketingEmployeeHomeComponent implements OnInit, OnDestroy {
  readonly avatarUrl = 'assets/find/entities/maya/logo-icon.png';
  readonly today = todayKey();
  readonly dateLabel = longDate().toUpperCase();
  readonly movesUrl = `${MOVES_URL}/moves`;
  readonly draftsUrl = `${OUTREACH_URL}/signal-engine?tab=drafts`;

  view: StatusView = 'cols';
  loading = true;
  isLoggedIn = false;
  errorMessage = '';
  showWhyLimit = false;

  plan: MarketingPlanRecord | null = null;
  planSteps: StepView[] = [];
  currentPlanStep: StepView | null = null;
  rows: ActionRow[] = [];
  runSteps: RunStep[] = [];
  needs: MayaNeed[] = [];
  queueHealth: MayaQueueHealth | null = null;
  hasRun = false;

  headline = '';
  sentence = '';
  planFooter = '';
  planSentence = '';
  tomorrow = '';

  private subscription?: Subscription;

  constructor (
    private readonly authService: AuthService,
    private readonly marketingEmployeeService: MarketingEmployeeService
  ) { }

  ngOnInit (): void {
    this.view = this.readView();
    this.subscription = this.authService.getUser().pipe(
      switchMap( user => {
        this.isLoggedIn = !!user?.uid;
        if ( !user?.uid ) return of( null );
        return this.authService.getTenantId().pipe( take( 1 ) );
      } ),
      switchMap( tenantId => {
        const tenant = String( tenantId || '' ).trim();
        if ( !tenant ) return of( null );
        return combineLatest( [
          this.marketingEmployeeService.getMayaRunStatus( tenant, this.today ),
          this.marketingEmployeeService.watchMarketingPlans( tenant, DEFAULT_MARKETING_EMPLOYEE_ID, { status: 'active', limit: 6 } ).pipe(
            map( plans => pickActivePlan( plans ) ),
            switchMap( plan => this.withStepActions( tenant, plan ) ),
          ),
        ] ).pipe( map( ( [runStatus, planState] ) => ( { run: runStatus?.data || null, ...planState } ) ) );
      } ),
    ).subscribe( {
      next: state => {
        this.loading = false;
        this.errorMessage = '';
        this.rebuild( state?.run || null, state?.plan || null, state?.actions || [] );
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Maya’s status isn’t available right now.';
      },
    } );
  }

  ngOnDestroy (): void {
    this.subscription?.unsubscribe();
  }

  setView ( view: StatusView ): void {
    this.view = view;
    try { localStorage.setItem( VIEW_KEY, view ); } catch { /* storage blocked: the view just isn't remembered */ }
  }

  trackById ( _index: number, item: { id: string; } ): string {
    return item.id;
  }

  get stopped (): boolean {
    return !!this.queueHealth?.blocked || this.runSteps.some( step => step.state === 'stopped' );
  }

  get reviewLabel (): string {
    const counts = this.queueHealth?.counts;
    const tasks = counts?.openTaskCount || 0;
    return tasks ? `Review ${tasks} task${tasks === 1 ? '' : 's'}` : 'Review drafts';
  }

  get reviewHref (): string {
    return this.queueHealth?.counts?.openTaskCount ? this.movesUrl : this.draftsUrl;
  }

  get doneSteps (): RunStep[] {
    return this.runSteps.filter( step => step.state === 'done' );
  }

  get doingSteps (): RunStep[] {
    return this.runSteps.filter( step => step.state === 'doing' || step.state === 'stopped' );
  }

  get nextSteps (): RunStep[] {
    const waiting = this.runSteps.filter( step => step.state === 'waiting' );
    const todo = this.runSteps.filter( step => step.state === 'todo' );
    return [...waiting, ...todo].slice( 0, 3 );
  }

  get moreNextCount (): number {
    return this.runSteps.filter( step => step.state === 'waiting' || step.state === 'todo' ).length - this.nextSteps.length;
  }

  /** The step the run is on: the first one that isn't done. */
  get runPosition (): RunStep | null {
    return this.runSteps.find( step => step.state !== 'done' ) || null;
  }

  get runHeadline (): string {
    const at = this.runPosition;
    if ( !this.hasRun ) return 'Today’s run hasn’t started.';
    if ( !at ) return 'Today’s run is done.';
    const name = at.title.toLowerCase();
    const phrase = at.state === 'stopped' ? `stopped at ${name.replace( /^write first-pass /, '' )}`
      : at.state === 'waiting' ? 'waiting on you'
        : at.state === 'doing' ? `working on ${name}` : `next is ${name}`;
    return `Step ${at.number} of ${this.runSteps.length}: ${phrase}.`;
  }

  get runCounts (): string {
    const done = this.doneSteps.length;
    const stopped = this.runSteps.filter( step => step.state === 'stopped' ).length;
    const rest = this.runSteps.length - done - stopped;
    return [`${done} done`, stopped ? `${stopped} stopped` : '', `${rest} to go`].filter( Boolean ).join( ' · ' );
  }

  get limitExplanation (): string {
    const counts = this.queueHealth?.counts;
    if ( !counts ) return '';
    return `I stop creating new work when too much is waiting for you, so nothing piles up unread: ${counts.taskLimit} tasks, ${counts.draftLimit} email drafts or ${counts.socialPostLimit} social posts. Right now there are ${counts.openTaskCount} tasks, ${counts.openDraftCount} drafts and ${counts.openSocialPostCount} posts. Anything unreviewed for ${this.queueHealth?.expiryDays || 14} days expires.`;
  }

  private withStepActions ( tenantId: string, plan: MarketingPlanRecord | null ): Observable<{ plan: MarketingPlanRecord | null; actions: MarketingEmployeeActionRecord[]; }> {
    const currentId = plan?.steps?.find( step => step.status !== 'done' )?.id || '';
    if ( !currentId ) return of( { plan, actions: [] } );
    return this.marketingEmployeeService.watchStepActions( tenantId, currentId ).pipe(
      map( actions => ( { plan, actions } ) ),
      catchError( () => of( { plan, actions: [] as MarketingEmployeeActionRecord[] } ) ),
    );
  }

  private rebuild ( run: MayaRunStatusResponse | null, plan: MarketingPlanRecord | null, actions: MarketingEmployeeActionRecord[] ): void {
    this.plan = plan;
    this.queueHealth = run?.queueHealth || null;
    this.hasRun = !!run?.latestRun;
    this.rows = stepActionRows( actions );
    this.planSteps = stepViews( plan, this.rows, this.today );
    this.currentPlanStep = currentStepView( this.planSteps );
    this.needs = buildNeeds( { blockedRows: this.rows.filter( row => row.state === 'stuck' ), queueHealth: this.queueHealth, plan } );
    this.runSteps = this.buildRunSteps( run?.latestRun?.steps || [] );
    this.buildWords();
  }

  private buildRunSteps ( backendSteps: MayaRunStepStatus[] ): RunStep[] {
    const byKey = new Map( backendSteps.map( step => [String( step.key ), step] ) );
    const counts = this.queueHealth?.counts;
    const waitingOnYou = ( counts?.openTaskCount || 0 ) + ( counts?.openDraftCount || 0 ) + ( counts?.openSocialPostCount || 0 );
    const planChip = this.currentPlanStep ? `Plan · ${this.currentPlanStep.title}` : '';

    const steps = RUN_STEPS.map( ( definition, index ): RunStep => {
      const records = definition.keys.map( key => byKey.get( key ) ).filter( ( step ): step is MayaRunStepStatus => !!step );
      let state: RunState = 'todo';
      if ( records.some( step => step.status === 'failed' || step.status === 'blocked' ) ) state = 'stopped';
      else if ( records.length && records.every( step => step.status === 'completed' ) ) state = 'done';
      else if ( records.some( step => step.status === 'processing' || step.status === 'running' ) ) state = 'doing';
      if ( definition.id === 'outbox' && state === 'todo' && waitingOnYou > 0 ) state = 'waiting';

      const record = records.find( step => step.status === 'failed' || step.status === 'blocked' ) || records[records.length - 1];
      const backendDetail = String( record?.detail || '' ).trim();
      const placeholder = !backendDetail || /^(waiting to|not yet tracked)/i.test( backendDetail );
      const detail = state === 'todo' ? definition.plan
        : state === 'waiting' ? this.waitingDetail()
          : placeholder ? definition.done : backendDetail;

      return {
        id: definition.id,
        number: index + 1,
        title: definition.title,
        owner: definition.owner,
        state,
        time: this.timeOf( records, state ),
        detail,
        chip: definition.id === 'start' ? 'Plan · Daily run' : planChip,
      };
    } );

    // The review limit stops Maya before she writes; if the run didn't
    // record which step, it's the first of her own steps still open.
    if ( this.queueHealth?.blocked && !steps.some( step => step.state === 'stopped' ) ) {
      const first = steps.find( step => step.owner === 'Maya' && step.state !== 'done' );
      if ( first ) {
        first.state = 'stopped';
        first.detail = `I hit the review limit. ${this.waitingDetail()} I’ll resume as soon as the queue is clear.`;
      }
    }
    return steps;
  }

  private waitingDetail (): string {
    const counts = this.queueHealth?.counts;
    const parts = [
      counts?.openTaskCount ? `${counts.openTaskCount} task${counts.openTaskCount === 1 ? '' : 's'}` : '',
      counts?.openDraftCount ? `${counts.openDraftCount.toLocaleString()} email draft${counts.openDraftCount === 1 ? '' : 's'}` : '',
      counts?.openSocialPostCount ? `${counts.openSocialPostCount} social post${counts.openSocialPostCount === 1 ? '' : 's'}` : '',
    ].filter( Boolean );
    if ( !parts.length ) return 'Approve or reject the drafts and tasks I’ve sent you.';
    const list = parts.length > 1 ? `${parts.slice( 0, -1 ).join( ', ' )} and ${parts[parts.length - 1]}` : parts[0];
    return `${list} ${parts.length === 1 && /^1 /.test( list ) ? 'is' : 'are'} waiting on you.`;
  }

  private timeOf ( records: MayaRunStepStatus[], state: RunState ): string {
    const stamps = records
      .map( step => String( step.completedAt || step.startedAt || '' ) )
      .filter( Boolean )
      .sort();
    if ( !stamps.length || state === 'todo' || state === 'waiting' ) return '';
    const date = new Date( stamps[stamps.length - 1] );
    return Number.isNaN( date.getTime() ) ? '' : date.toLocaleTimeString( 'en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' } );
  }

  private buildWords (): void {
    const plan = this.currentPlanStep;
    const done = this.doneSteps;
    const forecast = forecastEnd( plan, this.rows, this.today );
    const behind = againstPlanLabel( plan, forecast );

    if ( !this.hasRun ) {
      this.headline = 'I haven’t started today yet.';
    } else if ( this.queueHealth?.blocked ) {
      this.headline = 'I’m paused until you review.';
    } else if ( this.runSteps.some( step => step.state === 'stopped' ) ) {
      this.headline = 'Today’s run hit a problem.';
    } else if ( plan ) {
      this.headline = forecast ? `Working, but behind: step ${plan.number} of ${this.planSteps.length}.` : `On track: step ${plan.number} of ${this.planSteps.length}.`;
    } else {
      this.headline = 'Today’s run is moving.';
    }

    const parts: string[] = [];
    if ( !this.hasRun ) parts.push( 'My day starts at 6 AM Pacific. Nothing has run yet today.' );
    else if ( done.length ) parts.push( `I’ve done ${done.length} of today’s ${this.runSteps.length} steps.` );
    const stoppedStep = this.runSteps.find( step => step.state === 'stopped' );
    if ( stoppedStep ) parts.push( `I stopped at “${stoppedStep.title.toLowerCase()}”.` );
    if ( this.queueHealth?.blocked ) parts.push( `${this.waitingDetail()} Once the queue is clear I’ll pick up the rest.` );
    this.sentence = parts.join( ' ' );

    const behindText = behind === 'On time' ? 'on time' : `${behind.replace( '+', '' )} behind`;
    this.planFooter = plan ? `step ${plan.number} of ${this.planSteps.length}, ${plan.title.toLowerCase()} · ${behindText}` : '';
    const stepDone = this.rows.filter( row => row.state === 'done' ).length;
    this.planSentence = plan
      ? `Today’s work is for this step.${this.rows.length ? ` ${stepDone} of ${this.rows.length} done` : ''}${behind === 'On time' ? ', on time.' : `, ${behindText}.`}`
      : '';
    const remaining = this.rows.filter( row => row.state !== 'done' ).length;
    this.tomorrow = plan
      ? `Keep going on ${plan.title.toLowerCase()}${remaining ? `: ${remaining} item${remaining === 1 ? '' : 's'} left` : ''}.${this.queueHealth?.blocked ? ' New drafts wait until the review queue clears.' : ''}`
      : '';
  }

  private readView (): StatusView {
    try {
      return localStorage.getItem( VIEW_KEY ) === 'timeline' ? 'timeline' : 'cols';
    } catch {
      return 'cols';
    }
  }
}
