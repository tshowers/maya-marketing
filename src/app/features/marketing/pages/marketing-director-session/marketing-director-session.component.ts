import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription, combineLatest, firstValueFrom, of } from 'rxjs';
import { catchError, map, switchMap, take } from 'rxjs/operators';

import { DEFAULT_MARKETING_EMPLOYEE_ID } from '../../models/marketing-employee.models';
import { MarketingEmployeeService } from '../../services/marketing-employee.service';
import {
  MarketingDirectorMoveContextItem,
  PublicMarketingDirectorAccessMode,
  PublicMarketingDirectorEmailContext,
  PublicMarketingDirectorMessage,
  PublicMarketingDirectorSystemAction,
  PublicMarketingDirectorWorkspaceContext,
  PublicMarketingDirectorService
} from '../../services/public-marketing-director.service';
import { MarketingEmployeeActionRecord, MarketingEmployeeOutcomeRecord, MarketingPlanRecord } from '../../models/marketing-employee.models';
import { AuthService } from '../../../../services/auth.service';
import { EntitlementService } from '../../../../services/entitlement.service';
import { NotificationService } from '../../../../services/notification.service';
import { UserService } from '../../../../services/user.service';
import { environment } from '../../../../../environments/environment';
import { Contact } from '../../../../shared/data/interfaces/contact.model';
import { EmployeePlanService } from '../../../employees/services/employee-plan.service';
import { DocService } from '../../../document/doc.service';
import { TaskService } from '../../../../services/task.service';
import { SurveyApiService } from '../../../survey/services/survey-api.service';
import { ResponseFlowService } from '../../../knowledge/response-flow.service';
import { EmailService } from '../../../../services/email.service';
import { Task } from '../../../../shared/data/interfaces/task.model';
import { Survey } from '../../../survey/models/survey.model';
import { AssistantBoxUtilityService } from '../../../../services/assistant-box-utility.service';
import { MarketingDirectorCapabilitiesService } from '../../services/marketing-director-capabilities.service';
import { BUILD_VERSION } from '../../../../version';

@Component( {
  selector: 'app-marketing-director-session',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './marketing-director-session.component.html',
  styleUrls: ['./marketing-director-session.component.css']
} )
export class MarketingDirectorSessionComponent implements OnInit, OnDestroy {
  @ViewChildren( 'messageItem' ) private messageItems?: QueryList<ElementRef<HTMLElement>>;

  readonly avatarUrl = 'assets/marketing/marketing-director-avatar.png';
  readonly suiteImageUrl = 'assets/suite/todd-suite2.png';
  readonly directorName = 'Maya';
  readonly employeeId = DEFAULT_MARKETING_EMPLOYEE_ID;
  readonly buildVersion = BUILD_VERSION;

  starterPrompts = this.buildPublicStarterPrompts();
  composerPlaceholder = this.buildPublicPlaceholder();
  isLoggedInWorkspaceUser = false;
  hasPaidWorkspaceAccess = false;
  messages: PublicMarketingDirectorMessage[] = [];
  prompt = '';
  sending = false;
  errorMessage = '';
  showUpgradePanel = false;
  hasUserMessages = false;
  showSuggestionTray = true;
  showApps = false;
  readonly appLinks = [
    { label: 'Home', route: 'https://todd.taliferro.tech', image: 'assets/find/entities/todd/logo-icon.png', external: true },
    { label: 'Find', route: 'https://find.taliferro.tech', image: 'assets/find/entities/find/logo-icon.png', external: true },
    { label: 'Email Signature', route: 'https://signature.taliferro.tech', image: 'assets/find/entities/email-signature-builder/logo-icon.png', external: true },
    { label: 'SayIt', route: 'https://sayit.taliferro.tech', image: 'assets/find/entities/sayit/logo.png', external: true },
    { label: 'Ask TODD', route: 'https://todd.taliferro.tech/ask-todd', image: 'assets/find/entities/todd/logo-icon.png', external: true },
    { label: 'Lead Vault', route: 'https://lead-vault-taliferro.tech', image: 'assets/find/entities/lead-vault/logo-icon.png', external: true },
    { label: 'Music', route: 'https://music.taliferro.com', image: 'assets/find/entities/music/logo-icon.png', external: true },
    { label: 'Pulse', route: 'https://pulse.taliferro.tech', image: 'assets/icons/pulse.png', external: true },
    { label: 'Network', route: 'https://network.taliferro.tech', image: 'assets/icons/network.png', external: true },
    { label: 'Outreach', route: 'https://outreach.taliferro.tech', image: 'assets/icons/outreach.png', external: true },
    { label: 'Moves', route: 'https://moves.taliferro.tech', image: 'assets/icons/moves.png', external: true },
    { label: 'Social', route: 'https://social.taliferro.tech', image: 'assets/todd-social-icon.png', external: true },
    { label: 'Docs', route: 'https://docs.taliferro.tech', image: 'assets/icons/docs.png', external: true }
  ];
  private authContextSubscription?: Subscription;
  private readonly revisitStoragePrefix = 'maya-session-plan-reminder';
  private readonly sessionStoragePrefix = 'maya-session-memory';
  private tenantId = '';
  private userId = '';
  private hasActivePlan = false;
  private currentContact: Contact | null = null;
  private currentHasPaidWorkspaceAccess = false;
  private currentWorkItems: MarketingDirectorMoveContextItem[] = [];
  private pendingApprovalItems: MarketingDirectorMoveContextItem[] = [];
  private completedWorkItems: MarketingDirectorMoveContextItem[] = [];
  private latestOutcome: MarketingEmployeeOutcomeRecord | null = null;
  private sessionMemoryHydrated = false;
  private workspaceConversationId = '';
  private workspaceConversationMessagesSubscription?: Subscription;
  private workspaceConversationContextKey = '';
  private masterPlanSnapshot: MarketingPlanRecord | null = null;
  // Set when this session was opened from Maya's "Talk to me about this
  // email" signature link (?emailId=&tenantId=) - the visitor is that
  // email's recipient, not a logged-in TODD user, so this is how Maya
  // knows what the conversation is about without them explaining it.
  private emailContext: PublicMarketingDirectorEmailContext | null = null;

  constructor (
    private readonly publicMarketingDirectorService: PublicMarketingDirectorService,
    private readonly marketingEmployeeService: MarketingEmployeeService,
    private readonly authService: AuthService,
    private readonly entitlementService: EntitlementService,
    private readonly userService: UserService,
    private readonly employeePlanService: EmployeePlanService,
    private readonly notificationService: NotificationService,
    private readonly docService: DocService,
    private readonly taskService: TaskService,
    private readonly surveyApiService: SurveyApiService,
    private readonly responseFlowService: ResponseFlowService,
    private readonly emailService: EmailService,
    private readonly assistantBoxUtilityService: AssistantBoxUtilityService,
    private readonly marketingDirectorCapabilitiesService: MarketingDirectorCapabilitiesService,
    private readonly route: ActivatedRoute
  ) { }

