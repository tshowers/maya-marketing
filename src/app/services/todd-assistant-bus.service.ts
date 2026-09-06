import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { CatalystAssistantContext } from '../features/email/components/emailer/emailer.component';
import { EmailSentAssistantContext } from '../features/email/components/email-sent/email-sent.component';
import { Contact } from '../shared/data/interfaces/contact.model';
import { ToddGuestPreviewService } from './todd-guest-preview.service';

export interface AssistantPageContext {
  feature: string;
  page: string;
  route?: string;
  mode?: 'view' | 'create' | 'edit' | 'list' | 'search' | 'dashboard';
  title?: string;
  description?: string;
  allowedActions?: string[];
  selectedEntityType?: string;
  selectedEntityId?: string;
  summary?: Record<string, any>;
  dataPreview?: Record<string, any>;
  composerContext?: Record<string, any>;
}

export interface AssistantDraftPayload {
  subject?: string;
  html?: string;
  body?: string;
}

export interface AssistantComposerContactPayload {
  contact: Contact;
  source?: string;
}

export interface AssistantActivityEvent {
  feature: string;
  page: string;
  action: string;
  route?: string;
  mode?: 'view' | 'create' | 'edit' | 'list' | 'search' | 'dashboard';
  summary?: Record<string, any>;
  meta?: Record<string, any>;
  timestamp?: number;
}

export type ToddUserMaturityStage =
  | 'visitor'
  | 'signed_up'
  | 'imported_contacts'
  | 'mapped_csv'
  | 'completed_import'
  | 'sent_first_email'
  | 'created_campaign'
  | 'received_engagement'
  | 'established_momentum';

export type ToddInterventionType =
  | 'onboarding_help'
  | 'next_best_action'
  | 'stuck_user_help'
  | 'feature_discovery'
  | 'upgrade_offer'
  | 'product_recommendation'
  | 'landing_recommendation'
  | 'cross_sell_recommendation'
  | 'coaching_tip'
  | 'celebration'
  | 'return_to_workflow'
  | 'campaign_followup_prompt';

export type ToddEngagementAudience =
  | 'visitor'
  | 'trial_or_eval'
  | 'single_module_paid'
  | 'suite_paid'
  | 'enterprise_paid';

export type ToddEngagementDismissCategory =
  | 'session'
  | 'growth'
  | 'activation'
  | 'landing';

export interface ToddEngagementDecision {
  interventionId: string;
  shouldOpenAssistant: boolean;
  priority: number;
  type: ToddInterventionType;
  title: string;
  message: string;
  maturityStage: ToddUserMaturityStage;
  reasonCodes?: string[];
  primaryActionLabel?: string;
  primaryAction?: string;
  primaryActionPayload?: Record<string, any>;
  secondaryActionLabel?: string;
  secondaryAction?: string;
  secondaryActionPayload?: Record<string, any>;
  actionOptions?: ToddEngagementActionOption[];
  imageUrl?: string;
  imageAlt?: string;
  offerKey?: string;
  audience?: ToddEngagementAudience;
  dismissCategory?: ToddEngagementDismissCategory;
  ctaRoute?: string;
  mode?: 'default' | 'guest_preview';
}

export interface ToddEngagementActionOption {
  label: string;
  action: string;
  payload?: Record<string, any>;
}

export interface ToddEngagementActionRequest {
  interventionId: string;
  action: string;
  payload?: Record<string, any>;
  source: 'primary' | 'secondary';
}

export type ToddSignalState = 'idle' | 'listening' | 'thinking' | 'ready';

export type ToddAssistantTranscriptMsg = {
  role: 'user' | 'assistant';
  content: string;
  mode?: 'default' | 'guest_preview';
};

export type ToddLandingPersonalizationPayload = {
  profile: any;
  overrides: any;
};

@Injectable( {
  providedIn: 'root'
} )
export class ToddAssistantBusService {

  constructor (
    private readonly toddGuestPreviewService: ToddGuestPreviewService = new ToddGuestPreviewService()
  ) { }

  // UI state (single source of truth)
  private _showAssistant$ = new BehaviorSubject<boolean>( false );
  showAssistant$ = this._showAssistant$.asObservable();

  private _landingIntakeMode$ = new BehaviorSubject<boolean>( false );
  landingIntakeMode$ = this._landingIntakeMode$.asObservable();

  private _hasUnreadAssistantResponse$ = new BehaviorSubject<boolean>( false );
  hasUnreadAssistantResponse$ = this._hasUnreadAssistantResponse$.asObservable();

  private _signalState$ = new BehaviorSubject<ToddSignalState>( 'idle' );
  signalState$ = this._signalState$.asObservable();

  // Optional: let pages push “events” into the assistant if you need it later
  private _transcriptIn$ = new Subject<ToddAssistantTranscriptMsg>();
  transcriptIn$ = this._transcriptIn$.asObservable();

  private _assistantActivity$ = new Subject<AssistantActivityEvent>();
  assistantActivity$ = this._assistantActivity$.asObservable();

