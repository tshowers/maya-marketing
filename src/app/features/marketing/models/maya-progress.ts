/**
 * What the Plan and Status pages share (design_handoff_maya_plan_status):
 * a plan step's state from its linked actions, the plan's health, and the
 * "What I need from you" list. Pure functions over the records the pages
 * already load, so both pages tell the same story.
 */
import { MayaQueueHealth } from '../services/marketing-employee.service';
import { MarketingEmployeeActionRecord, MarketingPlanRecord, MarketingPlanStep } from './marketing-employee.models';

/** Other TODD apps the pages send people to. */
export const MOVES_URL = 'https://moves.taliferro.tech';
export const OUTREACH_URL = 'https://outreach.taliferro.tech';

export type StepState = 'done' | 'doing' | 'stuck' | 'todo';
export type PlanHealth = 'stuck' | 'behind' | 'on-track' | 'done';

export interface StepView extends MarketingPlanStep {
  number: number;
  state: StepState;
  isCurrent: boolean;
  /** Overdue: still open after its planned end. */
  late: boolean;
}

export interface ActionRow {
  id: string;
  title: string;
  detail: string;
  state: 'done' | 'doing' | 'stuck' | 'todo';
  /** Where the user acts on it (the action's move), when stuck. */
  href: string | null;
  needsContact: boolean;
}

export interface MayaNeed {
  id: 'contacts' | 'review' | 'dates';
  title: string;
  detail: string;
  primaryLabel: string;
  /** A link, or null when the page handles the click itself (dates). */
  primaryHref: string | null;
  secondaryLabel?: string;
  secondaryHref?: string | null;
}

/** Pacific, like Maya's whole schedule. */
export function todayKey ( now = new Date() ): string {
  return new Intl.DateTimeFormat( 'en-CA', { timeZone: 'America/Los_Angeles' } ).format( now );
}

export function daysBetween ( fromKey: string, toKey: string ): number {
  const from = Date.parse( `${fromKey}T12:00:00Z` );
  const to = Date.parse( `${toKey}T12:00:00Z` );
  return Number.isNaN( from ) || Number.isNaN( to ) ? 0 : Math.round( ( to - from ) / 86400000 );
}

export function addDays ( dateKey: string, days: number ): string {
  const date = new Date( `${dateKey}T12:00:00Z` );
  date.setUTCDate( date.getUTCDate() + days );
  return date.toISOString().slice( 0, 10 );
}

export function shortDate ( dateKey: string | null | undefined ): string {
  if ( !dateKey ) return '';
  const date = new Date( `${dateKey}T12:00:00Z` );
  return Number.isNaN( date.getTime() ) ? '' : date.toLocaleDateString( 'en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' } );
}

/** "Mon, Oct 5" style long date for kickers. */
export function longDate ( now = new Date() ): string {
  return now.toLocaleDateString( 'en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles' } );
}

/** The latest thing Maya wrote on an action - her blocker, when it's blocked. */
export function latestMayaNote ( action: MarketingEmployeeActionRecord ): string {
  const notes = Array.isArray( action.notesLog ) ? action.notesLog : [];
  const mine = [...notes].reverse().find( note => note.author === 'maya' );
  return String( mine?.text || '' ).trim();
}

function cleanTitle ( title: string ): string {
  return String( title || '' ).replace( /^Marketing Plan:\s*/i, '' ).trim() || 'Untitled work';
}

function moveHref ( action: MarketingEmployeeActionRecord ): string | null {
  return action.moveId ? `${MOVES_URL}/move/${encodeURIComponent( action.moveId )}` : null;
}

function mentionsContact ( text: string ): boolean {
  return /\b(contact|person|who to (write|email)|recipient|lead vault)\b/i.test( text );
}

/**
 * A step's work as rows: the latest day's actions (the planner re-creates
 * them daily), plus anything still blocked from earlier days. Paused and
 * rejected items are rolled out of the lane, so they're left off.
 */
