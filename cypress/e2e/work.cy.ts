/**
 * The Marketing Assistant's work in three pages (Ty, 2026-10-30): Ask, Jobs,
 * and one job on its own, which is where the chat and Today link. The page
 * signs in through Firebase directly, so these cover what shows before
 * sign-in: the two pills, the routes, and old ?job= links landing on the
 * job's page.
 */
describe( 'The Marketing Assistant’s work', () => {
  beforeEach( () => cy.intercept( { url: '**/api/**' }, { statusCode: 200, body: { success: true } } ) );

  it( 'Ask and Jobs are two pages, picked from two pills', () => {
    cy.visit( '/work' );
    cy.get( '[data-cy="work-view-ask"]' ).should( 'have.class', 'is-selected' );
    cy.get( '[data-cy="work-view-jobs"]' ).click();
    cy.location( 'pathname' ).should( 'eq', '/work/jobs' );
    cy.get( '[data-cy="work-view-jobs"]' ).should( 'have.class', 'is-selected' );
    cy.get( '[data-cy="work-to-missions"]' ).should( 'not.exist' );
    cy.get( '[data-cy="work-view-ask"]' ).click();
    cy.location( 'pathname' ).should( 'eq', '/work' );
  } );

  it( 'a job has its own page, under Jobs', () => {
    cy.visit( '/work/jobs/done1' );
    cy.get( '[data-cy="work-view-jobs"]' ).should( 'have.class', 'is-selected' );
    cy.get( '[data-cy="work-signed-out"]' ).should( 'exist' );
  } );

  it( 'old ?job= links open the job’s page', () => {
    cy.visit( '/work?job=done1' );
    cy.location( 'pathname' ).should( 'eq', '/work/jobs/done1' );
    cy.location( 'search' ).should( 'eq', '' );
  } );
} );
