import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { MayaAuthService } from '../../services/maya-auth.service';
import { EmailFillIn, EmailSendTarget, MayaJob, MayaJobStep, MayaJobsService, MayaPlanFit, PushbackLevel } from '../../services/maya-jobs.service';

/** One thing waiting on the user, from any job. */
interface ApprovalItem {
  job: MayaJob;
  step: MayaJobStep;
  /** The drafted post this approval would schedule (from the step it depends on). */
  preview: Record<string, any> | null;
}

/** A finished email from a job, ready to open in Docs. */
interface EmailResult {
  documentId: string;
  subject: string;
  preheader: string;
  fillIns: string[];
}

/** Sending a finished email, the same two choices Email Creator offers. */
interface SendPanel {
  documentId: string;
  target: EmailSendTarget;
  /** null while checking; false when the workspace has no Outreach subscription. */
  canSend: boolean | null;
  fillIns: EmailFillIn[];
  values: Record<string, string>;
  working: boolean;
  error: string;
  /** Set once the handoff is ready; the user opens it in a new tab. */
  openUrl: string;
}

const ACTIVE_STATUSES = new Set( ['queued', 'running'] );
const FAST_POLL_MS = 5000;
const SLOW_POLL_MS = 30000;

/**
 * Maya's work: ask her to do something, see one list of everything waiting
 * on you across all her jobs (approving there does the action - the post is
 * scheduled, nothing else to open), and follow each job's progress.
 * Backed by /api/maya/jobs (MAYA-ORCHESTRATION-DESIGN.md, gaps 3 and 6).
 */
@Component( {
  selector: 'app-work',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './work.component.html',
  styleUrl: './work.component.css',
} )
export class WorkComponent implements OnInit, OnDestroy {
  readonly pushbackOptions: Array<{ id: PushbackLevel; label: string; detail: string; }> = [
    { id: 'firm', label: 'Firm', detail: 'Stops and makes her case when a request works against the plan.' },
    { id: 'standard', label: 'Standard', detail: 'Stops and lists the consequences, without arguing.' },
    { id: 'light', label: 'Light', detail: 'Goes ahead and tells you the consequences up front.' },
  ];

  readonly suggestions = [
    'Build a LinkedIn calendar for the next two weeks',
    'Plan three posts about our newest product',
    'Fill next week with posts on every account I have connected',
    'Write an email introducing us to new prospects',
  ];

  /** null until Firebase reports auth state; false shows the sign-in panel. */
  isSignedIn: boolean | null = null;
  jobs: MayaJob[] = [];
  loaded = false;
  errorMessage = '';
  needsPurchase = false;
  request = '';
  isStarting = false;
  answers: Record<string, string> = {};
  busy: Record<string, boolean> = {};
  expanded: Record<string, boolean> = {};
  pushbackLevel: PushbackLevel | null = null;
  socialAutopilot = false;
  previews: Record<string, SafeHtml> = {};
  previewOpen: Record<string, boolean> = {};
  sendPanel: SendPanel | null = null;
  readonly targetNames: Record<EmailSendTarget, string> = { catalyst: 'Catalyst', composer: 'Email Composer' };
  private emailHtml: Record<string, string> = {};

  private authSubscription?: Subscription;
  private pollTimer?: ReturnType<typeof setTimeout>;
  private destroyed = false;

  constructor (
    private readonly api: MayaJobsService,
    private readonly authService: MayaAuthService,
    private readonly title: Title,
    private readonly sanitizer: DomSanitizer,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) { }

  ngOnInit (): void {
    this.title.setTitle( "Maya's work — Maya | Taliferro Tech" );
    // Maya's chat links here with ?job=<id> after starting a job.
    const linkedJob = this.route.snapshot.queryParamMap.get( 'job' );
    if ( linkedJob ) this.expanded[linkedJob] = true;
    this.authSubscription = this.authService.isLoggedIn().subscribe( ( signedIn ) => {
      const wasSignedIn = this.isSignedIn;
      this.isSignedIn = signedIn;
      if ( signedIn && !wasSignedIn ) {
        void this.refresh();
        void this.loadSettings();
      }
    } );
  }

