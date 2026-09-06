import { Injectable } from '@angular/core';
import {
  MomentumActionLogEntry,
  MomentumMode,
  MomentumOwner,
  MomentumOrigin,
  MomentumSignal,
  MomentumStage,
  MomentumThread
} from '../shared/data/interfaces/momentum-thread.model';
import { LoggerService } from './logger.service';

export interface MomentumThreadCreatePayload {
  contactId: string;
  emailAddress?: string;
  contactName?: string;
  companyName?: string;
  senderEmail?: string;
  senderName?: string;
  campaignId?: string;
  actionId?: string | null;
  planId?: string | null;
  strategyId?: string | null;
  segmentId?: string | null;
  angleId?: string | null;
  subject?: string;
  origin?: MomentumOrigin;
  signalEngineEnabled?: boolean;
  owner?: MomentumOwner;
  mode?: MomentumMode;
}

export interface MomentumThreadSignalSnapshot {
  contactId?: string;
  emailAddress: string;
  contactName?: string;
  companyName?: string;
  campaignId?: string;
  subject?: string;
  sentCount?: number;
  openCount?: number;
  clickCount?: number;
  replyCount?: number;
  lastSentAt?: string;
  lastOpenedAt?: string;
  lastClickedAt?: string;
  lastClickedUrl?: string;
}

export interface MomentumCockpitSummary {
  active: number;
  waiting: number;
  engaged: number;
  needsYou: number;
  paused: number;
  queued: number;
  sending: number;
}

const MOMENTUM_THREADS_STORAGE_KEY = 'todd.momentumThreads';

@Injectable( {
  providedIn: 'root'
} )
export class MomentumThreadService {
  private readonly threads = new Map<string, MomentumThread>();
  private lastPersistedSnapshot = '';
  private persistTimeoutId: number | null = null;

  constructor ( private logger: LoggerService ) {
    this.loadThreadsFromStorage();
  }
  getThreads (): MomentumThread[] {
    return Array.from( this.threads.values() ).sort( ( a, b ) => {
      const aTime = this.toMillis( a.sortAt || a.lastSentAt || a.nextActionAt );
      const bTime = this.toMillis( b.sortAt || b.lastSentAt || b.nextActionAt );
      return bTime - aTime;
    } );
  }

  getThreadByContactId ( contactId: string ): MomentumThread | null {
    if ( !contactId ) return null;
    return this.threads.get( contactId ) || null;
  }

  getThreadByEmailAddress ( emailAddress: string ): MomentumThread | null {
    const normalizedEmail = this.normalizeEmailAddress( emailAddress );
    if ( !normalizedEmail ) return null;

    for ( const thread of this.threads.values() ) {
      if ( this.normalizeEmailAddress( thread.emailAddress ) === normalizedEmail ) {
        return thread;
      }
    }

    return null;
  }

  upsertThread ( thread: MomentumThread, options?: { persist?: boolean; } ): void {
    if ( !thread?.contactId ) return;
    const nextThread = { ...thread };
    const existingThread = this.threads.get( thread.contactId );
    if ( this.areThreadsEquivalent( existingThread, nextThread ) ) {
      return;
    }

    this.threads.set( thread.contactId, nextThread );
    if ( options?.persist !== false ) {
      this.schedulePersistThreads();
    }
  }

  upsertThreads ( threads: MomentumThread[], options?: { persist?: boolean; } ): void {
    if ( !Array.isArray( threads ) || !threads.length ) return;

    let didChange = false;
    threads.forEach( ( thread ) => {
      if ( !thread?.contactId ) return;
      const nextThread = { ...thread };
      const existingThread = this.threads.get( thread.contactId );
      if ( this.areThreadsEquivalent( existingThread, nextThread ) ) {
        return;
      }

      this.threads.set( thread.contactId, nextThread );
      didChange = true;
    } );

    if ( didChange && options?.persist !== false ) {
      this.schedulePersistThreads();
    }
  }

  replaceThreads ( threads: MomentumThread[], options?: { persist?: boolean; } ): void {
    const nextThreads = Array.isArray( threads ) ? threads.filter( ( thread ) => !!thread?.contactId ) : [];
    const nextMap = new Map<string, MomentumThread>();
    nextThreads.forEach( ( thread ) => {
      nextMap.set( thread.contactId, { ...thread } );
    } );

    const currentSnapshot = JSON.stringify( Array.from( this.threads.entries() ) );
    const nextSnapshot = JSON.stringify( Array.from( nextMap.entries() ) );
    if ( currentSnapshot === nextSnapshot ) return;

    this.threads.clear();
    nextMap.forEach( ( thread, contactId ) => {
      this.threads.set( contactId, thread );
    } );

    if ( options?.persist !== false ) {
      this.schedulePersistThreads();
    }
  }

