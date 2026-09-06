import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, from, map, Observable, of, Subscription } from 'rxjs';
import { Contact, Communication, Interaction, SuggestedContact } from '../shared/data/interfaces/contact.model';
import { LoggerService } from './logger.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { OpenAIService } from './open-ai.service';
import { DataService } from './data.service';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable( {
  providedIn: 'root'
} )
export class ContactService {


  private contactSource = new BehaviorSubject<Contact | null>( null );
  currentContact = this.contactSource.asObservable();

  private queueSource = new BehaviorSubject<Contact[]>( [] );
  currentQueue = this.queueSource.asObservable();

  private contactReason = new BehaviorSubject<string | null>( null );
  currentReason = this.contactReason.asObservable();

  private suggestedContacts: SuggestedContact[] = [];

  private communicationChartData: any;
  private contactSuggestorSubscription!: Subscription;

  private _lastContactLoadTime = new Date().getTime();


  private readonly cacheKey = 'suggestedContacts';
  private readonly timestampKey = 'suggestedContactsTimestamp';

  private readonly notEngagedDeletedCountKey = 'notEngagedDeletedCount';
  private readonly notEngagedDeletedIdsKey = 'notEngagedDeletedIds';

  private notEngagedDeletedCountSource = new BehaviorSubject<number>( 0 );
  currentNotEngagedDeletedCount = this.notEngagedDeletedCountSource.asObservable();
  private readonly engagementCacheTtlMs = 10 * 60 * 1000;
  private readonly engagementCache = new Map<string, { expiresAt: number; logs: any[]; }>();
  private readonly engagementRequests = new Map<string, Promise<any[]>>();

  private readonly fieldSynonyms: Record<string, string> = {
    'number': 'phone',
    'phone': 'phone',
    'phone number': 'phone',
    'email': 'email',
    'email address': 'email',
    'company': 'company',
    'work phone': 'company phone',
    'work email': 'company email',
    'website': 'company url',
    'linkedin': 'linkedin',
    'linkedin url': 'linkedin',
    'location': 'address',
    'address': 'address',
    'dob': 'birthday',
    'birthday': 'birthday',
    'nickname': 'nickname',
    'gender': 'gender',
    'social': 'social media',
    'social media': 'social media'
  };

  private authSubscription!: Subscription;
  private userSubscription!: Subscription;
  private userId!: any;


  constructor ( private http: HttpClient, private logger: LoggerService, private openAIService: OpenAIService,
    private router: Router,
    private authService: AuthService,
    private dataService: DataService ) {

    this.authSubscription = this.authService.getTenantId().subscribe( tenantId => {
      this.userSubscription = this.authService.getUserId().subscribe( userId => {
        this.userId = userId;
      } );

    } );

    // Initialize not-engaged deletion counter from localStorage
    const rawCount = localStorage.getItem( this.notEngagedDeletedCountKey );
    const count = rawCount ? parseInt( rawCount, 10 ) : 0;
    this.notEngagedDeletedCountSource.next( Number.isFinite( count ) ? count : 0 );

  }

  changeContact ( contact: Contact ) {
    this.contactSource.next( contact );
  }

  resetContact () {
    this.contactSource.next( null );  // Set the currentContact to null
  }

  changeReason ( reason: string ) {
    this.contactReason.next( reason );
  }

  resetReason () {
    this.contactReason.next( null );  // Set the currentContact to null
  }


  /**
   * Fetches email engagements for a contact and returns them as an array.
   * Uses the first email address in contact.emailAddresses.
   */
  async getEmailEngagementsForContact ( contact: Contact, tenantId: string ): Promise<any[]> {
    if ( !contact || !contact.emailAddresses || contact.emailAddresses.length === 0 ) {
      return [];
    }

    const emailAddress = contact.emailAddresses[0].emailAddress;
    const cacheKey = `${tenantId}::${String( emailAddress || '' ).trim().toLowerCase()}`;
    const now = Date.now();
    const cached = this.engagementCache.get( cacheKey );

    if ( cached && cached.expiresAt > now ) {
      return cached.logs;
    }

    const inFlight = this.engagementRequests.get( cacheKey );
    if ( inFlight ) {
      return inFlight;
    }

    const request = this.dataService.getEmailsByEmailAddress( emailAddress, tenantId )
      .then( ( logs ) => {
        const safeLogs: any[] = Array.isArray( logs ) ? logs : [];

        this.engagementCache.set( cacheKey, {
          expiresAt: Date.now() + this.engagementCacheTtlMs,
          logs: safeLogs
        } );

        return safeLogs;
      } )
      .catch( ( error ) => {
        this.logger.error( '[ENGAGEMENT LOGS] fetch failed', {
          contactId: ( contact as any )?.id,
          emailAddress,
          tenantId,
          error
        } );
        return [];
      } )
      .finally( () => {
        this.engagementRequests.delete( cacheKey );
      } );

    this.engagementRequests.set( cacheKey, request );

    try {
      return await request;
    } catch {
      return [];
    }
  }



