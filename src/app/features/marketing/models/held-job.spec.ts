import { PublicMarketingDirectorSystemAction } from '../services/public-marketing-director.service';
import { HeldJob, asksQuestion, heldJobNotice, planDirectorActions, startsJob, withAnswers } from './held-job';

const email: PublicMarketingDirectorSystemAction = { type: 'send_email', subject: 'Meet Outreach', to: 'all contacts', text: 'Brief' };
const mayaMove: PublicMarketingDirectorSystemAction = { type: 'create_move', title: 'Draft posts', ownerLabel: 'Maya' };
const yourMove: PublicMarketingDirectorSystemAction = { type: 'create_move', title: 'Call the printer', ownerLabel: 'You' };
const doc: PublicMarketingDirectorSystemAction = { type: 'create_document', title: 'Messaging' };

describe( 'held job', () => {
  it( 'counts emails and Maya-owned moves as job-starting', () => {
    expect( startsJob( email ) ).toBeTrue();
    expect( startsJob( mayaMove ) ).toBeTrue();
    expect( startsJob( yourMove ) ).toBeFalse();
    expect( startsJob( doc ) ).toBeFalse();
  } );

  it( 'sees a question in choices or a sentence ending in "?", not in a link', () => {
    expect( asksQuestion( 'Here is the plan.', [{ question: 'Which email first?', options: ['A', 'B'] }] ) ).toBeTrue();
    expect( asksQuestion( 'Which email first? Pick one.' ) ).toBeTrue();
    expect( asksQuestion( 'Want me to proceed with these two drafts as-is?' ) ).toBeTrue();
    expect( asksQuestion( 'Want me to go ahead ("yes" or "no")?' ) ).toBeTrue();
    expect( asksQuestion( 'Started it: https://marketing.16ahead.com/work?job=abc and /work?job=abc.' ) ).toBeFalse();
    expect( asksQuestion( 'Starting the email now.' ) ).toBeFalse();
  } );

  it( 'holds job actions from a reply that asks, and runs the rest', () => {
    const plan = planDirectorActions( [email, doc, yourMove], 'Write an email to my contacts', true, null );
    expect( plan.run ).toEqual( [doc, yourMove] );
    expect( plan.hold ).toEqual( { request: 'Write an email to my contacts', answers: [], actions: [email] } );
  } );

  it( 'runs everything from a reply that does not ask', () => {
    const plan = planDirectorActions( [email, doc], 'Write an email', false, null );
    expect( plan.run ).toEqual( [doc, email] );
    expect( plan.hold ).toBeNull();
    expect( plan.answers ).toEqual( [] );
  } );

  it( 'starts the held job on the answer, for the original request plus the answer', () => {
    const held: HeldJob = { request: 'Write an email to my contacts', answers: [], actions: [email] };
    const plan = planDirectorActions( [], 'Outreach+Network focus', false, held );
    expect( plan.run ).toEqual( [email] );
    expect( plan.request ).toBe( 'Write an email to my contacts' );
    expect( plan.answers ).toEqual( ['Outreach+Network focus'] );
    expect( plan.hold ).toBeNull();
  } );

  it( 'uses the answer reply\'s own job actions instead of the held ones', () => {
    const held: HeldJob = { request: 'Write an email', answers: [], actions: [email] };
    const rewritten: PublicMarketingDirectorSystemAction = { ...email, subject: 'Outreach + Network' };
    const plan = planDirectorActions( [rewritten], 'Outreach+Network focus', false, held );
    expect( plan.run ).toEqual( [rewritten] );
    expect( plan.request ).toBe( 'Write an email' );
  } );

  it( 'keeps holding, with the answers so far, when the next reply asks again', () => {
    const held: HeldJob = { request: 'Write an email', answers: [], actions: [email] };
    const plan = planDirectorActions( [], 'Outreach+Network focus', true, held );
    expect( plan.run ).toEqual( [] );
    expect( plan.hold ).toEqual( { request: 'Write an email', answers: ['Outreach+Network focus'], actions: [email] } );
  } );

  it( 'puts the answers after the brief and keeps them within the limit', () => {
    expect( withAnswers( 'Request\nBrief', [] ) ).toBe( 'Request\nBrief' );
    expect( withAnswers( 'Request\nBrief', ['Outreach+Network focus'] ) ).toBe( 'Request\nBrief\nYour answer: Outreach+Network focus' );
    const long = withAnswers( 'x'.repeat( 5000 ), ['Outreach+Network focus'] );
    expect( long.length ).toBeLessThanOrEqual( 4000 );
    expect( long.endsWith( 'Your answer: Outreach+Network focus' ) ).toBeTrue();
  } );

  it( 'says what it is waiting on', () => {
    expect( heldJobNotice( { request: 'r', answers: [], actions: [email, mayaMove] } ) )
      .toBe( 'Execution receipt: nothing has started yet. I\'ll start the email "Meet Outreach" and "Draft posts" as soon as you answer the question above, with your answer in the brief.' );
  } );
} );