  ngOnDestroy (): void {
    this.destroyed = true;
    this.authSubscription?.unsubscribe();
    if ( this.pollTimer ) clearTimeout( this.pollTimer );
  }

  /** Sign in goes through the get-started wizard, then comes back here. */
  signIn (): void {
    void this.router.navigate( ['/get-started'], { queryParams: { returnUrl: '/work' } } );
  }

  /** Everything waiting for a yes or no, oldest job first. */
  get approvals (): ApprovalItem[] {
    const items: ApprovalItem[] = [];
    for ( const job of [...this.jobs].reverse() ) {
      if ( job.status === 'cancelled' || job.status === 'failed' ) continue;
      const byId = new Map( job.steps.map( ( step ) => [step.id, step] ) );
      for ( const step of job.steps ) {
        const decided = !!job.approvals?.[step.id];
        const ready = step.dependsOn.every( ( id ) => byId.get( id )?.status === 'done' );
        if ( step.access !== 'approval' || step.status !== 'pending' || step.approvedBy || decided || !ready ) continue;
        const source = step.dependsOn.map( ( id ) => byId.get( id ) ).find( ( dep ) => dep?.tool === 'social.draftPost' );
        items.push( { job, step, preview: source?.output || null } );
      }
    }
    return items;
  }

  /** Jobs Maya stopped because they work against the marketing plan. */
  get decisionJobs (): MayaJob[] {
    return this.jobs.filter( ( job ) => job.status === 'awaiting_decision' );
  }

  async decidePlan ( job: MayaJob, choice: 'recommended' | 'as_asked' | 'cancel' ): Promise<void> {
    if ( this.busy[job.id] ) return;
    this.busy[job.id] = true;
    this.errorMessage = '';
    try {
      this.replace( await this.api.decidePlan( job.id, choice ) );
      this.expanded[job.id] = true;
      this.schedulePoll( FAST_POLL_MS );
    } catch ( error: any ) {
      this.errorMessage = error?.error?.message || error?.message || 'That didn’t go through. Please try again.';
    } finally {
      this.busy[job.id] = false;
    }
  }

  async setPushback ( level: PushbackLevel ): Promise<void> {
    if ( level === this.pushbackLevel ) return;
    const previous = this.pushbackLevel;
    this.pushbackLevel = level;
    try {
      await this.api.saveSettings( level );
    } catch ( error: any ) {
      this.pushbackLevel = previous;
      this.errorMessage = error?.error?.message || error?.message || 'We couldn’t save that setting.';
    }
  }

  verdictLabel ( planFit: MayaPlanFit | null | undefined ): string {
    switch ( planFit?.verdict ) {
      case 'fits': return 'Fits your plan';
      case 'adjacent': return 'Close to your plan';
      case 'conflicts': return 'Works against your plan';
      case 'no_plan': return 'No marketing plan yet';
      default: return '';
    }
  }

  get questionJobs (): MayaJob[] {
    return this.jobs.filter( ( job ) => job.status === 'awaiting_user' );
  }

  async start ( text?: string ): Promise<void> {
    const request = ( text ?? this.request ).trim();
    if ( !request || this.isStarting ) return;
    this.isStarting = true;
    this.errorMessage = '';
    this.needsPurchase = false;
    try {
      const job = await this.api.start( request );
      this.jobs = [job, ...this.jobs];
      this.expanded[job.id] = true;
      this.request = '';
      this.schedulePoll( FAST_POLL_MS );
    } catch ( error: any ) {
      this.needsPurchase = error?.error?.error === 'APP_PURCHASE_REQUIRED';
      this.errorMessage = error?.error?.message || error?.message || 'Maya couldn’t start that.';
    } finally {
      this.isStarting = false;
    }
  }

