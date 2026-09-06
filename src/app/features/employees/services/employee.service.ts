import { Injectable } from '@angular/core';
import { Observable, combineLatest, map } from 'rxjs';

import {
  EmployeeActionRecord,
  EmployeeConversationMessageRecord,
  EmployeeConversationRecord,
  EmployeeOutcomeRecord,
  EmployeePlanRecord,
  EmployeeRecord
} from '../models/employee.models';
import {
  employeeActionToMarketingAction,
  employeeActionPatchToMarketingActionPatch,
  employeeMessageToMarketingMessage,
  employeePatchToMarketingEmployeePatch,
  employeePlanToMarketingPlan,
  marketingPlanToEmployeePlan,
  marketingActionToEmployeeAction,
  marketingConversationToEmployeeConversation,
  marketingEmployeeToEmployeeRecord,
  marketingMessageToEmployeeMessage,
} from '../models/employee-compat.adapters';
import {
  MarketingDailyPlanGenerationResult,
  MarketingEmployeeService
} from '../../marketing/services/marketing-employee.service';

interface EmployeePlanStatusInput {
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

@Injectable( {
  providedIn: 'root'
} )
export class EmployeeService {
  constructor ( private readonly marketingEmployeeService: MarketingEmployeeService ) {}

  getDefaultEmployeeId (): string {
    return this.marketingEmployeeService.getDefaultEmployeeId();
  }

  watchEmployee ( tenantId: string, employeeId: string ): Observable<EmployeeRecord | null> {
    return this.marketingEmployeeService.watchEmployee( tenantId, employeeId ).pipe(
      map( record => record ? marketingEmployeeToEmployeeRecord( record ) : null )
    );
  }

  async getEmployee ( tenantId: string, employeeId: string ): Promise<EmployeeRecord | null> {
    const record = await this.marketingEmployeeService.getEmployee( tenantId, employeeId );
    return record ? marketingEmployeeToEmployeeRecord( record ) : null;
  }

  async getOrCreateEmployee ( tenantId: string, seed?: Partial<EmployeeRecord> ): Promise<EmployeeRecord> {
    const record = await this.marketingEmployeeService.getOrCreateEmployee(
      tenantId,
      seed ? employeePatchToMarketingEmployeePatch( seed ) : undefined
    );
    return marketingEmployeeToEmployeeRecord( record );
  }

  async saveEmployeeSettings ( tenantId: string, employeeId: string, updates: Partial<EmployeeRecord> ): Promise<void> {
    await this.marketingEmployeeService.saveEmployeeSettings(
      tenantId,
      employeeId,
      employeePatchToMarketingEmployeePatch( updates )
    );
  }

  watchCurrentWork ( tenantId: string, employeeId: string ): Observable<EmployeeActionRecord[]> {
    return this.marketingEmployeeService.watchCurrentWork( tenantId, employeeId ).pipe(
      map( records => records.map( marketingActionToEmployeeAction ) )
    );
  }

  watchPendingApprovals ( tenantId: string, employeeId: string ): Observable<EmployeeActionRecord[]> {
    return this.marketingEmployeeService.watchPendingApprovals( tenantId, employeeId ).pipe(
      map( records => records.map( marketingActionToEmployeeAction ) )
    );
  }

  watchCompletedWork ( tenantId: string, employeeId: string ): Observable<EmployeeActionRecord[]> {
    return this.marketingEmployeeService.watchCompletedWork( tenantId, employeeId ).pipe(
      map( records => records.map( marketingActionToEmployeeAction ) )
    );
  }

