import { Injectable } from '@angular/core';
import { Subscription } from 'rxjs';

// Lightweight result/intent types to avoid coupling to component internals
export type AssistantIntentResult = {
    handled: boolean;
    responseHtml?: string;
    pendingAction?: { action: string; param: any; } | null;
    route?: string | null;
    assistantResponse?: string;
    inlineReply?: any;
    showConfirmPrompt?: boolean;
};

export interface AssistantEnginePatches {
    setLoading: ( v: boolean ) => void;
    patchState: ( p: Partial<{
        assistantResponse: string;
        pendingAction: { action: string; param: any; } | null;
        inlineReply: any | null;
        showConfirmPrompt: boolean;
    }> ) => void;
    setAssistantPrompt: ( v: string ) => void;
    setAssistantResponse: ( v: string ) => void;
    setPendingAction: ( v: { action: string; param: any; } | null ) => void;
    setInlineReply: ( v: any | null ) => void;
    setShowConfirmPrompt: ( v: boolean ) => void;
    enforceExternalModeUiGuards: () => void;
}

export interface AssistantEngineIO {
    // History and messaging
    pushLocalHistory: ( role: 'user' | 'assistant', content: string ) => void;
    emitMessage: ( role: 'user' | 'assistant', content: string ) => void;
    persistHistory: () => void;
    scheduleScrollToBottom: ( force?: boolean ) => void;
    scrollHistoryToBottom: ( delay?: boolean ) => void;
    clearSuggestions: () => void;
}

export interface AssistantEngineContext {
    rawPrompt: string;
    userId: string | null | undefined;
    externalMode: boolean;
    parentOwnsHistory: boolean;
    landingIntakeMode: boolean;
    isDemoRunning: boolean;
    tasksCount: number;
}

export interface AssistantEngineHelpers {
    // Routing and heuristics
    tryDirectNavCommand: ( prompt: string ) => boolean;
    runGlobalPreChecks: ( prompt: string ) => boolean;
    handleKnowledgeIntents: ( prompt: string ) => boolean;
    tryContactFilterLocalIntent: ( prompt: string ) => AssistantIntentResult | null;
    contactLocalDeep: ( prompt: string ) => Promise<AssistantIntentResult | null>;
    routeDomain: ( prompt: string ) => 'task' | 'document' | 'survey' | 'contact' | null;

    // Domain handlers
    handleTaskIntents: ( prompt: string ) => Promise<boolean>;
    handleDocumentIntents: ( prompt: string ) => Promise<boolean>;
    handleSurveyIntents: ( prompt: string ) => Promise<boolean>;
    handleContactLLMIntent: ( prompt: string ) => void;

    // Misc helpers
    buildUiHint: () => string;
    withUserContext: ( prompt: string ) => string;
    onSystemTrouble: ( prompt: string ) => boolean; // returns true if handled
    onStartEmailCampaignFlow: () => void;
    onHandleCampaignStepIfAny: ( input: string ) => boolean; // returns true if handled
    handleNoTasksPriorityIntent: () => void;
    runInlineTaskAnalysis: ( force?: boolean ) => void;

    // Subscriptions lifecycle
    cancelInFlight: () => void; // should unsubscribe existing request/openAI subs
    replaceRequestSubscription: ( s: Subscription | null ) => void;
    replaceOpenAISubscription: ( s: Subscription | null ) => void;

    // General LLM fallback
    runGeneralLLM: ( args: {
        promptForLLM: string;
        lastUserPrompt: string;
        patchState: AssistantEnginePatches['patchState'];
        setLoading: AssistantEnginePatches['setLoading'];
        emitAssistant: ( html: string ) => void;
        onError: ( err: any ) => void;
    } ) => Subscription;
    formatAssistantError?: ( err: any, area?: string ) => string;
}

@Injectable( { providedIn: 'root' } )
export class AssistantEngineService {
    constructor () { }

