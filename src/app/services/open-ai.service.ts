import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import { Observable, catchError, tap, throwError } from 'rxjs';
import { Contact } from '../shared/data/interfaces/contact.model';
import { environment } from '../../environments/environment';
import { LoggerService } from './logger.service';
import { DataService } from './data.service';
import { JustText } from '../shared/data/interfaces/just-text.model';

// somewhere in open-ai.service.ts
export interface EmailHookResult {
  hook: string;
  painTheme?: string;
  motivator?: string;
}

export interface EmailDraftingStageOption {
  key: string;
  label: string;
  description: string;
}

export interface EmailDraftingToneOption {
  key: string;
  label: string;
  description: string;
}

export interface EmailDraftingMetadata {
  stages: EmailDraftingStageOption[];
  tones: EmailDraftingToneOption[];
}

export interface StructuredEmailDraftRequest {
  tenantId?: string | null;
  userId?: string | null;
  subject?: string;
  htmlContext?: string;
  selectedContact?: any;
  sender?: any;
  reason?: string | null;
  campaignName?: string | null;
  handoffSource?: string | null;
  draftIntent?: string | null;
  selectedStageKey?: string | null;
  selectedToneKey?: string | null;
  toneCode?: string | null;
  promptMode?: string | null;
  priorSendContext?: any;
  recipientEmail?: string | null;
  threadContactId?: string | null;
  threadId?: string | null;
  threadCampaignId?: string | null;
  threadCampaignName?: string | null;
  threadDraftKind?: string | null;
  senderPersona?: string | null;
  rewriteMode?: boolean | null;
  rejectedDraftSubject?: string | null;
  rejectedDraftBody?: string | null;
}

export interface StructuredEmailDraftResponse {
  subject: string;
  bodyHtml: string;
  summary: string;
  draftMode: string;
  sourceContextType: string;
  metadata?: any;
}

export const FOLLOW_UP_REASONS = {
  'Reply Required': 10,
  'Pending Questions': 10,
  'Campaign Interaction': 10,
  'Contract/Agreement Follow-Up': 10,
  'Out-of-Office Reply': 5,
  'Event Attendance': 5,
  'Periodic Check-In': 5,
  'Inactive Period': 5,
  'Unopened Emails': 2,
  'Profile Update': 2,
  'Birthday/Anniversary': 2,
  'Random Follow-Up': 2,
  // Add other reasons as necessary
};

@Injectable( {
  providedIn: 'root'
} )
export class OpenAIService {


  // Data Quality Assessment
  contactAnalysis = [
    { "name": "Missing Information:", "description": "Identify contacts with missing critical information (e.g., email addresses, phone numbers) and prioritize updating them." },
    { "name": "Data Consistency", "description": "Check for inconsistencies in data (e.g., different formats for phone numbers) and standardize the entries." },
    { "name": "Duplicate Contacts", "description": "Identify and merge duplicate contacts to maintain a clean database." }
  ];

  // Tasks Analysis
  taskCompletionRateAnalysis = [
    { "name": "Objective", "description": "Measure and improve task completion efficiency" },
    { "name": "On-time Completion", "description": "Track the percentage of tasks completed on or before their due dates." },
    { "name": "Delayed Tasks", "description": "Identify tasks that are frequently delayed and analyze the reasons for delays (e.g., complexity, dependency issues)." },
    { "name": "Completion Trends", "description": "Analyze trends in task completion rates over time to identify periods of high or low productivity." }
  ];

  taskPrioritizationAnalysis = [
    { "name": "Objective", "description": "Ensure high-priority tasks are being addressed." },
    { "name": "High-priority Focus", "description": "Analyze the completion rate of high-priority tasks versus lower-priority ones." },
    { "name": "Task Backlog", "description": "Identify and quantify the backlog of high-priority tasks that are not yet completed." }
  ];

  resourceAllocationAnalysis = [
    { "name": "Objective", "description": "Optimize the allocation of resources (contacts) to tasks." },
    { "name": "Contact Workload", "description": "Analyze the distribution of tasks among contacts to identify workload imbalances." },
    { "name": "Contact Performance", "description": "Evaluate the performance of individual contacts based on their task completion rates and timeliness." }
  ];

