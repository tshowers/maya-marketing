import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { MayaAuthService } from '../../services/maya-auth.service';
import { EmailFillIn, EmailSendTarget, MayaJob, MayaJobStep, MayaJobsService, MayaPlanFit, PushbackLevel, CHAT_BRIEF_MARKER, jobPath } from '../../services/maya-jobs.service';

/**
 * Opens an email Maya designed in Email Creator to revise it there. Email
 * Creator loads it from Docs, with its images (web-products/email-creator,
 * ?mayaEmail=, backend GET /email-creator/maya-email/:documentId).
 */
export function emailCreatorEditUrl ( documentId: string ): string {
  return `https://emails.16ahead.com/?mayaEmail=${encodeURIComponent( documentId )}`;
}

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
const CLOSED_STATUSES = new Set( ['done', 'failed', 'cancelled'] );
const NEEDS_YOU_STATUSES = new Set( ['awaiting_user', 'awaiting_decision', 'awaiting_approval', 'stopped'] );
/** A closed job stays under "Now" this long, so a finished email is still at hand to send. */
const RECENT_MS = 24 * 60 * 60 * 1000;
const FAST_POLL_MS = 5000;
const SLOW_POLL_MS = 30000;

/** Which part of the work page a route shows. */
export type WorkView = 'ask' | 'jobs' | 'job';

