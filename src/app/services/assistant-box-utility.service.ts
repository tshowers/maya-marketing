import { EventEmitter, Injectable } from '@angular/core';
import { AssistantBoxHelperService } from './assistant-box-helper.service';
import { Contact } from '../shared/data/interfaces/contact.model';
import { EmailStages } from '../shared/page/email-stage-progress/email-stage-progress.component';
import { LoggerService } from './logger.service';
import { ConversationService } from './conversation.service';

import { CatalystAssistantDraftPayload, CatalystAssistantContext } from '../features/email/components/emailer/emailer.component';
import { EmailSentAssistantContext } from '../features/email/components/email-sent/email-sent.component';
import { AssistantPageContext } from './todd-assistant-bus.service';

export type AssistantHistoryMessage = { role: 'user' | 'assistant'; content: string; };

@Injectable( {
  providedIn: 'root'
} )
export class AssistantBoxUtilityService {
  emailStages = EmailStages;


  constructor ( private assistantBoxHelperService: AssistantBoxHelperService, private logger: LoggerService, private conversationService: ConversationService ) { }


  public normalizeModelOutputToHtml ( input: any ): string {
    const raw = String( input ?? '' );
    if ( !raw.trim() ) return '';

    const pre = raw.replace( /\*\*(.+?)\*\*/g, '<strong>$1</strong>' );
    const looksHtml = /<\s*[a-zA-Z][\s\S]*?>/.test( pre );

    const html = looksHtml
      ? pre
      : this.assistantBoxHelperService.convertMarkdownToHtml( pre );

    return this.assistantBoxHelperService.normalizeAssistantHtml(
      this.linkifySlashRoutes( html )
    );


  }