  progressTrackingAnalysis = [
    { "name": "Objective", "description": "Monitor and improve task progress tracking." },
    { "name": "Progress Metrics", "description": "Track the progress of tasks using metrics such as percentage completed, hours spent versus estimated, and milestone achievements." },
    { "name": "Stalled Tasks", "description": "Identify tasks with little or no progress over extended periods and analyze potential causes." }
  ];

  taskDependenciesAnalysis = [
    { "name": "Objective", "description": "Manage and optimize task dependencies." },
    { "name": "Dependency Analysis", "description": "Identify and map out task dependencies to understand potential bottlenecks and critical paths." },
    { "name": "Dependency Resolution", "description": "Analyze the impact of delayed tasks on dependent tasks and overall project timelines." }
  ];

  taskTypesAndCategoriesAnalysis = [
    { "name": "Objective", "description": "Analyze the effectiveness of different task types and categories." },
    { "name": "Task Type Performance", "description": "Evaluate the completion rates and average time to complete for different task types (e.g., development, testing, documentation)." },
    { "name": "Category Analysis:", "description": "Identify which categories of tasks (if categorized) are most frequently delayed or completed successfully." }
  ];

  timeManagementAnalysis = [
    { "name": "Objective", "description": "Improve time management and estimation accuracy." },
    { "name": "Time Estimates vs. Actuals", "description": "Compare estimated time to complete tasks versus actual time spent to identify estimation accuracy." },
    { "name": "imer Data", "description": "Analyze timer start and end times to understand how long tasks take and identify time management issues." }
  ];

  constructor ( private http: HttpClient, private logger: LoggerService, private dataService: DataService ) { }


