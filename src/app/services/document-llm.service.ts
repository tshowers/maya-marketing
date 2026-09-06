import { Injectable } from '@angular/core';
import { Subscription } from 'rxjs';

import { OpenAIService } from './open-ai.service';
import { AssistantBoxHelperService } from './assistant-box-helper.service';
import { LoggerService } from './logger.service';
import { AssistantUiPatch, AssistantMessage } from './types/assistant.types';

export type RunDocumentArgs = {
  promptWithContext: string;
  userId: string;
  history: AssistantMessage[];

  setLoading: ( v: boolean ) => void;
  patchState: ( patch: AssistantUiPatch ) => void;
  emitAssistant?: ( assistantHtml: string ) => void; // used only for plain-text answers
  onError: ( err: any ) => void;
};

@Injectable( {
  providedIn: 'root'
} )
export class DocumentLLMService {
  constructor (
    private openAIService: OpenAIService,
    private assistantBoxHelper: AssistantBoxHelperService,
    private logger: LoggerService
  ) { }

  /**
   * Runs the Document LLM call and reports UI updates back to the component.
   * Preserves your current behavior:
   * - route + param object => inline Apply (no confirm bar)
   * - route only => pending navigate CTA
   * - createDocument => confirm with preview
   * - other actions => confirm
   * - plain text => emit assistant message
   */
  run ( args: RunDocumentArgs ): Subscription {
    const {
      promptWithContext,
      userId,
      history,
      setLoading,
      patchState,
      emitAssistant,
      onError
    } = args;

    setLoading( true );
    patchState( { assistantResponse: '', pendingAction: null, inlineReply: null, showConfirmPrompt: false } );

    return this.openAIService.getDocumentAssistantResponse?.( promptWithContext, userId, { history } )?.subscribe( {
      next: ( res: any ) => {
        setLoading( false );
        const content: any = res?.parsedQuery ?? res ?? {};

        // CTA route
        if ( content.route && content.action !== 'createDocument' ) {
          const [path, fragment] = String( content.route ).split( '#' );
          const routeStr = fragment ? `${path}#${fragment}` : path;

          if ( content.param && typeof content.param === 'object' ) {
            const inlineReply = {
              kind: 'navigateWithFilters',
              payload: content.param,
              apply: { route: routeStr, param: content.param }
            };

            const html =
              this.assistantBoxHelper.normalizeAssistantHtml(
                this.assistantBoxHelper.convertMarkdownToHtml(
                  this.assistantBoxHelper.parseAssistantResponse( content )
                )
              ) || 'Open this view?';

            patchState( { inlineReply, assistantResponse: html, showConfirmPrompt: false, pendingAction: null } );
            return;
          }

          patchState( { pendingAction: { action: 'navigate', param: routeStr } } );
        }

        if ( content.action ) {
          if ( content.action === 'createDocument' ) {
            const { title, kind } = content.param || {};
            const html = this.assistantBoxHelper.convertMarkdownToHtml(
              `📝 Create document?\n\n**${title || 'Untitled'}**${kind ? `\n\nType: **${kind}**` : ''}`
            );
            patchState( {
              assistantResponse: html,
              pendingAction: { action: 'createDocument', param: content.param },
              showConfirmPrompt: true,
              inlineReply: null
            } );
            return;
          }

          // Generic actions pass-through
          const html =
            this.assistantBoxHelper.normalizeAssistantHtml(
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
          patchState( { assistantResponse: html } );
          if ( emitAssistant ) emitAssistant( html );
        }

        // Show CTA if we set navigate earlier
        const shouldShowCta = !!( content.route && !content.param && content.action !== 'createDocument' );
        patchState( { showConfirmPrompt: shouldShowCta } );
      },
      error: ( err: any ) => {
        this.logger.error( 'DOCUMENT_LLM_ERROR', err );
        onError( err );
      }
    } ) as unknown as Subscription;
  }
}
