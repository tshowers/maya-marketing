import { Component, Input, OnInit, OnDestroy, Output, EventEmitter, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoggerService } from '../../../../services/logger.service';
import { OpenAIService } from '../../../../services/open-ai.service';
import { Email } from '../../../../shared/data/interfaces/email.model';
import { firstValueFrom, Subscription } from 'rxjs';
import { EmailService } from '../../../../services/email.service';
import { AuthService } from '../../../../services/auth.service';
import { UserService } from '../../../../services/user.service';
import { DataService } from '../../../../services/data.service';
import { environment } from '../../../../../environments/environment';
import { NotificationService } from '../../../../services/notification.service';
import { EmailerContactLite } from '../..//pages/email-processor/email-processor.component';
import { Address, Contact } from '../../../../shared/data/interfaces/contact.model';
import { FormsModule } from '@angular/forms';
import { AssistantDraftPayload, ToddAssistantBusService } from '../../../../services/todd-assistant-bus.service';
import { MomentumThreadService } from '../../../../services/momentum-thread.service';
import { OutreachApiService } from '../../../../services/outreach-api.service';
import { EmailDraftingStageOption, EmailDraftingToneOption } from '../../../../services/email.service';

declare var bootstrap: any;

export interface CatalystAssistantContext {
  page: 'catalyst';
  hasPreview: boolean;
  isRunning: boolean;
  queueComplete: boolean;
  remainingCount: number;
  skippedCount: number;
  removedCount: number;
  useTemplate: boolean;
  templateHtml: string;
  templateSubject: string;
  hasCustomTemplateSubject: boolean;
  previewSubject: string;
  previewHtml: string;
  testEmailAddress: string;
  currentContactId: string;
  currentContactName: string;
  currentCompanyName: string;
  currentContactEmail: string;
}

export interface CatalystAssistantDraftPayload extends AssistantDraftPayload { }
export interface CatalystRunContext {
  name?: string;
  source?: 'stale_queue' | 'blocked_handoff' | 'manual' | string;
  includeLeadVaultContacts?: boolean;
}

@Component( {
  selector: 'app-emailer',
  standalone: true,
  imports: [CommonModule, FormsModule,],
  templateUrl: './emailer.component.html',
  styleUrl: './emailer.component.css'
} )
export class EmailerComponent implements OnInit, OnDestroy, AfterViewInit {
  private static readonly MAX_EMAIL_HTML_BYTES = 256 * 1024;


  @Input() contacts: EmailerContactLite[] = [];
  @Input() blockedDraftReason = '';
  @Input() beforeQueueStart: (() => Promise<EmailerContactLite[] | null>) | null = null;
  @Input() runContext: CatalystRunContext | null = null;
  @Output() emailSent = new EventEmitter<string>();
  @Output() assistantContextChange = new EventEmitter<CatalystAssistantContext>();

  userId!: any;
  tenantId!: any;
  isTaliferro: boolean = false; //Temporary - move to database
  showPreview = false;
  stopSending = false;
  isloading = false;
  contactInsight: string = '';

  autoRun = false;
  autoRunPauseRequested = false;

  emailBody = '';
  emailTones: EmailDraftingToneOption[] = [];
  emailCampaignStages: EmailDraftingStageOption[] = [];
  subject = '';
  selectedTone!: string;
  @Input() sender!: Contact;
  sendSubscription!: Subscription;
  getUserSubscription!: Subscription;
  loggedInSubscription!: Subscription;
  tenantSubscription!: Subscription;
  openAISubscription!: Subscription;
  metadataSubscription!: Subscription;

  // Track scheduled timeouts so we can reliably stop a bulk run
  private sendTimeoutHandles: any[] = [];

  showInsight = false;
  // Template mode (stop-gap): paste HTML and fill {{tokens}} before sending
  useTemplate = false;
  templateHtml = '';
  templateSubject = '';
  originalTemplateHtml = '';

  templateTokensDetected: string[] = [];
  templateTokenDebug: any = null;
  templateError = '';

  // By default, tokens are escaped for safety. Add keys here only if you want raw HTML injection.
  private rawHtmlTokens = new Set<string>( ['signature', 'content'] );


  // Bulk-run state (process one contact at a time so the preview doesn't get overwritten)
  private bulkQueue: EmailerContactLite[] = [];
  private bulkIsRunning = false;
  private bulkCurrentContact: EmailerContactLite | null = null;
  private initialQueueSnapshot: EmailerContactLite[] = [];
  private currentCatalystRunId = '';
  private currentCatalystRunName = '';
  private currentCatalystRunFinalized = false;
  skippedContacts: EmailerContactLite[] = [];
  removedContacts: EmailerContactLite[] = [];
  queueComplete = false;



  // Expose a read-only view for the template
  get currentContact (): EmailerContactLite | null {
    return this.bulkCurrentContact;
  }

  private getSenderDisplayName (): string {
    const fullName = `${this.sender?.firstName || ''} ${this.sender?.lastName || ''}`.replace( /\s+/g, ' ' ).trim();
    if ( fullName && fullName.toLowerCase() !== 'todd' ) {
      return fullName;
    }

    const displayName = String( this.sender?.displayName || '' ).replace( /\s+/g, ' ' ).trim();
    if ( displayName && displayName.toLowerCase() !== 'todd' ) {
      return displayName;
    }

    const senderEmail =
      ( this.sender?.emailAddresses &&
        this.sender.emailAddresses.length > 0 &&
        this.sender.emailAddresses[0]?.emailAddress ) ||
      this.sender?.email ||
      '';

    const localPart = String( senderEmail || '' ).trim().split( '@' )[0] || '';
    const humanized = localPart
      .split( /[._-]+/ )
      .filter( Boolean )
      .map( part => part.charAt( 0 ).toUpperCase() + part.slice( 1 ) )
      .join( ' ' )
      .trim();

    return humanized.toLowerCase() === 'todd' ? '' : humanized;
  }

  // Variables to store pending email and contact for preview
  pendingEmail!: Email;
  pendingContact!: EmailerContactLite;
  previewTo!: string;
  previewSubject!: string;
  previewHtml!: string;

  testEmailAddress = '';
  isSendingTest = false;
  public currentAssistantContext: CatalystAssistantContext | null = null;
  lastSignalEngineMessage = '';

  @ViewChild( 'previewFrame', { static: false } )
  previewFrame?: ElementRef<HTMLIFrameElement>;

  debugRawPreview = false;


  constructor (
    private logger: LoggerService,
    private toddAssistantBusService: ToddAssistantBusService,
    private notificationService: NotificationService,
    private openAIService: OpenAIService,
    private emailService: EmailService,
    private authService: AuthService,
    private userService: UserService,
    private dataService: DataService,
    private momentumThreadService: MomentumThreadService,
    private outreachApiService: OutreachApiService
  ) {
  }


  ngOnInit (): void {
    this.checkTenant();
    this.loadDraftingMetadata();
    this.emitAssistantContext();

    this.toddAssistantBusService.setAssistantPageContext( this.buildAssistantContext() );

  }

  ngOnDestroy (): void {
    if ( this.sendSubscription )
      this.sendSubscription.unsubscribe();
    if ( this.getUserSubscription )
      this.getUserSubscription.unsubscribe();
    if ( this.loggedInSubscription )
      this.loggedInSubscription.unsubscribe();
    if ( this.tenantSubscription )
      this.tenantSubscription.unsubscribe();
    if ( this.openAISubscription )
      this.openAISubscription.unsubscribe();
    if ( this.metadataSubscription )
      this.metadataSubscription.unsubscribe();
  }

  private loadDraftingMetadata (): void {
    this.metadataSubscription = this.emailService.getEmailDraftingMetadata().subscribe( metadata => {
      this.emailTones = Array.isArray( metadata?.tones ) ? metadata.tones : [];
      this.emailCampaignStages = Array.isArray( metadata?.stages ) ? metadata.stages : [];
      if ( !this.selectedTone ) {
        this.selectedTone = this.emailTones[0]?.key || 'direct';
      }
    } );
  }

  ngAfterViewInit (): void {
    setTimeout( () => this.emitAssistantContext(), 0 );
  }



  get isRunning (): boolean {
    return this.bulkIsRunning && !this.stopSending;
  }

  get remainingCount (): number {
    return this.bulkQueue?.length || 0;
  }

  get skippedCount (): number {
    return this.skippedContacts?.length || 0;
  }

  get removedCount (): number {
    return this.removedContacts?.length || 0;
  }

  get canLoadSkippedQueue (): boolean {
    return !this.bulkIsRunning && !this.showPreview && this.skippedCount > 0;
  }

  get canReloadQueue (): boolean {
    return !this.bulkIsRunning && !this.showPreview && !this.isloading;
  }