  async decide ( item: ApprovalItem, decision: 'approve' | 'reject' ): Promise<void> {
    const key = `${item.job.id}/${item.step.id}`;
    if ( this.busy[key] ) return;
    this.busy[key] = true;
    this.errorMessage = '';
    try {
      await this.api.decide( item.job.id, item.step.id, decision );
      item.job.approvals = {
        ...( item.job.approvals || {} ),
        [item.step.id]: { decision: decision === 'approve' ? 'approved' : 'rejected', by: 'you', at: new Date().toISOString() },
      };
      this.schedulePoll( FAST_POLL_MS );
    } catch ( error: any ) {
      this.errorMessage = error?.error?.message || error?.message || 'That didn’t go through. Please try again.';
    } finally {
      this.busy[key] = false;
    }
  }

  async approveAll ( job: MayaJob ): Promise<void> {
    for ( const item of this.approvals.filter( ( entry ) => entry.job.id === job.id ) ) {
      await this.decide( item, 'approve' );
    }
  }

  /** Emails Maya designed in this job, with anything still to fill in before sending. */
  emails ( job: MayaJob ): EmailResult[] {
    return job.steps
      .filter( ( step ) => step.tool === 'email.create' && step.status === 'done' && step.output?.['documentId'] )
      .map( ( step ) => ( {
        documentId: String( step.output!['documentId'] ),
        subject: String( step.output!['subject'] || 'Email from Maya' ),
        preheader: String( step.output!['preheader'] || '' ),
        fillIns: Array.isArray( step.output!['fillIns'] ) ? step.output!['fillIns'] : [],
      } ) );
  }

  /** Loads (once) and shows or hides an email's preview. */
  async togglePreview ( email: EmailResult ): Promise<void> {
    if ( this.previews[email.documentId] !== undefined ) {
      this.previewOpen[email.documentId] = !this.previewOpen[email.documentId];
      return;
    }
    this.busy[email.documentId] = true;
    try {
      const loaded = await this.api.email( email.documentId );
      this.emailHtml[email.documentId] = loaded.html;
      // The frame is sandboxed with no permissions (no scripts, forms or
      // navigation), so rendering Maya's generated HTML in it is safe.
      this.previews[email.documentId] = this.sanitizer.bypassSecurityTrustHtml( loaded.html );
      this.previewOpen[email.documentId] = true;
    } catch ( error: any ) {
      this.errorMessage = error?.error?.message || error?.message || 'We couldn’t load that email.';
    } finally {
      this.busy[email.documentId] = false;
    }
  }

  async downloadHtml ( email: EmailResult ): Promise<void> {
    const html = await this.loadHtml( email );
    const url = URL.createObjectURL( new Blob( [html], { type: 'text/html' } ) );
    const link = document.createElement( 'a' );
    link.href = url;
    link.download = `${email.subject.replace( /[^a-z0-9_ -]/gi, '' ).trim().replace( /\s+/g, '-' ) || 'email'}.html`;
    link.click();
    setTimeout( () => URL.revokeObjectURL( url ), 1000 );
  }

  /**
   * Starts sending: checks the Outreach subscription and what's left to fill
   * in. With nothing to fill in, prepares the handoff straight away.
   */
  async openSend ( email: EmailResult, target: EmailSendTarget ): Promise<void> {
    const panel: SendPanel = { documentId: email.documentId, target, canSend: null, fillIns: [], values: {}, working: true, error: '', openUrl: '' };
    this.sendPanel = panel;
    try {
      const html = await this.loadHtml( email );
      const check = await this.api.sendCheck( email.subject, html );
      Object.assign( panel, { canSend: check.canSendWithOutreach, fillIns: check.fillIns[target] || [], working: false } );
      if ( panel.canSend && panel.fillIns.length === 0 ) await this.prepareSend( email );
    } catch ( error: any ) {
      Object.assign( panel, { working: false, error: error?.error?.message || error?.message || 'Something went wrong.' } );
    }
  }