  createThreadFromSentEmail ( payload: MomentumThreadCreatePayload ): MomentumThread {
    const existingThread = this.getThreadByContactId( payload.contactId );
    const now = new Date().toISOString();
    const signalEngineEnabled = payload.signalEngineEnabled !== false;
    const resolvedMode = signalEngineEnabled
      ? ( payload.mode || existingThread?.mode || 'auto_send' )
      : 'handoff';
    const resolvedOwner = signalEngineEnabled
      ? ( payload.owner || existingThread?.owner || 'todd' )
      : 'user';
    const resetReason = existingThread?.contactId
      ? 'A new outbound email restarted the signal sequence for this contact.'
      : 'Initial thread created from sent email.';

    const thread: MomentumThread = {
      id: existingThread?.id || this.buildThreadId( payload.contactId ),
      contactId: payload.contactId,
      emailAddress: this.normalizeEmailAddress( payload.emailAddress || existingThread?.emailAddress ),
      contactName: payload.contactName || existingThread?.contactName,
      companyName: payload.companyName || existingThread?.companyName,
      senderEmail: this.normalizeEmailAddress( payload.senderEmail || existingThread?.senderEmail ),
      senderName: payload.senderName || existingThread?.senderName,
      campaignId: payload.campaignId || existingThread?.campaignId,
      actionId: payload.actionId || existingThread?.actionId || existingThread?.actionPlanId || null,
      actionPlanId: payload.actionId || existingThread?.actionPlanId || existingThread?.actionId || null,
      planId: payload.planId || existingThread?.planId || null,
      strategyId: payload.strategyId || existingThread?.strategyId || null,
      segmentId: payload.segmentId || existingThread?.segmentId || null,
      angleId: payload.angleId || existingThread?.angleId || null,
      origin: payload.origin || existingThread?.origin || 'unknown',
      signalEngineEnabled,
      lastResetAt: existingThread?.contactId ? now : existingThread?.lastResetAt,
      lastResetReason: resetReason,
      owner: resolvedOwner,
      mode: resolvedMode,
      signalState: 'no_open',
      stage: 'first_touch',
      isMomentumActive: signalEngineEnabled && this.resolveMomentumActive( resolvedMode ),
      touchCount: 1,
      openCount: 0,
      clickCount: 0,
      replyCount: 0,
      followUpCount: 0,
      draftedCount: 0,
      autoSentCount: resolvedMode === 'auto_send' ? 1 : 0,
      lastSubject: payload.subject,
      lastSentAt: now,
      lastOpenedAt: undefined,
      lastClickedAt: undefined,
      lastClickedUrl: undefined,
      nextActionAt: undefined,
      nextActionType: signalEngineEnabled ? 'wait' : 'handoff_to_user',
      nextActionReason: signalEngineEnabled
        ? 'Signal Engine took control after the latest send.'
        : 'Signal Engine is off for this thread. You now own the follow-up.',
      queueState: signalEngineEnabled
        ? ( resolvedMode === 'auto_send' ? 'sending' : 'waiting' )
        : 'handoff',
      scheduledAt: undefined,
      lastEvaluatedAt: now,
      strategy: signalEngineEnabled ? 'Initial outreach' : 'Manual follow-up',
      draftSubject: undefined,
      draftBody: undefined,
      strategySummary: undefined,
      lastAutomationNote: signalEngineEnabled
        ? 'Signal Engine owns this thread after the latest send.'
        : 'Signal Engine is off for this thread.',
      actionLog: [
        this.buildLogEntry(
          'created',
          existingThread?.contactId ? 'Signal sequence restarted' : 'Signal thread started',
          resetReason,
          now
        )
      ]
    };

    this.upsertThread( thread );
    return thread;
  }

