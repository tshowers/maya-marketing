import { CHAT_BRIEF_MARKER, jobPath } from '../../services/maya-jobs.service';
import { emailCreatorEditUrl } from './work.component';

describe( 'emailCreatorEditUrl', () => {
  it( 'opens the Docs email in Email Creator', () => {
    expect( emailCreatorEditUrl( 'abc123' ) ).toBe( 'https://emails.16ahead.com/?mayaEmail=abc123' );
  } );

  it( 'encodes the document id', () => {
    expect( emailCreatorEditUrl( 'a/b c' ) ).toBe( 'https://emails.16ahead.com/?mayaEmail=a%2Fb%20c' );
  } );
} );

describe( 'jobPath', () => {
  it( 'is the job’s own page', () => {
    expect( jobPath( '1Dwd49z5qJ6lLGMr8eAO' ) ).toBe( '/work/jobs/1Dwd49z5qJ6lLGMr8eAO' );
  } );

  it( 'encodes the job id', () => {
    expect( jobPath( 'a/b' ) ).toBe( '/work/jobs/a%2Fb' );
  } );
} );

describe( 'CHAT_BRIEF_MARKER', () => {
  it( 'drops the brief the chat appended, under either name', () => {
    const asked = 'Agencies/consultant';
    expect( `${asked}\nEmail brief from my chat with the Marketing Assistant:\nSubject idea: Revive`.replace( CHAT_BRIEF_MARKER, '' ) ).toBe( asked );
    expect( `${asked}\nEmail brief from my chat with Maya:\nSubject idea: Revive`.replace( CHAT_BRIEF_MARKER, '' ) ).toBe( asked );
  } );
} );