  /**
   * Evaluates a single contact for suggestion as a high-quality lead.
   * Returns a SuggestedContact if the contact meets criteria, or null otherwise.
   */
  async evaluateForSuggestion ( contact: Contact, tenantId: string ): Promise<SuggestedContact | null> {
    let emailEngagements = await this.getEmailEngagementsForContact( contact, tenantId );
    const email = contact.emailAddresses?.[0];
    const enriched = contact.isEnriched;
    const reconfigured = contact.isReconfigured;
    const insightPresent = !!contact._insight;
    const isValidEmail = email?.checked && !email?.blocked;
    const isDecisionMaker = /founder|chief|ceo|owner/i.test( contact.profession || '' );
    const isQualified = ['Qualification', 'Lead Generation'].includes( contact.status || '' );
    const hasCompanyData = !!contact.company?.name && !!contact.company?.url;
    const recentlyContacted = contact.lastContacted ? new Date( contact.lastContacted ).getTime() : 0;
    const last30Days = Date.now() - 1000 * 60 * 60 * 24 * 30;

    // After checking for insightPresent, add click engagement logic
    const totalClicks = emailEngagements?.reduce( ( sum, email ) => {
      return sum + ( email.clicks ? email.clicks.length : 0 );
    }, 0 ) ?? 0;

    const highClickEngagement = totalClicks >= 3; // Arbitrary threshold for high engagement

    if (
      isValidEmail &&
      enriched &&
      reconfigured &&
      isDecisionMaker &&
      hasCompanyData &&
      recentlyContacted < last30Days &&
      isQualified &&
      insightPresent &&
      highClickEngagement ) {
      return {
        contact,
        reason: "High-quality lead based on profession, email validity, enrichment, click activity, and recent contact activity.",
        score: 90
      };
    }
    return null;
  }

  addSuggestedContact ( suggestion: SuggestedContact ): void {
    if ( !this.suggestedContacts.find( s => s.contact.id === suggestion.contact.id ) ) {
      this.suggestedContacts.push( suggestion );
      localStorage.setItem( this.cacheKey, JSON.stringify( this.suggestedContacts ) );
    }
  }


  getSuggestedContacts (): SuggestedContact[] {
    if ( this.suggestedContacts.length > 0 ) {
      return this.suggestedContacts;
    }

    const cached = localStorage.getItem( this.cacheKey );
    if ( cached ) {
      this.suggestedContacts = JSON.parse( cached );
    }

    return this.suggestedContacts;
  }


  clearSuggestedContactsCache (): void {
    this.suggestedContacts = [];
    localStorage.removeItem( this.cacheKey );
    localStorage.removeItem( this.timestampKey );
  }

  clearEngagementCache (): void {
    this.engagementCache.clear();
    this.engagementRequests.clear();
  }

  private bumpNotEngagedDeletedTracking ( contactId: string ): void {
    // Count
    const current = this.notEngagedDeletedCountSource.value ?? 0;
    const next = current + 1;
    this.notEngagedDeletedCountSource.next( next );
    localStorage.setItem( this.notEngagedDeletedCountKey, String( next ) );

    // Ids (keep last 500)
    const raw = localStorage.getItem( this.notEngagedDeletedIdsKey );
    const ids: string[] = raw ? JSON.parse( raw ) : [];
    if ( contactId && !ids.includes( contactId ) ) ids.unshift( contactId );
    const trimmed = ids.slice( 0, 500 );
    localStorage.setItem( this.notEngagedDeletedIdsKey, JSON.stringify( trimmed ) );
  }

  getNotEngagedDeletedIds (): string[] {
    const raw = localStorage.getItem( this.notEngagedDeletedIdsKey );
    return raw ? JSON.parse( raw ) : [];
  }

