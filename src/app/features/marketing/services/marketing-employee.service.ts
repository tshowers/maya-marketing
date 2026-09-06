import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Firestore, collection, collectionData, doc, docData } from '@angular/fire/firestore';
import { Observable, combineLatest, map, of, catchError } from 'rxjs';
import {
  QueryConstraint,
  Timestamp,
  addDoc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';

import {
  DEFAULT_MARKETING_EMPLOYEE_AUTHORITY,
  DEFAULT_MARKETING_EMPLOYEE_ID,
  DEFAULT_MARKETING_EMPLOYEE_RECORD,
  MarketingActionPriority,
  MarketingActionStatus,
  MarketingActionType,
  MarketingEmployeeActionRecord,
  MarketingEmployeeConversationMessageRecord,
  MarketingEmployeeConversationRecord,
  MarketingEmployeeOutcomeRecord,
  MarketingEmployeeRecord,
  MarketingEmployeeWorkspaceSnapshot,
  MarketingPlanExtractedPayload,
  MarketingPlanRecord
} from '../models/marketing-employee.models';
import { TaskService } from '../../../services/task.service';
import { Task } from '../../../shared/data/interfaces/task.model';
import { environment } from '../../../../environments/environment';

export interface MayaRunStepStatus { key: string; label: string; status: string; detail?: string; metadata?: Record<string, unknown>; }
export interface MayaQueueHealth {
  blocked: boolean;
  taskBlocked: boolean;
  draftBlocked: boolean;
  socialPostBlocked: boolean;
  detail: string;
  expiryDays: number;
  counts: {
    openTaskCount: number;
    openDraftCount: number;
    openSocialPostCount: number;
    taskLimit: number;
    draftLimit: number;
    socialPostLimit: number;
  };
}
export interface MayaRunStatusResponse { tenantId: string; dateKey: string; latestRun: { status?: string; sourceEntrypoint?: string; steps?: MayaRunStepStatus[]; updatedAt?: string } | null; runs: Array<{ status?: string; sourceEntrypoint?: string; steps?: MayaRunStepStatus[]; updatedAt?: string }>; queueHealth?: MayaQueueHealth | null; }
export interface MayaDailyActionRecord { id: string; type: 'email' | 'social_post'; status: 'draft' | 'approved' | 'needs_approval' | 'completed' | 'rejected'; title: string; description: string; moveId: string | null; monitorRoute: string | null; }
export interface MayaDailyActionsResponse { tenantId: string; dateKey: string; currentWork: MayaDailyActionRecord[]; pendingApprovals: MayaDailyActionRecord[]; completedWork: MayaDailyActionRecord[]; }

interface MarketingPlanStatusInput {
  tone?: string;
  headline?: string;
  summary?: string;
  detail?: string;
  nextAction?: string;
  blindspots?: string[];
  metrics?: Array<{
    label: string;
    value: string;
    detail?: string;
  }>;
}

type MarketingDailyPlanReviewMode =
  | 'inbound_recovery'
  | 'send_recovery'
  | 'conversion_recovery'
  | 'approval_recovery'
  | 'general';

export interface MarketingDailyPlanGenerationResult {
  createdIds: string[];
  updatedIds: string[];
  pausedIds: string[];
  reviewMode: MarketingDailyPlanReviewMode;
  reviewSummary: string;
}

interface MarketingDailyStrategyProfile {
  reviewMode: MarketingDailyPlanReviewMode;
  primaryGoal: string;
  secondaryGoal: string;
  primaryAudience: string;
  secondaryAudience: string;
  primaryChannel: string;
  secondaryChannel: string;
  primaryCampaign: string;
  secondaryCampaign: string;
  primaryTheme: string;
  secondaryTheme: string;
  primaryAngle: string;
  secondaryAngle: string;
  primaryKpi: string;
  timeline: string;
  tone: string;
  focusLabel: string;
}

@Injectable( {
  providedIn: 'root'
} )
export class MarketingEmployeeService {
  private readonly firestore = inject( Firestore );
  private readonly taskService = inject( TaskService );
  private readonly http = inject( HttpClient );

  getMayaRunStatus ( tenantId: string, dateKey: string ) {
    return this.http.get<{ success: boolean; data: MayaRunStatusResponse | null }>( `${environment.backendURL}/momentum/maya-runs/status`, {
      params: { tenantId, dateKey }
    } ).pipe( catchError( () => of( { success: false, data: null } ) ) );
  }

  // Real Maya pipeline state (momentumThreads/outreach-social-posts), not the
  // separate marketing-employee planner's employee-actions brief/placeholder
  // tasks - this is what the Status page's Pipeline/Scorecard/Today's Work
  // tabs should render, since it reflects what Maya has actually drafted,
  // sent, or is waiting on the user for.
  getMayaDailyActions ( tenantId: string, dateKey: string ) {
    return this.http.get<{ success: boolean; data: MayaDailyActionsResponse | null }>( `${environment.backendURL}/momentum/maya-status/daily-actions`, {
      params: { tenantId, dateKey }
    } ).pipe( catchError( () => of( { success: false, data: null } ) ) );
  }

  getDefaultEmployeeId (): string {
    return DEFAULT_MARKETING_EMPLOYEE_ID;
  }

  watchEmployee ( tenantId: string, employeeId: string = DEFAULT_MARKETING_EMPLOYEE_ID ): Observable<MarketingEmployeeRecord | null> {
    const normalizedTenantId = this.normalizeRequiredValue( tenantId, 'tenantId' );
    const normalizedEmployeeId = this.normalizeRequiredValue( employeeId, 'employeeId' );
    const employeeRef = doc( this.firestore, `tenants/${normalizedTenantId}/employees/${normalizedEmployeeId}` );

    return docData( employeeRef, { idField: 'id' } ).pipe(
      map( record => record ? this.toMarketingEmployeeRecord( record ) : null )
    );
  }

  async getEmployee ( tenantId: string, employeeId: string = DEFAULT_MARKETING_EMPLOYEE_ID ): Promise<MarketingEmployeeRecord | null> {
    const normalizedTenantId = this.normalizeRequiredValue( tenantId, 'tenantId' );
    const normalizedEmployeeId = this.normalizeRequiredValue( employeeId, 'employeeId' );
    const employeeRef = doc( this.firestore, `tenants/${normalizedTenantId}/employees/${normalizedEmployeeId}` );
    const snapshot = await getDoc( employeeRef );
    return snapshot.exists() ? this.toMarketingEmployeeRecord( { id: snapshot.id, ...snapshot.data() } ) : null;
  }

  async getOrCreateEmployee ( tenantId: string, seed?: Partial<MarketingEmployeeRecord> ): Promise<MarketingEmployeeRecord> {
    const normalizedTenantId = this.normalizeRequiredValue( tenantId, 'tenantId' );
    const employeeId = this.normalizeRequiredValue( seed?.id || DEFAULT_MARKETING_EMPLOYEE_ID, 'employeeId' );
    const employeeRef = doc( this.firestore, `tenants/${normalizedTenantId}/employees/${employeeId}` );
    const snapshot = await getDoc( employeeRef );

    if ( snapshot.exists() ) {
      return this.toMarketingEmployeeRecord( { id: snapshot.id, ...snapshot.data() } );
    }

    const payload = this.buildEmployeePayload( {
      ...DEFAULT_MARKETING_EMPLOYEE_RECORD,
      ...seed,
      id: employeeId,
      authority: {
        ...DEFAULT_MARKETING_EMPLOYEE_AUTHORITY,
        ...( seed?.authority || {} )
      }
    } );

    await setDoc( employeeRef, payload, { merge: true } );
    return this.toMarketingEmployeeRecord( { id: employeeId, ...payload } );
  }

  async saveEmployeeSettings (
    tenantId: string,
    employeeId: string,
    updates: Partial<MarketingEmployeeRecord>
  ): Promise<void> {
    const normalizedTenantId = this.normalizeRequiredValue( tenantId, 'tenantId' );
    const normalizedEmployeeId = this.normalizeRequiredValue( employeeId, 'employeeId' );
    const employeeRef = doc( this.firestore, `tenants/${normalizedTenantId}/employees/${normalizedEmployeeId}` );
    const payload = this.buildEmployeePayload( updates, false );
    await setDoc( employeeRef, payload, { merge: true } );
  }

  watchActionsByStatus (
    tenantId: string,
    employeeId: string,
    statuses: MarketingActionStatus[],
    options?: { limit?: number; plannedForDate?: string; }
  ): Observable<MarketingEmployeeActionRecord[]> {
    const normalizedTenantId = this.normalizeRequiredValue( tenantId, 'tenantId' );
    const normalizedEmployeeId = this.normalizeRequiredValue( employeeId, 'employeeId' );
    const normalizedStatuses = Array.from( new Set( ( statuses || [] ).map( status => String( status || '' ).trim().toLowerCase() ).filter( Boolean ) ) ) as MarketingActionStatus[];

    if ( normalizedStatuses.length === 0 ) {
      return of( [] );
    }

    const actionsRef = collection( this.firestore, `tenants/${normalizedTenantId}/employee-actions` );
    const constraints: QueryConstraint[] = [
      where( 'employeeId', '==', normalizedEmployeeId ),
      where( 'status', 'in', normalizedStatuses )
    ];

    // Matches the exact dateKey format scheduledMarketingEmployeePlanner.js's
    // todayPlanDate() stamps on every action it creates (plain UTC
    // YYYY-MM-DD, already the field its own listDailyActionsForDate query
    // filters on) - opt-in only, so callers that legitimately want all-time
    // work (marketing-director-session's oversight view) are unaffected.
    if ( options?.plannedForDate ) {
      constraints.push( where( 'plannedForDate', '==', options.plannedForDate ) );
    }

    constraints.push( orderBy( 'updatedAt', 'desc' ) );

    if ( typeof options?.limit === 'number' && Number.isFinite( options.limit ) ) {
      constraints.push( limit( Math.max( 1, Math.min( options.limit, 100 ) ) ) );
    }

    const actionsQuery = query( actionsRef, ...constraints );

    return collectionData( actionsQuery, { idField: 'id' } ).pipe(
      map( records => records.map( record => this.toMarketingEmployeeActionRecord( record ) ) )
    );
  }

  watchCurrentWork ( tenantId: string, employeeId: string, options?: { plannedForDate?: string; } ): Observable<MarketingEmployeeActionRecord[]> {
    return this.watchActionsByStatus( tenantId, employeeId, ['draft', 'approved', 'paused'], options );
  }

  watchPendingApprovals ( tenantId: string, employeeId: string, options?: { plannedForDate?: string; } ): Observable<MarketingEmployeeActionRecord[]> {
    return this.watchActionsByStatus( tenantId, employeeId, ['needs_approval'], options );
  }

  watchCompletedWork ( tenantId: string, employeeId: string, options?: { plannedForDate?: string; } ): Observable<MarketingEmployeeActionRecord[]> {
    return this.watchActionsByStatus( tenantId, employeeId, ['completed', 'rejected'], options );
  }

  watchWorkspaceSnapshot ( tenantId: string, employeeId: string, options?: { plannedForDate?: string; } ): Observable<MarketingEmployeeWorkspaceSnapshot> {
    return combineLatest( [
      this.watchEmployee( tenantId, employeeId ),
      this.watchCurrentWork( tenantId, employeeId, options ),
      this.watchPendingApprovals( tenantId, employeeId, options ),
      this.watchCompletedWork( tenantId, employeeId, options )
    ] ).pipe(
      map( ( [employee, currentWork, pendingApprovals, completedWork] ) => ( {
        employee,
        currentWork,
        pendingApprovals,
        completedWork
      } ) )
    );
  }

  async createAction (
    tenantId: string,
    action: Omit<MarketingEmployeeActionRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    const normalizedTenantId = this.normalizeRequiredValue( tenantId, 'tenantId' );
    const actionsRef = collection( this.firestore, `tenants/${normalizedTenantId}/employee-actions` );
    const payload = this.buildActionPayload( action );
    const docRef = await addDoc( actionsRef, payload );
    return docRef.id;
  }

  async updateAction (
    tenantId: string,
    actionId: string,
    updates: Partial<MarketingEmployeeActionRecord>
  ): Promise<void> {
    const normalizedTenantId = this.normalizeRequiredValue( tenantId, 'tenantId' );
    const normalizedActionId = this.normalizeRequiredValue( actionId, 'actionId' );
    const actionRef = doc( this.firestore, `tenants/${normalizedTenantId}/employee-actions/${normalizedActionId}` );
    const payload = this.buildActionPayload( updates, false );
    await setDoc( actionRef, payload, { merge: true } );
  }

  async updateActionStatus (
    tenantId: string,
    actionId: string,
    status: MarketingActionStatus,
    extraUpdates: Partial<MarketingEmployeeActionRecord> = {}
  ): Promise<void> {
    const normalizedTenantId = this.normalizeRequiredValue( tenantId, 'tenantId' );
    const normalizedActionId = this.normalizeRequiredValue( actionId, 'actionId' );
    const actionRef = doc( this.firestore, `tenants/${normalizedTenantId}/employee-actions/${normalizedActionId}` );
    const payload = this.buildActionPayload( { ...extraUpdates, status }, false );
    await setDoc( actionRef, payload, { merge: true } );
  }

  async createMarketingPlan (
    tenantId: string,
    plan: Omit<MarketingPlanRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    const normalizedTenantId = this.normalizeRequiredValue( tenantId, 'tenantId' );
    const plansRef = collection( this.firestore, `tenants/${normalizedTenantId}/marketing-plans` );
    const payload = {
      ...plan,
      employeeType: String( plan.employeeType || 'marketing' ).trim().toLowerCase(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    const docRef = await addDoc( plansRef, payload );
    return docRef.id;
  }

  async updateMarketingPlan (
    tenantId: string,
    planId: string,
    updates: Partial<MarketingPlanRecord>
  ): Promise<void> {
    const normalizedTenantId = this.normalizeRequiredValue( tenantId, 'tenantId' );
    const normalizedPlanId = this.normalizeRequiredValue( planId, 'planId' );
    const planRef = doc( this.firestore, `tenants/${normalizedTenantId}/marketing-plans/${normalizedPlanId}` );
    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp()
    };

    if ( updates.employeeId !== undefined ) {
      payload['employeeId'] = String( updates.employeeId || '' ).trim();
    }

    if ( updates.employeeType !== undefined ) {
      payload['employeeType'] = String( updates.employeeType || 'marketing' ).trim().toLowerCase();
    }

    if ( updates.title !== undefined ) {
      payload['title'] = String( updates.title || '' ).trim();
    }

    if ( updates.sourceType !== undefined ) {
      payload['sourceType'] = String( updates.sourceType || 'generated' ).trim().toLowerCase();
    }

    if ( updates.rawText !== undefined ) {
      payload['rawText'] = String( updates.rawText || '' ).trim();
    }

    if ( updates.extracted !== undefined ) {
      payload['extracted'] = {
        goals: this.normalizeStringArray( updates.extracted?.goals ),
        audiences: this.normalizeStringArray( updates.extracted?.audiences ),
        channels: this.normalizeStringArray( updates.extracted?.channels ),
        campaigns: this.normalizeStringArray( updates.extracted?.campaigns ),
        contentThemes: this.normalizeStringArray( updates.extracted?.contentThemes ),
        kpis: this.normalizeStringArray( updates.extracted?.kpis ),
        timeline: String( updates.extracted?.timeline || '' ).trim()
      };
    }

    if ( updates.status !== undefined ) {
      payload['status'] = String( updates.status || 'active' ).trim().toLowerCase();
    }

    if ( updates.sourceFileName !== undefined ) {
      payload['sourceFileName'] = this.normalizeNullableString( updates.sourceFileName );
    }

    if ( updates.sourceFileUrl !== undefined ) {
      payload['sourceFileUrl'] = this.normalizeNullableString( updates.sourceFileUrl );
    }

    await setDoc( planRef, payload, { merge: true } );
  }

  watchMarketingPlans (
    tenantId: string,
    employeeId: string,
    options?: { status?: MarketingPlanRecord['status']; limit?: number; }
  ): Observable<MarketingPlanRecord[]> {
    const normalizedTenantId = this.normalizeRequiredValue( tenantId, 'tenantId' );
    const normalizedEmployeeId = this.normalizeRequiredValue( employeeId, 'employeeId' );
    const plansRef = collection( this.firestore, `tenants/${normalizedTenantId}/marketing-plans` );
    const constraints: QueryConstraint[] = [
      where( 'employeeId', '==', normalizedEmployeeId ),
      orderBy( 'updatedAt', 'desc' )
    ];

    if ( options?.status ) {
      constraints.unshift( where( 'status', '==', options.status ) );
    }

    if ( typeof options?.limit === 'number' && Number.isFinite( options.limit ) ) {
      constraints.push( limit( Math.max( 1, Math.min( options.limit, 50 ) ) ) );
    }

    return collectionData( query( plansRef, ...constraints ), { idField: 'id' } ).pipe(
      map( records => records.map( record => this.toMarketingPlanRecord( record ) ) )
    );
  }

  async createConversation (
    tenantId: string,
    conversation: Omit<MarketingEmployeeConversationRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    const normalizedTenantId = this.normalizeRequiredValue( tenantId, 'tenantId' );
    const conversationsRef = collection( this.firestore, `tenants/${normalizedTenantId}/employee-conversations` );
    const payload = {
      ...conversation,
      employeeType: String( conversation.employeeType || 'marketing' ).trim().toLowerCase(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    const docRef = await addDoc( conversationsRef, payload );
    return docRef.id;
  }

  watchConversations (
    tenantId: string,
    employeeId: string,
    options?: { limit?: number; }
  ): Observable<MarketingEmployeeConversationRecord[]> {
    const normalizedTenantId = this.normalizeRequiredValue( tenantId, 'tenantId' );
    const normalizedEmployeeId = this.normalizeRequiredValue( employeeId, 'employeeId' );
    const conversationsRef = collection( this.firestore, `tenants/${normalizedTenantId}/employee-conversations` );
    const constraints: QueryConstraint[] = [
      where( 'employeeId', '==', normalizedEmployeeId ),
      orderBy( 'updatedAt', 'desc' )
    ];

    if ( typeof options?.limit === 'number' && Number.isFinite( options.limit ) ) {
      constraints.push( limit( Math.max( 1, Math.min( options.limit, 50 ) ) ) );
    }

    return collectionData( query( conversationsRef, ...constraints ), { idField: 'id' } ).pipe(
      map( records => records.map( record => this.toMarketingEmployeeConversationRecord( record ) ) )
    );
  }

  watchOutcomes (
    tenantId: string,
    employeeId: string,
    options?: { limit?: number; }
  ): Observable<MarketingEmployeeOutcomeRecord[]> {
    const normalizedTenantId = this.normalizeRequiredValue( tenantId, 'tenantId' );
    const normalizedEmployeeId = this.normalizeRequiredValue( employeeId, 'employeeId' );
    const outcomesRef = collection( this.firestore, `tenants/${normalizedTenantId}/employee-outcomes` );
    const constraints: QueryConstraint[] = [
      where( 'employeeId', '==', normalizedEmployeeId ),
      orderBy( 'reviewedAt', 'desc' )
    ];

    if ( typeof options?.limit === 'number' && Number.isFinite( options.limit ) ) {
      constraints.push( limit( Math.max( 1, Math.min( options.limit, 100 ) ) ) );
    }

    return collectionData( query( outcomesRef, ...constraints ), { idField: 'id' } ).pipe(
      map( records => records.map( record => this.toMarketingEmployeeOutcomeRecord( record ) ) )
    );
  }

  async createOutcome (
    tenantId: string,
    outcome: Omit<MarketingEmployeeOutcomeRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    const normalizedTenantId = this.normalizeRequiredValue( tenantId, 'tenantId' );
    const outcomesRef = collection( this.firestore, `tenants/${normalizedTenantId}/employee-outcomes` );
    const payload = {
      employeeId: String( outcome.employeeId || '' ).trim(),
      employeeType: String( outcome.employeeType || 'marketing' ).trim().toLowerCase(),
      actionId: this.normalizeNullableString( outcome.actionId ),
      planId: this.normalizeNullableString( outcome.planId ),
      outcomeKind: this.normalizeNullableString( outcome.outcomeKind ),
      periodKey: this.normalizeNullableString( outcome.periodKey ),
      status: String( outcome.status || 'neutral' ).trim().toLowerCase(),
      signalSource: String( outcome.signalSource || '' ).trim(),
      summary: String( outcome.summary || '' ).trim(),
      details: this.normalizeNullableString( outcome.details ),
      metrics: this.normalizeOutcomeMetrics( outcome.metrics ),
      weeklyGoals: this.normalizeOutcomeGoals( outcome.weeklyGoals ),
      handoff: this.normalizeOutcomeHandoff( outcome.handoff ) || null,
      reviewedAt: this.normalizeNullableString( outcome.reviewedAt ) || new Date().toISOString(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    const docRef = await addDoc( outcomesRef, payload );
    return docRef.id;
  }

  watchConversationMessages (
    tenantId: string,
    conversationId: string,
    options?: { limit?: number; }
  ): Observable<MarketingEmployeeConversationMessageRecord[]> {
    const normalizedTenantId = this.normalizeRequiredValue( tenantId, 'tenantId' );
    const normalizedConversationId = this.normalizeRequiredValue( conversationId, 'conversationId' );
    const messagesRef = collection(
      this.firestore,
      `tenants/${normalizedTenantId}/employee-conversations/${normalizedConversationId}/messages`
    );
    const constraints: QueryConstraint[] = [
      orderBy( 'createdAt', 'asc' )
    ];

    if ( typeof options?.limit === 'number' && Number.isFinite( options.limit ) ) {
      constraints.push( limit( Math.max( 1, Math.min( options.limit, 200 ) ) ) );
    }

    return collectionData( query( messagesRef, ...constraints ), { idField: 'id' } ).pipe(
      map( records => records.map( record => this.toMarketingEmployeeConversationMessageRecord( normalizedConversationId, record ) ) )
    );
  }

  async appendConversationMessage (
    tenantId: string,
    conversationId: string,
    message: Omit<MarketingEmployeeConversationMessageRecord, 'id' | 'createdAt'>
  ): Promise<string> {
    const normalizedTenantId = this.normalizeRequiredValue( tenantId, 'tenantId' );
    const normalizedConversationId = this.normalizeRequiredValue( conversationId, 'conversationId' );
    const messagesRef = collection(
      this.firestore,
      `tenants/${normalizedTenantId}/employee-conversations/${normalizedConversationId}/messages`
    );

    const payload: Record<string, unknown> = {
      role: String( message.role || 'employee' ).trim().toLowerCase(),
      content: String( message.content || '' ).trim(),
      relatedActionIds: this.normalizeStringArray( message.relatedActionIds ),
      createdAt: serverTimestamp()
    };

    const normalizedActionIntent = this.normalizeNullableString( message.actionIntent );
    if ( normalizedActionIntent ) {
      payload['actionIntent'] = normalizedActionIntent;
    }

    const docRef = await addDoc( messagesRef, payload );

    const conversationRef = doc( this.firestore, `tenants/${normalizedTenantId}/employee-conversations/${normalizedConversationId}` );
    await updateDoc( conversationRef, { updatedAt: serverTimestamp() } );
    return docRef.id;
  }

  async generateDailyMarketingPlan (
    tenantId: string,
    employeeId: string = DEFAULT_MARKETING_EMPLOYEE_ID
  ): Promise<MarketingDailyPlanGenerationResult> {
    return this.generateDailyMarketingPlanFromPlan( tenantId, employeeId, null );
  }

  async generateDailyMarketingPlanFromPlan (
    tenantId: string,
    employeeId: string = DEFAULT_MARKETING_EMPLOYEE_ID,
    activePlan: MarketingPlanRecord | null = null,
    planStatus: MarketingPlanStatusInput | null = null
  ): Promise<MarketingDailyPlanGenerationResult> {
    const employee = await this.getOrCreateEmployee( tenantId, { id: employeeId } );
    const openActions = await this.getOpenActions( tenantId, employeeId );
    const existingDrafts = openActions.length;
    const desiredActionCount = existingDrafts > 0 ? 3 : 4;
    const reviewMode = this.resolveDailyPlanReviewMode( planStatus );
    const todayPlanDate = this.getTodayPlanDate();
    const generatedActions = this.buildSampleDailyPlan(
      employee,
      desiredActionCount,
      activePlan,
      planStatus
    );
    const existingDailyPlanActions = this.selectReviewableDailyPlanActions(
      openActions,
      activePlan?.id || null
    );
    const createdIds: string[] = [];
    const updatedIds: string[] = [];
    const pausedIds: string[] = [];
    const matchedExistingActionIds = new Set<string>();
    const usedTemplateKeys = new Set<string>();

    for ( const existingAction of existingDailyPlanActions ) {
      const template = this.findMatchingDailyPlanTemplate( generatedActions, existingAction );
      if ( !template ) {
        continue;
      }

      const nextStatus = this.resolveReviewedActionStatus( existingAction.status, template.status );
      const templateKey = this.buildDailyPlanActionKey( template );
      const updates: Partial<MarketingEmployeeActionRecord> = {
        ...template,
        employeeId,
        sourcePlanId: activePlan?.id || null,
        plannedForDate: todayPlanDate,
        status: nextStatus,
        reasoning: this.buildReviewedReasoning( template.reasoning, planStatus, reviewMode )
      };
      await this.updateAction( tenantId, String( existingAction.id || '' ), updates );
      const persistedAction = {
        ...existingAction,
        ...updates,
        id: String( existingAction.id || '' ).trim() || existingAction.id
      } as MarketingEmployeeActionRecord;
      await this.ensureMoveForAction( tenantId, employeeId, persistedAction );
      matchedExistingActionIds.add( String( existingAction.id || '' ) );
      usedTemplateKeys.add( templateKey );
      updatedIds.push( String( existingAction.id || '' ) );
    }

    for ( const existingAction of existingDailyPlanActions ) {
      const actionId = String( existingAction.id || '' ).trim();
      if ( !actionId || matchedExistingActionIds.has( actionId ) ) {
        continue;
      }

      if ( !this.shouldPauseDailyPlanAction( existingAction ) ) {
        continue;
      }

      await this.updateActionStatus( tenantId, actionId, 'paused', {
        reasoning: this.appendPauseReasoning( existingAction.reasoning, planStatus, reviewMode )
      } );
      await this.syncMoveStatusForAction( tenantId, employeeId, {
        ...existingAction,
        status: 'paused'
      } );
      pausedIds.push( actionId );
    }

    for ( const action of generatedActions ) {
      const templateKey = this.buildDailyPlanActionKey( action );
      if ( usedTemplateKeys.has( templateKey ) ) {
        continue;
      }

      const id = await this.createAction( tenantId, {
        ...action,
        employeeId,
        plannedForDate: todayPlanDate,
        sourcePlanId: activePlan?.id || null,
        reasoning: this.buildReviewedReasoning( action.reasoning, planStatus, reviewMode )
      } );
      await this.ensureMoveForAction( tenantId, employeeId, {
        ...action,
        id,
        employeeId,
        plannedForDate: todayPlanDate,
        sourcePlanId: activePlan?.id || null,
        reasoning: this.buildReviewedReasoning( action.reasoning, planStatus, reviewMode )
      } );
      createdIds.push( id );
    }

    return {
      createdIds,
      updatedIds,
      pausedIds,
      reviewMode,
      reviewSummary: this.buildDailyPlanReviewSummary( createdIds.length, updatedIds.length, pausedIds.length, reviewMode )
    };
  }

  private async getOpenActions (
    tenantId: string,
    employeeId: string
  ): Promise<MarketingEmployeeActionRecord[]> {
    const normalizedTenantId = this.normalizeRequiredValue( tenantId, 'tenantId' );
    const normalizedEmployeeId = this.normalizeRequiredValue( employeeId, 'employeeId' );
    const actionsRef = collection( this.firestore, `tenants/${normalizedTenantId}/employee-actions` );
    const openQuery = query(
      actionsRef,
      where( 'employeeId', '==', normalizedEmployeeId ),
      where( 'status', 'in', ['draft', 'needs_approval', 'approved', 'paused'] )
    );
    const snapshot = await getDocs( openQuery );
    return snapshot.docs.map( docSnapshot => this.toMarketingEmployeeActionRecord( {
      id: docSnapshot.id,
      ...docSnapshot.data()
    } ) );
  }

  private buildSampleDailyPlan (
    employee: MarketingEmployeeRecord,
    desiredActionCount: number,
    activePlan: MarketingPlanRecord | null = null,
    planStatus: MarketingPlanStatusInput | null = null
  ): Array<Omit<MarketingEmployeeActionRecord, 'id' | 'employeeId' | 'createdAt' | 'updatedAt'>> {
    const extracted = activePlan?.extracted;
    const goals = extracted?.goals?.length ? extracted.goals : ( employee.goals.length > 0 ? employee.goals : ['Increase qualified marketing activity'] );
    const audiences = extracted?.audiences?.length ? extracted.audiences : ( employee.audiences.length > 0 ? employee.audiences : ['Existing prospects', 'Warm leads', 'Current customers'] );
    const channels = extracted?.channels?.length ? extracted.channels : ( employee.contextProfile?.channels?.length ? employee.contextProfile.channels : ['Social', 'Email', 'Website'] );
    const campaigns = extracted?.campaigns?.length ? extracted.campaigns : ['current campaign'];
    const contentThemes = extracted?.contentThemes?.length ? extracted.contentThemes : ( employee.contextProfile?.themes?.length ? employee.contextProfile.themes : ['practical insight'] );
    const strategy = this.buildDailyStrategyProfile( {
      goals,
      audiences,
      channels,
      campaigns,
      contentThemes,
      timeline: String( extracted?.timeline || employee.contextProfile?.operatingCadence || 'the current operating window' ).trim(),
      tone: employee.brandVoice || employee.persona?.voice || 'Clear, confident, helpful, and direct.',
      reviewMode: this.resolveDailyPlanReviewMode( planStatus ),
      planStatus
    } );

    const baseTemplates = strategy.reviewMode === 'inbound_recovery'
      ? this.buildInboundRecoveryPlan( strategy, desiredActionCount )
      : strategy.reviewMode === 'send_recovery'
        ? this.buildSendRecoveryPlan( strategy, desiredActionCount )
        : strategy.reviewMode === 'conversion_recovery'
          ? this.buildConversionRecoveryPlan( strategy, desiredActionCount )
          : strategy.reviewMode === 'approval_recovery'
            ? this.buildApprovalRecoveryPlan( strategy, desiredActionCount )
            : this.buildGeneralStrategyPlan( strategy, desiredActionCount );

    return this.expandPlanWithExecutionTasks( baseTemplates, employee );
  }

  private buildDailyStrategyProfile ( context: {
    goals: string[];
    audiences: string[];
    channels: string[];
    campaigns: string[];
    contentThemes: string[];
    timeline: string;
    tone: string;
    reviewMode: MarketingDailyPlanReviewMode;
    planStatus: MarketingPlanStatusInput | null;
  } ): MarketingDailyStrategyProfile {
    const primaryGoal = context.goals[0] || 'increase qualified marketing activity';
    const secondaryGoal = context.goals[1] || primaryGoal;
    const primaryAudience = context.audiences[0] || 'priority prospects';
    const secondaryAudience = context.audiences[1] || primaryAudience;
    const primaryChannel = context.channels[0] || 'Email';
    const secondaryChannel = context.channels[1] || ( primaryChannel === 'Email' ? 'Campaign' : 'Email' );
    const primaryCampaign = context.campaigns[0] || 'current campaign';
    const secondaryCampaign = context.campaigns[1] || primaryCampaign;
    const primaryTheme = context.contentThemes[0] || 'practical insight';
    const secondaryTheme = context.contentThemes[1] || primaryTheme;
    const fallbackAngle = this.deriveAngleFromPlanStatus( context.planStatus, context.reviewMode );
    const primaryAngle = primaryTheme || fallbackAngle;
    const secondaryAngle = secondaryTheme || fallbackAngle;
    const primaryKpi = this.derivePrimaryKpi( context.reviewMode, context.planStatus );
    return {
      reviewMode: context.reviewMode,
      primaryGoal,
      secondaryGoal,
      primaryAudience,
      secondaryAudience,
      primaryChannel,
      secondaryChannel,
      primaryCampaign,
      secondaryCampaign,
      primaryTheme,
      secondaryTheme,
      primaryAngle,
      secondaryAngle,
      primaryKpi,
      timeline: context.timeline,
      tone: context.tone,
      focusLabel: this.resolveFocusLabel( context.reviewMode )
    };
  }

  private deriveAngleFromPlanStatus (
    planStatus: MarketingPlanStatusInput | null,
    reviewMode: MarketingDailyPlanReviewMode
  ): string {
    const nextAction = String( planStatus?.nextAction || '' ).trim();
    const headline = String( planStatus?.headline || '' ).trim();
    if ( nextAction ) return nextAction;
    if ( headline ) return headline;
    if ( reviewMode === 'inbound_recovery' ) return 'respond while the lead is still warm';
    if ( reviewMode === 'send_recovery' ) return 'reduce friction and recover send pace';
    if ( reviewMode === 'conversion_recovery' ) return 'turn active interest into meetings';
    if ( reviewMode === 'approval_recovery' ) return 'clear approvals that block learning';
    return 'reduce admin drag and keep momentum moving';
  }

  private derivePrimaryKpi (
    reviewMode: MarketingDailyPlanReviewMode,
    planStatus: MarketingPlanStatusInput | null
  ): string {
    const metricLabel = Array.isArray( planStatus?.metrics ) && planStatus?.metrics?.length
      ? String( planStatus.metrics[0]?.label || '' ).trim()
      : '';
    if ( metricLabel ) return metricLabel;
    if ( reviewMode === 'inbound_recovery' ) return 'response time to warm inbound';
    if ( reviewMode === 'send_recovery' ) return 'daily sends versus target';
    if ( reviewMode === 'conversion_recovery' ) return 'replies and meetings from warm engagement';
    if ( reviewMode === 'approval_recovery' ) return 'approval queue cleared';
    return 'qualified engagement against plan';
  }

  private resolveFocusLabel ( reviewMode: MarketingDailyPlanReviewMode ): string {
    if ( reviewMode === 'inbound_recovery' ) return 'inbound rescue';
    if ( reviewMode === 'send_recovery' ) return 'send recovery';
    if ( reviewMode === 'conversion_recovery' ) return 'meeting conversion';
    if ( reviewMode === 'approval_recovery' ) return 'approval clearing';
    return 'plan execution';
  }

  private resolveDailyPlanReviewMode (
    planStatus: MarketingPlanStatusInput | null | undefined
  ): MarketingDailyPlanReviewMode {
    const planStatusText = `${String( planStatus?.headline || '' ).trim()} ${String( planStatus?.summary || '' ).trim()} ${String( planStatus?.detail || '' ).trim()} ${String( planStatus?.nextAction || '' ).trim()}`.toLowerCase();
    if ( /warm inbound is being neglected|inbound lead/.test( planStatusText ) ) return 'inbound_recovery';
    if ( /behind its current send target|send gap|behind target/.test( planStatusText ) ) return 'send_recovery';
    if ( /booking-intent|engagement, but not yet enough verified conversion|meeting-conversion/.test( planStatusText ) ) return 'conversion_recovery';
    if ( /waiting on approvals|approval queue/.test( planStatusText ) ) return 'approval_recovery';
    return 'general';
  }

  private selectReviewableDailyPlanActions (
    actions: MarketingEmployeeActionRecord[],
    activePlanId: string | null
  ): MarketingEmployeeActionRecord[] {
    return actions.filter( action => {
      if ( action.origin !== 'daily_plan' ) {
        return false;
      }
      if ( !activePlanId ) {
        return true;
      }
      return !action.sourcePlanId || action.sourcePlanId === activePlanId;
    } );
  }

  private findMatchingDailyPlanTemplate (
    templates: Array<Omit<MarketingEmployeeActionRecord, 'id' | 'employeeId' | 'createdAt' | 'updatedAt'>>,
    existingAction: MarketingEmployeeActionRecord
  ): Omit<MarketingEmployeeActionRecord, 'id' | 'employeeId' | 'createdAt' | 'updatedAt'> | null {
    const existingKey = this.buildDailyPlanActionKey( existingAction );
    return templates.find( template => this.buildDailyPlanActionKey( template ) === existingKey ) || null;
  }

  private buildDailyPlanActionKey (
    action: Pick<MarketingEmployeeActionRecord, 'type' | 'title' | 'channel'>
  ): string {
    return [
      String( action.type || '' ).trim().toLowerCase(),
      String( action.title || '' ).trim().toLowerCase(),
      String( action.channel || '' ).trim().toLowerCase()
    ].join( '::' );
  }

  private resolveReviewedActionStatus (
    existingStatus: MarketingActionStatus,
    templateStatus: MarketingActionStatus
  ): MarketingActionStatus {
    if ( existingStatus === 'approved' ) return 'approved';
    if ( existingStatus === 'needs_approval' && templateStatus === 'draft' ) return 'needs_approval';
    return templateStatus;
  }

  private shouldPauseDailyPlanAction ( action: MarketingEmployeeActionRecord ): boolean {
    return action.status === 'draft' || action.status === 'needs_approval';
  }

  private buildReviewedReasoning (
    baseReasoning: string,
    planStatus: MarketingPlanStatusInput | null | undefined,
    reviewMode: MarketingDailyPlanReviewMode
  ): string {
    const nextAction = String( planStatus?.nextAction || '' ).trim();
    const summary = String( planStatus?.summary || '' ).trim();
    const modeLabel = reviewMode.replace( /_/g, ' ' );
    return [
      baseReasoning,
      summary ? `Review context: ${summary}` : '',
      nextAction ? `Management adjustment: ${nextAction}` : '',
      `Review mode: ${modeLabel}.`
    ].filter( Boolean ).join( ' ' );
  }

  private appendPauseReasoning (
    existingReasoning: string,
    planStatus: MarketingPlanStatusInput | null | undefined,
    reviewMode: MarketingDailyPlanReviewMode
  ): string {
    const nextAction = String( planStatus?.nextAction || '' ).trim();
    const modeLabel = reviewMode.replace( /_/g, ' ' );
    return [
      String( existingReasoning || '' ).trim(),
      `Paused during Maya review because the plan shifted into ${modeLabel}.`,
      nextAction ? `Current next move: ${nextAction}` : ''
    ].filter( Boolean ).join( ' ' );
  }

  private buildDailyPlanReviewSummary (
    createdCount: number,
    updatedCount: number,
    pausedCount: number,
    reviewMode: MarketingDailyPlanReviewMode
  ): string {
    const modeLabel = reviewMode.replace( /_/g, ' ' );
    return `Maya ran a ${modeLabel} review and created ${createdCount}, updated ${updatedCount}, and paused ${pausedCount} daily-plan action${createdCount + updatedCount + pausedCount === 1 ? '' : 's'}.`;
  }

  private expandPlanWithExecutionTasks (
    templates: Array<Omit<MarketingEmployeeActionRecord, 'id' | 'employeeId' | 'createdAt' | 'updatedAt'>>,
    employee: MarketingEmployeeRecord
  ): Array<Omit<MarketingEmployeeActionRecord, 'id' | 'employeeId' | 'createdAt' | 'updatedAt'>> {
    const expanded: Array<Omit<MarketingEmployeeActionRecord, 'id' | 'employeeId' | 'createdAt' | 'updatedAt'>> = [];

    for ( const template of templates ) {
      expanded.push( this.decoratePlanningAction( template ) );

      const executionTemplate = this.buildExecutionCompanionAction( template, employee );
      if ( executionTemplate ) {
        expanded.push( executionTemplate );
      }
    }

    return expanded;
  }

  private decoratePlanningAction (
    template: Omit<MarketingEmployeeActionRecord, 'id' | 'employeeId' | 'createdAt' | 'updatedAt'>
  ): Omit<MarketingEmployeeActionRecord, 'id' | 'employeeId' | 'createdAt' | 'updatedAt'> {
    const lane = this.resolveExecutionLane( template );
    const targetCount = this.resolveTargetCount( template, false );
    const completedCount = this.resolveCompletedCount( template.status, targetCount );

    return {
      ...template,
      planningOwner: 'maya',
      executionLane: lane,
      targetCount,
      completedCount,
      monitorRoute: this.resolveMonitorRoute( lane ),
      monitorLabel: this.resolveMonitorLabel( lane )
    };
  }

  private buildExecutionCompanionAction (
    template: Omit<MarketingEmployeeActionRecord, 'id' | 'employeeId' | 'createdAt' | 'updatedAt'>,
    employee: MarketingEmployeeRecord
  ): Omit<MarketingEmployeeActionRecord, 'id' | 'employeeId' | 'createdAt' | 'updatedAt'> | null {
    const lane = this.resolveExecutionLane( template );
    if ( lane !== 'outbox' && lane !== 'social' ) {
      return null;
    }

    const autonomous = lane === 'outbox'
      ? this.resolveEmailAutonomy( employee )
      : employee.authority.canPublishWithoutApproval === true;
    const targetCount = this.resolveTargetCount( template, true );

    return {
      employeeType: 'marketing',
      type: template.type,
      strategyId: template.strategyId || null,
      segmentId: template.segmentId || null,
      angleId: template.angleId || null,
      title: lane === 'outbox'
        ? `TODD execute ${String( template.title || '' ).replace( /^(draft|prepare)\s+/i, '' ).trim()}`
        : `TODD schedule ${String( template.title || '' ).replace( /^(draft|prepare)\s+/i, '' ).trim()}`,
      description: lane === 'outbox'
        ? 'TODD owns the live email lane once Maya has the draft batch ready.'
        : 'TODD owns the publish and queue lane once Maya has the social draft ready.',
      channel: template.channel,
      status: autonomous ? 'approved' : 'needs_approval',
      priority: template.priority,
      reasoning: lane === 'outbox'
        ? 'This is the execution lane for Maya’s email plan. TODD should queue and send once the batch is ready.'
        : 'This is the execution lane for Maya’s social plan. TODD should queue and schedule the approved posts.',
      contentDraft: '',
      scheduledFor: null,
      sourcePlanId: template.sourcePlanId || null,
      origin: 'daily_plan',
      domainTags: ['execution', lane],
      approvalRequired: autonomous === false,
      planningOwner: 'todd',
      executionLane: lane,
      targetCount,
      completedCount: 0,
      moveId: null,
      moveStatus: null,
      monitorRoute: this.resolveMonitorRoute( lane ),
      monitorLabel: this.resolveMonitorLabel( lane )
    };
  }

  private resolveExecutionLane (
    template: Pick<MarketingEmployeeActionRecord, 'type' | 'channel'>
  ): MarketingEmployeeActionRecord['executionLane'] {
    const type = String( template.type || '' ).trim().toLowerCase();
    const channel = String( template.channel || '' ).trim().toLowerCase();

    if ( type === 'email' || type === 'campaign' || /email/.test( channel ) ) return 'outbox';
    if ( type === 'social_post' || /social|linkedin|facebook|instagram|x\b|twitter/.test( channel ) ) return 'social';
    if ( type === 'research' ) return 'docs';
    if ( type === 'blog' || type === 'seo_fix' ) return 'docs';
    return 'marketing_employee';
  }

  private resolveTargetCount (
    template: Pick<MarketingEmployeeActionRecord, 'type' | 'title' | 'channel'>,
    executionCompanion: boolean
  ): number {
    const type = String( template.type || '' ).trim().toLowerCase();
    if ( type === 'email' || type === 'campaign' ) return executionCompanion ? 25 : 25;
    if ( type === 'social_post' ) return executionCompanion ? 10 : 10;
    return 1;
  }

  private resolveCompletedCount (
    status: MarketingActionStatus,
    targetCount: number
  ): number {
    if ( status === 'approved' || status === 'completed' ) {
      return targetCount;
    }
    return 0;
  }

  private resolveMonitorRoute ( lane: MarketingEmployeeActionRecord['executionLane'] ): string {
    switch ( lane ) {
      case 'outbox':
        return '/signal-engine';
      case 'social':
        return '/outreach/social';
      case 'daily_momentum':
        return '/daily-momentum';
      case 'moves':
        return '/moves-view';
      case 'docs':
        return '/documents';
      case 'network':
        return '/network';
      case 'survey':
        return '/pulse';
      default:
        return '/marketing-employee';
    }
  }

  private resolveMonitorLabel ( lane: MarketingEmployeeActionRecord['executionLane'] ): string {
    switch ( lane ) {
      case 'outbox':
        return 'Outbox Cockpit';
      case 'social':
        return 'Social Queue';
      case 'daily_momentum':
        return 'Daily Momentum';
      case 'moves':
        return 'Moves';
      case 'docs':
        return 'Documents';
      case 'network':
        return 'Network';
      case 'survey':
        return 'Pulse';
      default:
        return 'Marketing Employee';
    }
  }

  private resolveEmailAutonomy ( employee: MarketingEmployeeRecord ): boolean {
    return employee.authority.canSendEmailsWithoutApproval === true
      || String( employee.authority.emailOperatingMode || '' ).trim().toLowerCase() === 'auto_send';
  }

  private buildGeneralStrategyPlan (
    strategy: MarketingDailyStrategyProfile,
    desiredActionCount: number
  ): Array<Omit<MarketingEmployeeActionRecord, 'id' | 'employeeId' | 'createdAt' | 'updatedAt'>> {
    const templates = [
      {
        type: this.mapChannelToActionType( strategy.primaryChannel ),
        title: `Draft ${strategy.primaryChannel.toLowerCase()} angle for ${strategy.primaryAudience}`,
        description: `Create a ${strategy.primaryChannel.toLowerCase()} asset that advances ${strategy.primaryGoal} using the angle "${strategy.primaryAngle}".`,
        channel: strategy.primaryChannel,
        priority: 'high' as MarketingActionPriority,
        status: 'draft' as MarketingActionStatus,
        reasoning: `Maya is prioritizing ${strategy.focusLabel} for ${strategy.primaryAudience}. The working angle is "${strategy.primaryAngle}" and the plan is measured by ${strategy.primaryKpi}.`,
        contentDraft: `Goal: ${strategy.primaryGoal}\nAudience segment: ${strategy.primaryAudience}\nCampaign: ${strategy.primaryCampaign}\nAngle: ${strategy.primaryAngle}\nTheme: ${strategy.primaryTheme}\nPrimary KPI: ${strategy.primaryKpi}\nTimeline: ${strategy.timeline}\nVoice: ${strategy.tone}`,
        approvalRequired: true,
      },
      {
        type: 'email' as MarketingActionType,
        title: `Prepare ${strategy.secondaryCampaign} email around ${strategy.secondaryAngle}`,
        description: `Draft a short email for ${strategy.secondaryAudience} centered on the angle "${strategy.secondaryAngle}".`,
        channel: strategy.secondaryChannel,
        priority: 'high' as MarketingActionPriority,
        status: 'needs_approval' as MarketingActionStatus,
        reasoning: `This email gives Maya a direct message for ${strategy.secondaryAudience} while keeping the campaign aligned to ${strategy.secondaryGoal}.`,
        contentDraft: `Subject angle: ${strategy.secondaryAngle}\nAudience: ${strategy.secondaryAudience}\nCampaign: ${strategy.secondaryCampaign}\nGoal: ${strategy.secondaryGoal}\nTheme: ${strategy.secondaryTheme}\nVoice: ${strategy.tone}`,
        approvalRequired: true,
      },
      {
        type: 'research' as MarketingActionType,
        title: `Review strongest segment-angle fit for ${strategy.primaryCampaign}`,
        description: `Summarize why ${strategy.primaryAudience} should respond to "${strategy.primaryAngle}" and what proof is still missing.`,
        channel: 'analysis',
        priority: 'medium' as MarketingActionPriority,
        status: 'draft' as MarketingActionStatus,
        reasoning: `Maya needs a tight explanation of why this segment-angle combination should win before scaling more volume.`,
        contentDraft: `Campaign: ${strategy.primaryCampaign}\nSegment: ${strategy.primaryAudience}\nPrimary angle: ${strategy.primaryAngle}\nSecondary angle: ${strategy.secondaryAngle}\nPrimary KPI: ${strategy.primaryKpi}\nFind the strongest proof points and the largest objection still unresolved.`,
        approvalRequired: false,
      },
      {
        type: 'campaign' as MarketingActionType,
        title: `Prepare ${strategy.focusLabel} checkpoint for ${strategy.primaryCampaign}`,
        description: `Turn the plan into a management checkpoint with segment, angle, KPI, and blocker visibility.`,
        channel: 'campaign',
        priority: 'medium' as MarketingActionPriority,
        status: 'draft' as MarketingActionStatus,
        reasoning: `A checkpoint lets Maya explain exactly what strategy is running and whether the current angle is earning more execution.`,
        contentDraft: `Focus: ${strategy.focusLabel}\nPrimary campaign: ${strategy.primaryCampaign}\nPrimary audience: ${strategy.primaryAudience}\nPrimary angle: ${strategy.primaryAngle}\nKPI: ${strategy.primaryKpi}\nWhat is the current bottleneck and what should change next?`,
        approvalRequired: false,
      }
    ];

    return templates.slice( 0, Math.max( 3, Math.min( desiredActionCount, 5 ) ) ).map( template => ( {
      ...template,
      origin: 'daily_plan' as const
    } ) );
  }

  private buildInboundRecoveryPlan (
    strategy: MarketingDailyStrategyProfile,
    desiredActionCount: number
  ): Array<Omit<MarketingEmployeeActionRecord, 'id' | 'employeeId' | 'createdAt' | 'updatedAt'>> {
    const templates = [
      {
        type: 'email' as MarketingActionType,
        title: `Prepare inbound rescue email for ${strategy.primaryAudience}`,
        description: `Draft a rapid-response email for warm inbound contacts using the angle "${strategy.primaryAngle}".`,
        channel: 'Email',
        priority: 'high' as MarketingActionPriority,
        status: 'needs_approval' as MarketingActionStatus,
        reasoning: `Warm inbound has the highest urgency because the buyer already raised a hand. Maya is focusing on ${strategy.primaryAudience} with the angle "${strategy.primaryAngle}".`,
        contentDraft: `Goal: rescue neglected inbound interest.\nAudience: ${strategy.primaryAudience}\nCampaign: ${strategy.primaryCampaign}\nAngle: ${strategy.primaryAngle}\nPrimary KPI: ${strategy.primaryKpi}\nTimeline: ${strategy.timeline}\nVoice: ${strategy.tone}`,
        approvalRequired: true,
      },
      {
        type: 'research' as MarketingActionType,
        title: `Audit untouched inbound sources for ${strategy.primaryAudience}`,
        description: 'Identify which inbound sources are producing leads that sit without follow-up and which message angle should rescue them.',
        channel: 'analysis',
        priority: 'high' as MarketingActionPriority,
        status: 'draft' as MarketingActionStatus,
        reasoning: 'Maya needs to know whether the neglect is coming from form fills, referrals, or other warm channels.',
        contentDraft: `List untouched inbound pockets, response lag, and likely rescue priority for ${strategy.primaryAudience} and ${strategy.secondaryAudience}.\nPrimary angle: ${strategy.primaryAngle}\nSecondary angle: ${strategy.secondaryAngle}`,
        approvalRequired: false,
      },
      {
        type: 'campaign' as MarketingActionType,
        title: `Reprioritize ${strategy.secondaryCampaign} around inbound rescue`,
        description: 'Prepare a checkpoint that shifts operator attention toward warm inbound before adding more top-of-funnel work.',
        channel: 'Campaign',
        priority: 'medium' as MarketingActionPriority,
        status: 'draft' as MarketingActionStatus,
        reasoning: 'When warm inbound is being missed, Maya should correct handling before increasing outbound volume.',
        contentDraft: `Summarize what work should pause, what should continue, and what should move first to rescue warm inbound.\nSegment: ${strategy.primaryAudience}\nAngle: ${strategy.primaryAngle}\nKPI: ${strategy.primaryKpi}`,
        approvalRequired: false,
      }
    ];

    return templates.slice( 0, Math.max( 3, Math.min( desiredActionCount, 5 ) ) ).map( template => ( {
      ...template,
      origin: 'daily_plan' as const
    } ) );
  }

  private buildSendRecoveryPlan (
    strategy: MarketingDailyStrategyProfile,
    desiredActionCount: number
  ): Array<Omit<MarketingEmployeeActionRecord, 'id' | 'employeeId' | 'createdAt' | 'updatedAt'>> {
    const templates = [
      {
        type: this.mapChannelToActionType( strategy.primaryChannel ),
        title: `Draft ${strategy.primaryChannel.toLowerCase()} asset to recover send pace`,
        description: `Prepare a faster-turnaround asset for ${strategy.primaryAudience} using the angle "${strategy.primaryAngle}".`,
        channel: strategy.primaryChannel,
        priority: 'high' as MarketingActionPriority,
        status: 'draft' as MarketingActionStatus,
        reasoning: `The plan is behind target, so Maya should reduce friction and create the next shippable asset for ${strategy.primaryAudience}.`,
        contentDraft: `Goal: recover send pace.\nAudience: ${strategy.primaryAudience}\nAngle: ${strategy.primaryAngle}\nTheme: ${strategy.primaryTheme}\nCampaign: ${strategy.primaryCampaign}\nPrimary KPI: ${strategy.primaryKpi}\nTimeline: ${strategy.timeline}\nVoice: ${strategy.tone}`,
        approvalRequired: true,
      },
      {
        type: 'email' as MarketingActionType,
        title: `Prepare quicker-turn email for ${strategy.secondaryAudience}`,
        description: `Draft a simple email for ${strategy.secondaryAudience} centered on "${strategy.secondaryAngle}" so the team can close the gap quickly.`,
        channel: strategy.secondaryChannel,
        priority: 'high' as MarketingActionPriority,
        status: 'needs_approval' as MarketingActionStatus,
        reasoning: 'When send pace is slow, the next move should be easier to approve and faster to queue.',
        contentDraft: `Subject: A direct next step on ${strategy.secondaryGoal}\n\nAudience: ${strategy.secondaryAudience}\nAngle: ${strategy.secondaryAngle}\nTheme: ${strategy.secondaryTheme}\nVoice: ${strategy.tone}`,
        approvalRequired: true,
      },
      {
        type: 'campaign' as MarketingActionType,
        title: 'Prepare send-gap recovery checkpoint',
        description: 'Summarize which approval, drafting, or targeting bottleneck is slowing execution.',
        channel: 'Campaign',
        priority: 'medium' as MarketingActionPriority,
        status: 'draft' as MarketingActionStatus,
        reasoning: 'Maya should be explicit about what is preventing the team from reaching the plan target.',
        contentDraft: `List the main send bottleneck, what to unblock first, and how to recover the remaining send gap this cycle.\nSegment: ${strategy.primaryAudience}\nAngle: ${strategy.primaryAngle}\nKPI: ${strategy.primaryKpi}`,
        approvalRequired: false,
      }
    ];

    return templates.slice( 0, Math.max( 3, Math.min( desiredActionCount, 5 ) ) ).map( template => ( {
      ...template,
      origin: 'daily_plan' as const
    } ) );
  }

  private buildConversionRecoveryPlan (
    strategy: MarketingDailyStrategyProfile,
    desiredActionCount: number
  ): Array<Omit<MarketingEmployeeActionRecord, 'id' | 'employeeId' | 'createdAt' | 'updatedAt'>> {
    const templates = [
      {
        type: 'email' as MarketingActionType,
        title: `Draft meeting-conversion follow-up for ${strategy.primaryAudience}`,
        description: 'Prepare a follow-up that turns warm engagement into a real reply or meeting.',
        channel: 'Email',
        priority: 'high' as MarketingActionPriority,
        status: 'needs_approval' as MarketingActionStatus,
        reasoning: `Booking-intent clicks and replies mean the next job is conversion, not more broad awareness. Maya is leaning on "${strategy.primaryAngle}" to move ${strategy.primaryAudience}.`,
        contentDraft: `Goal: convert existing engagement into meetings.\nAudience: ${strategy.primaryAudience}\nCampaign: ${strategy.secondaryCampaign}\nAngle: ${strategy.primaryAngle}\nTheme: ${strategy.secondaryTheme}\nPrimary KPI: ${strategy.primaryKpi}\nVoice: ${strategy.tone}`,
        approvalRequired: true,
      },
      {
        type: 'research' as MarketingActionType,
        title: `Review which signals are failing to convert for ${strategy.primaryAudience}`,
        description: 'Summarize where replies or booking-intent clicks are stalling before conversion.',
        channel: 'analysis',
        priority: 'medium' as MarketingActionPriority,
        status: 'draft' as MarketingActionStatus,
        reasoning: 'Maya should know whether the drop-off is message fit, friction, or weak follow-up handling.',
        contentDraft: `Analyze replies, booking-intent clicks, and the gap to meetings for ${strategy.primaryAudience} and ${strategy.secondaryAudience}.\nPrimary angle: ${strategy.primaryAngle}\nSecondary angle: ${strategy.secondaryAngle}`,
        approvalRequired: false,
      },
      {
        type: 'campaign' as MarketingActionType,
        title: 'Prepare conversion checkpoint for warm interest',
        description: 'Document what the operator should prioritize to move warm interest into booked conversations.',
        channel: 'Campaign',
        priority: 'medium' as MarketingActionPriority,
        status: 'draft' as MarketingActionStatus,
        reasoning: 'Maya should tighten the path from interest to booked conversation before expanding reach.',
        contentDraft: `Summarize the current conversion drag on ${strategy.primaryGoal} and ${strategy.secondaryGoal}.\nSegment: ${strategy.primaryAudience}\nAngle: ${strategy.primaryAngle}\nKPI: ${strategy.primaryKpi}\nTimeline: ${strategy.timeline}`,
        approvalRequired: false,
      }
    ];

    return templates.slice( 0, Math.max( 3, Math.min( desiredActionCount, 5 ) ) ).map( template => ( {
      ...template,
      origin: 'daily_plan' as const
    } ) );
  }

  private buildApprovalRecoveryPlan (
    strategy: MarketingDailyStrategyProfile,
    desiredActionCount: number
  ): Array<Omit<MarketingEmployeeActionRecord, 'id' | 'employeeId' | 'createdAt' | 'updatedAt'>> {
    const templates = [
      {
        type: 'campaign' as MarketingActionType,
        title: 'Prepare approval-clearing checkpoint',
        description: 'Summarize which approvals are blocking progress and what should be decided first.',
        channel: 'Campaign',
        priority: 'high' as MarketingActionPriority,
        status: 'draft' as MarketingActionStatus,
        reasoning: 'If approvals are the bottleneck, Maya should reduce ambiguity and clear the queue.',
        contentDraft: `List the top blocked approvals, what decision is required, and what can move once they are cleared.\nCurrent segment: ${strategy.primaryAudience}\nCurrent angle: ${strategy.primaryAngle}\nKPI: ${strategy.primaryKpi}`,
        approvalRequired: false,
      },
      {
        type: 'email' as MarketingActionType,
        title: `Prepare lowest-friction approval email for ${strategy.primaryAudience}`,
        description: `Draft the simplest high-value email tied to ${strategy.primaryCampaign} so approval is easier to grant.`,
        channel: 'Email',
        priority: 'high' as MarketingActionPriority,
        status: 'needs_approval' as MarketingActionStatus,
        reasoning: 'Approval bottlenecks get easier to clear when the next asset is concise, specific, and obviously useful.',
        contentDraft: `Goal: ${strategy.primaryGoal}\nAudience: ${strategy.primaryAudience}\nAngle: ${strategy.primaryAngle}\nTheme: ${strategy.primaryTheme}\nVoice: ${strategy.tone}`,
        approvalRequired: true,
      },
      {
        type: 'research' as MarketingActionType,
        title: 'Capture approval objections and missing proof',
        description: 'Document what keeps causing hesitation so Maya can reduce recurring approval drag.',
        channel: 'analysis',
        priority: 'medium' as MarketingActionPriority,
        status: 'draft' as MarketingActionStatus,
        reasoning: 'Maya should learn why approvals stall instead of simply pushing more drafts.',
        contentDraft: `Summarize recurring approval objections, proof gaps, and the smallest change that would speed approval.\nCurrent campaign: ${strategy.primaryCampaign}\nAudience: ${strategy.primaryAudience}\nAngle: ${strategy.primaryAngle}`,
        approvalRequired: false,
      }
    ];

    return templates.slice( 0, Math.max( 3, Math.min( desiredActionCount, 5 ) ) ).map( template => ( {
      ...template,
      origin: 'daily_plan' as const
    } ) );
  }

  private mapChannelToActionType ( channel: string ): MarketingActionType {
    const normalized = String( channel || '' ).trim().toLowerCase();
    if ( /email/.test( normalized ) ) return 'email';
    if ( /seo/.test( normalized ) ) return 'seo_fix';
    if ( /blog|website|resource/.test( normalized ) ) return 'blog';
    if ( /campaign/.test( normalized ) ) return 'campaign';
    if ( /research|analysis/.test( normalized ) ) return 'research';
    return 'social_post';
  }

  private buildEmployeePayload ( record: Partial<MarketingEmployeeRecord>, includeCreatedAt: boolean = true ): Record<string, unknown> {
    const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };

    if ( includeCreatedAt || record.type !== undefined ) {
      payload['type'] = String( record.type || DEFAULT_MARKETING_EMPLOYEE_RECORD.type ).trim().toLowerCase();
    }

    if ( includeCreatedAt || record.title !== undefined ) {
      payload['title'] = String( record.title || DEFAULT_MARKETING_EMPLOYEE_RECORD.title ).trim();
    }

    if ( includeCreatedAt || record.status !== undefined ) {
      payload['status'] = String( record.status || DEFAULT_MARKETING_EMPLOYEE_RECORD.status ).trim().toLowerCase();
    }

    if ( includeCreatedAt || record.mission !== undefined ) {
      payload['mission'] = String( record.mission || '' ).trim();
    }

    if ( includeCreatedAt || record.goals !== undefined ) {
      payload['goals'] = this.normalizeStringArray( record.goals );
    }

    if ( includeCreatedAt || record.audiences !== undefined ) {
      payload['audiences'] = this.normalizeStringArray( record.audiences );
    }

    if ( includeCreatedAt || record.brandVoice !== undefined ) {
      payload['brandVoice'] = String( record.brandVoice || '' ).trim();
    }

    if ( includeCreatedAt || record.persona !== undefined ) {
      payload['persona'] = {
        displayName: String( record.persona?.displayName || record.title || DEFAULT_MARKETING_EMPLOYEE_RECORD.persona?.displayName || DEFAULT_MARKETING_EMPLOYEE_RECORD.title ).trim(),
        voice: String( record.persona?.voice || record.brandVoice || DEFAULT_MARKETING_EMPLOYEE_RECORD.persona?.voice || '' ).trim(),
        tone: String( record.persona?.tone || DEFAULT_MARKETING_EMPLOYEE_RECORD.persona?.tone || '' ).trim(),
        roleSummary: String( record.persona?.roleSummary || record.mission || DEFAULT_MARKETING_EMPLOYEE_RECORD.persona?.roleSummary || '' ).trim()
      };
    }

    if ( includeCreatedAt || record.contextProfile !== undefined || record.audiences !== undefined ) {
      payload['contextProfile'] = {
        ...( DEFAULT_MARKETING_EMPLOYEE_RECORD.contextProfile || {} ),
        ...( record.contextProfile || {} ),
        audiences: this.normalizeStringArray( record.contextProfile?.audiences || record.audiences )
      };
    }

    if ( includeCreatedAt || record.authority !== undefined ) {
      payload['authority'] = {
        ...DEFAULT_MARKETING_EMPLOYEE_AUTHORITY,
        ...( record.authority || {} )
      };
    }

    if ( includeCreatedAt ) {
      payload['createdAt'] = serverTimestamp();
    }

    return payload;
  }

  private buildActionPayload (
    record: Partial<MarketingEmployeeActionRecord>,
    includeCreatedAt: boolean = true
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };

    if ( includeCreatedAt || record.employeeId !== undefined ) {
      payload['employeeId'] = String( record.employeeId || '' ).trim();
    }

    if ( includeCreatedAt || record.employeeType !== undefined ) {
      payload['employeeType'] = String( record.employeeType || 'marketing' ).trim().toLowerCase();
    }

    if ( includeCreatedAt || record.type !== undefined ) {
      payload['type'] = String( record.type || 'research' ).trim().toLowerCase();
    }

    if ( includeCreatedAt || record.domainTags !== undefined ) {
      payload['domainTags'] = this.normalizeStringArray( record.domainTags );
    }

    if ( includeCreatedAt || record.title !== undefined ) {
      payload['title'] = String( record.title || '' ).trim();
    }

    if ( includeCreatedAt || record.description !== undefined ) {
      payload['description'] = String( record.description || '' ).trim();
    }

    if ( includeCreatedAt || record.channel !== undefined ) {
      payload['channel'] = String( record.channel || '' ).trim();
    }

    if ( includeCreatedAt || record.status !== undefined ) {
      payload['status'] = String( record.status || 'draft' ).trim().toLowerCase();
    }

    if ( includeCreatedAt || record.priority !== undefined ) {
      payload['priority'] = String( record.priority || 'medium' ).trim().toLowerCase();
    }

    if ( includeCreatedAt || record.reasoning !== undefined ) {
      payload['reasoning'] = String( record.reasoning || '' ).trim();
    }

    if ( includeCreatedAt || record.strategyId !== undefined ) {
      payload['strategyId'] = this.normalizeNullableString( record.strategyId );
    }

    if ( includeCreatedAt || record.segmentId !== undefined ) {
      payload['segmentId'] = this.normalizeNullableString( record.segmentId );
    }

    if ( includeCreatedAt || record.angleId !== undefined ) {
      payload['angleId'] = this.normalizeNullableString( record.angleId );
    }

    if ( includeCreatedAt || record.contentDraft !== undefined ) {
      payload['contentDraft'] = String( record.contentDraft || '' ).trim();
    }

    if ( includeCreatedAt || record.scheduledFor !== undefined ) {
      payload['scheduledFor'] = this.normalizeNullableString( record.scheduledFor );
    }

    if ( includeCreatedAt || record.plannedForDate !== undefined ) {
      payload['plannedForDate'] = this.normalizeNullableString( record.plannedForDate );
    }

    if ( includeCreatedAt || record.sourcePlanId !== undefined ) {
      payload['sourcePlanId'] = this.normalizeNullableString( record.sourcePlanId );
    }

    if ( includeCreatedAt || record.origin !== undefined ) {
      payload['origin'] = this.normalizeNullableString( record.origin );
    }

    if ( includeCreatedAt || record.approvalRequired !== undefined ) {
      payload['approvalRequired'] = record.approvalRequired === true;
    }

    if ( includeCreatedAt || record.planningOwner !== undefined ) {
      payload['planningOwner'] = this.normalizeNullableString( record.planningOwner );
    }

    if ( includeCreatedAt || record.executionLane !== undefined ) {
      payload['executionLane'] = this.normalizeNullableString( record.executionLane );
    }

    if ( includeCreatedAt || record.targetCount !== undefined ) {
      payload['targetCount'] = this.normalizeCount( record.targetCount );
    }

    if ( includeCreatedAt || record.completedCount !== undefined ) {
      payload['completedCount'] = this.normalizeCount( record.completedCount );
    }

    if ( includeCreatedAt || record.moveId !== undefined ) {
      payload['moveId'] = this.normalizeNullableString( record.moveId );
    }

    if ( includeCreatedAt || record.moveStatus !== undefined ) {
      payload['moveStatus'] = this.normalizeNullableString( record.moveStatus );
    }

    if ( includeCreatedAt || record.monitorRoute !== undefined ) {
      payload['monitorRoute'] = this.normalizeNullableString( record.monitorRoute );
    }

    if ( includeCreatedAt || record.monitorLabel !== undefined ) {
      payload['monitorLabel'] = this.normalizeNullableString( record.monitorLabel );
    }

    if ( includeCreatedAt ) {
      payload['createdAt'] = serverTimestamp();
    }

    return payload;
  }

  private toMarketingEmployeeRecord ( record: any ): MarketingEmployeeRecord {
    return {
      id: String( record?.id || '' ).trim() || undefined,
      type: 'marketing',
      title: String( record?.title || DEFAULT_MARKETING_EMPLOYEE_RECORD.title ).trim(),
      status: ( String( record?.status || DEFAULT_MARKETING_EMPLOYEE_RECORD.status ).trim().toLowerCase() as MarketingEmployeeRecord['status'] ),
      mission: String( record?.mission || '' ).trim(),
      goals: this.normalizeStringArray( record?.goals ),
      audiences: this.normalizeStringArray( record?.audiences ),
      brandVoice: String( record?.brandVoice || '' ).trim(),
      persona: {
        ...DEFAULT_MARKETING_EMPLOYEE_RECORD.persona,
        ...( record?.persona || {} ),
        displayName: String( record?.persona?.displayName || record?.title || DEFAULT_MARKETING_EMPLOYEE_RECORD.persona?.displayName || DEFAULT_MARKETING_EMPLOYEE_RECORD.title ).trim(),
        voice: String( record?.persona?.voice || record?.brandVoice || DEFAULT_MARKETING_EMPLOYEE_RECORD.persona?.voice || '' ).trim(),
        tone: String( record?.persona?.tone || DEFAULT_MARKETING_EMPLOYEE_RECORD.persona?.tone || '' ).trim(),
        roleSummary: String( record?.persona?.roleSummary || record?.mission || DEFAULT_MARKETING_EMPLOYEE_RECORD.persona?.roleSummary || '' ).trim()
      },
      contextProfile: {
        ...( DEFAULT_MARKETING_EMPLOYEE_RECORD.contextProfile || {} ),
        ...( record?.contextProfile || {} ),
        audiences: this.normalizeStringArray( record?.contextProfile?.audiences || record?.audiences )
      },
      authority: {
        ...DEFAULT_MARKETING_EMPLOYEE_AUTHORITY,
        ...( record?.authority || {} )
      },
      createdAt: this.toIsoString( record?.createdAt ),
      updatedAt: this.toIsoString( record?.updatedAt )
    };
  }

  private toMarketingEmployeeActionRecord ( record: any ): MarketingEmployeeActionRecord {
    return {
      id: String( record?.id || '' ).trim() || undefined,
      employeeId: String( record?.employeeId || '' ).trim(),
      employeeType: 'marketing',
      type: ( String( record?.type || 'research' ).trim().toLowerCase() as MarketingEmployeeActionRecord['type'] ),
      strategyId: this.normalizeNullableString( record?.strategyId ),
      segmentId: this.normalizeNullableString( record?.segmentId ),
      angleId: this.normalizeNullableString( record?.angleId ),
      domainTags: this.normalizeStringArray( record?.domainTags ),
      title: String( record?.title || '' ).trim(),
      description: String( record?.description || '' ).trim(),
      channel: this.normalizeNullableString( record?.channel ) || undefined,
      status: ( String( record?.status || 'draft' ).trim().toLowerCase() as MarketingEmployeeActionRecord['status'] ),
      priority: ( String( record?.priority || 'medium' ).trim().toLowerCase() as MarketingEmployeeActionRecord['priority'] ),
      reasoning: String( record?.reasoning || '' ).trim(),
      contentDraft: this.normalizeNullableString( record?.contentDraft ) || undefined,
      scheduledFor: this.toIsoString( record?.scheduledFor ),
      plannedForDate: this.normalizeNullableString( record?.plannedForDate ),
      sourcePlanId: this.normalizeNullableString( record?.sourcePlanId ),
      origin: this.normalizeNullableString( record?.origin ) as MarketingEmployeeActionRecord['origin'],
      approvalRequired: record?.approvalRequired === true,
      planningOwner: this.normalizeNullableString( record?.planningOwner ) as MarketingEmployeeActionRecord['planningOwner'],
      executionLane: this.normalizeNullableString( record?.executionLane ) as MarketingEmployeeActionRecord['executionLane'],
      targetCount: this.normalizeCount( record?.targetCount ),
      completedCount: this.normalizeCount( record?.completedCount ),
      moveId: this.normalizeNullableString( record?.moveId ),
      moveStatus: this.normalizeNullableString( record?.moveStatus ),
      monitorRoute: this.normalizeNullableString( record?.monitorRoute ),
      monitorLabel: this.normalizeNullableString( record?.monitorLabel ),
      progress: this.normalizeCount( record?.progress ),
      notesLog: Array.isArray( record?.notesLog ) ? record.notesLog : [],
      lastWorkedAt: this.toIsoString( record?.lastWorkedAt ),
      createdAt: this.toIsoString( record?.createdAt ),
      updatedAt: this.toIsoString( record?.updatedAt )
    };
  }

  private toMarketingPlanRecord ( record: any ): MarketingPlanRecord {
    return {
      id: String( record?.id || '' ).trim() || undefined,
      employeeId: String( record?.employeeId || '' ).trim(),
      employeeType: 'marketing',
      title: String( record?.title || '' ).trim(),
      sourceType: String( record?.sourceType || 'pasted' ).trim().toLowerCase() as MarketingPlanRecord['sourceType'],
      rawText: String( record?.rawText || '' ).trim(),
      extracted: this.toMarketingPlanExtractedPayload( record?.extracted ),
      status: String( record?.status || 'active' ).trim().toLowerCase() as MarketingPlanRecord['status'],
      sourceFileName: this.normalizeNullableString( record?.sourceFileName ) || undefined,
      sourceFileUrl: this.normalizeNullableString( record?.sourceFileUrl ) || undefined,
      createdAt: this.toIsoString( record?.createdAt ),
      updatedAt: this.toIsoString( record?.updatedAt )
    };
  }

  private toMarketingEmployeeConversationRecord ( record: any ): MarketingEmployeeConversationRecord {
    return {
      id: String( record?.id || '' ).trim() || undefined,
      employeeId: String( record?.employeeId || '' ).trim(),
      employeeType: 'marketing',
      title: String( record?.title || 'Marketing Employee thread' ).trim(),
      createdAt: this.toIsoString( record?.createdAt ),
      updatedAt: this.toIsoString( record?.updatedAt )
    };
  }

  private toMarketingEmployeeConversationMessageRecord (
    conversationId: string,
    record: any
  ): MarketingEmployeeConversationMessageRecord {
    return {
      id: String( record?.id || '' ).trim() || undefined,
      conversationId,
      role: String( record?.role || 'employee' ).trim().toLowerCase() as MarketingEmployeeConversationMessageRecord['role'],
      content: String( record?.content || '' ).trim(),
      relatedActionIds: this.normalizeStringArray( record?.relatedActionIds ),
      actionIntent: this.normalizeNullableString( record?.actionIntent ) as MarketingEmployeeConversationMessageRecord['actionIntent'],
      createdAt: this.toIsoString( record?.createdAt )
    };
  }

  private toMarketingEmployeeOutcomeRecord ( record: any ): MarketingEmployeeOutcomeRecord {
    return {
      id: String( record?.id || '' ).trim() || undefined,
      employeeId: String( record?.employeeId || '' ).trim(),
      employeeType: 'marketing',
      actionId: this.normalizeNullableString( record?.actionId ),
      planId: this.normalizeNullableString( record?.planId ),
      outcomeKind: this.normalizeNullableString( record?.outcomeKind ) as MarketingEmployeeOutcomeRecord['outcomeKind'],
      periodKey: this.normalizeNullableString( record?.periodKey ),
      status: String( record?.status || 'neutral' ).trim().toLowerCase() as MarketingEmployeeOutcomeRecord['status'],
      signalSource: String( record?.signalSource || '' ).trim(),
      summary: String( record?.summary || '' ).trim(),
      details: this.normalizeNullableString( record?.details ) || undefined,
      metrics: this.normalizeOutcomeMetrics( record?.metrics ),
      weeklyGoals: this.normalizeOutcomeGoals( record?.weeklyGoals ),
      handoff: this.normalizeOutcomeHandoff( record?.handoff ),
      reviewedAt: String( this.toIsoString( record?.reviewedAt ) || '' ).trim(),
      createdAt: this.toIsoString( record?.createdAt ),
      updatedAt: this.toIsoString( record?.updatedAt )
    };
  }

  private toMarketingPlanExtractedPayload ( record: any ): MarketingPlanExtractedPayload {
    return {
      goals: this.normalizeStringArray( record?.goals ),
      audiences: this.normalizeStringArray( record?.audiences ),
      channels: this.normalizeStringArray( record?.channels ),
      campaigns: this.normalizeStringArray( record?.campaigns ),
      contentThemes: this.normalizeStringArray( record?.contentThemes ),
      kpis: this.normalizeStringArray( record?.kpis ),
      timeline: String( record?.timeline || '' ).trim()
    };
  }

  private async ensureMoveForAction (
    tenantId: string,
    userId: string,
    action: MarketingEmployeeActionRecord
  ): Promise<void> {
    const actionId = String( action.id || '' ).trim();
    if ( !tenantId || !actionId ) {
      return;
    }

    const taskPayload = this.buildMoveTaskFromAction( action );
    const moveId = String( action.moveId || '' ).trim();

    if ( moveId ) {
      await this.taskService.updateTask( moveId, taskPayload, userId || action.employeeId || '' );
      await this.updateAction( tenantId, actionId, {
        moveStatus: String( taskPayload.status || '' ).trim() || null,
        monitorRoute: String( action.monitorRoute || this.resolveMonitorRoute( action.executionLane || 'marketing_employee' ) ).trim() || null,
        monitorLabel: String( action.monitorLabel || this.resolveMonitorLabel( action.executionLane || 'marketing_employee' ) ).trim() || null
      } );
      return;
    }

    const createdMove = await this.taskService.addTask( taskPayload, userId || action.employeeId || '' );
    const createdMoveId = String( createdMove?.id || '' ).trim();
    if ( !createdMoveId ) {
      return;
    }

    await this.updateAction( tenantId, actionId, {
      moveId: createdMoveId,
      moveStatus: String( createdMove.status || taskPayload.status || '' ).trim() || null,
      monitorRoute: String( action.monitorRoute || this.resolveMonitorRoute( action.executionLane || 'marketing_employee' ) ).trim() || null,
      monitorLabel: String( action.monitorLabel || this.resolveMonitorLabel( action.executionLane || 'marketing_employee' ) ).trim() || null
    } );
  }

  private async syncMoveStatusForAction (
    tenantId: string,
    userId: string,
    action: MarketingEmployeeActionRecord
  ): Promise<void> {
    const moveId = String( action.moveId || '' ).trim();
    if ( !moveId ) {
      return;
    }

    const taskPayload = this.buildMoveTaskFromAction( action );
    await this.taskService.updateTask( moveId, taskPayload, userId || action.employeeId || '' );
    await this.updateAction( tenantId, String( action.id || '' ).trim(), {
      moveStatus: String( taskPayload.status || '' ).trim() || null
    } );
  }

  private buildMoveTaskFromAction ( action: MarketingEmployeeActionRecord ): Task {
    const targetCount = Math.max( 0, Number( action.targetCount || 0 ) );
    const completedCount = Math.max( 0, Number( action.completedCount || 0 ) );
    const progress = targetCount > 0
      ? Math.max( 0, Math.min( 100, Math.round( ( completedCount / targetCount ) * 100 ) ) )
      : action.status === 'approved' || action.status === 'completed'
        ? 100
        : 0;

    return {
      title: String( action.title || '' ).trim(),
      description: [
        String( action.description || '' ).trim(),
        action.planningOwner ? `Owner: ${action.planningOwner}` : '',
        action.executionLane ? `Lane: ${action.executionLane}` : '',
        targetCount > 0 ? `Target: ${completedCount}/${targetCount}` : ''
      ].filter( Boolean ).join( '\n\n' ),
      dueDate: String( action.plannedForDate || action.scheduledFor || this.getTodayIsoTimestamp() ).trim(),
      progress,
      priority: String( action.priority || 'medium' ).trim() || 'medium',
      status: this.mapActionStatusToMoveStatus( action.status ),
      url: String( action.monitorRoute || this.resolveMonitorRoute( action.executionLane || 'marketing_employee' ) || '/marketing-employee' ).trim(),
      ownerId: String( action.planningOwner || 'maya' ).trim() || 'maya',
      source: action.planningOwner === 'todd' ? 'employee-execution-task' : 'employee-planning-task',
      createdByTodd: true,
      employeeId: String( action.employeeId || '' ).trim(),
      employeeType: String( action.employeeType || 'marketing' ).trim(),
      executionLane: String( action.executionLane || 'marketing_employee' ).trim(),
      taskKind: action.planningOwner === 'todd' ? 'execution' : 'planning',
      plannedForDate: String( action.plannedForDate || '' ).trim()
    };
  }

  private mapActionStatusToMoveStatus ( status: MarketingActionStatus ): string {
    if ( status === 'completed' ) return 'completed';
    if ( status === 'rejected' ) return 'cancelled';
    if ( status === 'approved' ) return 'in-progress';
    if ( status === 'paused' ) return 'on-hold';
    return 'not-started';
  }

  private normalizeStringArray ( value: unknown ): string[] {
    if ( !Array.isArray( value ) ) {
      return [];
    }

    return Array.from(
      new Set(
        value
          .map( item => String( item || '' ).trim() )
          .filter( Boolean )
      )
    );
  }

  private normalizeNullableString ( value: unknown ): string | null {
    const normalized = String( value || '' ).trim();
    return normalized ? normalized : null;
  }

  private normalizeCount ( value: unknown ): number | null {
    const normalized = Number( value );
    if ( !Number.isFinite( normalized ) ) {
      return null;
    }
    return Math.max( 0, Math.round( normalized ) );
  }

  private normalizeOutcomeMetrics (
    value: unknown
  ): Array<{ label: string; value: string; detail?: string; }> {
    if ( !Array.isArray( value ) ) {
      return [];
    }

    return value.map( item => ( {
      label: String( item?.label || '' ).trim(),
      value: String( item?.value || '' ).trim(),
      detail: this.normalizeNullableString( item?.detail ) || undefined
    } ) ).filter( item => item.label && item.value ).slice( 0, 12 );
  }

  private normalizeOutcomeGoals (
    value: unknown
  ): Array<{ label: string; baseline: string; target: string; status?: string; }> {
    if ( !Array.isArray( value ) ) {
      return [];
    }

    return value.map( item => ( {
      label: String( item?.label || '' ).trim(),
      baseline: String( item?.baseline || '' ).trim(),
      target: String( item?.target || '' ).trim(),
      status: this.normalizeNullableString( item?.status ) || undefined
    } ) ).filter( item => item.label && item.target ).slice( 0, 12 );
  }

  private normalizeOutcomeHandoff (
    value: unknown
  ): { owner: string; summary: string; nextActions: string[]; routes?: string[]; } | undefined {
    if ( !value || typeof value !== 'object' ) {
      return undefined;
    }

    const owner = String( ( value as any ).owner || '' ).trim();
    const summary = String( ( value as any ).summary || '' ).trim();
    const nextActions = this.normalizeStringArray( ( value as any ).nextActions );
    const routes = this.normalizeStringArray( ( value as any ).routes );

    if ( !owner && !summary && nextActions.length === 0 && routes.length === 0 ) {
      return undefined;
    }

    return {
      owner: owner || 'TODD',
      summary,
      nextActions,
      routes: routes.length ? routes : undefined
    };
  }

  private getTodayPlanDate (): string {
    return this.getTodayIsoTimestamp().split( 'T' )[0];
  }

  private getTodayIsoTimestamp (): string {
    return new Date().toISOString();
  }

  private toIsoString ( value: unknown ): string | null {
    if ( !value ) {
      return null;
    }

    if ( typeof value === 'string' ) {
      return value.trim() || null;
    }

    if ( value instanceof Date ) {
      return value.toISOString();
    }

    if ( value instanceof Timestamp ) {
      return value.toDate().toISOString();
    }

    if ( typeof ( value as { toDate?: () => Date; } )?.toDate === 'function' ) {
      return ( value as { toDate: () => Date; } ).toDate().toISOString();
    }

    if ( typeof value === 'object' && value !== null && 'seconds' in ( value as Record<string, unknown> ) ) {
      const seconds = Number( ( value as { seconds?: number; } ).seconds || 0 );
      return seconds > 0 ? new Date( seconds * 1000 ).toISOString() : null;
    }

    return null;
  }

  private normalizeRequiredValue ( value: string, fieldName: string ): string {
    const normalized = String( value || '' ).trim();
    if ( !normalized ) {
      throw new Error( `MarketingEmployeeService requires ${fieldName}` );
    }
    return normalized;
  }
}