  fillsComplete ( panel: SendPanel ): boolean {
    return panel.fillIns.every( ( item ) => ( panel.values[item.token] || '' ).trim().length > 0 );
  }

  async prepareSend ( email: EmailResult ): Promise<void> {
    const panel = this.sendPanel;
    if ( !panel || panel.documentId !== email.documentId || !this.fillsComplete( panel ) ) return;
    Object.assign( panel, { working: true, error: '' } );
    try {
      panel.openUrl = await this.api.handOffEmail( {
        target: panel.target, subject: email.subject, preheader: email.preheader, html: await this.loadHtml( email ), fills: panel.values,
      } );
    } catch ( error: any ) {
      panel.error = error?.error?.message || error?.message || 'Something went wrong.';
    } finally {
      panel.working = false;
    }
  }

  closeSend (): void {
    this.sendPanel = null;
  }

  approvalCount ( job: MayaJob ): number {
    return this.approvals.filter( ( entry ) => entry.job.id === job.id ).length;
  }

  async sendAnswer ( job: MayaJob ): Promise<void> {
    const answer = ( this.answers[job.id] || '' ).trim();
    if ( !answer || this.busy[job.id] ) return;
    this.busy[job.id] = true;
    try {
      const updated = await this.api.answer( job.id, answer );
      this.replace( updated );
      this.answers[job.id] = '';
      this.schedulePoll( FAST_POLL_MS );
    } catch ( error: any ) {
      this.errorMessage = error?.error?.message || error?.message || 'Maya didn’t get that answer. Please try again.';
    } finally {
      this.busy[job.id] = false;
    }
  }

  async cancel ( job: MayaJob ): Promise<void> {
    if ( this.busy[job.id] ) return;
    this.busy[job.id] = true;
    try {
      await this.api.cancel( job.id );
      await this.refresh();
    } finally {
      this.busy[job.id] = false;
    }
  }

  async resume ( job: MayaJob ): Promise<void> {
    if ( this.busy[job.id] ) return;
    this.busy[job.id] = true;
    try {
      await this.api.resume( job.id );
      this.schedulePoll( FAST_POLL_MS );
    } finally {
      this.busy[job.id] = false;
    }
  }

  isActive ( job: MayaJob ): boolean {
    return ACTIVE_STATUSES.has( job.status );
  }

  canCancel ( job: MayaJob ): boolean {
    return !['done', 'failed', 'cancelled'].includes( job.status );
  }

  statusLabel ( job: MayaJob ): string {
    switch ( job.status ) {
      case 'queued':
      case 'running': return job.steps.length ? 'Working on it' : 'Planning';
      case 'awaiting_user': return 'Needs your answer';
      case 'awaiting_decision': return 'Maya has concerns';
      case 'awaiting_approval': return 'Waiting for your approval';
      case 'waiting': return job.resumeAt ? `Continues ${this.shortDateTime( job.resumeAt )}` : 'Paused';
      case 'done': return 'Done';
      case 'failed': return 'Couldn’t finish';
      case 'stopped': return 'Stopped';
      case 'cancelled': return 'Cancelled';
      default: return job.status;
    }
  }

  statusTone ( job: MayaJob ): 'active' | 'attention' | 'done' | 'muted' | 'error' {
    if ( this.isActive( job ) ) return 'active';
    if ( ['awaiting_user', 'awaiting_decision', 'awaiting_approval', 'stopped'].includes( job.status ) ) return 'attention';
    if ( job.status === 'done' ) return 'done';
    if ( job.status === 'failed' ) return 'error';
    return 'muted';
  }

  progress ( job: MayaJob ): { done: number; total: number; } {
    const total = job.steps.length;
    const done = job.steps.filter( ( step ) => step.status !== 'pending' ).length;
    return { done, total };
  }