  clearNotEngagedDeletedTracking (): void {
    localStorage.removeItem( this.notEngagedDeletedCountKey );
    localStorage.removeItem( this.notEngagedDeletedIdsKey );
    this.notEngagedDeletedCountSource.next( 0 );
  }


  public deleteContact ( contact: any, tenantId: string ) {
    // Call the dataService method to delete the contact by email using tenantId
    this.dataService.deleteDocument( "CONTACTS", contact.id, "Unsubscribe" ).then(
      ( response ) => {

        this.logger.info( "Delete Response", response );

        this.moveToDeletedContacts( contact, tenantId );
      },
      ( error ) => {
        this.logger.error( "Error in unsubscribing:", error );
      }
    );
  }

  /**
   * Deletes a contact due to low engagement.
   * We stamp indicators onto the record that will be copied into DELETED_CONTACTS.
   */
  public deleteContactNotEngaged (
    contact: any,
    tenantId: string,
    details?: { reason?: string; }
  ): void {

    if ( !contact?.id ) {
      this.logger.warn( '[CONTACT AUTO-CLEANUP] Missing contact id' );
      return;
    }

    const reason = details?.reason ?? 'Not engaged';

    this.logger.info( '---------------------------------------' );
    this.logger.info( '[CONTACT AUTO-CLEANUP] Not Engaged Triggered' );
    this.logger.info( `[CONTACT AUTO-CLEANUP] id=${contact.id}` );
    this.logger.info( `[CONTACT AUTO-CLEANUP] email=${contact.email}` );
    this.logger.info( `[CONTACT AUTO-CLEANUP] reason=${reason}` );

    const patch = {
      deleted: true,
      notEngaged: true,
      notEngagedReason: reason,
      notEngagedAt: new Date().toISOString()
    };

    this.logger.info(
      `[Firestore UPDATE] collection=CONTACTS id=${contact.id} (flagging deleted + notEngaged)`
    );

    this.dataService
      .updateDocument( 'CONTACTS', contact.id, patch, 'System' )
      .then( ( response: any ) => {

        this.logger.info(
          `[Firestore UPDATE] collection=CONTACTS id=${contact.id} (flagged)`
        );

        this.logger.info(
          '[CONTACT AUTO-CLEANUP] Contact flagged not engaged (success)'
        );

        this.logger.info( '[CONTACT AUTO-CLEANUP] Firestore update response', { id: contact.id, response } );

        this.logger.info( '---------------------------------------' );

      } )
      .catch( ( error: any ) => {
        this.logger.error( '[CONTACT AUTO-CLEANUP] patch failed (details)', { id: contact?.id, reason, error } );
        this.logger.error(
          `[Firestore ERROR] collection=CONTACTS id=${contact.id}`
        );

        this.logger.error( '[CONTACT AUTO-CLEANUP] Failed to flag contact', error );

      } );

    this.logger.info( '[CONTACT AUTO-CLEANUP] patch', { id: contact.id, patch } );
  }

  public moveToDeletedContacts ( contact: any, tenantId: string ) {
    this.logger.info( "Moving to deleted contacts", contact );

    // NOTE: Do NOT write the full contact back into CONTACTS.
    // That can resurrect a deleted record or overwrite freshly persisted archive flags.
    // This DOES need to land in DELETED_CONTACTS though - deleteContact()
    // already hard-deletes the CONTACTS doc before this runs, and
    // DataService's CSV import path (data.service.ts ~1672-1678) queries
    // DELETED_CONTACTS by email specifically to avoid silently
    // resurrecting a contact the user deliberately removed. Previously this
    // function only logged and never wrote here, so that dedupe check was
    // always querying an empty/incomplete collection - any deleted contact
    // could come right back on the next import with no record it was ever
    // removed.
    this.dataService.addDocument( 'DELETED_CONTACTS', contact, tenantId ).catch( ( error: any ) => {
      this.logger.error( '[CONTACT AUTO-CLEANUP] Failed to archive to DELETED_CONTACTS', { id: contact?.id, error } );
    } );

    if ( contact?.notEngaged ) {
      this.logger.info( 'Not-engaged deletion flagged', { id: contact?.id, reason: contact?.notEngagedReason } );
      // Track locally so Home can show a running count even before a full refresh.
      if ( contact?.id ) this.bumpNotEngagedDeletedTracking( contact.id );
    }

    this.logger.info( '[CONTACT AUTO-CLEANUP] moveToDeletedContacts complete', {
      id: contact?.id,
      tenantId,
      deleted: !!contact?.deleted,
      notEngaged: !!contact?.notEngaged,
      status: contact?.status
    } );
  }

