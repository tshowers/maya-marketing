import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { getAuth } from 'firebase/auth';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export type MayaJobStatus =
  | 'queued' | 'running' | 'awaiting_user' | 'awaiting_decision' | 'awaiting_approval' | 'waiting'
  | 'done' | 'failed' | 'stopped' | 'cancelled';

export interface MayaJobStep {
  id: string;
  tool: string;
  input: Record<string, unknown>;
  dependsOn: string[];
  reason: string;
  access: 'direct' | 'approval';
  status: 'pending' | 'done' | 'failed' | 'skipped';
  notBefore: string | null;
  output: Record<string, any> | null;
  error: { code: string; message: string } | null;
  approvedBy: string | null;
  skipReason?: string;
}

export type PushbackLevel = 'firm' | 'standard' | 'light';

/** Maya's judgment of a job against the marketing plan. */
export interface MayaPlanFit {
  verdict: 'fits' | 'adjacent' | 'conflicts' | 'no_plan' | 'unknown';
  planReference?: string;
  reasoning?: string;
  ramifications?: Array<{ kind: string; detail: string; computed?: boolean }>;
  recommendation?: string;
  recommendedRequest?: string;
  action?: 'proceed' | 'ask' | 'skip';
  pushbackLevel?: PushbackLevel;
}

export interface MayaJob {
  id: string;
  request: string;
  originalRequest?: string;
  planFit?: MayaPlanFit | null;
  decision?: { choice: 'recommended' | 'as_asked' | 'cancel'; by: string; at: string; acknowledgement?: string } | null;
  summary: string;
  questions?: string[];
  brief: { goal: string; audience: string; deliverables: string[]; constraints: string[] } | null;
  estimate: { images: number; socialPosts: number; emails?: number } | null;
  steps: MayaJobStep[];
  status: MayaJobStatus;
  statusDetail: string;
  resumeAt: string | null;
  planner: { provider: string; model: string } | null;
  artifacts: Array<{ kind: 'image' | 'social_post' | 'email'; id: string; url?: string | null; plannedForDate?: string | null; subject?: string | null }>;
  approvals?: Record<string, { decision: 'approved' | 'rejected'; by: string; at: string }>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Maya's jobs (todd-backend/functions/maya/jobs.routes.js): ask her to do
 * something, follow it, answer her questions, and approve or reject what's
 * waiting on you. Authenticated with the signed-in user's Firebase ID token.
 */
@Injectable( { providedIn: 'root' } )
export class MayaJobsService {
  constructor ( private readonly http: HttpClient ) { }

  async start ( request: string ): Promise<MayaJob> {
    const response = await firstValueFrom( this.http.post<{ job: MayaJob }>(
      `${environment.backendURL}/maya/jobs`, { request }, { headers: await this.headers() } ) );
    return response.job;
  }

  async list ( limit = 25 ): Promise<MayaJob[]> {
    const response = await firstValueFrom( this.http.get<{ jobs: MayaJob[] }>(
      `${environment.backendURL}/maya/jobs`, { params: { limit }, headers: await this.headers() } ) );
    return response.jobs || [];
  }

  async answer ( jobId: string, answer: string ): Promise<MayaJob> {
    const response = await firstValueFrom( this.http.post<{ job: MayaJob }>(
      `${environment.backendURL}/maya/jobs/${encodeURIComponent( jobId )}/answers`, { answer }, { headers: await this.headers() } ) );
    return response.job;
  }

  async decide ( jobId: string, stepId: string, decision: 'approve' | 'reject' ): Promise<void> {
    await firstValueFrom( this.http.post(
      `${environment.backendURL}/maya/jobs/${encodeURIComponent( jobId )}/steps/${encodeURIComponent( stepId )}/${decision}`,
      {}, { headers: await this.headers() } ) );
  }

  /** An email Maya designed, for previewing. */
  async email ( documentId: string ): Promise<{ id: string; subject: string; preheader: string; html: string; }> {
    const response = await firstValueFrom( this.http.get<{ email: { id: string; subject: string; preheader: string; html: string; } }>(
      `${environment.backendURL}/maya/emails/${encodeURIComponent( documentId )}`, { headers: await this.headers() } ) );
    return response.email;
  }

  /** The user's answer when Maya pushed back. */
  async decidePlan ( jobId: string, choice: 'recommended' | 'as_asked' | 'cancel' ): Promise<MayaJob> {
    const response = await firstValueFrom( this.http.post<{ job: MayaJob }>(
      `${environment.backendURL}/maya/jobs/${encodeURIComponent( jobId )}/decision`, { choice }, { headers: await this.headers() } ) );
    return response.job;
  }

  async settings (): Promise<{ pushbackLevel: PushbackLevel; socialAutoApprove: boolean; }> {
    const response = await firstValueFrom( this.http.get<{ settings: { pushbackLevel: PushbackLevel; socialAutoApprove: boolean; } }>(
      `${environment.backendURL}/maya/settings`, { headers: await this.headers() } ) );
    return response.settings;
  }

  async saveSettings ( pushbackLevel: PushbackLevel ): Promise<void> {
    await firstValueFrom( this.http.put(
      `${environment.backendURL}/maya/settings`, { pushbackLevel }, { headers: await this.headers() } ) );
  }

  async cancel ( jobId: string ): Promise<void> {
    await firstValueFrom( this.http.post(
      `${environment.backendURL}/maya/jobs/${encodeURIComponent( jobId )}/cancel`, {}, { headers: await this.headers() } ) );
  }

  async resume ( jobId: string ): Promise<void> {
    await firstValueFrom( this.http.post(
      `${environment.backendURL}/maya/jobs/${encodeURIComponent( jobId )}/resume`, {}, { headers: await this.headers() } ) );
  }

  private async headers (): Promise<Record<string, string>> {
    const user = getAuth().currentUser;
    if ( !user ) throw new Error( 'Please sign in again.' );
    return { Authorization: `Bearer ${await user.getIdToken()}` };
  }
}