  /**
 * Converts plain route tokens like "/compose-email" into clickable links.
 * Keeps trailing punctuation intact and avoids touching already-linked HTML.
 */
  public linkifySlashRoutes ( input: string ): string {
    const s = String( input ?? '' );
    if ( !s ) return s;

    // If the model already returned HTML anchors, don't double-link.
    if ( s.includes( 'href="/' ) || s.includes( "href='/" ) ) return s;

    // Include quote boundaries too because the model often returns '/route' or "/route"
    const routeRegex = /(^|[\s\(\[\{>\"\'])(\/[^\s\)\]\}\>\"\']+)/g;

    return s.replace( routeRegex, ( _full, boundary: string, route: string ) => {
      // Strip wrapping quotes and preserve trailing punctuation.
      const unquoted = route.replace( /^['\"]+|['\"]+$/g, '' );
      const m = unquoted.match( /^(\/[^\s\)\]\}\>\"\']+)([\.,;:!?]+)?$/ );
      const cleanRoute = ( m?.[1] || unquoted ).trim();
      const trail = m?.[2] || '';

      // Only linkify if it looks like an app route
      if ( !cleanRoute.startsWith( '/' ) ) return `${boundary}${route}`;

      const a = `<a href="${cleanRoute}" class="route-link" data-path="${cleanRoute}">${cleanRoute}</a>`;
      return `${boundary}${a}${trail}`;
    } );
  }


  // Turn contact._insight into a small HTML block for the assistant
  public getContactInsightHtml ( contact: any ): string | null {
    const raw =
      contact?._insight ||
      contact?.insight ||
      ( contact?.meta && ( contact.meta._insight || contact.meta.insight ) );

    if ( !raw || typeof raw !== 'string' ) return null;

    // Normalize newlines and trim
    let text = raw.replace( /\r\n/g, '\n' ).trim();
    if ( !text ) return null;

    // Safety: avoid rendering raw HTML that might have been stored
    // (markdown converter may allow some HTML through depending on config)
    text = text.replace( /<\/?[^>]+>/g, '' );

    // If the insight contains labeled sections, render them as structured blocks.
    // Supports lines like:
    // "Relationship Tip:" / "Recommended Action:" / "Suggested Task:" (and minor variants)
    const lines = text
      .split( /\n+/ )
      .map( l => ( l || '' ).trim() )
      .filter( Boolean );

    const sectionDefs: Array<{ key: string; label: string; re: RegExp; }> = [
      { key: 'tip', label: 'Relationship Tip', re: /^(relationship\s+tip|tip)\s*:\s*/i },
      { key: 'action', label: 'Recommended Action', re: /^(recommended\s+action|action)\s*:\s*/i },
      { key: 'task', label: 'Suggested Task', re: /^(suggested\s+task|task)\s*:\s*/i }
    ];

    const sections: Array<{ label: string; value: string; }> = [];

    for ( const line of lines ) {
      const def = sectionDefs.find( d => d.re.test( line ) );
      if ( def ) {
        const value = line.replace( def.re, '' ).trim();
        if ( value ) {
          sections.push( { label: def.label, value } );
        }
        continue;
      }

      // No label: if we already started sections, append to the last section.
      if ( sections.length ) {
        sections[sections.length - 1].value = `${sections[sections.length - 1].value}\n${line}`.trim();
      }
    }

    // If we found labeled sections, render them cleanly.
    if ( sections.length ) {
      const rows = sections.map( s => {
        const body = this.assistantBoxHelperService.convertMarkdownToHtml( ( s.value || '' ).trim() );
        return `
          <div class="assistant-insight-row">
            <div class="assistant-insight-label"><strong>${s.label}</strong></div>
            <div class="assistant-insight-body">${body}</div>
          </div>
        `.trim();
      } ).join( '' );

      return `
        <div class="assistant-insight-block">
          ${rows}
        </div>
      `;
    }

    // Fallback: treat the insight as markdown-ish freeform text.
    // Keep paragraph breaks stable without over-inserting blank lines.
    const normalized = text
      .replace( /\n{3,}/g, '\n\n' );

    const body = this.assistantBoxHelperService.convertMarkdownToHtml( normalized );

    return `
      <div class="assistant-insight-block">
        <strong>Relationship Insight</strong>
        <div class="assistant-insight-body">
          ${body}
        </div>
      </div>
    `;
  }

  // Utility: choose first email/phone consistently
  public getPrimaryEmailFrom ( c: any ): string {
    return c?.email || ( Array.isArray( c?.emailAddresses ) && c.emailAddresses[0]?.emailAddress ) || '';
  }

  public getPrimaryPhoneFrom ( c: any ): string {
    return ( Array.isArray( c?.phoneNumbers ) && c.phoneNumbers[0]?.phoneNumber ) || '';
  }

  public resolveContactId ( c: any ): string {
    return c?.id || c?.uid || c?.loginID || '';
  }
  public buildRouteForContact ( c: any, displayName: string ): { path: string; param?: any; } {
    const id = this.resolveContactId( c );
    if ( id ) return { path: `/contact/${id}` };
    return { path: '/contact-list', param: { q: displayName } };
  }
  public cleanExtractedName ( raw: string ): string {
    return ( raw || '' ).replace( /[.,!?]$/, '' ).trim();
  }

  public buildCampaignPrompt ( data: any, sender: Contact | null ): string {
    let senderInfo = '';



    if ( sender && sender.company && sender.company.description ) {
      senderInfo = `The campaign should be based on the user's company description: ${sender.company.description || ''}
And the user's company goals  ${sender.company.goal || ''}`;
    }



    return `
Create an email campaign with the following parameters:

- Goal: ${data.goal}
- Audience: ${data.audience}
- Tone: ${data.tone}
- Stages: ${data.stages === 'standard' ? 'Use TODD standard stages (Intro, Problem, Solution, Tribe, Change, Close)' : 'Custom stages defined by user'}
- Frequency: ${data.schedule}
- Notes: ${data.notes || 'None'}

Write email content for each stage. Return JSON format like:
{
  "${this.emailStages[0].emailType}": "...",
  "${this.emailStages[1].emailType}": "...",
  "${this.emailStages[2].emailType}": "...",
  "${this.emailStages[3].emailType}": "...",
  "${this.emailStages[4].emailType}": "...",
  "${this.emailStages[5].emailType}": "...",
}
  -
${senderInfo}
  `.trim();
  }

  public getConfirmPrimaryLabel ( pendingAction: { action: string; param: any; } | null ): string {
    if ( !pendingAction ) return '✅ Yes, do it';

    if ( pendingAction.action === 'applyAssistantDraftToPreview' ) {
      return '✍️ Apply to Preview';
    }

    if ( pendingAction.action === 'navigate' ) {
      const p = pendingAction.param;
      if ( p && typeof p === 'object' && p.path ) {
        if ( p.path.includes( 'contact-list' ) ) {
          return p.params ? 'Apply' : '📇 Open Contact List';
        }
        if ( p.path.includes( 'task' ) ) return '📋 Open Tasks';
        if ( p.path.includes( 'contact/' ) ) return '👤 Open Contact';
        if ( p.path.includes( 'email' ) ) return '✉️ Open Email';
        return '➡️ Open';
      }
      const route = String( p || '' );
      if ( route.includes( 'task' ) ) return '📋 Open Tasks';
      if ( route.includes( 'contact/' ) ) return '👤 Open Contact';
      if ( route.includes( 'contact-list' ) ) return '📇 Open Contact List';
      if ( route.includes( 'email-processor' ) ) return '✉️ Open Catalyst';
      if ( route.includes( 'email' ) ) return '✉️ Open Email';
      return '➡️ Open';
    }

    return '✅ Yes, do it';
  }

  public buildDemoScript ( contact: Contact ): Array<{ user: string; assistantHtml: string; requires?: { selectedContact?: boolean; }; fallback?: { user: string; assistantHtml: string; }; }> {
    const hasSelectedContact = !!contact;

    const contactName =
      ( contact as any )?.displayName ||
      [( contact as any )?.firstName, ( contact as any )?.lastName].filter( Boolean ).join( ' ' ).trim() ||
      'this contact';

    const md = ( s: string ) => this.assistantBoxHelperService.normalizeAssistantHtml( this.assistantBoxHelperService.convertMarkdownToHtml( s ) );

    const script: Array<{ user: string; assistantHtml: string; requires?: { selectedContact?: boolean; }; fallback?: { user: string; assistantHtml: string; }; }> = [
      {
        user: 'What can you do for me in TODD?',
        assistantHtml: md(
          `Here’s what I do:\n\n- Find people and details fast\n- Draft emails and short campaigns\n- Spot missing data and fix it\n- Turn notes into tasks\n- Help you decide the next move\n\nAsk me like you’d ask a sharp assistant.`
        )
      },
      {
        user: 'What should I do next?',
        assistantHtml: md(
          `Give me one goal and I’ll turn it into steps.\n\nExample goals:\n- “Book 3 meetings”\n- “Clean up my contact data”\n- “Get organized for this week”`
        )
      },
      {
        user: 'Draft a short intro email template I can reuse.',
        assistantHtml: md(
          `Subject: Quick intro\n\nHey {{firstName}},\n\nI’m reaching out because {{reason}}. If it helps, I can share {{specific_value}}.\n\nWant a short version or a more direct one?`
        )
      },
      {
        user: 'If I’m starting from scratch, what’s the fastest way to get momentum?',
        assistantHtml: md(
          `Fast start:\n\n1) Add/import 10–25 contacts\n2) Pick 3 people to reach today\n3) I’ll draft the outreach\n4) Create 3 follow-up tasks\n\nIf you have no contacts yet, start with Import and I’ll guide it.`
        )
      },
      {
        user: 'Show me how you’d help me follow up.',
        assistantHtml: md(
          `If you select a contact, I can summarize them and draft the follow-up.\n\nTry:\n- “Summarize the selected contact”\n- “Write a follow-up email”`
        ),
        requires: { selectedContact: true },
        fallback: {
          user: 'Show me how you’d help me follow up.',
          assistantHtml: md(
            `Right now it looks like no contact is selected.\n\nPick any contact, then ask:\n- “Summarize this contact”\n- “Write a follow-up email”\n\nI’ll keep it tight and ready to send.`
          )
        }
      }
    ];

    // If a selected contact exists, make the last step feel real without hallucinating names
    if ( hasSelectedContact ) {
      script[4] = {
        user: `When did I last contact ${contactName}?`,
        assistantHtml: md(
          `I can answer that for the selected contact and show evidence (lastContacted / email history).\n\nWant me to pull it up now?`
        )
      };
    }

    return script;
  }

  public loadHistoryFromStorage ( historyStorageKey: string | null, externalMode: boolean ): AssistantHistoryMessage[] {
    if ( !historyStorageKey || !externalMode ) return [];
    try {
      const raw = localStorage.getItem( historyStorageKey );
      if ( !raw ) return [];
      const parsed = JSON.parse( raw );
      return Array.isArray( parsed ) ? parsed as AssistantHistoryMessage[] : [];
    } catch ( e ) {
      this.logger.error( 'ASSISTANT_BOX_HISTORY_LOAD_ERROR', e );
      return [];
    }
  }



  public persistHistory ( historyStorageKey: string | null, externalMode: boolean, history: AssistantHistoryMessage[] ): void {
    if ( !historyStorageKey || !externalMode ) return;
    try {
      const trimmed = history.slice( -50 ); // keep last 50 messages
      localStorage.setItem( historyStorageKey, JSON.stringify( trimmed ) );
      this.conversationService.setHistory( trimmed );
    } catch ( e ) {
      this.logger.error( 'ASSISTANT_BOX_HISTORY_SAVE_ERROR', e );
    }
  }

  public async startDemo (
    contact: Contact,
    externalMode: boolean,
    parentOwnsHistory: boolean,
    history: AssistantHistoryMessage[],
    historyStorageKey: string | null,
    message: EventEmitter<{ role: 'user' | 'assistant'; content: string; }>
  ): Promise<AssistantHistoryMessage[]> {
    const nextHistory: AssistantHistoryMessage[] = Array.isArray( history ) ? [...history] : [];

    this.pushAssistantMessage(
      `<div class="assistant-nudge"><strong>Quick demo</strong> — 5 questions, then it’s your turn.</div>`,
      externalMode,
      parentOwnsHistory,
      nextHistory,
      historyStorageKey,
      message
    );

    const script = this.buildDemoScript( contact );

    for ( const step of script ) {
      const needsContact = !!step.requires?.selectedContact;
      const hasContact = !!contact;
      const turn = ( needsContact && !hasContact && step.fallback ) ? step.fallback : step;

      await this.sleep( 650 );
      this.pushUserMessage( turn.user, externalMode, parentOwnsHistory, nextHistory, historyStorageKey, message );

      await this.sleep( 450 );
      this.pushAssistantMessage( turn.assistantHtml, externalMode, parentOwnsHistory, nextHistory, historyStorageKey, message );
    }

    await this.sleep( 500 );
    this.pushAssistantMessage(
      `<div class="assistant-nudge"><strong>Your turn.</strong> Ask me anything.</div>`,
      externalMode,
      parentOwnsHistory,
      nextHistory,
      historyStorageKey,
      message
    );

    return nextHistory;
  }

  public pushUserMessage ( content: string,
    externalMode: boolean,
    parentOwnsHistory: boolean,
    history: AssistantHistoryMessage[],
    historyStorageKey: string | null,
    message: EventEmitter<{ role: 'user' | 'assistant'; content: string; }>
  ): void {
    const msg = { role: 'user' as const, content };

    // Mirror the same persistence rules used in askAssistant
    if ( !externalMode && !parentOwnsHistory ) {
      history.push( msg );
      this.persistHistory( historyStorageKey, externalMode, history );
    } else {
      message.emit( msg );
    }

    // External mode also keeps a local thread
    if ( externalMode ) {
      history.push( msg );
      this.persistHistory( historyStorageKey, externalMode, history );
    }
  }

  public stopDemo (
    externalMode: boolean,
    parentOwnsHistory: boolean,
    history: AssistantHistoryMessage[],
    historyStorageKey: string | null,
    message: EventEmitter<{ role: 'user' | 'assistant'; content: string; }>
  ): AssistantHistoryMessage[] {
    const nextHistory: AssistantHistoryMessage[] = Array.isArray( history ) ? [...history] : [];

    this.pushAssistantMessage(
      `<div class="assistant-nudge">Demo stopped. Your turn.</div>`,
      externalMode,
      parentOwnsHistory,
      nextHistory,
      historyStorageKey,
      message
    );

    return nextHistory;
  }

  private pushAssistantMessage (
    raw: any,
    externalMode: boolean,
    parentOwnsHistory: boolean,
    history: AssistantHistoryMessage[],
    historyStorageKey: string | null,
    message: EventEmitter<{ role: 'user' | 'assistant'; content: string; }>
  ): void {
    const extractText = ( x: any ): string => {
      try {
        if ( x && typeof x === 'object' ) {
          if ( typeof x.response === 'string' ) return x.response;
          if ( x.parsedQuery && typeof x.parsedQuery.response === 'string' ) return x.parsedQuery.response;
          return JSON.stringify( x );
        }

        const s = String( x ?? '' ).trim();
        if ( s.startsWith( '{' ) && ( s.includes( '"response"' ) || s.includes( '"parsedQuery"' ) ) ) {
          const parsed = JSON.parse( s );
          if ( parsed && typeof parsed.response === 'string' ) return parsed.response;
          if ( parsed && parsed.parsedQuery && typeof parsed.parsedQuery.response === 'string' ) return parsed.parsedQuery.response;
        }

        return s;
      } catch {
        return String( x ?? '' );
      }
    };

    const text = extractText( raw );
    const pre = String( text ?? '' ).replace( /\*\*(.+?)\*\*/g, '<strong>$1</strong>' );
    const markdownToHtml = this.assistantBoxHelperService.convertMarkdownToHtml( pre );
    const withRouteLinks = this.linkifySlashRoutes( markdownToHtml );
    const normalized = this.assistantBoxHelperService.normalizeAssistantHtml( withRouteLinks );

    const msg: AssistantHistoryMessage = { role: 'assistant', content: normalized };

    if ( !externalMode && !parentOwnsHistory ) {
      history.push( msg );
      this.persistHistory( historyStorageKey, externalMode, history );
    } else {
      message.emit( msg );
    }

    if ( externalMode ) {
      history.push( msg );
      this.persistHistory( historyStorageKey, externalMode, history );
    }
  }

  private sleep ( ms: number ): Promise<void> {
    return new Promise( resolve => setTimeout( resolve, ms ) );
  }

  public extractCatalystDraftPayload ( raw: any ): { payload: CatalystAssistantDraftPayload | null; message: string; } {
    let parsed: any = raw;

    if ( parsed && typeof parsed === 'object' && typeof parsed.response === 'string' ) {
      parsed = parsed.response;
    }

    if ( typeof parsed === 'string' ) {
      try {
        let cleaned = parsed.trim()
          .replace( /^```\\s*json\\s*/i, '' )
          .replace( /^```\\s*/i, '' )
          .replace( /```\\s*$/i, '' )
          .replace( /^json\\s*/i, '' )
          .trim();

        parsed = JSON.parse( cleaned );
      } catch {
        return {
          payload: null,
          message: typeof raw?.response === 'string' && raw.response.trim()
            ? raw.response.trim()
            : "I couldn't generate an email draft from that yet."
        };
      }
    }

    if ( !parsed || typeof parsed !== 'object' ) {
      return {
        payload: null,
        message: "I couldn't generate an email draft from that yet."
      };
    }

    const subject = String( parsed.subject || '' ).trim();
    const html = String( parsed.html || parsed.body || '' ).trim();
    const message = String( parsed.message || '' ).trim();

    if ( !subject && !html ) {
      return {
        payload: null,
        message: message || "I couldn't generate an email draft from that yet."
      };
    }

    return {
      payload: { subject, html },
      message: message || 'I drafted an updated version for the current email. Apply it?'
    };
  }

  public getCatalystPageContext ( pageContext: CatalystAssistantContext | EmailSentAssistantContext | null ): CatalystAssistantContext | null {
    if ( !pageContext ) return null;
    return pageContext.page === 'catalyst' ? pageContext : null;
  }

  public buildCatalystDraftPrompt ( userPrompt: string, pageContext: CatalystAssistantContext | EmailSentAssistantContext | null ): string {

    const ctx = this.getCatalystPageContext( pageContext );
    this.logger.info( 'BUILD_CATALYST_PROMPT_CONTEXT', {
      pageContext,
      catalystContext: ctx
    } );
    return [
      'You are generating or rewriting an email draft inside TODD Catalyst.',
      'Return ONLY valid JSON.',
      'Do not use markdown fences.',
      'Do not add commentary outside JSON.',
      '',
      'Current page context:',
      `page: ${ctx?.page || 'unknown'}`,
      `hasPreview: ${ctx?.hasPreview ? 'true' : 'false'}`,
      `currentContactName: ${ctx?.currentContactName || ''}`,
      `currentCompanyName: ${ctx?.currentCompanyName || ''}`,
      `currentContactEmail: ${ctx?.currentContactEmail || ''}`,
      '',
      'Current subject:',
      ctx?.previewSubject || '(none)',
      '',
      'Current email HTML/body:',
      ctx?.previewHtml || '(none)',
      '',
      'User request:',
      userPrompt,
      '',
      'Instructions:',
      ctx?.hasPreview
        ? '- Rewrite the current email draft based on the user request.'
        : '- There is no existing email draft. Create a new email draft from scratch based on the user request.',
      '- Always return an actual email draft, not advice about how to write one.',
      '- Do not explain the style, do not teach, and do not provide a step-by-step guide.',
      '- Write an email someone would actually reply to, not polished marketing copy.',
      '- Sound like one professional writing to another, not like a company brochure.',
      '- Use first-person singular when referring to the sender. Prefer "I" over "we" unless the draft truly needs a team reference.',
      '- Keep it short enough to read in under 30 seconds.',
      '- Use 1-3 short paragraphs, with 1-2 sentences per paragraph.',
      '- Start with a specific observation about the contact, company, role, or thread whenever possible.',
      '- Do not summarize the prospect website or restate their company description back to them.',
      '- Do not open by describing Taliferro or the sender company.',
      '- End with a low-pressure question instead of a pushy pitch.',
      '- Avoid these phrases: "We specialize in", "We help companies", "Our solutions", "Our platform", "Our technology", "We understand", "We know", "We are passionate", "We are excited", "We\'d love to", "seamless", "leverage", "optimize", "streamline", "enhance efficiency", "best-in-class", "industry-leading", "valuable asset".',
      ctx?.hasPreview
        ? '- Keep the response grounded in the existing draft unless the user clearly asks for a full rewrite.'
        : '- Generate a complete email suitable for sending.',
      ctx?.hasPreview
        ? '- Preserve the intent of the current draft while improving it.'
        : '- If contact and company details are blank, still generate a usable draft with a generic greeting.',
      ctx?.hasPreview
        ? '- Return a revised draft.'
        : '- Do not return an empty response. Always provide both a subject and html.',
      '- Return the email subject in "subject".',
      '- Return the full email body as HTML in the "html" field.',
      '- Return a short confirmation sentence in "message".',
      '',
      'Example:',
      '{"subject":"Quick question about TODD","html":"<p>Hi there,</p><p>I wanted to reach out about TODD...</p><p>Best,<br/>Ty</p>","message":"I drafted a new email for Catalyst. Apply it?"}',
      'Return JSON with EXACT keys only:',
      '{"subject":"","html":"","message":""}'
    ].join( '\n' );
  }



  public normalizeInlineReply ( reply: any ): { kind: string; payload: any; apply: { route: string; param?: any | null; }; } | null {
    if ( !reply || !reply.inline ) return null;

    // Already in the shape the template expects
    if ( typeof reply.inline === 'object' && reply.inline.kind ) {
      return reply.inline;
    }

    // Convert raw email draft string into inline emailDraft object
    if ( typeof reply.inline === 'string' && reply.route === '/compose-email' ) {
      const raw = String( reply.inline || '' ).trim();

      let subject = '';
      let body = raw;

      const subjectMatch = raw.match( /^subject\s*:\s*(.+)$/im );
      if ( subjectMatch && subjectMatch[1] ) {
        subject = subjectMatch[1].trim();
        body = raw.replace( /^subject\s*:\s*.+$/im, '' ).trim();
      }

      return {
        kind: 'emailDraft',
        payload: {
          subject,
          body
        },
        apply: {
          route: '/compose-email',
          param: {
            subject,
            body
          }
        }
      };
    }

    // Fallback: generic text card if inline is plain text
    if ( typeof reply.inline === 'string' ) {
      return {
        kind: 'genericText',
        payload: {
          text: String( reply.inline || '' ).trim()
        },
        apply: {
          route: reply.route || '/contact-list',
          param: reply.param || null
        }
      };
    }

    return null;
  }

  public getConfirmActionMessage ( pendingAction: { action: string, param: any; } | null ): string {
    const action = pendingAction?.action;
    const param = pendingAction?.param;

    if ( !action ) return 'Action available.';

    switch ( action ) {
      case 'createKnowledge':
        return 'Add this to the Knowledge Base?';

      case 'navigate':
        if ( typeof param === 'string' ) {
          if ( param.includes( '/contact/' ) ) return 'Open this contact?';
          if ( param.includes( '/contact-list' ) ) return 'Open the Contact List?';
          if ( param.includes( '/compose-email' ) ) return 'Open the email composer?';
          if ( param.includes( '/surveys' ) ) return 'Open this survey?';
          if ( param.includes( '/documents' ) ) return 'Open this document?';
        }
        if ( param?.path ) {
          if ( param.path.includes( '/contact-list' ) ) return 'Open the Contact List?';
          if ( param.path.includes( '/compose-email' ) ) return 'Open the email composer?';
        }
        return 'Open this page?';

      case 'applyAssistantDraftToPreview':
        return 'Apply this draft to the current email preview?';

      case 'createTask':
      case 'addTask':
        return 'Create this task?';

      case 'createSurvey':
        return 'Create this survey?';

      case 'createDocument':
        return 'Create this document?';

      case 'addNewContact':
        return 'Create this contact?';

      case 'updateContactField':
        return 'Update this contact field?';

      case 'addContactField':
        return 'Add this contact detail?';

      default:
        return 'Do you want TODD to do this?';
    }
  }
  // Heuristic: only treat an LLM response as an email draft
  // when the original user prompt clearly asked for an email.
  public looksLikeEmailRequest ( prompt: string ): boolean {
    const p = ( prompt || '' ).toLowerCase();
    if ( !p ) return false;

    const emailKeywords = [
      'write an email',
      'draft an email',
      'cold email',
      'follow-up email',
      'follow up email',
      'compose an email',
      'compose email',
      'email to',
      'outreach email',
      'sales email',
      'intro email',
      'introduction email'
    ];

    // basic signal: contains the word "email" at all
    if ( !p.includes( 'email' ) ) return false;

    // strong signal: contains any of the phrases above
    return emailKeywords.some( k => p.includes( k ) );
  }

  public buildEmailSentBriefingHtml ( ctx: EmailSentAssistantContext ): string {
    const total = Number( ctx.totalEmails || 0 );
    const opened = Number( ctx.openedEmails || 0 );
    const clicked = Number( ctx.clickedEmails || 0 );
    const unopened = Number( ctx.unopenedEmails || Math.max( 0, total - opened ) );

    const openRate = Number( ctx.openRate || ( total > 0 ? Math.round( ( opened / total ) * 100 ) : 0 ) );
    const clickRate = Number( ctx.clickThroughRate || ( total > 0 ? Math.round( ( clicked / total ) * 100 ) : 0 ) );

    const followUpNow = Array.isArray( ctx.followUpNow ) ? ctx.followUpNow : [];
    const warmRecipients = Array.isArray( ctx.warmRecipients ) ? ctx.warmRecipients : [];
    const coldRecipients = Array.isArray( ctx.coldRecipients ) ? ctx.coldRecipients : [];
    const topSubjects = Array.isArray( ctx.topSubjects ) ? ctx.topSubjects : [];

    const followUpHtml = followUpNow.length
      ? `<p><strong>Follow up now:</strong> ${followUpNow.slice( 0, 3 ).map( ( x: any ) => x?.name || x?.email || 'recipient' ).join( ', ' )}${followUpNow.length > 3 ? '…' : ''}</p>`
      : `<p><strong>Follow up now:</strong> none yet.</p>`;

    const warmHtml = warmRecipients.length
      ? `<p><strong>Warm recipients:</strong> ${warmRecipients.slice( 0, 3 ).map( ( x: any ) => x?.name || x?.email || 'recipient' ).join( ', ' )}${warmRecipients.length > 3 ? '…' : ''}</p>`
      : `<p><strong>Warm recipients:</strong> none yet.</p>`;

    const coldHtml = coldRecipients.length
      ? `<p><strong>Cold recipients:</strong> ${coldRecipients.slice( 0, 3 ).map( ( x: any ) => x?.name || x?.email || 'recipient' ).join( ', ' )}${coldRecipients.length > 3 ? '…' : ''}</p>`
      : '';

    const topSubjectHtml = topSubjects.length
      ? `<p><strong>Top subject:</strong> ${topSubjects[0]?.subject || 'n/a'}</p>`
      : '';

    return this.assistantBoxHelperService.normalizeAssistantHtml( `
    <div class="assistant-nudge">
      <p><strong>I reviewed your sent emails.</strong></p>
      <p><strong>Sent:</strong> ${total} &nbsp; <strong>Opened:</strong> ${opened} (${openRate}%) &nbsp; <strong>Not opened:</strong> ${unopened} &nbsp; <strong>Clicked:</strong> ${clicked} (${clickRate}%)</p>
      ${followUpHtml}
      ${warmHtml}
      ${coldHtml}
      ${topSubjectHtml}
      <p>Ask me things like <em>who should I follow up with</em>, <em>what is working</em>, or <em>who looks cold</em>.</p>
    </div>
  ` );
  }

  public buildPageContextSnippet ( pageContext: CatalystAssistantContext | EmailSentAssistantContext | AssistantPageContext | null ): string {
    const ctx = pageContext as any;
    if ( !ctx ) return '';

    const lines: string[] = [];

    if ( ctx.feature ) lines.push( `Feature: ${ctx.feature}` );
    if ( ctx.page ) lines.push( `Page: ${ctx.page}` );
    if ( ctx.mode ) lines.push( `Mode: ${ctx.mode}` );
    if ( ctx.title ) lines.push( `Page title: ${ctx.title}` );
    if ( ctx.description ) lines.push( `Page description: ${ctx.description}` );

    if ( Array.isArray( ctx.allowedActions ) && ctx.allowedActions.length ) {
      lines.push( `Allowed actions: ${ctx.allowedActions.join( ', ' )}` );
    }

    if ( ctx.selectedEntityType ) lines.push( `Selected entity type: ${ctx.selectedEntityType}` );
    if ( ctx.selectedEntityId ) lines.push( `Selected entity id: ${ctx.selectedEntityId}` );

    if ( ctx.summary ) {
      lines.push( `Page summary: ${JSON.stringify( ctx.summary )}` );
    }

    if ( ctx.dataPreview ) {
      lines.push( `Page data preview: ${JSON.stringify( ctx.dataPreview )}` );
    }

    if ( !lines.length ) return '';
    return `\n\n[page-context]\n${lines.join( '\n' )}`;
  }


}
