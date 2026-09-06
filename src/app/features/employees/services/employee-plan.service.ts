import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import {
  EmployeeActionRecord,
  EmployeePlanExtractedPayload,
  EmployeePlanPreview,
  EmployeeRecord
} from '../models/employee.models';
import { EmployeeService } from './employee.service';
import { environment } from '../../../../environments/environment';

interface EmployeePlanExtractionResponse {
  title: string;
  extracted: EmployeePlanExtractedPayload;
  proposedActions: Array<Partial<EmployeeActionRecord>>;
}

@Injectable( {
  providedIn: 'root'
} )
export class EmployeePlanService {
  constructor (
    private readonly employeeService: EmployeeService,
    private readonly http: HttpClient
  ) {}

  async buildPreview (
    rawText: string,
    employee: EmployeeRecord,
    options?: {
      planKind?: EmployeePlanPreview['planKind'];
      sourceFileName?: string;
      sourceFileUrl?: string;
    }
  ): Promise<EmployeePlanPreview> {
    const normalizedText = String( rawText || '' ).trim();
    const planKind = options?.planKind || 'pasted';

    try {
      const aiPreview = await this.requestAiExtraction( normalizedText, employee, {
        planKind,
        sourceFileName: options?.sourceFileName,
        sourceFileUrl: options?.sourceFileUrl
      } );

      if ( aiPreview ) {
        return aiPreview;
      }
    } catch {
      // Fall back to local extraction below.
    }

    return this.buildPreviewLocally( normalizedText, employee, options );
  }

  async savePreviewAsPlan (
    tenantId: string,
    employeeId: string,
    preview: EmployeePlanPreview
  ): Promise<{ planId: string; actionIds: string[]; }> {
    const planId = await this.employeeService.createPlan( tenantId, {
      employeeId,
      employeeType: 'marketing',
      title: preview.title,
      planKind: preview.planKind,
      rawText: preview.rawText,
      extracted: preview.extracted,
      status: 'active',
      sourceFileName: preview.sourceFileName,
      sourceFileUrl: preview.sourceFileUrl
    } );

    const actionIds: string[] = [];
    for ( const action of preview.proposedActions ) {
      const actionId = await this.employeeService.createAction( tenantId, {
        employeeId,
        employeeType: 'marketing',
        type: action.type,
        title: action.title,
        description: action.description,
        channel: action.channel,
        status: action.status,
        priority: action.priority,
        reasoning: action.reasoning,
        contentDraft: action.contentDraft,
        scheduledFor: action.scheduledFor || null,
        sourcePlanId: planId,
        origin: 'plan_ingestion',
        approvalRequired: action.approvalRequired === true
      } );
      actionIds.push( actionId );
    }

    return { planId, actionIds };
  }

  private buildPreviewLocally (
    rawText: string,
    employee: EmployeeRecord,
    options?: {
      planKind?: EmployeePlanPreview['planKind'];
      sourceFileName?: string;
      sourceFileUrl?: string;
    }
  ): EmployeePlanPreview {
    const normalizedText = String( rawText || '' ).trim();
    const planKind = options?.planKind || 'pasted';
    const extracted = this.extractPlanData( normalizedText, employee );
    const proposedActions = this.buildProposedActions( extracted, employee );

    return {
      title: this.resolveTitle( normalizedText, extracted ),
      planKind,
      rawText: normalizedText,
      extracted,
      proposedActions,
      sourceFileName: options?.sourceFileName,
      sourceFileUrl: options?.sourceFileUrl
    };
  }