  stepLabel ( step: MayaJobStep ): string {
    const input = step.input || {};
    switch ( step.tool ) {
      case 'image.obtain': return step.output?.['reused'] ? 'Reused a library image' : `Image: ${String( input['title'] || input['topic'] || 'for a post' )}`;
      case 'social.draftPost': {
        const platform = this.platformLabel( String( step.output?.['platform'] || input['platform'] || 'social' ) );
        const day = step.output?.['plannedForDate'] || input['plannedForDate'];
        return `${platform} post${day ? ` for ${this.shortDate( String( day ) )}` : ''}`;
      }
      case 'social.approvePost': return step.approvedBy === 'autopilot' ? 'Approved by autopilot' : 'Your approval to post';
      case 'email.create': return `Email: ${String( step.output?.['subject'] || 'design' )}`;
      default: return step.tool;
    }
  }

  stepState ( step: MayaJobStep ): string {
    if ( step.status === 'done' ) return 'Done';
    if ( step.status === 'failed' ) return step.error?.message || 'Failed';
    if ( step.status === 'skipped' ) return step.skipReason === 'rejected' ? 'You said no' : 'Skipped';
    if ( step.notBefore ) return `Waiting until ${this.shortDateTime( step.notBefore )}`;
    return 'To do';
  }

  platformLabel ( platform: string ): string {
    const names: Record<string, string> = {
      linkedin: 'LinkedIn', threads: 'Threads', bluesky: 'Bluesky', reddit: 'Reddit', youtube: 'YouTube',
      google_business_profile: 'Google Business', instagram: 'Instagram', facebook: 'Facebook',
    };
    return names[platform] || platform;
  }

  shortDate ( dateKey: string ): string {
    const date = new Date( `${dateKey}T12:00:00` );
    return Number.isNaN( date.getTime() ) ? dateKey : date.toLocaleDateString( undefined, { weekday: 'short', month: 'short', day: 'numeric' } );
  }

  shortDateTime ( iso: string ): string {
    const date = new Date( iso );
    return Number.isNaN( date.getTime() ) ? iso : date.toLocaleString( undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' } );
  }

  trackById ( _index: number, item: { id: string } ): string {
    return item.id;
  }

  trackApproval ( _index: number, item: ApprovalItem ): string {
    return `${item.job.id}/${item.step.id}`;
  }

  private async loadHtml ( email: EmailResult ): Promise<string> {
    if ( this.emailHtml[email.documentId] === undefined ) {
      this.emailHtml[email.documentId] = ( await this.api.email( email.documentId ) ).html;
    }
    return this.emailHtml[email.documentId];
  }

  private async loadSettings (): Promise<void> {
    try {
      const settings = await this.api.settings();
      this.pushbackLevel = settings.pushbackLevel;
      this.socialAutopilot = settings.socialAutoApprove;
    } catch {
      this.pushbackLevel = 'firm';
    }
  }

  private replace ( job: MayaJob ): void {
    this.jobs = this.jobs.map( ( existing ) => existing.id === job.id ? job : existing );
  }

  private async refresh (): Promise<void> {
    try {
      this.jobs = await this.api.list();
      this.loaded = true;
    } catch ( error: any ) {
      this.errorMessage = error?.error?.message || error?.message || 'We couldn’t load Maya’s work.';
    }
    this.schedulePoll( this.jobs.some( ( job ) => this.isActive( job ) ) ? FAST_POLL_MS : SLOW_POLL_MS );
  }

  /** Polls quickly while Maya is working, slowly otherwise, and not while the tab is hidden. */
  private schedulePoll ( delay: number ): void {
    if ( this.destroyed || !this.isSignedIn ) return;
    if ( this.pollTimer ) clearTimeout( this.pollTimer );
    this.pollTimer = setTimeout( () => {
      if ( typeof document !== 'undefined' && document.hidden ) {
        this.schedulePoll( delay );
        return;
      }
      void this.refresh();
    }, delay );
  }
}
