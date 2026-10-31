/**
 * Ask first or act, never both (Ty, 2026-10-31). When a chat reply asks the
 * person a question and also carries actions that start a Marketing
 * Assistant job, the job would start before the answer exists, and a job
 * still planning leaves follow-ups alone, so the answer never reached it.
 * The chat holds those actions instead and starts the job once the person
 * answers, with the answer folded into its brief. Pure functions, so the
 * rule doesn't depend on the model following its prompt.
 */
import { PublicMarketingDirectorSystemAction } from '../services/public-marketing-director.service';

/** Job-starting actions held back from a reply that asked a question. */
export interface HeldJob {
  /** What the person asked before the question. */
  request: string;
  /** Their answers since, oldest first. */
  answers: string[];
  actions: PublicMarketingDirectorSystemAction[];
}

/** What to do with a reply's actions. */
export interface DirectorActionPlan {
  /** Actions to run now. */
  run: PublicMarketingDirectorSystemAction[];
  /** The request any job started now is for. */
  request: string;
  /** The person's answers to fold into that job's brief. */
  answers: string[];
  /** Actions to keep holding until the next answer, or null. */
  hold: HeldJob | null;
}

/** An email, or a move the Marketing Assistant does herself: both start a job. */
export function startsJob ( action: PublicMarketingDirectorSystemAction ): boolean {
  return action.type === 'send_email' ||
    ( action.type === 'create_move' && /maya/i.test( String( action.ownerLabel || '' ) ) );
}

/**
 * Whether a reply asks the person something: tap-to-answer choices, or a
 * sentence ending in "?". A "?" inside a link (/work?job=...) doesn't count.
 */
export function asksQuestion ( reply: string, choices: ReadonlyArray<unknown> = [] ): boolean {
  if ( choices.length > 0 ) return true;
  const text = String( reply || '' ).replace( /\bhttps?:\/\/\S+/gi, '' );
  return /\?+(?=$|[\s"'”’)\]*_])/.test( text );
}

/**
 * Splits a reply's actions into what runs now and what waits. A held job
 * resumes on the next reply: that reply's own job actions replace the held
 * ones (they were written with the answer), else the held ones run. Either
 * way the job is for the original request, plus every answer since.
 */
export function planDirectorActions (
  actions: PublicMarketingDirectorSystemAction[],
  prompt: string,
  replyAsks: boolean,
  held: HeldJob | null
): DirectorActionPlan {
  const jobActions = actions.filter( startsJob );
  const others = actions.filter( action => !startsJob( action ) );
  const request = held ? held.request : prompt;
  const answers = held ? [...held.answers, prompt] : [];
  const pending = jobActions.length ? jobActions : held?.actions || [];

  if ( replyAsks && pending.length ) {
    return { run: others, request, answers, hold: { request, answers, actions: pending } };
  }
  return { run: [...others, ...pending], request, answers, hold: null };
}

/** A job brief with the person's answers last, kept within the job request limit. */
export function withAnswers ( brief: string, answers: string[], limit: number = 4000 ): string {
  const answerLines = answers
    .map( answer => String( answer || '' ).trim() )
    .filter( Boolean )
    .map( answer => `Your answer: ${answer}` )
    .join( '\n' )
    .slice( 0, limit );
  if ( !answerLines ) return brief.slice( 0, limit );
  const room = Math.max( 0, limit - answerLines.length - 1 );
  return [brief.slice( 0, room ).trim(), answerLines].filter( Boolean ).join( '\n' );
}

/** What the chat says when it holds a job back. */
export function heldJobNotice ( held: HeldJob ): string {
  const names = held.actions.map( action => {
    const name = String( action.subject || action.title || '' ).trim();
    if ( action.type === 'send_email' ) return name ? `the email "${name}"` : 'the email';
    return name ? `"${name}"` : 'the work';
  } );
  const what = names.length > 1 ? `${names.slice( 0, -1 ).join( ', ' )} and ${names[names.length - 1]}` : names[0];
  return `Execution receipt: nothing has started yet. I'll start ${what} as soon as you answer the question above, with your answer in the brief.`;
}
