import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable, tap } from 'rxjs';
import { LoggerService } from './logger.service';
import {
    Campaign,
    CatalystRun,
    LeadVaultAudiencePreview
} from '../shared/data/interfaces/email.model';
import { Contact } from '../shared/data/interfaces/contact.model';
import { MomentumThread } from '../shared/data/interfaces/momentum-thread.model';
import { ToddWritingIdentity, ToddWritingIdentityReview } from '../shared/data/interfaces/todd-writing-identity.model';
import { CockpitActivityItem } from './cockpit-activity.service';

export interface PagedCampaignResponse {
    success: boolean;
    message: string;
    data: Campaign[];
    nextCursor: string | null;
    hasMore: boolean;
    pageSize: number;
    count: number;
}

export interface CampaignDetailResponse {
    success: boolean;
    message: string;
    data: Campaign;
}

export interface CampaignContactProgressPreparedDraft {
    stepNumber: number;
    subject: string;
    body: string;
    generatedAt?: string;
    qualityGate?: ContentEvaluation;
}

export interface CampaignContactProgress {
    contactId: string;
    currentStepNumber: number;
    lastStepSentAt?: string;
    sequenceState?: 'active' | 'waiting' | 'paused' | 'stopped' | 'completed' | string;
    nextEligibleAt?: string;
    stoppedReason?: string | null;
    completedAt?: string | null;
    stepStatuses: Record<string, 'pending' | 'sent' | 'opened' | 'clicked' | 'replied' | 'skipped' | 'bounced' | 'unsubscribed'>;
    trend: 'up' | 'down' | 'neutral';
    lastSignalState?: string;
    preparedDraft?: CampaignContactProgressPreparedDraft;
    createdAt?: string;
    updatedAt?: string;
}

export interface CampaignContactProgressListResponse {
    success: boolean;
    message: string;
    data: CampaignContactProgress[];
}

export interface LeadVaultAudiencePreviewResponse {
    success: boolean;
    message: string;
    data: LeadVaultAudiencePreview;
}

export interface LeadVaultAudienceActivateResponse {
    success: boolean;
    message: string;
    data: {
        queue: Contact[];
        leadVaultContactIds: string[];
        leadVaultAudiencePreview: LeadVaultAudiencePreview;
        addedCount: number;
        usageConsumed: boolean;
    };
}

export interface CatalystRunResponse {
    success: boolean;
    message: string;
    data: CatalystRun;
}

export interface CatalystRunListResponse {
    success: boolean;
    message: string;
    data: CatalystRun[];
}

export interface ContentEvaluationDimension {
    score: number;
    label: 'strong' | 'workable' | 'weak' | string;
    summary: string;
}

export interface ContentEvaluation {
    channel: string;
    verdict: 'strong' | 'workable' | 'weak' | string;
    approved: boolean;
    overallScore: number;
    strengths: string[];
    improvements: string[];
    dimensions: Record<string, ContentEvaluationDimension>;
    draft?: {
        subject?: string;
        body?: string;
        content?: string;
    };
    improvedDraft?: {
        subject?: string;
        body?: string;
        content?: string;
    };
    summary?: string;
    evaluatedAt?: string;
    routing?: {
        autoQueue: boolean;
        needsRevision: boolean;
        reason: string;
    };
}

export interface ContactResponse {
    success: boolean;
    message: string;
    data: Contact;
}

export interface ContactListResponse {
    success: boolean;
    message: string;
    data: Contact[];
}

export interface ComposerHandoff {
    id?: string;
    handoffId?: string;
    actionPlanId?: string;
    status?: string;
    source?: string;
    handoffMode?: string;
    reviewRoute?: string;
    returnRoute?: string;
    returnTab?: string;
    returnThreadId?: string;
    reopenDraftReview?: boolean;
    contactsCount?: number;
    selectedContactIds?: string[];
    selectedContacts?: Contact[];
    threadContext?: {
        contactId?: string;
        threadId?: string;
        campaignId?: string;
        campaignName?: string;
        companyName?: string;
        signalState?: string;
        queueState?: string;
        owner?: string;
        mode?: string;
        stage?: string;
        nextActionReason?: string;
        draftReason?: string;
        lastAutomationNote?: string;
        senderEmail?: string;
        senderName?: string;
        senderSignature?: string;
        recipientEmail?: string;
        draftKind?: 'reply' | 'outbound' | string;
        draftCreatedAt?: string;
        draftUpdatedAt?: string;
        lastSentAt?: string;
        draftedCount?: number;
    };
    emailData?: {
        campaignName?: string;
        cc?: string;
        bcc?: string;
        subject?: string;
        text?: string;
        html?: string;
        contactName?: string;
        signalEngineEnabled?: boolean;
        signalOrigin?: string;
    };
    campaignDrafts?: any;
    createdAt?: string;
    updatedAt?: string;
}

export interface ComposerHandoffResponse {
    success: boolean;
    message: string;
    data: ComposerHandoff;
}

export interface OutreachAccessResponse {
    success: boolean;
    message: string;
    data: any;
}

export interface MomentumThreadListResponse {
    success: boolean;
    message: string;
    data: MomentumThread[];
    nextCursor?: string | null;
    hasMore?: boolean;
    pageSize?: number;
}

export interface OutboxCockpitBootstrapSummary {
    active: number;
    waiting: number;
    engaged: number;
    needsYou: number;
    paused: number;
    queued: number;
    sending: number;
}

export interface OutboxApprovalNeededItem {
    actionPlanId: string;
    type: string;
    status: string;
    executionMode?: string;
    reviewRoute?: string;
    title?: string;
    summary?: string;
    preparedSummary?: string;
    approvalSummary?: string;
    reviewLabel?: string;
    approvalLabel?: string;
    draftCount?: number;
    contactCount?: number;
    offerSummary?: string;
    createdAt?: string;
}

export interface OutboxSenderConfigurationStatus {
    isMasterTenant: boolean;
    senderConfigured: boolean;
    senderEmail?: string;
    senderSource?: string;
    senderConfigRoute?: string;
    settingsRoute?: string;
    outreachSendingMode?: string;
    autoOutreachEnabled?: boolean;
    autoSendCcRequired?: boolean;
    autoSendCcConfigured?: boolean;
    autoSendCcEmail?: string;
    missingReason?: string;
    mailboxConnected?: boolean;
    mailboxStatus?: string;
    mailboxLastSyncAt?: string;
    mailboxLastSyncStatus?: string;
    mailboxEmailAddress?: string;
    message?: string;
}

export interface OutreachProvisioningState {
    tenantId: string;
    outreachPaidAccess: boolean;
    provisioningStatus: string;
    provisioningMethod: string;
    provisioningMode: string;
    senderEmail: string;
    domain: string;
    authenticatedDomain: string;
    domainAuthenticationStatus: string;
    sendgridDomainAuthId: string;
    sendgridSenderId: string;
    sendgridSubuserUsername: string;
    notes: string;
    requestedAt?: string;
    provisionedAt?: string;
    updatedAt?: string;
}

export interface OutreachProvisioningResponse {
    success: boolean;
    message?: string;
    data: OutreachProvisioningState;
}

export interface OutreachProvisioningRequestPayload {
    tenantId?: string;
    userId?: string;
    userEmail?: string;
    provisioningStatus?: string;
    provisioningMethod?: string;
    provisioningMode?: string;
    senderEmail: string;
    domain?: string;
    authenticatedDomain?: string;
    domainAuthenticationStatus?: string;
    notes?: string;
    sendgridDomainAuthId?: string;
    sendgridSenderId?: string;
    sendgridSubuserUsername?: string;
}

export type MailboxProviderId =
    'gmail' |
    'outlook' |
    'icloud' |
    'yahoo' |
    'dreamhost' |
    'other_imap' |
    string;

export interface MailboxConnectionSettings {
    host: string;
    port: number;
    secure: boolean;
}

export interface MailboxConfigSummary {
    id: string;
    displayName: string;
    emailAddress: string;
    provider: MailboxProviderId;
    providerLabel?: string;
    status?: string;
    capabilities?: string[];
    isPrimary?: boolean;
    advancedRequired?: boolean;
    imap: MailboxConnectionSettings;
    smtp: MailboxConnectionSettings;
    auth?: {
        username?: string;
        hasSecret?: boolean;
    };
    lastConnectionTestAt?: string;
    lastConnectionStatus?: string;
    lastSyncAt?: string;
    lastSyncStatus?: string;
    lastSeenUid?: number;
    lastSeenMessageId?: string;
    createdAt?: string;
    lastUpdated?: string;
}