  importSignalSnapshot ( payload: MomentumThreadSignalSnapshot, options?: { persist?: boolean; } ): MomentumThread | null {
    const normalizedEmail = this.normalizeEmailAddress( payload.emailAddress );
    if ( !normalizedEmail ) return null;

    const existingThread = this.getThreadByEmailAddress( normalizedEmail )
      || ( payload.contactId ? this.getThreadByContactId( payload.contactId ) : null );

    const contactId = payload.contactId || existingThread?.contactId || normalizedEmail;
    const openCount = Math.max( payload.openCount || 0, existingThread?.openCount || 0 );
    const clickCount = Math.max( payload.clickCount || 0, existingThread?.clickCount || 0 );
    const replyCount = Math.max( payload.replyCount || 0, existingThread?.replyCount || 0 );
    const sentCount = Math.max( payload.sentCount || 0, existingThread?.touchCount || 0, 1 );

    const signalState = this.resolveSignalState( openCount, clickCount, replyCount );
    const queueState = this.resolveImportedQueueState( signalState, existingThread?.queueState );
    const mode = this.resolveImportedMode( signalState, existingThread?.mode );
    const owner = this.resolveImportedOwner( signalState, existingThread?.owner );
    const nextActionType = this.resolveImportedNextAction( signalState );

    const thread: MomentumThread = {
      id: existingThread?.id || this.buildThreadId( contactId ),
      contactId,
      emailAddress: normalizedEmail,
      contactName: payload.contactName || existingThread?.contactName || normalizedEmail,
      companyName: payload.companyName || existingThread?.companyName,
      senderEmail: existingThread?.senderEmail,
      senderName: existingThread?.senderName,
      campaignId: payload.campaignId || existingThread?.campaignId,
      origin: existingThread?.origin || 'unknown',
      signalEngineEnabled: existingThread?.signalEngineEnabled !== false,
      sequenceState: existingThread?.sequenceState,
      launchMode: existingThread?.launchMode,
      sequenceStepNumber: existingThread?.sequenceStepNumber,
      nextEligibleAt: existingThread?.nextEligibleAt,
      stoppedReason: existingThread?.stoppedReason,
      sequenceEnabled: existingThread?.sequenceEnabled,
      currentStepNumber: existingThread?.currentStepNumber,
      lastStepSentAt: existingThread?.lastStepSentAt,
      lastResetAt: existingThread?.lastResetAt,
      lastResetReason: existingThread?.lastResetReason,
      owner,
      mode,
      signalState,
      stage: this.resolveImportedStage( signalState, existingThread?.stage ),
      isMomentumActive: mode === 'draft_only' || mode === 'auto_send',
      touchCount: sentCount,
      openCount,
      clickCount,
      replyCount,
      followUpCount: existingThread?.followUpCount || 0,
      draftedCount: existingThread?.draftedCount || 0,
      autoSentCount: existingThread?.autoSentCount || 0,
      lastSubject: payload.subject || existingThread?.lastSubject,
      lastSentAt: payload.lastSentAt || existingThread?.lastSentAt,
      lastOpenedAt: payload.lastOpenedAt || existingThread?.lastOpenedAt,
      lastClickedAt: payload.lastClickedAt || existingThread?.lastClickedAt,
      lastClickedUrl: payload.lastClickedUrl || existingThread?.lastClickedUrl,
      nextActionAt: existingThread?.nextActionAt,
      nextActionType,
      nextActionReason: this.resolveImportedReason( signalState ),
      queueState,
      scheduledAt: existingThread?.scheduledAt,
      lastEvaluatedAt: new Date().toISOString(),
      strategy: existingThread?.strategy || 'Production outreach thread',
      draftSubject: existingThread?.draftSubject,
      draftBody: existingThread?.draftBody,
      strategySummary: existingThread?.strategySummary,
      lastAutomationNote: existingThread?.lastAutomationNote,
      actionLog: this.appendLogEntry(
        existingThread?.actionLog,
        this.buildLogEntry(
          'signal',
          this.resolveImportedLogTitle( signalState ),
          this.resolveImportedReason( signalState ),
          new Date().toISOString()
        ),
        true
      )
    };

    this.upsertThread( thread, options );
    return thread;
  }

  markOpened ( contactId: string ): void {
    const thread = this.getThreadByContactId( contactId );
    if ( !thread ) return;

    const openCount = ( thread.openCount || 0 ) + 1;
    const signalState: MomentumSignal = openCount > 1 ? 'multi_open' : 'opened';

    this.upsertThread( {
      ...thread,
      openCount,
      signalState,
      lastOpenedAt: new Date().toISOString(),
      queueState: 'drafting',
      lastEvaluatedAt: new Date().toISOString(),
      nextActionType: 'draft_followup',
      nextActionReason: openCount > 1
        ? 'Repeated opens detected. Keep the subject logic and draft a softer body follow-up.'
        : 'First open detected. The subject resonated, so draft a follow-up that refactors the body.',
      actionLog: this.appendThreadLog(
        thread,
        'signal',
        openCount > 1 ? 'Signal read: repeat open' : 'Signal read: opened',
        openCount > 1
          ? `TODD kept the subject logic for ${this.getThreadContextLabel( thread )} and moved this thread into a softer body-refactor path.`
          : `TODD interpreted the open as subject resonance for ${this.getThreadContextLabel( thread )} and moved this thread into a body-refactor path.`
      )
    } );
  }

  markClicked ( contactId: string ): void {
    const thread = this.getThreadByContactId( contactId );
    if ( !thread ) return;

    this.upsertThread( {
      ...thread,
      clickCount: ( thread.clickCount || 0 ) + 1,
      signalState: 'clicked',
      stage: 'engaged',
      lastClickedAt: new Date().toISOString(),
      queueState: 'drafting',
      lastEvaluatedAt: new Date().toISOString(),
      followUpCount: ( thread.followUpCount || 0 ) + 1,
      nextActionType: 'draft_followup',
      nextActionReason: 'Link clicked. Prepare a stronger follow-up.',
      actionLog: this.appendThreadLog(
        thread,
        'signal',
        'Signal read: clicked interest',
        `A clicked link on ${this.getClickedTopicLabel( thread )} moved this thread into a stronger follow-up path for ${this.getThreadContextLabel( thread )}.`
      )
    } );
  }

  markReplied ( contactId: string ): void {
    const thread = this.getThreadByContactId( contactId );
    if ( !thread ) return;

    this.upsertThread( {
      ...thread,
      replyCount: ( thread.replyCount || 0 ) + 1,
      signalState: 'replied',
      mode: 'handoff',
      owner: 'user',
      isMomentumActive: false,
      nextActionType: 'handoff_to_user',
      nextActionReason: 'Reply received. Hand off to user.',
      queueState: 'handoff',
      lastEvaluatedAt: new Date().toISOString(),
      stage: 'engaged',
      actionLog: this.appendThreadLog(
        thread,
        'handoff',
        'Signal read: reply handoff',
        'TODD stopped automation and handed this thread back to you.'
      )
    } );
  }

  setOwner ( contactId: string, owner: MomentumOwner ): void {
    const thread = this.getThreadByContactId( contactId );
    if ( !thread ) return;

    this.upsertThread( {
      ...thread,
      owner
    } );
  }

