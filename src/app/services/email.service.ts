import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, Subscription, catchError, from, map, of, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { LoggerService } from './logger.service';
import { Email } from '../shared/data/interfaces/email.model';
import { DataService } from './data.service';
import { Contact } from '../shared/data/interfaces/contact.model';
import { ads } from '../features/welcome/home/landing-page4/landing-page4.component';
import { EmailDraftingMetadata, OpenAIService } from './open-ai.service';

export interface EmailDraftingStageOption {
  key: string;
  label: string;
  description: string;
}

export interface EmailDraftingToneOption {
  key: string;
  label: string;
  description: string;
}


@Injectable( {
  providedIn: 'root'
} )
export class EmailService implements OnDestroy {
  backendURLSubscription!: Subscription;
  postSubscription!: Subscription;

  private campaignDrafts: any;
  ads = ads;
  footer: string = `<div style="text-align: center; margin-top: 20px; font-size: 0.8em; color: #777777; background-color: #f4f4f4; padding: 10px 0;">
  <p>
  © 2026 
  <a href="https://taliferro.com" style="color: #1a73e8; text-decoration: none;">Taliferro</a>. 
  Email sent from 
  <a href="https://todd.taliferro.tech" style="color: #1a73e8; text-decoration: none;">TODD</a>. 
  taliferro-tech-unsubscribe.
  </p>
  </div>
  `;


  constructor ( private http: HttpClient, private logger: LoggerService, private dataService: DataService, private openAIService: OpenAIService ) { }

  private buildSendEmailError ( err: unknown ): Error {
    if ( err instanceof HttpErrorResponse ) {
      const payload = err.error && typeof err.error === 'object' ? err.error as Record<string, any> : {};
      const backendError = String( payload?.['error'] || payload?.['message'] || '' ).trim();
      const cap = Number( payload?.['cap'] );
      const used = Number( payload?.['used'] );
      const maxHtmlBytes = Number( payload?.['maxHtmlBytes'] );
      const actualHtmlBytes = Number( payload?.['actualHtmlBytes'] );

      if ( backendError === 'daily_cap_exceeded' ) {
        const detail = Number.isFinite( cap ) && Number.isFinite( used )
          ? `Daily email cap reached for this sender warmup (${used}/${cap} used today).`
          : 'Daily email cap reached for this sender warmup.';
        return new Error( detail );
      }

      if ( backendError === 'email_html_too_large' ) {
        const detail = Number.isFinite( maxHtmlBytes ) && Number.isFinite( actualHtmlBytes )
          ? `Email HTML is too large for safe delivery (${Math.round( actualHtmlBytes / 1024 )} KiB). Keep it under ${Math.round( maxHtmlBytes / 1024 )} KiB.`
          : 'Email HTML is too large for safe delivery. Reduce the pasted template size and try again.';
        return new Error( detail );
      }

      if ( backendError ) {
        return new Error( backendError );
      }

      if ( err.message ) {
        return new Error( err.message );
      }
    }

    if ( err instanceof Error ) {
      return err;
    }

    return new Error( 'Email send failed.' );
  }

  /**
   * Cleans up subscriptions when the component is destroyed to prevent memory leaks.
   * It unsubscribes from `backendURLSubscription` and `postSubscription` if they exist.
   */
  ngOnDestroy (): void {
    if ( this.backendURLSubscription )
      this.backendURLSubscription.unsubscribe();

    if ( this.postSubscription )
      this.postSubscription.unsubscribe();
  }

  /**
   * Asynchronously retrieves a contact by email. Optionally filters by tenant ID.
   * Logs the outcome of the search operation to the console.
   * @param {string} email - The email address used to locate the contact.
   * @param {string} [tenantId] - An optional tenant ID to narrow down the search.
   * @returns {Promise<Contact | null>} A promise that resolves to the contact if found, or null otherwise.
   */
  async findContactByEmail ( email: string, tenantId?: string ): Promise<Contact | null> {
    const contact = await this.dataService.getContactByEmail( email, tenantId );
    if ( contact ) {
      return contact;
    } else {
      return null;
    }
  }

  /**
   * Retrieves a list of emails for the specified tenant and user.
   * Logs the event and outputs the retrieved emails through the logger.
   *
   * @param {string} tenantId - The unique identifier for the tenant.
   * @param {string} user - The username for whom to retrieve emails.
   * @returns {Observable<Email[]>} An Observable that will emit the array of Email objects.
   */
  getEmails ( tenantId: string, user: string ): Observable<Email[]> {
    this.dataService.logEvent( 'Gettting Email', user ); // Log event
    this.logger.info( "Getting Emails", tenantId, user );
    return this.http.get<Email[]>( `${environment.backendURL}/emails`, {
      params: { tenantId }
    } ).pipe(
      tap( emails => this.logger.info( emails ) )
    );
  }


