import { Injectable } from '@angular/core';

export type ToddTipCategory = 'general' | 'projects' | 'tasks' | 'contacts' | 'email' | 'documents' | 'surveys';

export interface ToddTip {
  id: string;
  text: string;
  category: ToddTipCategory;
  page?: string; // optional page key like 'tasks-start', 'projects-start', etc.
}


@Injectable( {
  providedIn: 'root'
} )
export class TipService {

  private readonly tips: ToddTip[] = [
    // General
    {
      id: 'general-1',
      text: 'Small, consistent moves beat big, random pushes. Add one move you can finish today.',
      category: 'general',
    },
    {
      id: 'general-2',
      text: 'Use notes on contacts to capture context you will forget in 48 hours.',
      category: 'general',
    },
    {
      id: 'general-3',
      text: 'If everything is important, nothing is. Tag the top three moves that really matter.',
      category: 'general',
    },
    // Knowledge Base / Response Flow
    {
      id: 'kb-rf-1',
      text: 'Write questions the way users actually ask them. TODD searches better when the wording feels real, not formal.',
      category: 'documents',
      page: 'response-flow',
    },
    {
      id: 'kb-rf-2',
      text: 'One question per entry. If you feel tempted to add “and” in the question, you probably need a second Response Flow.',
      category: 'documents',
      page: 'response-flow',
    },
    {
      id: 'kb-rf-3',
      text: 'Keep answers short and direct. Use links and attached documents for deep detail instead of long walls of text.',
      category: 'documents',
      page: 'response-flow',
    },
    {
      id: 'kb-rf-4',
      text: 'Always add a source for each answer. Cited responses build trust and make it easier to update later.',
      category: 'documents',
      page: 'response-flow',
    },
    {
      id: 'kb-rf-5',
      text: 'Use Recommendations for “what to do next,” not more info. Think actions, policies, or practices someone should follow.',
      category: 'documents',
      page: 'response-flow',
    },
    {
      id: 'kb-rf-6',
      text: 'Resources should point to the best version of a thing, not every version. Link to one strong doc, not five copies.',
      category: 'documents',
      page: 'response-flow',
    },
    {
      id: 'kb-rf-7',
      text: 'Tag keywords by how people search, not how you talk internally. Use plain words that a new teammate would type.',
      category: 'documents',
      page: 'response-flow',
    },
    {
      id: 'kb-rf-8',
      text: 'Repeat important keywords across similar entries. Consistent tagging makes the Knowledge Base feel “smart” instead of random.',
      category: 'documents',
      page: 'response-flow',
    },
    {
      id: 'kb-rf-9',
      text: 'If a question keeps showing up in email or meetings, give it a Response Flow so TODD can answer it the same way every time.',
      category: 'documents',
      page: 'response-flow',
    },
    {
      id: 'kb-rf-10',
      text: 'When something changes in policy or practice, update the answer first, then the linked documents. Keep the story and the proof in sync.',
      category: 'documents',
      page: 'response-flow',
    },
    {
      id: 'kb-rf-11',
      text: 'Attach original files to answers when possible. Future you won’t have to hunt through folders to see where the guidance came from.',
      category: 'documents',
      page: 'response-flow',
    },
    {
      id: 'kb-rf-12',
      text: 'Use the Preview to read your entry like a teammate. If it feels confusing there, it will feel confusing in the Knowledge Base.',
      category: 'documents',
      page: 'response-flow',
    },
    // Projects
    {
      id: 'projects-1',
      text: 'Try searching by project code, client name, or internal nickname.',
      category: 'projects',
      page: 'tasks-start',
    },
    {
      id: 'projects-2',
      text: 'Open a sticky to update state instead of recreating the same task again.',
      category: 'projects',
      page: 'tasks-start',
    },
    {
      id: 'projects-3',
      text: 'Overdue stickies usually mean the scope changed. Update the task instead of ignoring it.',
      category: 'projects',
      page: 'tasks-start',
    },

    // Tasks / Moves
    {
      id: 'tasks-1',
      text: 'Archive old moves that are no longer relevant. A clean board makes TODD feel lighter.',
      category: 'tasks',
    },
    {
      id: 'tasks-2',
      text: 'If a move has been stuck for weeks, break it into two smaller ones.',
      category: 'tasks',
    },
    {
      id: 'tasks-3',
      text: 'Use due dates only for things that truly have a date. Everything else can stay unscheduled.',
      category: 'tasks',
    },
    {
      id: 'tasks-4',
      text: 'Tie moves to specific contacts, not just projects. Revenue comes from people, not boards.',
      category: 'tasks',
    },
    {
      id: 'tasks-5',
      text: 'When you finish a move, set the next one immediately. Momentum dies in the gap between “done” and “what now?”.',
      category: 'tasks',
    },
    {
      id: 'tasks-6',
      text: 'If TODD keeps showing the same name in your suggestions, it’s a signal. Either move them forward—or archive.',
      category: 'tasks',
    },

    // Contacts
    {
      id: 'contacts-1',
      text: 'Tag contacts by role or segment so TODD can surface better suggestions later.',
      category: 'contacts',
    },
    {
      id: 'contacts-2',
      text: 'Before you email someone, skim their past interactions in TODD for tone and timing clues.',
      category: 'contacts',
    },
    {
      id: 'contacts-3',
      text: 'Every warm contact should have a next step. If TODD shows “No Moves,” add one before you leave the screen.',
      category: 'contacts',
    },
    {
      id: 'contacts-4',
      text: 'Use status to mark where the relationship really is, not where you wish it was. TODD can’t help if the data is aspirational.',
      category: 'contacts',
    },
    {
      id: 'contacts-5',
      text: 'When a contact replies, add a quick note about what mattered to them. Those phrases become your future subject lines.',
      category: 'contacts',
    },
    {
      id: 'contacts-6',
      text: 'If a contact shows up in multiple projects, treat them as a hub. One good conversation there can move three deals forward.',
      category: 'contacts',
    },
    {
      id: 'contacts-7',
      text: 'Don’t chase everyone. Use TODD to focus on contacts who open, click, or reply. Warm beats wide.',
      category: 'contacts',
    },
    {
      id: 'contacts-8',
      text: 'Use tags like “Champion”, “Evaluator”, or “Blocker”. It helps TODD—and you—remember who actually moves things.',
      category: 'contacts',
    },
    {
      id: 'contacts-9',
      text: 'If you wouldn’t recognize the name in six months, add a note now. Future you won’t remember why they mattered.',
      category: 'contacts',
    },
    {
      id: 'contacts-10',
      text: 'Think in relationships, not leads. A smaller list of well-understood contacts usually beats a big, anonymous database.',
      category: 'contacts',
    },

    // Email / Outreach
    {
      id: 'email-1',
      text: 'Draft inside TODD first so you keep the thread, then send via your preferred client.',
      category: 'email',
    },
    {
      id: 'email-2',
      text: 'Short, specific asks get more replies. TODD can help you rewrite long emails down.',
      category: 'email',
    },
    {
      id: 'email-3',
      text: 'Before you send anything, check TODD for the last thing they responded to. Match that tone and length.',
      category: 'email',
    },
    {
      id: 'email-4',
      text: 'One clear ask per email. If TODD can’t summarize your ask in one line, it’s probably too complicated.',
      category: 'email',
    },
    {
      id: 'email-5',
      text: 'Use TODD to batch follow-ups for one segment at a time. Same role, tuned message, better hit rate.',
      category: 'email',
    },
    {
      id: 'email-6',
      text: 'When someone clicks but doesn’t reply, log a move instead of resending the same email. Change the channel or angle.',
      category: 'email',
    },
    // Documents
    {
      id: 'documents-1',
      text: 'Keep drafts in TODD until they’re stable. It saves you from hunting through your desktop later.',
      category: 'documents',
    },

    {
      id: 'documents-2',
      text: 'Name documents by purpose, not date. “Client Brief” beats “Notes_Final_v3_Updated”.',
      category: 'documents',
    },

    {
      id: 'documents-3',
      text: 'If a document carries decisions, summarize them at the top. Your future self will thank you.',
      category: 'documents',
    },

    {
      id: 'documents-4',
      text: 'When you upload a file, add a note explaining why it matters. TODD can surface it faster later.',
      category: 'documents',
    },

    {
      id: 'documents-5',
      text: 'Group related documents by project tag. It makes the entire workstream easier to revisit.',
      category: 'documents',
    },

    {
      id: 'documents-6',
      text: 'If a document keeps getting shared, turn it into a template. Reuse beats rewriting.',
      category: 'documents',
    },

    {
      id: 'documents-7',
      text: 'Store video links with context. A clip with no explanation becomes a mystery three weeks later.',
      category: 'documents',
    },

    {
      id: 'documents-8',
      text: 'Delete outdated drafts. A clean document list helps TODD show the useful stuff first.',
      category: 'documents',
    },

    {
      id: 'documents-9',
      text: 'If a file needs feedback, tag it or link it in a task. Documents rarely move on their own.',
      category: 'documents',
    },

    {
      id: 'documents-10',
      text: 'Upload key PDFs to TODD before meetings. Quick access beats searching email threads.',
      category: 'documents',
    },

    {
      id: 'documents-11',
      text: 'Add keywords that describe the document’s role. TODD’s search gets smarter with each one.',
      category: 'documents',
    },

    {
      id: 'documents-12',
      text: 'If a document supports a decision, attach it to that project. It builds a clear story of how work evolved.',
      category: 'documents',
    },

    // Surveys / Pulse
    {
      id: 'surveys-1',
      text: 'Start with one clear question per survey. If you have three goals, you probably need three surveys.',
      category: 'surveys',
    },
    {
      id: 'surveys-2',
      text: 'Ask questions the way people speak. Plain language gets better completion and better data.',
      category: 'surveys',
    },
    {
      id: 'surveys-3',
      text: 'Mix multiple-choice for trends with one open text question for nuance TODD can analyze later.',
      category: 'surveys',
    },
    {
      id: 'surveys-4',
      text: 'Keep most surveys under five questions. Short pulses are more likely to get finished.',
      category: 'surveys',
    },
    {
      id: 'surveys-5',
      text: 'Tag each survey by audience or theme. It makes comparing Pulse results much easier later.',
      category: 'surveys',
    },
    {
      id: 'surveys-6',
      text: 'Use follow-up tasks after a survey closes. Insights only matter if they lead to a move.',
      category: 'surveys',
    },
    {
      id: 'surveys-7',
      text: 'Reuse good questions. If a question produces useful splits once, keep it in your Pulse rotation.',
      category: 'surveys',
    },
    {
      id: 'surveys-8',
      text: 'When a survey result looks off, check who responded before reacting. Sample matters as much as score.',
      category: 'surveys',
    },
  ];