  get signalEnginePreviewNote (): string {
    if ( !this.pendingContact ) {
      return 'Catalyst sends one tailored email at a time, then Signal Engine takes over the thread after send.';
    }

    const name = `${this.pendingContact.firstName || ''} ${this.pendingContact.lastName || ''}`.trim() || 'this contact';
    return `Once you send to ${name}, Signal Engine will own the follow-up and adapt from opens, clicks, and silence.`;
  }

  get displayInsight (): string {
    const blockedDraftReason = this.getBlockedDraftReason();
    const contactInsight = String( this.contactInsight || '' ).trim();
    const sections: string[] = [];

    if ( blockedDraftReason ) {
      sections.push( `Blocked / Needs Human Reason: ${blockedDraftReason}` );
    }

    if ( contactInsight ) {
      sections.push( contactInsight );
    }

    return sections.join( '\n\n' ).trim();
  }

  private renderPreviewFrame (): void {
    if ( !this.previewFrame?.nativeElement ) return;

    const html = String( this.previewHtml || '' );
    this.logger.info( 'Rendering iframe preview directly via native srcdoc', {
      length: html.length,
      preview: html.substring( 0, 200 ),
      hasHtmlTag: html.includes( '<html' ),
      hasBodyTag: html.includes( '<body' ),
      hasStyleTag: html.includes( '<style' )
    } );

    this.previewFrame.nativeElement.srcdoc = html;
  }

  toggleRawPreview (): void {
    this.debugRawPreview = !this.debugRawPreview;
  }

  checkTenant () {
    this.tenantSubscription = this.authService.getTenantId().subscribe( tenantId => {
      this.tenantId = tenantId;
      this.senderInfo();
    } );
  }

  toggleInsight (): void {
    this.showInsight = !this.showInsight;
  }

  senderInfo (): void {
    this.getUserSubscription = this.authService.getUser().subscribe( user => {
      if ( user ) {
        this.userId = user.uid;
        this.isTaliferro = ( environment.taliferroTenantId === this.userId );

        this.loggedInSubscription = this.userService.getLoggedInContactInfo().subscribe( contact => {
          if ( contact ) {
            this.sender = contact;
          }
          else {
            this.logger.error( "No Contact Returned" );
          }
        } );
      }
    } );
  }

  async onStart (): Promise<void> {
    this.isloading = true;

    this.logger.info( "Starting with", this.contacts );

    // Reset state for a new run
    this.stopSending = false;
    this.bulkIsRunning = true;
    this.autoRunPauseRequested = false;
    this.queueComplete = false;
    this.skippedContacts = [];
    this.removedContacts = [];

    let allContacts = Array.isArray( this.contacts ) ? [...this.contacts] : [];

    if ( this.beforeQueueStart ) {
      try {
        const preparedContacts = await this.beforeQueueStart();
        if ( Array.isArray( preparedContacts ) ) {
          allContacts = [...preparedContacts];
        }
      } catch ( error ) {
        this.logger.error( 'beforeQueueStart failed', error );
        this.isloading = false;
        this.bulkIsRunning = false;
        this.stopSending = true;
        this.emitAssistantContext();
        return;
      }
    }

    const eligibleContacts: EmailerContactLite[] = [];
    const invalidContacts: EmailerContactLite[] = [];

    allContacts.forEach( contact => {
      if ( this.isQueueEligibleContact( contact ) ) {
        eligibleContacts.push( contact );
      } else {
        invalidContacts.push( contact );
      }
    } );

    this.removedContacts = invalidContacts;
    this.initialQueueSnapshot = [...eligibleContacts];
    this.bulkQueue = [...eligibleContacts];
    this.currentCatalystRunId = '';
    this.currentCatalystRunName = '';
    this.currentCatalystRunFinalized = false;

    const investorContactCount = eligibleContacts.filter( contact => this.resolveContactAudienceType( contact ) === 'investor' ).length;
    if ( investorContactCount ) {
      this.logger.info( 'Queue includes investor/VC contacts; drafting will use investor-tailored content', {
        investorContactCount
      } );
    }

    if ( invalidContacts.length ) {
      this.logger.warn( 'Removing invalid contacts from email queue', {
        removedCount: invalidContacts.length,
        removedContacts: invalidContacts.map( contact => ( {
          id: contact?.id,
          firstName: contact?.firstName,
          lastName: contact?.lastName,
          companyName: this.getCompanyNameForQueue( contact )
        } ) )
      } );
    }

    this.bulkCurrentContact = null;

    // Clear any existing scheduled timeouts from a prior run (legacy)
    this.sendTimeoutHandles.forEach( h => clearTimeout( h ) );
    this.sendTimeoutHandles = [];

    await this.createCurrentCatalystRun( eligibleContacts, invalidContacts );
    this.processNextInQueue();
  }

  private processNextInQueue (): void {
    this.logger.info( '➡️ processNextInQueue()', {
      bulkIsRunning: this.bulkIsRunning,
      stopSending: this.stopSending,
      showPreview: this.showPreview,
      remaining: this.bulkQueue?.length || 0
    } );
    if ( !this.bulkIsRunning || this.stopSending ) {
      this.isloading = false;
      this.logger.info( '⛔️ Bulk run halted.' );
      return;
    }

    if ( this.showPreview ) {
      // Wait for user action unless auto-run is enabled.
      if ( this.autoRun && !this.autoRunPauseRequested && this.pendingEmail ) {
        this.logger.info( '▶️ Auto-run active; confirming preview automatically.' );
        this.confirmSend();
        return;
      }

      this.logger.warn( '⏸️ Preview is open; queue paused.' );
      this.isloading = false;
      return;
    }

    const next = this.bulkQueue.shift();
    if ( !next ) {
      this.markQueueComplete();
      return;
    }

    this.bulkCurrentContact = next;
    this.isloading = true;
    this.emitAssistantContext();
    this.logger.info( `⏳ Preparing email for ${next.firstName} ${next.lastName || ''}` );

    if ( this.useTemplate ) {
      next._insight = '';
      this.contactInsight = '';
      this.logger.info( 'Template mode active; skipping contact insight call.', {
        contactId: next?.id,
        firstName: next?.firstName,
        lastName: next?.lastName
      } );

      this.generateEmailContent( next );
      return;
    }

    if ( this.shouldUseContactInsight() ) {
      this.getContactInsight( next );
    } else {
      next._insight = '';
      this.contactInsight = '';
      this.generateEmailContent( next );
    }
  }

  private shouldUseContactInsight (): boolean {
    return Array.isArray( this.contacts ) && this.contacts.length <= 25;
  }

  private getCompanyNameForQueue ( contact: EmailerContactLite | Contact | null | undefined ): string {
    return String(
      ( contact as any )?.company?.name ||
      ( contact as any )?.companyName ||
      ''
    ).trim();
  }

  private isQueueEligibleContact ( contact: EmailerContactLite | Contact | null | undefined ): boolean {
    const firstName = String( ( contact as any )?.firstName || '' ).trim();
    const companyName = this.getCompanyNameForQueue( contact );
    return !!firstName && !!companyName;
  }

  private clearPreviewState (): void {
    this.pendingEmail = null!;
    this.pendingContact = null!;
    this.previewTo = '';
    this.previewSubject = '';
    this.previewHtml = '';
    this.isSendingTest = false;
    this.debugRawPreview = false;
    this.lastSignalEngineMessage = '';
    this.emitAssistantContext();
  }

  private getPrimaryEmailAddress ( contact: EmailerContactLite | Contact | null | undefined ): string {
    return String(
      ( contact as any )?.emailAddresses?.[0]?.emailAddress ||
      ( contact as any )?.email ||
      ''
    ).trim();
  }

  private getSenderMailingAddress (): string {
    const address =
      this.getMeaningfulAddress( this.sender?.company?.addresses ) ||
      this.getMeaningfulAddress( this.sender?.addresses );

    if ( !address ) {
      return '';
    }

    const cityStateZip = [
      String( address.city || '' ).trim(),
      [String( address.state || '' ).trim(), String( address.zip || '' ).trim()].filter( Boolean ).join( ' ' ).trim()
    ].filter( Boolean ).join( ', ' );

    return [
      String( address.streetAddress || '' ).trim(),
      cityStateZip,
      String( address.country || '' ).trim()
    ].filter( Boolean ).join( ', ' ).trim();
  }

  private getMeaningfulAddress ( addresses: Address[] | null | undefined ): Address | null {
    if ( !Array.isArray( addresses ) ) {
      return null;
    }

    return addresses.find( address => {
      if ( !address ) {
        return false;
      }

      return [
        address.streetAddress,
        address.city,
        address.state,
        address.zip,
        address.country
      ].some( value => String( value || '' ).trim().length > 0 );
    } ) || null;
  }