    async run (
        ctx: AssistantEngineContext,
        patches: AssistantEnginePatches,
        io: AssistantEngineIO,
        helpers: AssistantEngineHelpers
    ): Promise<void> {
        const rawClean = ( ctx.rawPrompt || '' ).trim();

        // Prevent duplicate sends and obvious no-ops
        helpers.cancelInFlight();
        if ( !rawClean || ctx.isDemoRunning ) return;

        // Hide typeahead suggestions immediately when sending a prompt
        io.clearSuggestions();

        // Direct nav commands (terminal-style), no LLM
        if ( helpers.tryDirectNavCommand( rawClean ) ) {
            patches.setAssistantPrompt( '' );
            if ( ctx.externalMode ) io.scrollHistoryToBottom( true );
            return;
        }

        // Global FAQ/local pre-checks
        if ( helpers.runGlobalPreChecks( rawClean ) ) {
            patches.setAssistantPrompt( '' );
            if ( ctx.externalMode ) io.scrollHistoryToBottom( true );
            return;
        }

        // Knowledge processor intents
        if ( helpers.handleKnowledgeIntents( rawClean ) ) {
            patches.setAssistantPrompt( '' );
            io.scheduleScrollToBottom( true );
            return;
        }

        // Contact filter local intent (no LLM)
        const filterLocal = helpers.tryContactFilterLocalIntent( rawClean );
        if ( filterLocal && filterLocal.handled ) {
            if ( filterLocal.responseHtml ) {
                patches.setAssistantResponse( filterLocal.responseHtml );
                io.emitMessage( 'assistant', filterLocal.responseHtml );
                io.scheduleScrollToBottom( true );
            }
            return;
        }

        // Contact local deep (summary/QA/lookup)
        const contactLocalDeep = await helpers.contactLocalDeep( rawClean );
        if ( contactLocalDeep && contactLocalDeep.handled ) {
            patches.setAssistantPrompt( '' );
            if ( contactLocalDeep.assistantResponse || contactLocalDeep.responseHtml ) {
                const html = contactLocalDeep.assistantResponse || contactLocalDeep.responseHtml || '';
                patches.setAssistantResponse( html );
                io.emitMessage( 'assistant', html );
                io.scheduleScrollToBottom( true );
            }
            patches.patchState( {
                pendingAction: contactLocalDeep.pendingAction ?? null,
                inlineReply: contactLocalDeep.inlineReply ?? null,
                showConfirmPrompt: !!contactLocalDeep.showConfirmPrompt,
            } );
            patches.enforceExternalModeUiGuards();
            return;
        }

        // Priority/Today/Tasks prompt detection
        const lower = rawClean.toLowerCase();
        const wantsPriority = /(priority|priorities)/.test( lower ) || /what.*(should|do).*today/.test( lower );
        const mentionsTasks = /(task|tasks|to[-\s]?do)/.test( lower ) || lower.includes( 'my day' );

        if ( wantsPriority || mentionsTasks ) {
            patches.setAssistantPrompt( '' );
            io.scheduleScrollToBottom( true );

            if ( !ctx.tasksCount ) {
                helpers.handleNoTasksPriorityIntent();
            } else {
                helpers.runInlineTaskAnalysis( false );
            }
            return;
        }

        // Domain routing
        const domain = helpers.routeDomain( rawClean );
        if ( domain ) {
            patches.setAssistantPrompt( '' );
            io.scheduleScrollToBottom( true );
            if ( domain === 'task' ) {
                await helpers.handleTaskIntents( rawClean );
            } else if ( domain === 'document' ) {
                await helpers.handleDocumentIntents( rawClean );
            } else if ( domain === 'survey' ) {
                await helpers.handleSurveyIntents( rawClean );
            } else if ( domain === 'contact' ) {
                helpers.handleContactLLMIntent( rawClean );
            }
            return;
        }

        // System trouble path (troubleshooting UX)
        if ( helpers.onSystemTrouble( rawClean ) ) {
            io.scheduleScrollToBottom( true );
            return;
        }

        // Multi-step campaign flow intercepts
        if ( rawClean.toLowerCase().includes( 'email campaign' ) ) {
            helpers.onStartEmailCampaignFlow();
            return;
        }
        if ( helpers.onHandleCampaignStepIfAny( rawClean ) ) {
            return;
        }

        // General LLM fallback
        patches.setLoading( true );
        patches.setAssistantResponse( '' );

        const uiCue = /\b(icon|icons|menu|navbar|nav|screen|page|homepage|home page|home)\b|todd[- ]assistance|start[- ]page|what\s+does\s+.*\s+icon/i;
        const isUiQuestion = uiCue.test( rawClean );
        const basePromptForLLM = isUiQuestion
            ? `${rawClean}\n\n[ui-hint]\n${helpers.buildUiHint()}`
            : rawClean;
        const promptForLLM = helpers.withUserContext( basePromptForLLM );

        const sub = helpers.runGeneralLLM( {
            promptForLLM,
            lastUserPrompt: rawClean,
            patchState: patches.patchState,
            setLoading: patches.setLoading,
            emitAssistant: ( html ) => io.emitMessage( 'assistant', html ),
            onError: ( err ) => {
                patches.setLoading( false );
                helpers.replaceRequestSubscription( null );
                helpers.replaceOpenAISubscription( null );
                const message = helpers.formatAssistantError?.( err, 'general' )
                    || `<div class="assistant-nudge">Sorry, I'm having trouble understanding that.</div>`;
                io.emitMessage( 'assistant', message );
            },
        } );
        helpers.replaceRequestSubscription( sub );

        patches.setAssistantPrompt( '' );
    }
}