  async ngOnInit (): Promise<void> {
    await this.loadEmailContextFromQueryParams();
    this.authContextSubscription = this.authService.getUser().pipe(
      switchMap( user => {
        const userId = String( user?.uid || '' ).trim();
        this.isLoggedInWorkspaceUser = !!userId;

        if ( !userId ) {
          return of( {
            contact: null as Contact | null,
            hasActivePlan: false,
            hasPaidWorkspaceAccess: false,
            currentWorkItems: [] as MarketingDirectorMoveContextItem[],
            pendingApprovalItems: [] as MarketingDirectorMoveContextItem[],
            completedWorkItems: [] as MarketingDirectorMoveContextItem[],
            latestOutcome: null as MarketingEmployeeOutcomeRecord | null,
            tenantId: '',
            userId: ''
          } );
        }

        return this.authService.getTenantId().pipe(
          take( 1 ),
          switchMap( tenantId => {
            const normalizedTenantId = String( tenantId || '' ).trim();
            const isMasterTenant = normalizedTenantId === String( environment.taliferroTenantId || '' ).trim();

            if ( !normalizedTenantId ) {
              return of( {
                contact: null as Contact | null,
                hasActivePlan: false,
                hasPaidWorkspaceAccess: false,
                currentWorkItems: [] as MarketingDirectorMoveContextItem[],
                pendingApprovalItems: [] as MarketingDirectorMoveContextItem[],
                completedWorkItems: [] as MarketingDirectorMoveContextItem[],
                latestOutcome: null as MarketingEmployeeOutcomeRecord | null,
                tenantId: '',
                userId
              } );
            }

            return combineLatest( [
              this.userService.getLoggedInContactInfo( true ).pipe( take( 1 ) ),
              this.entitlementService.getResolvedEntitlements().pipe(
                take( 1 ),
                map( entitlements => !!entitlements.suite || isMasterTenant ),
                catchError( () => of( isMasterTenant ) )
              ),
              this.marketingEmployeeService.watchCurrentWork(
                normalizedTenantId,
                this.employeeId
              ).pipe(
                map( actions => this.extractActionSummariesForToday( actions ) ),
                catchError( () => of( [] as MarketingDirectorMoveContextItem[] ) )
              ),
              this.marketingEmployeeService.watchPendingApprovals(
                normalizedTenantId,
                this.employeeId
              ).pipe(
                map( actions => this.extractActionSummariesForToday( actions ) ),
                catchError( () => of( [] as MarketingDirectorMoveContextItem[] ) )
              ),
              this.marketingEmployeeService.watchCompletedWork(
                normalizedTenantId,
                this.employeeId
              ).pipe(
                map( actions => this.extractActionSummariesForToday( actions ) ),
                catchError( () => of( [] as MarketingDirectorMoveContextItem[] ) )
              ),
              this.marketingEmployeeService.watchMarketingPlans(
                normalizedTenantId,
                this.employeeId,
                { status: 'active', limit: 1 }
              ).pipe(
                map( plans => plans.some( plan => String( plan?.sourceType || '' ).trim().toLowerCase() !== 'generated' ) ),
                catchError( () => of( false ) )
              ),
              this.marketingEmployeeService.watchOutcomes(
                normalizedTenantId,
                this.employeeId,
                { limit: 1 }
              ).pipe(
                map( outcomes => outcomes[0] || null ),
                catchError( () => of( null as MarketingEmployeeOutcomeRecord | null ) )
              )
            ] ).pipe(
              map( ( [
                contact,
                hasPaidWorkspaceAccess,
                currentWorkItems,
                pendingApprovalItems,
                completedWorkItems,
                hasActivePlan,
                latestOutcome
              ] ) => ( {
                contact,
                hasActivePlan,
                hasPaidWorkspaceAccess,
                currentWorkItems,
                pendingApprovalItems,
                completedWorkItems,
                latestOutcome,
                tenantId: normalizedTenantId,
                userId
              } ) )
            );
          } )
        );
      } )
    ).subscribe( context => {
      this.applySessionContext(
        context.contact,
        context.hasActivePlan,
        context.hasPaidWorkspaceAccess,
        context.currentWorkItems,
        context.pendingApprovalItems,
        context.completedWorkItems,
        context.latestOutcome,
        context.tenantId,
        context.userId
      );
    } );
  }

  ngOnDestroy (): void {
    this.authContextSubscription?.unsubscribe();
    this.workspaceConversationMessagesSubscription?.unsubscribe();
  }

  private async loadEmailContextFromQueryParams (): Promise<void> {
    const emailId = String( this.route.snapshot.queryParamMap.get( 'emailId' ) || '' ).trim();
    const tenantId = String( this.route.snapshot.queryParamMap.get( 'tenantId' ) || '' ).trim();
    if ( !emailId || !tenantId ) return;

    this.emailContext = await this.publicMarketingDirectorService.fetchEmailContext( emailId, tenantId );
  }

  private buildEmailContextGreeting ( emailContext: PublicMarketingDirectorEmailContext ): string {
    const firstName = String( emailContext.recipientName || '' ).trim().split( /\s+/ )[0] || '';
    const greeting = firstName ? `Hi ${firstName}, ` : 'Hi, ';
    const subjectPhrase = emailContext.subject ? ` about "${emailContext.subject}"` : '';
    return `${greeting}I'm Maya - I sent you an email${subjectPhrase} a little while ago. What's on your mind?`;
  }

  async sendMessage ( presetPrompt?: string ): Promise<void> {
    const normalizedPrompt = String( presetPrompt || this.prompt || '' ).trim();
    if ( !normalizedPrompt || this.sending ) return;

    await this.ensureWorkspaceSessionConnection();

    this.errorMessage = '';
    this.sending = true;

    const userMessage: PublicMarketingDirectorMessage = {
      ...this.buildMessage( 'user', normalizedPrompt )
    };

    this.messages = [...this.messages, userMessage];
    this.prompt = '';
    this.hasUserMessages = true;
    this.showSuggestionTray = false;
    this.persistSessionMemory();
    await this.appendWorkspaceMessage( 'user', normalizedPrompt );
    this.scrollLatestUserMessageIntoView();

    const routeGuide = this.marketingDirectorCapabilitiesService.tryRouteGuide( normalizedPrompt );
    if ( routeGuide.handled && routeGuide.kind === 'message' ) {
      this.messages = [
        ...this.messages,
        this.buildHtmlMessage(
          'director',
          routeGuide.message,
          this.assistantBoxUtilityService.normalizeModelOutputToHtml( routeGuide.message )
        )
      ];
      this.persistSessionMemory();
      await this.appendWorkspaceMessage( 'employee', routeGuide.message );
      this.sending = false;
      this.scrollLatestUserMessageIntoView();
      return;
    }

    try {
      const response = await this.publicMarketingDirectorService.askDirector(
        normalizedPrompt,
        this.messages,
        this.resolveAccessMode(),
        this.buildDirectorWorkspaceContext()
      );
      const normalizedDirectorReply = this.normalizeDirectorReply( response.reply );
      this.showUpgradePanel = response.executionIntent && !this.hasPaidWorkspaceAccess;
      this.messages = [
        ...this.messages,
        this.buildMessage( 'director', normalizedDirectorReply )
      ];
      this.persistSessionMemory();
      await this.appendWorkspaceMessage( 'employee', normalizedDirectorReply );
      const createdReceipt = await this.maybePersistMasterPlan( normalizedPrompt, response.reply );
      const executedReceipt = await this.executeDirectorSystemActions( response.systemActions || [] );
      this.appendExecutionReceiptNotice( normalizedDirectorReply, createdReceipt || executedReceipt );
    } catch {
      this.errorMessage = 'She could not answer that right now. Please try again in a moment.';
    } finally {
      this.sending = false;
      this.scrollLatestUserMessageIntoView();
    }
  }

  trackById ( _index: number, item: PublicMarketingDirectorMessage ): string {
    return item.id;
  }

  handlePromptFocus (): void {
    this.showSuggestionTray = !String( this.prompt || '' ).trim();
  }

  handlePromptChange ( value: string ): void {
    this.prompt = value;
    this.showSuggestionTray = !String( value || '' ).trim();
  }