  private lastTipId: string | null = null;

  /** Get a random tip text, optionally scoped by category and/or page key. */
  getRandomTipText ( category?: ToddTipCategory, page?: string ): string {
    const tip = this.getRandomTip( category, page );
    return tip?.text ?? '';
  }

  /** Get a random tip object, optionally scoped by category and/or page key. */
  getRandomTip ( category?: ToddTipCategory, page?: string ): ToddTip {
    const pool = this.getTipPool( category, page );
    if ( pool.length === 0 ) {
      // fall back to general tips if nothing matches
      const generalPool = this.getTipPool( 'general' );
      if ( generalPool.length === 0 ) {
        // last fallback
        return {
          id: 'fallback',
          text: 'No tips yet. Add some to ToddTipService to start rotating guidance.',
          category: 'general',
        };
      }
      return this.pickRandom( generalPool );
    }

    return this.pickRandom( pool );
  }

  private getTipPool ( category?: ToddTipCategory | 'general', page?: string ): ToddTip[] {
    let pool = this.tips;

    if ( category ) {
      pool = pool.filter( t => t.category === category );
    }

    if ( page ) {
      const pageMatches = pool.filter( t => t.page === page );
      if ( pageMatches.length > 0 ) {
        pool = pageMatches;
      }
    }

    return pool;
  }

  private pickRandom ( pool: ToddTip[] ): ToddTip {
    if ( pool.length === 1 ) {
      this.lastTipId = pool[0].id;
      return pool[0];
    }

    let tip: ToddTip;
    let safety = 0;

    do {
      const index = Math.floor( Math.random() * pool.length );
      tip = pool[index];
      safety++;
    } while ( tip.id === this.lastTipId && safety < 5 );

    this.lastTipId = tip.id;
    return tip;
  }
}
