import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import { environment } from '../../../../environments/environment';

export interface PublicMarketingDirectorMessage {
  id: string;
  role: 'user' | 'director';
  content: string;
  renderedContent?: string;
}

export interface PublicMarketingDirectorSystemActionQuestion {
  questionText: string;
  questionType?: string;
  options?: string[];
  required?: boolean;
}

export type PublicMarketingDirectorSystemActionType =
  | 'create_document'
  | 'create_move'
  | 'create_survey'
  | 'create_response_flow'
  | 'send_email';

export interface PublicMarketingDirectorSystemAction {
  type: PublicMarketingDirectorSystemActionType;
  title?: string;
  description?: string;
  summary?: string;
  body?: string;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent' | null;
  ownerLabel?: string;
  question?: string;
  response?: string;
  category?: string;
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  questions?: PublicMarketingDirectorSystemActionQuestion[];
}

interface PublicMarketingDirectorResponse {
  reply: string;
  executionIntent: boolean;
  systemActions?: PublicMarketingDirectorSystemAction[];
}

// A single Move/action, carrying enough real detail for Maya to explain why
// it's blocked or what it delivered - not just its title. blockerNote and
// deliverableSummary/deliverableUrl are left undefined (not empty strings)
// when nothing was actually recorded, so the backend prompt can tell Maya to
// say so plainly instead of inventing a reason or a deliverable.
export interface MarketingDirectorMoveContextItem {
  title: string;
  status?: string;
  progress?: number;
  blocked?: boolean;
  blockerNote?: string;
  deliverableSummary?: string;
  deliverableUrl?: string;
}

export interface PublicMarketingDirectorWorkspaceContext {
  tenantId?: string;
  companyName?: string;
  companyDescription?: string;
  mission?: string;
  offerSummary?: string;
  operatorName?: string;
  accessModeLabel?: string;
  hasActivePlan?: boolean;
  availableSystems?: string[];
  currentWorkItems?: MarketingDirectorMoveContextItem[];
  pendingApprovalItems?: MarketingDirectorMoveContextItem[];
  completedWorkItems?: MarketingDirectorMoveContextItem[];
  recentOutcomeSummary?: string;
  recentOutcomeDetails?: string;
  marketingKpis?: Array<{
    label: string;
    value: string;
    detail?: string;
  }>;
  weeklyGoals?: Array<{
    label: string;
    baseline: string;
    target: string;
    status?: string;
  }>;
  toddHandoff?: {
    owner: string;
    summary: string;
    nextActions: string[];
    routes?: string[];
  } | null;
  emailContext?: {
    subject: string;
    bodyText: string;
    recipientName?: string;
    recipientCompany?: string;
  } | null;
}

export interface PublicMarketingDirectorEmailContext {
  subject: string;
  bodyText: string;
  recipientName?: string;
  recipientCompany?: string;
}

export type PublicMarketingDirectorAccessMode =
  | 'free'
  | 'suite';

@Injectable( {
  providedIn: 'root'
} )
export class PublicMarketingDirectorService {
  constructor ( private readonly http: HttpClient ) {}

  async askDirector (
    message: string,
    history: PublicMarketingDirectorMessage[],
    accessMode: PublicMarketingDirectorAccessMode = 'free',
    workspaceContext?: PublicMarketingDirectorWorkspaceContext | null
  ): Promise<PublicMarketingDirectorResponse> {
    const apiKey = environment.apiKey;
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${apiKey}` );
    const response = await this.http.post<{ response: PublicMarketingDirectorResponse; }>(
      `${environment.backendURL}/marketing-director/advice`,
      {
        message: String( message || '' ).trim(),
        accessMode,
        workspaceContext: workspaceContext || null,
        history: ( history || [] ).slice( -10 ).map( item => ( {
          role: item.role,
          content: item.content
        } ) )
      },
      { headers }
    ).toPromise();

    if ( !response?.response?.reply ) {
      throw new Error( 'Marketing Director did not return a usable reply.' );
    }

    return response.response;
  }

  // The visitor here is the email's recipient, not a logged-in TODD user -
  // there's no session to derive tenantId from, so it travels in the link
  // itself (query param) and gets sent as a header, same pattern already
  // used by other unauthenticated-but-tenant-scoped lookups in this app.
  async fetchEmailContext ( emailId: string, tenantId: string ): Promise<PublicMarketingDirectorEmailContext | null> {
    const safeEmailId = String( emailId || '' ).trim();
    const safeTenantId = String( tenantId || '' ).trim();
    if ( !safeEmailId || !safeTenantId ) return null;

    try {
      const apiKey = environment.apiKey;
      const headers = new HttpHeaders()
        .set( 'Authorization', `Bearer ${apiKey}` )
        .set( 'x-tenant-id', safeTenantId );
      const response = await this.http.get<{ success: boolean; data?: any; }>(
        `${environment.backendURL}/outreach/emails/${encodeURIComponent( safeEmailId )}`,
        { headers }
      ).toPromise();

      const record = response?.data;
      if ( !record ) return null;

      const subject = String( record.subject || '' ).trim();
      const bodyText = String( record.text || '' ).trim();
      if ( !subject && !bodyText ) return null;

      return {
        subject,
        bodyText,
        recipientName: String( record.contactName || '' ).trim() || undefined,
        recipientCompany: String( record.companyName || '' ).trim() || undefined
      };
    } catch {
      return null;
    }
  }
}