export interface MailboxConnectionTestRequest {
    id?: string;
    displayName?: string;
    emailAddress: string;
    provider: MailboxProviderId;
    secret: string;
    auth?: {
        username?: string;
    };
    imap?: Partial<MailboxConnectionSettings>;
    smtp?: Partial<MailboxConnectionSettings>;
}

export interface MailboxConnectionTestResponse {
    success: boolean;
    message: string;
    data: {
        success: boolean;
        mailbox: MailboxConfigSummary;
        checks: {
            smtpVerified: boolean;
            imapVerified: boolean;
        };
        message: string;
    };
}

export interface MailboxMessageListItem {
    id: string;
    mailboxId: string;
    uid: number | null;
    messageId?: string;
    subject: string;
    fromName?: string;
    fromEmail: string;
    receivedAt: string;
    unread: boolean;
    replied: boolean;
    hasAttachments?: boolean;
    preview?: string;
    classification?: string;
    signalSummary?: string;
    recommendedAction?: string;
    contactId?: string;
    threadId?: string;
    threadMatched?: boolean;
    replyDraftSubject?: string;
    replyDraftBody?: string;
    responderDecision?: string;
    responderReason?: string;
    responderSuppressed?: boolean;
    responderProcessedMessageId?: string;
}

export interface MailboxMessageDetail extends MailboxMessageListItem {
    to?: Array<{ name?: string; email: string; }>;
    cc?: Array<{ name?: string; email: string; }>;
    replyTo?: Array<{ name?: string; email: string; }>;
    references?: string[];
    inReplyTo?: string;
    text?: string;
    html?: string;
}

export interface MailboxReplyRequest {
    subject?: string;
    body?: string;
    text?: string;
    html?: string;
}

export interface MailboxReplyResponse {
    success: boolean;
    message: string;
    data: {
        delivered: boolean;
        mailboxId: string;
        messageId: string;
        accepted: string[];
        rejected: string[];
        subject: string;
        to: string;
    };
}

export interface MailboxDeleteMessageResponse {
    success: boolean;
    message: string;
    data: {
        deleted: boolean;
        mailboxId: string;
        messageId: string;
    };
}

export interface MomentumOperatorConfig {
    enabled: boolean;
    timezone: string;
    workdayStartHour: number;
    maxActiveHours: number;
    dailyGoalAmount: number;
    maya?: {
        enabled: boolean;
        timezone: string;
        startHour: number;
        socialDraftingEnabled?: boolean;
        socialAutoApprove?: boolean;
        emailDraftingEnabled?: boolean;
    };
    emailResponder?: {
        enabled: boolean;
        mode: 'off' | 'draft_only' | 'auto_respond' | string;
        allowAlreadyAnsweredMessages?: boolean;
    };
}

export interface MailboxSignalSummary {
    mailboxId: string;
    syncedCount: number;
    skipped?: boolean;
    reason?: string;
    messages: Array<{
        id: string;
        mailboxId: string;
        messageId: string;
        uid: number | null;
        subject: string;
        fromEmail: string;
        fromName?: string;
        receivedAt: string;
        unread: boolean;
        replied: boolean;
        classification?: string;
        signalSummary?: string;
        recommendedAction?: string;
        contactId?: string;
        threadId?: string;
        threadMatched?: boolean;
        replyDraftSubject?: string;
        replyDraftBody?: string;
        responderDecision?: string;
        responderReason?: string;
        responderSuppressed?: boolean;
        responderProcessedMessageId?: string;
        preview?: string;
    }>;
}

export interface MomentumOperatorConfigResponse {
    success: boolean;
    message: string;
    data: {
        tenantId: string;
        operatorConfig: MomentumOperatorConfig;
    };
}

export interface MailboxConfigListResponse {
    success: boolean;
    message: string;
    data: MailboxConfigSummary[];
}

export interface MailboxConfigMutationResponse {
    success: boolean;
    message: string;
    data: MailboxConfigSummary;
}

export interface MailboxMessageListResponse {
    success: boolean;
    message: string;
    data: MailboxMessageListItem[];
}

export interface MailboxMessageDetailResponse {
    success: boolean;
    message: string;
    data: MailboxMessageDetail;
}

export interface MailboxSignalSummaryResponse {
    success: boolean;
    message: string;
    data: MailboxSignalSummary;
}

export interface OutboxIncidentAuditSample {
    threadId?: string;
    contactId?: string;
    contactName?: string;
    companyName?: string;
    emailAddress?: string;
    reason?: string;
    bucket?: string;
    queueState?: string;
    mode?: string;
    owner?: string;
    signalState?: string;
    nextActionType?: string;
    scheduledAt?: string;
    nextActionAt?: string;
    lastSentAt?: string;
    lastAutomationNote?: string;
}

export interface OutboxIncidentAuditBlocker {
    key: string;
    label: string;
    count: number;
    reasons?: string[];
    samples?: OutboxIncidentAuditSample[];
    isCatalystEligible?: boolean;
    catalystEligibleCount?: number;
}

export interface OutboxIncidentEligibilityAudit {
    nowIso?: string;
    limit?: number;
    scannedCount?: number;
    eligibleCount?: number;
    excludedCount?: number;
    skipReasonCounts?: Record<string, number>;
    blockerCounts?: Record<string, { count?: number; reasons?: string[]; samples?: OutboxIncidentAuditSample[]; }>;
    topBlockers?: OutboxIncidentAuditBlocker[];
    sampleSkippedThreads?: OutboxIncidentAuditSample[];
}

export interface OutboxIncidentAuditPayload {
    dateKey: string;
    status: 'sent_today' | 'eligible_available' | 'blocked_all' | 'no_qualifying_threads' | 'no_live_threads' | string;
    sentTodayCount: number;
    queuedTodayCount: number;
    scannedThreadCount: number;
    eligibleNowCount: number;
    blockedCount: number;
    topBlockers: OutboxIncidentAuditBlocker[];
    lastSentAt?: string;
    lastSentSubject?: string;
    lastSentTo?: string;
    eligibilityAudit?: OutboxIncidentEligibilityAudit | null;
}

export interface ComposerReminderThread {
    contactId: string;
    contactName: string;
    companyName?: string;
    draftKind?: 'reply' | 'outbound' | string;
    reason?: string;
    signalState?: string;
    queueState?: string;
}

export interface ComposerReminderLane {
    count: number;
    topThread?: ComposerReminderThread | null;
}

export interface ComposerRemindersPayload {
    drafts: ComposerReminderLane;
    needsYou: ComposerReminderLane;
    highIntent: ComposerReminderLane;
}

export interface OutboxCockpitBootstrapPayload {
    threads: MomentumThread[];
    summary: OutboxCockpitBootstrapSummary;
    composerReminders?: ComposerRemindersPayload;
    activity: CockpitActivityItem[];
    approvalItems?: OutboxApprovalNeededItem[];
    senderConfiguration?: OutboxSenderConfigurationStatus;
    incidentAudit?: OutboxIncidentAuditPayload | null;
    nextCursor: string | null;
    hasMore: boolean;
    pageSize: number;
    generatedAt: string;
}

export interface OutboxCockpitBootstrapResponse {
    success: boolean;
    message: string;
    data: OutboxCockpitBootstrapPayload;
}

export interface SocialBootstrapIdentitySummary {
    profileCompleteEnough?: boolean;
    warningMessage?: string;
    primaryContentLane?: string;
    likelyAudience?: string;
    confidence?: string;
}

export interface SocialBootstrapCadenceSummary {
    approvedCount?: number;
    approvedScheduledCount?: number;
    publishedThisWeekCount?: number;
    draftCount?: number;
    pendingRetryCount?: number;
    queueCoverageCount?: number;
    latestApprovedScheduledFor?: string | null;
}

export interface SocialBootstrapPayload {
    posts: SocialPost[];
    accounts: SocialAccount[];
    providerAvailability: Record<string, { configured: boolean; message?: string; }>;
    identityStateSummary: SocialBootstrapIdentitySummary | null;
    addonAccess: boolean;
    rssConfig: {
        enabled?: boolean;
        feedUrls?: string[];
    };
    strategySummary: SocialDraftStrategyContext | null;
    cadenceSummary: SocialBootstrapCadenceSummary | null;
    activity: CockpitActivityItem[];
    generatedAt: string;
}