  // private loadTemplate (): Observable<string> {
  //   return this.http.get( '/assets/template.html', { responseType: 'text' } );
  // }

  /**
   * Compiles an email template using passed email and sender data.
   * @param {string} template - Handlebars template string to be compiled.
   * @param {Email} email - Email data containing `subject` and `text` fields.
   * @param {Contact} sender - Sender's contact information.
   * @returns {string} The compiled email content.
   */
  // private compileTemplate ( template: string, email: Email, sender: Contact ): string {
  //   const compiled = Handlebars.compile( template );
  //   const result = compiled( {
  //     subject: email.subject,
  //     body: email.text,
  //     signature: sender.emailAddresses?.[0]?.emailAddress || '',
  //     phone: sender.phoneNumbers?.[0]?.phoneNumber || '',
  //     firstName: sender.firstName || '',
  //     lastName: sender.lastName || '',
  //   } );
  //   return result;
  // }


  /**
   * Sends an email using the backend service and logs the event.
   * @param email The email object containing recipient, subject, and body.
   * @param tenantId The identifier for the tenant from which the email is sent.
   * @param user The user who is sending the email.
   * @returns An Observable that resolves to the response from the email sending endpoint.
   */
  public sendEmail ( email: Email, tenantId: string, user: string ): Observable<any> {
    this.logger.info( 'SEND EMAIL', {
      tenantId,
      user,
      to: ( email as any )?.to,
      subject: ( email as any )?.subject
    } );

    return this.http.post( `${environment.backendURL}/send-email`, { ...email, tenantId } ).pipe(
      tap( response => {
        this.logger.info( 'Email server responded successfully:', response );
      } ),
      catchError( err => {
        const sendError = this.buildSendEmailError( err );
        this.logger.error( 'Email server returned error:', {
          originalError: err,
          message: sendError.message
        } );
        return throwError( () => sendError );
      } )
    );
  }



  /**
   * Retrieves the open rate for a specific campaign.
   * @param {string} campaignId - The ID of the campaign.
   * @param {string} tenantId - The tenant ID.
   * @returns {Observable<number>} An Observable that emits the open rate as a percentage.
   */
  calculateOpenRate ( campaignId: string, tenantId: string ): Observable<number> {
    return this.http.get<{ openRate: number; }>( `${environment.backendURL}/open-rate/${campaignId}`, {
      params: { tenantId }
    } ).pipe(
      map( response => {
        this.logger.log( 'Open Rate received from backend:', response ); // Log to ensure correct value
        return response.openRate || 0;
      } ),
      catchError( error => {
        this.logger.error( 'Error fetching open rate:', error );
        return of( 0 ); // Fallback to 0 in case of an error
      } )
    );
  }


  /**
   * Fetches click data for a specific campaign.
   * @param campaignId The unique identifier of the campaign.
   * @param tenantId The unique identifier of the tenant.
   * @returns Observable that emits the array of click data.
   */
  getClickData ( campaignId: string, tenantId: string ): Observable<any[]> {
    return this.http.post<any[]>( `${environment.backendURL}/campaign-click-data`, { campaignId, tenantId } );
  }


  /**
   * Deletes an email with the specified messageId for a given tenant.
   * Logs the delete action and handles any errors that may occur.
   * @param messageId The unique identifier of the email to delete.
   * @param tenantId The tenant's unique identifier.
   * @param user The username requesting the deletion.
   * @returns An Observable that emits the result of the delete operation.
   */
  deleteEmail ( messageId: string, tenantId: string, user: string ): Observable<any> {
    this.logger.log( `${environment.backendURL}/delete-email`, tenantId );
    return this.http.post<any>( `${environment.backendURL}/delete-email`, { messageId: messageId, tenantId: tenantId } ).pipe(
      tap( response => {
        this.logger.info( 'Delete Email Response:', response );
      } ),
      catchError( error => {
        this.logger.error( 'Delete Email Error:', error );
        return throwError( error );
      } )
    );
  }

  /**
   * Verify the email by sending a verification request to the backend server.
   * @param email The email address to be verified.
   * @returns An Observable that will emit the result of the email verification process.
   */
  verifyEmail ( email: string ): Observable<any> {
    return this.http.post<any>( `${environment.backendURL}/verify-email`, { email } );
  }

