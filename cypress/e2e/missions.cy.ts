/**
 * Missions from Maya (design_handoff_todd_missions 1e): work that needs more
 * than marketing gets a plan with an owner on every step. Fixtures come from
 * todd-backend scripts/missions-fixtures.js (the real engine).
 */
const ME = { uid: 'uid-owner', tenantId: 'tenant-1', paid: true };
const MISSIONS = '**/api/orchestration/missions';

describe( 'Missions from Maya (1e)', () => {
  beforeEach( () => cy.intercept( { url: '**/api/**' }, { statusCode: 200, body: { success: true } } ) );

  it( 'Maya’s work links to planning a Mission', () => {
    cy.visitWithCypressAuth( '/work', ME );
    cy.get( '[data-cy="work-to-missions"]' ).click();
    cy.location( 'pathname' ).should( 'eq', '/missions' );
  } );

  it( 'a request to Maya comes back as a plan with her, TODD and you on it', () => {
    cy.fixture( 'missions/campaign-assets.json' ).then( ( m ) => {
      const proposed = { ...m, id: 'campaign', status: 'proposed', steps: m.steps.map( ( s: any ) => ( { ...s, status: 'pending', output: null, resultSummary: '', finishedAt: null, finishedBy: null, activeSince: null } ) ) };
      cy.intercept( 'POST', MISSIONS, { statusCode: 202, body: { success: true, mode: 'mission', mission: { ...proposed, status: 'queued', steps: [] } } } ).as( 'ask' );
      cy.intercept( 'GET', `${MISSIONS}/campaign`, { success: true, mission: proposed } );
    } );
    cy.visitWithCypressAuth( '/missions', ME );
    cy.get( '[data-cy="ask-input"]' ).should( 'have.attr', 'placeholder', 'What should Maya work on?' ).type( 'Create a complete marketing campaign for our new service.' );
    cy.get( '[data-cy="ask-send"]' ).click();
    cy.wait( '@ask' ).its( 'request.body.origin' ).should( 'eq', 'maya' );
    cy.get( '[data-cy="plan-card"]' ).should( 'be.visible' );
    cy.get( '[data-cy="plan-split"]' ).should( 'contain.text', 'by Maya' ).and( 'contain.text', 'by TODD' ).and( 'contain.text', 'by you' );
    cy.get( '[data-cy="plan-start"]' ).should( 'be.visible' );
  } );

  it( 'emailing an industry about a new product is the segment plan, with Maya writing it', () => {
    cy.fixture( 'missions/segment-proposed.json' ).then( ( m ) => {
      cy.intercept( 'POST', MISSIONS, { statusCode: 202, body: { success: true, mode: 'mission', mission: { ...m, status: 'queued', steps: [] } } } ).as( 'ask' );
      cy.intercept( 'GET', `${MISSIONS}/pitch-segment`, { success: true, mission: m } );
    } );
    cy.visitWithCypressAuth( '/missions', ME );
    cy.get( '[data-cy="ask-input"]' ).type( 'Email the companies in the fashion industry about our new product.' );
    cy.get( '[data-cy="ask-send"]' ).click();
    cy.wait( '@ask' ).its( 'request.body.origin' ).should( 'eq', 'maya' );
    cy.get( '[data-cy="plan-title"]' ).should( 'contain.text', 'Email an industry segment' );
    cy.get( '[data-cy="plan-split"]' ).should( 'contain.text', 'by Maya' ).and( 'contain.text', 'by TODD' ).and( 'contain.text', 'by you' );
    cy.get( '[data-cy="fact-approvals"]' ).should( 'have.text', '1 approval from you' );
  } );

  it( 'a simple question is answered without a Mission', () => {
    cy.fixture( 'missions/direct.json' ).then( ( body ) => cy.intercept( 'POST', MISSIONS, body ) );
    cy.visitWithCypressAuth( '/missions', ME );
    cy.get( '[data-cy="ask-input"]' ).type( 'What’s Roland Martin’s email?' );
    cy.get( '[data-cy="ask-send"]' ).click();
    cy.get( '[data-cy="direct-answer"]' ).should( 'contain.text', 'Answered here. No Mission.' );
  } );
} );