  watchWorkspaceSnapshot (
    tenantId: string,
    employeeId: string
  ): Observable<{
    employee: EmployeeRecord | null;
    currentWork: EmployeeActionRecord[];
    pendingApprovals: EmployeeActionRecord[];
    completedWork: EmployeeActionRecord[];
  }> {
    return combineLatest( [
      this.watchEmployee( tenantId, employeeId ),
      this.watchCurrentWork( tenantId, employeeId ),
      this.watchPendingApprovals( tenantId, employeeId ),
      this.watchCompletedWork( tenantId, employeeId )
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
    action: Omit<EmployeeActionRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    return this.marketingEmployeeService.createAction( tenantId, employeeActionToMarketingAction( action ) );
  }

  async updateAction ( tenantId: string, actionId: string, updates: Partial<EmployeeActionRecord> ): Promise<void> {
    await this.marketingEmployeeService.updateAction( tenantId, actionId, employeeActionPatchToMarketingActionPatch( updates ) );
  }

  async updateActionStatus (
    tenantId: string,
    actionId: string,
    status: EmployeeActionRecord['status'],
    extraUpdates: Partial<EmployeeActionRecord> = {}
  ): Promise<void> {
    await this.marketingEmployeeService.updateActionStatus(
      tenantId,
      actionId,
      status,
      employeeActionPatchToMarketingActionPatch( extraUpdates )
    );
  }

  watchPlans (
    tenantId: string,
    employeeId: string,
    options?: { status?: EmployeePlanRecord['status']; limit?: number; }
  ): Observable<EmployeePlanRecord[]> {
    return this.marketingEmployeeService.watchMarketingPlans( tenantId, employeeId, options ).pipe(
      map( records => records.map( marketingPlanToEmployeePlan ) )
    );
  }

  async createPlan (
    tenantId: string,
    plan: Omit<EmployeePlanRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    return this.marketingEmployeeService.createMarketingPlan( tenantId, employeePlanToMarketingPlan( plan ) );
  }

  async updatePlan (
    tenantId: string,
    planId: string,
    updates: Partial<EmployeePlanRecord>
  ): Promise<void> {
    const marketingUpdates: Parameters<MarketingEmployeeService['updateMarketingPlan']>[2] = {};
    if ( updates.employeeId !== undefined ) marketingUpdates.employeeId = updates.employeeId;
    if ( updates.employeeType !== undefined ) marketingUpdates.employeeType = 'marketing';
    if ( updates.title !== undefined ) marketingUpdates.title = updates.title;
    if ( updates.planKind !== undefined ) {
      marketingUpdates.sourceType = updates.planKind as Parameters<MarketingEmployeeService['updateMarketingPlan']>[2]['sourceType'];
    }
    if ( updates.rawText !== undefined ) marketingUpdates.rawText = updates.rawText;
    if ( updates.extracted !== undefined ) {
      marketingUpdates.extracted = {
        goals: [...( updates.extracted.goals || [] )],
        audiences: [...( updates.extracted.audiences || [] )],
        channels: [...( updates.extracted.channels || [] )],
        campaigns: [...( updates.extracted.campaigns || [] )],
        contentThemes: [...( updates.extracted.themes || [] )],
        kpis: [...( updates.extracted.kpis || [] )],
        timeline: String( updates.extracted.timeline || '' ).trim()
      };
    }
    if ( updates.status !== undefined ) marketingUpdates.status = updates.status;
    if ( updates.sourceFileName !== undefined ) marketingUpdates.sourceFileName = updates.sourceFileName;
    if ( updates.sourceFileUrl !== undefined ) marketingUpdates.sourceFileUrl = updates.sourceFileUrl;
    await this.marketingEmployeeService.updateMarketingPlan(
      tenantId,
      planId,
      marketingUpdates
    );
  }

  watchConversations (
    tenantId: string,
    employeeId: string,
    options?: { limit?: number; }
  ): Observable<EmployeeConversationRecord[]> {
    return this.marketingEmployeeService.watchConversations( tenantId, employeeId, options ).pipe(
      map( records => records.map( marketingConversationToEmployeeConversation ) )
    );
  }

  async createConversation (
    tenantId: string,
    conversation: Omit<EmployeeConversationRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    return this.marketingEmployeeService.createConversation( tenantId, {
      ...conversation,
      employeeType: 'marketing'
    } );
  }

  watchConversationMessages (
    tenantId: string,
    conversationId: string,
    options?: { limit?: number; }
  ): Observable<EmployeeConversationMessageRecord[]> {
    return this.marketingEmployeeService.watchConversationMessages( tenantId, conversationId, options ).pipe(
      map( records => records.map( marketingMessageToEmployeeMessage ) )
    );
  }

  async appendConversationMessage (
    tenantId: string,
    conversationId: string,
    message: Omit<EmployeeConversationMessageRecord, 'id' | 'createdAt'>
  ): Promise<string> {
    return this.marketingEmployeeService.appendConversationMessage(
      tenantId,
      conversationId,
      employeeMessageToMarketingMessage( message )
    );
  }

  watchOutcomes ( tenantId: string, employeeId: string ): Observable<EmployeeOutcomeRecord[]> {
    return this.marketingEmployeeService.watchOutcomes( tenantId, employeeId ).pipe(
      map( records => records.map( record => ( { ...record } ) ) )
    );
  }

  async createOutcome (
    tenantId: string,
    outcome: Omit<EmployeeOutcomeRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    return this.marketingEmployeeService.createOutcome( tenantId, {
      ...outcome,
      employeeType: 'marketing'
    } );
  }

  async generateDailyPlan (
    tenantId: string,
    employeeId: string,
    activePlan?: EmployeePlanRecord | null,
    planStatus?: EmployeePlanStatusInput | null
  ): Promise<MarketingDailyPlanGenerationResult> {
    return this.marketingEmployeeService.generateDailyMarketingPlanFromPlan(
      tenantId,
      employeeId,
      activePlan ? employeePlanToMarketingPlan( activePlan ) : null,
      planStatus || null
    );
  }
}