  setMode ( contactId: string, mode: MomentumMode ): void {
    const thread = this.getThreadByContactId( contactId );
    if ( !thread ) return;

    this.upsertThread( {
      ...thread,
      mode,
      isMomentumActive: this.resolveMomentumActive( mode ),
      nextActionType: mode === 'paused' ? 'pause' : thread.nextActionType,
      nextActionReason: mode === 'paused'
        ? 'Momentum paused by user.'
        : thread.nextActionReason,
      queueState: mode === 'paused'
        ? 'paused'
        : ( mode === 'auto_send' ? 'queued' : thread.queueState ),
      lastEvaluatedAt: new Date().toISOString(),
      actionLog: this.appendThreadLog(
        thread,
        mode === 'paused' ? 'paused' : 'control',
        mode === 'paused' ? 'Momentum paused' : 'Mode updated',
        mode === 'paused'
          ? 'Signal Engine is paused for this thread.'
          : `Thread mode changed to ${mode.replace( '_', ' ' )}.`
      )
    } );
  }

  pauseThread ( contactId: string, reason = 'Momentum paused by user.' ): void {
    const thread = this.getThreadByContactId( contactId );
    if ( !thread ) return;

    this.upsertThread( {
      ...thread,
      mode: 'paused',
      isMomentumActive: false,
      nextActionType: 'pause',
      nextActionReason: reason,
      queueState: 'paused',
      lastEvaluatedAt: new Date().toISOString(),
      actionLog: this.appendThreadLog(
        thread,
        'paused',
        'Thread paused',
        reason
      )
    } );
  }

  resumeThread ( contactId: string, reason = 'Momentum resumed.' ): void {
    const thread = this.getThreadByContactId( contactId );
    if ( !thread ) return;

    const resumedMode: MomentumMode = thread.owner === 'todd' ? 'auto_send' : 'draft_only';

    this.upsertThread( {
      ...thread,
      mode: resumedMode,
      isMomentumActive: true,
      nextActionType: 'wait',
      nextActionReason: reason,
      queueState: resumedMode === 'auto_send' ? 'queued' : 'waiting',
      lastEvaluatedAt: new Date().toISOString(),
      actionLog: this.appendThreadLog(
        thread,
        'control',
        'Thread resumed',
        reason
      )
    } );
  }

  takeOverThread ( contactId: string, reason = 'User took over this conversation.' ): void {
    const thread = this.getThreadByContactId( contactId );
    if ( !thread ) return;

    this.upsertThread( {
      ...thread,
      owner: 'user',
      mode: 'handoff',
      isMomentumActive: false,
      nextActionType: 'handoff_to_user',
      nextActionReason: reason,
      queueState: 'handoff',
      lastEvaluatedAt: new Date().toISOString(),
      actionLog: this.appendThreadLog(
        thread,
        'handoff',
        'User takeover',
        reason
      )
    } );
  }

  handoffToTodd ( contactId: string, reason = 'TODD resumed control of this conversation.' ): void {
    const thread = this.getThreadByContactId( contactId );
    if ( !thread ) return;

    this.upsertThread( {
      ...thread,
      owner: 'todd',
      mode: 'auto_send',
      isMomentumActive: true,
      nextActionType: 'wait',
      nextActionReason: reason,
      queueState: 'queued',
      lastEvaluatedAt: new Date().toISOString(),
      actionLog: this.appendThreadLog(
        thread,
        'control',
        'TODD resumed control',
        reason
      )
    } );
  }

  isThreadOwnedByTodd ( contactId: string ): boolean {
    const thread = this.getThreadByContactId( contactId );
    return !!thread && thread.owner === 'todd';
  }

  isMomentumActiveForContact ( contactId: string ): boolean {
    const thread = this.getThreadByContactId( contactId );
    return !!thread && thread.isMomentumActive;
  }

  hasToddOwnedActiveThread ( contactId: string ): boolean {
    const thread = this.getThreadByContactId( contactId );
    return !!thread
      && thread.isMomentumActive
      && thread.owner === 'todd'
      && thread.signalEngineEnabled !== false;
  }

  getSignalEngineLabel ( contactId: string ): string {
    const thread = this.getThreadByContactId( contactId );
    if ( !thread ) return 'Signal Idle';
    if ( thread.signalEngineEnabled === false ) return 'Manual Control';
    if ( thread.mode === 'paused' ) return 'Signal Paused';
    if ( thread.mode === 'handoff' || thread.owner === 'user' ) {
      return 'Needs You';
    }
    if ( thread.signalState === 'clicked' ) return 'Signal Engaged';
    if ( thread.signalState === 'multi_open' ) return 'Signal Watching';
    if ( thread.isMomentumActive ) return 'Signal Active';
    return 'Signal Idle';
  }

  getSignalEngineWarning ( contactId: string ): string {
    const thread = this.getThreadByContactId( contactId );
    if ( !thread ) return 'No signal thread is active for this contact.';
    if ( thread.signalEngineEnabled === false ) {
      return 'Signal Engine is off, so your manual follow-up will lead this relationship.';
    }
    return thread.nextActionReason
      || 'TODD is already managing the timing and next move for this contact.';
  }

