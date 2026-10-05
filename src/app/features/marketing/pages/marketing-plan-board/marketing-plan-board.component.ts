import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, Subscription, catchError, map, of, switchMap, take } from 'rxjs';

import { AuthService } from '../../../../services/auth.service';
import { MayaPlanService } from '../../../../services/maya-plan.service';
import { DEFAULT_MARKETING_EMPLOYEE_ID, MarketingEmployeeActionRecord, MarketingPlanRecord } from '../../models/marketing-employee.models';
import {
  ActionRow,
  MayaNeed,
  PlanHealth,
  StepView,
  addDays,
  againstPlanLabel,
  buildNeeds,
  currentStepView,
  daysBetween,
  forecastEnd,
  pickActivePlan,
  planHealth,
  planSentence,
  shortDate,
  stepActionRows,
  stepViews,
  todayKey,
} from '../../models/maya-progress';
import { MarketingEmployeeService, MayaQueueHealth } from '../../services/marketing-employee.service';

type PlanView = 'list' | 'timeline';

interface TimelineBar {
  /** Percent of the track. */
  left: number;
  width: number;
}

interface TimelineRow {
  step: StepView;
  sub: string;
  planned: TimelineBar | null;
  actual: TimelineBar | null;
  actualLabel: string;
  overrun: TimelineBar | null;
}

const VIEW_KEY = 'maya.planView';

/**
 * Maya's plan (design_handoff_maya_plan_status, 18a): the plan as steps that
 * get checked off - where she is, what's stuck, and what she needs from you -
 * as a list or a timeline against the planned dates.
 */
@Component( {
  selector: 'app-marketing-plan-board',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './marketing-plan-board.component.html',
  styleUrl: './marketing-plan-board.component.css'
} )
export class MarketingPlanBoardComponent implements OnInit, OnDestroy {
  readonly avatarUrl = 'assets/find/entities/maya/logo-icon.png';
  readonly today = todayKey();

  view: PlanView = 'list';
  loading = true;
  isLoggedIn = false;
  tenantId = '';
  plan: MarketingPlanRecord | null = null;
  deriving = false;
  deriveError = '';
  actionError = '';
  saving = false;
  showWrittenPlan = false;
  editingDates = false;
  dateDrafts: Record<string, { plannedStart: string; plannedEnd: string; }> = {};

  steps: StepView[] = [];
  current: StepView | null = null;
  rows: ActionRow[] = [];
  needs: MayaNeed[] = [];
  health: PlanHealth = 'on-track';
  sentence = '';
  forecast: string | null = null;
  againstPlan = 'On time';
  weeks: string[] = [];
  timeline: TimelineRow[] = [];
  todayLeft: number | null = null;

  private queueHealth: MayaQueueHealth | null = null;
  private stepActions: MarketingEmployeeActionRecord[] = [];
  private readonly ensured = new Set<string>();
  private subscription?: Subscription;