  /** Verify an email address with SendGrid's Email Validation API. */
  verifyEmailWithSendGrid ( email: string ): Observable<any> {
    return this.http.post<any>( `${environment.backendURL}/verify-email-sendgrid`, { email } );
  }


  enrichWithEmailAddress ( email: string ): Observable<any> {
    return this.http.post<any>( `${environment.backendURL}/enrich-email`, { email } );
  }

  getSentEmails () {
    this.dataService.fetchEmailData;
  }


  /**
   * Normalize line breaks in a string to use '\n'.
   * Line breaks can be Windows (\r\n), Unix (\n), or Mac (\r) style.
   *
   * @param {string | null} text - The text to be processed.
   * @returns {string} The text with normalized line breaks.
   */
  preserveLineBreaks ( text: string | null ): string {
    if ( text === null || text === undefined ) {
      return '';
    }
    return text.replace( /\r\n|\r|\n/g, '\n' ); // Normalize line breaks
  }

  /**
   * Converts a given text to HTML by replacing newline characters with `<br>` tags.
   * If the input is `null` or `undefined`, it returns an empty string.
   *
   * @param {string | null} text - The text to be converted to HTML.
   * @returns {string} The converted HTML string.
   */
  convertToHtml ( text: string | null ): string {
    if ( text === null || text === undefined ) {
      return '';
    }
    return text.replace( /\n/g, '<br>' );
  }

  /**
   * Notifies the backend about email queue actions (start, pause, resume, stop, forward).
   * Alerts if an invalid action is specified and logs the event.
   * @param action - Action to be taken on the email queue.
   * @param campaign - The campaign for which the action applies.
   * @param tenantId - Identifier for the tenant.
   * @param user - Username of the user performing the action.
   * @returns An Observable of the HTTP response or an error object.
   */
  public notifyBackend ( action: string, campaign: any, tenantId: any, user: string ): Observable<any> {
    const endpointMap: { [key: string]: string; } = {
      'start': '/start-email-queue',
      'pause': '/pause-email-queue',
      'resume': '/resume-email-queue',
      'stop': '/stop-email-queue',
      'forward': '/forward-email-queue'
    };

    if ( !endpointMap[action] ) {
      alert( `Invalid action: ${action}. Action must be one of ${Object.keys( endpointMap ).join( ', ' )}` );
      return of( { error: 'Invalid action' } );
    }

    const endpoint = `${environment.backendURL}${endpointMap[action]}`;
    this.dataService.logEvent( 'Notifying backend Email Queue status', user ); // Log event

    return this.http.post( endpoint, {
      tenantId: tenantId,
      campaignId: campaign.id,
      campaignData: campaign
    } ).pipe(
      catchError( error => {
        this.logger.error( `HTTP error occurred while notifying backend: ${error.message}` );
        return of( { error: error.message } );
      } )
    );
  }




  public sendTaskEmails ( action: string, task: any, contacts: Contact[], sender: Contact, tenantId: string, userId: string ): Observable<any> {
    const subject = action === 'Add'
      ? `New Task Assigned: ${task.title}`
      : `Task Updated: ${task.title}`;

    let emailBody = `<p>Hello,</p>`;
    emailBody += action === 'Add'
      ? `<p>You have been assigned a new task:</p>`
      : `<p>A task assigned to you has been updated:</p>`;

    emailBody += `
      <p><strong>Task Title:</strong> ${task.title}</p>
      ${task.description ? `<p><strong>Description:</strong> ${task.description}</p>` : ''}
      ${task.startDate ? `<p><strong>Start Date:</strong> ${task.startDate}</p>` : ''}
      ${task.dueDate ? `<p><strong>Due Date:</strong> ${task.dueDate}</p>` : ''}
      ${task.priority ? `<p><strong>Priority:</strong> ${task.priority}</p>` : ''}
      ${task.status ? `<p><strong>Status:</strong> ${task.status}</p>` : ''}
      ${task.url ? `<p><strong>More Details:</strong> <a href="${task.url}">View Task</a></p>` : ''}
    `;

    if ( task.images?.length )
      emailBody += `<p><strong>Images:</strong></p><ul>${task.images.map( ( img: any ) => `<li><a href="${img.src}">${img.alt || 'Image'}</a></li>` ).join( '' )}</ul>`;

    if ( task.documents?.length )
      emailBody += `<p><strong>Documents:</strong></p><ul>${task.documents.map( ( doc: any ) => `<li><a href="${doc.src}">${doc.name}</a></li>` ).join( '' )}</ul>`;

    emailBody += sender.signature ? sender.signature : `${sender.firstName} ${sender.lastName}`;
    emailBody += this.footer;

    return from( contacts ).pipe(
      switchMap( contact => {
        if ( !contact.email ) {
          this.logger.warn( `No email found for contact: ${contact.firstName} ${contact.lastName}` );
          return of( null );
        }

        const email: Email = {
          to: contact.email,
          subject,
          text: emailBody,
          html: `<div>${emailBody}</div>`,
          contactName: `${contact.firstName}`,
          date: new Date().toISOString(),
          from: sender.email
        };

        return this.sendEmail( email, tenantId, userId ).pipe(
          tap( response => this.logger.log( `Email sent to ${email.to}. Response:`, response ) ),
          catchError( err => {
            this.logger.error( `Failed to send email to ${email.to}:`, err );
            return of( null );
          } )
        );
      } )
    );
  }