  async findNews ( contact: Contact, userId: string, previewData?: any ): Promise<string> {
    // Constructing the AI prompt

    let aiQuestion = `Please provide detailed information on ${contact?.firstName ?? ''} ${contact?.lastName ?? ''}, `;
    if ( contact.profession )
      aiQuestion += contact.profession;

    if ( contact.company && contact.company.name )
      aiQuestion += `who works at ${contact?.company?.name ?? ''}. If no information is found, clearly state 'No information found after analysis'. See if there is any public information on the following:`;

    // aiQuestion += ` 1.	Professional Background:
    // •	Educational background and degrees earned.
    // •	Key career milestones and previous roles held.
    // •	Public appearances or speaking engagements.
    // •	Notable achievements and contributions.`

    if ( contact.company && contact.company.name )
      aiQuestion += `2.	${contact?.company?.name ?? ''}:
    •	History and mission of the company.
    •	Core business areas and main services/products offered.
    •	Recent news and developments about the company.`;

    // aiQuestion += `3.	Leadership Style and Philosophy:
    // •	Insights into ${contact?.firstName ?? ''}'s leadership style and management philosophy.`


    if ( contact.company && contact.company.name )
      aiQuestion += `•	Initiatives or programs implemented by ${contact?.firstName ?? ''} at ${contact?.company?.name ?? ''}
    4.	Industry Impact:
    •	Contributions to the industry, including any innovations or significant changes driven by ${contact?.firstName ?? ''}.
    Awards or recognitions received`;


    // if (contact.company && contact.company.name)
    //   aiQuestion += `•	Awards or recognitions received by both ${contact?.firstName ?? ''} and ${contact?.company?.name ?? ''}
    // 5.	Media Presence:`

    // if (contact.company && contact.company.name)
    //   aiQuestion += `•	Recent interviews, articles, or media coverage featuring ${contact?.firstName ?? ''} or ${contact?.company?.name ?? ''}`

    // aiQuestion += `•	Social media presence and any notable posts or updates.
    // 6.	Contact Information:`

    // if (contact.company && contact.company.name)
    //   aiQuestion += `
    // •	Professional contact details for ${contact?.firstName ?? ''} or relevant personnel at ${contact?.company?.name ?? ''}`

    aiQuestion += `This detailed information is needed to draft an effective and personalized email to ${contact?.firstName ?? ''} ${contact?.lastName ?? ''}`;

    if ( previewData && previewData.description && previewData.title ) {
      aiQuestion += ` Some information we found: ${previewData.title} - ${previewData.description} - ${previewData.url}. Structure the response as a news article.`;
    }

    try {
      const aiResponse = await this.openAIService.getAssistance( aiQuestion, 'contact', userId, null ).toPromise();
      const responseText = aiResponse && aiResponse.response ? aiResponse.response : '';
      this.addTempNote( contact, responseText );
      return responseText;
    } catch ( error ) {
      this.logger.error( 'Error fetching news:', error );
      return '';
    }
  }

  addTempNote ( contact: Contact, response: any ): void {
    // Ensure the notes array exists
    if ( !contact.notes ) {
      contact.notes = [];
    }
    // Add the temporary note
    contact.notes.push( { subject: 'Latest Information - ' + new Date().toISOString(), body: response } );
  }


  calculateEngagementLevel ( communications: Communication[], interactions: Interaction[] ): number {
    const now = new Date();
    let engagementScore = 0;

    // Consider the number of communications and interactions
    engagementScore += communications.length * 2;
    engagementScore += interactions.length * 3;

    // Add points for each communication and interaction based on recency
    communications.forEach( communication => {
      const daysAgo = ( now.getTime() - new Date( communication.date ).getTime() ) / ( 1000 * 3600 * 24 );
      engagementScore += Math.max( 0, 30 - daysAgo ); // More points for recent communications
      if ( communication.replyReceived ) {
        engagementScore += 5; // Additional points for responses
      }
    } );

    interactions.forEach( interaction => {
      const daysAgo = ( now.getTime() - new Date( interaction.date ).getTime() ) / ( 1000 * 3600 * 24 );
      engagementScore += Math.max( 0, 30 - daysAgo ); // More points for recent interactions
    } );

    return engagementScore;
  }