/**
 * Maya's work, in three routes (Ty, 2026-10-30): /work is Ask (what to do,
 * and how hard she pushes back), /work/jobs lists every job with the ones
 * waiting on you first, and /work/jobs/:id is one job on its own, with its
 * concerns, questions, approvals and finished emails. The old ?job= links
 * redirect to the job's page. Backed by /api/maya/jobs
 * (MAYA-ORCHESTRATION-DESIGN.md, gaps 3 and 6).
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
    { id: 'firm', label: 'Firm', detail: 'Stops and makes its case when a request works against the plan.' },
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
  pushbackLevel: PushbackLevel | null = null;
  socialAutopilot = false;
  previews: Record<string, SafeHtml> = {};
  previewOpen: Record<string, boolean> = {};
  sendPanel: SendPanel | null = null;
  view: WorkView = 'ask';
  /** The job /work/jobs/:id shows. */
  jobId = '';
  /** Set when that job isn't in the list and couldn't be loaded on its own. */
  jobMissing = false;
  /** A job opened by id that's older than the list goes back (kept so its page still works). */
  private openedJob: MayaJob | null = null;
  /** Decision cards whose full request is showing. */
  requestOpen: Record<string, boolean> = {};
  /** Jobs list tab: what's going on now, or finished work. */
  tab: 'now' | 'past' = 'now';
  readonly targetNames: Record<EmailSendTarget, string> = { catalyst: 'Catalyst', composer: 'Email Composer' };
  readonly editUrl = emailCreatorEditUrl;
  private emailHtml: Record<string, string> = {};

  private authSubscription?: Subscription;
  private paramSubscription?: Subscription;
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
    this.title.setTitle( "The Marketing Assistant's work — Marketing Assistant | 16Ahead" );
    // Links from before jobs had their own page (/work?job=<id>) open the job's page.
    const linkedJob = this.route.snapshot.queryParamMap.get( 'job' );
    if ( linkedJob ) {
      void this.router.navigateByUrl( jobPath( linkedJob ), { replaceUrl: true } );
      return;
    }
    this.view = ( this.route.snapshot.data['view'] as WorkView ) || 'ask';
    this.paramSubscription = this.route.paramMap.subscribe( ( params ) => {
      this.jobId = params.get( 'id' ) || '';
      this.jobMissing = false;
      this.openedJob = null;
      this.sendPanel = null;
      if ( this.jobId && this.loaded ) void this.loadOpenedJob();
    } );
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
    this.paramSubscription?.unsubscribe();
    if ( this.pollTimer ) clearTimeout( this.pollTimer );
  }

  /** Sign in goes through the get-started wizard, then comes back here. */
  signIn (): void {
    void this.router.navigate( ['/get-started'], { queryParams: { returnUrl: '/work' } } );
  }

  /** The job this page shows, kept fresh by the list's polling. */
  get job (): MayaJob | null {
    if ( !this.jobId ) return null;
    return this.jobs.find( ( job ) => job.id === this.jobId ) || this.openedJob;
  }

  /** Jobs waiting on the person: a concern, a question, drafts to approve, or a stop. */
  get needsYouJobs (): MayaJob[] {
    const waiting = new Set( this.approvals.map( ( item ) => item.job.id ) );
    return this.jobs.filter( ( job ) => NEEDS_YOU_STATUSES.has( job.status ) || waiting.has( job.id ) );
  }

  get jobApprovals (): ApprovalItem[] {
    return this.approvals.filter( ( entry ) => entry.job.id === this.jobId );
  }

  get jobEmails (): EmailResult[] {
    const job = this.job;
    return job ? this.emails( job ) : [];
  }

  /** Everything waiting for a yes or no, oldest job first. */
  get approvals (): ApprovalItem[] {
    const items: ApprovalItem[] = [];
    const jobs = this.openedJob && !this.jobs.some( ( job ) => job.id === this.openedJob!.id ) ? [...this.jobs, this.openedJob] : this.jobs;
    for ( const job of [...jobs].reverse() ) {
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

  async decidePlan ( job: MayaJob, choice: 'recommended' | 'as_asked' | 'cancel' ): Promise<void> {
    if ( this.busy[job.id] ) return;
    this.busy[job.id] = true;
    this.errorMessage = '';
    try {
      this.replace( await this.api.decidePlan( job.id, choice ) );
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

  /** An idea fills the box to edit or send, so one click doesn't start a job. */
  useIdea ( idea: string, input: HTMLTextAreaElement ): void {
    this.request = idea;
    input.focus();
  }

  /** In progress, waiting on the person, or closed within the last day. */
  isCurrent ( job: MayaJob ): boolean {
    if ( !CLOSED_STATUSES.has( job.status ) ) return true;
    return Date.now() - new Date( job.updatedAt ).getTime() < RECENT_MS;
  }

  get currentJobs (): MayaJob[] {
    return this.jobs.filter( ( job ) => this.isCurrent( job ) );
  }

  get pastJobs (): MayaJob[] {
    return this.jobs.filter( ( job ) => !this.isCurrent( job ) );
  }

  get shownJobs (): MayaJob[] {
    return this.tab === 'now' ? this.currentJobs : this.pastJobs;
  }

  /** What the person asked, without the brief the chat appended. */
  jobTitle ( job: MayaJob ): string {
    return job.request.replace( CHAT_BRIEF_MARKER, '' ).trim() || job.request;
  }

  /** Whether the request carries more than its title shows. */
  hasMoreRequest ( job: MayaJob ): boolean {
    return this.jobTitle( job ) !== job.request.trim();
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
      this.request = '';
      // The job's own page shows it planning, and any question or concern it has.
      void this.router.navigateByUrl( jobPath( job.id ) );
      this.schedulePoll( FAST_POLL_MS );
    } catch ( error: any ) {
      this.needsPurchase = error?.error?.error === 'APP_PURCHASE_REQUIRED';
      this.errorMessage = error?.error?.message || error?.message || 'The Marketing Assistant couldn’t start that.';
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
        subject: String( step.output!['subject'] || 'Email from the Marketing Assistant' ),
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
      this.errorMessage = error?.error?.message || error?.message || 'The Marketing Assistant didn’t get that answer. Please try again.';
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
      case 'awaiting_decision': return 'The Marketing Assistant has concerns';
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
    if ( this.openedJob?.id === job.id ) this.openedJob = job;
  }

  /** A job the list doesn't include (older than it goes back), loaded on its own. */
  private async loadOpenedJob (): Promise<void> {
    const jobId = this.jobId;
    if ( !jobId || this.jobs.some( ( job ) => job.id === jobId ) ) return;
    try {
      const job = await this.api.get( jobId );
      if ( this.jobId === jobId ) this.openedJob = job;
    } catch {
      if ( this.jobId === jobId ) this.jobMissing = true;
    }
  }

  private async refresh (): Promise<void> {
    try {
      this.jobs = await this.api.list();
      if ( this.jobId && !this.jobs.some( ( job ) => job.id === this.jobId ) ) {
        // Refetched each pass so a job opened by id stays current too.
        await this.loadOpenedJob();
      }
      this.loaded = true;
    } catch ( error: any ) {
      this.errorMessage = error?.error?.message || error?.message || 'We couldn’t load the Marketing Assistant’s work.';
    }
    const active = this.jobs.some( ( job ) => this.isActive( job ) ) || ( !!this.openedJob && this.isActive( this.openedJob ) );
    this.schedulePoll( active ? FAST_POLL_MS : SLOW_POLL_MS );
  }

  /**
   * emails() builds new objects on every pass; keyed by document, the email
   * blocks (and their Catalyst / Composer buttons) aren't rebuilt mid-click.
   */
  trackEmail ( _index: number, email: EmailResult ): string {
    return email.documentId;
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