  private getUtf8ByteLength ( value: string ): number {
    return new TextEncoder().encode( String( value || '' ) ).length;
  }

  private formatHtmlSizeKib ( bytes: number ): string {
    return `${( bytes / 1024 ).toFixed( 1 )} KiB`;
  }

  private getErrorMessage ( error: unknown ): string {
    if ( error instanceof Error && error.message ) {
      return error.message;
    }

    if ( typeof error === 'string' && error.trim().length > 0 ) {
      return error;
    }

    try {
      return JSON.stringify( error );
    } catch {
      return 'Unknown error';
    }
  }

  private validateEmailHtmlSize ( html: string ): boolean {
    const htmlBytes = this.getUtf8ByteLength( html );
    if ( htmlBytes <= EmailerComponent.MAX_EMAIL_HTML_BYTES ) {
      return true;
    }

    this.notificationService.show(
      'Template too large',
      `This email HTML is ${this.formatHtmlSizeKib( htmlBytes )}. Keep it under ${this.formatHtmlSizeKib( EmailerComponent.MAX_EMAIL_HTML_BYTES )} before sending.`,
      'warning'
    );
    return false;
  }

  private buildAssistantContext (): CatalystAssistantContext {
    const activeContact = this.pendingContact || this.bulkCurrentContact || null;
    const currentContactName = `${String( ( activeContact as any )?.firstName || '' ).trim()} ${String( ( activeContact as any )?.lastName || '' ).trim()}`.trim();

    return {
      page: 'catalyst',
      hasPreview: !!this.showPreview,
      isRunning: this.isRunning,
      queueComplete: !!this.queueComplete,
      remainingCount: this.remainingCount,
      skippedCount: this.skippedCount,
      removedCount: this.removedCount,
      useTemplate: !!this.useTemplate,
      templateHtml: String( this.templateHtml || '' ),
      templateSubject: String( this.templateSubject || '' ),
      hasCustomTemplateSubject: !!String( this.templateSubject || '' ).trim(),
      previewSubject: String( this.previewSubject || this.subject || '' ),
      previewHtml: String( this.previewHtml || this.emailBody || '' ),
      testEmailAddress: String( this.testEmailAddress || '' ),
      currentContactId: String( ( activeContact as any )?.id || '' ),
      currentContactName,
      currentCompanyName: this.getCompanyNameForQueue( activeContact ),
      currentContactEmail: this.getPrimaryEmailAddress( activeContact )
    };
  }

  public emitAssistantContext (): void {
    const nextContext = this.buildAssistantContext();
    this.currentAssistantContext = nextContext;
    this.assistantContextChange.emit( nextContext );
    this.toddAssistantBusService.setAssistantPageContext( nextContext );
  }

  getAssistantContextSnapshot (): CatalystAssistantContext {
    return this.buildAssistantContext();
  }

  applyAssistantDraftToPreview ( payload: CatalystAssistantDraftPayload | null | undefined ): boolean {
    if ( !payload || !this.showPreview || !this.pendingEmail ) {
      this.logger.warn( 'Assistant draft apply ignored because no active preview exists.', {
        hasPayload: !!payload,
        showPreview: this.showPreview,
        hasPendingEmail: !!this.pendingEmail
      } );
      return false;
    }

    const nextSubject = String( payload.subject || '' ).trim();
    const nextHtml = String( payload.html || payload.body || '' ).trim();

    if ( !nextSubject && !nextHtml ) {
      this.logger.warn( 'Assistant draft apply ignored because payload was empty.' );
      return false;
    }

    if ( nextSubject ) {
      this.subject = nextSubject;
      this.previewSubject = nextSubject;
      this.pendingEmail.subject = nextSubject;
    }

    if ( nextHtml ) {
      this.emailBody = nextHtml;
      this.previewHtml = nextHtml;
      this.pendingEmail.html = nextHtml;
      this.pendingEmail.textAsHtml = nextHtml;
      this.pendingEmail.text = this.stripHtmlTags( nextHtml );
    }

    this.logger.info( 'Assistant draft applied to current email preview.', {
      updatedSubject: !!nextSubject,
      updatedHtml: !!nextHtml,
      contactId: this.pendingContact?.id || ''
    } );

    this.emitAssistantContext();
    setTimeout( () => this.renderPreviewFrame(), 0 );
    return true;
  }

  private markQueueComplete (): void {
    this.isloading = false;
    this.bulkIsRunning = false;
    this.bulkCurrentContact = null;
    this.queueComplete = true;
    this.logger.info( '✅ Bulk run complete.' );
    this.logger.warn( '🏁 Bulk run END', {
      totalContacts: this.contacts?.length || 0,
      removedCount: this.removedCount,
      skippedCount: this.skippedCount,
      remaining: this.remainingCount
    } );
    void this.finalizeCurrentCatalystRun( 'completed' );
    this.emitAssistantContext();
  }

  private async createCurrentCatalystRun ( eligibleContacts: EmailerContactLite[], invalidContacts: EmailerContactLite[] ): Promise<void> {
    if ( !this.tenantId || !this.userId || eligibleContacts.length <= 0 ) {
      return;
    }

    try {
      const response = await firstValueFrom( this.outreachApiService.createCatalystRun( {
        name: this.buildCatalystRunName(),
        source: this.runContext?.source || 'stale_queue',
        includeLeadVaultContacts: this.runContext?.includeLeadVaultContacts === true,
        plannedCount: this.contacts.length,
        eligibleCount: eligibleContacts.length,
        invalidCount: invalidContacts.length,
        queuedCount: eligibleContacts.length,
        skippedCount: 0,
        removedCount: invalidContacts.length,
        contactIds: eligibleContacts.map( contact => String( contact?.id || '' ).trim() ).filter( Boolean ),
        createdByUserId: this.userId,
        createdByUserEmail: this.sender?.emailAddresses?.[0]?.emailAddress || this.sender?.email || ''
      }, {
        tenantId: this.tenantId,
        userId: this.userId,
        userEmail: this.sender?.emailAddresses?.[0]?.emailAddress || this.sender?.email || ''
      } ) );

      this.currentCatalystRunId = String( response?.data?.id || '' ).trim();
      this.currentCatalystRunName = String( response?.data?.name || this.buildCatalystRunName() ).trim();
      this.currentCatalystRunFinalized = false;
    } catch ( error ) {
      this.logger.error( 'Failed to create Catalyst run history record', error );
    }
  }

  private async finalizeCurrentCatalystRun ( status: 'completed' | 'stopped' ): Promise<void> {
    if ( !this.currentCatalystRunId || this.currentCatalystRunFinalized || !this.tenantId || !this.userId ) {
      return;
    }

    this.currentCatalystRunFinalized = true;

    try {
      await firstValueFrom( this.outreachApiService.finalizeCatalystRun( this.currentCatalystRunId, {
        status,
        queuedCount: this.initialQueueSnapshot.length,
        skippedCount: this.skippedCount,
        removedCount: this.removedCount
      }, {
        tenantId: this.tenantId,
        userId: this.userId,
        userEmail: this.sender?.emailAddresses?.[0]?.emailAddress || this.sender?.email || ''
      } ) );
    } catch ( error ) {
      this.currentCatalystRunFinalized = false;
      this.logger.error( 'Failed to finalize Catalyst run history record', error );
    }
  }

  private buildCatalystRunName (): string {
    const explicitName = String( this.runContext?.name || '' ).trim();
    if ( explicitName ) {
      return explicitName;
    }

    const source = String( this.runContext?.source || 'stale_queue' ).trim().toLowerCase();
    const sourceLabel = source === 'blocked_handoff' ? 'Blocked Handoff' : 'Stale Contacts';
    return `${sourceLabel} ${new Date().toISOString().slice( 0, 10 )}`;
  }

  loadSkippedQueue (): void {
    if ( !this.canLoadSkippedQueue ) {
      return;
    }

    const contactsToRetry = [...this.skippedContacts];
    this.skippedContacts = [];
    this.bulkQueue = contactsToRetry;
    this.bulkCurrentContact = null;
    this.queueComplete = false;
    this.stopSending = false;
    this.bulkIsRunning = true;
    this.isloading = true;
    this.autoRunPauseRequested = false;

    this.logger.info( 'Reloading skipped contacts into the queue', {
      retryCount: contactsToRetry.length
    } );

    this.emitAssistantContext();
    this.emitAssistantContext();
    this.processNextInQueue();
  }

