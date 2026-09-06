import { Injectable } from '@angular/core';
import { EmailSentAssistantService } from './email-sent-assistant.service';
import { AssistantHeuristicsService } from './assistant-heuristics.service';

@Injectable( { providedIn: 'root' } )
export class AssistantIntentRunnerService {
    constructor (
        private emailSentAssistant: EmailSentAssistantService,
        private heuristics: AssistantHeuristicsService,
    ) { }

    isKnowledgeTopicQuestion ( prompt: string ): boolean {
        const p = ( prompt || '' ).trim();
        if ( !p ) return false;

        // Exclude explicit create/draft commands for non-knowledge flows
        if ( /\b(create|draft|write|make)\b\s+(a\s+)?(task|project|survey|document|doc|one[-\s]?pager|email|campaign)\b/i.test( p ) ) {
            return false;
        }

        // Topic-question starters
        if ( /^\s*(what\s+is|define|explain|how\s+do\s+i|how\s+does|why\s+does|best\s+way\s+to|best\s+practices\s+for|steps\s+to)\b/i.test( p ) ) {
            return true;
        }

        // Ends with ? and not clearly an action command
        if ( p.endsWith( '?' ) && !/(open|show|navigate|go\s+to|filter|find\s+contacts|add\s+contact|update\s+contact)\b/i.test( p ) ) {
            return true;
        }

        return false;
    }

    /**
     * Decide whether to short-circuit with an early intercept action.
     * Returns one of:
     * - 'next-move' (momentum guidance)
     * - 'composer-draft' (compose/update email on Email Composer page)
     * - 'catalyst-draft' (compose/update email on Catalyst page)
     * - 'email-sent' (analyze email-sent page)
     * - null (no early intercept)
     */
    decideEarlyIntercept ( prompt: string, opts: { isOnCatalystPage: boolean; isOnComposerPage?: boolean; hasEmailSentContext: boolean; } ): 'next-move' | 'composer-draft' | 'catalyst-draft' | 'email-sent' | null {
        const raw = ( prompt || '' ).trim();
        if ( !raw ) return null;

        if ( this.heuristics.isNextStepQuestion( raw ) || this.heuristics.isQuickGuidancePill( raw ) ) {
            return 'next-move';
        }

        if ( opts?.isOnComposerPage && this.isCatalystEmailDraftIntent( raw ) ) {
            return 'composer-draft';
        }

        if ( opts?.isOnCatalystPage && this.isCatalystEmailDraftIntent( raw ) ) {
            return 'catalyst-draft';
        }

        if ( opts?.hasEmailSentContext && this.emailSentAssistant.isAnalysisIntent( raw ) ) {
            return 'email-sent';
        }

        return null;
    }

    /** Determine primary domain for general prompts (task, document, survey, contact). */
    routeDomain ( prompt: string ): 'task' | 'document' | 'survey' | 'contact' | null {
        const p = ( prompt || '' ).trim();
        if ( !p ) return null;
        const lower = p.toLowerCase();

        if ( /(project|task|todo|to-do|due|deadline|assign)/.test( lower ) ) return 'task';
        if ( /(doc|document|one[-\s]?pager|letter|proposal)/.test( lower ) ) return 'document';
        if ( /(survey|poll|questionnaire|nps|csat)/.test( lower ) ) return 'survey';
        if ( /(\bcontact\b|\bcontacts\b|lead|leads|pipeline|prospect|phone|email|title|company|tag|category)/.test( lower ) ) return 'contact';

        return null;
    }

    /** Copied from the component: intent detection for Catalyst email draft/edit */
    private isCatalystEmailDraftIntent ( prompt: string ): boolean {
        const p = String( prompt || '' ).toLowerCase().trim();
        if ( !p ) return false;

        const hasEmailNoun = /(\bemail|outreach|follow-up|follow up|message|reply)\b/.test( p );
        const hasDraftVerb = /(\bwrite|draft|rewrite|redo|improve|tighten|shorten|soften|strengthen|fix|change|edit|compose|create|help)\b/.test( p );
        const hasEmailAdviceIntent = /(\bwhat should i say\b|\bwhat to say\b|\bany ideas\b|\bnot sure what to say\b|\bdon'?t know what to say\b|\bbased on (the )?currently selected contact\b|\bcurrently selected contact\b)/.test( p );
        const directEmailTarget = /\bemail to\b|\boutreach to\b|\breply to\b|\bfollow up with\b/.test( p );
        const templateIntent = /\bapply\b.*\btemplate\b|\buse this\b|\bmake this email\b/.test( p );
        const fieldEditIntent = /\bsubject\b|\bbody\b/.test( p );

        return (
            ( hasEmailNoun && ( hasDraftVerb || hasEmailAdviceIntent ) ) ||
            directEmailTarget ||
            templateIntent ||
            fieldEditIntent
        );
    }
}