export interface SocialBootstrapResponse {
    success: boolean;
    message: string;
    data: SocialBootstrapPayload;
}

export interface MomentumThreadResponse {
    success: boolean;
    message: string;
    data: MomentumThread;
}

export interface MomentumComposerHandoffRequest {
    subject?: string;
    draftSubject?: string;
    draftBody?: string;
    contextHint?: string;
    companyName?: string;
    returnRoute?: string;
    returnTab?: string;
    returnThreadId?: string;
    reopenDraftReview?: boolean;
    draftKind?: 'reply' | 'outbound' | string;
}

export interface FollowUpOwner {
    id?: string;
    tenantId: string;
    emailId: string;
    contactId: string;
    emailAddress: string;
    campaignId?: string | null;
    status: 'sent_waiting_for_signal' | string;
    createdAt: string;
    source: 'direct' | 'catalyst' | 'campaign_single' | string;
    sequenceExcluded: boolean;
    subject?: string | null;
    lastUpdated?: string;
}

export interface FollowUpOwnerListResponse {
    success: boolean;
    message: string;
    data: FollowUpOwner[];
    count?: number;
    pageSize?: number;
    hasMore?: boolean;
}

export interface CampaignSequenceRecoveryResponse {
    success: boolean;
    message: string;
    data: {
        sequenceDetected: boolean;
        statusWasCorrected: boolean;
        previousStatus: string;
        currentStatus: string;
        waitingContactsFound: number;
        rescheduled: number;
        skipped: number;
        skipReasons: Record<string, number>;
        errors: { contactId: string; message: string; }[];
    };
}

export interface MomentumThreadQueueResponse {
    success: boolean;
    message: string;
    data: {
        processedCount: number;
        sentCount?: number;
        queuedCount?: number;
        blockedCount?: number;
        candidates: MomentumThread[];
        threads: MomentumThread[];
        blockers?: Array<{ contactId?: string; blocker?: string; detail?: string; }>;
        nowIso: string;
        dryRun: boolean;
    };
}

export interface SocialPostSourceReference {
    sourceType: string;
    sourceId: string;
    title?: string;
}

export type SocialStrategyGoal =
    'grow_awareness' |
    'grow_followers' |
    'drive_engagement' |
    'build_authority' |
    'drive_traffic' |
    'generate_leads';

export type SocialStrategyPlatformFocus = 'auto' | 'linkedin' | 'threads' | 'bluesky' | 'reddit' | 'youtube' | 'google_business_profile' | 'balanced';

export type SocialStrategyCadence = '5x_day' | '4x_day' | '3x_day' | '2x_day' | 'daily' | '5x_week' | '3x_week' | '2x_week' | 'weekly';
export type SocialDraftRefinementActionType = 'rewrite' | 'reject' | 'shorten' | 'conversational' | 'stronger';
export type SocialContentLane = 'proof' | 'lesson' | 'contrarian' | 'story' | 'offer';

export interface SocialDraftStrategyContext {
    goal: SocialStrategyGoal;
    platformFocus: SocialStrategyPlatformFocus;
    cadence: SocialStrategyCadence;
    activeMarketingGoal?: string;
    socialChannelFocus?: string;
    socialCadence?: string;
    nextBestSocialAction?: string;
    riskOrWatchout?: string;
    targetAudience?: string;
    primaryOffer?: string;
    painBeingAddressed?: string;
    proofPoints?: string[];
    preferredChannels?: string[];
    currentCampaignTheme?: string;
    winningAngles?: string[];
    weakAngles?: string[];
    lastSignalSummary?: string;
    recommendedAdjustment?: string;
    nextBestAction?: string;
    identityEngine?: string;
    selectedPlatform?: string;
    platformIdentityLabel?: string;
    platformIdentityTraits?: string[];
    contentLane?: SocialContentLane;
    blockedContentLanes?: SocialContentLane[];
    sourceSelectionReason?: string;
    generationSequence?: string[];
    differentiationBrief?: string[];
    regenerationReason?: string;
    separatePlatformDrafting?: boolean;
    recommendedNextPostType?: string;
    selectedContentCategory?: string;
    growthPillar?: string;
    growthPillarLabel?: string;
    growthObjective?: string;
    growthReason?: string;
    recommendedTiming?: string;
    suggestedSource?: string;
    followUpAngle?: string;
    commentHook?: string;
    replyTone?: string;
    distributionIntent?: string;
    continuityAnchor?: string;
    continuityStep?: string;
    continuityBrief?: string;
    audienceWarmupStatus?: string;
    audienceWarmupReason?: string;
    sequenceObjective?: string;
    sequenceSteps?: string[];
    reason?: string;
    strategySummary?: string;
    alternateAngles?: string[];
    watchout?: string;
    requiredShift?: string;
    mustAvoid?: string[];
    hardContentRules?: string[];
    suggestionMode?: string;
    todayPostRequest?: string;
    outputGuardrails?: string[];
}

export interface SocialIdentityContext {
    identitySummary: string;
    whoTheyAre: string;
    whatTheyDo: string;
    howTheyMakeMoney: string;
    likelyAudience: string;
    primaryContentLane: string;
    secondaryThemes?: string[];
    voiceProfile?: ToddWritingIdentity['voiceProfile'];
    confidence?: ToddWritingIdentity['confidence'];
    profileCompleteEnough?: boolean;
    warningMessage?: string;
    inferredFrom?: string[];
}

export type SocialOfferTacticExecutionTarget = 'email' | 'social' | 'landing' | string;
export type SocialOfferTacticPositioningType = 'urgency' | 'bonus' | 'fast_track' | 'diagnostic';
export type SocialOfferVariationMode = 'pure_insight' | 'soft_sell' | 'direct_cta' | 'recovery_fast_close';

export interface SocialOfferSummary {
    offerId: string;
    name: string;
    category: string;
    priceLabel: string;
    valueSummary: string;
    cta: string;
    audience: string[];
    painsSolved: string[];
    salesCycle: string;
    fastestClose: boolean;
    deliveryEffort: string;
}

export interface SocialOfferTacticContext {
    tacticId: string;
    label: string;
    executionTarget: SocialOfferTacticExecutionTarget;
    positioningType: SocialOfferTacticPositioningType;
    reasoning?: string;
    triggerConditions?: string[];
}

export interface SocialOfferContext {
    primaryOffers: SocialOfferSummary[];
    entryOffer?: SocialOfferSummary | null;
    highTicketOffer?: SocialOfferSummary | null;
    fastestCloseOffer?: SocialOfferSummary | null;
    shortCycleOffer?: SocialOfferSummary | null;
    recommendedOffer?: SocialOfferSummary | null;
    currentGoal?: SocialStrategyGoal | string;
    selectedMode?: SocialOfferVariationMode;
    availableModes?: SocialOfferVariationMode[];
    behaviorRules?: string[];
    tacticContext?: SocialOfferTacticContext | null;
    recoverySignals?: {
        recoveryModeActive?: boolean;
        revenueZero?: boolean;
        repliesWeak?: boolean;
        urgencyJustified?: boolean;
    } | null;
}

export interface SocialMediaAttachment {
    url: string;
    type: 'image' | 'video' | string;
    mimeType?: string;
    title?: string;
    altText?: string;
}

export interface SocialSourceSnapshot {
    title?: string;
    type?: string;
    category?: string;
    topic?: string;
    author?: string;
    summary?: string;
    content?: string;
    url?: string;
    publishedAt?: string | null;
    feedUrl?: string;
    answers?: any[];
    recommendations?: any[];
    resources?: any[];
    keywords?: string[];
    mediaAttachment?: SocialMediaAttachment | null;
}

export interface SocialEngagementSignal {
    likes: number;
    comments: number;
    clicks: number;
    engagedPeople: string[];
    notes?: string;
    lastCapturedAt?: string | null;
}

export interface SocialFollowUpSuggestion {
    summary: string;
    rationale: string;
    recommendedAction: string;
    suggestedContacts: string[];
    suggestedTaskTitle?: string;
    suggestedMessage?: string;
    draftedComment?: string;
    draftedReply?: string;
    suggestedNextStep?: string;
    status?: string;
    suggestedAt?: string | null;
}