  findByName ( name: string ): Observable<Contact | null> {
    return from( this.dataService.getCollectionData( 'CONTACTS', this.userId ) ).pipe(
      map( contacts => {
        return contacts.find( c =>
          `${c.firstName ?? ''} ${c.lastName ?? ''}`.toLowerCase() === name.toLowerCase()
        ) ?? null;
      } )
    );
  }

  calculatePriority ( contact: Contact, communications: Communication[], interactions: Interaction[] ): { score: number, reason: string; } {
    const now = new Date();
    const lastCommunication = communications
      .filter( comm => comm.contactId === contact.id )
      .sort( ( a, b ) => new Date( b.date ).getTime() - new Date( a.date ).getTime() )[0];

    const lastContactedDays = lastCommunication
      ? ( now.getTime() - new Date( lastCommunication.date ).getTime() ) / ( 1000 * 3600 * 24 )
      : Infinity;

    let score = 0;
    let reason = '';

    // Add points for contacts not contacted recently
    score += lastContactedDays;
    reason += `Last contacted ${lastContactedDays.toFixed( 0 )} days ago. `;
    if ( score === Infinity ) {
      score = 0;
      reason = "No recorded contact. ";
    }


    // Calculate engagement level
    const engagementLevel = this.calculateEngagementLevel(
      communications.filter( comm => comm.contactId === contact.id ),
      interactions.filter( inter => inter.date === contact.id )
    );

    // Subtract points based on engagement level
    score -= engagementLevel * 2;
    reason += `Engagement level subtracted ${engagementLevel * 2} points. `;

    // Add points for high-priority profile types
    if ( contact.profileTypes?.includes( 'DBE' ) || contact.profileTypes?.includes( 'MBE' ) ) {
      score += 10;
      reason += 'High-priority profile type added 10 points. ';
    }

    // Add a large bonus if the contact is marked as important
    if ( contact.important ) {
      score += 50;
      reason += 'Marked as important added 50 points. ';
    }

    return { score, reason };
  }

  private updateLastContacted ( suggestedContact: Contact, communications: Communication[] ): void {
    const lastContactedDate = communications
      .filter( communication => communication.contactId === suggestedContact.id )
      .map( communication => new Date( communication.date ) )
      .sort( ( a, b ) => b.getTime() - a.getTime() )[0];

    if ( lastContactedDate ) {
      suggestedContact.lastContacted = lastContactedDate.toISOString();
    }
  }

  getSuggestedContact ( contacts: Contact[], communications: Communication[], interactions: Interaction[] ): SuggestedContact {
    if ( !contacts.length ) {
      throw new Error( 'No contacts available' );
    }

    // Calculate priorities for all contacts
    const prioritizedContacts = contacts.map( contact => {
      const priority = this.calculatePriority( contact, communications, interactions );
      return {
        contact,
        priority
      };
    } );


    // Sort contacts by score in ascending order (lowest score first)
    prioritizedContacts.sort( ( a, b ) => a.priority.score - b.priority.score );

    // Pick the contact 5th from the bottom
    const indexFromBottom = 5;
    const targetIndex = Math.max( 0, prioritizedContacts.length - indexFromBottom );

    const { contact: suggestedContact, priority: targetPriority } = prioritizedContacts[targetIndex];
    this.updateLastContacted( suggestedContact, communications );
    return {
      contact: suggestedContact,
      reason: targetPriority.reason,
      score: targetPriority.score,
    };
  }

  determineReason ( suggestedContact: SuggestedContact ): string {
    if ( !suggestedContact ) return 'Contact data is not available';

    // Example of determining reason based on lastContacted
    const today = new Date();
    if ( suggestedContact.contact.lastContacted ) {
      const lastContactDate = new Date( suggestedContact.contact.lastContacted );
      const diffDays = Math.floor( ( today.getTime() - lastContactDate.getTime() ) / ( 1000 * 3600 * 24 ) );

      if ( diffDays > 30 ) return 'No contact in the last month';
      if ( diffDays > 7 ) return 'It has been more than a week since last contact';
    }

    // Add more reasons based on your business logic
    // Example: Checking interaction types, activity levels, etc.

    return 'Regular follow-up'; // Default reason
  }