  constructor (
    private readonly authService: AuthService,
    private readonly marketingEmployeeService: MarketingEmployeeService,
    private readonly mayaPlan: MayaPlanService,
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
        this.tenantId = String( tenantId || '' ).trim();
        if ( !this.tenantId ) return of( null );
        this.loadQueueHealth();
        return this.marketingEmployeeService.watchMarketingPlans( this.tenantId, DEFAULT_MARKETING_EMPLOYEE_ID, { status: 'active', limit: 6 } ).pipe(
          map( plans => pickActivePlan( plans ) ),
          switchMap( plan => this.withStepActions( plan ) ),
        );
      } ),
    ).subscribe( {
      next: state => {
        this.plan = state?.plan || null;
        this.stepActions = state?.actions || [];
        this.loading = false;
        if ( this.plan?.id ) void this.ensureSteps( this.plan.id );
        this.rebuild();
      },
      error: () => {
        this.loading = false;
        this.deriveError = 'Your plan isn’t available right now.';
      },
    } );
  }

  ngOnDestroy (): void {
    this.subscription?.unsubscribe();
  }

  setView ( view: PlanView ): void {
    this.view = view;
    try { localStorage.setItem( VIEW_KEY, view ); } catch { /* storage blocked: the view just isn't remembered */ }
  }

  /** Runs a need's button that this page handles itself (dates). */
  async onNeed ( need: MayaNeed, secondary = false ): Promise<void> {
    if ( need.id !== 'dates' ) return;
    if ( secondary ) {
      this.setView( 'timeline' );
      this.startEditingDates();
    } else {
      await this.keepDates();
    }
  }

  async keepDates (): Promise<void> {
    await this.save( () => this.mayaPlan.saveDates( this.plan!.id! ) );
  }

  startEditingDates (): void {
    this.dateDrafts = Object.fromEntries( this.steps.map( step => [step.id, { plannedStart: step.plannedStart || '', plannedEnd: step.plannedEnd || '' }] ) );
    this.editingDates = true;
  }

  async saveDates (): Promise<void> {
    const edits = Object.entries( this.dateDrafts ).map( ( [id, dates] ) => ( { id, ...dates } ) );
    await this.save( () => this.mayaPlan.saveDates( this.plan!.id!, edits ) );
    if ( !this.actionError ) this.editingDates = false;
  }

  async completeCurrentStep (): Promise<void> {
    if ( !this.current ) return;
    const stepId = this.current.id;
    await this.save( () => this.mayaPlan.completeStep( this.plan!.id!, stepId ) );
  }

  trackById ( _index: number, item: { id: string; } ): string {
    return item.id;
  }

  goalStepsLabel ( stepIds: string[] ): string {
    const numbers = stepIds.map( id => this.steps.find( step => step.id === id )?.number ).filter( ( n ): n is number => !!n );
    if ( !numbers.length ) return '';
    if ( numbers.length === 1 ) return `Step ${numbers[0]}`;
    return `Steps ${numbers.slice( 0, -1 ).join( ', ' )} and ${numbers[numbers.length - 1]}`;
  }

  stepTag ( step: StepView ): string {
    if ( step.state === 'done' ) return step.late ? 'Done late' : 'Done';
    if ( step.isCurrent ) {
      const done = this.rows.filter( row => row.state === 'done' ).length;
      const stuck = this.rows.filter( row => row.state === 'stuck' ).length;
      if ( !this.rows.length ) return 'In progress';
      return `${done} of ${this.rows.length} done${stuck ? ` · ${stuck} stuck` : ''}`;
    }
    return step.number === ( this.current?.number || 0 ) + 1 ? 'Up next' : 'To do';
  }

  get doneCount (): number {
    return this.steps.filter( step => step.state === 'done' ).length;
  }

  get healthLabel (): string {
    return { stuck: 'Stuck · needs you', behind: 'Behind', 'on-track': 'On track', done: 'Done' }[this.health];
  }

  get timelineLabel (): string {
    return this.plan?.datesConfirmed ? `Due ${shortDate( this.steps[this.steps.length - 1]?.plannedEnd )}` : 'Timeline not set';
  }

  get datesNeed (): MayaNeed | undefined {
    return this.needs.find( need => need.id === 'dates' );
  }

  get otherNeeds (): MayaNeed[] {
    return this.needs.filter( need => need.id !== 'dates' );
  }

  shortDate ( dateKey: string | null | undefined ): string {
    return shortDate( dateKey );
  }

  private withStepActions ( plan: MarketingPlanRecord | null ): Observable<{ plan: MarketingPlanRecord | null; actions: MarketingEmployeeActionRecord[]; }> {
    const currentId = plan?.steps?.find( step => step.status !== 'done' )?.id || '';
    if ( !currentId ) return of( { plan, actions: [] } );
    return this.marketingEmployeeService.watchStepActions( this.tenantId, currentId ).pipe(
      map( actions => ( { plan, actions } ) ),
      catchError( () => of( { plan, actions: [] as MarketingEmployeeActionRecord[] } ) ),
    );
  }

  /** Once per plan per visit; cheap when the plan already has current steps. */
  private async ensureSteps ( planId: string ): Promise<void> {
    if ( this.ensured.has( planId ) ) return;
    this.ensured.add( planId );
    this.deriving = !this.plan?.steps?.length;
    this.deriveError = '';
    try {
      await this.mayaPlan.ensureSteps( planId );
    } catch ( error: any ) {
      if ( !this.plan?.steps?.length ) {
        this.deriveError = error?.error?.message || 'Maya couldn’t read your plan’s steps. Please try again later.';
      }
    } finally {
      this.deriving = false;
    }
  }

  private loadQueueHealth (): void {
    this.marketingEmployeeService.getMayaRunStatus( this.tenantId, this.today ).pipe( take( 1 ) ).subscribe( response => {
      this.queueHealth = response?.data?.queueHealth || null;
      this.rebuild();
    } );
  }

  private async save ( work: () => Promise<unknown> ): Promise<void> {
    if ( !this.plan?.id || this.saving ) return;
    this.saving = true;
    this.actionError = '';
    try {
      await work();
    } catch ( error: any ) {
      this.actionError = error?.error?.message || error?.message || 'That didn’t save. Please try again.';
    } finally {
      this.saving = false;
    }
  }

  private rebuild (): void {
    this.rows = stepActionRows( this.stepActions );
    this.steps = stepViews( this.plan, this.rows, this.today );
    this.current = currentStepView( this.steps );
    this.needs = buildNeeds( { blockedRows: this.rows.filter( row => row.state === 'stuck' ), queueHealth: this.queueHealth, plan: this.plan } );
    this.forecast = forecastEnd( this.current, this.rows, this.today );
    this.againstPlan = againstPlanLabel( this.current, this.forecast );
    this.health = planHealth( this.steps, this.needs, this.forecast );
    this.sentence = planSentence( this.steps, this.rows, this.needs, this.forecast );
    this.buildTimeline();
  }

  /** Weekly columns from the first planned start to the last end (or forecast). */
  private buildTimeline (): void {
    const dated = this.steps.filter( step => step.plannedStart && step.plannedEnd );
    if ( !dated.length ) {
      this.weeks = [];
      this.timeline = [];
      this.todayLeft = null;
      return;
    }
    const first = dated.map( step => step.plannedStart! ).sort()[0];
    const ends = [...dated.map( step => step.plannedEnd! ), this.forecast || '', this.today].filter( Boolean ).sort();
    // Weeks start on Monday.
    const firstDay = new Date( `${first}T12:00:00Z` ).getUTCDay();
    const start = addDays( first, -( ( firstDay + 6 ) % 7 ) );
    const weekCount = Math.max( 4, Math.min( 16, Math.ceil( ( daysBetween( start, ends[ends.length - 1] ) + 1 ) / 7 ) ) );
    const totalDays = weekCount * 7;
    const pct = ( dateKey: string ) => Math.max( 0, Math.min( 100, ( daysBetween( start, dateKey ) / totalDays ) * 100 ) );
    const bar = ( from: string, to: string ): TimelineBar => {
      const left = pct( from );
      return { left, width: Math.max( 1.5, pct( addDays( to, 1 ) ) - left ) };
    };

    this.weeks = Array.from( { length: weekCount }, ( _v, index ) => shortDate( addDays( start, index * 7 ) ) );
    this.todayLeft = this.today >= start && this.today <= addDays( start, totalDays ) ? pct( this.today ) : null;
    const done = this.rows.filter( row => row.state === 'done' ).length;

    this.timeline = this.steps.map( step => {
      const planned = step.plannedStart && step.plannedEnd ? bar( step.plannedStart, step.plannedEnd ) : null;
      let actual: TimelineBar | null = null;
      let overrun: TimelineBar | null = null;
      if ( step.state === 'done' && step.plannedStart ) {
        const finished = step.completedAt ? step.completedAt.slice( 0, 10 ) : step.plannedEnd!;
        actual = bar( step.plannedStart, finished < step.plannedStart ? step.plannedEnd! : finished );
      } else if ( step.isCurrent && step.plannedStart && step.plannedStart <= this.today ) {
        actual = bar( step.plannedStart, this.today );
        if ( this.forecast ) overrun = bar( addDays( this.today, 1 ), this.forecast );
      }
      return {
        step,
        sub: this.timelineSub( step, done ),
        planned,
        actual,
        actualLabel: step.isCurrent && this.rows.length ? `${done} of ${this.rows.length}` : '',
        overrun,
      };
    } );
  }

  private timelineSub ( step: StepView, done: number ): string {
    if ( step.state === 'done' ) {
      const finished = step.completedAt?.slice( 0, 10 );
      const late = finished && step.plannedEnd ? daysBetween( step.plannedEnd, finished ) : 0;
      return late > 0 ? `Done ${late} day${late === 1 ? '' : 's'} late` : 'Done on time';
    }
    if ( step.isCurrent ) {
      return `Due ${shortDate( step.plannedEnd )}${this.rows.length ? ` · ${done} of ${this.rows.length} done` : ''}`;
    }
    const before = this.steps[step.number - 2];
    return before && before.state !== 'done' ? `Starts after ${before.title.toLowerCase()}` : `Starts ${shortDate( step.plannedStart )}`;
  }

  private readView (): PlanView {
    try {
      return localStorage.getItem( VIEW_KEY ) === 'timeline' ? 'timeline' : 'list';
    } catch {
      return 'list';
    }
  }
}