  setNextAction (
    contactId: string,
    nextActionType: MomentumThread['nextActionType'],
    nextActionAt?: string,
    nextActionReason?: string
  ): void {
    const thread = this.getThreadByContactId( contactId );
    if ( !thread ) return;

    this.upsertThread( {
      ...thread,
      nextActionType,
      nextActionAt,
      nextActionReason,
      queueState: this.resolveQueueStateFromNextAction( nextActionType, thread.queueState ),
      scheduledAt: nextActionAt || thread.scheduledAt,
      lastEvaluatedAt: new Date().toISOString(),
      actionLog: this.shouldLogNextActionChange( thread, nextActionType, nextActionAt, nextActionReason )
        ? this.appendThreadLog(
          thread,
          this.resolveLogTypeForNextAction( nextActionType ),
          this.resolveLogTitleForNextAction( thread, nextActionType ),
          nextActionReason || 'Next move updated.'
        )
        : thread.actionLog
    } );
  }

  setQueueState ( contactId: string, queueState: MomentumThread['queueState'], scheduledAt?: string ): void {
    const thread = this.getThreadByContactId( contactId );
    if ( !thread ) return;

    this.upsertThread( {
      ...thread,
      queueState,
      scheduledAt: scheduledAt || thread.scheduledAt,
      lastEvaluatedAt: new Date().toISOString(),
      actionLog: queueState !== thread.queueState
        ? this.appendThreadLog(
          thread,
          this.resolveLogTypeForQueueState( queueState ),
          this.resolveLogTitleForQueueState( queueState ),
          scheduledAt
            ? `Queue state changed to ${queueState} and is timed for ${scheduledAt}.`
            : `Queue state changed to ${queueState}.`
        )
        : thread.actionLog
    } );
  }

  markDrafted ( contactId: string, reason = 'Follow-up drafted and ready for review.' ): void {
    const thread = this.getThreadByContactId( contactId );
    if ( !thread ) return;
    const toddOwned = thread.owner === 'todd' && thread.signalEngineEnabled !== false;

    this.upsertThread( {
      ...thread,
      draftedCount: ( thread.draftedCount || 0 ) + 1,
      followUpCount: ( thread.followUpCount || 0 ) + 1,
      mode: toddOwned ? 'auto_send' : thread.mode,
      queueState: toddOwned ? 'queued' : 'drafting',
      nextActionType: toddOwned ? 'send_followup' : 'draft_followup',
      nextActionReason: reason,
      nextActionAt: toddOwned ? new Date().toISOString() : thread.nextActionAt,
      scheduledAt: toddOwned ? new Date().toISOString() : thread.scheduledAt,
      lastEvaluatedAt: new Date().toISOString(),
      actionLog: this.appendThreadLog(
        thread,
        'drafted',
        this.getPlaybookTitle( thread, 'draft' ),
        this.getPlaybookDetail( thread, reason )
      )
    } );
  }

  applyAIDraft (
    contactId: string,
    draft: {
      subject: string;
      body: string;
      strategySummary: string;
      automationNote: string;
    }
  ): void {
    const thread = this.getThreadByContactId( contactId );
    if ( !thread ) return;
    const toddOwned = thread.owner === 'todd' && thread.signalEngineEnabled !== false;
    const now = new Date().toISOString();

    this.upsertThread( {
      ...thread,
      draftSubject: draft.subject,
      draftBody: draft.body,
      strategySummary: draft.strategySummary,
      lastAutomationNote: draft.automationNote,
      mode: toddOwned ? 'auto_send' : thread.mode,
      queueState: toddOwned ? 'queued' : 'drafting',
      nextActionType: toddOwned ? 'send_followup' : 'draft_followup',
      nextActionReason: draft.automationNote,
      nextActionAt: toddOwned ? now : thread.nextActionAt,
      scheduledAt: toddOwned ? now : thread.scheduledAt,
      lastEvaluatedAt: now,
      actionLog: this.appendThreadLog(
        thread,
        'drafted',
        this.getPlaybookTitle( thread, 'generated' ),
        this.getPlaybookDetail( thread, draft.automationNote )
      )
    } );
  }

  markQueued ( contactId: string, scheduledAt?: string, reason = 'Follow-up queued for send.' ): void {
    const thread = this.getThreadByContactId( contactId );
    if ( !thread ) return;

    this.upsertThread( {
      ...thread,
      queueState: 'queued',
      scheduledAt: scheduledAt || thread.scheduledAt,
      nextActionAt: scheduledAt || thread.nextActionAt,
      nextActionType: 'send_followup',
      nextActionReason: reason,
      lastEvaluatedAt: new Date().toISOString(),
      actionLog: this.appendThreadLog(
        thread,
        'queued',
        this.getPlaybookTitle( thread, 'queued' ),
        this.getPlaybookDetail( thread, reason )
      )
    } );
  }

  markSending ( contactId: string, reason = 'Follow-up is being sent now.' ): void {
    const thread = this.getThreadByContactId( contactId );
    if ( !thread ) return;

    this.upsertThread( {
      ...thread,
      queueState: 'sending',
      nextActionType: 'send_followup',
      nextActionReason: reason,
      lastEvaluatedAt: new Date().toISOString(),
      actionLog: this.appendThreadLog(
        thread,
        'sending',
        'Follow-up sending',
        reason
      )
    } );
  }

