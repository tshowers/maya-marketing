import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { getAuth } from 'firebase/auth';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { MarketingPlanGoalSteps, MarketingPlanOwners, MarketingPlanStep } from '../features/marketing/models/marketing-employee.models';

export interface MayaPlanSteps {
  id: string;
  steps: MarketingPlanStep[];
  goals: MarketingPlanGoalSteps[];
  owners: MarketingPlanOwners | null;
  datesConfirmed: boolean;
}

/**
 * The plan as steps (todd-backend/functions/maya/jobs.routes.js, /maya/plans).
 * The plan document itself is read live from Firestore; these calls do what
 * the browser can't: split the plan into steps (an AI call), save dates, and
 * finish a step.
 */
@Injectable( { providedIn: 'root' } )
export class MayaPlanService {
  constructor ( private readonly http: HttpClient ) { }

  /** Splits the plan into steps if it hasn't been, or its text changed. */
  async ensureSteps ( planId: string ): Promise<MayaPlanSteps> {
    const response = await firstValueFrom( this.http.post<{ plan: MayaPlanSteps }>(
      `${environment.backendURL}/maya/plans/${encodeURIComponent( planId )}/steps`, {}, { headers: await this.headers() } ) );
    return response.plan;
  }

  /** Confirms the dates: Maya's as they are, or with the user's edits. */
  async saveDates ( planId: string, steps: Array<Pick<MarketingPlanStep, 'id' | 'plannedStart' | 'plannedEnd'>> = [] ): Promise<MayaPlanSteps> {
    const response = await firstValueFrom( this.http.put<{ plan: MayaPlanSteps }>(
      `${environment.backendURL}/maya/plans/${encodeURIComponent( planId )}/dates`, { steps }, { headers: await this.headers() } ) );
    return response.plan;
  }

  async completeStep ( planId: string, stepId: string ): Promise<MayaPlanSteps> {
    const response = await firstValueFrom( this.http.post<{ plan: MayaPlanSteps }>(
      `${environment.backendURL}/maya/plans/${encodeURIComponent( planId )}/steps/${encodeURIComponent( stepId )}/complete`,
      {}, { headers: await this.headers() } ) );
    return response.plan;
  }

  private async headers (): Promise<Record<string, string>> {
    const user = getAuth().currentUser;
    if ( !user ) throw new Error( 'Please sign in again.' );
    return { Authorization: `Bearer ${await user.getIdToken()}` };
  }
}
