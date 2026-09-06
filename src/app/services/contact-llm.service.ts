import { Injectable } from '@angular/core';
import { Subscription } from 'rxjs';

import { OpenAIService } from './open-ai.service';
import { AssistantBoxHelperService } from './assistant-box-helper.service';
import { LoggerService } from './logger.service';
import { AssistantUiPatch, AssistantMessage } from './types/assistant.types';

export type RunContactArgs = {
  promptWithContext: string;
  userId: string;
  history: AssistantMessage[];
  selectedContact?: any | null;

  setLoading: ( v: boolean ) => void;
  patchState: ( patch: AssistantUiPatch ) => void;
  emitAssistant?: ( assistantHtml: string ) => void; // used only for plain-text answers
  onError: ( err: any ) => void;
};

@Injectable( { providedIn: 'root' } )
export class ContactLLMService {
  constructor (
    private openAIService: OpenAIService,
    private assistantBoxHelper: AssistantBoxHelperService,
    private logger: LoggerService
  ) { }

  /**
   * Runs the Contact LLM call and reports UI updates back to the component.
   * Preserves your current behavior:
   * - route-only => show CTA (no auto-nav)
   * - route + param object => inline Apply (no confirm bar)
   * - action => confirm bar
   * - plain text => emit assistant message
   */
  run ( args: RunContactArgs ): Subscription {
    const {
      promptWithContext,
      userId,
      history,
      selectedContact,
      setLoading,
      patchState,
      onError
    } = args;

    setLoading( true );
    patchState( { assistantResponse: '', pendingAction: null, inlineReply: null, showConfirmPrompt: false } );

    const context = selectedContact ? { contacts: [selectedContact] } : null;
    const data = { ...( context || {} ), history };

    return this.openAIService.getContactAssistantResponse?.( promptWithContext, userId, data )?.subscribe( {
      next: ( res: any ) => {
        setLoading( false );
        const content: any = res?.parsedQuery ?? res ?? {};

        // Route-only (no action) → show CTA button
        if ( content.route && !content.action ) {
          const [path, fragment] = String( content.route ).split( '#' );
          const routeStr = fragment ? `${path}#${fragment}` : path;

          if ( content.param && typeof content.param === 'object' ) {
            // Prefer inline Apply that carries filters via state+query
            const inlineReply = {
              kind: 'navigateWithFilters',
              payload: content.param,
              apply: { route: routeStr, param: content.param }
            };

            const html = this.assistantBoxHelper.normalizeAssistantHtml(
              this.assistantBoxHelper.convertMarkdownToHtml(
                this.assistantBoxHelper.parseAssistantResponse( content )
              )
            ) || 'Open the filtered contact list?';

            patchState( { inlineReply, assistantResponse: html, showConfirmPrompt: false, pendingAction: null } );
            return;
          }

          // Legacy: no filters provided → simple navigate CTA
          const html = this.assistantBoxHelper.normalizeAssistantHtml(
            this.assistantBoxHelper.convertMarkdownToHtml(
              this.assistantBoxHelper.parseAssistantResponse( content )
            )
          ) || 'I found something for you.';

          patchState( {
            pendingAction: { action: 'navigate', param: routeStr },
            assistantResponse: html,
            showConfirmPrompt: true,
            inlineReply: null
          } );
          return;
        }

        // Action (e.g., goToFilteredContacts, updateContactField, addNewContact)
        if ( content.action ) {
          const html = this.assistantBoxHelper.normalizeAssistantHtml(
            this.assistantBoxHelper.convertMarkdownToHtml(
              this.assistantBoxHelper.parseAssistantResponse( content )
            )
          ) || 'Proceed with this action?';

          patchState( {
            pendingAction: { action: content.action, param: content.param },
            assistantResponse: html,
            showConfirmPrompt: true,
            inlineReply: null
          } );
          return;
        }

        // Plain text answer
        const message = this.assistantBoxHelper.parseAssistantResponse( content );
        if ( message ) {
          const html = this.assistantBoxHelper.normalizeAssistantHtml(
            this.assistantBoxHelper.convertMarkdownToHtml( message )
          );
          // NOTE: AssistantBoxComponent's assistantResponse setter already handles
          // history insertion / upward emission when parentOwnsHistory === true.
          // Emitting here can cause duplicates.
          patchState( { assistantResponse: html } );
        }

        // Mirror your previous default: only show confirm when pendingAction is navigate
        patchState( { showConfirmPrompt: false } );
      },
      error: ( err: any ) => {
        this.logger.error( 'CONTACT_LLM_ERROR', err );
        onError( err );
      }
    } ) as unknown as Subscription;
  }
}