  markCompleted ( contactId: string, reason = 'Momentum sequence completed.' ): void {
    const thread = this.getThreadByContactId( contactId );
    if ( !thread ) return;

    this.upsertThread( {
      ...thread,
      mode: 'completed',
      queueState: 'completed',
      isMomentumActive: false,
      nextActionReason: reason,
      lastAutomationNote: reason,
      lastEvaluatedAt: new Date().toISOString(),
      actionLog: this.appendThreadLog(
        thread,
        'completed',
        'Sequence completed',
        reason
      )
    } );
  }

  scheduleNextAction ( contactId: string, scheduledAt: string, reason = 'Next action scheduled.' ): void {
    const thread = this.getThreadByContactId( contactId );
    if ( !thread ) return;

    this.upsertThread( {
      ...thread,
      scheduledAt,
      queueState: thread.queueState === 'drafting' ? 'drafting' : 'queued',
      nextActionAt: scheduledAt,
      lastEvaluatedAt: new Date().toISOString(),
      nextActionReason: reason,
      actionLog: this.appendThreadLog(
        thread,
        'queued',
        'Next move scheduled',
        reason
      )
    } );
  }

  getDueThreads ( nowIso = new Date().toISOString() ): MomentumThread[] {
    const nowMillis = this.toMillis( nowIso );

    return this.getThreads().filter( ( thread ) => {
      if ( !thread.isMomentumActive ) return false;
      if ( thread.queueState !== 'queued' ) return false;
      if ( !thread.scheduledAt ) return false;
      return this.toMillis( thread.scheduledAt ) <= nowMillis;
    } );
  }

  getThreadsByQueueState ( queueState: MomentumThread['queueState'] ): MomentumThread[] {
    return this.getThreads().filter( ( thread ) => thread.queueState === queueState );
  }

  clearAllThreads (): void {
    this.threads.clear();
    this.lastPersistedSnapshot = '';
    this.persistThreads();
  }

  reloadThreadsFromStorage (): void {
    this.loadThreadsFromStorage();
  }

  getCockpitSummary (): MomentumCockpitSummary {
    const threads = this.getThreads();

    return {
      active: threads.filter( ( thread ) => thread.isMomentumActive ).length,
      waiting: threads.filter( ( thread ) => thread.queueState === 'waiting' ).length,
      engaged: threads.filter( ( thread ) =>
        thread.signalState === 'opened'
        || thread.signalState === 'multi_open'
        || thread.signalState === 'clicked'
        || thread.queueState === 'drafting'
        || thread.queueState === 'queued'
        || thread.queueState === 'sending'
      ).length,
      needsYou: threads.filter( ( thread ) =>
        thread.mode === 'handoff' || thread.signalState === 'replied'
      ).length,
      paused: threads.filter( ( thread ) => thread.mode === 'paused' ).length,
      queued: threads.filter( ( thread ) => thread.queueState === 'queued' ).length,
      sending: threads.filter( ( thread ) => thread.queueState === 'sending' ).length
    };
  }

  private loadThreadsFromStorage (): void {
    if ( typeof localStorage === 'undefined' ) return;

    try {
      const raw = localStorage.getItem( MOMENTUM_THREADS_STORAGE_KEY );
      if ( !raw ) return;

      const parsed = JSON.parse( raw );
      if ( !Array.isArray( parsed ) ) return;

      this.threads.clear();

      parsed.forEach( ( thread: MomentumThread ) => {
        if ( thread?.contactId ) {
          this.threads.set( thread.contactId, { ...thread } );
        }
      } );

      this.lastPersistedSnapshot = raw;
    } catch ( error ) {
      this.logger.error( '[Signal Engine] Failed to load momentum threads from localStorage.', error );
    }
  }

  private persistThreads (): void {
    if ( typeof localStorage === 'undefined' ) return;

    try {
      const serialized = JSON.stringify( Array.from( this.threads.values() ) );
      if ( serialized === this.lastPersistedSnapshot ) {
        return;
      }

      localStorage.setItem( MOMENTUM_THREADS_STORAGE_KEY, serialized );
      this.lastPersistedSnapshot = serialized;
    } catch ( error ) {
      const storageErrorName = String( ( error as any )?.name || '' );
      const storageErrorMessage = String( ( error as any )?.message || '' );
      const looksLikeQuotaIssue = storageErrorName === 'QuotaExceededError'
        || storageErrorMessage.toLowerCase().includes( 'quota' );

      this.logger.error( '[Signal Engine] Failed to persist momentum threads to localStorage.', {
        error,
        looksLikeQuotaIssue,
        threadCount: this.threads.size
      } );
    }
  }

  private schedulePersistThreads (): void {
    if ( typeof window === 'undefined' || !window.setTimeout ) {
      this.persistThreads();
      return;
    }

    if ( this.persistTimeoutId ) {
      return;
    }

    this.persistTimeoutId = window.setTimeout( () => {
      this.persistTimeoutId = null;
      this.persistThreads();
    }, 100 );
  }

  private buildThreadId ( contactId: string ): string {
    return `momentum_${contactId}`;
  }

  private areThreadsEquivalent ( left?: MomentumThread | null, right?: MomentumThread | null ): boolean {
    if ( !left || !right ) return false;

    try {
      return JSON.stringify( left ) === JSON.stringify( right );
    } catch {
      return false;
    }
  }