  private normalizeDirectorReply ( content: string ): string {
    const normalized = String( content || '' )
      .replace( /\r/g, '' )
      .replace( /(^|\n)#{1,6}\s*/g, '$1' )
      .replace( /here(?: is|'s)\s+a\s+structured\s+outline\s*:/gi, `Here's how I'd work it:` )
      .replace( /it could benefit from/gi, 'it needs' )
      .replace( /let'?s get this set up[.\s-]*i['’]ll take care of it now\.?/gi, 'I can draft that next, but it is not saved anywhere yet.' )
      .replace( /i['’]ll take care of it now\.?/gi, 'I can draft that next, but it is not saved anywhere yet.' )
      .replace( /i['’]ll handle it now\.?/gi, 'I can draft that next, but it is not saved anywhere yet.' )
      .replace( /would you like to implement these changes,? or do you want to brainstorm further around this messaging framework\??/gi, 'If you want, I can turn this into the actual homepage copy next.' )
      .replace( /let me know how you'd like to proceed\.?/gi, 'Pick the next move and I’ll keep going.' )
      .replace( /\n{3,}/g, '\n\n' )
      .trim();
    if ( !normalized ) return normalized;

    const needsSpecificPrompt =
      /how you'd like to proceed/i.test( normalized ) ||
      /what you want to prioritize first/i.test( normalized ) ||
      /let me know how to proceed/i.test( normalized );

    if ( !needsSpecificPrompt ) {
      return normalized;
    }

    return `${normalized}

Pick one and I will keep moving:
- Define the target audience first
- Draft the affiliate and reseller program
- Build the first campaign plan`;
  }

  private async maybePersistMasterPlan ( userPrompt: string, directorReply: string ): Promise<boolean> {
    const normalizedReply = String( directorReply || '' ).trim();
    const looksLikePlan = /(target audience|campaign|messaging|metrics|next steps|timeline)/i.test( normalizedReply );

    if ( !this.isLoggedInWorkspaceUser || !this.tenantId || !looksLikePlan || this.hasActivePlan ) {
      return false;
    }

    try {
      const employee = await this.marketingEmployeeService.getOrCreateEmployee( this.tenantId, { id: this.employeeId } );
      const planBody = [
        normalizedReply,
        '',
        'Execution Ownership',
        '- Maya owns: target audience, positioning, campaign design, messaging, KPI targets, draft creation, and daily planning decisions.',
        '- TODD owns: queueing, sending, publishing, scheduling, follow-up execution, live monitoring, and autonomous optimization.',
        '- Operator owns: strategic direction changes, exceptional overrides, and manual review only when autonomy is intentionally constrained.'
      ].join( '\n' );
      const preview = await this.employeePlanService.buildPreview(
        planBody,
        employee as any,
        {
          planKind: 'pasted',
          sourceFileName: 'maya-session-master-plan'
        }
      );
      const documentTitle = preview.title || 'Maya Master Marketing Plan';
      const createdDocument = await firstValueFrom( this.docService.createDocument( {
        title: documentTitle,
        name: documentTitle,
        type: 'document',
        recordKind: 'document',
        topic: 'Marketing Plan',
        author: this.currentContact?.company?.name || this.directorName,
        summary: 'Master marketing plan created by Maya inside TODD.',
        description: 'This document is the saved source of truth Maya should use for daily planning.',
        htmlContent: this.toHtmlDocument( documentTitle, preview.rawText )
      }, this.userId ) );
      const documentId = String( createdDocument?.id || '' ).trim();
      const documentRoute = documentId ? `/document-editor/${encodeURIComponent( documentId )}` : '';
      const planId = await this.marketingEmployeeService.createMarketingPlan(
        this.tenantId,
        {
          employeeId: this.employeeId,
          employeeType: 'marketing',
          title: preview.title,
          sourceType: 'pasted',
          rawText: preview.rawText,
          extracted: {
            goals: [...( preview.extracted.goals || [] )],
            audiences: [...( preview.extracted.audiences || [] )],
            channels: [...( preview.extracted.channels || [] )],
            campaigns: [...( preview.extracted.campaigns || [] )],
            contentThemes: [...( preview.extracted.themes || [] )],
            kpis: [...( preview.extracted.kpis || [] )],
            timeline: String( preview.extracted.timeline || '' ).trim()
          },
          status: 'active',
          sourceFileName: documentTitle,
          sourceFileUrl: documentRoute || undefined
        }
      );
      const result = await this.marketingEmployeeService.generateDailyMarketingPlanFromPlan(
        this.tenantId,
        this.employeeId,
        {
          id: planId,
          employeeId: this.employeeId,
          employeeType: 'marketing',
          title: preview.title,
          sourceType: 'pasted',
          rawText: preview.rawText,
          extracted: {
            goals: [...( preview.extracted.goals || [] )],
            audiences: [...( preview.extracted.audiences || [] )],
            channels: [...( preview.extracted.channels || [] )],
            campaigns: [...( preview.extracted.campaigns || [] )],
            contentThemes: [...( preview.extracted.themes || [] )],
            kpis: [...( preview.extracted.kpis || [] )],
            timeline: String( preview.extracted.timeline || '' ).trim()
          },
          status: 'active',
          sourceFileName: documentTitle,
          sourceFileUrl: documentRoute || undefined
        },
        null
      );

      this.hasActivePlan = true;
      this.masterPlanSnapshot = {
        id: planId,
        employeeId: this.employeeId,
        employeeType: 'marketing',
        title: documentTitle,
        sourceType: 'pasted',
        rawText: preview.rawText,
        extracted: {
          goals: [...( preview.extracted.goals || [] )],
          audiences: [...( preview.extracted.audiences || [] )],
          channels: [...( preview.extracted.channels || [] )],
          campaigns: [...( preview.extracted.campaigns || [] )],
          contentThemes: [...( preview.extracted.themes || [] )],
          kpis: [...( preview.extracted.kpis || [] )],
          timeline: String( preview.extracted.timeline || '' ).trim()
        },
        status: 'active',
        sourceFileName: documentTitle,
        sourceFileUrl: documentRoute || undefined
      };
      this.messages = [
        ...this.messages,
        this.buildHtmlMessage(
          'director',
          `I saved this as your master marketing plan inside TODD and created ${result.createdIds.length} starting action${result.createdIds.length === 1 ? '' : 's'}.`,
          this.buildMasterPlanSavedHtmlMessage( documentTitle, documentRoute, result.createdIds.length )
        )
      ];
      this.persistSessionMemory();
      await this.appendWorkspaceMessage(
        'employee',
        `I saved this as your master marketing plan inside TODD and created ${result.createdIds.length} starting action${result.createdIds.length === 1 ? '' : 's'}. ${documentRoute ? `Document: ${documentRoute}. ` : ''}Maya will own planning and drafting. TODD will own execution, monitoring, and optimization from here.`
      );
      this.notificationService.show( 'Master Plan Saved', 'Maya saved the master marketing plan and created the opening action set.', 'success' );
      return true;
    } catch ( error ) {
      console.error( '[Maya Session] master plan save failed', error );
      this.notificationService.show( 'Plan Save Failed', 'Maya outlined the plan, but TODD could not save it yet.', 'error' );
      return false;
    }
  }

  private applySessionContext (
    contact: Contact | null,
    hasActivePlan: boolean,
    hasPaidWorkspaceAccess: boolean,
    currentWorkItems: MarketingDirectorMoveContextItem[],
    pendingApprovalItems: MarketingDirectorMoveContextItem[],
    completedWorkItems: MarketingDirectorMoveContextItem[],
    latestOutcome: MarketingEmployeeOutcomeRecord | null,
    tenantId: string,
    userId: string
  ): void {
    this.tenantId = String( tenantId || '' ).trim();
    this.userId = String( userId || '' ).trim();
    this.hasActivePlan = hasActivePlan;
    this.hasPaidWorkspaceAccess = hasPaidWorkspaceAccess;
    this.currentContact = contact;
    this.currentHasPaidWorkspaceAccess = hasPaidWorkspaceAccess;
    this.currentWorkItems = [...( currentWorkItems || [] )];
    this.pendingApprovalItems = [...( pendingApprovalItems || [] )];
    this.completedWorkItems = [...( completedWorkItems || [] )];
    this.latestOutcome = latestOutcome;

    void this.ensureWorkspaceSessionConnection();
    void this.hydrateMasterPlanSnapshot();

    if ( !this.sessionMemoryHydrated ) {
      this.sessionMemoryHydrated = true;
      const restoredMessages = this.hydrateSessionMemory();
      if ( restoredMessages.length > 0 ) {
        this.messages = restoredMessages;
        this.hasUserMessages = restoredMessages.some( message => message.role === 'user' );
        this.showSuggestionTray = !this.hasUserMessages && !String( this.prompt || '' ).trim();
      }
    }

    if ( this.isLoggedInWorkspaceUser ) {
      this.starterPrompts = hasActivePlan
        ? this.buildLoggedInPlanStarterPrompts()
        : this.buildLoggedInSetupStarterPrompts();
      this.composerPlaceholder = hasActivePlan
        ? 'Ask Maya about your current marketing plan, campaign priorities, or what to fix first.'
        : hasPaidWorkspaceAccess
          ? 'Ask Maya to create your initial marketing plan, or paste in the plan you already have so she can analyze it.'
          : 'Ask Maya to create your initial marketing plan, or paste in the plan you already have for analysis.';
    } else {
      this.starterPrompts = this.buildPublicStarterPrompts();
      this.composerPlaceholder = this.buildPublicPlaceholder();
    }

    if ( this.hasUserMessages ) {
      this.persistSessionMemory();
      return;
    }

    const introMessage = this.isLoggedInWorkspaceUser
      ? this.buildLoggedInIntroMessage(
        contact,
        hasActivePlan,
        hasPaidWorkspaceAccess,
        tenantId,
        userId
      )
      : this.buildInitialDirectorMessage();

    this.messages = [introMessage];
    this.persistSessionMemory();
  }

  async resetSession (): Promise<void> {
    this.workspaceConversationMessagesSubscription?.unsubscribe();
    this.workspaceConversationMessagesSubscription = undefined;
    this.workspaceConversationId = '';
    this.workspaceConversationContextKey = '';
    this.messages = [];
    this.prompt = '';
    this.errorMessage = '';
    this.hasUserMessages = false;
    this.showSuggestionTray = true;
    this.clearSessionMemory();

    await this.ensureWorkspaceSessionConnection( true );

    const introMessage = this.isLoggedInWorkspaceUser
      ? this.buildLoggedInIntroMessage(
        this.currentContact,
        this.hasActivePlan,
        this.currentHasPaidWorkspaceAccess,
        this.tenantId,
        this.userId
      )
      : this.buildInitialDirectorMessage();

    this.messages = [introMessage];
    this.persistSessionMemory();
    await this.appendWorkspaceMessage( 'employee', introMessage.content );
    this.notificationService.show( 'Session Reset', 'Maya cleared the planning conversation and started a fresh one.', 'success' );
  }

  private buildInitialDirectorMessage (): PublicMarketingDirectorMessage {
    if ( this.emailContext ) {
      return this.buildMessage(
        'director',
        this.buildEmailContextGreeting( this.emailContext ),
        'director-intro'
      );
    }

    return this.buildMessage(
      'director',
      'I’m Maya. Tell me what you sell, who you want to reach, and what feels stuck in your marketing. I’ll help you figure out what matters first.',
      'director-intro'
    );
  }

  private buildLoggedInIntroMessage (
    contact: Contact | null,
    hasActivePlan: boolean,
    hasPaidWorkspaceAccess: boolean,
    tenantId: string,
    userId: string
  ): PublicMarketingDirectorMessage {
    if ( hasActivePlan ) {
      const introCopy = hasPaidWorkspaceAccess
        ? 'I can see the marketing plan is already moving. If something feels off, I can tell you what I’d tighten, what I’d cut, and what should move today inside TODD.'
        : 'I can see the marketing plan is already moving. Ask me about priorities, messaging, timelines, or paste in updated plan notes if you want a fresh read.';
      const planTitle = String( this.masterPlanSnapshot?.sourceFileName || this.masterPlanSnapshot?.title || 'current marketing plan' ).trim();
      const planRoute = String( this.masterPlanSnapshot?.sourceFileUrl || '' ).trim();

      if ( planRoute ) {
        return this.buildHtmlMessage(
          'director',
          `${introCopy} Saved plan: ${planTitle} (${planRoute})`,
          `${this.renderMessageContent( introCopy )}<br /><br />Saved plan: <a href="${this.escapeHtml( planRoute )}">${this.escapeHtml( planTitle )}</a>`,
          'director-intro'
        );
      }

      return this.buildMessage(
        'director',
        introCopy,
        'director-intro'
      );
    }

    const revisitKey = this.buildRevisitStorageKey( tenantId, userId );
    const hasSeenReminder = this.hasSeenReminder( revisitKey );
    const businessSummary = this.buildBusinessSummary( contact );
    const missionSummary = this.buildMissionSummary( contact );
    const contextSummary = [businessSummary, missionSummary].filter( Boolean ).join( ' ' );
    const intro = hasSeenReminder
      ? 'We did not get a chance to create your initial marketing plan yet.'
      : 'I understand you and the work you are building.';
    const profileLine = contextSummary
      ? ` ${contextSummary}`
      : '';
    const callToAction = hasPaidWorkspaceAccess
      ? hasSeenReminder
        ? ' Do you want me to create it now inside TODD, or paste in the marketing plan you already have so I can analyze it and make recommendations?'
        : ' Would you like me to create your initial marketing plan inside TODD, or paste in the marketing plan you already have so I can analyze it and make recommendations?'
      : hasSeenReminder
        ? ' Do you want me to create it now, or paste in the marketing plan you already have so I can analyze it and make recommendations?'
        : ' Would you like me to create your initial marketing plan, or paste in the marketing plan you already have so I can analyze it and make recommendations?';

    this.markReminderSeen( revisitKey );

    return this.buildMessage( 'director', `${intro}${profileLine}${callToAction}`.trim(), 'director-intro' );
  }

  private buildBusinessSummary ( contact: Contact | null ): string {
    const companyName = String( contact?.company?.name || '' ).trim();
    const companyDescription = String( contact?.company?.description || '' ).trim();
    const jobDescription = String( contact?.jobDescriptionForTODD || '' ).trim();
    const profession = String( contact?.profession || '' ).trim();
    const valueProp = String( contact?.company?.valueProp || '' ).trim();

    if ( companyName && companyDescription ) {
      return `You run ${companyName}, and ${this.ensureSentence( companyDescription )}`;
    }

    if ( jobDescription ) {
      return `I understand your role as ${this.ensureSentenceFragment( jobDescription )}.`;
    }

    if ( profession ) {
      return `I understand that you work in ${this.ensureSentenceFragment( profession )}.`;
    }

    if ( companyName && valueProp ) {
      return `You run ${companyName}, and your offer is ${this.ensureSentenceFragment( valueProp )}.`;
    }

    if ( companyName ) {
      return `You run ${companyName}.`;
    }

    return '';
  }

  private buildMissionSummary ( contact: Contact | null ): string {
    const mission = String( contact?.company?.goal || '' ).trim();
    if ( !mission ) return '';
    return `Your mission right now is ${this.ensureSentenceFragment( mission )}.`;
  }

  private buildPublicStarterPrompts (): string[] {
    return [
      'I have a small budget and need better leads. Where would you focus first?',
      'My message feels too generic. How would you sharpen it?',
      'What campaign would you run first for a service business that needs traction?',
      'How do I know if my offer is clear enough to market well?'
    ];
  }

  private buildLoggedInSetupStarterPrompts (): string[] {
    return [
      'Create my initial marketing plan based on what you already know about my business.',
      'We do not have a real marketing plan yet. Create one now.',
      'I already have a marketing plan. I want to paste it in so you can analyze it.',
      'What should our first campaign be based on my mission?',
      'What are the biggest gaps in my current marketing foundation?'
    ];
  }

  private buildLoggedInPlanStarterPrompts (): string[] {
    return [
      'What should we focus on first in my current marketing plan?',
      'Which campaign priority deserves the most attention this week?',
      'What part of my messaging is most likely slowing conversions?',
      'If I paste in updated plan notes, can you analyze what changed?'
    ];
  }

  private buildPublicPlaceholder (): string {
    return 'Ask Maya about positioning, campaigns, messaging, or what to fix first.';
  }

  private appendExecutionReceiptNotice ( directorReply: string, createdReceipt: boolean ): void {
    if ( createdReceipt ) {
      return;
    }

    const normalizedReply = String( directorReply || '' ).trim();
    const impliesAction =
      /i['’]ll\s+(take care of|handle|draft|create|build|save|set up|put together|work on)/i.test( normalizedReply ) ||
      /i can\s+(draft|create|build|save|set up)\s+that\s+next/i.test( normalizedReply ) ||
      /not saved anywhere yet/i.test( normalizedReply );

    if ( !impliesAction ) {
      return;
    }

    const receiptNote = 'Execution receipt: no document, move, survey, draft, or outreach job was created from that reply yet. When Maya actually creates something, this chat should say exactly what was created and where it landed.';
    this.messages = [
      ...this.messages,
      this.buildMessage( 'director', receiptNote )
    ];
    this.persistSessionMemory();
    void this.appendWorkspaceMessage( 'employee', receiptNote );
  }

  private async executeDirectorSystemActions ( actions: PublicMarketingDirectorSystemAction[] ): Promise<boolean> {
    if ( !this.isLoggedInWorkspaceUser || !this.hasPaidWorkspaceAccess || !this.tenantId || !this.userId || !Array.isArray( actions ) || actions.length === 0 ) {
      return false;
    }

    let createdAnything = false;

    for ( const action of actions ) {
      try {
        switch ( action.type ) {
          case 'create_document':
            createdAnything = await this.executeCreateDocumentAction( action ) || createdAnything;
            break;
          case 'create_move':
            createdAnything = await this.executeCreateMoveAction( action ) || createdAnything;
            break;
          case 'create_survey':
            createdAnything = await this.executeCreateSurveyAction( action ) || createdAnything;
            break;
          case 'create_response_flow':
            createdAnything = await this.executeCreateResponseFlowAction( action ) || createdAnything;
            break;
          case 'send_email':
            createdAnything = await this.executeSendEmailAction( action ) || createdAnything;
            break;
          default:
            break;
        }
      } catch ( error ) {
        const label = this.getActionLabel( action.type );
        const failureMessage = `Execution receipt: Maya tried to create ${label}, but TODD could not finish it automatically.`;
        this.messages = [
          ...this.messages,
          this.buildMessage( 'director', failureMessage )
        ];
        this.persistSessionMemory();
        await this.appendWorkspaceMessage( 'employee', failureMessage );
        console.error( '[Maya Session] system action failed', { action, error } );
      }
    }

    return createdAnything;
  }

  private async executeCreateDocumentAction ( action: PublicMarketingDirectorSystemAction ): Promise<boolean> {
    const title = String( action.title || '' ).trim();
    if ( !title ) return false;

    const created = await firstValueFrom( this.docService.createDocument( {
      title,
      name: title,
      type: 'draft',
      recordKind: 'draft',
      topic: 'Marketing',
      author: this.currentContact?.company?.name || this.directorName,
      summary: String( action.summary || '' ).trim(),
      description: String( action.description || '' ).trim(),
      htmlContent: this.toHtmlDocument( title, String( action.body || action.description || action.summary || '' ).trim() )
    }, this.userId ) );

    const documentId = String( created?.id || '' ).trim();
    if ( !documentId ) return false;

    await this.appendArtifactReceiptMessage(
      'Created document',
      title,
      `/document-editor/${encodeURIComponent( documentId )}`
    );
    await this.recordCompletedExecutionTask( title, `/document-editor/${encodeURIComponent( documentId )}`, action, 'Document created and saved by Maya.' );
    return true;
  }

  private async executeCreateMoveAction ( action: PublicMarketingDirectorSystemAction ): Promise<boolean> {
    const title = String( action.title || '' ).trim();
    if ( !title ) return false;

    const task: Task = {
      title,
      description: this.composeOwnedDescription( action ),
      dueDate: this.resolveTaskDueDate( action.dueDate ),
      progress: 0,
      priority: String( action.priority || 'medium' ).trim() || 'medium',
      status: 'not-started',
      ownerId: this.resolveTaskOwnerId( action ),
      source: 'maya-created-move',
      createdByTodd: true
    };

    const saved = await this.taskService.addTask( task, this.userId );
    const taskId = String( saved?.id || '' ).trim();
    const taskRoute = taskId
      ? `/move?id=${encodeURIComponent( taskId )}`
      : '/moves-view';

    await this.appendArtifactReceiptMessage( 'Created move', title, taskRoute );
    return true;
  }

  private async executeCreateSurveyAction ( action: PublicMarketingDirectorSystemAction ): Promise<boolean> {
    const title = String( action.title || '' ).trim();
    const questions = Array.isArray( action.questions ) ? action.questions.filter( question => String( question?.questionText || '' ).trim() ) : [];
    if ( !title || questions.length === 0 ) return false;

    const survey: Survey = {
      tenantId: this.tenantId,
      ownerId: this.userId,
      title,
      description: String( action.description || action.summary || '' ).trim(),
      status: 'draft',
      visibility: 'private',
      questions: questions.map( ( question, index ) => ( {
        id: `maya-q-${index + 1}`,
        order: index + 1,
        questionText: String( question.questionText || '' ).trim(),
        questionType: String( question.questionType || 'text' ).trim() || 'text',
        options: Array.isArray( question.options ) ? question.options.map( option => String( option || '' ).trim() ).filter( Boolean ) : [],
        required: question.required === true
      } ) )
    };

    const created = await firstValueFrom( this.surveyApiService.createSurvey( survey ) );
    const surveyId = String( created?.id || '' ).trim();
    if ( !surveyId ) return false;

    await this.appendArtifactReceiptMessage( 'Created survey', title, `/survey-view/${encodeURIComponent( surveyId )}` );
    await this.recordCompletedExecutionTask( title, `/survey-view/${encodeURIComponent( surveyId )}`, action, 'Survey created and saved by Maya.' );
    return true;
  }

  private async executeCreateResponseFlowAction ( action: PublicMarketingDirectorSystemAction ): Promise<boolean> {
    const title = String( action.title || '' ).trim();
    const question = String( action.question || '' ).trim();
    const response = String( action.response || action.body || '' ).trim();
    if ( !title || !question || !response ) return false;

    const created = await firstValueFrom( this.responseFlowService.createResponseFlow( {
      name: title,
      title,
      question,
      response,
      answer: response,
      category: String( action.category || 'marketing' ).trim(),
      description: String( action.description || action.summary || '' ).trim(),
      summary: String( action.summary || '' ).trim(),
      keywords: [],
      tags: ['maya', 'marketing'],
      recommendations: [],
      resources: [],
      relatedDocumentIds: []
    } ) );

    const responseFlowId = String( created?.id || '' ).trim();
    if ( !responseFlowId ) return false;

    await this.appendArtifactReceiptMessage(
      'Created response flow',
      title,
      `/response-flow?id=${encodeURIComponent( responseFlowId )}`
    );
    await this.recordCompletedExecutionTask( title, `/response-flow?id=${encodeURIComponent( responseFlowId )}`, action, 'Knowledge response flow created by Maya.' );
    return true;
  }

  private async executeSendEmailAction ( action: PublicMarketingDirectorSystemAction ): Promise<boolean> {
    const to = String( action.to || '' ).trim();
    const subject = String( action.subject || action.title || '' ).trim();
    const text = String( action.text || action.body || action.description || '' ).trim();
    if ( !to || !subject || !text ) return false;

    const fromAddress = this.resolveSenderEmail();
    if ( !fromAddress ) {
      throw new Error( 'No sender identity available for Maya email send.' );
    }

    await firstValueFrom( this.emailService.sendEmail( {
      to,
      subject,
      text,
      html: String( action.html || `<div>${this.escapeHtml( text ).replace( /\n/g, '<br />' )}</div>` ).trim(),
      contactName: to,
      date: new Date().toISOString(),
      from: fromAddress,
      signalOrigin: 'maya',
      sourceSystem: 'maya'
    } as any, this.tenantId, this.userId ) );

    await this.appendReceiptTextMessage( `Execution receipt: sent email to ${to} with subject "${subject}".` );
    await this.recordCompletedExecutionTask( subject, '/signal-engine?tab=sent', action, `Email sent by Maya to ${to}.` );
    return true;
  }

  private async appendArtifactReceiptMessage ( label: string, title: string, route: string ): Promise<void> {
    const safeLabel = this.escapeHtml( label );
    const safeTitle = this.escapeHtml( title );
    const safeRoute = this.escapeHtml( route );
    const receiptHtml = `${safeLabel}: <a href="${safeRoute}">${safeTitle}</a>`;
    const receiptText = `${label}: ${title} (${route})`;
    this.messages = [
      ...this.messages,
      this.buildHtmlMessage( 'director', receiptText, receiptHtml )
    ];
    this.persistSessionMemory();
    await this.appendWorkspaceMessage( 'employee', receiptText );
  }

  private async appendReceiptTextMessage ( content: string ): Promise<void> {
    this.messages = [
      ...this.messages,
      this.buildMessage( 'director', content )
    ];
    this.persistSessionMemory();
    await this.appendWorkspaceMessage( 'employee', content );
  }

  private async recordCompletedExecutionTask (
    title: string,
    route: string,
    action: PublicMarketingDirectorSystemAction,
    completionNote: string
  ): Promise<void> {
    const normalizedTitle = String( title || '' ).trim();
    if ( !normalizedTitle || !this.userId ) {
      return;
    }

    const description = [
      String( action.description || action.summary || '' ).trim(),
      completionNote,
      route ? `Artifact route: ${route}` : ''
    ].filter( Boolean ).join( '\n\n' );

    const completedTask: Task = {
      title: `Maya completed: ${normalizedTitle}`,
      description,
      dueDate: new Date().toISOString(),
      progress: 100,
      priority: String( action.priority || 'medium' ).trim() || 'medium',
      status: 'completed',
      isCompleted: true,
      ownerId: this.resolveTaskOwnerId( action ),
      source: 'maya-artifact-complete',
      createdByTodd: true,
      url: route
    };

    await this.taskService.addTask( completedTask, this.userId );
  }

  private buildDirectorWorkspaceContext (): PublicMarketingDirectorWorkspaceContext | null {
    if ( !this.isLoggedInWorkspaceUser ) {
      // An anonymous visitor still needs emailContext carried on every turn
      // (not just the first canned greeting), so Maya keeps knowing what
      // email this conversation is about as it continues.
      return this.emailContext ? { emailContext: this.emailContext } : null;
    }

    const companyName = String( this.currentContact?.company?.name || '' ).trim();
    const companyDescription = String( this.currentContact?.company?.description || '' ).trim();
    const mission = String( this.currentContact?.company?.goal || '' ).trim();
    const offerSummary = String( this.currentContact?.company?.valueProp || this.currentContact?.jobDescriptionForTODD || '' ).trim();
    const firstName = String( this.currentContact?.firstName || '' ).trim();
    const lastName = String( this.currentContact?.lastName || '' ).trim();
    const operatorName = [firstName, lastName].filter( Boolean ).join( ' ' ).trim();

    return {
      tenantId: this.tenantId,
      companyName,
      companyDescription,
      mission,
      offerSummary,
      operatorName,
      accessModeLabel: this.hasPaidWorkspaceAccess ? 'logged_in_workspace' : 'logged_in_advice',
      hasActivePlan: this.hasActivePlan,
      availableSystems: this.hasPaidWorkspaceAccess
        ? ['Moves', 'Outreach', 'Network', 'Documents', 'Surveys', 'Marketing Employee Workspace']
        : [],
      currentWorkItems: [...this.currentWorkItems],
      pendingApprovalItems: [...this.pendingApprovalItems],
      completedWorkItems: [...this.completedWorkItems],
      recentOutcomeSummary: String( this.latestOutcome?.summary || '' ).trim() || undefined,
      recentOutcomeDetails: String( this.latestOutcome?.details || '' ).trim() || undefined,
      marketingKpis: Array.isArray( this.latestOutcome?.metrics ) ? this.latestOutcome.metrics.slice( 0, 8 ) : [],
      weeklyGoals: Array.isArray( this.latestOutcome?.weeklyGoals ) ? this.latestOutcome.weeklyGoals.slice( 0, 6 ) : [],
      toddHandoff: this.latestOutcome?.handoff || null,
      emailContext: this.emailContext || undefined
    };
  }

  private extractActionSummariesForToday ( actions: MarketingEmployeeActionRecord[] ): MarketingDirectorMoveContextItem[] {
    const today = new Date().toISOString().slice( 0, 10 );
    const dailyPlanActions = ( actions || [] )
      .filter( action => String( action?.origin || '' ).trim().toLowerCase() === 'daily_plan' )
      .filter( action => String( action?.plannedForDate || '' ).trim() === today );

    const source = dailyPlanActions.length > 0 ? dailyPlanActions : ( actions || [] );

    return source
      .map( action => this.toMoveContextItem( action ) )
      .filter( ( item ): item is MarketingDirectorMoveContextItem => !!item )
      .slice( 0, 12 );
  }

  // Keeps only what Maya actually needs to explain a Move honestly - status,
  // progress, why it's blocked (if it is), and for completed items what was
  // delivered and where. Text fields are left undefined (not '') when
  // nothing was actually recorded, so the backend prompt can tell her to say
  // so plainly instead of inventing a reason or a deliverable.
  private toMoveContextItem ( action: MarketingEmployeeActionRecord ): MarketingDirectorMoveContextItem | null {
    const title = String( action?.title || '' ).trim();
    if ( !title ) return null;

    const truncate = ( value: unknown ): string | undefined => {
      const text = String( value || '' ).trim();
      if ( !text ) return undefined;
      return text.length > 240 ? `${text.slice( 0, 240 )}…` : text;
    };

    const isCompleted = String( action?.status || '' ).trim().toLowerCase() === 'completed';
    const isBlocked = !!action?.blocked;
    const latestNote = Array.isArray( action?.notesLog ) && action.notesLog.length > 0
      ? action.notesLog[action.notesLog.length - 1]
      : null;

    return {
      title,
      status: String( action?.status || '' ).trim() || undefined,
      progress: typeof action?.progress === 'number' ? action.progress : undefined,
      blocked: isBlocked,
      blockerNote: isBlocked ? truncate( latestNote?.text ) : undefined,
      deliverableSummary: isCompleted ? truncate( action?.description ) : undefined,
      deliverableUrl: isCompleted ? ( truncate( action?.monitorRoute ) || truncate( action?.monitorLabel ) ) : undefined
    };
  }

  private resolveAccessMode (): PublicMarketingDirectorAccessMode {
    return this.hasPaidWorkspaceAccess ? 'suite' : 'free';
  }

  private buildRevisitStorageKey ( tenantId: string, userId: string ): string {
    return `${this.revisitStoragePrefix}:${tenantId || 'public'}:${userId || 'guest'}`;
  }

  private buildSessionStorageKey (): string {
    if ( this.isLoggedInWorkspaceUser && this.tenantId && this.userId ) {
      return `${this.sessionStoragePrefix}:${this.tenantId}:${this.userId}`;
    }
    return '';
  }

  private persistSessionMemory (): void {
    const storageKey = this.buildSessionStorageKey();
    if ( !storageKey || typeof window === 'undefined' || !window.localStorage ) return;

    try {
      window.localStorage.setItem( storageKey, JSON.stringify( {
        messages: this.messages.slice( -24 ),
        hasUserMessages: this.hasUserMessages
      } ) );
    } catch {
      // Ignore storage failures and keep the live session running.
    }
  }

  private clearSessionMemory (): void {
    const storageKey = this.buildSessionStorageKey();
    if ( !storageKey || typeof window === 'undefined' || !window.localStorage ) return;

    try {
      window.localStorage.removeItem( storageKey );
    } catch {
      // Ignore storage failures and keep the live session running.
    }
  }

  private hydrateSessionMemory (): PublicMarketingDirectorMessage[] {
    const storageKey = this.buildSessionStorageKey();
    if ( !storageKey || typeof window === 'undefined' || !window.localStorage ) return [];

    try {
      const raw = window.localStorage.getItem( storageKey );
      if ( !raw ) return [];

      const payload = JSON.parse( raw ) as {
        messages?: PublicMarketingDirectorMessage[];
        hasUserMessages?: boolean;
      };

      const restoredMessages = Array.isArray( payload?.messages )
        ? payload.messages
          .filter( message => message && ( message.role === 'user' || message.role === 'director' ) )
          .map( message => this.buildMessage(
            message.role,
            String( message.content || '' ).trim(),
            String( message.id || this.buildMessageId( message.role || 'director' ) )
          ) )
          .filter( message => !!message.content )
        : [];

      this.hasUserMessages = payload?.hasUserMessages === true || restoredMessages.some( message => message.role === 'user' );
      return restoredMessages;
    } catch {
      return [];
    }
  }

  private async ensureWorkspaceSessionConnection ( forceNewConversation: boolean = false ): Promise<void> {
    if ( !this.isLoggedInWorkspaceUser || !this.tenantId ) {
      return;
    }

    const contextKey = `${this.tenantId}:${this.employeeId}`;
    if ( !forceNewConversation && this.workspaceConversationContextKey === contextKey && this.workspaceConversationId ) {
      return;
    }

    try {
      if ( forceNewConversation ) {
        this.workspaceConversationId = await this.marketingEmployeeService.createConversation( this.tenantId, {
          employeeId: this.employeeId,
          employeeType: 'marketing',
          title: 'Maya master marketing plan session'
        } );
      } else {
        const conversations = await firstValueFrom(
          this.marketingEmployeeService.watchConversations( this.tenantId, this.employeeId, { limit: 20 } ).pipe(
            take( 1 ),
            catchError( () => of( [] ) )
          )
        );
        const existingConversation = ( conversations || [] ).find( conversation => String( conversation.title || '' ).trim().toLowerCase() === 'maya master marketing plan session' );
        this.workspaceConversationId = existingConversation?.id
          ? String( existingConversation.id ).trim()
          : await this.marketingEmployeeService.createConversation( this.tenantId, {
            employeeId: this.employeeId,
            employeeType: 'marketing',
            title: 'Maya master marketing plan session'
          } );
      }
      this.workspaceConversationContextKey = contextKey;

      this.workspaceConversationMessagesSubscription?.unsubscribe();
      this.workspaceConversationMessagesSubscription = this.marketingEmployeeService.watchConversationMessages(
        this.tenantId,
        this.workspaceConversationId,
        { limit: 200 }
      ).pipe(
        catchError( () => of( [] ) )
      ).subscribe( messages => {
        const restoredMessages = ( messages || [] ).map( message => this.buildMessage(
          message.role === 'user' ? 'user' : 'director',
          String( message.content || '' ).trim(),
          String( message.id || this.buildMessageId( 'director' ) )
        ) ).filter( message => !!message.content );

        if ( restoredMessages.length > 0 ) {
          this.messages = restoredMessages;
          this.hasUserMessages = restoredMessages.some( message => message.role === 'user' );
          this.showSuggestionTray = !this.hasUserMessages && !String( this.prompt || '' ).trim();
          this.persistSessionMemory();
        }
      } );
    } catch {
      // Keep local memory fallback if workspace conversation setup fails.
    }
  }

  private async appendWorkspaceMessage (
    role: 'user' | 'employee',
    content: string
  ): Promise<void> {
    const normalizedContent = String( content || '' ).trim();
    if ( !this.tenantId || !this.workspaceConversationId || !normalizedContent ) {
      return;
    }

    try {
      await this.marketingEmployeeService.appendConversationMessage(
        this.tenantId,
        this.workspaceConversationId,
        {
          conversationId: this.workspaceConversationId,
          role,
          content: normalizedContent,
          relatedActionIds: []
        }
      );
    } catch {
      // Keep the live session moving even if shared persistence fails.
    }
  }

  private hasSeenReminder ( storageKey: string ): boolean {
    if ( typeof window === 'undefined' ) return false;

    try {
      return window.localStorage.getItem( storageKey ) === 'true';
    } catch {
      return false;
    }
  }

  private markReminderSeen ( storageKey: string ): void {
    if ( typeof window === 'undefined' ) return;

    try {
      window.localStorage.setItem( storageKey, 'true' );
    } catch {
      // ignore local storage failures
    }
  }

  private async hydrateMasterPlanSnapshot (): Promise<void> {
    if ( !this.isLoggedInWorkspaceUser || !this.tenantId ) {
      this.masterPlanSnapshot = null;
      return;
    }

    try {
      const plans = await firstValueFrom(
        this.marketingEmployeeService.watchMarketingPlans(
          this.tenantId,
          this.employeeId,
          { status: 'active', limit: 1 }
        ).pipe(
          take( 1 ),
          catchError( () => of( [] as MarketingPlanRecord[] ) )
        )
      );
      this.masterPlanSnapshot = Array.isArray( plans ) && plans.length > 0 ? plans[0] : null;
    } catch {
      this.masterPlanSnapshot = null;
    }
  }

  private buildMasterPlanSavedHtmlMessage ( title: string, route: string, createdCount: number ): string {
    const safeTitle = this.escapeHtml( title );
    const safeRoute = this.escapeHtml( route );
    const safeCount = this.escapeHtml( String( createdCount ) );
    const documentLine = route
      ? `Saved plan: <a href="${safeRoute}">${safeTitle}</a><br /><br />`
      : '';

    return `${documentLine}I saved this as your master marketing plan inside TODD and created ${safeCount} starting action${createdCount === 1 ? '' : 's'}.<br /><br />Maya owns planning and drafting. TODD owns execution, monitoring, and optimization from here.`;
  }

  private ensureSentence ( value: string ): string {
    const trimmedValue = String( value || '' ).trim();
    if ( !trimmedValue ) return '';
    return /[.!?]$/.test( trimmedValue ) ? trimmedValue : `${trimmedValue}.`;
  }

  private ensureSentenceFragment ( value: string ): string {
    return String( value || '' ).trim().replace( /[.!?]+$/, '' );
  }

  private buildMessageId ( prefix: string ): string {
    return `${prefix}-${Date.now()}-${Math.random().toString( 36 ).slice( 2, 8 )}`;
  }

  private buildMessage (
    role: PublicMarketingDirectorMessage['role'],
    content: string,
    id: string = this.buildMessageId( role )
  ): PublicMarketingDirectorMessage {
    const normalizedContent = String( content || '' ).trim();
    return {
      id,
      role,
      content: normalizedContent,
      renderedContent: this.renderMessageContent( normalizedContent )
    };
  }

  private buildHtmlMessage (
    role: PublicMarketingDirectorMessage['role'],
    content: string,
    renderedContent: string,
    id: string = this.buildMessageId( role )
  ): PublicMarketingDirectorMessage {
    return {
      id,
      role,
      content: String( content || '' ).trim(),
      renderedContent: String( renderedContent || '' ).trim()
    };
  }

  private renderMessageContent ( content: string ): string {
    const escaped = String( content || '' )
      .replace( /&/g, '&amp;' )
      .replace( /</g, '&lt;' )
      .replace( />/g, '&gt;' );

    const rendered = escaped
      .replace( /^#{1,6}\s*(.+)$/gm, '<div class="marketing-director-session__md-heading">$1</div>' )
      .replace( /^\s*(\d+)\.\s+(.+)$/gm, '<div class="marketing-director-session__md-bullet"><strong>$1.</strong> $2</div>' )
      .replace( /^\s*[-•]\s+(.+)$/gm, '<div class="marketing-director-session__md-bullet">&bull; $1</div>' )
      .replace( /\*\*(.+?)\*\*/g, '<strong>$1</strong>' )
      .replace( /\n/g, '<br />' );

    const linkedRoutes = this.assistantBoxUtilityService.linkifySlashRoutes( rendered );

    return linkedRoutes.replace(
      /(Created (?:document|move|survey|response flow):\s*)([^<(]+?)\s*\((\/[A-Za-z0-9\-._~!$&'()*+,;=:@?/%#]+)\)/g,
      ( _match, prefix, title, route ) => `${prefix}<a href="${route}">${title.trim()}</a>`
    );
  }

  private escapeHtml ( value: string ): string {
    return String( value || '' )
      .replace( /&/g, '&amp;' )
      .replace( /</g, '&lt;' )
      .replace( />/g, '&gt;' )
      .replace( /"/g, '&quot;' )
      .replace( /'/g, '&#39;' );
  }

  private toHtmlDocument ( title: string, body: string ): string {
    const safeTitle = this.escapeHtml( title );
    const safeBody = this.renderDocumentBodyHtml( body );
    return `<h1>${safeTitle}</h1>${safeBody}`;
  }

  private renderDocumentBodyHtml ( body: string ): string {
    const normalizedBody = String( body || '' ).replace( /\r/g, '' ).trim();
    if ( !normalizedBody ) {
      return '<p></p>';
    }

    const paragraphs = normalizedBody
      .split( /\n{2,}/ )
      .map( section => section.trim() )
      .filter( Boolean );

    return paragraphs.map( paragraph => {
      const lines = paragraph
        .split( '\n' )
        .map( line => line.trim() )
        .filter( Boolean );

      const htmlLines = lines.map( line => {
        const numberedMatch = line.match( /^(\d+)\.\s+(.+)$/ );
        if ( numberedMatch ) {
          return `<p><strong>${this.escapeHtml( numberedMatch[1] )}.</strong> ${this.renderInlineDocumentMarkup( numberedMatch[2] )}</p>`;
        }

        const bulletMatch = line.match( /^[-•]\s+(.+)$/ );
        if ( bulletMatch ) {
          return `<p>&bull; ${this.renderInlineDocumentMarkup( bulletMatch[1] )}</p>`;
        }

        return `<p>${this.renderInlineDocumentMarkup( line )}</p>`;
      } );

      return htmlLines.join( '' );
    } ).join( '' );
  }

  private renderInlineDocumentMarkup ( value: string ): string {
    return this.escapeHtml( value || '' )
      .replace( /\*\*(.+?)\*\*/g, '<strong>$1</strong>' );
  }

  private resolveTaskDueDate ( dueDate: string | null | undefined ): string {
    const normalized = String( dueDate || '' ).trim();
    if ( normalized ) {
      return normalized;
    }

    const fallback = new Date();
    fallback.setDate( fallback.getDate() + 7 );
    return fallback.toISOString().split( 'T' )[0];
  }

  private composeOwnedDescription ( action: PublicMarketingDirectorSystemAction ): string {
    const description = String( action.description || '' ).trim();
    const ownerLabel = String( action.ownerLabel || '' ).trim();
    if ( description && ownerLabel ) {
      return `${description}\n\nOwner: ${ownerLabel}`;
    }
    return description || ( ownerLabel ? `Owner: ${ownerLabel}` : '' );
  }

  private resolveTaskOwnerId ( action: PublicMarketingDirectorSystemAction ): string {
    const normalizedOwnerLabel = String( action.ownerLabel || '' ).trim().toLowerCase();
    if ( normalizedOwnerLabel.includes( 'todd' ) ) {
      return 'todd';
    }
    if ( normalizedOwnerLabel.includes( 'maya' ) || normalizedOwnerLabel.includes( 'marketing' ) ) {
      return 'maya';
    }
    return 'maya';
  }

  private resolveSenderEmail (): string {
    const directEmail = String( this.currentContact?.email || '' ).trim();
    if ( directEmail ) {
      return directEmail;
    }

    const primaryEmailAddress = String( this.currentContact?.emailAddresses?.[0]?.emailAddress || '' ).trim();
    return primaryEmailAddress;
  }

  private getActionLabel ( type: PublicMarketingDirectorSystemAction['type'] ): string {
    switch ( type ) {
      case 'create_document':
        return 'a document';
      case 'create_move':
        return 'a move';
      case 'create_survey':
        return 'a survey';
      case 'create_response_flow':
        return 'a response flow';
      case 'send_email':
        return 'an email send';
      default:
        return 'an artifact';
    }
  }

  private scrollLatestUserMessageIntoView (): void {
    setTimeout( () => {
      const items = this.messageItems?.toArray() || [];
      const latestUserMessage = [...items].reverse().find(
        item => item.nativeElement.dataset['role'] === 'user'
      );

      latestUserMessage?.nativeElement.scrollIntoView( {
        behavior: 'smooth',
        block: 'start'
      } );
    }, 0 );
  }
}