export interface SocialAccount {
    accountId: string;
    provider: string;
    authProvider?: string;
    destinationType?: string;
    destinationLabel?: string;
    selectedIdentity?: string;
    providerId?: string;
    providerUserId: string;
    username?: string;
    displayName?: string;
    email?: string;
    profileUrl?: string;
    avatarUrl?: string;
    connectedAt?: string | null;
    updatedAt?: string | null;
    status?: string;
    capabilities?: string[];
    youtubeEnabled?: boolean;
    scopes?: string[];
    destinationAccountName?: string;
    destinationLocationName?: string;
    destinationLocationId?: string;
    locationName?: string;
    locationId?: string;
    locationDiscoveryError?: string;
    tokenStatus?: {
        hasAccessToken: boolean;
        hasRefreshToken: boolean;
        expiresAt?: string | null;
        refreshExpiresAt?: string | null;
        needsReauth?: boolean;
    };
}

export interface CampaignTestSendResponse {
    success: boolean;
    message: string;
    data: {
        campaignId: string;
        recipientEmail: string;
        subject: string;
        sentCount?: number;
        subjects?: string[];
    };
}

export interface SocialAccountListResponse {
    success: boolean;
    message: string;
    data: SocialAccount[];
    providerAvailability?: Record<string, {
        configured: boolean;
        message?: string;
    }>;
}

export interface SocialProviderHealth {
    configured: boolean;
    missing: string[];
    redirectUri?: string;
    permissionsRequired: string[];
    implemented?: boolean;
    reason?: string;
    requiresProfessionalAccount?: boolean;
    requiresLinkedFacebookPage?: boolean;
    nextSteps?: string[];
}

export interface SocialProviderConfigHealthResponse {
    success: boolean;
    message: string;
    data: Record<string, SocialProviderHealth>;
}

export interface SocialAccountConnectionTestResponse {
    success: boolean;
    message: string;
    data: {
        accountId?: string;
        provider: string;
        authProvider?: string;
        configured: boolean;
        connected: boolean;
        reason?: string;
        message?: string;
        accountIdentity?: {
            accountId?: string;
            providerUserId?: string;
            username?: string;
            displayName?: string;
            email?: string;
            profileUrl?: string;
        };
        tokenStatus?: {
            hasAccessToken: boolean;
            hasRefreshToken: boolean;
            expiresAt?: string | null;
            needsReauth?: boolean;
        };
        missingPermissions?: string[];
        nextSteps?: string[];
        providerStatus?: string;
        permanent?: boolean;
        displayIdentity?: {
            accountId?: string;
            providerUserId?: string;
            username?: string;
            displayName?: string;
            email?: string;
            profileUrl?: string;
        };
        healthState?: 'healthy' | 'needs_reauth' | 'missing_permissions' | 'disconnected' | 'failed' | 'unknown' | string;
        healthSeverity?: 'healthy' | 'warning' | 'error' | string;
        testedAt?: string;
    };
}

export interface SocialAccountHealthRow extends NonNullable<SocialAccountConnectionTestResponse['data']> { }

export interface BlueskyNichePost {
    uri: string;
    cid: string;
    authorHandle: string;
    authorDisplayName: string;
    authorAvatar: string;
    text: string;
    likeCount: number;
    replyCount: number;
    repostCount: number;
    indexedAt: string;
    postUrl: string;
}

export interface SocialAccountHealthSummary {
    totalAccounts: number;
    healthyCount: number;
    warningCount: number;
    errorCount: number;
    unknownCount: number;
    problemCount: number;
    topBlockers: Array<{
        accountId: string;
        provider: string;
        authProvider?: string;
        reason?: string;
        message?: string;
        providerStatus?: string;
        healthState?: string;
        healthSeverity?: string;
        displayIdentity?: {
            accountId?: string;
            providerUserId?: string;
            username?: string;
            displayName?: string;
            email?: string;
            profileUrl?: string;
        };
    }>;
}

export interface SocialAccountHealthResponse {
    success: boolean;
    message: string;
    data: {
        accounts: SocialAccountHealthRow[];
        summary: SocialAccountHealthSummary;
    };
}

export interface SocialAuthSessionResponse {
    success: boolean;
    message: string;
    data: {
        provider: string;
        authorizationUrl: string;
        redirectUri: string;
        scope: string;
        state: string;
        account?: SocialAccount;
    };
}

export interface SocialPost {
    postId: string;
    actionId?: string | null;
    planId?: string | null;
    strategyId?: string | null;
    segmentId?: string | null;
    angleId?: string | null;
    sourceContentReference: SocialPostSourceReference;
    platform: 'linkedin' | 'threads' | 'bluesky' | 'reddit' | string;
    provider?: string;
    contentEvaluation?: ContentEvaluation;
    socialAccountId?: string;
    subreddit?: string;
    content: string;
    status: string;
    strategyContext?: SocialDraftStrategyContext | null;
    followThroughPlan?: {
        followUpAngle?: string;
        commentHook?: string;
        replyTone?: string;
        distributionIntent?: string;
    } | null;
    identityContext?: SocialIdentityContext | null;
    offerContext?: SocialOfferContext | null;
    identityReview?: ToddWritingIdentityReview | null;
    draftQuality?: 'strong' | 'workable' | 'generic' | 'off-brand' | 'needs-context' | 'weak' | string;
    socialQualityDiagnostics?: {
        verdict?: 'strong' | 'usable' | 'generic' | 'off-brand' | 'needs-context' | string;
        overallScore?: number;
        publishReady?: boolean;
        contextThin?: boolean;
        summary?: string;
        strengths?: string[];
        improvements?: string[];
        dimensions?: Record<string, { score?: number; summary?: string; }>;
        riskFlags?: {
            blandnessRisk?: boolean;
            genericSaaSRisk?: boolean;
            offBrandRisk?: boolean;
        };
    } | null;
    growthState?: {
        status?: string;
        diagnosis?: string;
        owner?: string;
        reason?: string;
        nextCheckAt?: string | null;
        updatedAt?: string | null;
    } | null;
    requiredActions?: Array<{
        actionId?: string;
        type?: string;
        title?: string;
        instruction?: string;
        reason?: string;
        dueAt?: string | null;
        owner?: string;
        status?: string;
        payload?: {
            platform?: string;
            requestedMetrics?: string[];
            [key: string]: any;
        };
    }> | null;
    postPerformance?: {
        views?: number;
        reach?: number;
        impressions?: number;
        shares?: number;
        saves?: number;
        profileVisits?: number;
        accountsReached?: number;
        nonFollowerReach?: number;
        followerDelta?: number;
        engagementRate?: number;
        capturedAt?: string | null;
        captureSource?: string;
    } | null;
    approvedAt?: string | null;
    scheduledFor?: string | null;
    plannedForDate?: string | null;
    engagementSignal?: SocialEngagementSignal;
    followUpSuggestion?: SocialFollowUpSuggestion;
    mediaAttachment?: SocialMediaAttachment | null;
    queueWaitReason?: string | null;
    queueWaitReasonLabel?: string | null;
    lastQueueEvaluatedAt?: string | null;
    manualReviewRequired?: boolean;
    returnedToDraftAt?: string | null;
    publishedTimestamp?: string | null;
    externalPlatformPostId?: string | null;
    externalPlatformPostUrl?: string | null;
    retryAttemptCount?: number;
    maxRetryAttempts?: number;
    nextRetryAt?: string | null;
    lastPublishAttemptAt?: string | null;
    publishFailure?: {
        platform?: string;
        error?: string;
        message?: string;
        accountId?: string;
        attemptCount?: number;
        timestamp?: string;
        permanent?: boolean;
    } | null;
    redditSafety?: {
        recentCommentCount?: number;
        requiresCommentFirst?: boolean;
        checkedAt?: string | null;
    } | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface SocialPostListResponse {
    success: boolean;
    message: string;
    data: SocialPost[];
}

export interface SocialPostResponse {
    success: boolean;
    message: string;
    data: SocialPost;
}

export interface SocialPostDeleteResponse {
    success: boolean;
    message: string;
    data: {
        postId: string;
        deletedPostIds?: string[];
        deleted: boolean;
    };
}

export interface MomentumApprovalPolicyCategorySetting {
    mode?: 'auto' | 'approval-first' | 'manual' | string;
    label?: string;
}

export interface MomentumApprovalPolicy {
    tenantId?: string;
    scope?: string;
    categories?: Record<string, MomentumApprovalPolicyCategorySetting>;
}

export interface MomentumApprovalPolicyResponse {
    success: boolean;
    message: string;
    data: {
        tenantId: string;
        approvalPolicy: MomentumApprovalPolicy | null;
    };
}

export interface MarketingOperatorStrategyResponse {
    success: boolean;
    message: string;
    data: SocialDraftStrategyContext | null;
}

export interface NextMarketingActionResponse {
    success: boolean;
    message: string;
    data: {
        nextMarketingAction: string;
        strategy: SocialDraftStrategyContext | null;
    };
}

export interface MarketingOperatorStatusResponse {
    success: boolean;
    message: string;
    data: {
        date: string;
        todayOperatorStatus: string;
        nextBestAction: string;
        pendingApprovalsCount: number;
        blockedNeedsCount: number;
        lastEndOfDaySummary: string;
        activeStrategyLoaded: boolean;
    };
}

export interface MarketingOperatorRunResponse {
    success: boolean;
    message: string;
    data: any;
}

export interface SocialDraftGenerationResponse {
    success: boolean;
    message: string;
    data: {
        sourceContentReference: SocialPostSourceReference;
        sourceSnapshot?: SocialSourceSnapshot;
        drafts: SocialPost[];
    };
}

@Injectable( { providedIn: 'root' } )
export class OutreachApiService {
    private baseUrl = `${environment.backendURL}`;
    constructor ( private http: HttpClient, private logger: LoggerService ) { }