  reloadQueue (): void {
    if ( !this.canReloadQueue ) {
      return;
    }

    this.logger.info( 'Reloading eligible contacts into the queue', {
      eligibleCount: this.initialQueueSnapshot.length
    } );

    this.stopSending = false;
    this.bulkIsRunning = true;
    this.bulkCurrentContact = null;
    this.bulkQueue = [...this.initialQueueSnapshot];
    this.skippedContacts = [];
    this.queueComplete = false;
    this.isloading = true;
    this.autoRunPauseRequested = false;
    this.emitAssistantContext();
    this.processNextInQueue();
  }

  private resolveContactAudienceType ( contact: EmailerContactLite | Contact | null | undefined ): 'investor' | 'prospect' {
    const rawSector = String(
      ( contact as any )?.sector ||
      ( contact as any )?.type ||
      ( contact as any )?.industry ||
      ( contact as any )?.company?.industry ||
      ''
    ).trim().toLowerCase();

    return rawSector === 'venture capital' ? 'investor' : 'prospect';
  }

  async generateEmailContent ( contact: Contact ) {
    this.logger.info( "Generating Email with contact", contact );

    if ( this.stopSending ) {
      this.logger.info( `⛔️ Stop flag set. Skipping email generation for ${contact?.firstName}` );
      return;
    }

    // If we're running a bulk queue, ignore late results for prior contacts
    if ( this.bulkIsRunning && this.bulkCurrentContact && contact?.id && this.bulkCurrentContact.id !== contact.id ) {
      this.logger.info( `⛔️ Ignoring late AI response for ${contact?.firstName}; current is ${this.bulkCurrentContact.firstName}` );
      return;
    }

    // Template stop-gap: if enabled, render the pasted HTML using token JSON + contact fields
    if ( this.useTemplate ) {
      await this.generateTemplateEmailForContact( contact );

      if ( this.templateError ) {
        this.logger.warn( `⚠️ Template mode error for ${contact?.firstName}: ${this.templateError}` );
        // Fall back to normal generation if template failed
      } else {
        // Template mode succeeded; proceed to send/preview using the rendered HTML
        this.sendEmail( contact as any );
        return;
      }
    }

    const blockedDraftReason = this.getBlockedDraftReason();
    const aiResponse = await this.emailService.generateEmailDraftFromEditor(
      {
        userId: this.userId,
        tenantId: this.tenantId,
        subject: this.subject || '',
        htmlContext: String( ( contact as any )?._insight || '' ).trim(),
        selectedContact: contact,
        sender: this.sender,
        reason: blockedDraftReason || this.contactInsight || null,
        toneCode: String( this.selectedTone || 'direct' ).trim(),
        handoffSource: blockedDraftReason ? 'blocked_handoff' : 'catalyst',
        draftIntent: 'fresh_outbound',
        senderPersona: 'maya'
        // Let the backend fully compose signature + disclaimer, same as it
        // already does for every Momentum draft (draftStructuredEmail is the
        // same function either way). Momentum's own draft display never
        // reprocesses what comes back - it's a straight [innerHTML] bind -
        // so Catalyst does the same below instead of maintaining its own
        // separate signature/disclaimer/formatting pipeline that inevitably
        // drifts from Momentum's.
      } as any,
      null
    ).toPromise()
      .catch( ( error ) => {
        this.logger.error( error );
        return null;
      } );

    this.logger.info( "RESPONSE FROM OPEN AI", aiResponse );

    if ( this.stopSending ) {
      this.logger.info( `⛔️ Stop flag set after AI call. Skipping send for ${contact?.firstName}` );
      return;
    }

    if ( !aiResponse ) {
      this.handleDraftFailure( contact, 'Drafting request failed - no response from AI service.' );
      return;
    }

    let parsed: any = aiResponse; // FIXED
    let responseText = '';

    this.logger.info( "PARSED", parsed );


    if ( typeof parsed === 'string' ) {
      try {
        // Some models return JSON wrapped in markdown code fences (```json ... ```)
        let cleaned = parsed.trim();

        // Remove leading/trailing code fences
        cleaned = cleaned
          .replace( /^```\s*json\s*/i, '' )
          .replace( /^```\s*/i, '' )
          .replace( /```\s*$/i, '' )
          .trim();

        // Sometimes the response includes a stray leading 'json' token on its own line
        cleaned = cleaned.replace( /^json\s*/i, '' ).trim();

        this.logger.info( "parsed = JSON.parse(cleaned)" );
        parsed = JSON.parse( cleaned );
      } catch ( err ) {
        this.logger.error( "❌ Failed to parse OpenAI JSON string:", parsed );
        this.subject = '';
        return;
      }
    }

    this.logger.info( "🟢 Parsed response type:", typeof parsed, parsed );

    let rawSubject = '';

    if ( parsed && typeof parsed === 'object' ) {
      this.logger.info( "✅ Entered parsed object handling block" );

      if ( parsed.subject ) {
        this.logger.info( "parsed.subject" );
        rawSubject = String( parsed.subject ).trim();
      } else {
        this.logger.warn( "Parsed object is missing 'subject'" );
      }

      if ( parsed.body ) {
        this.logger.info( "parsed.body" );
        responseText = String( parsed.body ).trim();
      } else {
        this.logger.warn( "Parsed object is missing 'body'" );
      }
    }

    if ( !rawSubject && !responseText ) {
      this.handleDraftFailure( contact, 'Drafting returned an empty subject and body.' );
      return;
    }

    // Not using a template, proceed as usual. bodyHtml comes back from
    // draftStructuredEmail already fully composed (signature + AI disclaimer
    // embedded, valid HTML per its own system prompt) - display it exactly
    // as-is, the same way Signal Engine's Drafts tab does
    // ([innerHTML]="getDraftBody(thread)", a plain String(thread.draftBody)
    // with zero reprocessing). No markdown-to-HTML pass needed here.
    this.emailBody = responseText;
    this.subject = this.sanitizeGeneratedSubject( rawSubject, responseText, contact );

    if ( !this.subject ) {
      this.subject = this.sanitizeGeneratedSubject( '', this.stripHtmlTags( this.emailBody ), contact );
    }


    this.logger.info( "Sending Email to this contact", contact );

    if ( this.stopSending ) {
      this.logger.info( `⛔️ Stop flag set before send. Skipping send for ${contact?.firstName}` );
      return;
    }

    this.sendEmail( contact );

  }

  private handleDraftFailure ( contact: EmailerContactLite | Contact, reason: string ): void {
    const name = `${( contact as any )?.firstName || ''} ${( contact as any )?.lastName || ''}`.trim() || 'this contact';
    this.logger.error( `⛔️ Draft failed for ${name}: ${reason}` );
    this.notificationService.show(
      'Draft failed',
      `Skipped ${name}: ${reason}`,
      'warning'
    );

    if ( this.bulkIsRunning && !this.stopSending ) {
      this.skippedContacts.push( contact as EmailerContactLite );
      this.isloading = true;
      this.emitAssistantContext();
      this.processNextInQueue();
    } else {
      this.isloading = false;
    }
  }

  private traceTag ( contact: { id?: string, firstName?: string, lastName?: string; } | null ) {
    const name = `${contact?.firstName || ''} ${contact?.lastName || ''}`.trim();
    return `[email-run contactId=${contact?.id || 'na'} name="${name}"]`;
  }

  private buildSubjectFromBody ( existingSubject: string, bodyText: string ): string {
    const cleanedExisting = String( existingSubject || '' ).replace( /\s+/g, ' ' ).trim();
    const normalizedBody = this.normalizeBodyTextForSubject( bodyText );

    if ( !normalizedBody ) {
      return cleanedExisting;
    }

    const firstSentence = this.extractFirstSentenceForSubject( normalizedBody );
    const subjectSeed = firstSentence || normalizedBody;
    const derived = this.toSubjectLine( subjectSeed );

    if ( !cleanedExisting ) {
      return derived;
    }

    const normalizedExisting = cleanedExisting.toLowerCase();
    const normalizedDerived = derived.toLowerCase();

    if ( !normalizedDerived ) {
      return cleanedExisting;
    }

    if ( normalizedExisting === normalizedDerived ) {
      return cleanedExisting;
    }

    const genericSubjects = new Set<string>( [
      'hello',
      'hi',
      'checking in',
      'following up',
      'quick question',
      'quick note',
      'touching base',
      'reaching out',
      'introduction'
    ] );

    if ( genericSubjects.has( normalizedExisting ) ) {
      return derived;
    }

    if ( cleanedExisting.length < 4 ) {
      return derived;
    }

    return cleanedExisting;
  }

  private normalizeBodyTextForSubject ( bodyText: string ): string {
    let value = String( bodyText || '' )
      .replace( /<br\s*\/?>(\s*)/gi, '\n' )
      .replace( /<\/p>/gi, '\n' )
      .replace( /<[^>]*>/g, ' ' )
      .replace( /&nbsp;/gi, ' ' )
      .replace( /&amp;/gi, '&' )
      .replace( /&lt;/gi, '<' )
      .replace( /&gt;/gi, '>' )
      .replace( /\s+/g, ' ' )
      .trim();

    value = value
      .replace( /^(hi|hello|dear)\s+[^,]+,\s*/i, '' )
      .replace( /^(best|thanks|thank you|sincerely|regards)[\s\S]*$/i, '' )
      .trim();

    return value;
  }

  private extractFirstSentenceForSubject ( text: string ): string {
    const value = String( text || '' ).trim();
    if ( !value ) return '';

    const match = value.match( /^(.{1,140}?[.!?])(?=\s|$)/ );
    if ( match && match[1] ) {
      return match[1].trim();
    }

    return value.split( /\s+/ ).slice( 0, 12 ).join( ' ' ).trim();
  }

  private toSubjectLine ( text: string ): string {
    let value = String( text || '' )
      .replace( /^["'“”‘’]+|["'“”‘’]+$/g, '' )
      .replace( /^[\-–—:;,.!?\s]+/, '' )
      .replace( /[\-–—:;,.!?\s]+$/, '' )
      .replace( /\s+/g, ' ' )
      .trim();

    if ( !value ) return '';

    const words = value.split( /\s+/ ).slice( 0, 7 );
    value = words.join( ' ' ).trim();

    return value;
  }

  private sendEmail ( contact: EmailerContactLite ) {
    try {
      this.logger.info( "Do we have contact", contact );

      if ( !contact )
        return;

      // Both the AI-draft path and template mode hand over fully-composed
      // HTML (signature, disclaimer, everything) - Catalyst just displays
      // and sends it as-is, matching how Signal Engine's Drafts tab renders
      // draftBody with zero client-side reprocessing. Reprocessing it here
      // was the actual source of the recurring duplicate-signature bug: the
      // backend already embeds the real signature verbatim, so re-running
      // signature-append/disclaimer-append logic on top of that produced a
      // second copy instead of a corrected one.

      // Confirmed live bug: this frontend footer's literal
      // "taliferro-tech-unsubscribe" href was exactly what /send-email's own
      // hasUnsubscribeFooter check looks for - so the backend always saw
      // "a footer already exists" and just patched the href, instead of
      // building its own polished, shared appendComplianceFooter output
      // (the same one Momentum's sends use, by design, so the two read
      // identically to a recipient). Removed here so the backend is the
      // only source, matching the goal already stated in its own comment.

      // Remove escaped newline sequences that may appear when HTML is copied or serialized
      if ( this.emailBody ) {
        this.emailBody = this.emailBody.replace( /\\n/g, '' ).replace( /\\r/g, '' );
      }

      if ( !this.validateEmailHtmlSize( this.emailBody ) ) {
        this.isloading = false;
        this.isSendingTest = false;
        return;
      }

      const fromEmail =
        ( this.sender.emailAddresses &&
          this.sender.emailAddresses.length > 0 &&
          this.sender.emailAddresses[0].emailAddress ) ||
        this.sender.email ||
        '';

      const toEmail =
        ( contact.emailAddresses &&
          contact.emailAddresses.length > 0 &&
          contact.emailAddresses[0].emailAddress ) ||
        contact.email ||
        '';
      const mailingAddress = this.getSenderMailingAddress();

      let email: Email = {
        to: toEmail,
        cc: '',
        // bcc: 'denise@taliferro.tech',
        subject: this.subject,
        text: this.stripHtmlTags( this.emailBody ),
        html: this.emailBody,
        textAsHtml: this.emailBody,
        contactName: contact.firstName,
        contactId: contact.id,
        catalystRunId: this.currentCatalystRunId || undefined,
        catalystRunName: this.currentCatalystRunName || undefined,
        signalOrigin: 'catalyst',
        signalEngineEnabled: true,
        from: {
          email: fromEmail,
          name: this.getSenderDisplayName()
        },
      };
      ( email as any ).mailingAddress = mailingAddress;

      this.logger.info( "This is what would be sent", email );

      // Instead of alert("Wait"), show preview modal and set preview fields
      this.pendingEmail = email;
      this.pendingContact = contact;
      this.previewTo = toEmail;
      this.previewSubject = this.subject;
      this.previewHtml = this.emailBody;
      this.showPreview = true;
      this.isloading = false;
      this.isSendingTest = false;
      this.emitAssistantContext();

      if ( !this.testEmailAddress ) {
        const senderEmail =
          ( this.sender?.emailAddresses &&
            this.sender.emailAddresses.length > 0 &&
            this.sender.emailAddresses[0]?.emailAddress ) ||
          this.sender?.email ||
          '';
        this.testEmailAddress = senderEmail;
      }

      setTimeout( () => this.renderPreviewFrame(), 0 );

      if ( this.bulkIsRunning && this.autoRun && !this.autoRunPauseRequested ) {
        setTimeout( () => {
          if ( this.showPreview && this.pendingEmail && this.autoRun && !this.autoRunPauseRequested ) {
            this.logger.info( '▶️ Auto-run sending current preview automatically.' );
            this.confirmSend();
          }
        }, 0 );
      }

    } catch ( error ) {
      this.notificationService.show( "Email Send Failure", JSON.stringify( error ), "error" );
    }
  }

  sendTestEmail (): void {
    if ( !this.pendingEmail ) {
      this.notificationService.show( 'No test email available', 'Prepare an email preview first.', 'warning' );
      return;
    }

    const testTo = String( this.testEmailAddress || '' ).trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if ( !testTo || !emailPattern.test( testTo ) ) {
      this.notificationService.show( 'Invalid test email', 'Enter a valid email address for test delivery.', 'warning' );
      return;
    }

    const testEmail: Email = {
      ...this.pendingEmail,
      to: testTo,
      subject: this.pendingEmail.subject?.startsWith( '[TEST] ' )
        ? this.pendingEmail.subject
        : `[TEST] ${this.pendingEmail.subject}`,
      // Confirmed live bug: without this, /send-email had no way to tell this
      // apart from a real send with no campaignId, so it queued the test
      // behind the shared warm-up cap and business-hours pacing instead of
      // delivering it right away - "Test email sent" fired, but the send was
      // actually scheduled more than a day out.
      isTestSend: true
    };
    delete ( testEmail as any ).catalystRunId;
    delete ( testEmail as any ).catalystRunName;

    this.isSendingTest = true;
    this.logger.info( '📨 Sending TEST email', {
      originalTo: this.pendingEmail.to,
      testTo,
      subject: testEmail.subject,
      currentPreviewTo: this.previewTo
    } );

    this.sendSubscription = this.emailService.sendEmail(
      testEmail,
      this.tenantId,
      this.userId
    ).subscribe( {
      next: ( response ) => {
        this.isSendingTest = false;
        this.notificationService.show(
          'Test email sent',
          `${testTo} - ${JSON.stringify( response )}`,
          'success'
        );
      },
      error: ( error ) => {
        this.isSendingTest = false;
        this.logger.error( 'Test email send failure', error );
        this.notificationService.show( 'Test email failed', this.getErrorMessage( error ), 'error' );
      }
    } );
  }

  cancelPreview () {
    this.logger.warn( `${this.traceTag( this.pendingContact )} 🪟 Preview CANCELLED` );
    this.showPreview = false;
    this.clearPreviewState();

    if ( this.autoRunPauseRequested ) {
      this.autoRunPauseRequested = false;
    }

    // If we're bulk-running, skipping this email should move to the next contact
    if ( this.bulkIsRunning && !this.stopSending ) {
      this.isloading = true;
      this.processNextInQueue();
    }
  }

  skipPreview () {
    // "Skip" means: don't send now, move on.
    // Skipped contacts are tracked separately and only retried when the user explicitly reloads them.
    const skipped = this.pendingContact;
    this.logger.warn( `${this.traceTag( skipped )} ⏭️ Preview SKIPPED` );

    this.showPreview = false;
    this.clearPreviewState();

    if ( this.autoRunPauseRequested ) {
      this.autoRunPauseRequested = false;
    }

    if ( this.bulkIsRunning && !this.stopSending && skipped ) {
      this.skippedContacts.push( skipped );
      this.isloading = true;
      this.processNextInQueue();
    }
  }

  confirmSend () {
    this.showPreview = false;
    this.emitAssistantContext();
    this.debugRawPreview = false;
    this.isSendingTest = false;

    const pauseAfterThisSend = this.autoRunPauseRequested;
    const sentEmail = this.pendingEmail;
    const sentContact = this.pendingContact;

    if ( !this.validateEmailHtmlSize( String( sentEmail?.html || '' ) ) ) {
      this.showPreview = true;
      this.emitAssistantContext();
      this.isloading = false;
      return;
    }

    this.logger.info( "📤 SENDING EMAIL", sentEmail );
    this.sendSubscription = this.emailService.sendEmail(
      sentEmail,
      this.tenantId,
      this.userId
    ).subscribe( {
      next: ( response ) => {
        this.notificationService.show(
          `Email sent to ${sentContact.firstName} ${sentContact.lastName}`,
          sentEmail.to + " - " + JSON.stringify( response ),
          "success"
        );
        this.emailSent.emit( sentContact.id );
        this.updateContact( sentContact );
        void this.seedSignalEngineThread( sentContact, sentEmail );

        // Reset variables
        this.clearPreviewState();

        // Continue bulk run if active
        // If auto-run was turned off during the run, pause after this send.
        if ( pauseAfterThisSend ) {
          this.logger.info( '⏸️ Auto-run pause requested; pausing after current send.' );
          this.autoRun = false;
          this.autoRunPauseRequested = false;
          this.isloading = false;
          return;
        }

        // Continue bulk run if active
        if ( this.bulkIsRunning && !this.stopSending ) {
          this.processNextInQueue();
        }
      },
      error: ( error ) => {
        this.logger.error( 'Email send failure', error );
        this.notificationService.show( 'Email send failed', this.getErrorMessage( error ), 'error' );
        this.showPreview = true;
        this.emitAssistantContext();
        this.isloading = false;
      }
    } );
  }

  private async seedSignalEngineThread ( contact: EmailerContactLite, email: Email ): Promise<void> {
    try {
      const contactId = String( contact?.id || '' ).trim();
      if ( !contactId ) return;

      const thread = this.momentumThreadService.createThreadFromSentEmail( {
        contactId,
        emailAddress: email.to,
        contactName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || email.to,
        companyName: this.getCompanyNameForQueue( contact ),
        senderEmail: String( typeof email.from === 'string' ? email.from : email.from?.email || '' ).trim(),
        senderName: this.getSenderDisplayName(),
        subject: email.subject,
        owner: 'todd',
        mode: 'draft_only',
        origin: 'catalyst',
        signalEngineEnabled: true
      } );

      await firstValueFrom( this.outreachApiService.upsertMomentumThread( thread, {
        tenantId: this.tenantId,
        userId: this.userId,
        userEmail: this.sender?.emailAddresses?.[0]?.emailAddress || this.sender?.email || ''
      } ) );

      this.lastSignalEngineMessage = `Signal Engine now owns ${contact.firstName || 'this'} ${contact.lastName || ''}`.trim() + '.';
      this.notificationService.show(
        'Signal Engine Active',
        this.lastSignalEngineMessage,
        'info'
      );
    } catch ( error ) {
      this.logger.error( 'Failed to seed Signal Engine thread from Catalyst send', error );
    }
  }

  private updateContact ( contact: Contact ) {
    contact.lastContacted = new Date().toISOString();
    this.dataService.updateContact( contact, this.userId ).then( () => {
      this.logger.info( "Contact Updated" );
    } ).catch( () => {
      this.logger.error( "Error Updating Contact" );
    } );
  }

  private getContactInsight ( contact: Contact ): void {
    this.logger.warn( '🔎 getContactInsight()', {
      contact: `${contact?.firstName || ''} ${contact?.lastName || ''}`.trim(),
      id: contact?.id,
      bulkIsRunning: this.bulkIsRunning,
      stopSending: this.stopSending,
      showPreview: this.showPreview,
      remaining: this.bulkQueue?.length || 0
    } );
    this.openAISubscription = this.openAIService.contactInsight( contact ).subscribe( {
      next: ( result ) => {
        if ( this.stopSending ) {
          this.logger.info( `⛔️ Stop flag set. Ignoring insight result for ${contact?.firstName}` );
          return;
        }
        if ( this.bulkIsRunning && this.bulkCurrentContact && contact?.id && this.bulkCurrentContact.id !== contact.id ) {
          this.logger.info( `⛔️ Ignoring late insight for ${contact?.firstName}; current is ${this.bulkCurrentContact.firstName}` );
          return;
        }

        const insight = result?.response;

        if ( insight?.relationshipBuilder && insight.relationshipBuilder !== "No insight available" ) {
          const rawInsightText = `
          Relationship Tip: ${insight.relationshipBuilder}
          Recommended Action: ${insight.recommendedAction}
          Suggested Task: ${insight.suggestedTask}
                  `.trim();

          // Assign it to a temporary property (does not persist to DB)
          contact._insight = rawInsightText;
        } else {
          // Ensure downstream prompt generation still works even when no insight is available
          contact._insight = '';
        }
        this.contactInsight = contact._insight;


        this.generateEmailContent( contact );
        this.logger.info( "Generated Insight", contact );

      },
      error: ( err ) => {
        this.logger.error( 'Error fetching contact insight:', err );
      }
    } );
  }

  private getBlockedDraftReason (): string {
    return String( this.blockedDraftReason || '' ).trim();
  }

  formatPhoneNumber ( phoneNumber: string ): string {
    const cleaned = phoneNumber.replace( /\D+/g, '' );
    if ( cleaned.length === 10 ) {
      return `${cleaned.slice( 0, 3 )}.${cleaned.slice( 3, 6 )}.${cleaned.slice( 6 )}`;
    } else {
      return phoneNumber;
    }
  }


  stripHtmlTags ( html: string ): string {
    const div = document.createElement( 'div' );
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }

  stopSendingEmails (): void {
    this.isloading = false;
    this.stopSending = true;
    this.autoRunPauseRequested = false;
    this.bulkIsRunning = false;
    this.bulkQueue = [];
    this.bulkCurrentContact = null;
    this.queueComplete = false;

    // Cancel any scheduled sends (legacy)
    this.sendTimeoutHandles.forEach( h => clearTimeout( h ) );
    this.sendTimeoutHandles = [];

    // Cancel any in-flight OpenAI insight request
    if ( this.openAISubscription ) {
      this.openAISubscription.unsubscribe();
    }

    // Close preview if open and clear pending state
    if ( this.showPreview ) {
      this.cancelPreview();
    }

    this.logger.info( "User requested to stop sending emails." );
    void this.finalizeCurrentCatalystRun( 'stopped' );
    this.emitAssistantContext();

    this.templateError = '';
    this.templateTokenDebug = null;
    this.originalTemplateHtml = '';
    this.templateSubject = '';
    this.clearPreviewState();
  }

  private escapeHtml ( text: string ): string {
    return ( text ?? '' )
      .toString()
      .replaceAll( '&', '&amp;' )
      .replaceAll( '<', '&lt;' )
      .replaceAll( '>', '&gt;' )
      .replaceAll( '"', '&quot;' )
      .replaceAll( "'", '&#39;' );
  }

  extractTemplateTokens ( html: string ): string[] {
    const found = new Set<string>();
    ( html || '' ).replace( /{{\s*([a-zA-Z0-9_-]+)\s*}}/g, ( _m, k ) => {
      found.add( String( k || '' ).trim() );
      return '';
    } );
    return Array.from( found ).sort();
  }

  onTemplateSubjectChanged (): void {
    this.emitAssistantContext();
  }

  private renderTemplateHtml ( templateHtml: string, tokens: Record<string, string> ): string {
    const safeTokens: Record<string, string> = {};
    Object.keys( tokens || {} ).forEach( k => {
      const key = String( k || '' ).trim();
      safeTokens[key] = ( tokens as any )[key] == null ? '' : String( ( tokens as any )[key] );
    } );

    // Clean up greeting spacing when firstName is missing so
    // "Hi {{firstName}}," becomes "Hi," instead of "Hi ,"
    let normalizedTemplateHtml = String( templateHtml || '' );
    const firstNameTokenValue = String( safeTokens['firstName'] || '' ).trim();
    if ( !firstNameTokenValue ) {
      normalizedTemplateHtml = normalizedTemplateHtml
        .replace( /Hi\s+{{\s*firstName\s*}}\s*,/g, 'Hi,' )
        .replace( /Hello\s+{{\s*firstName\s*}}\s*,/g, 'Hello,' )
        .replace( /Dear\s+{{\s*firstName\s*}}\s*,/g, 'Dear,' );
    }

    return normalizedTemplateHtml.replace( /{{\s*([a-zA-Z0-9_-]+)\s*}}/g, ( _m, keyRaw ) => {
      const key = String( keyRaw || '' ).trim();
      const val = safeTokens[key] ?? '';
      if ( this.rawHtmlTokens.has( key ) ) return val;
      return this.escapeHtml( val );
    } );
  }

  private buildContactTokenMap ( contact: Contact ): Record<string, string> {
    const companyName = ( contact as any )?.company?.name || ( contact as any )?.companyName || '';
    const title = ( contact as any )?.title || ( contact as any )?.jobTitle || '';

    const toEmail =
      ( ( contact as any )?.emailAddresses && ( contact as any )?.emailAddresses.length > 0 && ( contact as any )?.emailAddresses[0]?.emailAddress ) ||
      ( contact as any )?.email ||
      '';

    return {
      firstName: String( ( contact as any )?.firstName || '' ).trim(),
      lastName: String( ( contact as any )?.lastName || '' ).trim(),
      fullName: `${String( ( contact as any )?.firstName || '' )} ${String( ( contact as any )?.lastName || '' )}`.trim(),
      company: String( companyName || '' ),
      companyName: String( companyName || '' ),
      title: String( title || '' ),
      email: String( toEmail || '' ),

      // signature should usually come from sender (Ty)
      signature: String(
        this.sender?.signature ||
        `${this.sender?.firstName || ''} ${this.sender?.lastName || ''}`.trim()
      )
    };
  }

  private getReservedTemplateTokens (): Set<string> {
    return new Set<string>( [
      'firstName', 'lastName', 'fullName', 'company', 'companyName', 'title', 'email', 'signature'
    ] );
  }

  private getTemplateTokensNeedingModel ( htmlTokens: string[], subjectTokens: string[] = [] ): string[] {
    const reserved = this.getReservedTemplateTokens();
    const combined = Array.from( new Set<string>( [...( htmlTokens || [] ), ...( subjectTokens || [] )] ) );
    return combined.filter( token => !!token && !reserved.has( token ) );
  }

  private escapeRegex ( value: string ): string {
    return String( value || '' ).replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );
  }

  private normalizeTemplateModelTokens ( contact: Contact, tokens: Record<string, string> ): Record<string, string> {
    const normalized: Record<string, string> = { ...( tokens || {} ) };

    const firstName = String( ( contact as any )?.firstName || '' ).trim();
    let content = String( normalized['content'] || '' ).trim();

    if ( content ) {
      // Remove greetings like "Hi Ellen," or "Hello Ellen,"
      content = content.replace( /^(hi|hello|dear)\s+[^,]+,\s*/i, '' ).trim();

      // Remove a repeated first name at the beginning, e.g. "Ellen, ..."
      if ( firstName ) {
        const firstNamePattern = new RegExp( `^${this.escapeRegex( firstName )}\\s*,?\\s*`, 'i' );
        content = content.replace( firstNamePattern, '' ).trim();
      }

      // Keep content to the opening sentence plus the required
      // "There’s no real secret to better ..." sentence when present.
      // Protect common business abbreviations so sentence splitting does not
      // break on values like "Inc.", "LLC.", or "Co.".
      const abbreviationMap: Array<[RegExp, string]> = [
        [/\bInc\./g, 'Inc§'],
        [/\bLLC\./g, 'LLC§'],
        [/\bCo\./g, 'Co§'],
        [/\bCorp\./g, 'Corp§'],
        [/\bLtd\./g, 'Ltd§'],
        [/\bSr\./g, 'Sr§'],
        [/\bJr\./g, 'Jr§'],
        [/\bMr\./g, 'Mr§'],
        [/\bMrs\./g, 'Mrs§'],
        [/\bMs\./g, 'Ms§'],
        [/\bDr\./g, 'Dr§']
      ];

      let protectedContent = content;
      abbreviationMap.forEach( ( [pattern, replacement] ) => {
        protectedContent = protectedContent.replace( pattern, replacement );
      } );

      const sentenceParts = protectedContent
        .split( /(?<=[.!?])\s+(?=[A-Z“"'])/ )
        .map( s => s.trim() )
        .filter( Boolean )
        .map( s => {
          let restored = s;
          abbreviationMap.forEach( ( [_pattern, replacement] ) => {
            restored = restored.replaceAll( replacement, replacement.replace( '§', '.' ) );
          } );
          return restored;
        } );

      if ( sentenceParts.length > 0 ) {
        const stemSentence = sentenceParts.find( s => /there.?s no real secret to better/i.test( s ) );

        if ( stemSentence ) {
          const openingSentence = sentenceParts.find( s => s !== stemSentence );
          content = openingSentence ? `${openingSentence} ${stemSentence}`.trim() : stemSentence;
        } else if ( sentenceParts[0] ) {
          content = sentenceParts[0];
        }
      }

      // Preserve sentence separation by converting sentence boundaries into HTML line breaks
      content = content
        .replace( /([.!?])\s+(?=[A-Z])/g, '$1<br><br>' )
        .replace( /\s+/g, ' ' )
        .trim();
      normalized['content'] = content;
    }

    if ( normalized['subject'] ) {
      normalized['subject'] = String( normalized['subject'] ).replace( /\s+/g, ' ' ).trim();
    }

    if ( normalized['subheading'] ) {
      normalized['subheading'] = String( normalized['subheading'] ).replace( /\s+/g, ' ' ).trim();
    }

    return normalized;
  }

  private buildTemplateTokenPrompt ( contact: Contact, detectedTokens: string[] ): string {
    const editorContext = String( ( contact as any )?._insight || '' ).trim();

    // Tokens that come from the contact map should NOT be generated by the model.
    const reserved = this.getReservedTemplateTokens();

    const wanted = Array.isArray( detectedTokens )
      ? detectedTokens.filter( t => !!t && !reserved.has( t ) )
      : [];

    // Always get subject so we can set the email subject line
    if ( !wanted.includes( 'subject' ) ) wanted.unshift( 'subject' );

    return [
      'You are filling placeholders for an HTML email template.',
      'Return ONLY valid JSON.',
      'Do not return markdown.',
      'Do not return explanatory text.',
      'Do not return any keys other than the exact keys requested.',
      '',
      'Contact context:',
      `Name: ${String( ( contact as any )?.firstName || '' )} ${String( ( contact as any )?.lastName || '' )}`.trim(),
      `Company: ${String( ( contact as any )?.company?.name || ( contact as any )?.companyName || '' )}`.trim(),
      `Profession: ${String( ( contact as any )?.profession || '' )}`.trim(),
      `Sector: ${String( ( contact as any )?.type || ( contact as any )?.sector || '' )}`.trim(),
      editorContext ? `Relationship insight:\n${editorContext}` : 'Relationship insight: (none)',
      '',
      'Instructions:',
      '- Write a concise subject if subject is requested related to the sector.',
      '- Subject lines must sound human, plain, and specific.',
      '- Do not write marketing-style subject lines.',
      '- Do not use phrases like seamless solutions, innovative solutions, transform, unlock, optimize your business, accelerate growth, or drive growth.',
      '- Do not make the subject sound like a brochure, campaign slogan, or website headline.',
      '- Keep the subject under 7 words when possible.',
      '- Good subject examples: Quick question, AI question, About Midland Tech, Data issue, Operational drag.',
      '- If subheading is requested, keep it short and specific to the sector.',
      '- If content is requested, write ONLY one killer opening line that complements the template.',
      '- The opening line must read naturally immediately after "Hi {{firstName}},"',
      '- The opening line must be a complete sentence, not a fragment, label, or headline.',
      '- The opening line must contain a subject and a verb.',
      '- Keep the opening line under 12 words when possible.',
      '- The opening line must be about the contact\'s reality, pressure, company, role, or sector.',
      '- The opening line must NOT talk about the sender, the sender\'s product, demos, meetings, or outreach.',
      '- The opening line should make the reader pause.',
      '- When useful, anchor the line in a concrete industry truth, operational tension, or credible outside signal that a research firm, analyst, regulator, or trade source might plausibly surface.',
      '- Do not fabricate quotes, study names, percentages, or named sources unless they are explicitly provided in the relationship insight.',
      '- Do not write in third person such as "James is..." or "Ellen could benefit..."',
      '- Do not start with the contact first name or last name.',
      '- Do not start with gerunds like "Navigating," "Managing," "Improving," or "Reducing" unless used in a full natural sentence.',
      '- Bad example: Navigating the challenges of AI adoption at Janus Associates, Inc.',
      '- Good example: Most firms testing AI discover the process breaks before the model does.',
      '- Good example: Supplier teams usually feel the friction before leadership sees it.',
      '- Good example: AI pilots often expose workflow gaps, not model gaps.',
      '- Do not include a greeting, CTA, sign-off, summary, or second sentence in content.',
      '- Content must directly reflect the relationship insight when one is provided.',
      '- When natural, mention the company or sector so the line feels personalized.',
      '- Avoid generic marketing language, vague productivity claims, and empty hype.',
      '- If point-title, point1, point2, or point3 are requested, you must generate them.',
      '- If point-title, point1, point2, or point3 are requested, make them concrete esoteric pain points that fit the contact, company, and sector - no more than 7 words.',
      '- Do not include greeting or signature unless explicitly requested as a key.',
      '- They should reflect esoteric friction common to the contact\'s profession, company type, or sector.',
      '- Do not return empty values for these fields.',
      '',
      `Return JSON with EXACT keys only:\n${JSON.stringify( wanted )}`
    ].join( '\n' );
  }

  private async generateTemplateEmailForContact ( contact: Contact ): Promise<void> {
    this.templateError = '';
    this.templateTokenDebug = null;

    const tpl = String( this.templateHtml || '' );
    this.originalTemplateHtml = tpl;
    if ( !tpl.trim() ) {
      this.templateError = 'Template HTML is empty.';
      return;
    }

    const detected = this.extractTemplateTokens( tpl );
    const detectedSubjectTokens = this.extractTemplateTokens( String( this.templateSubject || '' ) );
    const modelNeededTokens = this.getTemplateTokensNeedingModel( detected, detectedSubjectTokens );
    this.templateTokensDetected = Array.from( new Set<string>( [...detected, ...detectedSubjectTokens] ) ).sort();

    const contactTokens = this.buildContactTokenMap( contact );

    if ( !modelNeededTokens.length ) {
      const mergedLocal: Record<string, string> = { ...contactTokens };
      const customTemplateSubject = String( this.templateSubject || '' ).trim();

      if ( customTemplateSubject ) {
        const renderedCustomSubject = this.renderTemplateHtml( customTemplateSubject, mergedLocal )
          .replace( /<[^>]*>/g, ' ' )
          .replace( /\s+/g, ' ' )
          .trim();

        this.subject = renderedCustomSubject || this.subject || 'Hello';
      } else {
        this.subject = this.subject || 'Hello';
      }

      const renderedLocal = this.renderTemplateHtml( tpl, mergedLocal );
      this.emailBody = renderedLocal;
      this.templateTokenDebug = {
        detected,
        detectedSubjectTokens,
        modelNeededTokens,
        skippedOpenAI: true,
        merged: mergedLocal
      };
      this.emitAssistantContext();
      return;
    }

    const aiQuestion = this.buildTemplateTokenPrompt( contact, modelNeededTokens );

    this.logger.info( "CALLING OPEN AI WITH", aiQuestion );

    this.logger.warn( 'TEMPLATE MODE: calling /template-tokens', {
      contactId: contact?.id,
      detectedTokens: detected
    } );

    const aiResponse = await this.openAIService.getTemplateTokenAssistance( aiQuestion, this.userId, contact || undefined )
      .toPromise()
      .catch( ( error ) => {
        this.logger.error( error );
      } );

    let parsed: any = aiResponse;
    this.logger.info( 'TEMPLATE MODE raw AI response', parsed );

    if ( parsed && typeof parsed === 'object' && typeof parsed.response === 'string' ) {
      parsed = parsed.response;
    }

    if ( parsed && typeof parsed === 'object' ) {
      if ( parsed.body && !parsed.content ) parsed.content = parsed.body;
      if ( parsed.title && !parsed.subject ) parsed.subject = parsed.title;
    }

    if ( typeof parsed === 'string' ) {
      try {
        let cleaned = parsed.trim();
        cleaned = cleaned
          .replace( /^```\s*json\s*/i, '' )
          .replace( /^```\s*/i, '' )
          .replace( /```\s*$/i, '' )
          .trim();
        cleaned = cleaned.replace( /^json\s*/i, '' ).trim();
        parsed = JSON.parse( cleaned );
      } catch ( err ) {
        this.logger.error( '❌ Failed to parse template token JSON:', parsed );
        this.templateError = 'OpenAI returned invalid JSON for template tokens.';
        this.templateTokenDebug = { detected, raw: aiResponse, parsedAttempt: parsed, prompt: aiQuestion };
        return;
      }
    }

    if ( !parsed || typeof parsed !== 'object' ) {
      this.templateError = 'OpenAI did not return a token object.';
      return;
    }

    // contactTokens already defined above

    const normalizedParsed: Record<string, string> = this.normalizeTemplateModelTokens( contact, { ...( parsed || {} ) } );
    if ( normalizedParsed['title'] && !normalizedParsed['subject'] ) {
      normalizedParsed['subject'] = normalizedParsed['title'];
    }
    if ( normalizedParsed['subject'] && !normalizedParsed['title'] ) {
      normalizedParsed['title'] = normalizedParsed['subject'];
    }

    if ( normalizedParsed['pointTitle'] && !normalizedParsed['point-title'] ) {
      normalizedParsed['point-title'] = normalizedParsed['pointTitle'];
    }


    // Merge: contact tokens win for reserved keys
    const merged: Record<string, string> = { ...normalizedParsed, ...contactTokens };

    // Ensure subject exists (fallback), but allow the user to override it in template mode.
    const modelSubject = String( merged['subject'] || '' ).trim();
    const customTemplateSubject = String( this.templateSubject || '' ).trim();

    if ( customTemplateSubject ) {
      const renderedCustomSubject = this.renderTemplateHtml( customTemplateSubject, merged )
        .replace( /<[^>]*>/g, ' ' )
        .replace( /\s+/g, ' ' )
        .trim();

      this.subject = renderedCustomSubject || modelSubject || this.subject || 'Hello';
    } else {
      this.subject = modelSubject || this.subject || 'Hello';
    }

    // Render HTML for sending
    const rendered = this.renderTemplateHtml( tpl, merged );
    this.emailBody = rendered;
    this.emitAssistantContext();

    // Debug info for troubleshooting if you want it later
    this.templateTokenDebug = {
      detected,
      detectedSubjectTokens,
      modelNeededTokens,
      prompt: aiQuestion,
      modelTokens: parsed,
      merged,
      skippedOpenAI: false
    };
  }

