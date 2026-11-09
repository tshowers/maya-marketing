import { CHAT_BRIEF_MARKER, jobPath } from '../../services/maya-jobs.service';
import { WorkComponent, emailCreatorEditUrl, jobAudience } from './work.component';

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

describe( 'jobAudience', () => {
  it( 'is who the brief says the email was written for, for Catalyst', () => {
    expect( jobAudience( { brief: { goal: '', audience: '  Agencies/consultants  ', deliverables: [], constraints: [] } } ) ).toBe( 'Agencies/consultants' );
  } );

  it( 'is empty without a brief', () => {
    expect( jobAudience( { brief: null } ) ).toBe( '' );
    expect( jobAudience( null ) ).toBe( '' );
  } );
} );

describe( 'Sending a job’s email to Drips', () => {
  const email = { documentId: 'doc1', subject: 'Answer RFPs in hours', preheader: 'Preheader', fillIns: [], audience: 'Owners and consultants' };

  it( 'hands it off as a drip, without the Catalyst-only audience, and offers the drip to open', async () => {
    const handOffEmail = jasmine.createSpy( 'handOffEmail' ).and.resolveTo( 'https://outreach.16ahead.com/drips/d1' );
    const page: any = {
      sendPanel: { documentId: 'doc1', target: 'drips', canSend: true, fillIns: [], values: {}, working: false, error: '', openUrl: '' },
      api: { handOffEmail },
      loadHtml: async () => '<p>Hi</p>',
      fillsComplete: WorkComponent.prototype.fillsComplete,
    };
    await WorkComponent.prototype.prepareSend.call( page, email );
    expect( handOffEmail ).toHaveBeenCalledWith( { target: 'drips', subject: 'Answer RFPs in hours', preheader: 'Preheader', html: '<p>Hi</p>', fills: {} } );
    expect( page.sendPanel.openUrl ).toBe( 'https://outreach.16ahead.com/drips/d1' );
    expect( page.sendPanel.working ).toBeFalse();
  } );
} );