  public sendQuestionEmail ( question: string, aiAnswer: any, userId: string, userMeta?: any ): Observable<any> {

    const subject = `New TODD Question Submitted`;

    let emailBody = `<p>Hello,</p>`;
    emailBody += `<p>A new question was submitted on the TODD homepage:</p>`;
    emailBody += `<p><strong>Question:</strong> ${question}</p>`;
    emailBody += `<p><strong>Conversation Transcript:</strong></p>`;
    if ( userMeta )
      emailBody += `<p><strong>User Meta:</strong> ${userMeta}</p>`;
    emailBody += this.footer;

    const email: Email = {
      to: 'info@taliferro.tech',
      subject,
      text: emailBody, // plain text can just be same as HTML here unless you want to strip tags
      html: `<div>${emailBody}</div>`,
      contactName: 'TODD User Submission',
      date: new Date().toISOString(),
      from: 'noreply@taliferro.tech' // You can customize this sender address
    };



    return this.sendEmail( email, environment.taliferroTenantId, userId ).pipe(
      tap( response => this.logger.log( `Question email sent to support@taliferro.tech. Response:`, response ) ),
      catchError( err => {
        this.logger.error( `Failed to send question email:`, err );
        return of( null );
      } )
    );
  }


  public sendAffiliateEmail ( emailAddress: string, userId: string ): Observable<any> {
    const subject = 'Welcome to the TODD Affiliate Program';
    const dashboardUrl = `${window.location.origin}/affiliate-dashboard`;

    const textBody = [
      'Hello,',
      '',
      'Welcome to the TODD Affiliate Program.',
      '',
      `Your affiliate dashboard is ready: ${dashboardUrl}`,
      '',
      'Next steps:',
      '- Log in anytime using the same email link flow.',
      '- Review program materials and settings.',
      '',
      'If anything looks off, reply to this email and we will get you straight.',
      '',
      '— Taliferro Tech',
    ].join( '\n' );

    const htmlBody =
      `<p>Hello,</p>` +
      `<p><strong>Welcome to the TODD Affiliate Program.</strong></p>` +
      `<p>Your affiliate dashboard is ready: <a href="${dashboardUrl}">${dashboardUrl}</a></p>` +
      `<p><strong>Next steps:</strong></p>` +
      `<ul>` +
      `<li>Log in anytime using the same email link flow.</li>` +
      `<li>Review program materials and settings.</li>` +
      `</ul>` +
      `<p>If anything looks off, reply to this email and we will get you straight.</p>` +
      this.footer;

    const email: Email & any = {
      to: emailAddress,
      cc: 'ty.showers@taliferro.tech',
      subject,
      text: textBody,
      html: `<div>${htmlBody}</div>`,
      contactName: 'Affiliate Welcome',
      date: new Date().toISOString(),
      from: 'noreply@taliferro.tech'
    };

    return this.sendEmail( email as any, environment.taliferroTenantId, userId ).pipe(
      tap( response => this.logger.log( 'Affiliate welcome email queued. Response:', response ) ),
      catchError( err => {
        this.logger.error( 'Failed to send affiliate welcome email:', err );
        return of( null );
      } )
    );
  }

  public sendPostInterestEmail (
    params: {
      toEmail: string;
      postId: string;
      postPreview?: string;
      interestedUid?: string;
      interestedDisplayName?: string;
      interestedHandle?: string;
      message?: string;
    },
    userId: string
  ): Observable<any>;

