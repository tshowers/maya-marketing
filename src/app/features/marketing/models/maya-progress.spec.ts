import { MarketingEmployeeActionRecord, MarketingPlanRecord } from './marketing-employee.models';
import {
  againstPlanLabel,
  buildNeeds,
  cleanTitle,
  currentStepView,
  forecastEnd,
  planHealth,
  stepActionRows,
  stepViews,
} from './maya-progress';

function action ( overrides: Partial<MarketingEmployeeActionRecord> ): MarketingEmployeeActionRecord {
  return {
    employeeId: 'marketing-employee', type: 'email', title: 'Marketing Plan: Draft', description: '', status: 'draft',
    priority: 'medium', reasoning: '', plannedForDate: '2026-10-05', ...overrides,
  } as MarketingEmployeeActionRecord;
}

const plan = {
  id: 'p1', employeeId: 'marketing-employee', title: 'Plan', sourceType: 'pasted', rawText: '', status: 'active',
  extracted: { goals: [], audiences: [], channels: [], campaigns: [], contentThemes: [], kpis: [], timeline: '' },
  datesConfirmed: false,
  steps: [
    { id: 's1', title: 'Positioning', summary: '', status: 'done', plannedStart: '2026-09-08', plannedEnd: '2026-09-14' },
    { id: 's2', title: 'Lead generation', summary: '', status: 'doing', plannedStart: '2026-09-22', plannedEnd: '2026-10-05' },
    { id: 's3', title: 'KPIs', summary: '', status: 'todo', plannedStart: '2026-10-06', plannedEnd: '2026-10-12' },
  ],
} as MarketingPlanRecord;

describe( 'maya progress', () => {
  it( 'shows the latest day’s work plus anything still blocked, without paused items', () => {
    const rows = stepActionRows( [
      action( { id: 'old-blocked', plannedForDate: '2026-10-04', blocked: true, moveId: 'm1', notesLog: [{ at: '', author: 'maya', text: 'No confident contact match. Needs a person from you.' }] } ),
      action( { id: 'old', plannedForDate: '2026-10-04' } ),
      action( { id: 'paused', status: 'paused' } ),
      action( { id: 'done', status: 'completed' } ),
      action( { id: 'todo' } ),
    ] );

    expect( rows.map( row => [row.id, row.state] ) ).toEqual( [['done', 'done'], ['old-blocked', 'stuck'], ['todo', 'todo']] );
    expect( rows[1].needsContact ).toBeTrue();
    expect( rows[1].href ).toBe( 'https://moves.16ahead.com/move/m1' );
    expect( rows[0].title ).toBe( 'Draft' );
  } );

  it( 'marks the current step stuck when its work is blocked, and late after its end date', () => {
    const rows = stepActionRows( [action( { blocked: true } )] );
    const steps = stepViews( plan, rows, '2026-10-07' );

    expect( steps.map( step => step.state ) ).toEqual( ['done', 'stuck', 'todo'] );
    expect( currentStepView( steps )?.late ).toBeTrue();
  } );

  it( 'forecasts the finish from the unfinished share and labels the slip', () => {
    const rows = stepActionRows( [action( { status: 'completed' } ), action( {} )] );
    const steps = stepViews( plan, rows, '2026-10-05' );
    const forecast = forecastEnd( currentStepView( steps ), rows, '2026-10-05' );

    // Half left of a 13-day step: 7 more days.
    expect( forecast ).toBe( '2026-10-12' );
    expect( againstPlanLabel( currentStepView( steps ), forecast ) ).toBe( '+1 week' );
    expect( againstPlanLabel( currentStepView( steps ), null ) ).toBe( 'On time' );
  } );

  it( 'lists blocked work, the review backlog when it stops Maya, and unconfirmed dates', () => {
    const rows = stepActionRows( [action( { blocked: true, moveId: 'm1', notesLog: [{ at: '', author: 'maya', text: 'Needs a contact.' }] } )] );
    const needs = buildNeeds( {
      blockedRows: rows,
      queueHealth: {
        blocked: true, taskBlocked: true, draftBlocked: false, socialPostBlocked: false, detail: '', expiryDays: 14,
        counts: { openTaskCount: 56, openDraftCount: 2152, openSocialPostCount: 0, taskLimit: 50, draftLimit: 3000, socialPostLimit: 50 },
      },
      plan,
    } );

    expect( needs.map( need => need.id ) ).toEqual( ['contacts', 'review', 'dates'] );
    expect( needs[1].title ).toBe( 'Review 56 waiting tasks' );
    expect( needs[1].primaryHref ).toContain( 'moves' );
    expect( planHealth( stepViews( plan, rows ), needs, null ) ).toBe( 'stuck' );
    expect( buildNeeds( { blockedRows: [], queueHealth: null, plan: { ...plan, datesConfirmed: true } } ) ).toEqual( [] );
  } );
} );

describe( 'review cards name the limit that is hit (Ty, 2026-10-31)', () => {
  it( 'full social posts read as social posts, with a link to Social, not "Review N drafts"', () => {
    const needs = buildNeeds( {
      blockedRows: [],
      queueHealth: {
        blocked: true, taskBlocked: false, draftBlocked: false, socialPostBlocked: true, detail: '', expiryDays: 14,
        counts: { openTaskCount: 0, openDraftCount: 74, openSocialPostCount: 106, taskLimit: 10, draftLimit: 100, socialPostLimit: 100 },
      },
      plan: null as unknown as MarketingPlanRecord,
    } );
    expect( needs.map( need => [need.title, need.primaryHref] ) ).toEqual( [['Review 106 social posts', 'https://social.16ahead.com/today']] );
  } );

  it( 'a full Drafts opens Drafts', () => {
    const needs = buildNeeds( {
      blockedRows: [],
      queueHealth: {
        blocked: true, taskBlocked: false, draftBlocked: true, socialPostBlocked: false, detail: '', expiryDays: 14,
        counts: { openTaskCount: 0, openDraftCount: 100, openSocialPostCount: 0, taskLimit: 10, draftLimit: 100, socialPostLimit: 100 },
      },
      plan: null as unknown as MarketingPlanRecord,
    } );
    expect( needs.map( need => [need.title, need.primaryHref] ) ).toEqual( [['Review 100 email drafts', 'https://outreach.16ahead.com/drafts']] );
  } );
} );

describe( 'cleanTitle: execution tasks saved before the rename (Ty, 2026-10-31)', () => {
  it( 'reads TODD and 16Ahead execution tasks as plain steps', () => {
    expect( cleanTitle( 'TODD execute email batch for Small business owners evaluating AI automation' ) ).toBe( 'Send the approved emails to Small business owners evaluating AI automation' );
    expect( cleanTitle( '16Ahead schedule social queue for practical workflow proof' ) ).toBe( 'Schedule the approved social posts for practical workflow proof' );
    expect( cleanTitle( 'TODD execute outbound email batch' ) ).toBe( 'Send outbound email batch' );
    expect( cleanTitle( 'Marketing Plan: Review today\'s progress' ) ).toBe( 'Review today\'s progress' );
  } );
} );