    private buildHeaders ( tenantId?: string, userId?: string, userEmail?: string ): HttpHeaders {
        let h = new HttpHeaders();
        if ( tenantId ) h = h.set( 'x-tenant-id', tenantId );
        if ( userId ) h = h.set( 'x-user-id', userId );
        if ( userEmail ) h = h.set( 'x-user-email', userEmail );
        return h;
    }

    listCampaigns ( opts: { tenantId?: string; userId?: string; userEmail?: string; pageSize?: number; cursor?: string; orderBy?: string; direction?: 'asc' | 'desc'; search?: string; } = {} ): Observable<PagedCampaignResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        let params = new HttpParams();
        if ( opts.pageSize ) params = params.set( 'pageSize', String( opts.pageSize ) );
        if ( opts.cursor ) params = params.set( 'cursor', opts.cursor );
        if ( opts.orderBy ) params = params.set( 'orderBy', opts.orderBy );
        if ( opts.direction ) params = params.set( 'direction', opts.direction );
        if ( opts.search ) params = params.set( 'search', opts.search );
        return this.http.get<PagedCampaignResponse>( `${this.baseUrl}/outreach/campaigns`, { headers, params } );
    }

    sendTestCampaign ( campaignId: string, payload: { mode: 'test'; recipientEmail: string; }, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<CampaignTestSendResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<CampaignTestSendResponse>( `${this.baseUrl}/outreach/campaigns/${encodeURIComponent( campaignId )}/test-send`, payload, { headers } );
    }

    updateSequenceStep (
        sequenceId: string,
        stepId: string,
        payload: any,
        context?: { tenantId?: string; userId?: string; userEmail?: string; }
    ): Observable<any> {
        const headers = this.buildHeaders( context?.tenantId, context?.userId, context?.userEmail );
        return this.http.patch<any>(
            `${this.baseUrl}/outreach/sequences/${encodeURIComponent( sequenceId )}/steps/${encodeURIComponent( stepId )}`,
            payload,
            { headers }
        );
    }

    getSequenceById ( sequenceId: string, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<CampaignDetailResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.get<CampaignDetailResponse>( `${this.baseUrl}/outreach/sequences/${encodeURIComponent( sequenceId )}`, { headers } );
    }

    previewLeadVaultAudience ( payload: { queue?: Contact[]; limit?: number; }, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<LeadVaultAudiencePreviewResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<LeadVaultAudiencePreviewResponse>( `${this.baseUrl}/outreach/lead-vault/preview`, payload, { headers } );
    }

    activateLeadVaultAudience ( payload: { queue?: Contact[]; limit?: number; }, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<LeadVaultAudienceActivateResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<LeadVaultAudienceActivateResponse>( `${this.baseUrl}/outreach/lead-vault/activate`, payload, { headers } );
    }

    getCampaignContactProgress ( campaignId: string, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<CampaignContactProgressListResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.get<CampaignContactProgressListResponse>(
            `${this.baseUrl}/outreach/campaigns/${encodeURIComponent( campaignId )}/contact-progress`,
            { headers }
        );
    }

    listFollowUpOwners ( request: { limit?: number; } = {}, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<FollowUpOwnerListResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        let params = new HttpParams();

        if ( request.limit ) {
            params = params.set( 'limit', String( request.limit ) );
        }

        return this.http.get<FollowUpOwnerListResponse>(
            `${this.baseUrl}/outreach/follow-up-owners`,
            { headers, params }
        );
    }

    recoverCampaignSequence ( campaignId: string, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<CampaignSequenceRecoveryResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<CampaignSequenceRecoveryResponse>(
            `${this.baseUrl}/outreach/campaigns/${encodeURIComponent( campaignId )}/recover-sequence`,
            {},
            { headers }
        );
    }

    getComposerHandoff ( handoffId: string, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<ComposerHandoffResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.get<ComposerHandoffResponse>( `${this.baseUrl}/outreach/composer-handoffs/${encodeURIComponent( handoffId )}`, { headers } );
    }

    getOutreachAccess ( opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<OutreachAccessResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.get<OutreachAccessResponse>( `${this.baseUrl}/outreach/access`, { headers } );
    }

    getMomentumApprovalPolicy ( opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<MomentumApprovalPolicyResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        let params = new HttpParams();
        if ( opts.tenantId ) params = params.set( 'tenantId', opts.tenantId );
        return this.http.get<MomentumApprovalPolicyResponse>( `${this.baseUrl}/momentum/approval-policy`, { headers, params } );
    }

    listOutreachContacts ( opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<ContactListResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.get<ContactListResponse>( `${this.baseUrl}/outreach/contacts`, { headers } );
    }

    getOutreachContactById ( contactId: string, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<ContactResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.get<ContactResponse>( `${this.baseUrl}/outreach/contacts/${encodeURIComponent( contactId )}`, { headers } );
    }

    getOutreachContactByEmail ( email: string, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<ContactResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        const params = new HttpParams().set( 'email', email );
        return this.http.get<ContactResponse>( `${this.baseUrl}/outreach/contacts/by-email`, { headers, params } );
    }

    logSentEmail ( contactId: string, payload: { subject?: string; html?: string; lastContacted?: string; sentConfirmed?: boolean; }, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<ContactResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<ContactResponse>( `${this.baseUrl}/outreach/contacts/${encodeURIComponent( contactId )}/log-email`, payload, { headers } );
    }

    updateOutreachContact ( contactId: string, payload: Partial<Contact>, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<ContactResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.put<ContactResponse>( `${this.baseUrl}/outreach/contacts/${encodeURIComponent( contactId )}`, payload, { headers } );
    }