export function stepActionRows ( actions: MarketingEmployeeActionRecord[] ): ActionRow[] {
  const live = actions.filter( action => !['paused', 'rejected'].includes( String( action.status ) ) );
  const latestDay = live.map( action => String( action.plannedForDate || '' ) ).sort().pop() || '';
  return live
    .filter( action => String( action.plannedForDate || '' ) === latestDay || action.blocked === true )
    .map( action => {
      const note = latestMayaNote( action );
      const state: ActionRow['state'] = action.status === 'completed' ? 'done'
        : action.blocked ? 'stuck'
          : action.status === 'approved' || ( action.progress || 0 ) > 0 ? 'doing'
            : 'todo';
      return {
        id: String( action.id || action.title ),
        title: cleanTitle( action.title ),
        detail: state === 'stuck' && note ? note : String( note || action.description || '' ).replace( /\s+/g, ' ' ).trim(),
        state,
        href: state === 'stuck' ? moveHref( action ) : null,
        needsContact: state === 'stuck' && mentionsContact( note ),
      };
    } )
    .sort( ( a, b ) => ['done', 'doing', 'stuck', 'todo'].indexOf( a.state ) - ['done', 'doing', 'stuck', 'todo'].indexOf( b.state ) );
}

/**
 * Steps with their display state. Done steps stay done. The current step is
 * stuck when any of its work is blocked, else doing. The rest are to do.
 */
export function stepViews ( plan: MarketingPlanRecord | null, currentRows: ActionRow[], today = todayKey() ): StepView[] {
  const steps = plan?.steps || [];
  const current = steps.find( step => step.status !== 'done' );
  return steps.map( ( step, index ) => {
    const isCurrent = step === current;
    const state: StepState = step.status === 'done' ? 'done'
      : isCurrent ? ( currentRows.some( row => row.state === 'stuck' ) ? 'stuck' : 'doing' )
        : 'todo';
    return {
      ...step,
      number: index + 1,
      state,
      isCurrent,
      late: state !== 'done' && !!step.plannedEnd && step.plannedEnd < today,
    };
  } );
}

export function currentStepView ( steps: StepView[] ): StepView | null {
  return steps.find( step => step.isCurrent ) || null;
}

/**
 * When the current step will likely finish: today plus the unfinished share
 * of its planned length. Null when nothing is in progress or it's on time.
 */
export function forecastEnd ( step: StepView | null, rows: ActionRow[], today = todayKey() ): string | null {
  if ( !step || !step.plannedStart || !step.plannedEnd ) return null;
  const total = rows.length;
  const remaining = total ? rows.filter( row => row.state !== 'done' ).length / total : 1;
  const length = Math.max( 1, daysBetween( step.plannedStart, step.plannedEnd ) );
  const forecast = addDays( today, Math.ceil( remaining * length ) );
  return forecast > step.plannedEnd ? forecast : null;
}

/** "+1 week", "+3 days", or "On time". */
export function againstPlanLabel ( step: StepView | null, forecast: string | null ): string {
  if ( !step?.plannedEnd || !forecast ) return 'On time';
  const days = daysBetween( step.plannedEnd, forecast );
  if ( days <= 0 ) return 'On time';
  const weeks = Math.round( days / 7 );
  return weeks >= 1 ? `+${weeks} week${weeks === 1 ? '' : 's'}` : `+${days} day${days === 1 ? '' : 's'}`;
}

export function planHealth ( steps: StepView[], needs: MayaNeed[], forecast: string | null ): PlanHealth {
  const current = currentStepView( steps );
  if ( steps.length && !current ) return 'done';
  if ( current?.state === 'stuck' || needs.some( need => need.id === 'contacts' || need.id === 'review' ) ) return 'stuck';
  if ( current?.late || forecast ) return 'behind';
  return 'on-track';
}