  private _engagementDecision$ = new BehaviorSubject<ToddEngagementDecision | null>( null );
  engagementDecision$ = this._engagementDecision$.asObservable();

  private _engagementActionRequest$ = new Subject<ToddEngagementActionRequest>();
  engagementActionRequest$ = this._engagementActionRequest$.asObservable();

  private _engagementDismissed$ = new Subject<string>();
  engagementDismissed$ = this._engagementDismissed$.asObservable();

  // Bubble important events back OUT to pages (landing page needs these)
  private _landingPersonalization$ = new Subject<ToddLandingPersonalizationPayload>();
  landingPersonalization$ = this._landingPersonalization$.asObservable();

  private _conversationEnded$ = new Subject<void>();
  conversationEnded$ = this._conversationEnded$.asObservable();

  // --- Commands landing page can call ---

  openAssistant () {
    this._landingIntakeMode$.next( false );
    this._hasUnreadAssistantResponse$.next( false );
    this._signalState$.next( 'idle' );
    this._showAssistant$.next( true );
  }

  startTailorFlow () {
    this._landingIntakeMode$.next( true );
    this._signalState$.next( 'listening' );
    this._showAssistant$.next( true );
  }

  closeAssistant () {
    this._showAssistant$.next( false );
    this._landingIntakeMode$.next( false );
    this._signalState$.next( 'idle' );
    this._conversationEnded$.next();
  }

  // --- Hooks for TODD assistant component to call ---

  emitLandingPersonalization ( payload: ToddLandingPersonalizationPayload ) {
    this._landingPersonalization$.next( payload );
  }

  emitConversationEnded () {
    this._conversationEnded$.next();
  }

  // Optional (future): allow pages to inject transcript messages
  pushTranscript ( msg: ToddAssistantTranscriptMsg ) {
    this._transcriptIn$.next(
      this.toddGuestPreviewService.normalizeTranscriptMessage( msg, this.getPageContextSnapshot() )
    );
  }

  emitAssistantActivity ( activity: AssistantActivityEvent ): void {
    this._assistantActivity$.next( {
      ...activity,
      timestamp: activity.timestamp ?? Date.now()
    } );
  }

  markAssistantUnread (): void {
    this._hasUnreadAssistantResponse$.next( true );
  }

  clearAssistantUnread (): void {
    this._hasUnreadAssistantResponse$.next( false );
  }

  publishEngagementDecision ( decision: ToddEngagementDecision | null ): void {
    this._engagementDecision$.next(
      this.toddGuestPreviewService.normalizeEngagementDecision( decision, this.getPageContextSnapshot() )
    );
  }

  getEngagementDecisionSnapshot (): ToddEngagementDecision | null {
    return this._engagementDecision$.value;
  }

  clearEngagementDecision (): void {
    this._engagementDecision$.next( null );
  }

  requestEngagementAction ( request: ToddEngagementActionRequest ): void {
    this._engagementActionRequest$.next( request );
  }

  dismissEngagementDecision ( interventionId: string ): void {
    if ( !interventionId ) {
      return;
    }

    const currentDecision = this._engagementDecision$.value;
    if ( currentDecision?.interventionId === interventionId ) {
      this._engagementDecision$.next( null );
    }
    this._engagementDismissed$.next( interventionId );
  }

  setSignalState ( state: ToddSignalState ): void {
    this._signalState$.next( state );
  }

  setSignalIdle (): void {
    this._signalState$.next( 'idle' );
  }

  setSignalListening (): void {
    this._signalState$.next( 'listening' );
  }

  setSignalThinking (): void {
    this._signalState$.next( 'thinking' );
  }

  setSignalReady (): void {
    this._signalState$.next( 'ready' );
  }

  private assistantPageContextSubject = new BehaviorSubject<CatalystAssistantContext | EmailSentAssistantContext | null>( null );
  assistantPageContext$ = this.assistantPageContextSubject.asObservable();

  private pageContextSubject = new BehaviorSubject<AssistantPageContext | null>( null );
  pageContext$ = this.pageContextSubject.asObservable();

  private assistantDraftApplySubject = new Subject<AssistantDraftPayload>();
  assistantDraftApply$ = this.assistantDraftApplySubject.asObservable();

  private assistantComposerContactApplySubject = new Subject<AssistantComposerContactPayload>();
  assistantComposerContactApply$ = this.assistantComposerContactApplySubject.asObservable();

  setAssistantPageContext ( ctx: CatalystAssistantContext | EmailSentAssistantContext | null ): void {
    this.assistantPageContextSubject.next( ctx );
  }

  setPageContext ( ctx: AssistantPageContext | null ): void {
    this.pageContextSubject.next( ctx );
  }

  getPageContextSnapshot (): AssistantPageContext | null {
    return this.pageContextSubject.value;
  }

  requestAssistantDraftApply ( payload: AssistantDraftPayload ): void {
    this.assistantDraftApplySubject.next( payload );
  }

  requestAssistantComposerContactApply ( payload: AssistantComposerContactPayload ): void {
    this.assistantComposerContactApplySubject.next( payload );
  }

  clearPageContext (): void {
    this.pageContextSubject.next( null );
  }
}
