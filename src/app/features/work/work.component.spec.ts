import { emailCreatorEditUrl } from './work.component';

describe( 'emailCreatorEditUrl', () => {
  it( 'opens the Docs email in Email Creator', () => {
    expect( emailCreatorEditUrl( 'abc123' ) ).toBe( 'https://emails.16ahead.com/?mayaEmail=abc123' );
  } );

  it( 'encodes the document id', () => {
    expect( emailCreatorEditUrl( 'a/b c' ) ).toBe( 'https://emails.16ahead.com/?mayaEmail=a%2Fb%20c' );
  } );
} );