/** Maya's one-sentence read on the plan. */
export function planSentence ( steps: StepView[], rows: ActionRow[], needs: MayaNeed[], forecast: string | null ): string {
  const current = currentStepView( steps );
  if ( !steps.length ) return '';
  if ( !current ) return 'Every step of the plan is done. Tell me what comes next and I’ll plan it.';
  const parts = [`We’re on step ${current.number} of ${steps.length}, ${current.title.toLowerCase()}.`];
  const stuck = rows.filter( row => row.state === 'stuck' ).length;
  if ( stuck ) parts.push( `${stuck === 1 ? 'One item is' : `${stuck} items are`} stuck until you help.` );
  if ( needs.some( need => need.id === 'review' ) ) parts.push( 'I’ve paused new drafts until you review what’s waiting.' );
  if ( forecast ) {
    parts.push( `It was due ${shortDate( current.plannedEnd )}; at this pace I’ll finish it around ${shortDate( forecast )}.` );
  } else if ( current.plannedEnd ) {
    parts.push( `I can finish this step by ${shortDate( current.plannedEnd )}.` );
  }
  return parts.join( ' ' );
}

/**
 * "What I need from you": blocked work, the review backlog when it has
 * stopped Maya, and unconfirmed dates. Empty when nothing needs the user.
 */
export function buildNeeds ( input: {
  blockedRows: ActionRow[];
  queueHealth: MayaQueueHealth | null | undefined;
  plan: MarketingPlanRecord | null;
} ): MayaNeed[] {
  const needs: MayaNeed[] = [];
  const blocked = input.blockedRows;
  if ( blocked.length ) {
    const contacts = blocked.every( row => row.needsContact );
    const names = blocked.slice( 0, 2 ).map( row => row.title ).join( ' and ' );
    needs.push( {
      id: 'contacts',
      title: contacts
        ? `Pick contacts for ${blocked.length === 1 ? blocked[0].title : `${blocked.length} items`}`
        : blocked.length === 1 ? `Help with ${blocked[0].title}` : `Help with ${blocked.length} stuck items`,
      detail: blocked.length === 1 ? blocked[0].detail : `${names}${blocked.length > 2 ? ` and ${blocked.length - 2} more` : ''} are on hold until you answer.`,
      primaryLabel: contacts ? ( blocked.length === 1 ? 'Choose contact' : 'Choose contacts' ) : 'Answer Maya',
      primaryHref: blocked[0].href || `${MOVES_URL}/moves`,
    } );
  }

  const health = input.queueHealth;
  if ( health?.blocked ) {
    const tasks = health.counts?.openTaskCount || 0;
    const drafts = health.counts?.openDraftCount || 0;
    const posts = health.counts?.openSocialPostCount || 0;
    const what = tasks ? `${tasks} waiting task${tasks === 1 ? '' : 's'}` : drafts ? `${drafts} draft${drafts === 1 ? '' : 's'}` : `${posts} social post${posts === 1 ? '' : 's'}`;
    needs.push( {
      id: 'review',
      title: `Review ${what}`,
      detail: `I’ve stopped writing new drafts until the review queue clears. Anything unreviewed for ${health.expiryDays || 14} days expires.`,
      primaryLabel: 'Start review',
      primaryHref: tasks ? `${MOVES_URL}/moves` : `${OUTREACH_URL}/signal-engine?tab=drafts`,
      secondaryLabel: tasks && drafts ? 'Open drafts' : undefined,
      secondaryHref: tasks && drafts ? `${OUTREACH_URL}/signal-engine?tab=drafts` : null,
    } );
  }

  const plan = input.plan;
  if ( plan?.steps?.length && plan.datesConfirmed !== true ) {
    needs.push( {
      id: 'dates',
      title: 'Set dates for the plan',
      detail: 'Your plan doesn’t give dates for each step, so the ones shown are my proposal. Keep them and I’ll hold myself to them.',
      primaryLabel: 'Use Maya’s dates',
      primaryHref: null,
      secondaryLabel: 'Set my own',
      secondaryHref: null,
    } );
  }
  return needs;
}

/** The plan Maya works from: the user's own plan over a generated one. */
export function pickActivePlan ( plans: MarketingPlanRecord[] ): MarketingPlanRecord | null {
  const active = Array.isArray( plans ) ? plans : [];
  return active.find( plan => String( plan?.sourceType || '' ).toLowerCase() !== 'generated' ) || active[0] || null;
}