    listMomentumThreads ( opts: { tenantId?: string; userId?: string; userEmail?: string; limit?: number; cursor?: string | null; } = {} ): Observable<MomentumThreadListResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        let params = new HttpParams();
        if ( opts.limit ) params = params.set( 'limit', String( opts.limit ) );
        if ( opts.cursor ) params = params.set( 'cursor', opts.cursor );
        return this.http.get<MomentumThreadListResponse>( `${this.baseUrl}/outreach/momentum-threads`, { headers, params } );
    }

    getOutboxCockpitBootstrap ( opts: {
        tenantId?: string;
        userId?: string;
        userEmail?: string;
        limit?: number;
        cursor?: string | null;
        activityLimit?: number;
    } = {} ): Observable<OutboxCockpitBootstrapResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        let params = new HttpParams();
        if ( opts.limit ) params = params.set( 'limit', String( opts.limit ) );
        if ( opts.cursor ) params = params.set( 'cursor', opts.cursor );
        if ( opts.activityLimit ) params = params.set( 'activityLimit', String( opts.activityLimit ) );
        return this.http.get<OutboxCockpitBootstrapResponse>( `${this.baseUrl}/outreach/outbox-cockpit/bootstrap`, { headers, params } );
    }

    // Deliberately a separate endpoint from getOutboxCockpitBootstrap above - Signal
    // Engine is a clean replacement, not a rename of outbox-cockpit.
    getSignalEngineBootstrap ( opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<{
        success: boolean;
        message: string;
        data: {
            threads: MomentumThread[];
            summary: {
                activeThreads: number;
                queuedActions: number;
                sending: number;
                hotLeads: number;
                warmLeads: number;
                draftReady: number;
                stalledWaiting: number;
                needsHuman: number;
            };
            generatedAt: string;
        };
    }> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.get<any>( `${this.baseUrl}/outreach/signal-engine/bootstrap`, { headers } );
    }

    getTodayMomentumSummary ( opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<{
        success: boolean;
        message: string;
        data: {
            dateKey: string;
            timezone: string;
            emailsSent: number;
            emailsOpened: number;
            emailsClicked: number;
            socialPostsPublished: number;
            socialLikes: number;
            socialComments: number;
            visits: number;
            generatedAt: string;
            trend: {
                direction: 'up' | 'down' | 'flat';
                todayTotal: number;
                yesterdayTotal: number;
            };
            laneCounts: {
                highIntent: number;
                warmFollowUp: number;
                firstTouch: number;
                needsYou: number;
                coldReserve: number;
            } | null;
            laneTrend: {
                direction: 'up' | 'down' | 'flat';
                currentTotal: number;
                previousTotal: number;
            } | null;
            laneTrends: Record<string, 'up' | 'down' | 'flat'> | null;
        };
    }> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.get<any>( `${this.baseUrl}/outreach/momentum/today-summary`, { headers } );
    }

    // The real, operator-configured Daily Auto-Send Cap (Operator Control
    // Panel's dailyAutoSendTarget) and how many auto-sends actually went out
    // today against it - replaces the old campaign-warmup ramp cap
    // (getEmailWarmupState/getCapForDay) that the Email Catalyst status
    // widget used to show instead.
    getAutoSendCapStatus ( opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<{
        success: boolean;
        message: string;
        data: {
            dailyAutoSendTarget: number;
            sentToday: number;
            remaining: number;
            sendPolicyModeAtSend: string;
        };
    }> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.get<any>( `${this.baseUrl}/outreach/momentum/auto-send-cap-status`, { headers } );
    }

    getSocialBootstrap ( opts: {
        tenantId?: string;
        userId?: string;
        userEmail?: string;
        sourceType?: string;
        sourceId?: string;
        postIds?: string[];
        statuses?: string[];
        limit?: number;
        activityLimit?: number;
        debugSlim?: boolean;
    } = {} ): Observable<SocialBootstrapResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        let params = new HttpParams();
        if ( opts.sourceType ) params = params.set( 'sourceType', opts.sourceType );
        if ( opts.sourceId ) params = params.set( 'sourceId', opts.sourceId );
        if ( opts.postIds?.length ) params = params.set( 'postIds', opts.postIds.join( ',' ) );
        if ( opts.statuses?.length ) params = params.set( 'statuses', opts.statuses.join( ',' ) );
        if ( opts.limit ) params = params.set( 'limit', String( opts.limit ) );
        if ( opts.activityLimit ) params = params.set( 'activityLimit', String( opts.activityLimit ) );
        if ( opts.debugSlim ) params = params.set( 'debugSlim', 'true' );
        this.logger.info( '[OutreachApiService] getSocialBootstrap:request', {
            url: `${this.baseUrl}/outreach/social/bootstrap`,
            tenantId: opts.tenantId,
            userId: opts.userId,
            hasUserEmail: !!opts.userEmail,
            sourceType: opts.sourceType || null,
            sourceId: opts.sourceId || null,
            limit: opts.limit || null,
            activityLimit: opts.activityLimit || null,
            debugSlim: opts.debugSlim === true,
            statuses: opts.statuses || [],
            postIds: opts.postIds || []
        } );

        return this.http.get<SocialBootstrapResponse>( `${this.baseUrl}/outreach/social/bootstrap`, { headers, params } ).pipe(
            tap( {
                next: response => {
                    this.logger.info( '[OutreachApiService] getSocialBootstrap:response', {
                        success: response?.success,
                        message: response?.message,
                        hasData: !!response?.data,
                        postCount: Array.isArray( response?.data?.posts ) ? response.data.posts.length : 0,
                        accountCount: Array.isArray( response?.data?.accounts ) ? response.data.accounts.length : 0,
                        activityCount: Array.isArray( response?.data?.activity ) ? response.data.activity.length : 0,
                        hasStrategySummary: !!response?.data?.strategySummary,
                        generatedAt: response?.data?.generatedAt || null,
                        response
                    } );
                },
                error: error => {
                    this.logger.error( '[OutreachApiService] getSocialBootstrap:error', {
                        status: error?.status || 0,
                        message: error?.message || error?.error?.message || '',
                        error
                    } );
                }
            } )
        );
    }

    upsertMomentumThread ( payload: Partial<MomentumThread>, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<MomentumThreadResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<MomentumThreadResponse>( `${this.baseUrl}/outreach/momentum-threads`, payload, { headers } );
    }

    listDueMomentumThreads ( opts: { tenantId?: string; userId?: string; userEmail?: string; nowIso?: string; limit?: number; } = {} ): Observable<MomentumThreadListResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        let params = new HttpParams();
        if ( opts.nowIso ) params = params.set( 'nowIso', opts.nowIso );
        if ( opts.limit ) params = params.set( 'limit', String( opts.limit ) );
        return this.http.get<MomentumThreadListResponse>( `${this.baseUrl}/outreach/momentum-threads/due`, { headers, params } );
    }

    processDueMomentumThreads ( payload: { nowIso?: string; limit?: number; dryRun?: boolean; } = {}, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<MomentumThreadQueueResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<MomentumThreadQueueResponse>( `${this.baseUrl}/outreach/momentum-threads/process-due`, payload, { headers } );
    }

    processAfterHoursOperatorTakeover ( payload: { nowIso?: string; limit?: number; dryRun?: boolean; timezone?: string; } = {}, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<MomentumThreadQueueResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<MomentumThreadQueueResponse>( `${this.baseUrl}/outreach/momentum-threads/operator-takeover`, payload, { headers } );
    }

    ingestManualMomentumReply ( payload: { contactId: string; replyText: string; }, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<MomentumThreadResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<MomentumThreadResponse>( `${this.baseUrl}/outreach/momentum-threads/manual-reply`, payload, { headers } );
    }

    analyzeManualMomentumReply ( payload: { contactId: string; replyText: string; alternateAngle?: boolean; preferredPlaybook?: string; }, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<MomentumThreadResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<MomentumThreadResponse>( `${this.baseUrl}/outreach/momentum-threads/manual-reply/analyze`, payload, { headers } );
    }

    sendManualMomentumReplyDraft ( payload: { contactId: string; draftSubject?: string; draftBody?: string; }, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<MomentumThreadResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<MomentumThreadResponse>( `${this.baseUrl}/outreach/momentum-threads/manual-reply/send-draft`, payload, { headers } );
    }

    sendManualMomentumOutboundDraft ( payload: { contactId: string; draftSubject?: string; draftBody?: string; }, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<MomentumThreadResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<MomentumThreadResponse>( `${this.baseUrl}/outreach/momentum-threads/manual-followup/send-draft`, payload, { headers } );
    }

    approveMomentumDraft ( contactId: string, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<MomentumThreadResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<MomentumThreadResponse>( `${this.baseUrl}/outreach/momentum-threads/${encodeURIComponent( contactId )}/approve-draft`, {}, { headers } );
    }

    approveMomentumDraftsBatch ( contactIds: string[], opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<{ success: boolean; message: string; data: { approvedCount: number; failedCount: number; results: Array<{ contactId: string; success: boolean; error?: string; message?: string; }>; }; }> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<{ success: boolean; message: string; data: { approvedCount: number; failedCount: number; results: Array<{ contactId: string; success: boolean; error?: string; message?: string; }>; }; }>( `${this.baseUrl}/outreach/momentum-threads/approve-drafts-batch`, { contactIds }, { headers } );
    }

    rejectMomentumDraft ( contactId: string, payload: { draftKind?: 'outbound' | 'reply'; rejectedDraftSubject?: string; rejectedDraftBody?: string; rejectionReason?: string; } = {}, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<MomentumThreadResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<MomentumThreadResponse>( `${this.baseUrl}/outreach/momentum-threads/${encodeURIComponent( contactId )}/reject-draft`, payload, { headers } );
    }

    // Queues selected drafts for Maya to rewrite in the background (paced,
    // rate-limited) instead of rewriting them synchronously one at a time -
    // queued drafts disappear from Drafts until the rewrite pass finishes.
    rejectRewriteMomentumDraftsBatch ( contactIds: string[], opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<{ success: boolean; message: string; data: { queuedCount: number; failedCount: number; results: Array<{ contactId: string; success: boolean; error?: string; message?: string; }>; }; }> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<{ success: boolean; message: string; data: { queuedCount: number; failedCount: number; results: Array<{ contactId: string; success: boolean; error?: string; message?: string; }>; }; }>( `${this.baseUrl}/outreach/momentum-threads/reject-rewrite-drafts-batch`, { contactIds }, { headers } );
    }

    sendMomentumDraftTest ( contactId: string, payload: { recipientEmail?: string; } = {}, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<{ success: boolean; message: string; data: { recipientEmail: string; subject: string; }; }> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<{ success: boolean; message: string; data: { recipientEmail: string; subject: string; }; }>( `${this.baseUrl}/outreach/momentum-threads/${encodeURIComponent( contactId )}/send-draft-test`, payload, { headers } );
    }

    // Plain reject - discards the current draft with no rewrite attempt (distinct
    // from rejectMomentumDraft, which always has Maya try again).
    discardMomentumDraft ( contactId: string, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<MomentumThreadResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<MomentumThreadResponse>( `${this.baseUrl}/outreach/momentum-threads/${encodeURIComponent( contactId )}/discard-draft`, {}, { headers } );
    }

    // Removes a needs-human-edit thread from the Plan tab (soft-archive, not a
    // hard delete) - the contact stays eligible for Maya's normal rotation to
    // pick back up later.
    dismissMomentumThreadFromPlan ( contactId: string, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<{ success: boolean; message: string; data: { contactId: string; archived: boolean; }; }> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<{ success: boolean; message: string; data: { contactId: string; archived: boolean; }; }>( `${this.baseUrl}/outreach/momentum-threads/${encodeURIComponent( contactId )}/dismiss-from-plan`, {}, { headers } );
    }

    listMailboxes ( opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<MailboxConfigListResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.get<MailboxConfigListResponse>( `${this.baseUrl}/outreach/mailboxes`, { headers } );
    }

    testMailboxConnection ( payload: MailboxConnectionTestRequest, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<MailboxConnectionTestResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<MailboxConnectionTestResponse>( `${this.baseUrl}/outreach/mailboxes/test`, payload, { headers } );
    }

    saveMailbox ( payload: MailboxConnectionTestRequest, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<MailboxConfigMutationResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<MailboxConfigMutationResponse>( `${this.baseUrl}/outreach/mailboxes`, payload, { headers } );
    }

    syncMailbox ( mailboxId: string, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<MailboxSignalSummaryResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<MailboxSignalSummaryResponse>( `${this.baseUrl}/outreach/mailboxes/${encodeURIComponent( mailboxId )}/sync`, {}, { headers } );
    }

    listMailboxMessages ( mailboxId: string, opts: { tenantId?: string; userId?: string; userEmail?: string; limit?: number; } = {} ): Observable<MailboxMessageListResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        let params = new HttpParams();
        if ( opts.limit ) params = params.set( 'limit', String( opts.limit ) );
        return this.http.get<MailboxMessageListResponse>( `${this.baseUrl}/outreach/mailboxes/${encodeURIComponent( mailboxId )}/messages`, { headers, params } );
    }

    getMailboxMessage ( mailboxId: string, messageId: string, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<MailboxMessageDetailResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.get<MailboxMessageDetailResponse>( `${this.baseUrl}/outreach/mailboxes/${encodeURIComponent( mailboxId )}/messages/${encodeURIComponent( messageId )}`, { headers } );
    }

    replyToMailboxMessage ( mailboxId: string, messageId: string, payload: MailboxReplyRequest, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<MailboxReplyResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<MailboxReplyResponse>( `${this.baseUrl}/outreach/mailboxes/${encodeURIComponent( mailboxId )}/messages/${encodeURIComponent( messageId )}/reply`, payload, { headers } );
    }

    deleteMailboxMessage ( mailboxId: string, messageId: string, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<MailboxDeleteMessageResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.delete<MailboxDeleteMessageResponse>( `${this.baseUrl}/outreach/mailboxes/${encodeURIComponent( mailboxId )}/messages/${encodeURIComponent( messageId )}`, { headers } );
    }

    disconnectMailbox ( mailboxId: string, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<{ success: boolean; message: string; data: { deleted: boolean; mailboxId: string; }; }> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.delete<{ success: boolean; message: string; data: { deleted: boolean; mailboxId: string; }; }>( `${this.baseUrl}/outreach/mailboxes/${encodeURIComponent( mailboxId )}`, { headers } );
    }

    getOutreachProvisioning ( opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<OutreachProvisioningResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.get<OutreachProvisioningResponse>( `${this.baseUrl}/outreach/provisioning`, { headers } );
    }

    requestOutreachProvisioning ( payload: OutreachProvisioningRequestPayload, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<OutreachProvisioningResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<OutreachProvisioningResponse>( `${this.baseUrl}/outreach/provisioning/request`, payload, { headers } );
    }

    generateMomentumDraftAssist (
        payload: {
            contactId: string;
            purpose?: 'needs_you' | 'close' | 'maya_revision';
            rejectedDraftSubject?: string;
            rejectedDraftBody?: string;
            rejectionReason?: string;
        },
        opts: { tenantId?: string; userId?: string; userEmail?: string; } = {}
    ): Observable<MomentumThreadResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<MomentumThreadResponse>( `${this.baseUrl}/outreach/momentum-threads/draft-assist`, payload, { headers } );
    }

    createMomentumComposerHandoff ( contactId: string, payload: MomentumComposerHandoffRequest = {}, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<ComposerHandoffResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<ComposerHandoffResponse>( `${this.baseUrl}/outreach/momentum-threads/${encodeURIComponent( contactId )}/composer-handoff`, payload, { headers } );
    }

    listSocialPosts (
        query: {
            sourceType?: string;
            sourceId?: string;
            status?: string;
            statuses?: string[];
            postIds?: string[];
            limit?: number;
        } = {},
        opts: { tenantId?: string; userId?: string; userEmail?: string; } = {}
    ): Observable<SocialPostListResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        let params = new HttpParams();
        if ( query.sourceType ) params = params.set( 'sourceType', query.sourceType );
        if ( query.sourceId ) params = params.set( 'sourceId', query.sourceId );
        if ( query.status ) params = params.set( 'status', query.status );
        if ( query.statuses?.length ) params = params.set( 'statuses', query.statuses.join( ',' ) );
        if ( query.postIds?.length ) params = params.set( 'postIds', query.postIds.join( ',' ) );
        if ( query.limit ) params = params.set( 'limit', String( query.limit ) );
        return this.http.get<SocialPostListResponse>( `${this.baseUrl}/outreach/social-posts`, { headers, params } );
    }

    syncSocialChangeLog ( markdown: string, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<any> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<any>( `${this.baseUrl}/outreach/social-change-log/sync`, { markdown }, { headers } );
    }

    generateSocialDrafts ( payload: { sourceContentReference?: SocialPostSourceReference; sourceSnapshot?: SocialSourceSnapshot; platforms?: string[]; strategyContext?: SocialDraftStrategyContext; identityContext?: SocialIdentityContext | null; offerContext?: SocialOfferContext | null; }, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<SocialDraftGenerationResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<SocialDraftGenerationResponse>( `${this.baseUrl}/outreach/social-posts/generate`, payload, { headers } );
    }

    getSocialProviderConfigHealth (): Observable<SocialProviderConfigHealthResponse> {
        return this.http.get<SocialProviderConfigHealthResponse>( `${this.baseUrl}/outreach/social-auth/config/health` );
    }

    testSocialAccountConnection ( accountId: string, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<SocialAccountConnectionTestResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<SocialAccountConnectionTestResponse>( `${this.baseUrl}/outreach/social-auth/accounts/${encodeURIComponent( accountId )}/test`, {}, { headers } );
    }

    testConnectedSocialAccounts ( opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<SocialAccountHealthResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<SocialAccountHealthResponse>( `${this.baseUrl}/outreach/social-auth/accounts/health`, {}, { headers } );
    }

    listSocialAccounts ( opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<SocialAccountListResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.get<SocialAccountListResponse>( `${this.baseUrl}/outreach/social-accounts`, { headers } );
    }

    disconnectSocialAccount ( accountId: string, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<{ success: boolean; message: string; data: SocialAccount; }> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.delete<{ success: boolean; message: string; data: SocialAccount; }>( `${this.baseUrl}/outreach/social-accounts/${encodeURIComponent( accountId )}`, { headers } );
    }

    startSocialAuth ( provider: string, payload: { frontendReturnUrl?: string; handle?: string; appPassword?: string; youtubeEnabled?: boolean; destination?: string; destinationType?: string; } = {}, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<SocialAuthSessionResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<SocialAuthSessionResponse>( `${this.baseUrl}/outreach/social-auth/${encodeURIComponent( provider )}/start`, payload, { headers } );
    }

    createSocialPost ( payload: { sourceContentReference: SocialPostSourceReference; platform: string; content: string; status?: string; socialAccountId?: string; subreddit?: string; mediaAttachment?: SocialMediaAttachment | null; strategyContext?: SocialDraftStrategyContext | null; identityContext?: SocialIdentityContext | null; offerContext?: SocialOfferContext | null; identityReview?: ToddWritingIdentityReview | null; approvedAt?: string | null; scheduledFor?: string | null; actionId?: string | null; planId?: string | null; strategyId?: string | null; segmentId?: string | null; angleId?: string | null; }, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<SocialPostResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<SocialPostResponse>( `${this.baseUrl}/outreach/social-posts`, payload, { headers } );
    }

    updateSocialPost ( postId: string, payload: { sourceContentReference: SocialPostSourceReference; platform: string; content: string; status?: string; publishedTimestamp?: string | null; externalPlatformPostId?: string | null; socialAccountId?: string; subreddit?: string; engagementSignal?: SocialEngagementSignal; followUpSuggestion?: SocialFollowUpSuggestion; mediaAttachment?: SocialMediaAttachment | null; strategyContext?: SocialDraftStrategyContext | null; identityContext?: SocialIdentityContext | null; offerContext?: SocialOfferContext | null; identityReview?: ToddWritingIdentityReview | null; approvedAt?: string | null; scheduledFor?: string | null; redditSafety?: { recentCommentCount?: number; requiresCommentFirst?: boolean; checkedAt?: string | null; } | null; actionId?: string | null; planId?: string | null; strategyId?: string | null; segmentId?: string | null; angleId?: string | null; }, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<SocialPostResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.put<SocialPostResponse>( `${this.baseUrl}/outreach/social-posts/${encodeURIComponent( postId )}`, payload, { headers } );
    }

    deleteSocialPost ( postId: string, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<SocialPostDeleteResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.delete<SocialPostDeleteResponse>( `${this.baseUrl}/outreach/social-posts/${encodeURIComponent( postId )}`, { headers } );
    }

    refineSocialPostDraft ( postId: string, payload: { currentDraft: string; actionType: SocialDraftRefinementActionType; sourceContentReference: SocialPostSourceReference; sourceSnapshot?: SocialSourceSnapshot; strategyContext?: SocialDraftStrategyContext; identityContext?: SocialIdentityContext | null; offerContext?: SocialOfferContext | null; }, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<SocialPostResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<SocialPostResponse>( `${this.baseUrl}/outreach/social-posts/${encodeURIComponent( postId )}/refine`, payload, { headers } );
    }

    publishSocialPost ( postId: string, payload: { socialAccountId?: string; subreddit?: string; } = {}, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<SocialPostResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<SocialPostResponse>( `${this.baseUrl}/outreach/social-posts/${encodeURIComponent( postId )}/publish`, payload, { headers } );
    }

    suggestSocialFollowUp ( postId: string, payload: { engagementSignal?: SocialEngagementSignal; } = {}, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<SocialPostResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<SocialPostResponse>( `${this.baseUrl}/outreach/social-posts/${encodeURIComponent( postId )}/suggest-follow-up`, payload, { headers } );
    }

    getBlueskyNichePosts ( keywords: string, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<{ success: boolean; data: BlueskyNichePost[]; message?: string; }> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.get<{ success: boolean; data: BlueskyNichePost[]; message?: string; }>( `${this.baseUrl}/outreach/social/bluesky/niche-posts?keywords=${encodeURIComponent( keywords )}&limit=5`, { headers } );
    }

    postBlueskyFirstComment ( postId: string, payload: { replyToUri: string; replyToCid: string; content: string; }, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<{ success: boolean; data: any; message?: string; }> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<{ success: boolean; data: any; message?: string; }>( `${this.baseUrl}/outreach/social-posts/${encodeURIComponent( postId )}/bluesky-first-comment`, payload, { headers } );
    }

    expandSocialThread ( postId: string, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<{ success: boolean; data: { originalPost: { postId: string; content: string; platform: string; }; threadParts: string[]; }; message?: string; }> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<{ success: boolean; data: { originalPost: { postId: string; content: string; platform: string; }; threadParts: string[]; }; message?: string; }>( `${this.baseUrl}/outreach/social-posts/${encodeURIComponent( postId )}/expand-thread`, {}, { headers } );
    }

    getMarketingOperatorStrategy ( opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<MarketingOperatorStrategyResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.get<MarketingOperatorStrategyResponse>( `${this.baseUrl}/outreach/social-strategy`, { headers } );
    }

    saveMarketingOperatorStrategy ( payload: { strategy: SocialDraftStrategyContext; }, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<MarketingOperatorStrategyResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.put<MarketingOperatorStrategyResponse>( `${this.baseUrl}/outreach/social-strategy`, payload, { headers } );
    }

    generateMarketingOperatorStrategy (
        payload: {
            strategy?: SocialDraftStrategyContext | null;
        } = {},
        opts: { tenantId?: string; userId?: string; userEmail?: string; } = {}
    ): Observable<MarketingOperatorStrategyResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<MarketingOperatorStrategyResponse>( `${this.baseUrl}/outreach/social-strategy/generate`, payload, { headers } );
    }

    getNextMarketingAction ( opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<NextMarketingActionResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.get<NextMarketingActionResponse>( `${this.baseUrl}/outreach/social-strategy/next-action`, { headers } );
    }

    getMarketingOperatorStatus ( opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<MarketingOperatorStatusResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.get<MarketingOperatorStatusResponse>( `${this.baseUrl}/outreach/social-strategy/operator-status`, { headers } );
    }

    runMarketingOperatorPhase ( payload: { phase: 'morning_review' | 'midday_check' | 'end_of_day'; date?: string; }, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<MarketingOperatorRunResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<MarketingOperatorRunResponse>( `${this.baseUrl}/outreach/social-strategy/run`, payload, { headers } );
    }

    createCatalystRun (
        payload: {
            name?: string;
            source?: string;
            includeLeadVaultContacts?: boolean;
            plannedCount?: number;
            eligibleCount?: number;
            invalidCount?: number;
            queuedCount?: number;
            skippedCount?: number;
            removedCount?: number;
            contactIds?: string[];
            createdByUserId?: string;
            createdByUserEmail?: string;
        },
        opts: { tenantId?: string; userId?: string; userEmail?: string; } = {}
    ): Observable<CatalystRunResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.post<CatalystRunResponse>( `${this.baseUrl}/outreach/catalyst-runs`, payload, { headers } );
    }

    listCatalystRuns (
        request: { limit?: number; } = {},
        opts: { tenantId?: string; userId?: string; userEmail?: string; } = {}
    ): Observable<CatalystRunListResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        let params = new HttpParams();
        if ( request.limit ) params = params.set( 'limit', String( request.limit ) );
        return this.http.get<CatalystRunListResponse>( `${this.baseUrl}/outreach/catalyst-runs`, { headers, params } );
    }

    finalizeCatalystRun (
        runId: string,
        payload: { status?: string; queuedCount?: number; skippedCount?: number; removedCount?: number; },
        opts: { tenantId?: string; userId?: string; userEmail?: string; } = {}
    ): Observable<CatalystRunResponse> {
        const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
        return this.http.patch<CatalystRunResponse>(
            `${this.baseUrl}/outreach/catalyst-runs/${encodeURIComponent( runId )}`,
            payload,
            { headers }
        );
    }
}