  public sendPostInterestEmail (
    toEmail: string,
    userId: string,
    overrides?: {
      postId?: string;
      postPreview?: string;
      interestedUid?: string;
      interestedDisplayName?: string;
      interestedHandle?: string;
      message?: string;
    }
  ): Observable<any>;

  public sendPostInterestEmail (
    a:
      | string
      | {
        toEmail: string;
        postId: string;
        postPreview?: string;
        interestedUid?: string;
        interestedDisplayName?: string;
        interestedHandle?: string;
        message?: string;
      },
    b: string,
    c?: {
      postId?: string;
      postPreview?: string;
      interestedUid?: string;
      interestedDisplayName?: string;
      interestedHandle?: string;
      message?: string;
    }
  ): Observable<any> {
    const userId = b;

    const params = ( typeof a === 'string' )
      ? {
        toEmail: a,
        postId: ( c?.postId || '' ),
        postPreview: c?.postPreview,
        interestedUid: c?.interestedUid,
        interestedDisplayName: c?.interestedDisplayName,
        interestedHandle: c?.interestedHandle,
        message: c?.message,
      }
      : a;

    const toEmail = ( params?.toEmail || '' ).trim();
    const postId = ( params?.postId || '' ).trim();

    if ( !toEmail || !postId ) {
      this.logger.warn( 'sendPostInterestEmail skipped: missing toEmail or postId', params );
      return of( null );
    }

    const who = ( params?.interestedDisplayName || params?.interestedHandle || 'Someone' ).trim();
    const handle = ( params?.interestedHandle || '' ).trim();

    const previewRaw = ( params?.postPreview || '' ).trim();
    const preview = previewRaw ? previewRaw.slice( 0, 180 ) : '—';

    const noteRaw = ( params?.message || '' ).trim();

    const postUrl = `${window.location.origin}/post/${encodeURIComponent( postId )}`;

    const subject = `Someone is interested in your post`; // keep neutral, avoid spammy copy

    const textBody = [
      'Hello,',
      '',
      `${who}${handle ? ` (@${handle})` : ''} tapped “I’m interested” on your post.`,
      '',
      'Post:',
      preview,
      '',
      noteRaw ? 'Message:' : '',
      noteRaw ? noteRaw : '',
      noteRaw ? '' : '',
      `View it in-app: ${postUrl}`,
      '',
      '— TODD',
    ].filter( Boolean ).join( '\n' );

    const escapeHtml = ( s: string ) =>
      String( s )
        .replace( /&/g, '&amp;' )
        .replace( /</g, '&lt;' )
        .replace( />/g, '&gt;' )
        .replace( /"/g, '&quot;' )
        .replace( /'/g, '&#39;' );

    const htmlWho = escapeHtml( who );
    const htmlHandle = handle ? escapeHtml( handle ) : '';
    const htmlPreview = escapeHtml( preview );
    const htmlNote = noteRaw ? escapeHtml( noteRaw ) : '';

    const htmlBody =
      `<p>Hello,</p>` +
      `<p><strong>${htmlWho}</strong>${htmlHandle ? ` (@${htmlHandle})` : ''} tapped <strong>“I’m interested”</strong> on your post.</p>` +
      `<p><strong>Post</strong><br/>${htmlPreview}</p>` +
      ( htmlNote
        ? `<p><strong>Message</strong><br/>${htmlNote}</p>`
        : '' ) +
      `<p><a href="${postUrl}">Open in Say It</a></p>` +
      this.footer;

    const email: Email & any = {
      to: toEmail,
      cc: 'ty.showers@taliferro.tech',
      subject,
      text: textBody,
      html: `<div>${htmlBody}</div>`,
      contactName: 'Post Interest',
      date: new Date().toISOString(),
      from: 'noreply@taliferro.tech'
    };

    return this.sendEmail( email as any, environment.taliferroTenantId, userId ).pipe(
      tap( response => this.logger.log( 'Post interest email queued. Response:', response ) ),
      catchError( err => {
        this.logger.error( 'Failed to send post interest email:', err );
        return of( null );
      } )
    );
  }

  public clearAll (): void {
    // Unsubscribe from backendURLSubscription if still active
    if ( this.backendURLSubscription ) {
      this.backendURLSubscription.unsubscribe();
      this.backendURLSubscription = undefined!;
    }

    // Unsubscribe from postSubscription if still active
    if ( this.postSubscription ) {
      this.postSubscription.unsubscribe();
      this.postSubscription = undefined!;
    }
  }

  storeCampaignDrafts ( drafts: any ): void {
    this.campaignDrafts = drafts;
  }

  updateDraftStage ( stage: string, subject: string, body: string ): void {
    if ( this.campaignDrafts?.drafts?.[stage] ) {
      this.campaignDrafts.drafts[stage].subject = subject;
      this.campaignDrafts.drafts[stage].body = body;
    }
  }

  getCampaignDrafts (): any {
    return this.campaignDrafts;
  }

  clearDrafts () {
    this.campaignDrafts = undefined;
  }

  public formatContactDetails ( selectedContact: Contact | null, reason: string | null ): string {
    let contactInfo = "";


    // AI Insight (temporary, not persisted)
    if ( selectedContact?._insight ) {
      const insight = this.extractRelationshipTip( selectedContact._insight );
      if ( insight )
        contactInfo += `\n- Prospecting Tip: ${insight}`;
    }

    contactInfo += `\n\nRECIPIENT CONTEXT:`;

    if ( reason )
      contactInfo += `\n- AI-generated reason to contact recipient is: ${reason} `;





    // Name handling
    // Only use first name if it looks like a real first name (3+ letters).
    // If not, fall back to company name. If neither, don’t address anyone by name.
    const rawFirst = ( selectedContact?.firstName || '' ).trim();
    const firstLooksValid = /^[A-Za-z]{3,}$/.test( rawFirst );

    const rawCompany =
      ( selectedContact as any )?.companyName ||
      ( selectedContact as any )?.company?.name ||
      ( selectedContact as any )?.company ||
      '';

    const companyName = ( rawCompany || '' ).toString().trim();

    if ( firstLooksValid ) {
      contactInfo += `\n- The email should be addressed to ${rawFirst}.`;
    } else if ( companyName ) {
      contactInfo += `\n- The email should be addressed to ${companyName}.`;
    } else {
      contactInfo += `\n- Do not address the recipient by name.`;
    }
    // Company handling
    if ( selectedContact?.company ) {
      const company = selectedContact.company;

      if ( company.name?.trim() ) {
        contactInfo += `\n- The recipient works at ${company.name}.`;
      }

      if ( selectedContact.profession?.trim() ) {
        contactInfo += `\n- Their title at the company is ${selectedContact.profession}. Take this into consideration when drafting the email.`;
      }

      // if ( company.publicInfo?.trim() ) {
      //   contactInfo += `\n - The public information about the recipient's company is: ${company.publicInfo}.`;
      // }

      // if ( Array.isArray( company.capabilities ) && company.capabilities.length > 0 ) {
      //   contactInfo += `\n - The recipient's company has the following capabilities: ${company.capabilities.join( ', ' )}.`;
      // } else if ( typeof company.capabilities === 'string' && company.capabilities.trim() ) {
      //   contactInfo += `\n - The recipient's company has the following capability: ${company.capabilities}.`;
      // }
    }

    if ( selectedContact?.important ) {
      contactInfo += '\n- Important: This is someone I know personally—write with warmth and familiarity. I know this person well.';
    }

    if ( selectedContact?.category ) {
      const category = Array.isArray( selectedContact.category )
        ? selectedContact.category.join( ', ' )
        : selectedContact.category;

      contactInfo += `\n- RecipientContext: ${category}.`;
    }

    if ( selectedContact?.sector ) {
      contactInfo += `\n- The recipient company sector is: ${selectedContact.sector}.`;
    }

    // if ( selectedContact?.type ) {
    //   contactInfo += `\n - The recipient company type is: ${selectedContact.type}. Use the type to let the recipient know we know about their business.`;
    // }

    // Notes
    if ( selectedContact?.notes && selectedContact?.notes?.length > 0 ) {
      const notes = selectedContact.notes.map( note => `${note.subject}: ${note.body}` ).join( ' ' );
      contactInfo += `\n- Consider these notes about the recipient: ${notes}.`;
    }

    // Social Media
    // if ( selectedContact?.socialMedia && selectedContact?.socialMedia?.length > 0 ) {
    //   const socialMedia = selectedContact.socialMedia.map( ssm => `${ssm.platform}: ${ssm.url}` ).join( ' ' );
    //   contactInfo += `\n - Consider recipients various social media and websites for ideas for compliments and subjects: ${socialMedia}.`;
    // }


    // Email addresses
    if ( selectedContact?.emailAddresses && selectedContact?.emailAddresses?.length > 0 ) {
      const emails = selectedContact.emailAddresses.map( email => email.emailAddress ).join( ', ' );
      contactInfo += `\n- The recipient has the following email addresses: ${emails}.`;
    }

    // Additional info (birthday, anniversary)
    if ( selectedContact?.birthday ) {
      contactInfo += `\n- The recipient's birthday is on ${selectedContact.birthday}.`;
    }
    if ( selectedContact?.anniversary ) {
      contactInfo += `\n- The recipient's anniversary is on ${selectedContact.anniversary}.`;
    }


    return contactInfo;
  }


  /**
  * Extracts the relationship tip from a given string containing specific markers.
  * It searches for the content between "Relationship Tip:" and "Recommended Action:"
  * and trims any surrounding whitespace.
  *
  * @param {string} text - The text from which to extract the relationship tip.
  * @returns {string|null} The extracted tip or null if none found.
  */
  extractRelationshipTip ( text: string ) {
    const match = text.match( /Relationship Tip:\s*(.*?)\s*Recommended Action:/s );
    return match ? match[1].trim() : null;
  }

  /**
  * Masks an email address for logging purposes (e.g. "jo***@domain.com").
  */
  private maskEmailForLog ( email: any ): string {
    const s = String( email || '' ).trim();
    if ( !s || !s.includes( '@' ) ) return s;
    const [u, d] = s.split( '@' );
    const uMasked = u.length <= 2 ? `${u[0] || '*'}*` : `${u.slice( 0, 2 )}***`;
    return `${uMasked}@${d}`;
  }

  /**
  * Constructs a formatted string containing the sender's details comprising first name,
  * last name, company name, description, goal, value proposition, key features, and
  * whether the brand will be mentioned in emails.
  *
  * @returns {string} A string with formatted sender details for display or logging.
  */
  public formatSenderDetails ( sender: Contact, selectedContact: Contact | null ): string {
    let senderInfo = '';

    senderInfo += '\n\nThe following information is for context to generate a relevant email: ';

    // Sender Name
    if ( sender?.firstName ) {
      senderInfo += `\n The sender's first name is: ${sender.firstName}.`;
    }
    if ( sender?.lastName ) {
      senderInfo += `\n The sender's last name is: ${sender.lastName}.`;
    }

    // Sender Company
    if ( sender?.company?.name ) {
      senderInfo += `\n The sender's company name is: ${sender.company.name}. However DO NOT use the company name in the email it's for context only. `;
      if ( sender.company.description ) {
        senderInfo += `\n Sender's organization description: ${sender.company.description}`;
      }
      // if ( sender.company.goal ) {
      //   senderInfo += `\n Sender's mission: ${sender.company.goal}`;
      // }

      // if ( sender.company.valueProp ) {
      //   senderInfo += `\n Sender's value proposition: ${sender.company.valueProp}`;
      // }

      if ( sender.company.keyFeatures ) {
        senderInfo += `\n Sender offers: ${sender.company.keyFeatures}\n`;
      }

      // senderInfo += ( sender.company.mentionBrandInEmails ) ? `\n mentionBrandInEmails = ${sender.company.mentionBrandInEmails}` : '';
    }

    return senderInfo;
  }

  /**
  * Generate an email draft using OpenAIService (which already calls the backend /email-assistant).
  * Subject is required. Any text already in the editor is treated as context.
  */
  public generateEmailDraftFromEditor ( args: {
    userId: string;
    tenantId?: string;
    subject: string;
    htmlContext?: string;
    selectedContact?: Contact | null;
    sender?: Contact | undefined;
    reason?: string | null;
    campaignName?: string | null;
    toneCode?: string | null; // e.g. 'tr', 'fullpower', 'ads', etc.
    promptMode?: 'cold_first_touch' | 'signal_engine_followup' | 'engaged_followup' | 'campaign_followup' | null;
    handoffSource?: string | null;
    draftIntent?: string | null;
    priorSendContext?: any;
    threadContactId?: string | null;
    threadId?: string | null;
    threadCampaignId?: string | null;
    threadCampaignName?: string | null;
    threadDraftKind?: string | null;
    senderPersona?: string | null;
    rewriteMode?: boolean | null;
    rejectedDraftSubject?: string | null;
    rejectedDraftBody?: string | null;
  }, _correspondenceHistory: any ): Observable<{ subject: string; body: string; ctaLink: string | null; }> {
    const subject = String( args.subject || '' ).trim();
    const htmlContext = String( args.htmlContext || '' ).trim();
    const toneCode = String( args.toneCode || 'direct' ).trim();
    const tenantId = String( ( args as any )?.tenantId || environment.taliferroTenantId || '' ).trim();
    const inferredDraftIntent =
      String( args.handoffSource || '' ).trim().toLowerCase() === 'signal_engine_thread'
        ? 'needs_you_assist'
        : ( String( args.promptMode || '' ).trim().toLowerCase() === 'campaign_followup'
          ? 'campaign_followup'
          : ( String( args.promptMode || '' ).trim().toLowerCase() === 'engaged_followup'
            ? 'manual_followup'
            : 'fresh_outbound' ) );
    const draftIntent = String( args.draftIntent || inferredDraftIntent ).trim();

    const contactEmail = ( args.selectedContact as any )?.email
      || ( Array.isArray( ( args.selectedContact as any )?.emailAddresses )
        ? ( args.selectedContact as any )?.emailAddresses?.[0]?.emailAddress
        : '' );

    const contactPreview = args.selectedContact ? {
      id: ( args.selectedContact as any )?.id || null,
      firstName: ( args.selectedContact as any )?.firstName || null,
      companyName: ( args.selectedContact as any )?.companyName
        || ( args.selectedContact as any )?.company?.name
        || null,
      sector: ( args.selectedContact as any )?.sector || null,
      email: this.maskEmailForLog( contactEmail ),
      emailStage: ( args.selectedContact as any )?.emailStage || null,
    } : null;

    this.logger.info( 'Structured Email Draft request (preview):', {
      userId: args.userId,
      tenantId,
      subject,
      toneCode,
      draftIntent,
      promptMode: args.promptMode || null,
      handoffSource: args.handoffSource || null,
      threadId: args.threadId || null,
      threadCampaignId: args.threadCampaignId || null,
      threadCampaignName: args.threadCampaignName || null,
      threadDraftKind: args.threadDraftKind || null,
      hasReason: !!String( args.reason || '' ).trim(),
      reason: String( args.reason || '' ).trim() || null,
      contact: contactPreview
    } );

    return this.openAIService.requestStructuredEmailDraft(
      {
        tenantId,
        userId: args.userId,
        subject,
        htmlContext,
        selectedContact: args.selectedContact || null,
        sender: args.sender || null,
        reason: args.reason || null,
        campaignName: args.campaignName || null,
        handoffSource: args.handoffSource || null,
        draftIntent,
        selectedStageKey: String( ( args.selectedContact as any )?.emailStage || '' ).trim() || null,
        selectedToneKey: toneCode || null,
        toneCode,
        promptMode: args.promptMode || null,
        priorSendContext: args.priorSendContext || null,
        recipientEmail: contactEmail || null,
        threadContactId: args.threadContactId || null,
        threadId: args.threadId || null,
        threadCampaignId: args.threadCampaignId || null,
        threadCampaignName: args.threadCampaignName || null,
        threadDraftKind: args.threadDraftKind || null,
        senderPersona: String( args.senderPersona || '' ).trim() || null,
        rewriteMode: args.rewriteMode === true,
        rejectedDraftSubject: String( args.rejectedDraftSubject || '' ).trim() || null,
        rejectedDraftBody: String( args.rejectedDraftBody || '' ).trim() || null,
      },
      args.userId
    ).pipe(
      map( ( resp: any ) => {
        const parsed = resp?.data || resp || {};
        return {
          subject: String( parsed?.subject || '' ).trim(),
          body: String( parsed?.bodyHtml || parsed?.body || '' ).trim(),
          ctaLink: null
        };
      } ),
      catchError( ( err: any ) => {
        this.logger.error( 'generateEmailDraftFromEditor failed:', err );
        return throwError( () => err );
      } )
    );
  }

  public getEmailDraftingMetadata (): Observable<EmailDraftingMetadata> {
    return this.openAIService.getEmailDraftingMetadata().pipe(
      map( response => response?.data || { stages: [], tones: [] } )
    );
  }


  onCheckGrammar ( userId: string, plainText: string ): Observable<any> {
    const prompt = `
  Act as a grammar assistant. 
  Review the following text for grammar, spelling, and punctuation issues.
  Return ONLY a JSON array of issues where each issue has:
    - "original": the incorrect text,
    - "suggestion": the corrected text,
    - "explanation": a short explanation of the fix.

  TEXT:
  ${plainText}
  `;

    try {
      return this.openAIService.grammarCheck( prompt, userId );
    } catch ( error ) {
      this.logger.error( error );
      return throwError( () => error );
    }
  };

}