  private normalizeEmailAddress ( emailAddress?: string ): string {
    return String( emailAddress || '' ).trim().toLowerCase();
  }

  private resolveSignalState (
    openCount: number,
    clickCount: number,
    replyCount: number
  ): MomentumSignal {
    if ( replyCount > 0 ) return 'replied';
    if ( clickCount > 0 ) return 'clicked';
    if ( openCount > 1 ) return 'multi_open';
    if ( openCount > 0 ) return 'opened';
    return 'no_open';
  }

  private resolveImportedStage (
    signalState: MomentumSignal,
    existingStage?: MomentumStage
  ): MomentumStage {
    if ( signalState === 'clicked' || signalState === 'replied' ) {
      return 'engaged';
    }

    return existingStage || 'first_touch';
  }

  private resolveImportedQueueState (
    signalState: MomentumSignal,
    existingQueueState?: MomentumThread['queueState']
  ): MomentumThread['queueState'] {
    if ( existingQueueState && existingQueueState !== 'idle' ) {
      return existingQueueState;
    }

    if ( signalState === 'replied' ) return 'handoff';
    if (
      signalState === 'clicked'
      || signalState === 'multi_open'
      || signalState === 'opened'
    ) return 'drafting';
    return 'waiting';
  }

  private resolveImportedMode (
    signalState: MomentumSignal,
    existingMode?: MomentumMode
  ): MomentumMode {
    if (
      existingMode
      && existingMode !== 'completed'
      && existingMode !== 'unsubscribed'
    ) {
      return existingMode;
    }

    if ( signalState === 'replied' ) return 'handoff';
    return 'auto_send';
  }

  private resolveImportedOwner (
    signalState: MomentumSignal,
    existingOwner?: MomentumOwner
  ): MomentumOwner {
    if ( existingOwner && existingOwner !== 'idle' ) {
      return existingOwner;
    }

    if ( signalState === 'replied' ) return 'user';
    return 'todd';
  }

  private resolveImportedNextAction (
    signalState: MomentumSignal
  ): MomentumThread['nextActionType'] {
    if ( signalState === 'replied' ) return 'handoff_to_user';
    if (
      signalState === 'clicked'
      || signalState === 'multi_open'
      || signalState === 'opened'
    ) return 'draft_followup';
    return 'wait';
  }

  private resolveImportedReason ( signalState: MomentumSignal ): string {
    if ( signalState === 'replied' ) {
      return 'A reply was detected in recent outreach activity. Hand the thread to the user.';
    }

    if ( signalState === 'clicked' ) {
      return 'Recent click activity suggests intent. Draft the next move.';
    }

    if ( signalState === 'multi_open' ) {
      return 'Repeated opens suggest curiosity. Prepare a softer follow-up.';
    }

    if ( signalState === 'opened' ) {
      return 'A recent open was detected. Keep the subject logic and refactor the email body.';
    }

    return 'Recent sent activity was found. Wait for the next signal.';
  }

  private resolveImportedLogTitle ( signalState: MomentumSignal ): string {
    if ( signalState === 'replied' ) return 'Imported reply handoff';
    if ( signalState === 'clicked' ) return 'Imported clicked-interest signal';
    if ( signalState === 'multi_open' ) return 'Imported repeat-open signal';
    if ( signalState === 'opened' ) return 'Imported open signal';
    return 'Imported no-open signal';
  }

  private resolveMomentumActive ( mode: MomentumMode ): boolean {
    return mode === 'draft_only' || mode === 'auto_send';
  }

  private resolveQueueStateFromNextAction (
    nextActionType: MomentumThread['nextActionType'],
    currentQueueState?: MomentumThread['queueState']
  ): MomentumThread['queueState'] {
    if ( nextActionType === 'pause' ) return 'paused';
    if ( nextActionType === 'handoff_to_user' ) return 'handoff';
    if ( nextActionType === 'draft_followup' ) return 'drafting';
    if ( nextActionType === 'send_followup' ) return 'queued';
    if ( nextActionType === 'wait' ) return 'waiting';
    return currentQueueState || 'idle';
  }

  private resolveLogTypeForNextAction (
    nextActionType: MomentumThread['nextActionType']
  ): MomentumActionLogEntry['type'] {
    if ( nextActionType === 'draft_followup' ) return 'drafted';
    if ( nextActionType === 'send_followup' ) return 'queued';
    if ( nextActionType === 'handoff_to_user' ) return 'handoff';
    if ( nextActionType === 'pause' ) return 'paused';
    return 'control';
  }

  private resolveLogTitleForNextAction (
    thread: MomentumThread,
    nextActionType: MomentumThread['nextActionType']
  ): string {
    if ( nextActionType === 'draft_followup' ) return this.getPlaybookTitle( thread, 'draft' );
    if ( nextActionType === 'send_followup' ) return this.getPlaybookTitle( thread, 'queued' );
    if ( nextActionType === 'handoff_to_user' ) return 'Next move: human handoff';
    if ( nextActionType === 'pause' ) return 'Next move: pause';
    return 'Next move: watch for signal';
  }