  onAutoRunToggle (): void {
    this.logger.info( 'Auto-run toggled', {
      autoRun: this.autoRun,
      bulkIsRunning: this.bulkIsRunning,
      showPreview: this.showPreview,
      remaining: this.remainingCount
    } );

    if ( !this.autoRun ) {
      // If user turns auto-run off during an active run, pause at the next preview boundary.
      this.autoRunPauseRequested = true;
      return;
    }

    // Auto-run was turned on.
    this.autoRunPauseRequested = false;

    // If we are already sitting on a preview, continue immediately.
    if ( this.bulkIsRunning && this.showPreview && this.pendingEmail ) {
      this.confirmSend();
    }
  }

  private sanitizeGeneratedSubject ( existingSubject: string, bodyText: string, contact?: Contact ): string {
    const cleanedExisting = String( existingSubject || '' ).replace( /\s+/g, ' ' ).trim();
    const derived = this.buildSubjectFromBody( '', bodyText );

    if ( !cleanedExisting ) {
      return derived;
    }

    if ( this.isMarketingSubjectLine( cleanedExisting ) ) {
      this.logger.warn( 'Rejecting marketing-style subject line; falling back to body-derived subject.', {
        rejectedSubject: cleanedExisting,
        contactId: contact?.id,
        derivedSubject: derived
      } );
      return derived;
    }

    return this.normalizeSubjectLine( cleanedExisting );
  }