  getMissingInfo ( contact: Contact ): string {
    const missingInfo: string[] = [];

    if ( !contact.firstName ) {
      missingInfo.push( "first name" );
    }

    if ( !contact.lastName ) {
      missingInfo.push( "last name" );
    }

    if ( !contact.company?.name ) {
      missingInfo.push( "company name" );
    }

    if ( !contact.phoneNumbers || contact.phoneNumbers.length === 0 ) {
      missingInfo.push( "phone number" );
    }

    if ( !contact.emailAddresses || contact.emailAddresses.length === 0 ) {
      missingInfo.push( "email address" );
    }

    if ( !contact.addresses || contact.addresses.length === 0 ) {
      missingInfo.push( "address" );
    }

    if ( !contact.profileTypes || contact.profileTypes.length === 0 ) {
      missingInfo.push( "profile type" );
    }

    if ( missingInfo.length === 0 ) {
      return "The contact record is complete.";
    }

    return `The contact is missing the following information: ${missingInfo.join( ", " )}.`;
  }

  setRecordState ( contact: Contact ): void {
    if ( !contact.id ) {
      contact.dateAdded = new Date().toISOString();
    }
    contact.lastUpdated = new Date().toISOString();
    contact.lastViewed = new Date().toISOString();
    contact.timeStamp = new Date();
  }


  setQueue ( queue: Contact[] ): void {
    this.queueSource.next( queue );
  }

  clearQueue (): void {
    this.queueSource.next( [] );
  }

  /**
   * Trigger backend process to update recent campaign indicators
   * @param contactIds List of contact IDs to update
   * @param tenantId Optional tenant ID for multi-tenant setups
   */
  triggerCampaignUpdate ( tenantId?: string ): Promise<void> {
    const url = environment.backendURL + `/update-recent-campaigns`;
    return this.http.post<void>( url, { tenantId } ).toPromise();
  }

  timezoneFix (
    tenantId: string,
    limit = 250,
    startAfterId = '',
    force = false
  ) {
    const url = `${environment.backendURL}/admin/resolve-contact-timezones`;

    return this.http.post<{
      ok: boolean;
      results: any[];
    }>( url, {
      tenantId,
      collections: ['contacts'],
      limit,
      startAfterId,
      force
    } );
  }



  // Update cached contacts when an item is removed
  updateSuggestedContacts ( contacts: SuggestedContact[] ): void {
    this.suggestedContacts = contacts;
    localStorage.setItem( this.cacheKey, JSON.stringify( contacts ) );
  }

  setCommunicationChartData ( chartData: any ) {
    this.communicationChartData = chartData;
  }

  getCommunicationChartData () {
    return this.communicationChartData;
  }

  updateContactRecord ( contact: Contact, userId: any ): void {

    // Assuming this.contact is the data to update
    if ( contact && contact.id ) {
      this.updateEmailField( contact );
      this.dataService.updateDocument( 'CONTACTS', contact.id, contact, userId )
        .then( () => {
          this.router.navigate( ['/contact', contact.id] );
        } )
        .catch( error => {
          this.logger.error( 'Error updating contact:', error );
          setTimeout( () => {
            this.router.navigate( ['/error'] ); // Assuming you have an error route defined
          }, 1000 );

        } );
    }
  }

  updateEmailField ( contact: Contact ): void {
    contact.email = ( contact && contact.emailAddresses && contact.emailAddresses[0] ) ? ( contact.emailAddresses[0].emailAddress.toLowerCase() ) : '';
    contact.recentCampaign = false;
  }

  async addContactRecord ( contact: Contact, userId: any, tenantId: any ) {
    this.updateEmailField( contact );

    // Check if the record exists
    const recordExists = await this.checkIfRecordExists( contact, tenantId );

    if ( recordExists && contact.id ) {
      // If record exists, merge the data

      this.dataService.setDocument( 'CONTACTS', contact.id, contact, tenantId )
        .then( () => {
          this.router.navigate( ['/contact', contact.id] );
          // Optionally, navigate to another page or update the UI as needed
        } )
        .catch( error => {
          this.logger.error( 'Error merging contact:', error );
          // Optionally, navigate to an error page or show an error message
        } );
    } else {
      // If record does not exist, add the data
      this.dataService.addDocument( 'CONTACTS', contact, userId )
        .then( docId => {
          // Navigate to the contact-list page on success
          this.router.navigate( ['/contact', docId] );

        } )
        .catch( error => {
          this.logger.error( 'Error adding contact:', error );
          // Navigate to an error page on failure
          setTimeout( () => {
            this.router.navigate( ['/error'] ); // Assuming you have an error route defined
          }, 1000 );
        } );
    }
  }