  getTemplateTokenAssistance ( prompt: string, user: string, contact?: Contact ): Observable<any> {
    this.logger.log( "Calling", `${environment.backendURL}/template-tokens`, "With this message", prompt );
    if ( user ) {
      this.dataService.logEvent( 'Calling OpenAI getTemplateTokenAssistance', user );
    }
    const apiKey = environment.apiKey;
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${apiKey}` );
    const body: any = { prompt };
    if ( contact ) {
      body.contact = contact;
    }
    return this.http.post<any>( `${environment.backendURL}/template-tokens`, body, { headers } );
  }

  getAIResponse ( prompt: string, user: string ): Observable<any> {
    this.logger.log( "Calling", `${environment.backendURL}/openai`, "With this message", prompt );
    if ( user )
      this.dataService.logEvent( 'Calling OpenAI getAIResponse', user ); // Log event
    const apiKey = environment.apiKey; // Use the actual API key here
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${apiKey}` );
    return this.http.post<any>( `${environment.backendURL}/openai`, { prompt: prompt }, { headers } );
  }

  getAIParsedQuery ( query: string, user: string ): Observable<any> {
    this.logger.log( "Calling", `${environment.backendURL}/parse-query`, "With this message", JSON.stringify( query ) );
    if ( user )
      this.dataService.logEvent( 'Calling OpenAI getAIParsedQuery', user ); // Log event
    const apiKey = environment.apiKey; // Use the actual API key here
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${apiKey}` );
    return this.http.post<any>( `${environment.backendURL}/parse-query`, { query: query }, { headers } );
  }

  getProspectQuery (
    prompt: string | { history: string; pageContext?: any; profileContext?: any; },
    user: string
  ): Observable<any> {
    const history = typeof prompt === 'string' ? prompt : prompt?.history || '';
    const pageContext = typeof prompt === 'string' ? null : prompt?.pageContext || null;
    const profileContext = typeof prompt === 'string' ? null : prompt?.profileContext || null;

    this.logger.log( "Calling", `${environment.backendURL}/prospect-query`, "With this message", history );
    if ( user )
      this.dataService.logEvent( 'Calling OpenAI ProspectQuery', user ); // Log event
    const apiKey = environment.apiKey; // Use the actual API key here
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${apiKey}` );
    return this.http.post<any>( `${environment.backendURL}/prospect-query`, {
      prompt: history,
      pageContext,
      profileContext
    }, { headers } );
  }

  getSuggestions (): Observable<string[]> {
    this.logger.log( "Calling", `${environment.backendURL}/suggestions` );
    const apiKey = environment.apiKey; // Use the actual API key here
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${apiKey}` );
    return this.http.post<any>( `${environment.backendURL}/suggestions`, { headers } );
  }

  getEmailCampaignDrafts ( campaignData: any ): Observable<string[]> {
    this.logger.log( "Calling", `${environment.backendURL}/create-campaign`, "With this data", campaignData );
    const apiKey = environment.apiKey; // Use the actual API key here
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${apiKey}` );
    return this.http.post<any>( `${environment.backendURL}/create-campaign`, { campaignData: campaignData }, { headers } );
  }

  getContactSearchSuggestions ( payload: { prompt: string, context: string; } ): Observable<string[]> {
    this.logger.log( "Calling", `${environment.backendURL}/filtering-suggestions` );
    const apiKey = environment.apiKey; // Use the actual API key here
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${apiKey}` );
    return this.http.post<any>( `${environment.backendURL}/filtering-suggestions`, { headers } );
  }

  proposalAssistant ( document: string, rfp: any, proposals: any[], user: string ): Observable<any> {
    const prompt = `
    You are a government RFP proposal writer for a tech consulting firm. Based on the RFP document and the company’s historical proposals, generate a proposal that includes:

    - Cover letter
    - Company qualifications
    - Technical approach
    - Key staff
    - Relevant past performance
    - Pricing section (placeholder)

    Use the structure and tone from the attached reference proposals. Use the company’s known certifications, services, and project history.

    If any required information is missing, insert a [PLACEHOLDER] for user to complete.`;

    this.logger.log( "Calling", `${environment.backendURL}/document-helper`, "With this message", JSON.stringify( document ) );
    if ( user )
      this.dataService.logEvent( 'Calling OpenAI Document Assistant', user ); // Log event
    const apiKey = environment.apiKey; // Use the actual API key here
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${apiKey}` );
    return this.http.post<any>( `${environment.backendURL}/document-helper`, { document: document, prompt: prompt, rfp: rfp, proposals: proposals }, { headers } );
  }

  getEmailCraftingAssistance ( prompt: string, user: string, contact?: Contact ): Observable<any> {
    this.logger.log( "Calling", `${environment.backendURL}/email-assistant`, "With this message", prompt );
    if ( user )
      this.dataService.logEvent( 'Calling OpenAI getAIParsedQuery', user ); // Log event
    const apiKey = environment.apiKey; // Use the actual API key here
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${apiKey}` );
    const body: any = { prompt };
    if ( contact ) {
      body.contact = contact;
    }
    return this.http.post<any>( `${environment.backendURL}/email-assistant`, body, { headers } );
  }

  getEmailDraftingMetadata (): Observable<{ success: boolean; data: EmailDraftingMetadata; }> {
    this.logger.log( "Calling", `${environment.backendURL}/email-drafting/metadata` );
    const apiKey = environment.apiKey;
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${apiKey}` );
    return this.http.get<{ success: boolean; data: EmailDraftingMetadata; }>(
      `${environment.backendURL}/email-drafting/metadata`,
      { headers }
    );
  }

  requestStructuredEmailDraft (
    payload: StructuredEmailDraftRequest,
    user: string
  ): Observable<{ success: boolean; data: StructuredEmailDraftResponse; }> {
    this.logger.log( "Calling", `${environment.backendURL}/email-drafting/draft`, "With payload", {
      subject: payload?.subject || '',
      handoffSource: payload?.handoffSource || null,
      draftIntent: payload?.draftIntent || null,
      selectedStageKey: payload?.selectedStageKey || null,
      selectedToneKey: payload?.selectedToneKey || payload?.toneCode || null,
      reason: String( payload?.reason || '' ).trim() || null
    } );
    if ( user ) {
      this.dataService.logEvent( 'Calling OpenAI requestStructuredEmailDraft', user );
    }
    const apiKey = environment.apiKey;
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${apiKey}` );
    return this.http.post<{ success: boolean; data: StructuredEmailDraftResponse; }>(
      `${environment.backendURL}/email-drafting/draft`,
      payload,
      { headers }
    );
  }

  documentEditorAssistant ( instructions: string, html: string, user: string ): Observable<any> {
    this.logger.log( "Calling", `${environment.backendURL}/document-helper`, "With this message", prompt, html );
    if ( user )
      this.dataService.logEvent( 'Calling OpenAI DocumentEditor', user ); // Log event
    const apiKey = environment.apiKey; // Use the actual API key here
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${apiKey}` );
    const body: any = { instructions, html };
    return this.http.post<any>( `${environment.backendURL}/document-helper`, body, { headers } );
  }

  /**
   * Normalize arbitrary data into a domain-shaped payload.
   * - Accepts raw arrays (e.g., Task[], Doc[], Survey[], Contact[]) and wraps them.
   * - Accepts objects already shaped ({ tasks|docs|surveys|contacts }) and passes through.
   * - Returns null only when there's nothing useful to send.
   */
  private wrapDataForDomain (
    domain: 'general' | 'task' | 'document' | 'survey' | 'contact' | 'prospect',
    data?: any
  ): any | null {
    if ( !data ) return null;

    // If caller passed an array directly, wrap it according to the domain
    if ( Array.isArray( data ) ) {
      switch ( domain ) {
        case 'task': return { tasks: data };
        case 'document': return { docs: data };
        case 'survey': return { surveys: data };
        case 'contact': return { contacts: data };
        case 'general': return { items: data };
        default: return null;
      }
    }

    // If caller passed an object, pass-through when already shaped
    if ( typeof data === 'object' ) {
      if ( domain === 'task' && ( Array.isArray( data.tasks ) || Array.isArray( data ) ) ) return Array.isArray( data ) ? { tasks: data } : data;
      if ( domain === 'document' && Array.isArray( ( data as any ).docs ) ) return data;
      if ( domain === 'survey' && Array.isArray( ( data as any ).surveys ) ) return data;
      if ( domain === 'contact' && Array.isArray( ( data as any ).contacts ) ) return data;

      // Heuristic: if it looks like a single entity (has id/title/name), wrap as single-item list
      const looksLikeEntity = ( obj: any ) =>
        obj && ( obj.id || obj.title || obj.name || obj.email || obj.company );

      if ( looksLikeEntity( data ) ) {
        switch ( domain ) {
          case 'task': return { tasks: [data] };
          case 'document': return { docs: [data] };
          case 'survey': return { surveys: [data] };
          case 'contact': return { contacts: [data] };
          case 'general': return data;
          default: return null;
        }
      }

      if ( domain === 'general' ) return data;
    }

    return data;
  }

  getLandingPageCustomization ( profile: any, context: string = 'home' ): Observable<any> {
    this.logger.log( "Calling", `${environment.backendURL}/landing-personalize` );
    const apiKey = environment.apiKey;
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${apiKey}` );

    const payload = { profile, context };

    return this.http.post<any>( `${environment.backendURL}/landing-personalize`, payload, { headers } );
  }

  getToddLandingPersonalization ( profile: any, query?: string ): Observable<any> {
    this.logger.log( "Calling", `${environment.backendURL}/todd-landing-personalize` );
    const apiKey = environment.apiKey;
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${apiKey}` );
    return this.http.post<any>( `${environment.backendURL}/todd-landing-personalize`, { profile, query }, { headers } );
  }


  getAssistance ( prompt: string, domain: 'general' | 'task' | 'document' | 'survey' | 'contact' | 'prospect', user?: string, data?: any ): Observable<any> {
    this.logger.log( "Calling", `${environment.backendURL}/app-assistant`, "With this message", prompt );
    const apiKey = environment.apiKey;
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${apiKey}` );
    const payload = {
      prompt,
      domain,
      data: this.wrapDataForDomain( domain, data )
    };
    return this.http
      .post<any>( `${environment.backendURL}/app-assistant`, payload, { headers } )
      .pipe(
        tap( ( res ) => {
          try {
            const keys = res && typeof res === 'object' ? Object.keys( res ) : null;
            this.logger.info( 'APP_ASSISTANT_RAW_RESPONSE', {
              domain,
              keys,
              type: typeof res,
              preview: typeof res === 'string'
                ? res.slice( 0, 500 )
                : JSON.stringify( res ).slice( 0, 800 )
            } );
          } catch ( e ) {
            this.logger.info( 'APP_ASSISTANT_RAW_RESPONSE', { domain, type: typeof res } );
          }
        } ),
        catchError( ( err: any ) => {
          this.logger.error( 'APP_ASSISTANT_ERROR', { domain, err } );
          return throwError( () => err );
        } )
      );
  }

  getProspectAssistantResponse ( prompt: string, userId: string, data?: any ) {
    return this.getAssistance( prompt, 'prospect', 'public', data );
  }

  getDocumentAssistantResponse ( prompt: string, userId: string, data: any ) {
    return this.getAssistance( prompt, 'document', userId, data );
  }
  getSurveyAssistantResponse ( prompt: string, userId: string, data: any ) {
    return this.getAssistance( prompt, 'survey', userId, data );
  }
  getContactAssistantResponse ( prompt: string, userId: string, data: any ) {
    return this.getAssistance( prompt, 'contact', userId, data );
  }
  getTaskAssistantResponse ( prompt: string, userId: string, data: any ) {
    return this.getAssistance( prompt, 'task', userId, data );
  }

  getDocumentAssistance ( prompt: string, user: string ): Observable<any> {
    prompt += " - In your response use no more than 300 words";
    this.logger.log( "Calling", `${environment.backendURL}/document-assistant`, "With this message", prompt );
    if ( user )
      this.dataService.logEvent( 'Calling OpenAI getDocumentAssistance', user ); // Log event
    const apiKey = environment.apiKey; // Use the actual API key here
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${apiKey}` );
    return this.http.post<any>( `${environment.backendURL}/document-assistant`, { prompt: prompt }, { headers } );
  }


  analyzeNote ( note: JustText, contact: Contact ): Observable<any> {
    let content = `${note.subject}. ${note.body}`;
    if ( contact && contact.firstName && contact.lastName )
      content += ` - Contact name is ${contact.firstName} ${contact.lastName}.`;
    if ( contact && contact.company && contact.company.name )
      content += ` - Contact company is ${contact.company.name}`;

    this.logger.log( "Calling", `${environment.backendURL}/note-analyzer`, "With this message", content );

    const apiKey = environment.apiKey;
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${apiKey}` );
    return this.http.post<any>( `${environment.backendURL}/note-analyzer`, { content }, { headers } );
  }

  getTaskOrAssistantResponse ( prompt: string, user: string ): Observable<any> {
    this.logger.log( "Calling", `${environment.backendURL}/assistant-query`, "With this message", prompt );

    if ( user ) {
      this.dataService.logEvent( 'Calling OpenAI getTaskOrAssistantResponse', user );
    }

    const apiKey = environment.apiKey;
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${apiKey}` );

    return this.http.post<any>( `${environment.backendURL}/assistant-query`, { prompt }, { headers } );
  }

  getEmailHook ( context: any, user: string ): Observable<EmailHookResult> {
    this.logger.log( "Calling", `${environment.backendURL}/email-hook`, "With this context", context );

    if ( user ) {
      this.dataService.logEvent( 'Calling OpenAI email-hook', user );
    }

    const apiKey = environment.apiKey;
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${apiKey}` );

    return this.http.post<any>( `${environment.backendURL}/email-hook`, { context }, { headers } );
  }



  analyzeEmail ( prompt: string, user: string ): Observable<any> {
    this.logger.log( "Calling", `${environment.backendURL}/analyze-email`, "With this message", prompt );
    if ( user )
      this.dataService.logEvent( 'Calling OpenAI analyzeEmail', user ); // Log event

    const apiKey = environment.apiKey; // Use the actual API key here
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${apiKey}` );
    return this.http.post<any>( `${environment.backendURL}/analyze-email`, { prompt: prompt }, { headers } );
  }

  /**
   * Sends a grammar check request for a given prompt text.
   *
   * @param {string} prompt - The text prompt to be checked for grammar.
   * @param {string} user - The user identifier.
   * @returns {Observable<any>} An Observable that, when subscribed to, will provide the grammar check results.
   */
  grammarCheck ( prompt: string, user: string ): Observable<any> {
    this.logger.log( "Calling", `${environment.backendURL}/grammar-check`, "With this message", prompt );

    const apiKey = environment.apiKey; // Use the actual API key here
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${apiKey}` );
    return this.http.post<any>( `${environment.backendURL}/grammar-check`, { prompt: prompt }, { headers } );
  }


  /**
   * Sends a match analysis request to the backend service and returns an Observable of the response.
   *
   * @param {any} body - The payload containing match information to be analyzed.
   * @returns {Observable<any>} An Observable that will emit the result of the match analysis.
   */
  analyzeMatches ( body: any ): Observable<any> {
    this.logger.log( "Calling", `${environment.backendURL}/matchmaker-analyzer`, "With this message", JSON.stringify( body ) );

    const apiKey = environment.apiKey; // Use the actual API key here
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${apiKey}` );
    return this.http.post<any>( `${environment.backendURL}/matchmaker-analyzer`, body, { headers } );
  }


  /**
   * Analyze the given profile content to extract contact information.
   *
   * @param {string} profile - The profile content to be analyzed.
   * @param {string} user - The user id for event logging purposes.
   * @return {Observable<any>} An Observable that emits the result of the contact information analysis.
   */
  analyzeContentForContact ( profile: string, user: string ): Observable<any> {
    this.logger.log( "Calling", `${environment.backendURL}/parse-for-contact`, "With this message", JSON.stringify( profile ) );
    if ( user )
      this.dataService.logEvent( 'Calling OpenAI getDocumentAssistance', user ); // Log event

    const apiKey = environment.apiKey; // Use the actual API key here
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${apiKey}` );

    return this.http.post<any>( `${environment.backendURL}/parse-for-contact`, { profile: profile }, { headers } );
  }

  /**
   * Fills in missing company information for a provided contact.
   * @param contact - The contact object to be enriched with company information.
   * @param user - The username of the user requesting the information.
   * @returns - An Observable that will emit the result of the HTTP POST request.
   */
  fillInCompanyInfo ( contact: Contact, user: string, tenantId?: string ): Observable<any> {
    const cleanContact = { ...contact };

    // Remove noisy or long fields
    if ( cleanContact.emails ) {
      delete cleanContact.emails;
    }
    if ( cleanContact.notes ) {
      delete cleanContact.notes;
    }
    if ( cleanContact.images ) {
      delete cleanContact.images;
    }

    this.logger.log( "Calling", `${environment.backendURL}/enrich-contact`, "With this message", JSON.stringify( cleanContact ), 'And this tenant', tenantId );
    if ( user )
      this.dataService.logEvent( 'Calling OpenAI fillInCompanyInfo', user ); // Log event

    const apiKey = environment.apiKey; // Use the actual API key here
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${apiKey}` );

    const body: any = {
      profile: "Please fill in missing company information for the following contact: " +
        JSON.stringify( cleanContact.company ) +
        " - Provide company address, phone number, type, capabilities, categories, sector and recent news (in the publicInfo field). If no company name provide in contact, try to decipher company information from the email addresses if not one of the popular email providers."
    };

    // Pass tenantId when provided so the backend can load tenant-defined categories.
    if ( tenantId && tenantId !== 'undefined' && tenantId !== '' && tenantId !== 'null' ) {
      body.tenantId = tenantId;
    }

    return this.http.post<any>( `${environment.backendURL}/enrich-contact`, body, { headers } );
  }

  /**
   * Reconfigures a given contact object, removing unnecessary fields and makes a POST request to the backend.
   * It logs the events and sends a clean version of the contact information to the backend.
   *
   * @param {Contact} contact - The contact object to be cleaned and processed.
   * @param {string} user - The username of the person performing the reconfiguration.
   * @returns {Observable<any>} - An Observable that will emit the result of the backend operation.
   */
  reconfigureContact ( contact: Contact, user: string ): Observable<any> {
    const cleanContact = { ...contact };

    // Remove noisy or long fields
    if ( cleanContact.emails ) {
      delete cleanContact.emails;
    }
    if ( cleanContact.notes ) {
      delete cleanContact.notes;
    }
    if ( cleanContact.images ) {
      delete cleanContact.images;
    }

    this.logger.log( "Calling", `${environment.backendURL}/reconfigure-contact`, "With this message", JSON.stringify( cleanContact ) );
    if ( user )
      this.dataService.logEvent( 'Calling OpenAI fillInCompanyInfo', user ); // Log event
    const apiKey = environment.apiKey; // Use the actual API key here
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${apiKey}` );
    return this.http.post<any>( `${environment.backendURL}/reconfigure-contact`, { profile: JSON.stringify( cleanContact ) }, { headers } );
  }

  /**
   * Sends a POST request to the backend to analyze the best customer insight.
   * @param {Contact[]} contacts - An array of Contact objects to be analyzed.
   * @returns {Observable<any>} An Observable that will emit the results of the analysis.
   */
  bestInsight ( contacts: Contact[] ): Observable<any> {
    this.logger.log( "Calling", `${environment.backendURL}/best-customer-analysis`, JSON.stringify( contacts ) );
    const apiKey = environment.apiKey; // Use the actual API key here
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${apiKey}` );
    return this.http.post<any>( `${environment.backendURL}/best-customer-analysis`, { contacts: contacts }, { headers } );
  }


  /**
   * Fetches insights for a given contact by making a POST request to the backend API.
   * It uses the Contact object to create the profile in the request body and sets the
   * Authorization header with a Bearer token.
   * @param {Contact} contact The Contact object containing the details to fetch insights for.
   * @returns {Observable<any>} An Observable that, when subscribed, will send the request and emit the response.
   */
  contactInsight ( contact: Contact ): Observable<any> {
    this.logger.log( "Calling", `${environment.backendURL}/contact-insight`, JSON.stringify( contact ) );
    const apiKey = environment.apiKey; // Use the actual API key here
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${apiKey}` );
    return this.http.post<any>( `${environment.backendURL}/contact-insight`, { profile: contact }, { headers } );
  }

  /**
   * Fetches the status of suggested contacts for a specific tenant.
   *
   * @param tenantId - The unique identifier for the tenant.
   * @param user - The user initiating the request.
   * @returns An Observable that emits the response from the server.
   */
  suggestedContactsStatus ( tenantId: string, user: string ): Observable<any> {
    // /suggested-contacts
    this.logger.log( "Calling", `${environment.backendURL}/suggested-contacts/status`, "TenantId", tenantId );
    const apiKey = environment.apiKey; // Use the actual API key here
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${apiKey}` );
    return this.http.post<any>( `${environment.backendURL}/suggested-contacts/status`, { tenantId }, { headers } );
  }

  /**
   * Retrieves a list of suggested contacts for a given tenant.
   * @param tenantId The unique identifier for the tenant.
   * @param user The user requesting the suggested contacts.
   * @returns An Observable emitting the suggested contacts data.
   */
  suggestedContacts ( tenantId: string, user: string ): Observable<any> {
    // /suggested-contacts
    this.logger.log( "Calling", `${environment.backendURL}/suggested-contacts`, "TenantId", tenantId );
    const apiKey = environment.apiKey; // Use the actual API key here
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${apiKey}` );
    return this.http.post<any>( `${environment.backendURL}/suggested-contacts`, { tenantId }, { headers } );
  }

  /**
   * Initiates the OpenAI contact analysis process by sending a POST request with the tenant ID.
   *
   * @param {string} tenantId - The unique identifier for the tenant whose contacts are to be analyzed.
   * @param {string} user - The username initiating the request (unused in the current implementation).
   * @returns {Observable<any>} - An Observable that emits the result of the HTTP request.
   */
  startSuggestedContacts ( tenantId: string, user: string ): Observable<any> {
    const apiKey = environment.apiKey;
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${apiKey}` );
    this.logger.log( "🚀 Starting OpenAI contact analysis for", tenantId );
    return this.http.post<any>( `${environment.backendURL}/suggested-contacts/start`, { tenantId }, { headers } );
  }

  /**
   * Initiates the processing of contacts for a specific tenant and user.
   *
   * Logs the action and sends a POST request to start the contact processing at the backend server.
   * Requires tenantId and userId to associate the contact processing with the correct entities.
   *
   * @param {string} tenantId - The identifier of the tenant.
   * @param {string} userId - The identifier of the user.
   * @returns {Observable<any>} An Observable that emits the result of the backend operation.
   */
  processContacts ( tenantId: string, userId: string ): Observable<any> {
    this.logger.log( "Calling", `${environment.backendURL}/start-contact-processing`, "TenantId", tenantId, "UserId", userId );
    if ( userId )
      this.dataService.logEvent( 'Process Contacts', userId ); // Log event

    const apiKey = environment.apiKey; // Use the actual API key here
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${apiKey}` );
    return this.http.post<any>( `${environment.backendURL}/start-contact-processing`, { tenantId, userId }, { headers } );

  }

}