  private isMarketingSubjectLine ( subject: string ): boolean {
    const normalized = this.normalizeSubjectLine( subject ).toLowerCase();
    if ( !normalized ) return true;

    const hardBlockedPhrases = [
      'integrating seamless',
      'seamless tech solutions',
      'unlock',
      'revolutionize',
      'supercharge',
      'boost your',
      'maximize your',
      'transform your',
      'next-level',
      'game-changing',
      'cutting-edge',
      'innovative solution',
      'drive growth',
      'accelerate growth',
      'synergy',
      'streamline your business',
      'optimize your business'
    ];

    if ( hardBlockedPhrases.some( phrase => normalized.includes( phrase ) ) ) {
      return true;
    }

    if ( /\b(learn more|schedule a demo|book a demo|quick call|free consultation)\b/i.test( normalized ) ) {
      return true;
    }

    if ( /\b(for|with)\s+[a-z0-9][a-z0-9&.,\-\s]{0,50}$/i.test( normalized ) && normalized.length > 28 ) {
      return true;
    }

    if ( normalized.split( /\s+/ ).length > 8 ) {
      return true;
    }

    return false;
  }

  private normalizeSubjectLine ( subject: string ): string {
    return String( subject || '' )
      .replace( /^subject\s*:\s*/i, '' )
      .replace( /\s+/g, ' ' )
      .trim();
  }

}