  async checkIfRecordExists ( contact: Contact, tenantId: any ): Promise<boolean> {
    if ( contact && contact.emailAddresses && contact.emailAddresses.length > 0 ) {
      // Loop through email addresses
      for ( let index = 0; index < contact.emailAddresses.length; index++ ) {
        let emailAddress = contact.emailAddresses[index].emailAddress;
        const recordId = await this.dataService.getRecordIdIfExists( emailAddress, tenantId );
        if ( recordId ) {
          contact.id = recordId; // Set the id on the contact if record exists
          return true;
        }
      }
    }
    return false;
  }

  lookupContactField ( field: string, name: string ): Observable<string | null | boolean> {
    return from( this.dataService.getCollectionData( 'CONTACTS', this.userId ) ).pipe(
      map( contacts => {
        let contact = contacts.find( c =>
          `${c.firstName ?? ''} ${c.lastName ?? ''}`.toLowerCase().includes( name.toLowerCase() )
        );
        if ( !contact ) {
          contact = contacts.find( c =>
            c.company?.name?.toLowerCase().includes( name.toLowerCase() )
          );
        }

        if ( field.toLowerCase() === 'exists' ) return !!contact;
        if ( !contact ) return null;

        const normalizedField = this.fieldSynonyms[field.toLowerCase()] ?? field.toLowerCase();
        switch ( normalizedField ) {
          case 'phone':
            return contact.phoneNumbers?.[0]?.phoneNumber ?? null;
          case 'email':
            return contact.emailAddresses?.[0]?.emailAddress ?? contact.email ?? null;
          case 'company':
            return contact.company?.name ?? null;
          case 'company phone':
            return contact.company?.phoneNumbers?.[0]?.phoneNumber ?? contact.phoneNumbers?.[0]?.phoneNumber ?? null;
          case 'company email':
            return contact.company?.emailAddresses?.[0]?.emailAddress ?? contact.email ?? null;
          case 'company url':
            return contact.company?.url ?? null;
          case 'linkedin':
            return contact.linkedInUrl ?? null;
          case 'address':
            return contact.addresses?.[0]
              ? `${contact.addresses[0].streetAddress}, ${contact.addresses[0].city}, ${contact.addresses[0].state} ${contact.addresses[0].zip}`
              : null;
          default:
            return ( contact as any )[normalizedField] ?? null;
        }
      } )
    );
  }

  updateContactField ( name: string, field: string, value: string, userId: any ): Observable<void> {
    const normalizeStage = ( value: string ): string => {
      const map: Record<string, string> = {
        lead: "lead generation",
        qualification: "qualification",
        engaged: "engaged",
        proposal: "proposal sent",
        negotiation: "negotiation",
        closing: "closing",
        "post-sale": "post-sale",
        "closed won": "closed won",
      };
      const lower = value.trim().toLowerCase();
      return map[lower] ?? value;
    };
    return from( this.dataService.getCollectionData( 'CONTACTS', this.userId ) ).pipe(
      map( contacts => {
        const contact = contacts.find( c =>
          `${c.firstName ?? ''} ${c.lastName ?? ''}`.toLowerCase().includes( name.toLowerCase() )
        );
        if ( !contact ) return;
        switch ( field.toLowerCase() ) {
          case 'phone':
          case 'phone number':
            contact.phoneNumbers = [{
              phoneNumber: value,
              phoneNumberType: ''
            }];
            break;
          case 'email':
          case 'email address':
            contact.emailAddresses = [{
              emailAddress: value,
              emailAddressType: '',
              blocked: false
            }];
            break;
          default:
            if ( field.toLowerCase() === 'status' ) {
              contact.status = normalizeStage( value );
            } else {
              ( contact as any )[field] = value;
            }
            break;
        }
        this.updateContactRecord( contact, userId );
      } )
    );
  }

