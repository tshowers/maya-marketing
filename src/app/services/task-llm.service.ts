import { Injectable } from '@angular/core';
import { Subscription } from 'rxjs';

import { OpenAIService } from './open-ai.service';
import { DataService } from './data.service';
import { AssistantBoxHelperService } from './assistant-box-helper.service';
import { LoggerService } from './logger.service';
import { AssistantUiPatch, AssistantMessage } from './types/assistant.types';

export type RunTaskArgs = {
  promptWithContext: string;
  userId: string;
  history: AssistantMessage[];

  setLoading: ( v: boolean ) => void;
  patchState: ( patch: AssistantUiPatch ) => void;
  onError: ( err: any ) => void;
};

@Injectable( { providedIn: 'root' } )
export class TaskLLMService {
  constructor (
    private openAIService: OpenAIService,
    private dataService: DataService,
    private assistantBoxHelper: AssistantBoxHelperService,
    private logger: LoggerService
  ) { }

  /**
   * Runs the Task LLM call and reports UI updates back to the component.
   * Service never touches component `this.*` directly.
   */
  run ( args: RunTaskArgs ): Subscription {
    const { promptWithContext, userId, history, setLoading, patchState, onError } = args;

    setLoading( true );
    patchState( { assistantResponse: '', pendingAction: null, inlineReply: null, showConfirmPrompt: false } );

    return this.openAIService.getTaskAssistantResponse( promptWithContext, userId, { history } ).subscribe( {
      next: ( res: any ) => {
        setLoading( false );
        this.logger.info( '🧠 Task LLM Response:', res );

        const content: any = res?.parsedQuery ?? res ?? {};

        // Map route => CTA (never auto-route)
        if ( content.route && content.action !== 'addTask' ) {
          const [path, fragment] = String( content.route ).split( '#' );
          const routeStr = fragment ? `${path}#${fragment}` : path;

          // Inline reply (filters/params) preferred over confirm CTA
          if ( content.param && typeof content.param === 'object' ) {
            const inlineReply = {
              kind: 'navigateWithFilters',
              payload: content.param,
              apply: { route: routeStr, param: content.param }
            };

            const html = this.assistantBoxHelper.normalizeAssistantHtml(
              this.assistantBoxHelper.convertMarkdownToHtml(
                this.assistantBoxHelper.parseAssistantResponse( content )
              )
            ) || 'Open this view?';

            patchState( { inlineReply, assistantResponse: html, showConfirmPrompt: false, pendingAction: null } );
            return;
          }

          patchState( { pendingAction: { action: 'navigate', param: routeStr } } );
        }

        // Map actions
        if ( content.action ) {
          // Confirm addTask with preview (title/due/priority)
          if ( content.action === 'addTask' ) {
            const { title, dueDate, priority } = content.param || {};
            const html = this.assistantBoxHelper.convertMarkdownToHtml(
              `📝 Would you like to create the task:\n\n**${title || 'Untitled'}**\n\nDue: **${dueDate || 'n/a'}**${priority ? `\n\nPriority: **${priority}**` : ''}`
            );
            patchState( {
              assistantResponse: html,
              pendingAction: { action: 'addTask', param: content.param },
              showConfirmPrompt: true,
              inlineReply: null
            } );
            return;
          }

          // Project lookup variants → resolve ID locally then offer CTA
          if ( ['showProjectByName', 'showProject', 'goProject'].includes( content.action ) ) {
            const projectName = ( content.param?.name ?? content.param ?? '' ).toString().trim();

            this.dataService
              .getProjectByName( projectName, userId || 'UI' )
              .then( ( found: any ) => {
                if ( found?.id ) {
                  patchState( {
                    assistantResponse: `📌 Showing project: <strong>${projectName}</strong>`,
                    pendingAction: { action: 'navigate', param: `/projects#${found.id}` },
                    showConfirmPrompt: true,
                    inlineReply: null
                  } );
                } else {
                  patchState( {
                    assistantResponse: `❓ I couldn't find a project named <strong>${projectName}</strong>.`,
                    pendingAction: null,
                    showConfirmPrompt: false,
                    inlineReply: null
                  } );
                }
              } )
              .catch( ( err: any ) => onError( err ) );

            return;
          }

          // Otherwise surface generic action for confirm/apply via callAction
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

        // Default: just show message
        const message = this.assistantBoxHelper.parseAssistantResponse( content );
        if ( message ) {
          const html = this.assistantBoxHelper.normalizeAssistantHtml(
            this.assistantBoxHelper.convertMarkdownToHtml( message )
          );
          patchState( { assistantResponse: html } );
        }

        // Reveal CTA if the backend implied navigation earlier
        const shouldShowCta = !!( content.route && !content.param && content.action !== 'addTask' );
        patchState( { showConfirmPrompt: shouldShowCta } );
      },
      error: ( err: any ) => {
        onError( err );
      }
    } );
  }
}