  private getPlaybookTitle (
    thread: MomentumThread,
    stage: 'draft' | 'generated' | 'queued'
  ): string {
    if ( thread.signalState === 'clicked' ) {
      if ( stage === 'generated' ) return 'Playbook generated: clicked-interest follow-up';
      if ( stage === 'queued' ) return 'Playbook queued: clicked-interest follow-up';
      return 'Playbook selected: clicked-interest follow-up';
    }

    if ( thread.signalState === 'multi_open' || thread.signalState === 'opened' ) {
      if ( stage === 'generated' ) return 'Playbook generated: body refactor';
      if ( stage === 'queued' ) return 'Playbook queued: body refactor';
      return 'Playbook selected: body refactor';
    }

    if ( stage === 'generated' ) return 'Playbook generated: subject rewrite';
    if ( stage === 'queued' ) return 'Playbook queued: subject rewrite';
    return 'Playbook selected: subject rewrite';
  }

  private getPlaybookDetail ( thread: MomentumThread, fallback: string ): string {
    const contextLabel = this.getThreadContextLabel( thread );

    if ( thread.signalState === 'clicked' ) {
      return `TODD is leaning into the clicked interest around ${this.getClickedTopicLabel( thread )} for ${contextLabel}. ${fallback}`;
    }

    if ( thread.signalState === 'multi_open' || thread.signalState === 'opened' ) {
      return `TODD is keeping the subject logic for ${contextLabel} and refactoring the body around what already got attention. ${fallback}`;
    }

    return `TODD is tailoring the next subject line more closely to ${contextLabel}. ${fallback}`;
  }

  private getThreadContextLabel ( thread: MomentumThread ): string {
    if ( thread.contactName && thread.companyName ) {
      return `${thread.contactName} at ${thread.companyName}`;
    }

    if ( thread.contactName ) return thread.contactName;
    if ( thread.companyName ) return thread.companyName;
    if ( thread.emailAddress ) return thread.emailAddress;
    return 'this contact';
  }

  private getClickedTopicLabel ( thread: MomentumThread ): string {
    const rawUrl = String( thread.lastClickedUrl || '' ).trim();
    if ( !rawUrl ) return 'that topic';

    try {
      const parsed = new URL( rawUrl );
      const parts = parsed.pathname.split( '/' ).filter( Boolean );
      const lastPart = parts[parts.length - 1] || parsed.hostname;
      return lastPart.replace( /[-_]/g, ' ' );
    } catch {
      return rawUrl.replace( /^https?:\/\//, '' );
    }
  }

  private resolveLogTypeForQueueState (
    queueState?: MomentumThread['queueState']
  ): MomentumActionLogEntry['type'] {
    if ( queueState === 'drafting' ) return 'drafted';
    if ( queueState === 'queued' ) return 'queued';
    if ( queueState === 'sending' ) return 'sending';
    if ( queueState === 'handoff' ) return 'handoff';
    if ( queueState === 'paused' ) return 'paused';
    if ( queueState === 'completed' ) return 'completed';
    return 'control';
  }

  private resolveLogTitleForQueueState (
    queueState?: MomentumThread['queueState']
  ): string {
    if ( queueState === 'drafting' ) return 'Queue entered drafting';
    if ( queueState === 'queued' ) return 'Queue entered send lane';
    if ( queueState === 'sending' ) return 'Queue entered sending';
    if ( queueState === 'handoff' ) return 'Queue handed off';
    if ( queueState === 'paused' ) return 'Queue paused';
    if ( queueState === 'completed' ) return 'Queue completed';
    return 'Queue updated';
  }

  private shouldLogNextActionChange (
    thread: MomentumThread,
    nextActionType: MomentumThread['nextActionType'],
    nextActionAt?: string,
    nextActionReason?: string
  ): boolean {
    return thread.nextActionType !== nextActionType
      || thread.nextActionAt !== nextActionAt
      || thread.nextActionReason !== nextActionReason;
  }

  private appendThreadLog (
    thread: MomentumThread,
    type: MomentumActionLogEntry['type'],
    title: string,
    detail?: string
  ): MomentumActionLogEntry[] {
    return this.appendLogEntry(
      thread.actionLog,
      this.buildLogEntry( type, title, detail )
    );
  }

  private appendLogEntry (
    existingLog: MomentumActionLogEntry[] | undefined,
    entry: MomentumActionLogEntry,
    dedupe = false
  ): MomentumActionLogEntry[] {
    const baseLog = Array.isArray( existingLog ) ? [...existingLog] : [];
    const lastEntry = baseLog[baseLog.length - 1];

    if (
      dedupe
      && lastEntry
      && lastEntry.type === entry.type
      && lastEntry.title === entry.title
      && lastEntry.detail === entry.detail
    ) {
      return baseLog;
    }

    const nextLog = [...baseLog, entry];
    return nextLog.slice( -20 );
  }

  private buildLogEntry (
    type: MomentumActionLogEntry['type'],
    title: string,
    detail?: string,
    at = new Date().toISOString()
  ): MomentumActionLogEntry {
    return {
      at,
      type,
      title,
      detail
    };
  }

  private toMillis ( value?: string ): number {
    if ( !value ) return 0;
    const parsed = new Date( value ).getTime();
    return Number.isNaN( parsed ) ? 0 : parsed;
  }
}