  getLastContactDate ( name: string ): Observable<string | null> {
    return combineLatest( [
      from( this.dataService.getCollectionData( 'CONTACTS', this.userId ) ),
      from( this.dataService.getCollectionData( 'COMMUNICATIONS', this.userId ) )
    ] ).pipe(
      map( ( [contacts, communications] ) => {
        const contact = contacts.find( c =>
          `${c.firstName ?? ''} ${c.lastName ?? ''}`.toLowerCase().includes( name.toLowerCase() )
        );
        if ( !contact ) return null;

        const comms = communications.filter( comm => comm.contactId === contact.id );
        const dates = comms.map( comm => new Date( comm.date ) );
        const latest = dates.sort( ( a, b ) => b.getTime() - a.getTime() )[0];

        return latest ? latest.toISOString() : null;
      } )
    );
  }

  addContact ( name: string, company: string, userId: any, tenantId: any ): Observable<void> {
    const [firstName, ...rest] = name.split( ' ' );
    const lastName = rest.join( ' ' );

    const newContact: Contact = {
      firstName,
      lastName,
      company: { name: company },
      emailAddresses: [],
      phoneNumbers: [],
      profileTypes: [],
      addresses: [],
      notes: [],
      id: '',
      dateAdded: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      lastViewed: new Date().toISOString(),
      timeStamp: new Date(),
    };

    this.addContactRecord( newContact, userId, tenantId );
    return of( void 0 );
  }

  addToContactField ( name: string, field: string, value: string, userId: any ): Observable<void> {
    return from( this.dataService.getCollectionData( 'CONTACTS', this.userId ) ).pipe(
      map( contacts => {
        const contact = contacts.find( c =>
          `${c.firstName ?? ''} ${c.lastName ?? ''}`.toLowerCase().includes( name.toLowerCase() )
        );
        if ( !contact ) return;
        switch ( field.toLowerCase() ) {
          case 'email':
          case 'email address':
            contact.emailAddresses ??= [];
            contact.emailAddresses.push( {
              emailAddress: value,
              emailAddressType: '',
              blocked: false
            } );
            break;
          case 'phone':
          case 'phone number':
            contact.phoneNumbers ??= [];
            contact.phoneNumbers.push( {
              phoneNumber: value,
              phoneNumberType: ''
            } );
            break;
          default:
            // Fallback: add to generic array or throw
            break;
        }
        this.updateContactRecord( contact, userId );
      } )
    );
  }


  /**
   * Gets the last fetched timestamp for suggested contacts from localStorage.
   * @returns number The timestamp in milliseconds, or 0 if not set.
   */
  getSuggestedContactsLastFetched (): number {
    const raw = localStorage.getItem( this.timestampKey );
    return raw ? parseInt( raw, 10 ) : 0;
  }

  /**
   * Sets the last fetched timestamp for suggested contacts in localStorage.
   * @param timestamp The timestamp in milliseconds to store.
   */
  setSuggestedContactsLastFetched ( timestamp: number ): void {
    localStorage.setItem( this.timestampKey, timestamp.toString() );
  }

  public get lastContactLoadTime () {
    return this._lastContactLoadTime;
  }

  public set lastContactLoadTime ( value ) {
    this._lastContactLoadTime = value;
  }

  public clearAll () {
    // Clear BehaviorSubjects
    this.contactSource.next( null );
    this.queueSource.next( [] );
    this.contactReason.next( null );

    // Clear in-memory state
    // this.contacts = []; // removed, contacts is no longer stored in-memory
    this.suggestedContacts = [];
    this.communicationChartData = null;

    // Clear any cached timestamps
    localStorage.removeItem( this.cacheKey );
    localStorage.removeItem( this.timestampKey );
    localStorage.removeItem( this.notEngagedDeletedCountKey );
    localStorage.removeItem( this.notEngagedDeletedIdsKey );
    this.notEngagedDeletedCountSource.next( 0 );

    // Clear any active subscriptions if applicable
    if ( this.contactSuggestorSubscription ) {
      this.contactSuggestorSubscription.unsubscribe();
      this.contactSuggestorSubscription = undefined!;
    }

    if ( this.authSubscription ) {
      this.authSubscription.unsubscribe();
      this.authSubscription = undefined!;

    }

    if ( this.userSubscription ) {
      this.userSubscription.unsubscribe();
      this.userSubscription = undefined!;
    }

    // Reset timers
    this._lastContactLoadTime = new Date().getTime();
  }


}
