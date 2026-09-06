import { MarketingDirectorCapabilitiesService } from './marketing-director-capabilities.service';

describe( 'MarketingDirectorCapabilitiesService', () => {
  let service: MarketingDirectorCapabilitiesService;

  beforeEach( () => {
    service = new MarketingDirectorCapabilitiesService();
  } );

  it( 'routes outreach overview questions to the outreach cockpit', () => {
    const result = service.tryRouteGuide( 'What outreach should we be doing?' );
    expect( result.handled ).toBeTrue();
    if ( !result.handled || result.kind !== 'message' ) {
      fail( 'Expected an outreach route guide.' );
      return;
    }

    expect( result.message ).toContain( '/outreach/app' );
  } );

  it( 'routes email-queue questions to Signal Engine', () => {
    const result = service.tryRouteGuide( 'Show the email queue.' );
    expect( result.handled ).toBeTrue();
    if ( !result.handled || result.kind !== 'message' ) {
      fail( 'Expected an email-queue route guide.' );
      return;
    }

    expect( result.message ).toContain( '/signal-engine' );
  } );

  it( 'routes social-strategy questions to the strategy page', () => {
    const result = service.tryRouteGuide( 'What should our social strategy be?' );
    expect( result.handled ).toBeTrue();
    if ( !result.handled || result.kind !== 'message' ) {
      fail( 'Expected a social strategy route guide.' );
      return;
    }

    expect( result.message ).toContain( '/outreach/social/strategy' );
  } );
} );
