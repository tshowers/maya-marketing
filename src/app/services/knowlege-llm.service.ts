import { Injectable } from '@angular/core';
import { Subscription } from 'rxjs';
import { OpenAIService } from './open-ai.service';

export type KnowledgeDraft = {
  question: string;
  category: string;
  answers: Array<{ answer: string; source: string; document?: any; }>;
  recommendations: any[];
  resources: any[];
  keywords: string[];
};

export type KnowledgeLLMRunArgs = {
  promptWithContext: string;
  rawPrompt: string;
  userId: string;
  history: Array<{ role: 'user' | 'assistant'; content: string; }>;

  setLoading: ( v: boolean ) => void;

  patchState: ( p: {
    assistantResponse?: string;
    pendingAction?: { action: string; param: any; } | null;
    showConfirmPrompt?: boolean;
  } ) => void;

  onError: ( err: any ) => void;
};

@Injectable( {
  providedIn: 'root'
} )
export class KnowlegeLLMService {

  constructor ( private openAIService: OpenAIService ) { }

  // Extract JSON from model output if it includes a structured draft
  private tryExtractJsonObject ( text: string ): any | null {
    if ( !text ) return null;

    const fenced = text.match( /```json\s*([\s\S]*?)```/i );
    if ( fenced && fenced[1] ) {
      try { return JSON.parse( fenced[1].trim() ); } catch { }
    }

    const firstBrace = text.indexOf( '{' );
    const lastBrace = text.lastIndexOf( '}' );
    if ( firstBrace >= 0 && lastBrace > firstBrace ) {
      const maybe = text.slice( firstBrace, lastBrace + 1 );
      try { return JSON.parse( maybe ); } catch { }
    }

    return null;
  }

  private normalizeDraft ( d: any, fallbackQuestion: string ): KnowledgeDraft {
    const draft = ( d?.draft || d?.knowledgeDraft || d ) || {};

    const question = ( draft.question || draft.topic || fallbackQuestion || '' ).toString().trim();
    const category = ( draft.category || draft.kbcategory || 'General' ).toString().trim();

    const answersRaw =
      Array.isArray( draft.answers ) ? draft.answers :
        ( draft.answer ? [{ answer: draft.answer, source: 'TODD' }] : [] );

    const answers = answersRaw
      .map( ( a: any ) => ( {
        answer: ( a?.answer || a?.text || '' ).toString().trim(),
        source: ( a?.source || 'TODD' ).toString().trim(),
        document: a?.document
      } ) )
      .filter( ( a: any ) => !!a.answer );

    const recommendations = Array.isArray( draft.recommendations ) ? draft.recommendations : [];
    const resources = Array.isArray( draft.resources ) ? draft.resources : [];

    const keywordsRaw = Array.isArray( draft.keywords ) ? draft.keywords : [];
    const keywords = keywordsRaw
      .map( ( k: any ) => ( k || '' ).toString().trim().toLowerCase() )
      .filter( Boolean )
      .slice( 0, 12 );

    return { question, category, answers, recommendations, resources, keywords };
  }

  /**
   * Knowledge processor: generates an answer + a draft (ResponseFlow-shaped).
   * Saving happens only after user confirms (operator step).
   */
  run ( args: KnowledgeLLMRunArgs ): Subscription {
    const { promptWithContext, rawPrompt, setLoading, patchState, onError } = args;

    setLoading( true );

    const svc: any = this.openAIService as any;

    // Prefer the modern assistant envelope (/app-assistant) when available.
    const hasGetAssistance = typeof svc.getAssistance === 'function';
    const hasKnowledge = typeof svc.getKnowledgeAssistantResponse === 'function';
    const hasAssistant = typeof svc.getAssistantResponse === 'function';
    const hasLegacy = typeof svc.getTaskOrAssistantResponse === 'function';

    // Helper to extract the human-visible text from common envelope shapes.
    const extractText = ( res: any ): string => {
      try {
        const r = res?.response ?? res;
        if ( r && typeof r === 'object' ) {
          if ( typeof r.response === 'string' ) return r.response;
          if ( r.parsedQuery && typeof r.parsedQuery.response === 'string' ) return r.parsedQuery.response;
          return JSON.stringify( r );
        }
        const s = String( r ?? '' );
        if ( s.trim().startsWith( '{' ) && ( s.includes( '"response"' ) || s.includes( '"parsedQuery"' ) ) ) {
          const parsed = JSON.parse( s );
          if ( parsed && typeof parsed.response === 'string' ) return parsed.response;
          if ( parsed && parsed.parsedQuery && typeof parsed.parsedQuery.response === 'string' ) return parsed.parsedQuery.response;
        }
        return s;
      } catch {
        return String( res?.response ?? res ?? '' );
      }
    };

    if ( !hasGetAssistance && !hasKnowledge && !hasAssistant && !hasLegacy ) {
      setLoading( false );
      onError( new Error( 'No OpenAI knowledge endpoint available.' ) );
      return new Subscription();
    }

    // Call order:
    // 1) getAssistance (preferred): sends history via data.history and returns a consistent envelope.
    // 2) knowledge-specific endpoint if present
    // 3) generic assistant endpoint
    // 4) legacy routing endpoint
    const obs =
      hasGetAssistance
        ? svc.getAssistance( promptWithContext, 'general', args.userId, { history: args.history } )
        : hasKnowledge
          ? svc.getKnowledgeAssistantResponse( promptWithContext )
          : hasAssistant
            ? svc.getAssistantResponse( promptWithContext )
            : svc.getTaskOrAssistantResponse( promptWithContext );

    return obs.subscribe( {
      next: ( res: any ) => {
        setLoading( false );

        const text = extractText( res );

        const answerHtml =
          ( res?.answerHtml || res?.assistantResponse || res?.html || '' ).toString().trim();

        const structured =
          res?.draft || res?.knowledgeDraft || this.tryExtractJsonObject( text );

        const visible = answerHtml || text;

        // Use the user's prompt as fallback so KB entries don't save with a blank question.
        const fallbackQuestion = ( rawPrompt || '' ).toString().trim();

        // Normalize draft (structured JSON when present) and fall back to the prompt.
        let draft = this.normalizeDraft( structured, fallbackQuestion );

        // If the model didn't provide a question, use the user's prompt.
        if ( ( !draft.question || !draft.question.trim() ) && fallbackQuestion ) {
          draft = { ...draft, question: fallbackQuestion };
        }

        // If the model didn't provide structured answers, use the visible answer text.
        if ( ( !draft.answers || !draft.answers.length ) && visible ) {
          const stripHtml = ( s: string ) =>
            ( s || '' )
              .replace( /<style[\s\S]*?<\/style>/gi, '' )
              .replace( /<script[\s\S]*?<\/script>/gi, '' )
              .replace( /<[^>]+>/g, ' ' )
              .replace( /\s+/g, ' ' )
              .trim();

          const answerText = stripHtml( visible );
          if ( answerText ) {
            draft = {
              ...draft,
              answers: [{ answer: answerText, source: 'TODD' }]
            };
          }
        }

        patchState( {
          assistantResponse: visible,
          pendingAction: { action: 'createKnowledge', param: draft },
          showConfirmPrompt: true
        } );
      },
      error: ( err: any ) => {
        setLoading( false );
        onError( err );
      }
    } );
  }
}