  private async requestAiExtraction (
    rawText: string,
    employee: EmployeeRecord,
    options: {
      planKind: EmployeePlanPreview['planKind'];
      sourceFileName?: string;
      sourceFileUrl?: string;
    }
  ): Promise<EmployeePlanPreview | null> {
    const apiKey = environment.apiKey;
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${apiKey}` );
    const response = await this.http.post<{ response: EmployeePlanExtractionResponse; }>(
      `${environment.backendURL}/employee/extract-plan`,
      {
        rawText,
        employee,
        employeeType: employee.type,
        sourceType: this.normalizeMarketingSourceType( options.planKind ),
        sourceFileName: options.sourceFileName || null
      },
      { headers }
    ).toPromise();

    const payload = response?.response;
    if ( !payload?.title || !payload?.extracted ) {
      return null;
    }

    const extracted: EmployeePlanExtractedPayload = {
      goals: this.sanitizeList( payload.extracted.goals, 6, employee.goals ),
      audiences: this.sanitizeList( payload.extracted.audiences, 6, employee.contextProfile?.audiences || [] ),
      channels: this.sanitizeList( payload.extracted.channels, 8, employee.contextProfile?.channels || [] ),
      campaigns: this.sanitizeList( payload.extracted.campaigns, 6 ),
      themes: this.sanitizeList( payload.extracted.themes, 8, employee.contextProfile?.themes || [] ),
      kpis: this.sanitizeList( payload.extracted.kpis, 8 ),
      timeline: String( payload.extracted.timeline || '' ).trim(),
      priorities: this.sanitizeList( payload.extracted.priorities, 8, employee.contextProfile?.priorities || [] )
    };

    const fallbackActions = this.buildProposedActions( extracted, employee );
    const proposedActions = ( payload.proposedActions || [] ).length
      ? payload.proposedActions.slice( 0, 6 ).map( ( action, index ) => this.toProposedAction( action, employee, extracted, fallbackActions[index] ) )
      : fallbackActions;

    return {
      title: String( payload.title || '' ).trim() || this.resolveTitle( rawText, extracted ),
      planKind: options.planKind,
      rawText,
      extracted,
      proposedActions,
      sourceFileName: options.sourceFileName,
      sourceFileUrl: options.sourceFileUrl
    };
  }

  private toProposedAction (
    action: Partial<EmployeeActionRecord>,
    employee: EmployeeRecord,
    extracted: EmployeePlanExtractedPayload,
    fallback?: EmployeeActionRecord
  ): EmployeeActionRecord {
    const base = fallback || this.buildProposedActions( extracted, employee )[0];
    return {
      employeeId: '',
      employeeType: employee.type,
      type: this.normalizeActionType( action.type ) || base.type,
      domainTags: [...( action.domainTags || base.domainTags || [] )],
      title: String( action.title || '' ).trim() || base.title,
      description: String( action.description || '' ).trim() || base.description,
      channel: String( action.channel || '' ).trim() || base.channel,
      status: this.normalizeActionStatus( action.status ) || base.status,
      priority: this.normalizePriority( action.priority ) || base.priority,
      reasoning: String( action.reasoning || '' ).trim() || base.reasoning,
      contentDraft: String( action.contentDraft || '' ).trim() || base.contentDraft,
      scheduledFor: null,
      sourcePlanId: null,
      origin: 'plan_ingestion',
      approvalRequired: action.approvalRequired === true ? true : base.approvalRequired === true
    };
  }

  private sanitizeList ( value: string[] | undefined, maxItems: number, fallback: string[] = [] ): string[] {
    const normalized = Array.from(
      new Set( [ ...( value || [] ), ...fallback ].map( item => String( item || '' ).trim() ).filter( Boolean ) )
    );
    return normalized.slice( 0, maxItems );
  }

  private normalizeActionType ( value: string | undefined ): string | null {
    const normalized = String( value || '' ).trim().toLowerCase();
    if ( normalized === 'social_post' || normalized === 'email' || normalized === 'blog' || normalized === 'seo_fix' || normalized === 'campaign' || normalized === 'research' ) {
      return normalized;
    }
    return null;
  }

  private normalizeActionStatus ( value: string | undefined ): EmployeeActionRecord['status'] | null {
    const normalized = String( value || '' ).trim().toLowerCase();
    if ( normalized === 'draft' || normalized === 'needs_approval' ) {
      return normalized;
    }
    return null;
  }

  private normalizePriority ( value: string | undefined ): EmployeeActionRecord['priority'] | null {
    const normalized = String( value || '' ).trim().toLowerCase();
    if ( normalized === 'low' || normalized === 'medium' || normalized === 'high' ) {
      return normalized;
    }
    return null;
  }

  private extractPlanData ( rawText: string, employee: EmployeeRecord ): EmployeePlanExtractedPayload {
    const lines = rawText
      .split( /\r?\n/ )
      .map( line => line.trim() )
      .filter( Boolean );
    const sentenceChunks = rawText
      .split( /[\n\.!\?]+/ )
      .map( chunk => chunk.trim() )
      .filter( chunk => chunk.length > 12 );

    return {
      goals: this.pickList(
        this.collectHeadingItems( lines, ['goal', 'objective', 'target'] ),
        this.collectKeywordMatches( sentenceChunks, ['goal', 'objective', 'increase', 'grow', 'improve', 'launch'] ),
        employee.goals,
        5
      ),
      audiences: this.pickList(
        this.collectHeadingItems( lines, ['audience', 'persona', 'segment', 'customer'] ),
        this.collectKeywordMatches( sentenceChunks, ['audience', 'customer', 'buyer', 'prospect', 'lead', 'client'] ),
        employee.contextProfile?.audiences || [],
        5
      ),
      channels: this.pickList(
        this.collectHeadingItems( lines, ['channel', 'distribution', 'platform'] ),
        this.collectKnownTerms( rawText, ['Email', 'LinkedIn', 'Facebook', 'Instagram', 'X', 'Threads', 'YouTube', 'Blog', 'SEO', 'Website', 'Webinar'] ),
        employee.contextProfile?.channels || [],
        6
      ),
      campaigns: this.pickList(
        this.collectHeadingItems( lines, ['campaign', 'initiative', 'launch'] ),
        this.collectKeywordMatches( sentenceChunks, ['campaign', 'launch', 'promotion', 'series'] ),
        [],
        5
      ),
      themes: this.pickList(
        this.collectHeadingItems( lines, ['theme', 'message', 'content', 'topic'] ),
        this.collectKeywordMatches( sentenceChunks, ['content', 'theme', 'message', 'story', 'proof', 'insight'] ),
        employee.contextProfile?.themes || [],
        6
      ),
      kpis: this.pickList(
        this.collectHeadingItems( lines, ['kpi', 'metric', 'measure'] ),
        this.collectKnownTerms( rawText, ['CTR', 'Open rate', 'Replies', 'Leads', 'Meetings booked', 'Traffic', 'Conversions', 'Pipeline'] ),
        [],
        6
      ),
      timeline: this.resolveTimeline( rawText, lines ),
      priorities: this.pickList(
        this.collectHeadingItems( lines, ['priority', 'focus'] ),
        this.collectKeywordMatches( sentenceChunks, ['priority', 'focus', 'first', 'important'] ),
        employee.contextProfile?.priorities || [],
        5
      )
    };
  }

  private buildProposedActions (
    extracted: EmployeePlanExtractedPayload,
    employee: EmployeeRecord
  ): EmployeeActionRecord[] {
    const primaryGoal = extracted.goals[0] || employee.goals[0] || 'increase qualified activity';
    const primaryAudience = extracted.audiences?.[0] || employee.contextProfile?.audiences?.[0] || 'priority audience';
    const primaryChannel = extracted.channels?.[0] || employee.contextProfile?.channels?.[0] || 'marketing';
    const voice = employee.persona?.voice || 'Clear, direct, practical, and confident.';
    const primaryCampaign = extracted.campaigns?.[0] || 'current campaign';
    const primaryTheme = extracted.themes?.[0] || 'practical insight';
    const timeline = extracted.timeline || 'the current operating window';

    return [
      {
        employeeId: '',
        employeeType: employee.type,
        type: this.mapChannelToActionType( primaryChannel ),
        domainTags: [employee.type],
        title: `Draft ${primaryChannel.toLowerCase()} asset for ${primaryCampaign}`,
        description: `Prepare a draft asset that supports ${primaryGoal} for ${primaryAudience}.`,
        channel: primaryChannel,
        status: 'needs_approval',
        priority: 'high',
        reasoning: `The plan centers on ${primaryGoal}. This draft turns the plan into reviewable work without enabling external execution.`,
        contentDraft: `Audience: ${primaryAudience}\nTheme: ${primaryTheme}\nVoice: ${voice}\nTimeline: ${timeline}`,
        scheduledFor: null,
        sourcePlanId: null,
        origin: 'plan_ingestion',
        approvalRequired: true
      },
      {
        employeeId: '',
        employeeType: employee.type,
        type: 'campaign',
        domainTags: [employee.type],
        title: `Break ${primaryCampaign} into approval-safe checkpoints`,
        description: 'Turn the campaign into staged review items with timeline, KPI focus, and clear next approvals.',
        channel: 'campaign',
        status: 'draft',
        priority: 'high',
        reasoning: 'The operator needs campaign checkpoints before any real-world launch decisions happen.',
        contentDraft: `Checkpoint summary:\n- Goal: ${primaryGoal}\n- KPI focus: ${( extracted.kpis?.[0] || 'primary KPI' )}\n- Timeline: ${timeline}`,
        scheduledFor: null,
        sourcePlanId: null,
        origin: 'plan_ingestion',
        approvalRequired: false
      },
      {
        employeeId: '',
        employeeType: employee.type,
        type: 'research',
        domainTags: [employee.type],
        title: `Research supporting proof for ${primaryAudience}`,
        description: 'Collect proof points, objections, and positioning support that strengthen the planned work.',
        channel: 'research',
        status: 'draft',
        priority: 'medium',
        reasoning: 'Plan ingestion should also surface the supporting research needed to improve draft quality.',
        contentDraft: `Find proof tied to ${primaryGoal} and objections likely to matter for ${primaryAudience}.`,
        scheduledFor: null,
        sourcePlanId: null,
        origin: 'plan_ingestion',
        approvalRequired: false
      }
    ];
  }

  private collectHeadingItems ( lines: string[], keywords: string[] ): string[] {
    const results: string[] = [];
    for ( const line of lines ) {
      const lower = line.toLowerCase();
      if ( !keywords.some( keyword => lower.includes( keyword ) ) ) {
        continue;
      }

      const cleaned = line
        .replace( /^[-*•\d\.\)\s]+/, '' )
        .replace( /^[a-z\s]+:/i, '' )
        .trim();

      if ( cleaned.length > 3 ) {
        results.push( cleaned );
      }
    }
    return results;
  }

  private collectKeywordMatches ( chunks: string[], keywords: string[] ): string[] {
    return chunks.filter( chunk => keywords.some( keyword => chunk.toLowerCase().includes( keyword ) ) ).slice( 0, 10 );
  }

  private collectKnownTerms ( rawText: string, terms: string[] ): string[] {
    return terms.filter( term => new RegExp( `\\b${term.replace( /[-/\\^$*+?.()|[\]{}]/g, '\\$&' )}\\b`, 'i' ).test( rawText ) );
  }

  private pickList ( ...groups: Array<string[] | number> ): string[] {
    const maxItems = Number( groups[groups.length - 1] );
    const lists = groups.slice( 0, -1 ) as string[][];
    return Array.from(
      new Set(
        lists
          .flat()
          .map( item => String( item || '' ).trim() )
          .filter( Boolean )
      )
    ).slice( 0, maxItems );
  }

  private resolveTimeline ( rawText: string, lines: string[] ): string {
    const timelineLine = lines.find( line => /(timeline|schedule|quarter|month|week|deadline)/i.test( line ) );
    if ( timelineLine ) {
      return timelineLine.replace( /^[a-z\s]+:/i, '' ).trim();
    }

    const match = rawText.match( /\b(q[1-4]|quarter|month|week|30 days|60 days|90 days)\b/i );
    return match ? match[0] : '';
  }

  private resolveTitle ( rawText: string, extracted: EmployeePlanExtractedPayload ): string {
    const heading = rawText
      .split( /\r?\n/ )
      .map( line => line.trim() )
      .find( line => line.length > 4 && line.length < 80 );

    if ( heading ) {
      return heading;
    }

    if ( extracted.campaigns?.[0] ) {
      return extracted.campaigns[0];
    }

    if ( extracted.goals[0] ) {
      return extracted.goals[0];
    }

    return 'Employee plan';
  }

  private mapChannelToActionType ( channel: string ): string {
    const normalized = String( channel || '' ).trim().toLowerCase();
    if ( /email/.test( normalized ) ) return 'email';
    if ( /seo/.test( normalized ) ) return 'seo_fix';
    if ( /blog|website/.test( normalized ) ) return 'blog';
    if ( /campaign|webinar/.test( normalized ) ) return 'campaign';
    if ( /research|analysis/.test( normalized ) ) return 'research';
    return 'social_post';
  }

  private normalizeMarketingSourceType ( planKind: EmployeePlanPreview['planKind'] ): 'pasted' | 'uploaded' | 'generated' {
    if ( planKind === 'uploaded' || planKind === 'generated' ) {
      return planKind;
    }
    return 'pasted';
  }
}
