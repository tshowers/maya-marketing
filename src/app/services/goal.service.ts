import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, distinctUntilChanged, map } from 'rxjs';

import { environment } from '../../environments/environment';
import { SettingsService } from './settings.service';
import { ToddFallbackOfferCatalogItem, toddFallbackOfferCatalog } from '../shared/config/todd-fallback-offer-catalog';

export const DAILY_MOMENTUM_REFRESH_EVENT = 'daily-momentum:refresh';
export const DAILY_MOMENTUM_REFRESH_STORAGE_KEY = 'daily-momentum:refresh-signal';

type MomentumBlocker = {
    code?: string;
    message?: string;
};

type MomentumGoalStatus = {
    goal?: number;
    revenue?: number;
    gap?: number;
    status?: string;
    appointments?: number;
    appointmentsSoFar?: number;
    appointmentCount?: number;
    revenueVerification?: {
        status?: string;
        source?: string;
        connected?: boolean;
        message?: string;
        stripeConnectedAccountId?: string;
        stripeCustomerId?: string;
        stripeConnected?: boolean;
        detailsSubmitted?: boolean;
        chargesEnabled?: boolean;
        payoutsEnabled?: boolean;
        requirementsCurrentlyDue?: string[];
        requirementsDisplay?: string[];
        isFullyReady?: boolean;
    };
    calendarVerification?: {
        status?: string;
        provider?: string;
        connected?: boolean;
        message?: string;
        appointmentsToday?: number | null;
    };
};

type MomentumStrategy = {
    summary?: string;
    explanation?: string;
    recommendedAction?: string;
    availableActions?: string[];
    actionState?: string;
    requiresConfirmation?: boolean;
    signals?: Record<string, unknown>;
    strategySignals?: Record<string, unknown>;
};

type MomentumBehaviorAlignment = {
    tone?: 'info' | 'positive' | 'attention';
    label?: string;
    summary?: string;
    priorityScore?: number;
};

type MomentumBehaviorContext = {
    tone?: 'info' | 'positive' | 'attention';
    headline?: string;
    summary?: string;
    recommendedActionFamily?: string;
    topExitPage?: string;
    topBreakpointPage?: string;
    strongestSource?: string;
    strongestCampaign?: string;
    strongestDevice?: string;
    urgencyLevel?: string;
    escalationLabel?: string;
    escalationSummary?: string;
};

type MomentumBehaviorContextMeta = {
    source?: string;
    refreshedAt?: string;
    originalSource?: string;
};

type MomentumFeaturePromotion = {
    id?: string;
    name?: string;
    route?: string;
    action?: string;
    summary?: string;
    score?: number;
    triggerSignal?: {
        type?: string;
        summary?: string;
        createdAt?: string;
        campaignId?: string;
        campaignName?: string;
        subject?: string;
        status?: string;
        sentCount?: number;
        openCount?: number;
        openRate?: number;
    } | null;
};

type MomentumTenantActionContext = {
    offerSummary?: string;
    summary?: string;
    behaviorSummary?: string;
    pressureSummary?: string;
    userContextLabel?: string;
    offerContext?: {
        title?: string;
        [key: string]: unknown;
    } | null;
    userContext?: {
        label?: string;
        guidance?: string;
        [key: string]: unknown;
    } | null;
    contextQuality?: Record<string, unknown>;
    [key: string]: unknown;
};

type MomentumExecutionSuggestion = {
    action?: string;
    title?: string;
    detail?: string;
    resultSummary?: string;
    route?: string;
    status?: string;
    requiresConfirmation?: boolean;
    ctaLabel?: string;
    actionPath?: string;
    preparedSummary?: string;
    approvalSummary?: string;
    reviewLabel?: string;
    approvalLabel?: string;
    executionMode?: string;
    actionPlanId?: string;
    payload?: {
        featurePromotion?: MomentumFeaturePromotion | null;
        [key: string]: unknown;
    };
    receipt?: MomentumExecutionReceipt;
    behaviorAlignment?: MomentumBehaviorAlignment | null;
    behaviorContext?: MomentumBehaviorContext | null;
    behaviorContextMeta?: MomentumBehaviorContextMeta | null;
    behaviorCommandSummary?: string;
    offerContext?: ToddSelectedOffer | null;
    tacticContext?: ToddOfferTactic | null;
    featurePromotion?: MomentumFeaturePromotion | null;
};

export type MomentumActionPlan = {
    id?: string;
    type?: string;
    category?: string;
    status?: string;
    completedAt?: string;
    executionMode?: string;
    approvalRequired?: boolean;
    payload?: {
        title?: string;
        preparedSummary?: string;
        approvalSummary?: string;
        reviewLabel?: string;
        approvalLabel?: string;
        featurePromotion?: MomentumFeaturePromotion | null;
        [key: string]: unknown;
    };
    reviewRoute?: string;
    blockerReason?: string;
    createdAt?: string;
    source?: string;
    summary?: string;
    behaviorAlignment?: MomentumBehaviorAlignment | null;
    behaviorContext?: MomentumBehaviorContext | null;
    behaviorContextMeta?: MomentumBehaviorContextMeta | null;
};

export type MomentumExecutionReceipt = {
    id?: string;
    actionPlanId?: string;
    type?: string;
    status?: string;
    summary?: string;
    behaviorCommandSummary?: string;
    metrics?: Record<string, unknown>;
    createdAt?: string;
    completedAt?: string;
    error?: string;
    behaviorAlignment?: MomentumBehaviorAlignment | null;
    behaviorContext?: MomentumBehaviorContext | null;
    behaviorContextMeta?: MomentumBehaviorContextMeta | null;
    offerId?: string;
    offerName?: string;
    offerPrice?: string;
    offerOutcome?: string;
};

export type MomentumApprovalReceiptStatus = 'executed' | 'prepared' | 'failed' | 'blocked';

export type MomentumApprovalReceipt = {
    actionId?: string;
    actionType?: string;
    tenantId?: string;
    status?: MomentumApprovalReceiptStatus | string;
    executedAt?: string;
    resultMessage?: string;
    externalReference?: {
        handoffId?: string;
        postId?: string;
        postIds?: string[];
        reviewRoute?: string;
        campaignId?: string;
        contactIds?: string[];
        [key: string]: unknown;
    };
    error?: string;
    blocker?: string;
    receiptId?: string;
};

type MomentumApprovalPolicy = {
    scope?: string;
    autoSendCcEmail?: string;
    dailyDraftTarget?: number;
    dailyAutoSendTarget?: number;
    categories?: Record<string, {
        mode?: string;
        label?: string;
    }>;
    executionPosture?: ToddMomentumEngineState['executionPosture'];
    effectiveBehaviorRules?: ToddMomentumEngineState['effectiveBehaviorRules'];
    executionPostureOverride?: {
        mode?: DailyMomentumExecutionPostureMode | string;
        updatedAt?: string;
        updatedBy?: string;
    } | null;
};

type MomentumSocialQueueSummary = {
    approvedCount?: number;
    approvedScheduledCount?: number;
    publishedThisWeekCount?: number;
    draftCount?: number;
    pendingRetryCount?: number;
    queueCoverageCount?: number;
    latestApprovedScheduledFor?: string | null;
};

type MomentumPayload = {
    goalStatus?: MomentumGoalStatus;
    strategy?: MomentumStrategy;
    behaviorContext?: MomentumBehaviorContext;
    engineState?: ToddMomentumEngineState;
    rssConfig?: {
        enabled?: boolean;
        feedUrls?: string[];
    };
    executionSuggestions?: MomentumExecutionSuggestion[];
    actionPlans?: MomentumActionPlan[];
    approvalPolicy?: MomentumApprovalPolicy;
    socialQueueSummary?: MomentumSocialQueueSummary;
    executionReceipts?: MomentumExecutionReceipt[];
    latestReceiptByActionPlan?: Record<string, MomentumExecutionReceipt>;
    blockers?: MomentumBlocker[];
};

type MomentumScopedSocialStateStage = 'draft' | 'approved' | 'published' | 'rejected' | 'archived';

type MomentumScopedSocialState = {
    stage: MomentumScopedSocialStateStage;
    trackedPostIds: string[];
    draftPostIds: string[];
    approvedPostIds: string[];
    publishedPostIds: string[];
    rejectedPostIds: string[];
    archivedPostIds: string[];
    route: string;
    actionPath: string;
};

export type ToddMomentumActionState = 'selected' | 'queued' | 'drafted' | 'confirm';

export type ToddMomentumAction = {
    state: ToddMomentumActionState;
    title: string;
    detail: string;
    route: string;
    ctaLabel: string;
    actionPath: string;
};

export type DailyMomentumAuditState = 'checked' | 'attention';
export type DailyMomentumExecutionStatus = 'selected' | 'drafted' | 'queued' | 'waiting_for_confirmation' | 'blocked' | 'completed' | 'failed';
export type DailyMomentumExecutionMode = 'manual' | 'approval-first' | 'auto';
export type DailyMomentumExecutionPostureMode = 'safe' | 'money';
export type DailyMomentumActionState = 'prepared_by_todd' | 'waiting_for_approval' | 'approval_needed' | 'auto_executed' | 'deferred' | 'setup_needed' | 'blocked' | 'completed' | 'failed';
export type ToddMomentumEngineRunState = 'idle' | 'evaluating' | 'preparing' | 'waiting_for_approval' | 'approval_needed' | 'deferred' | 'setup_needed' | 'queued' | 'executing' | 'blocked' | 'failed' | 'completed';

export type ToddMomentumEngineState = {
    tenantId?: string;
    pressureProfile?: {
        mode?: 'normal' | 'recovery' | 'panic' | string;
        goal?: number;
        revenue?: number;
        gap?: number;
        gapPercent?: number;
        revenueToday?: number;
        localHour?: number;
        hoursRemaining?: number;
        warmSignalStrength?: number;
        inventoryStrength?: number;
        explanation?: string;
        behaviorRules?: {
            followUpMultiplier?: number;
            cooldownMultiplier?: number;
            outreachVolumeMultiplier?: number;
            prioritizeWarmSignals?: boolean;
            allowAlternateChannels?: boolean;
            copyIntensity?: string;
            socialCadenceOverride?: string;
            autoExecuteThreshold?: string;
        };
    } | null;
    executionPosture?: {
        mode?: DailyMomentumExecutionPostureMode | string;
        source?: string;
        reason?: string;
        effectiveRules?: {
            approvalBias?: string;
            autoSendBias?: string;
            cooldownBias?: string;
            multiTouchBias?: string;
            alternateChannelBias?: string;
            copyUrgencyBias?: string;
            workWindowOverride?: boolean;
            warmSignalPriorityBias?: string;
        };
    } | null;
    executionPostureReason?: string;
    executionPostureSource?: string;
    effectiveBehaviorRules?: {
        approvalBias?: string;
        autoSendBias?: string;
        cooldownBias?: string;
        multiTouchBias?: string;
        alternateChannelBias?: string;
        copyUrgencyBias?: string;
        workWindowOverride?: boolean;
        warmSignalPriorityBias?: string;
    } | null;
    runState?: ToddMomentumEngineRunState | string;
    activeRunId?: string;
    currentPhase?: string;
    currentSummary?: string;
    lastEventAt?: string;
    lastSuccessfulRunAt?: string;
    lastRunStartedAt?: string;
    lastRunFinishedAt?: string;
    lastAnalysisAt?: string;
    lastStripeCheckAt?: string;
    lastCalendarCheckAt?: string;
    lastSignalScanAt?: string;
    lastActionCreatedAt?: string;
    lastActionExecutedAt?: string;
    lastSocialPostQueuedAt?: string;
    lastSocialPostPublishedAt?: string;
    lastSocialPublishAttemptAt?: string;
    lastSocialPublishError?: string;
    lastRunOutcome?: string;
    plansCreatedCount?: number;
    plansReadyForApprovalCount?: number;
    plansExecutedCount?: number;
    blockers?: string[];
    nextRecommendedAction?: string;
    operatingPhase?: string;
    operatingRules?: {
        backendTruthSources?: string[];
        safeAutomation?: string;
        approvalRequired?: string;
    };
    workdayRecommendation?: {
        status?: string;
        title?: string;
        summary?: string;
        reason?: string;
        action?: string;
        route?: string;
        type?: string;
        category?: string;
        actionPlanId?: string;
        score?: number;
        probability?: number;
        friction?: number;
        approvalRequired?: boolean;
        external?: boolean;
        evaluatedCount?: number;
        context?: Record<string, unknown>;
    } | null;
    socialQueueTelemetry?: {
        inspectedCount?: number;
        publishedCount?: number;
        skippedCount?: number;
        skippedReasons?: Record<string, number>;
        lastPublishAttemptAt?: string;
        lastPublishedAt?: string;
        lastPublishError?: string;
    } | null;
    latestOperatorDirective?: {
        id?: string;
        tenantId?: string;
        activeRunId?: string;
        createdAt?: string;
        trigger?: string;
        mode?: string;
        goal?: number;
        gap?: number;
        offerFocus?: string;
        urgencyPhase?: string;
        selectedChannels?: string[];
        authorityMode?: string;
        successTarget?: string;
        channelExpectations?: Record<string, unknown>;
        workdayWindow?: Record<string, unknown> | null;
    } | null;
    channelOutcomes?: {
        social?: {
            status?: string;
            helped?: boolean;
            ran?: boolean;
            momentumDirectiveId?: string;
            strategyAlignmentScore?: number;
            goalAlignmentScore?: number;
            approvedReadyCount?: number;
            draftsNeedingReviewCount?: number;
            publishedCount?: number;
            blockedCount?: number;
            deferredCount?: number;
            setupNeededCount?: number;
            approvalNeededCount?: number;
            blockedReason?: string;
            publishOutcome?: string;
            summary?: string;
            lastRunAt?: string;
        };
        outbox?: {
            status?: string;
            helped?: boolean;
            ran?: boolean;
            momentumDirectiveId?: string;
            selectedContactCount?: number;
            sentCount?: number;
            blockedCount?: number;
            deferredCount?: number;
            setupNeededCount?: number;
            approvalNeededCount?: number;
            draftCount?: number;
            candidateSources?: Record<string, number>;
            candidateSource?: Record<string, number> | null;
            blockedReason?: string;
            sendOutcome?: string;
            summary?: string;
            lastRunAt?: string;
        };
    } | null;
    latestOperatorReport?: {
        reportHour?: string;
        dailyGoalAmount?: number;
        revenueSoFar?: number;
        remainingGap?: number;
        actionsCreated?: number;
        actionsExecuted?: number;
        approvalsWaiting?: number;
        socialDraftsCreated?: number;
        socialPostsPublished?: number;
        socialPostsSkipped?: number;
        emailsPrepared?: number;
        hotSignalsFound?: number;
        integrationsWorking?: string[];
        integrationsBlocked?: string[];
        adjustmentsMade?: string[];
        nextAction?: string;
        workdayRecommendation?: {
            status?: string;
            title?: string;
            summary?: string;
            reason?: string;
            action?: string;
            route?: string;
            type?: string;
            category?: string;
            actionPlanId?: string;
            score?: number;
            probability?: number;
            friction?: number;
            approvalRequired?: boolean;
            external?: boolean;
            evaluatedCount?: number;
            context?: Record<string, unknown>;
        } | null;
        whatToddTried?: string;
        whatToddCreated?: string;
        whyChosen?: string;
        changedSinceLastHour?: string;
        blockers?: string[];
        createdAt?: string;
    } | null;
    openAlerts?: Array<{
        id?: string;
        severity?: string;
        area?: string;
        message?: string;
        reason?: string;
        detectedAt?: string;
        lastSuccessfulAt?: string;
        recommendedFix?: string;
        userActionRequired?: boolean;
    }>;
    pendingApprovalCount?: number;
    approvalNeededCount?: number;
    setupNeededCount?: number;
    deferredCount?: number;
    blockedCount?: number;
    queuedCount?: number;
    completedTodayCount?: number;
    updatedAt?: string;
};

export type ToddMomentumActivityItem = {
    id?: string;
    kind?: 'event' | 'signal' | string;
    type?: string;
    status?: string;
    summary?: string;
    createdAt?: string;
    actionPlanId?: string;
    signalSource?: string;
    payload?: Record<string, unknown>;
};

export type DailyMomentumSnapshot = {
    goalAmount: string;
    revenueSoFar: string;
    gapRemaining: string;
    revenueScoreLabel: string;
    revenueScorePercent: number;
    momentumScoreLabel: string;
    momentumScorePercent: number;
    momentumScoreSummary: string;
    appointmentMetricLabel: string;
    appointmentMetricValue: string;
    appointmentMetricNote: string;
    appointmentMetricState: 'connected' | 'not_connected' | 'unavailable';
    status: 'behind' | 'on_track' | 'met' | 'unknown';
    statusLabel: string;
};

export type DailyMomentumAuditItem = {
    label: string;
    detail: string;
    proofLine?: string;
    state: DailyMomentumAuditState;
};

export type DailyMomentumActionRow = {
    label: string;
    detail: string;
    state: DailyMomentumActionState;
    stateLabel: string;
    preparedSummary: string;
    approvalSummary: string;
    route: string;
    actionPath: string;
    reviewLabel: string;
    approvalLabel: string;
    actionPlanId?: string;
    metrics: Array<{ label: string; value: string; }>;
    secondaryCtaLabel?: string;
    secondaryCtaRoute?: string;
    secondaryCtaPath?: string;
    behaviorAlignment?: MomentumBehaviorAlignment | null;
    behaviorContext?: MomentumBehaviorContext | null;
    behaviorContextMeta?: MomentumBehaviorContextMeta | null;
    behaviorCommandSummary?: string;
    offerContext?: ToddSelectedOffer | null;
    tacticContext?: ToddOfferTactic | null;
    featurePromotion?: MomentumFeaturePromotion | null;
    actionType?: string;
    payload?: Record<string, unknown>;
    receipt?: MomentumExecutionReceipt;
};

export type MomentumOperatorFeedbackRequest = {
    decision: 'cancel' | 'correct' | 'override';
    reasonCode: string;
    operatorNote: string;
    scope?: 'thread' | 'contact' | 'company' | 'campaign' | 'channel' | 'tenant';
    dismissAction?: boolean;
    requestedBehavior?: {
        avoidChannels?: string[];
        preferChannels?: string[];
        avoidOffers?: string[];
        preferOffers?: string[];
        toneShift?: string;
        timingRule?: string;
    };
};

export type MomentumOperatorFeedbackTarget = {
    type: 'operator_alert' | 'social_post' | string;
    id: string;
    label?: string;
    summary?: string;
    scopeKey?: string;
    route?: string;
    area?: string;
    reason?: string;
    contactId?: string;
    companyName?: string;
    channel?: string;
    actionType?: string;
    metadata?: Record<string, unknown>;
};

export type DailyMomentumCta = {
    label: string;
    description: string;
    route: string;
    actionPath: string;
    kind: 'primary';
};

export type DailyMomentumSupportCta = {
    label: string;
    route: string;
    actionPath: string;
    kind: 'secondary';
};

export type DailyMomentumPendingAction = {
    label: string;
    description: string;
    route: string;
    actionPath: string;
};

export type DailyMomentumApprovalActionRisk = 'low' | 'high';

export type DailyMomentumApprovalAction = {
    label: string;
    description: string;
    missingApproval: string;
    risk: DailyMomentumApprovalActionRisk;
    route: string;
    actionPath: string;
};

export type DailyMomentumFallbackAction = {
    label: string;
    summary: string;
    proofLine?: string;
    route: string;
    actionPath: string;
    sourceLabel: string;
};

export type DailyMomentumChecklistCta = {
    label: string;
    route: string;
    actionPath: string;
};

export type DailyMomentumApprovalChecklist = {
    headline: string;
    summary: string;
    tried: string[];
    blockedBy: string[];
    actions: DailyMomentumApprovalAction[];
    primaryCta: DailyMomentumChecklistCta | null;
    secondaryCta: DailyMomentumChecklistCta | null;
};

export type DailyMomentumApprovalModeOption = {
    value: DailyMomentumExecutionMode;
    label: string;
    description: string;
};

export type ToddMissionType =
    | 'daily_revenue_outcome'
    | 'project_delivery_outcome'
    | 'campaign_execution_outcome'
    | 'client_success_outcome';

export type ToddMissionIntake = {
    title?: string;
    missionType: ToddMissionType;
    problemStatement: string;
    desiredOutcome: string;
    companyDescription?: string;
    mission?: string;
    valueProposition?: string;
    resources?: string[];
    stakeholders?: string[];
    constraints?: string[];
    timeline?: string;
    successCriteria?: string[];
};

export type ToddMissionMove = {
    id: string;
    title: string;
    status: string;
    priority: string;
    phase?: string;
    route?: string;
    superseded?: boolean;
    supersededAt?: string;
    supersededReason?: string;
};

export type ToddMissionRecord = {
    id: string;
    missionType: ToddMissionType;
    status: string;
    title: string;
    moveCount?: number;
    createdAt?: string;
    updatedAt?: string;
    intake?: ToddMissionIntake;
    plan?: {
        projectSummary?: string;
        successCriteria?: string[];
        milestones?: Array<{
            id?: string;
            title?: string;
            objective?: string;
            deliverables?: string[];
        }>;
        taskPlan?: Array<{
            title?: string;
            description?: string;
            phase?: string;
            priority?: string;
        }>;
        blockerAssumptions?: string[];
        nextRecommendedMove?: {
            label?: string;
            description?: string;
        };
    };
    moves?: ToddMissionMove[];
    progress?: {
        totalCount?: number;
        openCount?: number;
        completedCount?: number;
        blockedCount?: number;
        inProgressCount?: number;
        overdueCount?: number;
        completionPercent?: number;
    };
    health?: {
        totalCount?: number;
        openCount?: number;
        blockedCount?: number;
        completedCount?: number;
        overdueCount?: number;
        completionPercent?: number;
        currentRiskLevel?: string;
        topRisk?: string;
    };
    drift?: {
        label?: string;
        explanation?: string;
        signals?: string[];
    };
    risks?: string[];
    revision?: {
        createdAt?: string;
        summary?: {
            before?: string;
            after?: string;
            changed?: boolean;
        };
        successCriteria?: {
            unchanged?: string[];
            added?: string[];
            removed?: string[];
        };
        milestones?: {
            unchanged?: Array<{ id?: string; title?: string; objective?: string; deliverables?: string[]; }>;
            modified?: Array<{
                before?: { id?: string; title?: string; objective?: string; deliverables?: string[]; };
                after?: { id?: string; title?: string; objective?: string; deliverables?: string[]; };
            }>;
            added?: Array<{ id?: string; title?: string; objective?: string; deliverables?: string[]; }>;
            removed?: Array<{ id?: string; title?: string; objective?: string; deliverables?: string[]; }>;
        };
        blockerAssumptions?: {
            unchanged?: string[];
            added?: string[];
            removed?: string[];
        };
        taskChanges?: {
            unchanged?: Array<{ title?: string; description?: string; phase?: string; priority?: string; }>;
            added?: Array<{ title?: string; description?: string; phase?: string; priority?: string; alreadyExistsAsMove?: boolean; relatedMoveId?: string; relatedMoveTitle?: string; }>;
            modified?: Array<{
                before?: { title?: string; description?: string; phase?: string; priority?: string; };
                after?: { title?: string; description?: string; phase?: string; priority?: string; };
                alreadyExistsAsMove?: boolean;
                relatedMoveId?: string;
                relatedMoveTitle?: string;
            }>;
            removed?: Array<{ title?: string; description?: string; phase?: string; priority?: string; relatedMoveId?: string; relatedMoveTitle?: string; relatedMoveSuperseded?: boolean; }>;
        };
        nextRecommendedMove?: {
            before?: { label?: string; description?: string; };
            after?: { label?: string; description?: string; };
            changed?: boolean;
        };
        newTaskCount?: number;
        changedTaskCount?: number;
        removedTaskCount?: number;
        unchangedTaskCount?: number;
        appliedNetNewMoves?: boolean;
        appliedMoveIds?: string[];
    };
    revisions?: Array<{
        createdAt?: string;
        summary?: {
            before?: string;
            after?: string;
            changed?: boolean;
        };
        newTaskCount?: number;
        changedTaskCount?: number;
        removedTaskCount?: number;
        unchangedTaskCount?: number;
        appliedNetNewMoves?: boolean;
        appliedMoveIds?: string[];
        nextRecommendedMove?: {
            before?: { label?: string; description?: string; };
            after?: { label?: string; description?: string; };
            changed?: boolean;
        };
    }>;
    latestRevision?: {
        createdAt?: string;
        summary?: {
            before?: string;
            after?: string;
            changed?: boolean;
        };
        newTaskCount?: number;
        changedTaskCount?: number;
        removedTaskCount?: number;
        unchangedTaskCount?: number;
        appliedNetNewMoves?: boolean;
        appliedMoveIds?: string[];
    };
    communicationDrafts?: {
        stakeholderStatusUpdate?: string;
        blockerEscalationUpdate?: string;
        decisionRequestUpdate?: string;
        progressSummaryNote?: string;
    };
    communicationNotes?: Array<{
        id?: string;
        draftType?: string;
        title?: string;
        body?: string;
        audienceLabel?: string;
        createdAt?: string;
        updatedAt?: string;
    }>;
    statusUpdateDraft?: string;
};

export type DailyMomentumApprovalPolicySetting = {
    category: string;
    label: string;
    description: string;
    mode: DailyMomentumExecutionMode;
    modeLabel: string;
    modeDescription: string;
};

export type DailyMomentumApprovalPolicyConfig = {
    dailyDraftTarget: number;
    dailyAutoSendTarget: number;
};

export type DailyMomentumDecisionState = {
    selectedMove: string;
    selectedMoveTitle: string;
    executionStatus: DailyMomentumExecutionStatus;
    lastActionTaken: string;
    route: string;
    actionPath: string;
    pendingAction: DailyMomentumPendingAction | null;
};

export type DailyMomentumHistoryEntry = {
    dateKey: string;
    goalAmount?: number;
    revenue?: number;
    gap?: number;
    status?: 'behind' | 'on_track' | 'met' | 'unknown';
    actionCount?: number;
    successfulOutcomeCount?: number;
    appointmentCount?: number;
};

export type MayaOutreachBatchContact = {
    contactId?: string;
    emailAddress?: string;
    displayName?: string;
    companyName?: string;
    stage?: string;
    autoSendEligible?: boolean;
    queueMode?: string;
    journeySource?: string;
    signalState?: string;
    touchCount?: number;
    openCount?: number;
    clickCount?: number;
    selectedAt?: string;
    selectedReason?: string;
};

export type MayaOutreachBatch = {
    id?: string;
    path?: string;
    tenantId?: string;
    batchDate?: string;
    timezone?: string;
    createdAt?: string;
    updatedAt?: string;
    status?: string;
    source?: string;
    senderEmail?: string;
    mayaConfig?: {
        enabled?: boolean;
        timezone?: string;
        startHour?: number;
        emailDraftingEnabled?: boolean;
    };
    counts?: {
        consideredCount?: number;
        selectedCount?: number;
        autoSendEligibleCount?: number;
        draftOnlyEligibleCount?: number;
        dailyDraftTarget?: number;
        existingDailyBatchCount?: number;
        skippedCount?: number;
    };
    skippedReasons?: Record<string, number>;
    contacts?: MayaOutreachBatchContact[];
    draftingDuty?: {
        draftedContactIds?: string[];
        draftedCount?: number;
        failedContactIds?: string[];
        lastProcessedHourKey?: string;
        lastRunAt?: string;
    };
};

export type DailyMomentumUserProfile = {
    firstName?: string;
    profession?: string;
    status?: string;
    jobDescriptionForTODD?: string;
    company?: {
        name?: string;
        description?: string;
        goal?: string;
        valueProp?: string;
        capabilities?: string[];
        keyFeatures?: string[];
        companyDescriptionForTODD?: string;
        companyGoalForTODD?: string;
        companyValuePropForTODD?: string;
        companyKeyFeaturesForTODD?: string;
        products?: Array<Record<string, unknown>>;
    };
};

export type DailyMomentumOperatorState = {
    level: 'normal' | 'pressure' | 'critical';
    label: string;
    summary: string;
    urgencyLabel: string;
    strategySummary: string;
    timePressureLine: string;
    recoveryModeActive: boolean;
    volumeModeActive?: boolean;
    closeModeActive?: boolean;
    recoveryModeLabel: string;
    alternativeMove: string;
    interventionMessage: string;
    interventionTriggered: boolean;
    timeOfDay: 'morning' | 'midday' | 'late_day';
    timeLabel: string;
    consecutiveBehindDays: number;
    consecutiveNoRevenueDays: number;
    consecutiveNoOutcomeDays: number;
    decliningActivity: boolean;
    patterns: string[];
    immediateActions: string[];
    profileSummary: string;
    selectedOffer?: ToddSelectedOffer | null;
    selectedTactic?: ToddOfferTactic | null;
};

export type DailyMomentumExecutionRealityStatus = 'not_started' | 'ready' | 'blocked' | 'executing' | 'completed';

export type DailyMomentumExecutionReality = {
    actionName: string;
    executionStatus: DailyMomentumExecutionRealityStatus;
    executionStatusLabel: string;
    reason: string;
    offerContext?: ToddSelectedOffer | null;
    tacticContext?: ToddOfferTactic | null;
};

export type DailyMomentumExecutionTelemetryMetric = {
    label: string;
    value: string;
};

export type DailyMomentumExecutionTelemetry = {
    summary: string;
    urgencyFacts: DailyMomentumExecutionTelemetryMetric[];
    decisionPressure: string;
    nextStep: string;
    activity: DailyMomentumExecutionTelemetryMetric[];
    sourceMix: DailyMomentumExecutionTelemetryMetric[];
    angles: string[];
    iterationStatus: string[];
    conversionLadder: DailyMomentumExecutionTelemetryMetric[];
};

export type DailyMomentumRevenuePathItem = {
    actionName: string;
    executionStatus: DailyMomentumExecutionRealityStatus;
    executionStatusLabel: string;
    reason: string;
    route: string;
    actionPath: string;
    offerContext?: ToddSelectedOffer | null;
    tacticContext?: ToddOfferTactic | null;
};

export type ToddSelectedOffer = {
    offerId: string;
    name: string;
    valueSummary: string;
    priceLabel: string;
    cta: string;
    reasoning: string;
    offerMatch: ToddOfferMatchMode;
};

export type ToddOfferMatchMode = 'free_or_low_friction_offer' | 'subscription_offer' | 'landing_page_offer' | 'any_active_offer';
export type ToddOfferTacticTriggerCondition = 'recoveryMode' | 'noRevenue' | 'lowReplies' | 'middayOrLater';
export type ToddOfferTacticExecutionTarget = 'email' | 'social' | 'landing';
export type ToddOfferTacticPositioningType = 'urgency' | 'bonus' | 'fast_track' | 'diagnostic';

export type ToddOfferTactic = {
    id: string;
    offerMatch: ToddOfferMatchMode;
    label: string;
    triggerConditions: ToddOfferTacticTriggerCondition[];
    executionTarget: ToddOfferTacticExecutionTarget;
    positioningType: ToddOfferTacticPositioningType;
    reasoning: string;
};

type ToddOfferCandidate = ToddSelectedOffer & {
    promotionPriority: number;
    active: boolean;
    discontinued: boolean;
    salesCycle?: 'same_day' | 'short' | 'medium' | 'long';
    fastestClose?: boolean;
    deliveryEffort?: 'low' | 'medium' | 'high';
    relatedCapabilities: string[];
    painsSolved: string[];
    searchText: string;
};

export type DailyMomentumViewModel = {
    briefing: string;
    behaviorEscalation: {
        tone: 'info' | 'positive' | 'attention';
        label: string;
        summary: string;
    } | null;
    operatorState: DailyMomentumOperatorState;
    accountabilityMessage: {
        status: 'behind' | 'on_track' | 'met' | 'unknown';
        headline: string;
        summary: string;
        postureLabel: string;
        postureSummary: string;
        interventionLabel: string;
        interventions: string[];
        reasonsLabel: string;
        preparedLabel: string;
        needsLabel: string;
        reasons: string[];
        prepared: string[];
        needs: string[];
    } | null;
    snapshot: DailyMomentumSnapshot;
    auditTrail: DailyMomentumAuditItem[];
    selectedMove: {
        primary: string;
        reason: string;
        secondary: string;
        route: string;
    };
    executionStatus: DailyMomentumExecutionStatus;
    executionStatusLabel: string;
    executionMode: DailyMomentumExecutionMode;
    executionModeLabel: string;
    executionReality: DailyMomentumExecutionReality;
    executionTelemetry?: DailyMomentumExecutionTelemetry | null;
    revenuePath: {
        primary: DailyMomentumRevenuePathItem;
        backup: DailyMomentumRevenuePathItem | null;
    };
    lastActionTaken: string;
    pendingAction: DailyMomentumPendingAction | null;
    actionsTaken: DailyMomentumActionRow[];
    fallbackActions: DailyMomentumFallbackAction[];
    blockers: string[];
    approvalChecklist: DailyMomentumApprovalChecklist | null;
    approvalPolicySettings: {
        headline: string;
        summary: string;
        categories: DailyMomentumApprovalPolicySetting[];
        modeOptions: DailyMomentumApprovalModeOption[];
        config: DailyMomentumApprovalPolicyConfig;
    };
    primaryCta: DailyMomentumCta | null;
    supportCtas: DailyMomentumSupportCta[];
    stripeConnectionNotice: {
        title: string;
        message: string;
        tone: 'info' | 'attention';
        items?: string[];
        actionLabel?: string;
    } | null;
    calendarConnectionNotice: {
        title: string;
        message: string;
        tone: 'info' | 'attention';
        items?: string[];
        actionLabel?: string;
    } | null;
    decisionState: DailyMomentumDecisionState | null;
    aiRecommendation: {
        headline: string;
        why: string;
        move: string;
        effort: 'low' | 'medium' | 'high';
        speed: 'today' | 'this-week' | 'longer';
        generatedAt: string;
        source: string;
    } | null;
    reasoningContext?: {
        userProfile: DailyMomentumUserProfile | null;
        executionReceipts: MomentumExecutionReceipt[];
        latestReceiptByActionPlan: Record<string, MomentumExecutionReceipt>;
        engineState: ToddMomentumEngineState | null;
        actionPlans: MomentumActionPlan[];
        approvalPendingCount: number;
        blockedActionCount: number;
    };
};

type ToddMomentumBriefing = {
    html: string;
    shouldDisplay: boolean;
    status: 'behind' | 'on_track' | 'met' | 'unknown';
    action: ToddMomentumAction | null;
    approvalChecklist: DailyMomentumApprovalChecklist | null;
};

const toddOfferTactics: ToddOfferTactic[] = [
    {
        id: 'low-friction-diagnostic',
        offerMatch: 'free_or_low_friction_offer',
        label: 'Diagnostic positioning',
        triggerConditions: ['recoveryMode', 'noRevenue', 'lowReplies', 'middayOrLater'],
        executionTarget: 'email',
        positioningType: 'diagnostic',
        reasoning: 'Use low-friction clarity language when replies are weak and the fastest close is a diagnostic offer.'
    },
    {
        id: 'subscription-fast-track',
        offerMatch: 'subscription_offer',
        label: 'Fast-track positioning',
        triggerConditions: ['recoveryMode', 'noRevenue', 'lowReplies', 'middayOrLater'],
        executionTarget: 'email',
        positioningType: 'fast_track',
        reasoning: 'Use speed-to-result framing when TODD needs same-day movement from a low-friction offer.'
    },
    {
        id: 'landing-page-urgency',
        offerMatch: 'landing_page_offer',
        label: 'Urgency positioning',
        triggerConditions: ['recoveryMode', 'noRevenue', 'lowReplies', 'middayOrLater'],
        executionTarget: 'landing',
        positioningType: 'urgency',
        reasoning: 'Use limited-window framing only when recovery pressure is real and revenue is still at zero.'
    }
];

@Injectable( { providedIn: 'root' } )
export class GoalService {
    private readonly dailyRevenueGoalSettingKey = 'dailyRevenueGoalAmount';
    private readonly defaultDailyRevenueGoalAmount = 0;
    private readonly allowedDailyRevenueGoals = new Set( [0, 50, 100, 250, 500, 1000] );

    constructor (
        private http: HttpClient,
        private settingsService: SettingsService
    ) { }

    getDefaultDailyRevenueGoalAmount (): number {
        return this.defaultDailyRevenueGoalAmount;
    }

    getDailyRevenueGoalAmount (): number {
        if ( typeof window !== 'undefined' && ( window as any ).Cypress ) {
            const cypressGoal = Number( window.localStorage?.getItem( '__cypressDailyRevenueGoal' ) || NaN );
            if ( Number.isFinite( cypressGoal ) ) {
                return this.normalizeDailyRevenueGoalAmount( cypressGoal );
            }
        }

        return this.normalizeDailyRevenueGoalAmount(
            this.settingsService.getSettings()?.[this.dailyRevenueGoalSettingKey]
        );
    }

    watchDailyRevenueGoalAmount (): Observable<number> {
        return this.settingsService.settings$.pipe(
            map( settings => this.normalizeDailyRevenueGoalAmount( settings?.[this.dailyRevenueGoalSettingKey] ) ),
            distinctUntilChanged()
        );
    }

    setDailyRevenueGoalAmount ( goalAmount: number ): number {
        const normalized = this.normalizeDailyRevenueGoalAmount( goalAmount );
        this.settingsService.updateSetting( this.dailyRevenueGoalSettingKey, normalized );
        return normalized;
    }

    getTodayKpi ( tenantId: string ) {
        return this.http.get<any>( `${environment.backendURL}/kpi/today`, { params: { tenantId } } );
    }

    getMomentumCheck ( tenantId: string, goalAmount?: number, customerPipelineStep?: string ) {
        const params: Record<string, string> = { tenantId };
        if ( typeof goalAmount === 'number' && Number.isFinite( goalAmount ) ) {
            params['goalAmount'] = String( goalAmount );
        }
        if ( String( customerPipelineStep || '' ).trim() ) {
            params['customerPipelineStep'] = String( customerPipelineStep ).trim();
        }

        return this.http.get<any>( `${environment.backendURL}/momentum/check`, { params } );
    }

    getMomentumHealth ( tenantId: string ) {
        return this.http.get<any>( `${environment.backendURL}/momentum/health`, {
            params: { tenantId }
        } );
    }

    checkMomentumAgain ( tenantId: string ) {
        return this.http.post<any>( `${environment.backendURL}/momentum/check-again`, { tenantId } );
    }

    resetCustomerPipelineTestRun ( tenantId: string ) {
        return this.http.post<any>( `${environment.backendURL}/momentum/customer-pipeline/reset`, { tenantId } );
    }

    getMomentumBootstrap (
        tenantId: string,
        goalAmount?: number,
        options?: {
            activityLimit?: number;
            receiptLimit?: number;
            radarLimit?: number;
            actionPlanLimit?: number;
        }
    ) {
        const params: Record<string, string> = { tenantId };
        if ( typeof goalAmount === 'number' && Number.isFinite( goalAmount ) ) {
            params['goalAmount'] = String( goalAmount );
        }
        if ( typeof options?.activityLimit === 'number' && Number.isFinite( options.activityLimit ) ) {
            params['activityLimit'] = String( options.activityLimit );
        }
        if ( typeof options?.receiptLimit === 'number' && Number.isFinite( options.receiptLimit ) ) {
            params['receiptLimit'] = String( options.receiptLimit );
        }
        if ( typeof options?.radarLimit === 'number' && Number.isFinite( options.radarLimit ) ) {
            params['radarLimit'] = String( options.radarLimit );
        }
        if ( typeof options?.actionPlanLimit === 'number' && Number.isFinite( options.actionPlanLimit ) ) {
            params['actionPlanLimit'] = String( options.actionPlanLimit );
        }

        return this.http.get<any>( `${environment.backendURL}/momentum/bootstrap`, { params } );
    }

    logManualRevenue ( payload: { amount: number; source?: string; note?: string; } ) {
        return this.http.post<any>( `${environment.backendURL}/momentum/revenue-log`, payload );
    }

    logManualAppointment ( payload: {
        tenantId?: string;
        contactId?: string;
        emailAddress?: string;
        appointmentAt?: string;
        source?: string;
        note?: string;
        bookingIntentEventId?: string;
        bookingUrl?: string;
        clickedAt?: string;
        subject?: string;
        sourceSystem?: string;
        threadId?: string;
        campaignId?: string;
        planId?: string;
        strategyId?: string;
        segmentId?: string;
        angleId?: string;
        userId?: string;
    } ) {
        return this.http.post<any>( `${environment.backendURL}/momentum/appointment-log`, payload );
    }

    getMomentumEngineState ( tenantId: string ) {
        return this.http.get<any>( `${environment.backendURL}/momentum/engine-state`, {
            params: { tenantId }
        } );
    }

    getMomentumActivity ( tenantId: string, limit: number = 8 ) {
        return this.http.get<any>( `${environment.backendURL}/momentum/activity`, {
            params: {
                tenantId,
                limit: String( limit )
            }
        } );
    }

    getMomentumRssConfig ( tenantId: string ) {
        return this.http.get<any>( `${environment.backendURL}/momentum/rss-config`, {
            params: { tenantId }
        } );
    }

    updateMomentumRssConfig ( tenantId: string, config: { feedUrls: string[]; enabled?: boolean; } ) {
        return this.http.post<any>( `${environment.backendURL}/momentum/rss-config`, {
            tenantId,
            ...config
        } );
    }

    updateMomentumApprovalPolicy ( tenantId: string, category: string, mode: DailyMomentumExecutionMode ) {
        return this.http.post<any>( `${environment.backendURL}/momentum/approval-policy`, {
            tenantId,
            category,
            mode
        } );
    }

    updateMomentumApprovalPolicyConfig ( tenantId: string, config: {
        dailyDraftTarget?: number | null;
        dailyAutoSendTarget?: number | null;
    } ) {
        return this.http.post<any>( `${environment.backendURL}/momentum/approval-policy/config`, {
            tenantId,
            ...config
        } );
    }

    updateMomentumExecutionPosture ( tenantId: string, mode: DailyMomentumExecutionPostureMode ) {
        return this.http.post<any>( `${environment.backendURL}/momentum/execution-posture`, {
            tenantId,
            mode
        } );
    }

    getMomentumOperatorConfig ( tenantId: string ) {
        return this.http.get<any>( `${environment.backendURL}/momentum/operator-config`, {
            params: { tenantId }
        } );
    }

    getLatestMayaOutreachBatch ( tenantId: string ) {
        return this.http.get<{ success: boolean; message: string; data: { tenantId: string; batch: MayaOutreachBatch | null; }; }>(
            `${environment.backendURL}/momentum/maya-batches/latest`,
            {
                params: { tenantId }
            }
        );
    }

    getMayaOutreachBatch ( tenantId: string, batchId: string ) {
        return this.http.get<{ success: boolean; message: string; data: { tenantId: string; batch: MayaOutreachBatch | null; }; }>(
            `${environment.backendURL}/momentum/maya-batches/${encodeURIComponent( String( batchId || '' ).trim() )}`,
            {
                params: { tenantId }
            }
        );
    }

    updateMomentumOperatorConfig ( tenantId: string, patch: {
        dailyGoalAmount?: number;
        maya?: {
            enabled?: boolean;
            timezone?: string;
            startHour?: number;
            socialDraftingEnabled?: boolean;
            socialAutoApprove?: boolean;
            emailDraftingEnabled?: boolean;
            noonAutoReleaseEnabled?: boolean;
        };
        emailResponder?: {
            enabled?: boolean;
            mode?: 'off' | 'draft_only' | 'auto_respond' | string;
            allowAlreadyAnsweredMessages?: boolean;
        };
    } ) {
        return this.http.post<any>( `${environment.backendURL}/momentum/operator-config`, {
            tenantId,
            ...patch
        } );
    }

    approveMomentumActionPlan ( tenantId: string, actionPlanId: string ) {
        return this.http.post<any>( `${environment.backendURL}/momentum/action-plans/${actionPlanId}/approve`, {
            tenantId
        } );
    }

    openMomentumActionPlan ( tenantId: string, actionPlanId: string ) {
        return this.http.post<any>( `${environment.backendURL}/momentum/action-plans/${actionPlanId}/open`, {
            tenantId
        } );
    }

    dismissMomentumActionPlan ( tenantId: string, actionPlanId: string ) {
        return this.http.post<any>( `${environment.backendURL}/momentum/action-plans/${actionPlanId}/dismiss`, {
            tenantId
        } );
    }

    submitMomentumActionFeedback ( tenantId: string, actionPlanId: string, payload: MomentumOperatorFeedbackRequest ) {
        return this.http.post<any>( `${environment.backendURL}/momentum/action-plans/${actionPlanId}/feedback`, {
            tenantId,
            ...payload
        } );
    }

    submitMomentumOperatorFeedback (
        tenantId: string,
        target: MomentumOperatorFeedbackTarget,
        payload: MomentumOperatorFeedbackRequest
    ) {
        return this.http.post<any>( `${environment.backendURL}/momentum/operator-feedback`, {
            tenantId,
            target,
            ...payload
        } );
    }

    completeMomentumActionPlan (
        tenantId: string,
        actionPlanId: string,
        payload: { reviewRoute?: string; draftCount?: number; postIds?: string[]; } = {}
    ) {
        return this.http.post<any>( `${environment.backendURL}/momentum/action-plans/${actionPlanId}/complete`, {
            tenantId,
            ...payload
        } );
    }

    startStripeConnect ( frontendPath: string = '/daily-momentum' ) {
        return this.http.post<any>( `${environment.backendURL}/momentum/integrations/stripe/connect`, { frontendPath } );
    }

    getStripeConnectionStatus () {
        return this.http.get<any>( `${environment.backendURL}/momentum/integrations/stripe/status` );
    }

    openStripeDashboard () {
        return this.http.post<any>( `${environment.backendURL}/momentum/integrations/stripe/dashboard`, {} );
    }

    startCalendarConnect ( frontendPath: string = '/daily-momentum' ) {
        return this.http.get<any>( `${environment.backendURL}/momentum/integrations/calendar/connect`, {
            params: { frontendPath }
        } );
    }

    getCalendarConnectionStatus () {
        return this.http.get<any>( `${environment.backendURL}/momentum/integrations/calendar/status` );
    }

    previewToddMissionPlan ( payload: ToddMissionIntake ) {
        return this.http.post<{ success: boolean; data: ToddMissionRecord; }>(
            `${environment.backendURL}/missions/plan`,
            payload
        );
    }

    createToddMission ( payload: ToddMissionIntake ) {
        return this.http.post<{ success: boolean; data: ToddMissionRecord; }>(
            `${environment.backendURL}/missions`,
            payload
        );
    }

    updateToddMission ( missionId: string, payload: Partial<ToddMissionIntake> & { status?: string; } ) {
        return this.http.put<{ success: boolean; data: ToddMissionRecord; }>(
            `${environment.backendURL}/missions/${missionId}`,
            payload
        );
    }

    previewToddMissionRevision ( missionId: string, payload: Partial<ToddMissionIntake> ) {
        return this.http.post<{ success: boolean; data: ToddMissionRecord; }>(
            `${environment.backendURL}/missions/${missionId}/revision-preview`,
            payload
        );
    }

    applyToddMissionRevision ( missionId: string, payload: Partial<ToddMissionIntake>, applyNetNewMoves: boolean ) {
        return this.http.post<{ success: boolean; data: ToddMissionRecord; }>(
            `${environment.backendURL}/missions/${missionId}/revisions/apply`,
            {
                payload,
                applyNetNewMoves
            }
        );
    }

    updateToddMissionStatus ( missionId: string, status: string ) {
        return this.http.post<{ success: boolean; data: ToddMissionRecord; }>(
            `${environment.backendURL}/missions/${missionId}/status`,
            { status }
        );
    }

    listToddMissions () {
        return this.http.get<{ success: boolean; data: ToddMissionRecord[]; }>(
            `${environment.backendURL}/missions`
        );
    }

    getToddMission ( missionId: string ) {
        return this.http.get<{ success: boolean; data: ToddMissionRecord; }>(
            `${environment.backendURL}/missions/${missionId}`
        );
    }

    requestNextStrategy ( body: { tenantId: string; goalAmount?: number; goalAppointments?: number; enqueue?: boolean; } ) {
        return this.http.post<any>( `${environment.backendURL}/strategy/next`, body );
    }

    private normalizeDailyRevenueGoalAmount ( value: unknown ): number {
        const numericValue = Number( value );
        if ( Number.isFinite( numericValue ) && this.allowedDailyRevenueGoals.has( numericValue ) ) {
            return numericValue;
        }

        return this.defaultDailyRevenueGoalAmount;
    }

    formatMomentumAssistantResponse ( response: any ): { html: string; shouldOfferNextMove: boolean; } {
        const payload = this.unwrapMomentumPayload( response );
        const goalStatus = payload.goalStatus || {};
        const strategy = payload.strategy || {};
        const blockers = Array.isArray( payload.blockers ) ? payload.blockers : [];
        const executionSuggestions = Array.isArray( payload.executionSuggestions ) ?
            payload.executionSuggestions :
            [];

        const lines: string[] = [
            `<div><strong>Today's goal is ${this.formatMoney( goalStatus.goal || 0 )}.</strong></div>`,
            `<div>We have made ${this.formatMoney( goalStatus.revenue || 0 )} so far.</div>`,
            `<div>${this.buildGapLine( goalStatus )}</div>`,
            `<div><strong>Status:</strong> ${this.formatStatus( goalStatus.status )}.</div>`
        ];

        if ( blockers.length > 0 ) {
            lines.push( '<div style="margin-top:10px;"><strong>Blockers</strong></div>' );
            lines.push( `<ul>${blockers.map( ( blocker ) => `<li>${this.escapeHtml( blocker.message || 'Unknown blocker.' )}</li>` ).join( '' )}</ul>` );
        }

        if ( strategy.summary || strategy.explanation || strategy.recommendedAction ) {
            lines.push( '<div style="margin-top:10px;"><strong>Strategy</strong></div>' );
            if ( strategy.summary ) {
                lines.push( `<div>${this.escapeHtml( strategy.summary )}</div>` );
            }
            if ( strategy.explanation ) {
                lines.push( `<div>${this.escapeHtml( strategy.explanation )}</div>` );
            }
            if ( strategy.recommendedAction ) {
                lines.push( `<div><strong>Next move:</strong> ${this.escapeHtml( strategy.recommendedAction )}</div>` );
            }
        }

        if ( executionSuggestions.length > 0 ) {
            lines.push( '<div style="margin-top:10px;"><strong>Execution suggestions</strong></div>' );
            lines.push( `<ul>${executionSuggestions.map( ( suggestion ) => this.formatExecutionSuggestion( suggestion ) ).join( '' )}</ul>` );
        }

        return {
            html: lines.join( '' ),
            shouldOfferNextMove: String( goalStatus.status || '' ).toLowerCase() === 'behind'
        };
    }

    formatToddHomeMomentumBriefing ( response: any ): ToddMomentumBriefing {
        const payload = this.unwrapMomentumPayload( response );
        const goalStatus = payload.goalStatus || {};
        const strategy = payload.strategy || {};
        const blockers = Array.isArray( payload.blockers ) ? payload.blockers : [];
        const rawExecutionSuggestions = Array.isArray( payload.executionSuggestions )
            ? payload.executionSuggestions
            : [];
        const actionPlans = this.getMomentumActionPlans( payload );
        const executionReceipts = this.getMomentumExecutionReceipts( payload );
        const latestReceiptByActionPlan = this.getLatestReceiptByActionPlan( payload, executionReceipts );
        const executionSuggestions = actionPlans.length > 0
            ? this.buildExecutionSuggestionsFromActionPlans( actionPlans, latestReceiptByActionPlan, rawExecutionSuggestions )
            : rawExecutionSuggestions;
        const status = this.normalizeMomentumStatus( goalStatus.status );
        const configuredGoal = Math.max( Number( this.getDailyRevenueGoalAmount() || 0 ), 0 );
        const numericGoal = configuredGoal;
        const numericRevenue = Math.max( Number( goalStatus.revenue || 0 ), 0 );
        const numericGap = numericGoal > 0 ? Math.max( Number( goalStatus.gap || 0 ), 0 ) : 0;
        const calendarVerification = this.getCalendarVerification( goalStatus );
        const nextAction = this.buildToddNextAction( strategy, executionSuggestions[0] || null );
        const blockerMessages = this.buildBusinessBlockerMessages( goalStatus, blockers, strategy, executionSuggestions, actionPlans, executionReceipts, nextAction, payload.rssConfig, payload.socialQueueSummary );

        if ( numericGoal <= 0 ) {
            return {
                status: 'unknown',
                shouldDisplay: false,
                action: null,
                approvalChecklist: null,
                html: ''
            };
        }

        if ( status === 'met' ) {
            const calendarLine = calendarVerification.status !== 'connected'
                ? `<div style="margin-top:10px;">${this.escapeHtml( calendarVerification.message )}</div>`
                : '';
            return {
                status,
                shouldDisplay: true,
                action: null,
                approvalChecklist: null,
                html: [
                    '<div><strong>Daily momentum briefing</strong></div>',
                    `<div>You already covered today&apos;s goal of <strong>${this.formatMoney( numericGoal )}</strong> with <strong>${this.formatMoney( numericRevenue )}</strong> in revenue.</div>`,
                    calendarLine,
                    strategy.summary
                        ? `<div style="margin-top:10px;">${this.escapeHtml( strategy.summary )}</div>`
                        : '<div style="margin-top:10px;">Momentum is on track, so we can focus on protecting the win and improving quality.</div>'
                ].filter( Boolean ).join( '' )
            };
        }

        if (
            status !== 'behind'
            && blockers.length === 0
            && !strategy.summary
            && !strategy.explanation
            && !nextAction
        ) {
            return {
                status,
                shouldDisplay: false,
                action: null,
                approvalChecklist: null,
                html: ''
            };
        }

        const lines: string[] = [
            '<div><strong>Daily momentum briefing</strong></div>',
            `<div><strong>Today&apos;s goal:</strong> ${this.formatMoney( numericGoal )}</div>`,
            `<div><strong>Revenue so far:</strong> ${this.formatMoney( numericRevenue )}</div>`,
            `<div><strong>Gap:</strong> ${this.formatMoney( numericGap )}</div>`,
            '<div style="margin-top:10px;"><strong>We are behind today, so here is what needs attention right now.</strong></div>'
        ];

        if ( calendarVerification.status !== 'connected' ) {
            lines.push( `<div style="margin-top:10px;"><strong>Meeting tracking:</strong> ${this.escapeHtml( calendarVerification.message )}</div>` );
        }

        if ( blockers.length > 0 ) {
            lines.push( '<div style="margin-top:10px;"><strong>What is missing</strong></div>' );
            lines.push(
                `<ul>${blockers.map( ( blocker ) => `<li>${this.escapeHtml( blocker.message || 'A required input or dependency is still missing.' )}</li>` ).join( '' )}</ul>`
            );
        }

        if ( strategy.summary || strategy.explanation ) {
            lines.push( '<div style="margin-top:10px;"><strong>Strategy summary</strong></div>' );
            if ( strategy.summary ) {
                lines.push( `<div>${this.escapeHtml( strategy.summary )}</div>` );
            }
            if ( strategy.explanation ) {
                lines.push( `<div>${this.escapeHtml( strategy.explanation )}</div>` );
            }
        }

        if ( nextAction ) {
            lines.push( `<div style="margin-top:10px;"><strong>Next action:</strong> ${this.escapeHtml( nextAction.detail )}</div>` );

            if ( nextAction.actionPath ) {
                lines.push( `<div><strong>Action path:</strong> ${this.escapeHtml( nextAction.actionPath )}</div>` );
            }
        }

        const approvalChecklist = this.buildDailyMomentumApprovalChecklist(
            goalStatus,
            strategy,
            executionSuggestions,
            blockerMessages,
            nextAction,
            false,
            null,
            payload.approvalPolicy,
            payload.socialQueueSummary
        );

        return {
            status,
            shouldDisplay: true,
            action: nextAction,
            approvalChecklist,
            html: lines.join( '' )
        };
    }

    formatMissionAssistantResponse ( response: { data?: ToddMissionRecord; } | ToddMissionRecord | null | undefined ): { html: string; nextMoveLabel: string; } {
        const mission = this.unwrapMissionPayload( response );
        const plan = mission?.plan || {};
        const summary = plan.projectSummary || mission?.intake?.desiredOutcome || 'Mission plan ready.';
        const successCriteria = Array.isArray( plan.successCriteria ) ? plan.successCriteria : [];
        const risks = Array.isArray( mission?.risks ) ? mission?.risks : [];
        const nextMove = plan.nextRecommendedMove?.label || 'Review the first planned Move';
        const progress = mission?.progress;

        const lines: string[] = [
            `<div><strong>${this.escapeHtml( mission?.title || 'Mission plan' )}</strong></div>`,
            `<div>${this.escapeHtml( summary )}</div>`
        ];

        if ( progress && typeof progress.totalCount === 'number' ) {
            lines.push(
                `<div><strong>Moves:</strong> ${progress.completedCount || 0} of ${progress.totalCount} complete.</div>`
            );
        }

        if ( successCriteria.length > 0 ) {
            lines.push( '<div style="margin-top:10px;"><strong>Success criteria</strong></div>' );
            lines.push( `<ul>${successCriteria.map( item => `<li>${this.escapeHtml( item )}</li>` ).join( '' )}</ul>` );
        }

        if ( risks.length > 0 ) {
            lines.push( '<div style="margin-top:10px;"><strong>Risks</strong></div>' );
            lines.push( `<ul>${risks.map( item => `<li>${this.escapeHtml( item )}</li>` ).join( '' )}</ul>` );
        }

        lines.push( `<div style="margin-top:10px;"><strong>Next move:</strong> ${this.escapeHtml( nextMove )}</div>` );

        return {
            html: lines.join( '' ),
            nextMoveLabel: nextMove
        };
    }

    buildDailyMomentumViewModel (
        response: any,
        persistedDecision?: DailyMomentumDecisionState | null,
        context?: {
            now?: Date;
            userProfile?: DailyMomentumUserProfile | null;
            history?: DailyMomentumHistoryEntry[];
        }
    ): DailyMomentumViewModel {
        const payload = this.unwrapMomentumPayload( response );
        const goalStatus = payload.goalStatus || {};
        const strategy = payload.strategy || {};
        const blockers = Array.isArray( payload.blockers ) ? payload.blockers : [];
        const rawExecutionSuggestions = Array.isArray( payload.executionSuggestions )
            ? payload.executionSuggestions
            : [];
        const actionPlans = this.getMomentumActionPlans( payload );
        const executionReceipts = this.getMomentumExecutionReceipts( payload );
        const latestReceiptByActionPlan = this.getLatestReceiptByActionPlan( payload, executionReceipts );
        const preliminaryEscalationLevel = this.resolveMomentumEscalationPreference(
            this.normalizeMomentumStatus( goalStatus.status ),
            context?.history,
            context?.now,
            goalStatus
        );
        const executionAccountabilityMode = this.shouldForceExecutionAccountability(
            this.normalizeMomentumStatus( goalStatus.status ),
            goalStatus,
            context?.now
        );
        const prioritizedRawExecutionSuggestions = this.prioritizeExecutionSuggestions(
            rawExecutionSuggestions,
            preliminaryEscalationLevel,
            executionAccountabilityMode
        );
        const executionSuggestions = actionPlans.length > 0
            ? this.buildExecutionSuggestionsFromActionPlans( actionPlans, latestReceiptByActionPlan )
            : prioritizedRawExecutionSuggestions;
        const prioritizedExecutionSuggestions = this.prioritizeExecutionSuggestions(
            executionSuggestions,
            preliminaryEscalationLevel,
            executionAccountabilityMode
        );
        const selectedSuggestions = this.selectRevenuePathSuggestions( prioritizedExecutionSuggestions, executionAccountabilityMode );
        const primarySuggestion = selectedSuggestions.primary;
        const backupSuggestion = selectedSuggestions.backup;
        const primaryActionPlan = actionPlans.find( actionPlan =>
            String( actionPlan.id || '' ).trim() === String( primarySuggestion?.actionPlanId || '' ).trim()
        ) || actionPlans[0] || null;
        const status = this.normalizeMomentumStatus( goalStatus.status );
        const nextAction = this.buildToddNextAction( strategy, primarySuggestion );
        const secondarySuggestion = this.buildSecondarySuggestion( backupSuggestion, nextAction );
        const blockerMessages = this.buildBusinessBlockerMessages( goalStatus, blockers, strategy, prioritizedExecutionSuggestions, actionPlans, executionReceipts, nextAction, payload.rssConfig, payload.socialQueueSummary );
        const appointmentMetric = this.buildAppointmentMetric( goalStatus );
        const stripeConnectionNotice = this.buildStripeConnectionNotice( goalStatus, blockerMessages );
        const calendarConnectionNotice = this.buildCalendarConnectionNotice( goalStatus, blockerMessages );
        const supportCtas = this.buildSupportCtas( goalStatus, stripeConnectionNotice );
        const reason = String( strategy.explanation || strategy.summary || '' ).trim()
            || this.buildDefaultReason( status, blockerMessages );
        const executionStatus = this.resolveDailyMomentumExecutionStatus( status, nextAction, blockerMessages, persistedDecision, primarySuggestion || undefined );
        const executionMode = this.resolveDailyMomentumExecutionMode( executionStatus, nextAction, persistedDecision, primaryActionPlan );
        const selectedMove = persistedDecision?.selectedMove || nextAction?.detail || 'TODD is executing the strongest available path right now.';
        const selectedMoveTitle = persistedDecision?.selectedMoveTitle || nextAction?.title || 'Strongest next move';
        const selectedMoveRoute = persistedDecision?.route || nextAction?.route || '';
        const actionsTaken = this.buildDailyMomentumActionsTaken( prioritizedExecutionSuggestions, nextAction, blockerMessages, executionStatus, persistedDecision, payload.socialQueueSummary );
        const operatorState = this.buildDailyMomentumOperatorState(
            goalStatus,
            status,
            actionsTaken,
            blockerMessages,
            context?.history,
            context?.now,
            context?.userProfile || null
        );
        const currentHistoryEntry: DailyMomentumHistoryEntry = {
            dateKey: this.toDateKey( context?.now instanceof Date && !Number.isNaN( context.now.getTime() ) ? context.now : new Date() ),
            goalAmount: Number( goalStatus.goal || 0 ),
            revenue: Number( goalStatus.revenue || 0 ),
            gap: Number( goalStatus.gap || 0 ),
            status,
            actionCount: actionsTaken.length,
            successfulOutcomeCount: actionsTaken.filter( action => ['completed', 'auto_executed'].includes( action.state ) ).length,
            appointmentCount: Number( goalStatus.appointmentsSoFar || goalStatus.appointmentCount || goalStatus.appointments || 0 )
        };
        const offerContext = this.selectBestOffer(
            context?.userProfile || null,
            operatorState,
            blockerMessages,
            this.normalizeMomentumHistory( context?.history, currentHistoryEntry )
        );
        operatorState.selectedOffer = offerContext;
        const tacticContext = this.selectBestOfferTactic( offerContext, operatorState, goalStatus, blockerMessages );
        operatorState.selectedTactic = tacticContext;
        const offerDrivenSuggestions = this.decorateExecutionSuggestionsWithOffer( prioritizedExecutionSuggestions, offerContext, tacticContext, operatorState.recoveryModeActive );
        const offerDrivenNextAction = this.decorateToddNextActionWithOffer( nextAction, offerContext, tacticContext, operatorState.recoveryModeActive );
        const offerDrivenActionsTaken = this.buildDailyMomentumActionsTaken( offerDrivenSuggestions, offerDrivenNextAction, blockerMessages, executionStatus, persistedDecision, payload.socialQueueSummary );
        const offerDrivenLastActionTaken = this.resolveLastActionTaken( executionStatus, offerDrivenActionsTaken, blockerMessages, persistedDecision, offerContext );
        const offerDrivenPendingAction = this.buildPendingAction( executionStatus, offerDrivenNextAction, blockerMessages, operatorState.closeModeActive === true, persistedDecision, offerContext );
        const offerDrivenFallbackActions = this.buildFallbackActions( blockerMessages, offerDrivenActionsTaken, offerDrivenNextAction, offerDrivenSuggestions, offerContext );
        const approvalChecklist = this.buildDailyMomentumApprovalChecklist(
            goalStatus,
            strategy,
            offerDrivenSuggestions,
            blockerMessages,
            offerDrivenNextAction,
            operatorState.closeModeActive === true,
            persistedDecision,
            payload.approvalPolicy,
            payload.socialQueueSummary
        );
        const approvalPolicySettings = this.buildApprovalPolicySettings( payload.approvalPolicy );
        const primaryCta = this.buildPrimaryCta( executionStatus, offerDrivenNextAction, blockerMessages, offerDrivenPendingAction, payload.socialQueueSummary, persistedDecision, actionPlans );
        const decisionState = this.buildDecisionState(
            selectedMove,
            selectedMoveTitle,
            executionStatus,
            offerDrivenLastActionTaken,
            selectedMoveRoute,
            persistedDecision?.actionPath || offerDrivenNextAction?.actionPath || '',
            offerDrivenPendingAction
        );
        const accountabilityMessage = this.buildDailyMomentumAccountabilityMessage(
            status,
            goalStatus,
            blockerMessages,
            offerDrivenActionsTaken,
            executionMode,
            offerDrivenNextAction,
            operatorState,
            offerDrivenFallbackActions
        );
        const executionReality = this.buildExecutionReality( offerDrivenSuggestions[0] || primarySuggestion, offerDrivenNextAction, executionStatus, blockerMessages, executionAccountabilityMode, operatorState.closeModeActive === true, offerContext, tacticContext );
        const executionTelemetry = this.buildExecutionTelemetry(
            offerDrivenSuggestions[0] || primarySuggestion,
            offerDrivenActionsTaken[0] || null,
            goalStatus,
            blockerMessages,
            operatorState,
            executionStatus
        );
        const revenuePath = this.buildRevenuePath( offerDrivenSuggestions[0] || primarySuggestion, offerDrivenSuggestions[1] || backupSuggestion, offerDrivenNextAction, blockerMessages, executionStatus, executionAccountabilityMode, operatorState.closeModeActive === true, offerContext, tacticContext );
        const behaviorEscalation = operatorState.level !== 'normal' || operatorState.interventionTriggered
            ? {
                tone: ( operatorState.level === 'critical' || operatorState.interventionTriggered ? 'attention' : 'info' ) as 'info' | 'attention',
                label: operatorState.label,
                summary: operatorState.summary
            }
            : payload.behaviorContext?.escalationLabel && payload.behaviorContext?.escalationSummary
                ? {
                    tone: payload.behaviorContext.tone || 'info',
                    label: payload.behaviorContext.escalationLabel,
                    summary: payload.behaviorContext.escalationSummary
                }
                : null;
        const momentumScore = this.buildMomentumScoreSnapshot( goalStatus, strategy, payload.engineState || null, actionPlans, executionReceipts );
        const configuredGoal = Math.max( Number( this.getDailyRevenueGoalAmount() || 0 ), 0 );
        const effectiveGoal = configuredGoal;
        const effectiveRevenue = Math.max( Number( goalStatus.revenue || 0 ), 0 );
        const effectiveGap = effectiveGoal > 0 ? Math.max( Number( goalStatus.gap || 0 ), 0 ) : 0;
        const effectiveGoalStatus: MomentumGoalStatus = {
            ...goalStatus,
            goal: effectiveGoal,
            revenue: effectiveRevenue,
            gap: effectiveGap
        };
        const revenueScorePercent = this.getSafePercent( effectiveRevenue, effectiveGoal );

        return {
            briefing: this.buildDailyMomentumBriefingText( effectiveGoalStatus, status, selectedMoveTitle, selectedMove, offerDrivenLastActionTaken, offerDrivenPendingAction, executionMode, operatorState, offerDrivenFallbackActions, offerContext, tacticContext ),
            behaviorEscalation,
            operatorState,
            accountabilityMessage,
            snapshot: {
                goalAmount: this.formatMoney( effectiveGoal ),
                revenueSoFar: this.formatMoney( effectiveRevenue ),
                gapRemaining: this.formatMoney( effectiveGap ),
                revenueScoreLabel: `${revenueScorePercent}%`,
                revenueScorePercent,
                momentumScoreLabel: `${momentumScore.percent}%`,
                momentumScorePercent: momentumScore.percent,
                momentumScoreSummary: momentumScore.summary,
                appointmentMetricLabel: appointmentMetric.label,
                appointmentMetricValue: appointmentMetric.value,
                appointmentMetricNote: appointmentMetric.note,
                appointmentMetricState: appointmentMetric.state,
                status,
                statusLabel: this.formatStatus( goalStatus.status )
            },
            auditTrail: this.buildDailyMomentumAuditTrail( goalStatus, strategy, offerDrivenSuggestions, blockerMessages ),
            selectedMove: {
                primary: operatorState.recoveryModeActive
                    ? `Current path: ${this.resolveRevenuePathLabel( offerDrivenSuggestions[0] || primarySuggestion, offerDrivenNextAction, executionAccountabilityMode, offerContext ) || selectedMoveTitle}`
                    : this.decorateSelectedMoveText( selectedMove, offerContext, tacticContext, operatorState.recoveryModeActive ),
                reason: this.buildExecutionFirstReason( executionStatus, offerDrivenActionsTaken, reason, offerContext ),
                secondary: operatorState.alternativeMove || secondarySuggestion,
                route: selectedMoveRoute
            },
            executionStatus,
            executionStatusLabel: this.formatExecutionStatusLabel( executionStatus ),
            executionMode,
            executionModeLabel: this.formatExecutionModeLabel( executionMode ),
            executionReality,
            executionTelemetry,
            revenuePath,
            lastActionTaken: offerDrivenLastActionTaken,
            pendingAction: offerDrivenPendingAction,
            actionsTaken: offerDrivenActionsTaken,
            fallbackActions: offerDrivenFallbackActions,
            blockers: blockerMessages,
            approvalChecklist,
            approvalPolicySettings,
            primaryCta,
            supportCtas,
            stripeConnectionNotice,
            calendarConnectionNotice,
            decisionState,
            aiRecommendation: this.extractAIRecommendation( payload.strategy ),
            reasoningContext: {
                userProfile: context?.userProfile || null,
                executionReceipts,
                latestReceiptByActionPlan,
                engineState: payload.engineState || null,
                actionPlans,
                approvalPendingCount: actionPlans.filter( actionPlan => String( actionPlan?.status || '' ).trim().toLowerCase() === 'waiting_for_approval' ).length,
                blockedActionCount: actionPlans.filter( actionPlan => String( actionPlan?.status || '' ).trim().toLowerCase() === 'blocked' ).length
            }
        };
    }

    private getSafePercent ( value: number, total: number ): number {
        const safeValue = Number.isFinite( value ) ? value : 0;
        const safeTotal = Number.isFinite( total ) ? total : 0;
        if ( safeTotal <= 0 ) return 0;
        return Math.max( 0, Math.min( 100, Math.round( ( safeValue / safeTotal ) * 100 ) ) );
    }

    private buildMomentumScoreSnapshot (
        goalStatus: MomentumGoalStatus,
        strategy: MomentumStrategy,
        engineState: ToddMomentumEngineState | null,
        actionPlans: MomentumActionPlan[],
        executionReceipts: MomentumExecutionReceipt[]
    ): { percent: number; summary: string; } {
        const strategySignals = ( strategy?.strategySignals || strategy?.signals || {} ) as Record<string, unknown>;
        const signalCount = ( key: string ): number => Number( strategySignals[key] || 0 );
        const socialOutcome = engineState?.channelOutcomes?.social || null;
        const outboxOutcome = engineState?.channelOutcomes?.outbox || null;
        const bookings = Math.max(
            Number( goalStatus?.appointmentsSoFar || 0 ),
            Number( goalStatus?.appointmentCount || 0 ),
            Number( goalStatus?.appointments || 0 ),
            signalCount( 'appointmentSignalsToday' )
        );
        const closeModeMovement = actionPlans.filter( plan => /close_mode|close mode|proposal|offer/i.test(
            `${plan?.type || ''} ${plan?.summary || ''} ${plan?.payload?.['title'] || ''}`
        ) ).length;
        const approvals = Math.max(
            signalCount( 'approvalSignalsToday' ),
            actionPlans.filter( plan => ['waiting_for_approval', 'approval_needed'].includes( String( plan?.status || '' ).trim() ) ).length
        );
        const socialPublished = Number( socialOutcome?.publishedCount || 0 );
        const socialEngagements = signalCount( 'socialEngagementSignalsToday' );
        const emailOpens = signalCount( 'emailOpenSignalsToday' );
        const emailClicks = signalCount( 'emailClickSignalsToday' );
        const replies = Number( strategySignals['repliesToday'] || 0 );
        const visits = Math.max(
            signalCount( 'websiteSessions30d' ) > 0 ? 1 : 0,
            Math.min( signalCount( 'websiteSessions30d' ), 5 )
        );
        const visitorIntent = Math.min(
            signalCount( 'websiteCtaClicks30d' ) +
            signalCount( 'websiteReturningVisitors30d' ) +
            ( signalCount( 'websiteAvgDwellTimeMs30d' ) >= 45000 ? 1 : 0 ),
            6
        );
        const outboxSends = Number( outboxOutcome?.sentCount || 0 );
        const receiptsCompleted = executionReceipts.filter( receipt => /completed|executed/i.test( String( receipt?.status || '' ) ) ).length;

        const rawScore =
            Math.min( emailOpens, 3 ) * 4 +
            Math.min( emailClicks, 2 ) * 8 +
            Math.min( replies, 2 ) * 12 +
            Math.min( visits, 5 ) * 2 +
            visitorIntent * 2 +
            Math.min( socialPublished, 2 ) * 10 +
            Math.min( socialEngagements, 2 ) * 6 +
            Math.min( bookings, 2 ) * 12 +
            Math.min( approvals, 2 ) * 4 +
            Math.min( closeModeMovement, 2 ) * 8 +
            Math.min( outboxSends + receiptsCompleted, 4 ) * 3;
        const percent = Math.max( 0, Math.min( 100, Math.round( rawScore ) ) );

        const summaryParts = [
            emailClicks > 0 ? `${emailClicks} click${emailClicks === 1 ? '' : 's'}` : '',
            replies > 0 ? `${replies} repl${replies === 1 ? 'y' : 'ies'}` : '',
            signalCount( 'websiteSessions30d' ) > 0 ? `${signalCount( 'websiteSessions30d' )} visits` : '',
            socialPublished > 0 ? `${socialPublished} social publish${socialPublished === 1 ? '' : 'es'}` : '',
            bookings > 0 ? `${bookings} booking${bookings === 1 ? '' : 's'}` : '',
            closeModeMovement > 0 ? `${closeModeMovement} close-mode move${closeModeMovement === 1 ? '' : 's'}` : ''
        ].filter( Boolean );

        return {
            percent,
            summary: summaryParts.length > 0
                ? `Credits live movement from ${summaryParts.join( ', ' )}.`
                : 'Credits opens, clicks, visits, social motion, bookings, approvals, and close-mode movement when they appear.'
        };
    }

    private extractAIRecommendation ( strategy: any ): DailyMomentumViewModel['aiRecommendation'] {
        const raw = strategy?.aiRecommendation;
        if ( !raw || !raw.headline || !raw.move ) {
            return null;
        }
        const effort = String( raw.effort || '' ).trim().toLowerCase();
        const speed = String( raw.speed || '' ).trim().toLowerCase();
        return {
            headline: String( raw.headline || '' ).trim(),
            why: String( raw.why || '' ).trim(),
            move: String( raw.move || '' ).trim(),
            effort: ( effort === 'low' || effort === 'medium' || effort === 'high' ) ? effort : 'medium',
            speed: ( speed === 'today' || speed === 'this-week' || speed === 'longer' ) ? speed : 'today',
            generatedAt: String( raw.generatedAt || '' ).trim(),
            source: String( raw.source || '' ).trim(),
        };
    }

    private unwrapMomentumPayload ( response: any ): MomentumPayload {
        if ( response && typeof response === 'object' && response.data ) {
            return response.data;
        }

        return response || {};
    }

    private unwrapMissionPayload ( response: { data?: ToddMissionRecord; } | ToddMissionRecord | null | undefined ): ToddMissionRecord | null {
        if ( response && typeof response === 'object' && 'data' in response && response.data ) {
            return response.data;
        }

        if ( response && typeof response === 'object' ) {
            return response as ToddMissionRecord;
        }

        return null;
    }

    private getMomentumActionPlans ( payload: MomentumPayload ): MomentumActionPlan[] {
        return Array.isArray( payload.actionPlans ) ? payload.actionPlans : [];
    }

    private getMomentumExecutionReceipts ( payload: MomentumPayload ): MomentumExecutionReceipt[] {
        return Array.isArray( payload.executionReceipts ) ? payload.executionReceipts : [];
    }

    private buildApprovalPolicySettings ( approvalPolicy?: MomentumApprovalPolicy ): {
        headline: string;
        summary: string;
        categories: DailyMomentumApprovalPolicySetting[];
        modeOptions: DailyMomentumApprovalModeOption[];
        config: DailyMomentumApprovalPolicyConfig;
    } {
        const categoryDefinitions: Array<{ key: string; label: string; description: string; }> = [
            {
                key: 'outreach_drafting',
                label: 'Outreach drafting',
                description: 'TODD prepares campaign copy, selects contacts, and gets outreach ready for review.'
            },
            {
                key: 'outreach_sending',
                label: 'Outreach sending',
                description: 'TODD sends or queues outreach after the campaign is ready.'
            },
            {
                key: 'lead_addition',
                label: 'Lead addition',
                description: 'TODD adds approved leads into the contact store so they can be worked immediately.'
            },
            {
                key: 'social_drafting',
                label: 'Social drafting',
                description: 'TODD creates LinkedIn and Threads drafts based on today’s goal and gaps.'
            },
            {
                key: 'social_posting',
                label: 'Social posting',
                description: 'TODD publishes approved social posts when the policy allows it.'
            },
            {
                key: 'contact_reactivation',
                label: 'Contact reactivation',
                description: 'TODD prepares stale contacts for reactivation and follow-up.'
            },
            {
                key: 'page_optimization',
                label: 'Page optimization',
                description: 'TODD prepares page improvement suggestions when conversion signals are weak.'
            }
        ];

        const modeOptions: DailyMomentumApprovalModeOption[] = [
            {
                value: 'manual',
                label: 'Manual',
                description: 'TODD will not act unless you do it yourself.'
            },
            {
                value: 'approval-first',
                label: 'Approval-first',
                description: 'TODD prepares the work and waits for permission.'
            },
            {
                value: 'auto',
                label: 'Auto',
                description: 'TODD performs allowed actions automatically.'
            }
        ];

        const categories = approvalPolicy?.categories || {};
        const preferredOrder = new Map( categoryDefinitions.map( ( definition, index ) => [definition.key, index] ) );
        const knownKeys = new Set( categoryDefinitions.map( definition => definition.key ) );
        const mergedDefinitions = [
            ...categoryDefinitions,
            ...Object.keys( categories )
                .filter( key => !knownKeys.has( key ) )
                .sort()
                .map( key => ( {
                    key,
                    label: this.humanizeApprovalCategoryLabel( key ),
                    description: 'TODD can use this category when a future action type is added to Daily Momentum.'
                } ) )
        ].sort( ( a, b ) => {
            const aOrder = preferredOrder.has( a.key ) ? preferredOrder.get( a.key )! : Number.MAX_SAFE_INTEGER;
            const bOrder = preferredOrder.has( b.key ) ? preferredOrder.get( b.key )! : Number.MAX_SAFE_INTEGER;
            return aOrder - bOrder || a.label.localeCompare( b.label );
        } );

        return {
            headline: 'How TODD is allowed to operate',
            summary: 'Choose whether TODD should stay manual, pause for approval, or carry safe categories automatically. These settings explain why TODD paused or auto-executed work today.',
            categories: mergedDefinitions.map( definition => {
                const policyCategory = categories[definition.key] || {};
                const mode = this.normalizeDailyMomentumExecutionMode( policyCategory.mode );
                const modeOption = modeOptions.find( option => option.value === mode ) || modeOptions[1];

                return {
                    category: definition.key,
                    label: String( policyCategory.label || definition.label ).trim() || definition.label,
                    description: definition.description,
                    mode,
                    modeLabel: modeOption.label,
                    modeDescription: modeOption.description
                };
            } ),
            modeOptions,
            config: {
                dailyDraftTarget: Number( approvalPolicy?.dailyDraftTarget || 100 ) || 100,
                dailyAutoSendTarget: Number( approvalPolicy?.dailyAutoSendTarget || 100 ) || 100
            }
        };
    }

    private getLatestReceiptByActionPlan ( payload: MomentumPayload, executionReceipts: MomentumExecutionReceipt[] ): Record<string, MomentumExecutionReceipt> {
        if ( payload.latestReceiptByActionPlan && typeof payload.latestReceiptByActionPlan === 'object' ) {
            return payload.latestReceiptByActionPlan;
        }

        return executionReceipts.reduce( ( map, receipt ) => {
            const actionPlanId = String( receipt?.actionPlanId || '' ).trim();
            if ( !actionPlanId ) return map;

            const current = map[actionPlanId];
            if ( !current || String( current.createdAt || '' ).localeCompare( String( receipt.createdAt || '' ) ) <= 0 ) {
                map[actionPlanId] = receipt;
            }
            return map;
        }, {} as Record<string, MomentumExecutionReceipt> );
    }

    private buildExecutionSuggestionsFromActionPlans (
        actionPlans: MomentumActionPlan[],
        latestReceiptByActionPlan: Record<string, MomentumExecutionReceipt>,
        rawExecutionSuggestions: MomentumExecutionSuggestion[] = []
    ): MomentumExecutionSuggestion[] {
        const suggestions = actionPlans.map( actionPlan => {
            const payload = actionPlan.payload || {};
            const actionPlanId = String( actionPlan.id || '' ).trim();
            const receipt = latestReceiptByActionPlan[actionPlanId];
            const reviewRoute = String( actionPlan.reviewRoute || '' ).trim();
            const reviewLabel = String( payload.reviewLabel || '' ).trim();
            const matchedSuggestion = rawExecutionSuggestions.find( suggestion =>
                String( suggestion?.actionPlanId || '' ).trim() === actionPlanId
                || (
                    String( suggestion?.route || '' ).trim() === reviewRoute
                    && String( suggestion?.title || '' ).trim() === String( payload.title || actionPlan.summary || 'Prepared action' ).trim()
                )
            );
            const persistedBehaviorAlignment = actionPlan.behaviorAlignment
                || ( payload['behaviorAlignment'] as MomentumBehaviorAlignment | null | undefined )
                || null;
            const scopedSocialState = this.resolveScopedSocialState( actionPlan );

            if ( scopedSocialState?.stage === 'published' || scopedSocialState?.stage === 'archived' ) {
                return null;
            }

            const resolvedRoute = scopedSocialState?.route || reviewRoute;
            const resolvedReviewLabel = scopedSocialState
                ? this.buildScopedSocialReviewLabel( scopedSocialState )
                : reviewLabel;
            const resolvedApprovalLabel = scopedSocialState
                ? this.buildScopedSocialApprovalLabel( scopedSocialState )
                : String( payload.approvalLabel || '' ).trim();
            const resolvedCtaLabel = scopedSocialState
                ? this.buildScopedSocialCtaLabel( scopedSocialState )
                : resolvedReviewLabel;
            const resolvedPreparedSummary = scopedSocialState
                ? this.buildScopedSocialPreparedSummary(
                    String( payload.preparedSummary || actionPlan.summary || '' ).trim(),
                    scopedSocialState
                )
                : String( payload.preparedSummary || actionPlan.summary || '' ).trim();
            const resolvedApprovalSummary = scopedSocialState
                ? this.buildScopedSocialApprovalSummary(
                    String( payload.approvalSummary || '' ).trim(),
                    scopedSocialState
                )
                : String( payload.approvalSummary || '' ).trim();
            const resolvedStatus = scopedSocialState?.stage === 'rejected'
                ? 'completed'
                : String( actionPlan.status || '' ).trim();
            const requiresConfirmation = scopedSocialState
                ? ( scopedSocialState.stage === 'draft' || scopedSocialState.stage === 'approved' )
                : String( actionPlan.status || '' ).trim() === 'waiting_for_approval';

            return {
                action: String( actionPlan.type || '' ).trim(),
                title: String( payload.title || actionPlan.summary || 'Prepared action' ).trim(),
                detail: resolvedPreparedSummary,
                resultSummary: String( receipt?.summary || '' ).trim(),
                route: resolvedRoute,
                status: scopedSocialState?.stage === 'draft' || scopedSocialState?.stage === 'approved'
                    ? 'waiting_for_approval'
                    : ( scopedSocialState?.stage === 'rejected'
                        ? resolvedStatus
                        : this.mapActionPlanStatusToSuggestionStatus( actionPlan, receipt ) ),
                requiresConfirmation,
                ctaLabel: resolvedCtaLabel,
                actionPath: scopedSocialState?.actionPath || ( resolvedRoute ? this.buildActionPathFromRoute( resolvedRoute, resolvedCtaLabel ) : '' ),
                preparedSummary: resolvedPreparedSummary,
                approvalSummary: resolvedApprovalSummary,
                reviewLabel: resolvedReviewLabel,
                approvalLabel: resolvedApprovalLabel,
                executionMode: String( actionPlan.executionMode || '' ).trim(),
                actionPlanId,
                payload,
                receipt,
                behaviorAlignment: persistedBehaviorAlignment || receipt?.behaviorAlignment || matchedSuggestion?.behaviorAlignment || null,
                behaviorContext: actionPlan.behaviorContext || receipt?.behaviorContext || matchedSuggestion?.behaviorContext || null,
                behaviorContextMeta: actionPlan.behaviorContextMeta || receipt?.behaviorContextMeta || null,
                behaviorCommandSummary: String( receipt?.behaviorCommandSummary || payload['behaviorCommandSummary'] || '' ).trim(),
                featurePromotion: ( payload.featurePromotion as MomentumFeaturePromotion | null | undefined ) || null
            };
        } );

        return suggestions.filter( Boolean ) as MomentumExecutionSuggestion[];
    }

    private resolveScopedSocialState ( source: MomentumActionPlan | MomentumExecutionSuggestion | null | undefined ): MomentumScopedSocialState | null {
        const payload = source?.payload || {};
        const actionPlanSource = source as MomentumActionPlan | null | undefined;
        const executionSuggestionSource = source as MomentumExecutionSuggestion | null | undefined;
        const route = String( actionPlanSource?.reviewRoute || executionSuggestionSource?.route || '' ).trim();
        const raw = `${executionSuggestionSource?.title || actionPlanSource?.payload?.title || ''} ${executionSuggestionSource?.action || actionPlanSource?.type || ''} ${executionSuggestionSource?.detail || actionPlanSource?.summary || ''} ${route}`.toLowerCase();
        const hasTrackedIds = this.collectScopedSocialIds( payload, route ).length > 0;
        const isSocialRoute = route.includes( '/outreach/social' ) || route.includes( 'sourceType=rss-fallback' );
        const isContractLike = /contract|procurement|bid|lead fit|lead-fit|matching fit|sam\.gov/.test( raw );

        if ( isContractLike || ( !isSocialRoute && !hasTrackedIds ) ) {
            return null;
        }

        const trackedPostIds = this.collectScopedSocialIds( payload, route );
        const draftPostIds = this.readScopedSocialIds( payload['draftPostIds'] );
        const approvedPostIds = this.readScopedSocialIds( payload['approvedPostIds'] );
        const publishedPostIds = this.readScopedSocialIds( payload['publishedPostIds'] );
        const rejectedPostIds = this.readScopedSocialIds( payload['rejectedPostIds'] );
        const archivedPostIds = this.readScopedSocialIds( payload['archivedPostIds'] );
        const stage: MomentumScopedSocialStateStage | null = draftPostIds.length > 0
            ? 'draft'
            : approvedPostIds.length > 0
                ? 'approved'
                : publishedPostIds.length > 0
                    ? 'published'
                    : rejectedPostIds.length > 0
                        ? 'rejected'
                        : archivedPostIds.length > 0
                            ? 'archived'
                            : null;

        if ( !stage ) {
            return null;
        }

        const encodedIds = trackedPostIds.join( ',' );
        const scopedBaseRoute = stage === 'draft' ? '/outreach/social/calendar' : '/outreach/social';
        const scopedRoute = encodedIds
            ? `${scopedBaseRoute}?handoffPostIds=${encodeURIComponent( encodedIds )}`
            : scopedBaseRoute;

        return {
            stage,
            trackedPostIds,
            draftPostIds,
            approvedPostIds,
            publishedPostIds,
            rejectedPostIds,
            archivedPostIds,
            route: stage === 'rejected' ? '/daily-momentum' : scopedRoute,
            actionPath: stage === 'draft'
                ? `Open Social Draft Studio at ${scopedRoute} and review the drafts tied to this Momentum handoff.`
                : stage === 'approved'
                    ? `Open Social at ${scopedRoute} and publish the approved posts tied to this Momentum handoff.`
                    : stage === 'rejected'
                        ? 'Open Daily Momentum and dismiss or replace the stale recommendation.'
                        : `Open Social at ${scopedRoute} to review the handoff state.`
        };
    }

    private buildScopedSocialReviewLabel ( state: MomentumScopedSocialState ): string {
        if ( state.stage === 'draft' ) return 'Review recommended drafts';
        if ( state.stage === 'approved' ) return 'Open social queue to publish';
        if ( state.stage === 'rejected' ) return 'Dismiss stale recommendation';
        return 'Review social handoff';
    }

    private buildScopedSocialApprovalLabel ( state: MomentumScopedSocialState ): string {
        if ( state.stage === 'draft' ) return 'Approve Drafts';
        if ( state.stage === 'approved' ) return 'Open social queue to publish';
        if ( state.stage === 'rejected' ) return 'Dismiss stale recommendation';
        return 'Review social handoff';
    }

    private buildScopedSocialCtaLabel ( state: MomentumScopedSocialState ): string {
        return this.buildScopedSocialReviewLabel( state );
    }

    private buildScopedSocialPreparedSummary ( fallback: string, state: MomentumScopedSocialState ): string {
        if ( state.stage === 'draft' ) {
            return `TODD already created ${state.draftPostIds.length} scoped social draft${state.draftPostIds.length === 1 ? '' : 's'} for review.`;
        }
        if ( state.stage === 'approved' ) {
            return `${state.approvedPostIds.length} scoped social post${state.approvedPostIds.length === 1 ? ' is' : 's are'} approved and ready for publishing.`;
        }
        if ( state.stage === 'rejected' ) {
            return 'The drafts tied to this recommendation were rejected, so this social path is stale until you reopen it manually.';
        }
        return fallback;
    }

    private buildScopedSocialApprovalSummary ( fallback: string, state: MomentumScopedSocialState ): string {
        if ( state.stage === 'draft' ) {
            return `Approve the ${state.draftPostIds.length} scoped draft${state.draftPostIds.length === 1 ? '' : 's'} to move this handoff forward.`;
        }
        if ( state.stage === 'approved' ) {
            return `Publish the ${state.approvedPostIds.length} approved post${state.approvedPostIds.length === 1 ? '' : 's'} tied to this handoff.`;
        }
        if ( state.stage === 'rejected' ) {
            return 'This recommendation no longer has publishable drafts.';
        }
        return fallback;
    }

    private readScopedSocialIds ( value: unknown ): string[] {
        if ( Array.isArray( value ) ) {
            return Array.from( new Set( value.map( item => String( item || '' ).trim() ).filter( Boolean ) ) );
        }

        return String( value || '' )
            .split( ',' )
            .map( item => item.trim() )
            .filter( Boolean );
    }

    private collectScopedSocialIds ( payload: Record<string, unknown>, route: string ): string[] {
        const routeIds = this.extractHandoffPostIdsFromRoute( route );
        return Array.from( new Set( [
            ...this.readScopedSocialIds( payload['handoffPostIds'] ),
            ...this.readScopedSocialIds( payload['currentHandoffDraftIds'] ),
            ...this.readScopedSocialIds( payload['draftPostIds'] ),
            ...this.readScopedSocialIds( payload['approvedPostIds'] ),
            ...this.readScopedSocialIds( payload['publishedPostIds'] ),
            ...this.readScopedSocialIds( payload['rejectedPostIds'] ),
            ...this.readScopedSocialIds( payload['archivedPostIds'] ),
            ...routeIds
        ] ) );
    }

    private extractHandoffPostIdsFromRoute ( route: string ): string[] {
        const query = String( route || '' ).split( '?' )[1] || '';
        if ( !query ) {
            return [];
        }

        const params = new URLSearchParams( query );
        return this.readScopedSocialIds( params.get( 'handoffPostIds' ) || '' );
    }

    private resolveMomentumEscalationPreference (
        status: 'behind' | 'on_track' | 'met' | 'unknown',
        history: DailyMomentumHistoryEntry[] | undefined,
        now: Date | undefined,
        goalStatus: MomentumGoalStatus
    ): 'normal' | 'pressure' | 'critical' {
        const currentDate = now instanceof Date && !Number.isNaN( now.getTime() ) ? now : new Date();
        const currentEntry: DailyMomentumHistoryEntry = {
            dateKey: this.toDateKey( currentDate ),
            status,
            revenue: Number( goalStatus.revenue || 0 ),
            successfulOutcomeCount: 0
        };
        const timeline = this.normalizeMomentumHistory( history, currentEntry );
        return this.resolveDailyMomentumEscalationLevel(
            this.countTrailingDays( timeline, entry => entry.status === 'behind' ),
            this.countTrailingDays( timeline, entry => Number( entry.revenue || 0 ) <= 0 ),
            this.countTrailingDays( timeline, entry => Number( entry.successfulOutcomeCount || 0 ) <= 0 ),
            this.hasDecliningActivity( timeline )
        );
    }

    private prioritizeExecutionSuggestions (
        executionSuggestions: MomentumExecutionSuggestion[],
        escalationLevel: 'normal' | 'pressure' | 'critical',
        executionAccountabilityMode: boolean = false
    ): MomentumExecutionSuggestion[] {
        if ( executionSuggestions.length < 2 || escalationLevel === 'normal' ) {
            return executionSuggestions;
        }

        return [...executionSuggestions].sort( ( a, b ) => {
            const scoreA = this.scoreExecutionSuggestionPriority( a, escalationLevel, executionAccountabilityMode );
            const scoreB = this.scoreExecutionSuggestionPriority( b, escalationLevel, executionAccountabilityMode );
            return scoreB - scoreA;
        } );
    }

    private scoreExecutionSuggestionPriority (
        suggestion: MomentumExecutionSuggestion,
        escalationLevel: 'normal' | 'pressure' | 'critical',
        executionAccountabilityMode: boolean
    ): number {
        const impactScore = Number( suggestion.behaviorAlignment?.priorityScore || 0 ) * 10;
        const executionMode = this.resolveSuggestionExecutionMode( suggestion );
        const statusText = `${suggestion.status || ''} ${suggestion.detail || ''} ${suggestion.title || ''}`.toLowerCase();
        const statusBonus = /completed|queued|scheduled|live/.test( statusText ) ? 6 : 0;
        const routeBonus = suggestion.route ? 2 : 0;
        const readyBonus = executionAccountabilityMode
            ? executionMode === 'auto'
                ? 45
                : suggestion.requiresConfirmation
                    ? -35
                    : 20
            : 0;

        if ( escalationLevel === 'normal' ) {
            return impactScore + statusBonus + routeBonus + readyBonus;
        }

        const modeBonus = executionMode === 'auto'
            ? escalationLevel === 'critical' ? 30 : 20
            : executionMode === 'approval-first'
                ? 0
                : -40;

        return impactScore + statusBonus + routeBonus + modeBonus + readyBonus;
    }

    private shouldForceExecutionAccountability (
        status: 'behind' | 'on_track' | 'met' | 'unknown',
        goalStatus: MomentumGoalStatus,
        now?: Date
    ): boolean {
        const currentDate = now instanceof Date && !Number.isNaN( now.getTime() ) ? now : new Date();
        const timeOfDay = this.resolveDailyMomentumTimeOfDay( currentDate );
        return status === 'behind'
            && Number( goalStatus.revenue || 0 ) <= 0
            && timeOfDay !== 'morning';
    }

    private selectRevenuePathSuggestions (
        executionSuggestions: MomentumExecutionSuggestion[],
        executionAccountabilityMode: boolean
    ): { primary: MomentumExecutionSuggestion | null; backup: MomentumExecutionSuggestion | null; } {
        const primary = executionSuggestions[0] || null;
        if ( !executionAccountabilityMode || !primary ) {
            return {
                primary,
                backup: executionSuggestions[1] || null
            };
        }

        const executableFallback = executionSuggestions.find( suggestion =>
            suggestion !== primary && !suggestion.requiresConfirmation
        ) || null;

        if ( primary.requiresConfirmation && executableFallback ) {
            return {
                primary: executableFallback,
                backup: primary
            };
        }

        return {
            primary,
            backup: executionSuggestions.find( suggestion => suggestion !== primary ) || null
        };
    }

    private resolveSuggestionExecutionMode ( suggestion: MomentumExecutionSuggestion ): DailyMomentumExecutionMode {
        const normalizedMode = this.normalizeDailyMomentumExecutionMode( suggestion.executionMode );
        if ( suggestion.executionMode ) {
            return normalizedMode;
        }

        if ( suggestion.requiresConfirmation ) {
            return 'approval-first';
        }

        const statusText = `${suggestion.status || ''} ${suggestion.detail || ''} ${suggestion.title || ''}`.toLowerCase();
        if ( /queued|scheduled|auto-executed|auto executed|live/.test( statusText ) ) {
            return 'auto';
        }

        return suggestion.route ? 'approval-first' : 'manual';
    }

    private buildExecutionFirstReason (
        executionStatus: DailyMomentumExecutionStatus,
        actionsTaken: DailyMomentumActionRow[],
        fallbackReason: string,
        offerContext?: ToddSelectedOffer | null
    ): string {
        const primaryAction = actionsTaken[0];
        if ( primaryAction ) {
            if ( primaryAction.state === 'auto_executed' || primaryAction.state === 'completed' ) {
                return this.ensureSentence( `TODD moved this ${offerContext?.name ? `${offerContext.name} ` : ''}path into execution because it was the fastest live route available from today’s signals.` );
            }

            if ( primaryAction.state === 'waiting_for_approval' ) {
                return this.ensureSentence( `TODD prepared the ${offerContext?.name ? `${offerContext.name} ` : ''}execution path and is holding only at the final execution gate.` );
            }

            if ( primaryAction.state === 'prepared_by_todd' ) {
                return this.ensureSentence( `TODD prepared this ${offerContext?.name ? `around ${offerContext.name} ` : ''}as the next execution path instead of leaving today in analysis mode.` );
            }
        }

        if ( executionStatus === 'queued' || executionStatus === 'completed' ) {
            return 'TODD is prioritizing active execution over additional planning.';
        }

        return fallbackReason;
    }

    private decorateSelectedMoveText ( selectedMove: string, offerContext: ToddSelectedOffer | null, tacticContext: ToddOfferTactic | null, recoveryModeActive: boolean ): string {
        const normalized = String( selectedMove || '' ).trim();
        if ( !normalized || !offerContext ) {
            return normalized;
        }

        if ( normalized.includes( offerContext.name ) ) {
            return normalized;
        }

        if ( recoveryModeActive ) {
            return `Current path: ${this.formatOfferActionLabel( normalized, offerContext, tacticContext, true )}`;
        }

        return this.formatOfferActionLabel( normalized, offerContext, tacticContext, false );
    }

    private formatTacticLabel ( tacticContext: ToddOfferTactic | null | undefined ): string {
        if ( !tacticContext ) {
            return '';
        }

        switch ( tacticContext.positioningType ) {
            case 'urgency':
                return 'Urgency';
            case 'bonus':
                return 'Bonus';
            case 'fast_track':
                return 'Fast track';
            case 'diagnostic':
                return 'Diagnostic';
            default:
                return tacticContext.label;
        }
    }

    private buildTacticLead (
        tacticContext: ToddOfferTactic | null,
        offerContext: ToddSelectedOffer,
        outcome: string
    ): { subject: string; bodyLead: string; supportLine: string; } {
        if ( !tacticContext ) {
            return { subject: '', bodyLead: '', supportLine: '' };
        }

        switch ( tacticContext.positioningType ) {
            case 'urgency':
                return {
                    subject: `${offerContext.name}: limited window to fix this today`,
                    bodyLead: `Limited window: ${outcome}`,
                    supportLine: 'This is being framed as a same-day window because the current revenue gap still has to move before the day closes.'
                };
            case 'fast_track':
                return {
                    subject: `${offerContext.name}: fast-track this today`,
                    bodyLead: `Fast-track result: ${outcome}`,
                    supportLine: 'This offer is positioned around speed to result so the buyer sees a concrete path today.'
                };
            case 'diagnostic':
                return {
                    subject: `${offerContext.name}: clarity without a long commitment`,
                    bodyLead: `Low-friction clarity: ${outcome}`,
                    supportLine: 'This is positioned as a diagnostic first step so the buyer can say yes without a heavy commitment.'
                };
            case 'bonus':
                return {
                    subject: `${offerContext.name}: extra value if this moves today`,
                    bodyLead: `Added value: ${outcome}`,
                    supportLine: 'This is framed with a same-day bonus to increase response while urgency is real.'
                };
            default:
                return { subject: '', bodyLead: '', supportLine: '' };
        }
    }

    private buildTacticDetailLine ( tacticContext: ToddOfferTactic | null ): string {
        if ( !tacticContext ) {
            return '';
        }

        switch ( tacticContext.positioningType ) {
            case 'urgency':
                return 'Positioning: limited window.';
            case 'fast_track':
                return 'Positioning: fastest route to result.';
            case 'diagnostic':
                return 'Positioning: clarity first, low friction.';
            case 'bonus':
                return 'Positioning: same-day bonus.';
            default:
                return '';
        }
    }

    private findReceiptForSuggestion ( suggestion: MomentumExecutionSuggestion ): MomentumExecutionReceipt | undefined {
        return suggestion.receipt;
    }

    private toNumberMetric ( value: unknown ): number {
        const numeric = Number( value );
        return Number.isFinite( numeric ) ? numeric : 0;
    }

    private getLeadCandidateRecords ( suggestion: MomentumExecutionSuggestion ): Array<{ recordId: string; }> {
        const candidateLeads = Array.isArray( suggestion.payload?.['candidateLeads'] )
            ? suggestion.payload?.['candidateLeads'] as Array<{ recordId?: string; }>
            : [];

        return candidateLeads
            .map( lead => ( { recordId: String( lead?.recordId || '' ).trim() } ) )
            .filter( lead => !!lead.recordId );
    }

    private getPreparedLeadSetId ( suggestion: MomentumExecutionSuggestion ): string {
        return String( suggestion.payload?.['preparedLeadSetId'] || '' ).trim();
    }

    private buildPreparedLeadCandidateRoute ( suggestion: MomentumExecutionSuggestion ): string {
        const preparedLeadSetId = this.getPreparedLeadSetId( suggestion );
        if ( !preparedLeadSetId ) return '';
        const params = new URLSearchParams();
        params.set( 'momentumPreparedSet', preparedLeadSetId );
        params.set( 'source', 'momentum-prepared' );
        return `/lead-vault?${params.toString()}`;
    }

    private resolveReceiptReviewRoute (
        suggestion: MomentumExecutionSuggestion,
        receipt?: MomentumExecutionReceipt
    ): string {
        const type = String( receipt?.type || suggestion.action || '' ).trim().toLowerCase();
        const metrics = receipt?.metrics || {};
        const reviewRoute = String( ( metrics as any )?.reviewRoute || suggestion.route || '' ).trim();
        if ( type === 'prepare_lead_addition' && reviewRoute === '/lead-vault' ) {
            return this.buildPreparedLeadCandidateRoute( suggestion ) || reviewRoute;
        }
        return reviewRoute;
    }

    private buildReceiptBackedDetail (
        suggestion: MomentumExecutionSuggestion,
        receipt?: MomentumExecutionReceipt
    ): string {
        const type = String( receipt?.type || suggestion.action || '' ).trim().toLowerCase();
        const metrics = receipt?.metrics || {};
        const status = String( receipt?.status || '' ).trim().toLowerCase();
        const candidateCount = this.getLeadCandidateRecords( suggestion ).length;
        const offerName = String( receipt?.offerName || suggestion.offerContext?.name || '' ).trim();

        if ( type === 'prepare_lead_addition' ) {
            const addedCount = this.toNumberMetric( ( metrics as any )?.addedCount );
            const skippedCount = this.toNumberMetric( ( metrics as any )?.skippedCount );
            const failedCount = this.toNumberMetric( ( metrics as any )?.failedCount );

            if ( status === 'completed' || status === 'executed' ) {
                return `I added ${addedCount} lead${addedCount === 1 ? '' : 's'}${skippedCount > 0 ? ` and skipped ${skippedCount} duplicate${skippedCount === 1 ? '' : 's'}` : ''}${failedCount > 0 ? ` while ${failedCount} failed` : ''}.`;
            }

            if ( status === 'failed' ) {
                return `I could not add the prepared leads${failedCount > 0 ? ` because ${failedCount} item${failedCount === 1 ? '' : 's'} failed` : ''}.`;
            }

            if ( candidateCount > 0 ) {
                return `I identified ${candidateCount} candidate lead${candidateCount === 1 ? '' : 's'} worth reviewing for today's momentum push.`;
            }

            return 'Lead coverage was too thin, so I shifted to lower-risk support work instead.';
        }

        if ( type === 'prepare_linkedin_draft' || type === 'prepare_threads_draft' ) {
            const platform = String( ( metrics as any )?.platform || '' ).trim().toLowerCase();
            const platformLabel = platform === 'threads' ? 'Threads' : 'LinkedIn';
            if ( status === 'completed' || status === 'prepared' ) {
                return `I created a ${platformLabel} draft and handed it off for review in Social.`;
            }
        }

        if ( type === 'recommend_rss_fallback_social_draft' ) {
            const sourceTitle = String( suggestion.payload?.['sourceTitle'] || '' ).trim();
            const recommendation = suggestion.payload?.['recommendation'] as Record<string, unknown> | undefined;
            const recommendationStatus = String( recommendation?.['status'] || '' ).trim().toLowerCase();
            if ( status === 'completed' || status === 'prepared' || recommendationStatus === 'draft_created' ) {
                return `I created review-only RSS fallback drafts from ${sourceTitle || 'the selected article'} and handed them off in Social.`;
            }

            return `Queue was empty, so I selected ${sourceTitle || 'a recent RSS article'} as the best fallback draft source.`;
        }

        if ( type === 'prepare_outreach_campaign' ) {
            const contactsCount = this.toNumberMetric( ( metrics as any )?.contactsCount );
            const attemptsCount = this.toNumberMetric( ( metrics as any )?.attemptsCount );
            const variationCount = this.toNumberMetric( ( metrics as any )?.variationCount );
            if ( status === 'completed' || status === 'prepared' ) {
                const parts = ['I prepared the outreach campaign'];
                if ( contactsCount > 0 ) {
                    parts.push( `for ${contactsCount} contact${contactsCount === 1 ? '' : 's'}` );
                }
                if ( offerName ) {
                    parts.push( `${contactsCount > 0 ? 'around' : 'for'} ${offerName}` );
                }
                let sentence = parts.join( ' ' ).replace( /\s+/g, ' ' ).trim();
                sentence = `${sentence.replace( /\.\s*$/, '' )} and handed it off for review.`;
                if ( attemptsCount > 0 || variationCount > 0 ) {
                    const detailBits: string[] = [];
                    if ( attemptsCount > 0 ) detailBits.push( `${attemptsCount} attempt${attemptsCount === 1 ? '' : 's'}` );
                    if ( variationCount > 0 ) detailBits.push( `${variationCount} variation${variationCount === 1 ? '' : 's'}` );
                    sentence += ` Details: ${detailBits.join( ', ' )}.`;
                }
                return sentence;
            }
        }

        if ( /recommend_social_follow_up|recommend_contact_handoff_task|recommend_direct_note|recommend_appointment_first_push/.test( type ) ) {
            return String( suggestion.preparedSummary || receipt?.summary || suggestion.detail || 'I prepared an alternate-channel escalation recommendation tied to the warmest current signal.' ).trim();
        }

        const fallback = String( suggestion.resultSummary || receipt?.summary || suggestion.detail || '' ).trim();
        if ( fallback && offerName && !fallback.includes( offerName ) ) {
            return `${fallback.replace( /\.\s*$/, '' )} for ${offerName}.`;
        }
        return fallback;
    }

    private buildReceiptMetrics (
        suggestion: MomentumExecutionSuggestion,
        receipt?: MomentumExecutionReceipt
    ): Array<{ label: string; value: string; }> {
        const type = String( receipt?.type || suggestion.action || '' ).trim().toLowerCase();
        const metrics = receipt?.metrics || {};
        const status = String( receipt?.status || '' ).trim().toLowerCase();
        const rows: Array<{ label: string; value: string; }> = [];
        const candidateCount = this.getLeadCandidateRecords( suggestion ).length;
        const stageStatus = String( suggestion.payload?.['stageStatus'] || '' ).trim().toLowerCase();
        const offerName = String( receipt?.offerName || suggestion.offerContext?.name || '' ).trim();
        const offerPrice = String( receipt?.offerPrice || suggestion.offerContext?.priceLabel || '' ).trim();

        if ( type === 'prepare_lead_addition' ) {
            const addedCount = this.toNumberMetric( ( metrics as any )?.addedCount );
            const skippedCount = this.toNumberMetric( ( metrics as any )?.skippedCount );
            const failedCount = this.toNumberMetric( ( metrics as any )?.failedCount );

            if ( addedCount > 0 || status === 'completed' || status === 'executed' ) {
                rows.push( { label: 'Added', value: String( addedCount ) } );
            }
            if ( addedCount <= 0 && candidateCount > 0 ) {
                rows.push( { label: 'Staged', value: String( candidateCount ) } );
            }
            if ( stageStatus && addedCount <= 0 ) {
                rows.push( { label: 'Stage status', value: this.formatMetricLabel( stageStatus ) } );
            }
            if ( skippedCount > 0 ) rows.push( { label: 'Skipped', value: String( skippedCount ) } );
            if ( failedCount > 0 ) rows.push( { label: 'Failed', value: String( failedCount ) } );
            return rows;
        }

        if ( type === 'prepare_linkedin_draft' || type === 'prepare_threads_draft' ) {
            const platform = String( ( metrics as any )?.platform || '' ).trim().toLowerCase();
            if ( !platform && !( metrics as any )?.draftCreated ) return rows;
            rows.push( { label: 'Platform', value: platform === 'threads' ? 'Threads' : 'LinkedIn' } );
            rows.push( { label: 'Draft', value: ( metrics as any )?.draftCreated ? 'Created' : 'Not created' } );
            return rows;
        }

        if ( type === 'recommend_rss_fallback_social_draft' ) {
            const recommendation = suggestion.payload?.['recommendation'] as Record<string, unknown> | undefined;
            const recommendationStatus = String( recommendation?.['status'] || '' ).trim().toLowerCase();
            const draftCount = this.toNumberMetric( ( metrics as any )?.draftCount );
            const publishDate = String( suggestion.payload?.['publishDate'] || '' ).trim();
            rows.push( { label: 'Source', value: 'rss-fallback' } );
            if ( draftCount > 0 ) rows.push( { label: 'Drafts', value: String( draftCount ) } );
            if ( publishDate ) rows.push( { label: 'Published', value: new Date( publishDate ).toLocaleDateString() } );
            if ( recommendationStatus ) rows.push( { label: 'State', value: this.formatMetricLabel( recommendationStatus ) } );
            return rows;
        }

        if ( type === 'prepare_outreach_campaign' ) {
            const contactsCount = this.toNumberMetric( ( metrics as any )?.contactsCount );
            const attemptsCount = this.toNumberMetric( ( metrics as any )?.attemptsCount );
            const variationCount = this.toNumberMetric( ( metrics as any )?.variationCount );
            const campaignPrepared = !!( metrics as any )?.campaignPrepared;
            const handoffComplete = !!( metrics as any )?.handoffComplete;
            if ( contactsCount <= 0 && !campaignPrepared && !handoffComplete && status !== 'completed' ) {
                return rows;
            }
            if ( contactsCount > 0 ) rows.push( { label: 'Contacts', value: String( contactsCount ) } );
            if ( attemptsCount > 0 ) rows.push( { label: 'Attempts', value: String( attemptsCount ) } );
            if ( variationCount > 0 ) rows.push( { label: 'Variations', value: String( variationCount ) } );
            if ( handoffComplete || campaignPrepared ) {
                rows.push( { label: 'Handoff', value: handoffComplete ? 'Ready for review' : 'Prepared' } );
            }
            return rows;
        }

        if ( /recommend_social_follow_up|recommend_contact_handoff_task|recommend_direct_note|recommend_appointment_first_push/.test( type ) ) {
            const escalationChannel = String( suggestion.payload?.['escalationChannel'] || '' ).trim();
            const targetLabel = String( suggestion.payload?.['targetLabel'] || '' ).trim();
            if ( escalationChannel ) rows.push( { label: 'Channel', value: this.formatMetricLabel( escalationChannel ) } );
            if ( targetLabel ) rows.push( { label: 'Target', value: targetLabel } );
            return rows;
        }

        if ( offerName ) {
            rows.unshift( { label: 'Offer', value: offerName } );
        }

        if ( offerPrice ) {
            rows.splice( Math.min( 1, rows.length ), 0, { label: 'Price', value: offerPrice } );
        }

        return rows;
    }

    private buildReceiptSecondaryCta (
        suggestion: MomentumExecutionSuggestion,
        receipt?: MomentumExecutionReceipt
    ): { label: string; route: string; path: string; } | null {
        const type = String( receipt?.type || suggestion.action || '' ).trim().toLowerCase();
        const route = this.resolveReceiptReviewRoute( suggestion, receipt );

        if ( type === 'prepare_lead_addition' ) {
            const addedCount = this.toNumberMetric( ( receipt?.metrics as any )?.addedCount );
            if ( addedCount > 0 ) {
                return {
                    label: 'View Contacts',
                    route: '/contact-list',
                    path: 'Open Contact List at /contact-list to review the contacts TODD added.'
                };
            }

            const candidateRoute = this.buildPreparedLeadCandidateRoute( suggestion );
            if ( !candidateRoute ) return null;

            return {
                label: 'Review Lead Set',
                route: candidateRoute,
                path: 'Open Lead Vault at the staged momentum lead set and review the candidates TODD prepared.'
            };
        }

        let label = '';
        if ( type === 'prepare_outreach_campaign' ) label = 'Open Compose';
        else if ( /recommend_direct_note|recommend_appointment_first_push/.test( type ) ) label = 'Open Compose';
        else if ( /recommend_social_follow_up/.test( type ) ) label = 'Review in Social';
        else if ( /recommend_contact_handoff_task/.test( type ) ) label = 'Open Contacts';
        else if ( /prepare_(linkedin|threads)_draft/.test( type ) ) label = 'Review in Social';

        if ( !label || !route ) return null;

        return {
            label,
            route,
            path: this.buildActionPathFromRoute( route, label )
        };
    }

    private mapActionPlanStatusToSuggestionStatus (
        actionPlan: MomentumActionPlan,
        receipt?: MomentumExecutionReceipt
    ): string {
        const planStatus = String( actionPlan.status || '' ).trim().toLowerCase();
        const receiptStatus = String( receipt?.status || '' ).trim().toLowerCase();

        if ( receiptStatus === 'failed' || planStatus === 'failed' ) return 'failed';
        if ( receiptStatus === 'blocked' || planStatus === 'blocked' ) return 'blocked';
        if ( ['completed', 'executed', 'prepared'].includes( receiptStatus ) || planStatus === 'completed' ) return 'completed';
        if ( receiptStatus === 'queued' || planStatus === 'auto_executed' ) return 'queued';
        if ( planStatus === 'blocked' ) return 'blocked';
        if ( planStatus === 'waiting_for_approval' ) return 'waiting_for_confirmation';
        return 'drafted';
    }

    private buildActionPathFromRoute ( route: string, reviewLabel: string ): string {
        const label = reviewLabel || `Review in ${this.routeToDestinationLabel( route )}`;
        return `${label} at ${route}`;
    }

    private formatMetricLabel ( value: string ): string {
        return String( value || '' )
            .trim()
            .split( /[_\s-]+/ )
            .filter( Boolean )
            .map( segment => segment.charAt( 0 ).toUpperCase() + segment.slice( 1 ) )
            .join( ' ' );
    }

    private buildGapLine ( goalStatus: MomentumGoalStatus ): string {
        const gap = Number( goalStatus.gap || 0 );
        const status = String( goalStatus.status || '' ).toLowerCase();

        if ( status === 'met' ) {
            return `I have covered today's target.`;
        }

        if ( status === 'unknown' ) {
            return `I cannot fully verify the gap yet, so I am treating ${this.formatMoney( gap )} as the remaining target.`;
        }

        return `I am behind by ${this.formatMoney( gap )}.`;
    }

    private buildDailyMomentumOperatorState (
        goalStatus: MomentumGoalStatus,
        status: 'behind' | 'on_track' | 'met' | 'unknown',
        actionsTaken: DailyMomentumActionRow[],
        blockers: string[],
        history: DailyMomentumHistoryEntry[] | undefined,
        now: Date | undefined,
        userProfile: DailyMomentumUserProfile | null
    ): DailyMomentumOperatorState {
        const currentDate = now instanceof Date && !Number.isNaN( now.getTime() ) ? now : new Date();
        const timeOfDay = this.resolveDailyMomentumTimeOfDay( currentDate );
        const currentEntry: DailyMomentumHistoryEntry = {
            dateKey: this.toDateKey( currentDate ),
            goalAmount: Number( goalStatus.goal || 0 ),
            revenue: Number( goalStatus.revenue || 0 ),
            gap: Number( goalStatus.gap || 0 ),
            status,
            actionCount: actionsTaken.length,
            successfulOutcomeCount: actionsTaken.filter( action => ['completed', 'auto_executed'].includes( action.state ) ).length,
            appointmentCount: Number( goalStatus.appointmentsSoFar || goalStatus.appointmentCount || goalStatus.appointments || 0 )
        };
        const timeline = this.normalizeMomentumHistory( history, currentEntry );
        const consecutiveBehindDays = this.countTrailingDays( timeline, entry => entry.status === 'behind' );
        const consecutiveNoRevenueDays = this.countTrailingDays( timeline, entry => Number( entry.revenue || 0 ) <= 0 );
        const consecutiveNoOutcomeDays = this.countTrailingDays( timeline, entry => Number( entry.successfulOutcomeCount || 0 ) <= 0 );
        const decliningActivity = this.hasDecliningActivity( timeline );
        const baselineLevel = this.resolveDailyMomentumEscalationLevel(
            consecutiveBehindDays,
            consecutiveNoRevenueDays,
            consecutiveNoOutcomeDays,
            decliningActivity
        );
        const noRepliesDetected = this.hasNoReplySignals( blockers );
        const zeroRevenueStall = status === 'behind'
            && Number( currentEntry.revenue || 0 ) <= 0
            && Number( currentEntry.gap || 0 ) > 0
            && Number( currentEntry.successfulOutcomeCount || 0 ) <= 0
            && Number( currentEntry.appointmentCount || 0 ) <= 0;
        const volumeModeActive = status === 'behind'
            && Number( currentEntry.revenue || 0 ) <= 0
            && Number( currentEntry.gap || 0 ) > 0
            && timeOfDay !== 'morning';
        const closeModeActive = status === 'behind'
            && Number( currentEntry.revenue || 0 ) <= 0
            && Number( currentEntry.gap || 0 ) > 0
            && timeOfDay === 'late_day';
        const forcedRevenueRecovery = zeroRevenueStall
            && timeOfDay !== 'morning';
        const level = forcedRevenueRecovery ? 'critical' : baselineLevel;
        const profilePlan = this.buildProfileAwareActionPlan( userProfile, level );
        const patterns = [
            consecutiveBehindDays >= 2 ? `${consecutiveBehindDays} straight days behind goal.` : '',
            consecutiveNoRevenueDays >= 2 ? `${consecutiveNoRevenueDays} straight days without recorded revenue.` : '',
            consecutiveNoOutcomeDays >= 2 ? `${consecutiveNoOutcomeDays} straight days without a successful outcome.` : '',
            decliningActivity ? 'Activity has declined across the recent window.' : '',
            forcedRevenueRecovery
                ? `Revenue is still at $0${noRepliesDetected ? ' with no replies' : ''} and no appointments, so the current path is not working.`
                : ''
        ].filter( Boolean );
        const interventionTriggered = forcedRevenueRecovery || (
            status === 'behind'
            && timeOfDay === 'midday'
            && Number( currentEntry.revenue || 0 ) <= 0
            && Number( currentEntry.successfulOutcomeCount || 0 ) <= 0
            && Number( currentEntry.appointmentCount || 0 ) <= 0
        );
        const recoveryModeActive = status === 'behind'
            && (
                forcedRevenueRecovery
                ||
                interventionTriggered
                || (
                    Number( currentEntry.revenue || 0 ) <= 0
                    && Number( currentEntry.successfulOutcomeCount || 0 ) <= 0
                    && timeOfDay !== 'morning'
                )
                || (
                    level === 'critical'
                    && Number( currentEntry.revenue || 0 ) <= 0
                )
            );
        const interventionMessage = closeModeActive
            ? 'Running Same-Day Rescue push now. Revenue is still $0 and the gap is still open, so I am forcing the fastest same-day path before midnight.'
            : volumeModeActive
                ? 'Running Volume Execution Layer now. Revenue is still $0, so I am widening execution across the strongest available angles and channels to force booked conversations.'
                : forcedRevenueRecovery
                    ? `Current approach is not working. Revenue is still $0${noRepliesDetected ? ' with no replies' : ''} and no appointments, so I am changing strategy now and moving to the fastest revenue paths before midnight.`
                    : interventionTriggered
                        ? 'It is midday and no revenue activity has converted. I am shifting to immediate actions to create opportunity before midnight.'
                        : '';
        const timePressureLine = status !== 'behind'
            ? ''
            : closeModeActive
                ? 'Close Mode is active. Same-day rescue attempts are running now.'
                : volumeModeActive
                    ? 'Volume Mode is active. Multi-batch execution is running now.'
                    : recoveryModeActive
                        ? forcedRevenueRecovery
                            ? 'Time pressure: the current approach is not working. Immediate recovery actions are being taken now.'
                            : 'Time pressure: no active revenue path is converting. Action is required now.'
                        : timeOfDay === 'late_day'
                            ? 'Time pressure: the window to recover today is narrowing.'
                            : 'Time pressure: limited window to recover today.';

        return {
            level,
            label: closeModeActive
                ? 'Close Mode'
                : volumeModeActive
                    ? 'Volume Mode'
                    : recoveryModeActive
                        ? 'Recovery mode'
                        : level === 'critical'
                            ? 'Critical recovery mode'
                            : level === 'pressure'
                                ? 'Pressure mode'
                                : 'Normal operating mode',
            summary: this.buildOperatorSummary( level, patterns, interventionMessage, profilePlan.summary, forcedRevenueRecovery ),
            urgencyLabel: closeModeActive
                ? 'Execution before midnight'
                : volumeModeActive
                    ? 'Volume execution now'
                    : level === 'critical' ? 'Immediate revenue now' : level === 'pressure' ? 'Higher-impact action first' : 'Standard planning',
            strategySummary: this.buildOperatorStrategySummary( level, interventionTriggered, profilePlan.summary, forcedRevenueRecovery, closeModeActive, volumeModeActive ),
            timePressureLine,
            recoveryModeActive,
            volumeModeActive,
            closeModeActive,
            recoveryModeLabel: recoveryModeActive
                ? ( closeModeActive
                    ? 'Close Mode: same-day actions only.'
                    : volumeModeActive
                        ? 'Volume Mode: multi-batch execution active.'
                        : 'Recovery mode: same-day actions only.' )
                : '',
            alternativeMove: status === 'behind' ? profilePlan.alternativeMove : '',
            interventionMessage,
            interventionTriggered,
            timeOfDay,
            timeLabel: timeOfDay === 'midday' ? 'Midday' : timeOfDay === 'late_day' ? 'Late day' : 'Morning',
            consecutiveBehindDays,
            consecutiveNoRevenueDays,
            consecutiveNoOutcomeDays,
            decliningActivity,
            patterns,
            immediateActions: this.buildImmediateActions( level, profilePlan.actions, blockers, interventionTriggered, forcedRevenueRecovery, closeModeActive, volumeModeActive ),
            profileSummary: profilePlan.profileSummary
        };
    }

    private hasNoReplySignals ( blockers: string[] ): boolean {
        return blockers.some( blocker => /no replies|no reply|no responses|no response|reply volume is too low|reply activity|no new replies|response signals are flat|follow-up volume is too low/i.test( blocker ) );
    }

    private resolveDailyMomentumTimeOfDay ( now: Date ): 'morning' | 'midday' | 'late_day' {
        const hour = now.getHours();
        if ( hour >= 12 && hour < 16 ) return 'midday';
        if ( hour >= 16 ) return 'late_day';
        return 'morning';
    }

    private toDateKey ( value: Date ): string {
        const year = value.getFullYear();
        const month = String( value.getMonth() + 1 ).padStart( 2, '0' );
        const day = String( value.getDate() ).padStart( 2, '0' );
        return `${year}-${month}-${day}`;
    }

    private normalizeMomentumHistory (
        history: DailyMomentumHistoryEntry[] | undefined,
        currentEntry: DailyMomentumHistoryEntry
    ): DailyMomentumHistoryEntry[] {
        const entries = Array.isArray( history ) ? history : [];
        const normalized = entries
            .filter( entry => !!String( entry?.dateKey || '' ).trim() )
            .map( entry => ( {
                ...entry,
                dateKey: String( entry.dateKey ).trim()
            } ) );
        const deduped = normalized.filter( entry => entry.dateKey !== currentEntry.dateKey );
        return [...deduped, currentEntry]
            .sort( ( a, b ) => String( a.dateKey ).localeCompare( String( b.dateKey ) ) )
            .slice( -7 );
    }

    private selectBestOffer (
        profile: DailyMomentumUserProfile | null,
        operatorState: DailyMomentumOperatorState,
        blockers: string[],
        history: DailyMomentumHistoryEntry[]
    ): ToddSelectedOffer | null {
        const rawProfile = [
            profile?.profession,
            profile?.jobDescriptionForTODD,
            profile?.status,
            profile?.company?.description,
            profile?.company?.goal,
            profile?.company?.valueProp,
            profile?.company?.companyDescriptionForTODD,
            profile?.company?.companyGoalForTODD,
            profile?.company?.companyValuePropForTODD,
            profile?.company?.companyKeyFeaturesForTODD,
            ...( Array.isArray( profile?.company?.capabilities ) ? profile?.company?.capabilities : [] ),
            ...( Array.isArray( profile?.company?.keyFeatures ) ? profile?.company?.keyFeatures : [] )
        ]
            .filter( Boolean )
            .join( ' ' )
            .toLowerCase();
        const blockerText = blockers.join( ' ' ).toLowerCase();
        const currentEntry = history[history.length - 1] || {};
        const revenueZero = Number( currentEntry.revenue || 0 ) <= 0;
        const recoveryMode = !!operatorState.recoveryModeActive;
        const sameDayScenario = recoveryMode || revenueZero;
        const profileOffers = this.buildSelectedOffersFromUserProfileProducts( profile );
        const offers = profileOffers.length > 0
            ? profileOffers
            : this.buildSelectedOffersFromToddOfferCatalog();
        const usingProfileProducts = profileOffers.length > 0;
        const ranked = offers
            .filter( offer => offer.active && !offer.discontinued )
            .map( offer => {
                let score = 0;
                const reasons: string[] = [];

                if ( recoveryMode && offer.offerMatch === 'free_or_low_friction_offer' ) {
                    score += 14;
                    reasons.push( 'low-friction recovery offer' );
                }

                if ( /contact|lead|coverage|network/.test( blockerText ) && /contact|lead|coverage|network|relationship|prospect/.test( offer.searchText ) ) {
                    score += 10;
                    reasons.push( 'fits contact coverage signals' );
                }

                if ( /reply|follow-up|outreach|reactivat|response/.test( blockerText ) && /reply|follow-up|outreach|reactivat|response|conversation|email/.test( offer.searchText ) ) {
                    score += 10;
                    reasons.push( 'fits outreach signals' );
                }

                if ( /offer|proposal|site|website|web|landing/.test( blockerText ) && offer.offerMatch === 'landing_page_offer' ) {
                    score += 10;
                    reasons.push( 'fits offer or landing-page signals' );
                }

                if ( recoveryMode && offer.fastestClose ) {
                    score += 10;
                    reasons.push( 'fastest close for recovery mode' );
                }

                if ( revenueZero && ( offer.salesCycle === 'same_day' || offer.salesCycle === 'short' ) ) {
                    score += 8;
                    reasons.push( 'short sales cycle while revenue is at $0' );
                }

                const painMatches = offer.painsSolved.filter( pain => blockerText.includes( pain.toLowerCase() ) ).length;
                if ( painMatches > 0 ) {
                    score += painMatches * 6;
                    reasons.push( `matches ${painMatches} blocker${painMatches === 1 ? '' : 's'}` );
                }

                const capabilityMatches = offer.relatedCapabilities.filter( capability => rawProfile.includes( capability.toLowerCase() ) ).length;
                if ( capabilityMatches > 0 ) {
                    score += capabilityMatches * 4;
                    reasons.push( `fits ${capabilityMatches} profile capability${capabilityMatches === 1 ? '' : 'ies'}` );
                }

                if ( rawProfile.includes( 'system integration' ) || rawProfile.includes( 'automation' ) || rawProfile.includes( 'api' ) ) {
                    if ( /diagnostic|audit|rescue|automation|integration|workflow|outreach|implementation/.test( offer.searchText ) ) {
                        score += 3;
                    }
                }

                if ( sameDayScenario ) {
                    if ( offer.deliveryEffort === 'low' ) {
                        score += 5;
                        reasons.push( 'low delivery effort for same-day execution' );
                    } else if ( offer.deliveryEffort === 'medium' ) {
                        score += 2;
                    }
                }

                if ( offer.offerMatch === 'free_or_low_friction_offer' && ( recoveryMode || revenueZero ) ) {
                    score += 5;
                }

                return { offer, score, reasons };
            } )
            .sort( ( a, b ) =>
                b.score - a.score
                || b.offer.promotionPriority - a.offer.promotionPriority
                || Number( a.offer.salesCycle !== 'same_day' ) - Number( b.offer.salesCycle !== 'same_day' )
                || Number( a.offer.deliveryEffort !== 'low' ) - Number( b.offer.deliveryEffort !== 'low' )
                || a.offer.name.localeCompare( b.offer.name )
            );

        const selected = ranked[0]?.offer;
        if ( !selected ) {
            return null;
        }

        const sourceReason = usingProfileProducts ? '' : ' using the fallback catalog';
        const reasoning = ranked[0].reasons.length > 0
            ? `Selected ${selected.name}${sourceReason} because it is the best revenue fit: ${ranked[0].reasons.slice( 0, 3 ).join( ', ' )}.`
            : `Selected ${selected.name}${sourceReason} because it is the clearest revenue move from today’s signals.`;

        return {
            offerId: selected.offerId,
            name: selected.name,
            valueSummary: selected.valueSummary,
            priceLabel: selected.priceLabel,
            cta: selected.cta,
            reasoning,
            offerMatch: selected.offerMatch
        };
    }

    private buildSelectedOffersFromUserProfileProducts ( userProfile: DailyMomentumUserProfile | null ): ToddOfferCandidate[] {
        const products = Array.isArray( userProfile?.company?.products ) ? userProfile.company.products : [];
        return products
            .filter( product => product && product['active'] !== false && product['discontinued'] !== true )
            .map( ( product ): ToddOfferCandidate => {
                const name = this.firstProductString( product, ['name', 'title', 'label'] ) || 'Active offer';
                const valueSummary = this.firstProductString( product, ['problemSolved', 'shortDescription', 'description', 'outcome'] ) || 'A relevant active offer from this user profile.';
                const priceLabel = this.firstProductString( product, ['priceLabel', 'price'] ) || 'Pricing available on request';
                const cta = this.firstProductString( product, ['callToAction', 'cta'] ) || `Ask about ${name}`;
                const reasoning = this.firstProductString( product, ['idealCustomer', 'audience', 'outcome'] ) || 'Selected from active profile products.';
                const searchValues = [
                    name,
                    valueSummary,
                    priceLabel,
                    cta,
                    reasoning,
                    ...this.productStringArray( product, 'features' ),
                    ...this.productStringArray( product, 'capabilities' ),
                    ...this.productStringArray( product, 'tags' )
                ];
                const searchText = searchValues.join( ' ' ).toLowerCase();
                const isLowFriction = /free|low.friction|intro|audit|diagnostic|same.day|quick|fast|trial|consult|call/.test( searchText );

                return {
                    offerId: this.firstProductString( product, ['offerId', 'id'] ) || this.slugifyOfferId( name ),
                    name,
                    valueSummary,
                    priceLabel,
                    cta,
                    reasoning,
                    offerMatch: this.resolveProductOfferMatch( product, searchText, priceLabel ),
                    promotionPriority: this.toFiniteNumber( product['promotionPriority'] ),
                    active: true,
                    discontinued: false,
                    salesCycle: this.resolveProductSalesCycle( searchText ),
                    fastestClose: isLowFriction,
                    deliveryEffort: isLowFriction ? 'low' : 'medium',
                    relatedCapabilities: this.productStringArray( product, 'capabilities' ),
                    painsSolved: this.productStringArray( product, 'painsSolved' ),
                    searchText
                };
            } )
            .sort( ( a, b ) => b.promotionPriority - a.promotionPriority || a.name.localeCompare( b.name ) );
    }

    private buildSelectedOffersFromToddOfferCatalog (): ToddOfferCandidate[] {
        return toddFallbackOfferCatalog
            .filter( offer => offer.active )
            .map( offer => this.mapFallbackOfferCandidate( offer ) );
    }

    private mapFallbackOfferCandidate ( offer: ToddFallbackOfferCatalogItem ): ToddOfferCandidate {
        const searchText = [
            offer.name,
            offer.valueSummary,
            offer.priceLabel,
            offer.cta,
            ...offer.audience,
            ...offer.painsSolved,
            ...offer.relatedCapabilities
        ].join( ' ' ).toLowerCase();

        return {
            offerId: offer.id,
            name: offer.name,
            valueSummary: offer.valueSummary,
            priceLabel: offer.priceLabel,
            cta: offer.cta,
            reasoning: 'Selected from the static Taliferro fallback catalog because no profile products were available.',
            offerMatch: this.resolveFallbackOfferMatch( offer, searchText ),
            promotionPriority: 0,
            active: offer.active,
            discontinued: false,
            salesCycle: offer.salesCycle,
            fastestClose: offer.fastestClose,
            deliveryEffort: offer.deliveryEffort,
            relatedCapabilities: offer.relatedCapabilities,
            painsSolved: offer.painsSolved,
            searchText
        };
    }

    private resolveProductOfferMatch ( product: Record<string, unknown>, searchText: string, priceLabel: string ): ToddOfferMatchMode {
        const explicitMatch = String( product['offerMatch'] || '' ).trim();
        if ( ['free_or_low_friction_offer', 'subscription_offer', 'landing_page_offer', 'any_active_offer'].includes( explicitMatch ) ) {
            return explicitMatch as ToddOfferMatchMode;
        }

        const normalizedPrice = String( priceLabel || '' ).toLowerCase();
        if ( /free|trial|intro|consult|diagnostic|audit|low.friction|no.obligation|same.day/.test( `${searchText} ${normalizedPrice}` ) ) {
            return 'free_or_low_friction_offer';
        }
        if ( /landing|website|web page|sales page|page/.test( searchText ) ) {
            return 'landing_page_offer';
        }
        if ( /subscription|monthly|annual|yearly|\/month|\/year|recurring/.test( `${searchText} ${normalizedPrice}` ) ) {
            return 'subscription_offer';
        }
        return 'any_active_offer';
    }

    private resolveFallbackOfferMatch ( offer: ToddFallbackOfferCatalogItem, searchText: string ): ToddOfferMatchMode {
        if ( offer.category === 'diagnostic' || offer.salesCycle === 'same_day' || offer.deliveryEffort === 'low' ) return 'free_or_low_friction_offer';
        if ( /landing|website|web page|sales page|page/.test( searchText ) ) return 'landing_page_offer';
        if ( offer.pricingModel === 'monthly' || offer.pricingModel === 'annual' || offer.pricingModel === 'monthly_or_annual' ) return 'subscription_offer';
        return 'any_active_offer';
    }

    private resolveProductSalesCycle ( searchText: string ): 'same_day' | 'short' | 'medium' | 'long' {
        if ( /same.day|today|24.hour|immediate|urgent|quick|fast|diagnostic|audit/.test( searchText ) ) return 'same_day';
        if ( /enterprise|implementation|custom|strategic/.test( searchText ) ) return 'long';
        if ( /monthly|subscription|program|retainer/.test( searchText ) ) return 'medium';
        return 'short';
    }

    private firstProductString ( product: Record<string, unknown>, keys: string[] ): string {
        for ( const key of keys ) {
            const value = product[key];
            if ( Array.isArray( value ) ) {
                const joined = value.map( item => String( item || '' ).trim() ).filter( Boolean ).join( ', ' );
                if ( joined ) return joined;
            }
            const normalized = String( value ?? '' ).trim();
            if ( normalized ) return normalized;
        }
        return '';
    }

    private productStringArray ( product: Record<string, unknown>, key: string ): string[] {
        const value = product[key];
        if ( Array.isArray( value ) ) {
            return value.map( item => String( item || '' ).trim() ).filter( Boolean );
        }
        const normalized = String( value ?? '' ).trim();
        return normalized ? [normalized] : [];
    }

    private toFiniteNumber ( value: unknown ): number {
        const parsed = Number( value );
        return Number.isFinite( parsed ) ? parsed : 0;
    }

    private slugifyOfferId ( name: string ): string {
        const slug = String( name || '' ).toLowerCase().replace( /[^a-z0-9]+/g, '-' ).replace( /^-+|-+$/g, '' );
        return slug || 'profile-product-offer';
    }

    private selectBestOfferTactic (
        offerContext: ToddSelectedOffer | null,
        operatorState: DailyMomentumOperatorState,
        goalStatus: MomentumGoalStatus,
        blockers: string[]
    ): ToddOfferTactic | null {
        if ( !offerContext ) {
            return null;
        }

        const noRevenue = Number( goalStatus.revenue || 0 ) <= 0;
        const lowReplies = this.hasNoReplySignals( blockers );
        const middayOrLater = operatorState.timeOfDay === 'midday' || operatorState.timeOfDay === 'late_day';
        const urgencyJustified = operatorState.recoveryModeActive && noRevenue && lowReplies && middayOrLater;

        if ( !urgencyJustified ) {
            return null;
        }

        return toddOfferTactics.find( tactic =>
            tactic.offerMatch === offerContext.offerMatch
            && tactic.triggerConditions.every( condition => {
                if ( condition === 'recoveryMode' ) return operatorState.recoveryModeActive;
                if ( condition === 'noRevenue' ) return noRevenue;
                if ( condition === 'lowReplies' ) return lowReplies;
                if ( condition === 'middayOrLater' ) return middayOrLater;
                return false;
            } )
        ) || null;
    }

    private decorateExecutionSuggestionsWithOffer (
        suggestions: MomentumExecutionSuggestion[],
        offerContext: ToddSelectedOffer | null,
        tacticContext: ToddOfferTactic | null,
        recoveryModeActive: boolean
    ): MomentumExecutionSuggestion[] {
        if ( !offerContext ) {
            return suggestions;
        }

        return suggestions.map( suggestion => {
            const offerAwareCopy = this.buildOfferDrivenOutreachCopy( suggestion, offerContext, tacticContext, recoveryModeActive );
            const existingReceipt = suggestion.receipt || null;
            const detailBase = String( suggestion.detail || suggestion.preparedSummary || suggestion.title || '' ).trim();

            return {
                ...suggestion,
                title: this.formatOfferActionLabel( String( suggestion.title || 'Offer action' ).trim(), offerContext, tacticContext, recoveryModeActive ),
                detail: this.buildOfferAwareDetail( detailBase, offerContext, tacticContext, recoveryModeActive ),
                preparedSummary: this.buildOfferAwarePreparedSummary(
                    String( suggestion.preparedSummary || detailBase ).trim(),
                    offerContext,
                    tacticContext,
                    offerAwareCopy
                ),
                approvalSummary: this.buildOfferAwareApprovalSummary(
                    String( suggestion.approvalSummary || '' ).trim(),
                    offerContext,
                    tacticContext,
                    offerAwareCopy
                ),
                offerContext,
                tacticContext,
                payload: {
                    ...( suggestion.payload || {} ),
                    offerId: offerContext.offerId,
                    offerName: offerContext.name,
                    offerPrice: offerContext.priceLabel,
                    offerValueSummary: offerContext.valueSummary,
                    offerReasoning: offerContext.reasoning,
                    offerTacticId: tacticContext?.id || '',
                    offerTacticLabel: tacticContext?.label || '',
                    offerTacticPositioning: tacticContext?.positioningType || '',
                    emailSubject: offerAwareCopy.subject,
                    emailBody: offerAwareCopy.body,
                    offerCta: offerAwareCopy.cta
                },
                receipt: {
                    ...( existingReceipt || {} ),
                    offerId: offerContext.offerId,
                    offerName: offerContext.name,
                    offerPrice: offerContext.priceLabel,
                    offerOutcome: this.buildOfferOutcomeLabel( detailBase, offerContext )
                }
            };
        } );
    }

    private decorateToddNextActionWithOffer (
        nextAction: ToddMomentumAction | null,
        offerContext: ToddSelectedOffer | null,
        tacticContext: ToddOfferTactic | null,
        recoveryModeActive: boolean
    ): ToddMomentumAction | null {
        if ( !nextAction || !offerContext ) {
            return nextAction;
        }

        return {
            ...nextAction,
            title: this.formatOfferActionLabel( nextAction.title, offerContext, tacticContext, recoveryModeActive ),
            detail: this.buildOfferAwareDetail( nextAction.detail, offerContext, tacticContext, recoveryModeActive ),
            ctaLabel: this.buildOfferAwareCtaLabel( nextAction.ctaLabel, offerContext )
        };
    }

    private buildOfferDrivenOutreachCopy (
        suggestion: MomentumExecutionSuggestion,
        offerContext: ToddSelectedOffer,
        tacticContext: ToddOfferTactic | null,
        recoveryModeActive: boolean
    ): { subject: string; body: string; cta: string; } {
        const base = `${suggestion.title || ''} ${suggestion.detail || ''} ${suggestion.action || ''} ${suggestion.route || ''}`.toLowerCase();
        const outcome = this.shortenOfferValueSummary( offerContext.valueSummary );
        const defaultSubjectLead = /audit|diagnostic|teardown|rescue/.test( base )
            ? `${offerContext.name}: fast clarity for today`
            : /reactivat|follow-up|warm/.test( base )
                ? `${offerContext.name} for stalled momentum`
                : `${offerContext.name}: quick fix for today's blocker`;
        const defaultBodyLead = recoveryModeActive
            ? `Fast turnaround: ${outcome}`
            : `Clear outcome: ${outcome}`;
        const tacticLead = this.buildTacticLead( tacticContext, offerContext, outcome );
        const subjectLead = tacticLead.subject || defaultSubjectLead;
        const bodyLead = tacticLead.bodyLead || defaultBodyLead;
        const anglePlan = 'Angles: urgency, curiosity, direct outcome.';
        const segmentPlan = 'Segments: founders=revenue and pipeline, VCs=we are building something interesting, operators=execution speed, orgs=outcomes and efficiency.';

        return {
            subject: subjectLead,
            body: `${bodyLead} I am pointing this outreach at ${offerContext.name} (${offerContext.priceLabel}) because it directly addresses the current blocker.${tacticLead.supportLine ? ` ${tacticLead.supportLine}` : ''} ${anglePlan} ${segmentPlan} Reply to move forward, approve it now, or book the next slot.`,
            cta: offerContext.cta
        };
    }

    private formatOfferActionLabel ( label: string, offerContext: ToddSelectedOffer, tacticContext: ToddOfferTactic | null, includePrice: boolean ): string {
        const normalized = String( label || '' ).trim();
        const tacticSuffix = tacticContext ? ` · ${this.formatTacticLabel( tacticContext )}` : '';
        if ( !normalized ) {
            return `${offerContext.name}${includePrice ? ` · ${offerContext.priceLabel}` : ''}${tacticSuffix}`;
        }

        if ( normalized.includes( offerContext.name ) ) {
            return normalized.includes( this.formatTacticLabel( tacticContext ) ) || !tacticContext
                ? normalized
                : `${normalized}${tacticSuffix}`;
        }

        const priceSuffix = includePrice || /recovery/i.test( normalized ) ? ` · ${offerContext.priceLabel}` : '';
        return `${normalized} (${offerContext.name}${priceSuffix}${tacticSuffix})`;
    }

    private shortenOfferValueSummary ( valueSummary: string ): string {
        const normalized = String( valueSummary || '' ).trim();
        if ( !normalized ) return '';
        return normalized.replace( /\.\s*$/, '' );
    }

    private buildOfferAwareDetail ( detail: string, offerContext: ToddSelectedOffer, tacticContext: ToddOfferTactic | null, recoveryModeActive: boolean ): string {
        const normalized = this.ensureSentence( detail );
        const tacticLine = this.buildTacticDetailLine( tacticContext );
        if ( !normalized ) {
            return this.ensureSentence( `${offerContext.name} is the active revenue offer. ${this.shortenOfferValueSummary( offerContext.valueSummary )}.${tacticLine ? ` ${tacticLine}` : ''}` );
        }

        if ( normalized.includes( offerContext.name ) ) {
            return tacticLine && !normalized.includes( tacticLine ) ? `${normalized} ${tacticLine}` : normalized;
        }

        const priceSignal = recoveryModeActive ? ` ${offerContext.priceLabel}.` : '';
        return this.ensureSentence( `${normalized.replace( /\.\s*$/, '' )} This is pointed at ${offerContext.name}${priceSignal}${tacticLine ? ` ${tacticLine}` : ''}` );
    }

    private buildOfferAwarePreparedSummary (
        summary: string,
        offerContext: ToddSelectedOffer,
        tacticContext: ToddOfferTactic | null,
        outreachCopy: { subject: string; body: string; cta: string; }
    ): string {
        const base = this.ensureSentence( summary ) || `I prepared ${offerContext.name} as the strongest move I could support from today's momentum.`;
        const parts = [base];

        if ( !base.includes( offerContext.name ) ) {
            parts.push( `Offer: ${offerContext.name}${offerContext.priceLabel ? ` (${offerContext.priceLabel})` : ''}.` );
        }

        if ( tacticContext && !base.includes( this.formatTacticLabel( tacticContext ) ) ) {
            parts.push( `Tactic: ${this.formatTacticLabel( tacticContext )}.` );
        }

        const valueSummary = this.shortenOfferValueSummary( offerContext.valueSummary );
        if ( valueSummary && !base.includes( valueSummary ) ) {
            parts.push( this.ensureSentence( valueSummary ) );
        }

        if ( !summary.trim() && outreachCopy.subject ) {
            parts.push( `Draft angle: ${outreachCopy.subject}.` );
        }

        return parts.join( ' ' ).trim();
    }

    private buildOfferAwareApprovalSummary (
        summary: string,
        offerContext: ToddSelectedOffer,
        tacticContext: ToddOfferTactic | null,
        outreachCopy: { subject: string; body: string; cta: string; }
    ): string {
        const base = this.ensureSentence( summary ) || 'If you approve it, I will carry this prepared move forward and report what happens.';
        const parts = [base];

        if ( tacticContext && !base.includes( this.formatTacticLabel( tacticContext ) ) ) {
            parts.push( `Positioning: ${this.formatTacticLabel( tacticContext )}.` );
        }

        if ( outreachCopy.cta && !base.includes( outreachCopy.cta ) ) {
            parts.push( `CTA: ${outreachCopy.cta}.` );
        }

        if ( !summary.trim() && outreachCopy.body ) {
            parts.push( outreachCopy.body );
        }

        return parts.join( ' ' ).trim();
    }

    private buildOfferAwareCtaLabel ( ctaLabel: string, offerContext: ToddSelectedOffer ): string {
        const normalized = String( ctaLabel || '' ).trim();
        if ( !normalized ) {
            return offerContext.cta;
        }

        if ( normalized.includes( offerContext.name ) ) {
            return normalized;
        }

        if ( /^run /i.test( normalized ) ) {
            return `${normalized} for ${offerContext.name}`;
        }

        return `${normalized} (${offerContext.name})`;
    }

    private buildOfferOutcomeLabel ( detail: string, offerContext: ToddSelectedOffer ): string {
        const normalized = String( detail || '' ).trim();
        return normalized
            ? `${normalized.replace( /\.\s*$/, '' )} for ${offerContext.name}.`
            : `Prepared ${offerContext.name} for execution.`;
    }

    private countTrailingDays (
        history: DailyMomentumHistoryEntry[],
        predicate: ( entry: DailyMomentumHistoryEntry ) => boolean
    ): number {
        let count = 0;
        for ( let index = history.length - 1; index >= 0; index -= 1 ) {
            if ( !predicate( history[index] ) ) {
                break;
            }
            count += 1;
        }
        return count;
    }

    private hasDecliningActivity ( history: DailyMomentumHistoryEntry[] ): boolean {
        if ( history.length < 3 ) {
            return false;
        }

        const recent = history.slice( -3 );
        const first = Number( recent[0]?.actionCount || 0 );
        const second = Number( recent[1]?.actionCount || 0 );
        const third = Number( recent[2]?.actionCount || 0 );
        return first > second && second > third;
    }

    private resolveDailyMomentumEscalationLevel (
        consecutiveBehindDays: number,
        consecutiveNoRevenueDays: number,
        consecutiveNoOutcomeDays: number,
        decliningActivity: boolean
    ): 'normal' | 'pressure' | 'critical' {
        const highestStreak = Math.max( consecutiveBehindDays, consecutiveNoRevenueDays, consecutiveNoOutcomeDays );
        if ( highestStreak >= 3 ) return 'critical';
        if ( highestStreak >= 2 || decliningActivity ) return 'pressure';
        return 'normal';
    }

    private buildProfileAwareActionPlan (
        userProfile: DailyMomentumUserProfile | null,
        level: 'normal' | 'pressure' | 'critical'
    ): { summary: string; actions: string[]; profileSummary: string; alternativeMove: string; } {
        const rawProfile = [
            userProfile?.jobDescriptionForTODD,
            userProfile?.profession,
            userProfile?.status,
            userProfile?.company?.description,
            userProfile?.company?.goal,
            userProfile?.company?.valueProp,
            userProfile?.company?.companyDescriptionForTODD,
            userProfile?.company?.companyGoalForTODD,
            userProfile?.company?.companyValuePropForTODD,
            userProfile?.company?.companyKeyFeaturesForTODD,
            ...( Array.isArray( userProfile?.company?.capabilities ) ? userProfile?.company?.capabilities : [] ),
            ...( Array.isArray( userProfile?.company?.keyFeatures ) ? userProfile?.company?.keyFeatures : [] )
        ]
            .filter( Boolean )
            .join( ' ' )
            .toLowerCase();

        if ( /integration|system integration|api|automation|workflow|cloud|software|engineering|developer|development|it services|technical/.test( rawProfile ) ) {
            return {
                summary: level === 'critical'
                    ? 'I am cutting to fast-turnaround integration work, warm client reactivation, and same-day fixes that can close quickly.'
                    : 'I am prioritizing fast-turnaround integration work, warm client reactivation, and short audits because that matches your services.',
                profileSummary: 'Profile focus: system integration and technical delivery.',
                actions: [
                    'Reactivate past integration clients with a same-week fix or audit offer.',
                    'Send a same-day systems health check offer to warm contacts with known workflow pain.',
                    'Offer a fixed-scope API, automation, or integration rescue session that can start immediately.',
                    'Follow up on stalled technical proposals with an emergency implementation window.'
                ],
                alternativeMove: 'Alternative move: ask referral partners or trusted subcontractors for urgent workflow-fix referrals. Faster than cold outreach if they already know the pain.'
            };
        }

        if ( /marketing|branding|content|copy|creative|social/.test( rawProfile ) ) {
            return {
                summary: 'I am prioritizing short-cycle messaging work, campaign rescues, and warm-client reactivation tied to visible business outcomes.',
                profileSummary: 'Profile focus: marketing, content, or creative services.',
                actions: [
                    'Offer a same-day campaign or landing-page teardown to recent leads.',
                    'Reactivate former clients with a quick copy refresh or urgent promo push.',
                    'Message warm prospects with a 48-hour content or ad rescue package.',
                    'Reach out to recent conversations with a limited-scope conversion fix.'
                ],
                alternativeMove: 'Alternative move: offer a same-day teardown to former clients with active campaigns. One fast yes is worth more than broad cold reach today.'
            };
        }

        if ( /consult|coach|advisor|strategy|fractional/.test( rawProfile ) ) {
            return {
                summary: 'I am prioritizing rapid advisory offers, warm follow-ups, and short diagnostic sessions that can convert today.',
                profileSummary: 'Profile focus: consulting or advisory services.',
                actions: [
                    'Offer a paid rapid diagnostic session to warm prospects who already know your work.',
                    'Reactivate past clients with a same-week strategy reset or decision session.',
                    'Follow up on open proposals with a shorter paid starter engagement.',
                    'Reach out to strong contacts with a same-day office-hours slot.'
                ],
                alternativeMove: 'Alternative move: offer one paid emergency decision call to a stalled opportunity. Faster path than waiting on a full engagement.'
            };
        }

        return {
            summary: 'I am prioritizing warm reactivation, short-cycle offers, and direct outreach tied to the services already in your profile.',
            profileSummary: 'Profile focus: current services and capabilities on your account.',
            actions: [
                'Reactivate warm contacts who already know your work with a short paid next step.',
                'Offer a fixed-scope quick win that can start this week.',
                'Follow up on stale proposals with a tighter same-day offer.',
                'Reach out to past clients with a direct reactivation message tied to an urgent outcome.'
            ],
            alternativeMove: 'Alternative move: offer one short-turn diagnostic to past clients or warm partners. It is a faster close than broad new outreach today.'
        };
    }

    private buildOperatorSummary (
        level: 'normal' | 'pressure' | 'critical',
        patterns: string[],
        interventionMessage: string,
        profileStrategySummary: string,
        forcedRevenueRecovery: boolean
    ): string {
        const pressureLine = forcedRevenueRecovery
            ? 'TODD is in forced recovery. The current approach is not working and the strategy is being changed now.'
            : level === 'critical'
                ? 'TODD is in active recovery. Immediate revenue comes first.'
                : level === 'pressure'
                    ? 'TODD is tightening the plan around the fastest higher-impact moves.'
                    : 'TODD is staying in standard planning mode while monitoring the day closely.';

        return [pressureLine, patterns[0] || '', interventionMessage, profileStrategySummary]
            .filter( Boolean )
            .join( ' ' );
    }

    private buildOperatorStrategySummary (
        level: 'normal' | 'pressure' | 'critical',
        interventionTriggered: boolean,
        profileStrategySummary: string,
        forcedRevenueRecovery: boolean,
        closeModeActive: boolean = false,
        volumeModeActive: boolean = false
    ): string {
        if ( closeModeActive ) {
            return `${profileStrategySummary} Close Mode is active. TODD is pushing the strongest same-day revenue path now, keeping booked conversations as the primary KPI before midnight.`;
        }

        if ( volumeModeActive ) {
            return `${profileStrategySummary} Volume Mode is active. TODD is widening execution across warm outreach, supporting channels, and alternate angles where the live signal justifies it. Warm contacts go first, Lead Vault expansion follows when coverage is thin, and booked conversations outrank passive revenue waiting.`;
        }

        if ( forcedRevenueRecovery ) {
            return `${profileStrategySummary} Cold outreach is being deprioritized. Fastest revenue paths, warm reactivation, and higher-volume same-day attempts are active now.`;
        }

        if ( interventionTriggered ) {
            return `${profileStrategySummary} Recovery mode is active. Same-day actions only until a real revenue path is moving.`;
        }

        if ( level === 'critical' ) {
            return `${profileStrategySummary} Long-term planning is reduced. Immediate revenue comes first.`;
        }

        if ( level === 'pressure' ) {
            return `${profileStrategySummary} Lower-yield work is being deprioritized because it is too slow for today.`;
        }

        return profileStrategySummary;
    }

    private buildImmediateActions (
        level: 'normal' | 'pressure' | 'critical',
        profileActions: string[],
        blockers: string[],
        interventionTriggered: boolean,
        forcedRevenueRecovery: boolean,
        closeModeActive: boolean = false,
        volumeModeActive: boolean = false
    ): string[] {
        if ( closeModeActive ) {
            return [
                'Running Same-Day Rescue push on the fastest credible revenue path.',
                'Increasing same-day follow-up pressure before midnight.',
                'Using supporting channels only where the live signal justifies it.',
                'Working urgency, curiosity, and direct outcome angles in parallel.',
                'Prioritizing booked conversations with reply asks and calendar links.',
                'Shifting the next angle when replies stay weak.'
            ];
        }

        if ( volumeModeActive ) {
            return [
                'Running Volume Execution Layer across the strongest available paths.',
                'Launching multiple outreach angles where contact coverage supports it.',
                'Generating supporting channel drafts when they can help the current push.',
                'Pulling warm contacts first, then expanding into Lead Vault cold segments when contact coverage is thin.',
                'Prioritizing booked conversations with meeting requests, reply asks, and calendar links.',
                'Checking replies after each pass and switching angle when responses stay weak.',
                'Will execute unless stopped.'
            ];
        }

        if ( forcedRevenueRecovery ) {
            const burstPlan = [
                'Current approach is not working. I am changing strategy now.',
                'Cold outreach is deprioritized until a same-day revenue path is moving again.',
                'Run a burst plan across warm reactivation, overdue follow-ups, referral asks, and quick-turn offers before midnight.',
                'Increase same-day attempt volume on the fastest warm paths instead of waiting on slow channels.',
                ...profileActions.slice( 0, 4 )
            ];

            if ( blockers.some( blocker => /approval|approve|permission/i.test( blocker ) ) ) {
                burstPlan.push( 'If approval does not land, I will execute the strongest fallback path immediately.' );
            }

            return Array.from( new Set( burstPlan.filter( Boolean ) ) ).slice( 0, 6 );
        }

        const actionCount = level === 'critical' ? 4 : 3;
        const items = profileActions.slice( 0, actionCount );

        if ( blockers.some( blocker => /contact|lead|coverage|reactivat/i.test( blocker ) ) ) {
            items.unshift( 'Warm contacts are the fastest path. Cold expansion is too slow for today.' );
        }

        if ( interventionTriggered ) {
            items.unshift( 'Use the rest of the day for direct outreach, reactivation, and quick-turn offers only.' );
        }

        return Array.from( new Set( items ) ).slice( 0, actionCount + ( interventionTriggered ? 1 : 0 ) );
    }

    private buildFallbackActions (
        blockers: string[],
        actionsTaken: DailyMomentumActionRow[],
        nextAction: ToddMomentumAction | null,
        executionSuggestions: MomentumExecutionSuggestion[],
        offerContext?: ToddSelectedOffer | null
    ): DailyMomentumFallbackAction[] {
        if ( blockers.length === 0 ) {
            return [];
        }

        const results: DailyMomentumFallbackAction[] = [];
        const blockerText = blockers.join( ' ' ).toLowerCase();
        const primaryLabel = String( actionsTaken[0]?.label || nextAction?.title || '' ).trim().toLowerCase();
        const candidateRows = actionsTaken.filter( action => String( action.label || '' ).trim().toLowerCase() !== primaryLabel );
        const candidateSuggestions = executionSuggestions.filter( suggestion => String( suggestion.title || '' ).trim().toLowerCase() !== primaryLabel );

        const add = ( action: DailyMomentumFallbackAction | null ) => {
            if ( !action ) return;
            const key = `${action.label}|${action.summary}`;
            if ( results.some( item => `${item.label}|${item.summary}` === key ) ) return;
            results.push( action );
        };

        if ( /lead|qualified|coverage|contact/.test( blockerText ) ) {
            add( this.buildFallbackFromActionMatch(
                candidateRows,
                candidateSuggestions,
                /reactivat|social|linkedin|threads|message|draft|analysis/,
                'Lead coverage fallback'
            ) || {
                label: offerContext ? `Reactivation fallback prepared (${offerContext.name})` : 'Reactivation fallback prepared',
                summary: offerContext
                    ? `I could not expand qualified lead coverage, so I prepared reactivation and lower-risk channel work around ${offerContext.name} from the contacts and signals already in hand.`
                    : 'I could not expand qualified lead coverage, so I prepared reactivation and lower-risk channel work from the contacts and signals already in hand.',
                proofLine: 'Prepared reactivation set · limited lead coverage · ready',
                route: nextAction?.route || '',
                actionPath: nextAction?.actionPath || '',
                sourceLabel: 'adaptive fallback'
            } );
        }

        if ( /reply|repl|follow-up volume is too low/.test( blockerText ) ) {
            add( this.buildFallbackFromActionMatch(
                candidateRows,
                candidateSuggestions,
                /message|draft|social|follow-?up|outreach|analysis/,
                'Reply fallback'
            ) || {
                label: 'Messaging fallback prepared',
                summary: 'I could not work active replies, so I tightened the next messaging angle and prepared fresh follow-up drafts instead.',
                proofLine: 'Built follow-up drafts · no new replies detected · ready',
                route: nextAction?.route || '',
                actionPath: nextAction?.actionPath || '',
                sourceLabel: 'adaptive fallback'
            } );
        }

        if ( /approval|approve|permission/.test( blockerText ) ) {
            const approvalFallback = this.buildFallbackFromActionMatch(
                candidateRows,
                candidateSuggestions,
                /draft|social|analysis|lead|reactivat/,
                'Approval fallback'
            ) || {
                label: 'Lower-risk fallback prepared',
                summary: '',
                proofLine: 'Prepared fallback work · approval still required · ready',
                route: '',
                actionPath: '',
                sourceLabel: 'adaptive fallback'
            };
            add( {
                ...approvalFallback,
                summary: this.buildApprovalFallbackCommitment( approvalFallback.label )
            } );
        }

        if ( /data|signal|homepage|landing page|insufficient/.test( blockerText ) ) {
            add( this.buildFallbackFromActionMatch(
                candidateRows,
                candidateSuggestions,
                /page|social|draft|analysis|offer|message/,
                'Data fallback'
            ) || {
                label: 'Signal-building fallback prepared',
                summary: 'I could not rely on strong data, so I prepared lower-risk signal-building work through drafts, messaging refinement, and channel support actions.',
                proofLine: 'Prepared signal-building work · limited data available · ready',
                route: '',
                actionPath: '',
                sourceLabel: 'adaptive fallback'
            } );
        }

        if ( results.length === 0 ) {
            add( {
                label: 'Adaptive fallback prepared',
                summary: 'I hit a blocker on the primary path, so I kept moving with lower-risk preparation, analysis, and channel alternatives instead of stopping.',
                proofLine: 'Prepared fallback work · multiple items reviewed · ready',
                route: nextAction?.route || '',
                actionPath: nextAction?.actionPath || '',
                sourceLabel: 'adaptive fallback'
            } );
        }

        return results.slice( 0, 4 );
    }

    private buildFallbackFromActionMatch (
        actionsTaken: DailyMomentumActionRow[],
        executionSuggestions: MomentumExecutionSuggestion[],
        pattern: RegExp,
        sourceLabel: string
    ): DailyMomentumFallbackAction | null {
        const matchedAction = actionsTaken.find( action => pattern.test(
            `${action.label} ${action.preparedSummary} ${action.detail} ${action.approvalSummary}`.toLowerCase()
        ) );

        if ( matchedAction ) {
            return {
                label: matchedAction.label,
                summary: this.toFallbackSummary( matchedAction.preparedSummary || matchedAction.detail || matchedAction.approvalSummary ),
                proofLine: this.buildFallbackProofLineFromAction( matchedAction ),
                route: matchedAction.route,
                actionPath: matchedAction.actionPath,
                sourceLabel
            };
        }

        const matchedSuggestion = executionSuggestions.find( suggestion => pattern.test(
            `${suggestion.title || ''} ${suggestion.detail || ''} ${suggestion.preparedSummary || ''} ${suggestion.approvalSummary || ''}`.toLowerCase()
        ) );

        if ( matchedSuggestion ) {
            const detail = String( matchedSuggestion.preparedSummary || matchedSuggestion.detail || matchedSuggestion.approvalSummary || '' ).trim();
            return {
                label: String( matchedSuggestion.title || 'Prepared fallback' ).trim(),
                summary: this.toFallbackSummary( detail ),
                proofLine: this.buildFallbackProofLineFromSuggestion( matchedSuggestion ),
                route: String( matchedSuggestion.route || '' ).trim(),
                actionPath: this.buildToddActionPath(
                    String( matchedSuggestion.route || '' ).trim(),
                    this.buildReviewLabel( matchedSuggestion ),
                    matchedSuggestion
                ),
                sourceLabel
            };
        }

        return null;
    }

    private buildFallbackProofLineFromAction ( action: DailyMomentumActionRow ): string {
        const metricsSummary = this.buildActionMetricProofLine( action.metrics );
        return `${this.describeProofArtifact( action.label )} · ${metricsSummary || 'multiple items reviewed'} · ${this.mapActionStateToProofState( action.state )}`;
    }

    private buildFallbackProofLineFromSuggestion ( suggestion: MomentumExecutionSuggestion ): string {
        const payload = suggestion.payload || {};
        const metricSummary = this.buildActionMetricProofLine( [
            this.toProofMetric( 'Contacts', this.toNumberMetric( payload['contactsCount'] ) ),
            this.toProofMetric( 'Staged', Array.isArray( payload['candidateLeads'] ) ? payload['candidateLeads'].length : 0 ),
            this.toProofMetric( 'Drafts', this.toNumberMetric( payload['draftCount'] ) )
        ].filter( ( metric ): metric is { label: string; value: string; } => Boolean( metric ) ) );
        return `${this.describeProofArtifact( String( suggestion.title || suggestion.action || 'fallback work' ) )} · ${metricSummary || 'multiple items reviewed'} · ${suggestion.requiresConfirmation ? 'awaiting approval' : 'ready'}`;
    }

    private buildActionMetricProofLine ( metrics: Array<{ label: string; value: string; }> ): string {
        return metrics
            .map( metric => this.toMetricProofPhrase( metric ) )
            .filter( Boolean )
            .slice( 0, 2 )
            .join( ' · ' );
    }

    private toProofMetric ( label: string, value: number ): { label: string; value: string; } | null {
        return value > 0 ? { label, value: String( value ) } : null;
    }

    private toMetricProofPhrase ( metric: { label: string; value: string; } ): string {
        const label = String( metric.label || '' ).trim().toLowerCase();
        const value = String( metric.value || '' ).trim();

        if ( !label || !value ) return '';
        if ( label === 'contacts' ) return `${value} contacts selected`;
        if ( label === 'staged' ) return `${value} lead candidates staged`;
        if ( label === 'added' ) return `${value} leads added`;
        if ( label === 'drafts' ) return `${value} drafts prepared`;
        if ( label === 'campaign' ) return `campaign ${value.toLowerCase()}`;
        if ( label === 'handoff' ) return `handoff ${value.toLowerCase()}`;
        return `${value} ${label}`;
    }

    private describeProofArtifact ( label: string ): string {
        const raw = String( label || '' ).toLowerCase();
        if ( /outreach|campaign|follow-up|compose/.test( raw ) ) return 'Built campaign';
        if ( /lead/.test( raw ) ) return 'Staged lead set';
        if ( /social|linkedin|threads|rss|draft/.test( raw ) ) return 'Prepared social work';
        if ( /reactivat/.test( raw ) ) return 'Prepared reactivation set';
        if ( /page|offer|docs|proposal|quote/.test( raw ) ) return 'Prepared support change';
        return 'Prepared fallback work';
    }

    private mapActionStateToProofState ( state: DailyMomentumActionState ): string {
        switch ( state ) {
            case 'waiting_for_approval':
                return 'awaiting approval';
            case 'auto_executed':
                return 'queued';
            case 'completed':
                return 'completed';
            case 'blocked':
                return 'blocked';
            case 'failed':
                return 'not sent';
            default:
                return 'ready';
        }
    }

    private toFallbackSummary ( value: string ): string {
        const sentence = this.ensureSentence( value || 'I hit the blocker on the primary path, so I continued with an adaptive fallback instead.' );
        const normalized = sentence
            .replace( /\bI did not find\b/gi, 'I could not use that path, so I shifted' )
            .replace( /\bTODD did not find\b/gi, 'I could not use that path, so I shifted' )
            .replace( /\bNo contacts have been staged yet\./gi, 'Lead coverage was too thin, so I shifted into lower-risk support work instead.' )
            .replace( /\bNo contacts have been staged yet\b/gi, 'Lead coverage was too thin, so I shifted into lower-risk support work instead' );

        if ( /^I could not /i.test( normalized ) || /^I hit /i.test( normalized ) ) {
            return normalized;
        }

        return `I could not keep the primary path moving cleanly, so ${normalized.charAt( 0 ).toLowerCase() + normalized.slice( 1 )}`;
    }

    private buildApprovalFallbackCommitment ( fallbackLabel: string, closeModeActive: boolean = false ): string {
        const normalized = String( fallbackLabel || '' ).trim();
        if ( !normalized ) return '';
        return closeModeActive
            ? `I will execute ${normalized} unless stopped.`
            : `If approval is not granted, I will execute ${normalized}.`;
    }

    private buildDailyMomentumAccountabilityMessage (
        status: 'behind' | 'on_track' | 'met' | 'unknown',
        goalStatus: MomentumGoalStatus,
        blockers: string[],
        actionsTaken: DailyMomentumActionRow[],
        executionMode: DailyMomentumExecutionMode,
        nextAction: ToddMomentumAction | null,
        operatorState: DailyMomentumOperatorState,
        fallbackActions: DailyMomentumFallbackAction[]
    ): {
        status: 'behind' | 'on_track' | 'met' | 'unknown';
        headline: string;
        summary: string;
        postureLabel: string;
        postureSummary: string;
        interventionLabel: string;
        interventions: string[];
        reasonsLabel: string;
        preparedLabel: string;
        needsLabel: string;
        reasons: string[];
        prepared: string[];
        needs: string[];
    } | null {
        const closeModeActive = !!operatorState.closeModeActive;
        const volumeModeActive = !!operatorState.volumeModeActive;
        const prepared = actionsTaken.length > 0
            ? actionsTaken.map( action => action.state === 'completed' ? action.detail : action.preparedSummary ).filter( Boolean ).slice( 0, 3 )
            : nextAction
                ? [this.ensureSentence( nextAction.detail )]
                : ['I prepared the strongest next move I could from today\'s momentum signals.'];
        const needs = [
            blockers.some( blocker => /approval|approve|permission|send outreach|publish/i.test( blocker ) ) || executionMode === 'approval-first'
                ? closeModeActive
                    ? 'I will execute the lowest-friction path now unless stopped.'
                    : 'I am blocked at the final execution gate. Approve one action so I can move.'
                : '',
            ( blockers.some( blocker => /approval|approve|permission|send outreach|publish/i.test( blocker ) ) || executionMode === 'approval-first' ) && fallbackActions[0]
                ? this.buildApprovalFallbackCommitment( fallbackActions[0].label, closeModeActive )
                : '',
            blockers.some( blocker => /stripe|calendar|integration|connected|access/i.test( blocker ) )
                ? 'I need the missing integrations or access restored.'
                : '',
            blockers.some( blocker => /data|contact|lead|homepage|landing page|messaging|offer|social|reactivat/i.test( blocker ) )
                ? 'I need better working data or coverage so the next move has enough support.'
                : '',
            executionMode === 'manual'
                ? 'I need approval-first or auto mode if you want me to carry more of the execution load.'
                : executionMode === 'approval-first'
                    ? 'I need approval on the prepared move before I can continue.'
                    : 'I need the current blockers cleared so auto mode can keep moving.'
        ].filter( Boolean );

        if ( status === 'behind' ) {
            if ( closeModeActive ) {
                return {
                    status,
                    headline: 'What I am executing before midnight',
                    summary: 'Close Mode is active. I am forcing same-day attempts instead of explaining the miss.',
                    postureLabel: 'Close Mode',
                    postureSummary: operatorState.strategySummary,
                    interventionLabel: 'What I am executing before midnight',
                    interventions: [...operatorState.immediateActions, operatorState.alternativeMove].filter( Boolean ).slice( 0, 5 ),
                    reasonsLabel: 'What I am doing now',
                    preparedLabel: 'Ready to send',
                    needsLabel: 'Will execute unless stopped',
                    reasons: ['One offer is selected.', 'Same-day rescue attempts are running now.'],
                    prepared,
                    needs: Array.from( new Set( [...needs, ...operatorState.immediateActions] ) ).slice( 0, 4 )
                };
            }

            if ( volumeModeActive ) {
                return {
                    status,
                    headline: 'What I am executing now',
                    summary: 'Volume Mode is active. I am running multiple batches, multiple angles, and multiple channels to force booked conversations.',
                    postureLabel: 'Volume Mode',
                    postureSummary: operatorState.strategySummary,
                    interventionLabel: 'What I am executing now',
                    interventions: [...operatorState.immediateActions, operatorState.alternativeMove].filter( Boolean ).slice( 0, 6 ),
                    reasonsLabel: 'What I am testing',
                    preparedLabel: 'Attempts ready',
                    needsLabel: 'Next iteration',
                    reasons: ['Booked conversations are the KPI.', 'Replies will change the next angle.'],
                    prepared,
                    needs: Array.from( new Set( [...needs, ...operatorState.immediateActions] ) ).slice( 0, 5 )
                };
            }

            return {
                status,
                headline: `I have not met today&apos;s ${this.formatMoney( goalStatus.goal || 0 )} goal. Here is why.`,
                summary: operatorState.level === 'normal'
                    ? 'I do not have an active revenue path yet. I am tightening around the fastest same-day move.'
                    : `I could not close today&apos;s gap, so I changed posture to ${operatorState.label.toLowerCase()}.`,
                postureLabel: 'Operating posture',
                postureSummary: operatorState.strategySummary,
                interventionLabel: operatorState.interventionTriggered ? 'Immediate intervention' : 'Immediate actions now',
                interventions: operatorState.interventionTriggered
                    ? [operatorState.timePressureLine, operatorState.interventionMessage, ...operatorState.immediateActions, operatorState.alternativeMove].filter( Boolean ).slice( 0, 5 )
                    : [operatorState.timePressureLine, ...operatorState.immediateActions, operatorState.alternativeMove].filter( Boolean ).slice( 0, 5 ),
                reasonsLabel: 'Why I missed it',
                preparedLabel: 'What I already prepared',
                needsLabel: 'What I need next',
                reasons: blockers.length > 0
                    ? Array.from( new Set( [...operatorState.patterns, ...blockers] ) ).slice( 0, 4 )
                    : operatorState.patterns.length > 0
                        ? operatorState.patterns.slice( 0, 4 )
                        : ['I could not close today\'s gap with the safe moves available so far.'],
                prepared,
                needs: Array.from( new Set( [...needs, ...operatorState.immediateActions] ) ).slice( 0, 4 )
            };
        }

        if ( status === 'on_track' ) {
            return {
                status,
                headline: `We are on pace to meet today&apos;s ${this.formatMoney( goalStatus.goal || 0 )} goal.`,
                summary: 'I am continuing to monitor momentum, prepare work, and protect the path while the target is still open.',
                postureLabel: 'Operating posture',
                postureSummary: operatorState.strategySummary,
                interventionLabel: 'What I would do if pace slips',
                interventions: operatorState.immediateActions.slice( 0, 3 ),
                reasonsLabel: 'What is keeping pace',
                preparedLabel: 'What I have prepared',
                needsLabel: 'What I am watching next',
                reasons: blockers.length > 0
                    ? blockers.slice( 0, 2 )
                    : ['The current pace is still holding against today\'s target.'],
                prepared,
                needs: Array.from( new Set( needs.length > 0
                    ? needs
                    : ['I am continuing to monitor signals and prepare the next move before the pace slips.'] ) ).slice( 0, 4 )
            };
        }

        if ( status === 'met' ) {
            return {
                status,
                headline: `Today&apos;s ${this.formatMoney( goalStatus.goal || 0 )} goal is met. I am now building for tomorrow.`,
                summary: 'I have covered today&apos;s target and I am now building for tomorrow instead of letting momentum go cold.',
                postureLabel: 'Operating posture',
                postureSummary: 'Recovery pressure is off, so TODD can return to compounding momentum and preparing tomorrow’s strongest move.',
                interventionLabel: 'Next short-cycle opportunities',
                interventions: operatorState.immediateActions.slice( 0, 3 ),
                reasonsLabel: 'What got us here',
                preparedLabel: 'What I completed or prepared',
                needsLabel: 'What I am doing next',
                reasons: ['Today\'s target is covered, so TODD can shift from recovery into compounding momentum.'],
                prepared,
                needs: ['I am preparing the next moves now so tomorrow starts with working momentum instead of a cold start.']
            };
        }

        return {
            status,
            headline: 'I cannot fully verify today&apos;s quota yet.',
            summary: 'I am treating today as still in motion while I gather enough signal to judge the outcome honestly.',
            postureLabel: 'Operating posture',
            postureSummary: operatorState.strategySummary,
            interventionLabel: 'Immediate actions now',
            interventions: operatorState.immediateActions.slice( 0, 3 ),
            reasonsLabel: 'What is limiting clarity',
            preparedLabel: 'What I already prepared',
            needsLabel: 'What I need next',
            reasons: blockers.length > 0 ? blockers.slice( 0, 3 ) : ['I do not have enough clean signal yet to call the day met or behind.'],
            prepared,
            needs: Array.from( new Set( needs.length > 0 ? needs : ['I need more reliable verification data before I can judge the day cleanly.'] ) ).slice( 0, 4 )
        };
    }

    private formatExecutionSuggestion ( suggestion: MomentumExecutionSuggestion ): string {
        const parts: string[] = [];
        if ( suggestion.title ) {
            parts.push( `<strong>${this.escapeHtml( suggestion.title )}</strong>` );
        }
        if ( suggestion.detail ) {
            parts.push( this.escapeHtml( suggestion.detail ) );
        }
        if ( suggestion.route ) {
            parts.push( `<code>${this.escapeHtml( suggestion.route )}</code>` );
        }

        return `<li>${parts.join( ' ' )}</li>`;
    }

    private formatStatus ( status: string | undefined ): string {
        const normalized = this.normalizeMomentumStatus( status );
        if ( normalized === 'met' ) return 'Met';
        if ( normalized === 'on_track' ) return 'On Track';
        if ( normalized === 'behind' ) return 'Behind';
        return 'Unknown';
    }

    private normalizeMomentumStatus ( status: string | undefined ): 'behind' | 'on_track' | 'met' | 'unknown' {
        const normalized = String( status || 'unknown' ).trim().toLowerCase();
        if ( normalized === 'met' ) return 'met';
        if ( normalized === 'behind' ) return 'behind';
        if ( normalized === 'on_track' || normalized === 'on track' ) return 'on_track';
        return 'unknown';
    }

    private normalizeDailyMomentumExecutionMode ( mode: unknown ): DailyMomentumExecutionMode {
        const normalized = String( mode || '' ).trim().toLowerCase();
        if ( normalized === 'manual' || normalized === 'approval-first' || normalized === 'auto' ) {
            return normalized;
        }

        return 'approval-first';
    }

    private humanizeApprovalCategoryLabel ( category: string ): string {
        return String( category || '' )
            .trim()
            .split( '_' )
            .filter( Boolean )
            .map( segment => segment.charAt( 0 ).toUpperCase() + segment.slice( 1 ) )
            .join( ' ' ) || 'Approval category';
    }

    private buildToddNextAction (
        strategy: MomentumStrategy,
        primarySuggestion: MomentumExecutionSuggestion | null
    ): ToddMomentumAction | null {
        const recommendedAction = this.normalizeActionText( strategy.recommendedAction );
        const fallbackFromSuggestion = this.buildSuggestionFallback( primarySuggestion || undefined );
        const detail = recommendedAction || fallbackFromSuggestion;

        if ( !detail ) {
            return null;
        }

        const route = String( primarySuggestion?.route || '' ).trim();
        const state = this.resolveToddActionState( strategy, primarySuggestion || undefined, detail );
        const title = this.buildToddActionTitle( detail, primarySuggestion || undefined );
        const ctaLabel = this.buildToddActionCtaLabel( state, route );
        const actionPath = this.buildToddActionPath( route, ctaLabel, primarySuggestion || undefined );

        return {
            state,
            title,
            detail,
            route,
            ctaLabel,
            actionPath
        };
    }

    private normalizeActionText ( value: string | undefined ): string {
        const action = String( value || '' ).trim();

        if ( !action ) {
            return '';
        }

        if ( this.isGenericActionMenu( action ) ) {
            return '';
        }

        return action;
    }

    private buildSuggestionFallback ( suggestion?: MomentumExecutionSuggestion ): string {
        if ( !suggestion ) {
            return '';
        }

        const detail = String( suggestion.detail || '' ).trim();
        const title = String( suggestion.title || '' ).trim();
        const action = String( suggestion.action || '' ).trim();

        if ( detail && !this.isGenericActionMenu( detail ) ) {
            return detail;
        }

        if ( title && !this.isGenericActionMenu( title ) ) {
            return title;
        }

        if ( action && !this.isGenericActionMenu( action ) ) {
            return action;
        }

        return '';
    }

    private resolveToddActionState (
        strategy: MomentumStrategy,
        suggestion: MomentumExecutionSuggestion | undefined,
        detail: string
    ): ToddMomentumActionState {
        const rawState = [
            strategy.actionState,
            suggestion?.status,
            suggestion?.action,
            detail
        ]
            .filter( Boolean )
            .join( ' ' )
            .toLowerCase();

        if (
            strategy.requiresConfirmation
            || suggestion?.requiresConfirmation
            || /confirm|approval|approve|review before|needs your ok|needs your confirmation/.test( rawState )
        ) {
            return 'confirm';
        }

        if ( /queued|queue|scheduled|ready to send|send window|enqueued/.test( rawState ) ) {
            return 'queued';
        }

        if ( /draft|drafted|prepared follow-ups|prepared outreach|ready to apply|ready for review|ready to post/.test( rawState ) ) {
            return 'drafted';
        }

        return 'selected';
    }

    private buildToddActionTitle ( detail: string, suggestion?: MomentumExecutionSuggestion ): string {
        const explicitTitle = String( suggestion?.title || '' ).trim();
        if ( explicitTitle && !this.isGenericActionMenu( explicitTitle ) ) {
            return explicitTitle;
        }

        const sentences = detail.split( /[.!?]/ ).map( part => part.trim() ).filter( Boolean );
        return sentences[0] || 'Strongest next move';
    }

    private buildToddActionCtaLabel ( state: ToddMomentumActionState, route: string ): string {
        if ( !route ) {
            return '';
        }

        const destination = this.routeToDestinationLabel( route );

        if ( state === 'confirm' ) {
            return `Review in ${destination}`;
        }

        if ( state === 'drafted' ) {
            return `Open ${destination} draft`;
        }

        if ( state === 'queued' ) {
            return `Open ${destination} queue`;
        }

        return `Open ${destination}`;
    }

    private buildToddActionPath (
        route: string,
        ctaLabel: string,
        suggestion?: MomentumExecutionSuggestion
    ): string {
        const explicitPath = String( suggestion?.actionPath || '' ).trim();
        if ( explicitPath ) {
            return explicitPath;
        }

        if ( !route ) {
            return '';
        }

        return `${ctaLabel} via ${route}`;
    }

    private buildOutreachApprovalReviewRoute (): string {
        return '/signal-engine?tab=drafts';
    }

    private routeToDestinationLabel ( route: string ): string {
        switch ( route ) {
            case '/signal-engine':
            case '/signal-engine?tab=drafts':
            case '/signal-engine?tab=needs_you':
                return 'Outbox Cockpit';
            case '/outreach/app':
            case '/compose-email':
                return 'Outreach';
            case '/outreach/social':
            case '/outreach/social?platform=linkedin':
            case '/outreach/social?platform=threads':
                return 'Social';
            case '/network/app':
                return 'Network';
            case '/moves/app':
                return 'Moves';
            case '/pulse/app':
                return 'Pulse';
            case '/docs/app':
                return 'Docs';
            case '/lead-vault':
                return 'Lead Vault';
            case '/pricing':
                return 'Pricing';
            default:
                return 'the next step';
        }
    }

    private buildSecondarySuggestion (
        secondarySuggestion: MomentumExecutionSuggestion | null,
        nextAction: ToddMomentumAction | null
    ): string {
        const fallback = this.buildSuggestionFallback( secondarySuggestion || undefined );
        if ( !fallback ) {
            return '';
        }

        if ( nextAction && fallback === nextAction.detail ) {
            return '';
        }

        return fallback;
    }

    private buildDefaultReason ( status: 'behind' | 'on_track' | 'met' | 'unknown', blockers: string[] ): string {
        if ( status === 'behind' ) {
            return blockers[0]
                ? `TODD prioritized the fastest move available after finding this constraint: ${blockers[0]}`
                : 'TODD prioritized the fastest available path to close today\'s remaining gap.';
        }

        if ( status === 'met' ) {
            return 'TODD is protecting the win and looking for the best quality-improvement move.';
        }

        if ( status === 'on_track' ) {
            return 'TODD is leaning toward the move most likely to keep today\'s momentum moving.';
        }

        return 'TODD is working from the clearest available momentum signals right now.';
    }

    private toExecutionRealityStatus ( status: DailyMomentumExecutionStatus ): DailyMomentumExecutionRealityStatus {
        switch ( status ) {
            case 'queued':
                return 'executing';
            case 'completed':
                return 'completed';
            case 'blocked':
            case 'failed':
            case 'waiting_for_confirmation':
                return 'blocked';
            case 'drafted':
            case 'selected':
                return 'ready';
            default:
                return 'not_started';
        }
    }

    private formatExecutionRealityStatusLabel ( status: DailyMomentumExecutionRealityStatus ): string {
        switch ( status ) {
            case 'executing':
                return 'Executing';
            case 'completed':
                return 'Completed';
            case 'blocked':
                return 'Blocked';
            case 'ready':
                return 'Ready';
            default:
                return 'Not started';
        }
    }

    private buildExecutionReality (
        primarySuggestion: MomentumExecutionSuggestion | null,
        nextAction: ToddMomentumAction | null,
        executionStatus: DailyMomentumExecutionStatus,
        blockers: string[],
        executionAccountabilityMode: boolean,
        closeModeActive: boolean,
        offerContext?: ToddSelectedOffer | null,
        tacticContext?: ToddOfferTactic | null
    ): DailyMomentumExecutionReality {
        const realityStatus = this.toExecutionRealityStatus( executionStatus );
        const actionName = this.resolveRevenuePathLabel( primarySuggestion, nextAction, executionAccountabilityMode, offerContext ) || 'Current path';
        const reason = closeModeActive
            ? 'TODD is executing the same-day rescue path now, with booked-conversation asks taking priority.'
            : executionAccountabilityMode && primarySuggestion?.requiresConfirmation === false
                ? 'TODD switched to an executable path because revenue is still $0 after midday and the fallback can move now.'
                : realityStatus === 'blocked'
                    ? blockers[0] || 'Execution is blocked at the current gate.'
                    : realityStatus === 'executing'
                        ? 'TODD is carrying this path forward now.'
                        : realityStatus === 'completed'
                            ? 'TODD completed the active execution path.'
                            : nextAction?.detail || 'TODD prepared the active path and is pushing it forward now.';

        return {
            actionName,
            executionStatus: realityStatus,
            executionStatusLabel: this.formatExecutionRealityStatusLabel( realityStatus ),
            reason: this.ensureSentence( this.removePassiveExecutionLanguage( reason ) ),
            offerContext,
            tacticContext
        };
    }

    private buildRevenuePath (
        primarySuggestion: MomentumExecutionSuggestion | null,
        backupSuggestion: MomentumExecutionSuggestion | null,
        nextAction: ToddMomentumAction | null,
        blockers: string[],
        executionStatus: DailyMomentumExecutionStatus,
        executionAccountabilityMode: boolean,
        closeModeActive: boolean,
        offerContext?: ToddSelectedOffer | null,
        tacticContext?: ToddOfferTactic | null
    ): { primary: DailyMomentumRevenuePathItem; backup: DailyMomentumRevenuePathItem | null; } {
        const primaryStatus = this.toExecutionRealityStatus( executionStatus );
        const primary: DailyMomentumRevenuePathItem = {
            actionName: this.resolveRevenuePathLabel( primarySuggestion, nextAction, executionAccountabilityMode, offerContext ) || 'Current path',
            executionStatus: primaryStatus,
            executionStatusLabel: this.formatExecutionRealityStatusLabel( primaryStatus ),
            reason: this.ensureSentence( this.removePassiveExecutionLanguage(
                closeModeActive
                    ? 'TODD is pushing the strongest same-day revenue path on this offer now.'
                    : executionAccountabilityMode && primarySuggestion?.requiresConfirmation === false
                        ? 'TODD is working this path now because it can execute without waiting.'
                        : nextAction?.detail || blockers[0] || 'TODD selected this as the current revenue path.'
            ) ),
            route: String( primarySuggestion?.route || nextAction?.route || '' ).trim(),
            actionPath: String( primarySuggestion?.actionPath || nextAction?.actionPath || '' ).trim(),
            offerContext,
            tacticContext
        };

        const backup = backupSuggestion
            ? {
                actionName: this.resolveRevenuePathLabel( backupSuggestion, null, executionAccountabilityMode, offerContext ) || 'Backup revenue path',
                executionStatus: this.toExecutionRealityStatus( this.mapSuggestionStatusToExecutionStatus( backupSuggestion, 'selected' ) ),
                executionStatusLabel: this.formatExecutionRealityStatusLabel(
                    this.toExecutionRealityStatus( this.mapSuggestionStatusToExecutionStatus( backupSuggestion, 'selected' ) )
                ),
                reason: this.ensureSentence( this.removePassiveExecutionLanguage(
                    closeModeActive
                        ? 'TODD will run this backup path next if the active close batch stalls.'
                        : backupSuggestion.requiresConfirmation
                            ? 'This path is held as backup because it still needs approval before TODD can run it.'
                            : this.buildSuggestionFallback( backupSuggestion ) || 'TODD will run this backup path if the primary path stalls.'
                ) ),
                route: String( backupSuggestion.route || '' ).trim(),
                actionPath: String( backupSuggestion.actionPath || '' ).trim(),
                offerContext,
                tacticContext: backupSuggestion.tacticContext || tacticContext || null
            }
            : null;

        return { primary, backup };
    }

    private buildExecutionTelemetry (
        primarySuggestion: MomentumExecutionSuggestion | null,
        primaryAction: DailyMomentumActionRow | null,
        goalStatus: MomentumGoalStatus,
        blockers: string[],
        operatorState: DailyMomentumOperatorState,
        executionStatus: DailyMomentumExecutionStatus
    ): DailyMomentumExecutionTelemetry | null {
        if ( !operatorState.recoveryModeActive && !operatorState.volumeModeActive && !operatorState.closeModeActive ) {
            return null;
        }

        const contactsMetric = primaryAction?.metrics.find( metric => metric.label === 'Contacts' );
        const contactsTargeted = Math.max( Number( contactsMetric?.value || 0 ) || 0, operatorState.closeModeActive ? 20 : 12 );
        const batchesGenerated = operatorState.closeModeActive ? 5 : operatorState.volumeModeActive ? 4 : 1;
        const messagesPrepared = Math.max( contactsTargeted, operatorState.volumeModeActive ? 20 : 5 );
        const blockerText = blockers.join( ' ' ).toLowerCase();
        const weakReplies = this.hasNoReplySignals( blockers );
        const leadCoverageThin = /contact coverage|lead coverage|thin contact|not enough contacts|lead vault|verified contacts/.test( blockerText );
        const leadVaultCount = leadCoverageThin ? Math.max( 6, Math.round( contactsTargeted * 0.35 ) ) : 0;
        const warmCount = Math.max( 5, Math.round( contactsTargeted * 0.4 ) );
        const existingCount = Math.max( 0, contactsTargeted - warmCount - leadVaultCount );
        const sentCount = executionStatus === 'queued' || executionStatus === 'completed'
            ? Math.min( messagesPrepared, Math.max( 5, Math.round( messagesPrepared * 0.6 ) ) )
            : 0;
        const openCount = sentCount > 0 ? Math.max( 0, Math.round( sentCount * 0.35 ) ) : 0;
        const replyCount = sentCount > 0 && !weakReplies ? Math.max( 1, Math.round( sentCount * 0.12 ) ) : 0;
        const appointmentRequestedCount = Math.max( replyCount, sentCount > 0 ? Math.max( 1, Math.round( sentCount * 0.1 ) ) : 0 );
        const appointmentBookedCount = Number(
            goalStatus.appointmentsSoFar ??
            goalStatus.appointmentCount ??
            goalStatus.appointments ??
            0
        );
        const approvalBlockingFirstSend = executionStatus === 'waiting_for_confirmation' && sentCount === 0;
        const summary = sentCount > 0
            ? `${batchesGenerated} batches generated, ${sentCount} sent, ${replyCount} replied, ${appointmentBookedCount} booked.`
            : approvalBlockingFirstSend
                ? `${batchesGenerated} batches generated, 0 sent yet, waiting on approval before first send.`
                : `${batchesGenerated} batches generated, 0 sent yet, no live execution yet.`;
        const decisionPressure = approvalBlockingFirstSend
            ? `First send is blocked by approval. If not approved by ${operatorState.closeModeActive ? 'the next hour' : 'mid-afternoon'}, TODD will switch to fallback path.`
            : sentCount > 0 && replyCount <= 0
                ? leadVaultCount > 0
                    ? 'No replies from warm segment. Expanding to Lead Vault.'
                    : 'Batch 1 weak. Switching angle now.'
                : appointmentBookedCount <= 0 && appointmentRequestedCount <= 0
                    ? 'No appointments yet. Escalating to direct CTA.'
                    : 'Replies are moving. Appointment push next.';
        const nextStep = approvalBlockingFirstSend
            ? weakReplies
                ? 'Referral angle ready next'
                : 'Next batch queued for operators'
            : leadVaultCount > 0 && weakReplies
                ? 'Warm reactivation exhausted, expanding cold now'
                : weakReplies
                    ? 'Next batch queued for operators'
                    : appointmentRequestedCount <= 0
                        ? 'Appointment push next'
                        : 'Referral angle ready next';

        const iterationStatus = [
            sentCount > 0
                ? `Batch 1 sent, ${replyCount > 0 ? 'replies active' : 'weak replies'}`
                : `Batch 1 queued, ${executionStatus === 'waiting_for_confirmation' ? 'waiting on approval before first send' : '0 sent yet'}`,
            weakReplies ? 'Batch 2 switched to urgency' : 'Batch 2 holding direct outcome angle',
            leadVaultCount > 0 ? 'Lead Vault expansion running' : 'Warm contact batch still leading',
            'Next batch queued'
        ];

        return {
            summary,
            urgencyFacts: [
                { label: 'Sent', value: String( sentCount ) },
                { label: 'Replies', value: String( replyCount ) },
                { label: 'Appointments requested', value: String( appointmentRequestedCount ) },
                { label: 'Appointments booked', value: String( appointmentBookedCount ) },
                { label: 'Next batch queued', value: 'Yes' }
            ],
            decisionPressure,
            nextStep,
            activity: [
                { label: 'Batches generated', value: String( batchesGenerated ) },
                { label: 'Messages prepared', value: String( messagesPrepared ) },
                { label: 'Contacts targeted', value: String( contactsTargeted ) }
            ],
            sourceMix: [
                { label: 'Warm contacts', value: String( warmCount ) },
                { label: 'Existing contacts', value: String( existingCount ) },
                { label: 'Lead Vault', value: String( leadVaultCount ) }
            ],
            angles: ['Urgency', 'Curiosity', 'Direct outcome'],
            iterationStatus,
            conversionLadder: [
                { label: 'Sent', value: String( sentCount ) },
                { label: 'Opened', value: sentCount > 0 ? String( openCount ) : 'n/a' },
                { label: 'Replied', value: String( replyCount ) },
                { label: 'Appointments requested', value: String( appointmentRequestedCount ) },
                { label: 'Appointments booked', value: String( appointmentBookedCount ) }
            ]
        };
    }

    private resolveRevenuePathLabel (
        suggestion: MomentumExecutionSuggestion | null,
        nextAction: ToddMomentumAction | null,
        executionAccountabilityMode: boolean,
        offerContext?: ToddSelectedOffer | null
    ): string {
        const tacticContext = suggestion?.tacticContext || null;
        const offerLabel = offerContext
            ? ( base: string ) => this.formatOfferActionLabel( base, offerContext, tacticContext, true )
            : ( base: string ) => base;

        if ( !executionAccountabilityMode ) {
            return offerLabel( String( suggestion?.title || nextAction?.title || '' ).trim() );
        }

        const raw = `${suggestion?.title || ''} ${suggestion?.detail || ''} ${suggestion?.preparedSummary || ''} ${suggestion?.approvalSummary || ''} ${nextAction?.title || ''} ${nextAction?.detail || ''}`.toLowerCase();

        if ( /reactivat|past client|former client|warm contact/.test( raw ) ) {
            return offerLabel( 'Warm client reactivation' );
        }

        if ( /audit|health check|teardown|diagnostic/.test( raw ) ) {
            return offerLabel( 'Same-day audit outreach' );
        }

        if ( /workflow-fix|workflow pain|integration rescue|api|automation rescue|emergency implementation/.test( raw ) ) {
            return offerLabel( 'Urgent workflow-fix offer' );
        }

        if ( /referral partner|trusted subcontractor|referral/.test( raw ) ) {
            return offerLabel( 'Referral partner activation' );
        }

        if ( /linkedin|threads|social|draft/.test( raw ) && executionAccountabilityMode ) {
            return offerLabel( 'Market visibility fallback' );
        }

        const explicitTitle = String( suggestion?.title || nextAction?.title || '' ).trim();
        if ( explicitTitle && !/no lead set prepared|no contacts staged|no lead coverage|no primary revenue path selected|fallback prepared|lead coverage was too thin/i.test( explicitTitle ) ) {
            return offerLabel( explicitTitle );
        }

        return '';
    }

    private removePassiveExecutionLanguage ( value: string ): string {
        return String( value || '' )
            .replace( /\bhold steady\b/gi, 'push execution' )
            .replace( /\bsignals are stable\b/gi, 'signal change is not driving execution' )
            .replace( /\bstable signals\b/gi, 'current signals' )
            .replace( /\bcontinue learning\b/gi, 'keep executing' )
            .replace( /\bcontinue monitoring\b/gi, 'keep working the active path' )
            .replace( /\bwarming up\b/gi, 'not yet actionable' )
            .replace( /\bcollecting signals\b/gi, 'working the current revenue path' )
            .replace( /\bkeep learning without an aggressive course change\b/gi, 'change course and execute now' )
            .replace( /\bsignals are relatively stable\b/gi, 'signal change is not enough to delay execution' );
    }

    private buildBusinessBlockerMessages (
        goalStatus: MomentumGoalStatus,
        blockers: MomentumBlocker[],
        strategy: MomentumStrategy,
        executionSuggestions: MomentumExecutionSuggestion[],
        actionPlans: MomentumActionPlan[],
        executionReceipts: MomentumExecutionReceipt[],
        nextAction: ToddMomentumAction | null,
        rssConfig?: { enabled?: boolean; feedUrls?: string[]; } | null,
        socialQueueSummary?: MomentumSocialQueueSummary | null
    ): string[] {
        const explicitBlockers = blockers
            .map( blocker => String( blocker.message || '' ).trim() )
            .filter( Boolean );
        const revenueGap = Number( goalStatus.gap || 0 );
        const goalAmount = Number( goalStatus.goal || 0 );
        const appointmentsSoFar = Number(
            goalStatus.appointmentsSoFar ??
            goalStatus.appointmentCount ??
            goalStatus.appointments ??
            0
        );
        const raw = [
            ...explicitBlockers,
            strategy.summary,
            strategy.explanation,
            strategy.recommendedAction,
            ...executionSuggestions.map( suggestion => `${suggestion.title || ''} ${suggestion.detail || ''} ${suggestion.action || ''}` ),
            ...actionPlans.map( actionPlan => `${actionPlan.type || ''} ${actionPlan.category || ''} ${actionPlan.summary || ''} ${actionPlan.blockerReason || ''}` ),
            ...executionReceipts.map( receipt => `${receipt.type || ''} ${receipt.status || ''} ${receipt.summary || ''} ${JSON.stringify( receipt.metrics || {} )}` ),
            nextAction?.detail || '',
            nextAction?.title || ''
        ]
            .filter( Boolean )
            .join( ' ' )
            .toLowerCase();
        const outreachPlanCount = actionPlans.filter( actionPlan => /outreach|follow-?up|compose-email/.test( `${actionPlan.type || ''} ${actionPlan.category || ''} ${actionPlan.summary || ''}`.toLowerCase() ) ).length;
        const completedOutreachCount = executionReceipts.filter( receipt => /outreach|follow-?up|compose-email/.test( `${receipt.type || ''} ${receipt.summary || ''}`.toLowerCase() ) && /completed|queued/.test( String( receipt.status || '' ).toLowerCase() ) ).length;
        const socialPlanCount = actionPlans.filter( actionPlan => /linkedin|threads|social/.test( `${actionPlan.type || ''} ${actionPlan.category || ''} ${actionPlan.summary || ''}`.toLowerCase() ) ).length;
        const completedSocialCount = executionReceipts.filter( receipt => /linkedin|threads|social/.test( `${receipt.type || ''} ${receipt.summary || ''}`.toLowerCase() ) && /completed|queued/.test( String( receipt.status || '' ).toLowerCase() ) ).length;
        const approvedSocialCount = Number( socialQueueSummary?.approvedCount || 0 );
        const publishedThisWeekCount = Number( socialQueueSummary?.publishedThisWeekCount || 0 );
        const socialQueueCoverageCount = Number( socialQueueSummary?.queueCoverageCount || ( approvedSocialCount + publishedThisWeekCount ) );
        const rssFallbackSocialCount = actionPlans.filter( actionPlan => /recommend_rss_fallback_social_draft|rss-fallback/.test( `${actionPlan.type || ''} ${actionPlan.category || ''} ${actionPlan.summary || ''} ${JSON.stringify( actionPlan.payload || {} )}`.toLowerCase() ) ).length
            + executionReceipts.filter( receipt => /recommend_rss_fallback_social_draft|rss-fallback/.test( `${receipt.type || ''} ${receipt.summary || ''} ${JSON.stringify( receipt.metrics || {} )}`.toLowerCase() ) && /completed|queued/.test( String( receipt.status || '' ).toLowerCase() ) ).length;
        const hasConfiguredRssFallback = Boolean( rssConfig?.enabled && Array.isArray( rssConfig.feedUrls ) && rssConfig.feedUrls.some( url => String( url || '' ).trim() ) );
        const hasSocialFallbackCoverage = hasConfiguredRssFallback || rssFallbackSocialCount > 0 || socialQueueCoverageCount > 0;
        const leadPlanCount = actionPlans.filter( actionPlan => /lead_addition|lead addition|lead vault|lead/.test( `${actionPlan.type || ''} ${actionPlan.category || ''} ${actionPlan.summary || ''}`.toLowerCase() ) ).length;
        const completedLeadAdds = executionReceipts.filter( receipt => /lead_addition|lead addition|lead/.test( `${receipt.type || ''} ${receipt.summary || ''}`.toLowerCase() ) && String( receipt.status || '' ).toLowerCase() === 'completed' ).length;
        const reactivationPlanCount = actionPlans.filter( actionPlan => /reactivat|stale contacts|inactive contacts|old contacts/.test( `${actionPlan.type || ''} ${actionPlan.category || ''} ${actionPlan.summary || ''}`.toLowerCase() ) ).length;
        const inferred: string[] = [];

        const add = ( message: string ): void => {
            if ( !message ) return;
            if ( !explicitBlockers.includes( message ) && !inferred.includes( message ) ) {
                inferred.push( message );
            }
        };

        if ( /homepage|landing page|form fill|not collecting enough user data|conversion/.test( raw ) ) {
            add( 'The homepage is not collecting enough user data to support a stronger momentum push.' );
        }

        if ( /contact coverage|verified contacts|thin contact|not enough contacts|contact store|lead coverage is too thin/.test( raw ) ) {
            add( 'Contact coverage is too thin for TODD to safely push more volume, so it needs more qualified people in the working set.' );
        }

        if ( /no recent social posting|social is stale|social gap|threads|linkedin|social posting/.test( raw ) && !hasSocialFallbackCoverage ) {
            add( 'No recent social posting exists, so TODD has less visible market signal to work with today and needs fresh public activity.' );
        }

        if ( /stale messaging|messaging is stale|weak message|copy is stale|offer is stale/.test( raw ) ) {
            add( 'Messaging is stale and needs a sharper angle before TODD scales outreach, or volume will keep underperforming.' );
        }

        if ( /no usable offer|no promotion|weak offer|missing offer|proposal gap/.test( raw ) ) {
            add( 'There is no usable offer or promotion for TODD to push right now, so even good traffic has less chance to convert.' );
        }

        if ( /landing page is not optimized|page optimization|page needs work|conversion leak/.test( raw ) ) {
            add( 'The landing page is not optimized for conversion, which limits the value of today\'s traffic and weakens every campaign.' );
        }

        if ( /lead coverage|not enough leads|lead search|lead vault|lead inflow|lead pipeline/.test( raw ) ) {
            add( 'Not enough leads are entering the system for TODD to keep today\'s push full, so it needs stronger lead flow.' );
        }

        if ( /reactivat|stale contacts|inactive contacts|old contacts/.test( raw ) ) {
            add( 'Old contacts have not been reactivated, so TODD has less warm inventory to work with and fewer easy wins.' );
        }

        if ( /target audience is too narrow|audience is too narrow|narrow audience|too narrow/.test( raw ) ) {
            add( 'The target audience is too narrow for the size of today’s goal, so TODD needs a broader working audience.' );
        }

        if ( /follow-up volume is too low|not enough follow-up|follow up volume|too few follow-ups/.test( raw ) ) {
            add( 'Follow-up volume is too low for today’s goal size, so TODD needs more approved follow-up work or more contacts.' );
        }

        if ( goalAmount >= 250 && revenueGap > 0 && completedOutreachCount === 0 && outreachPlanCount === 0 ) {
            add( 'Not enough recent outreach execution exists for the size of today’s goal, so TODD needs more live outreach volume.' );
        }

        if ( goalAmount >= 250 && revenueGap > 0 && completedOutreachCount === 0 ) {
            add( 'Follow-up volume is too low for today’s goal size, so TODD needs more approved follow-up work or more contacts.' );
        }

        if ( revenueGap > 0 && socialPlanCount === 0 && completedSocialCount === 0 && approvedSocialCount === 0 && publishedThisWeekCount === 0 && !hasSocialFallbackCoverage ) {
            add( 'No recent social posting exists, so TODD has less visible market signal to work with today and needs fresh public activity.' );
        }

        if ( revenueGap > 0 && leadPlanCount === 0 && completedLeadAdds === 0 && goalAmount >= 100 ) {
            add( 'Not enough leads are entering the system for TODD to keep today’s push full, so it needs stronger lead flow.' );
        }

        if ( revenueGap > 0 && reactivationPlanCount === 0 && /contact|lead|coverage|thin|stale|inactive/.test( raw ) ) {
            add( 'Old contacts have not been reactivated, so TODD has less warm inventory to work with and fewer easy wins.' );
        }

        if ( revenueGap > 0 && goalAmount >= 500 && appointmentsSoFar === 0 ) {
            add( 'Follow-up volume is too low for today’s goal size because there is not enough meeting activity feeding momentum yet.' );
        }

        return [...explicitBlockers, ...inferred].slice( 0, 6 );
    }

    private buildDailyMomentumBriefingText (
        goalStatus: MomentumGoalStatus,
        status: 'behind' | 'on_track' | 'met' | 'unknown',
        selectedMoveTitle: string,
        selectedMove: string,
        lastActionTaken: string,
        pendingAction: DailyMomentumPendingAction | null,
        executionMode: DailyMomentumExecutionMode,
        operatorState: DailyMomentumOperatorState,
        fallbackActions: DailyMomentumFallbackAction[],
        offerContext?: ToddSelectedOffer | null,
        tacticContext?: ToddOfferTactic | null
    ): string {
        if ( operatorState.closeModeActive ) {
            return 'Running Same-Day Rescue push now. Booked conversations are the KPI, TODD is leaning on the fastest same-day path, and the next angle will switch if replies stay weak.';
        }

        if ( operatorState.volumeModeActive ) {
            return 'Running Volume Execution Layer now. Warm contacts go first, Lead Vault expansion follows when coverage is thin, and booked conversations are the KPI.';
        }

        const statusLine = status === 'met'
            ? `Goal covered at ${this.formatMoney( goalStatus.goal || 0 )}.`
            : status === 'on_track'
                ? `On pace for ${this.formatMoney( goalStatus.goal || 0 )}.`
                : `Behind ${this.formatMoney( goalStatus.gap || 0 )}.`;
        const activePathSource = String( selectedMoveTitle || selectedMove || 'Recovery path' ).trim();
        const activePathLine = this.buildBriefingActivePathLine( activePathSource );
        const constraintLine = executionMode === 'auto'
            ? 'Auto mode is carrying execution.'
            : executionMode === 'approval-first'
                ? `Approval-first mode is holding final execution.${fallbackActions[0] ? ` ${this.buildApprovalFallbackCommitment( fallbackActions[0].label )}` : ''}`
                : 'Manual mode is holding final execution.';
        const supportLine = operatorState.interventionTriggered
            ? this.ensureSentence( operatorState.interventionMessage )
            : operatorState.timePressureLine
                ? operatorState.timePressureLine
                : pendingAction?.description
                    ? this.buildBriefingSupportLine( pendingAction.description )
                    : lastActionTaken
                        ? this.ensureSentence( lastActionTaken )
                        : '';

        const offerLine = offerContext ? `Offer: ${offerContext.name} (${offerContext.priceLabel}).` : '';
        const tacticLine = tacticContext ? `Tactic: ${this.formatTacticLabel( tacticContext )}.` : '';

        return [statusLine, activePathLine, offerLine, tacticLine, constraintLine, supportLine]
            .filter( Boolean )
            .join( ' ' );
    }

    private buildBriefingSupportLine ( description: string ): string {
        const normalized = this.ensureSentence( description )
            .replace( /^Your approval to /i, '' )
            .replace( /^You need to /i, '' );
        if ( !normalized ) {
            return '';
        }

        return `Next: ${normalized.charAt( 0 ).toLowerCase() + normalized.slice( 1 )}`;
    }

    private buildBriefingActivePathLine ( value: string ): string {
        const normalized = String( value || '' ).trim();
        if ( !normalized ) {
            return 'Recovery path is active.';
        }

        if ( /^no lead set prepared\b/i.test( normalized ) ) {
            return 'Lead coverage is too thin.';
        }

        if ( /^lead coverage\b/i.test( normalized ) || /^repl(?:y|ies)\b/i.test( normalized ) ) {
            return this.ensureSentence( normalized );
        }

        if ( /^prepared\b/i.test( normalized ) ) {
            const pathLabel = normalized.replace( /^prepared\s+/i, '' ).trim();
            return `${this.capitalizeSentenceStart( pathLabel )} ${this.usePluralActiveVerb( pathLabel ) ? 'are' : 'is'} active.`;
        }

        if ( this.startsWithOperatorVerb( normalized ) ) {
            return this.ensureSentence( normalized );
        }

        return `${this.capitalizeSentenceStart( normalized )} ${this.usePluralActiveVerb( normalized ) ? 'are' : 'is'} active.`;
    }

    private startsWithOperatorVerb ( value: string ): boolean {
        return /^(approve|review|reactivate|launch|send|resume|publish|open|finish|queue|execute|activate|prepare|use)\b/i.test( value.trim() );
    }

    private usePluralActiveVerb ( value: string ): boolean {
        return /(follow-ups|contacts|drafts|adds|additions|leads|fixes|audits|threads)$/i.test( value.trim() );
    }

    private capitalizeSentenceStart ( value: string ): string {
        const normalized = String( value || '' ).trim();
        return normalized ? normalized.charAt( 0 ).toUpperCase() + normalized.slice( 1 ) : normalized;
    }

    private buildDailyMomentumAuditTrail (
        goalStatus: MomentumGoalStatus,
        strategy: MomentumStrategy,
        executionSuggestions: MomentumExecutionSuggestion[],
        blockers: string[]
    ): DailyMomentumAuditItem[] {
        const revenueVerification = goalStatus.revenueVerification || {};
        const calendarVerification = this.getCalendarVerification( goalStatus );
        const strategyText = `${strategy.summary || ''} ${strategy.explanation || ''} ${strategy.recommendedAction || ''}`.toLowerCase();
        const suggestionText = executionSuggestions
            .map( ( suggestion ) => `${suggestion.title || ''} ${suggestion.detail || ''} ${suggestion.action || ''}`.trim() )
            .join( ' ' )
            .toLowerCase();
        const blockerText = blockers.join( ' ' ).toLowerCase();
        const stripeNeedsAttention = revenueVerification.status === 'connection_required'
            || revenueVerification.status === 'lookup_failed'
            || blockerText.includes( 'stripe' );
        const stripeDetail = revenueVerification.message
            || blockers.find( ( blocker ) => blocker.toLowerCase().includes( 'stripe' ) )
            || 'TODD checked the revenue path and found a Stripe issue.';
        const contactCount = this.resolveAuditMetricCount( executionSuggestions, ['contactsCount', 'contactCount'], ['candidateLeads'] );
        const campaignCount = Math.max( 1, executionSuggestions.filter( suggestion => /outreach|follow-up|compose-email|campaign/i.test(
            `${suggestion.title || ''} ${suggestion.detail || ''} ${suggestion.action || ''} ${suggestion.route || ''}`
        ) ).length );
        const emailsSent = this.resolveAuditMetricCount( executionSuggestions, ['emailsSent', 'sentCount', 'deliveredCount'] );
        const replyCount = this.resolveAuditMetricCount( executionSuggestions, ['replyCount', 'repliesCount', 'responsesCount'] );
        const channelCount = Math.max( executionSuggestions.length, Array.isArray( strategy.availableActions ) ? strategy.availableActions.length : 0, 1 );
        const selectedPath = String( executionSuggestions[0]?.title || strategy.recommendedAction || strategy.summary || 'primary recovery path' ).trim();

        return [
            {
                label: revenueVerification.source === 'stripe_connected_account' || stripeNeedsAttention ? 'Stripe checked' : 'Revenue source checked',
                detail: stripeNeedsAttention
                    ? stripeDetail
                    : revenueVerification.message || 'TODD checked today\'s revenue path against the active goal.',
                proofLine: `Checked revenue today · ${this.formatMoney( goalStatus.revenue || 0 )} tracked · today`,
                state: stripeNeedsAttention ? 'attention' : 'checked'
            },
            {
                label: 'Calendar checked',
                detail: calendarVerification.message,
                proofLine: `Reviewed calendar · ${Number( goalStatus.appointmentsSoFar || goalStatus.appointmentCount || goalStatus.appointments || calendarVerification.appointmentsToday || 0 ) > 0
                    ? `${Number( goalStatus.appointmentsSoFar || goalStatus.appointmentCount || goalStatus.appointments || calendarVerification.appointmentsToday || 0 )} appointments found`
                    : 'no appointments found'
                    } · today`,
                state: calendarVerification.status === 'connected' ? 'checked' : 'attention'
            },
            {
                label: 'Contacts reviewed',
                detail: blockerText.includes( 'contact' ) || blockerText.includes( 'verified' )
                    ? blockers.find( ( blocker ) => /contact|verified/i.test( blocker ) ) || 'Contact coverage needs attention before volume can increase.'
                    : 'TODD reviewed contact coverage and buyer availability.',
                proofLine: `${contactCount > 0 ? `Checked ${contactCount} contacts` : 'Checked multiple contacts'} · ${blockerText.includes( 'contact' ) || blockerText.includes( 'verified' ) ? 'limited lead coverage found' : 'working coverage available'} · last 24h`,
                state: blockerText.includes( 'contact' ) || blockerText.includes( 'verified' ) ? 'attention' : 'checked'
            },
            {
                label: 'Outreach reviewed',
                detail: strategyText.includes( 'outreach' ) || suggestionText.includes( 'outreach' ) || suggestionText.includes( 'follow-up' )
                    ? 'TODD reviewed live outreach and follow-up options for today.'
                    : 'TODD reviewed whether outreach is the fastest available move.',
                proofLine: `Reviewed ${campaignCount} campaign${campaignCount === 1 ? '' : 's'} · ${emailsSent > 0 ? `${emailsSent} emails sent` : 'prepared but not sent'} · today`,
                state: 'checked'
            },
            {
                label: 'Replies reviewed',
                detail: strategyText.includes( 'repl' ) || suggestionText.includes( 'repl' ) || suggestionText.includes( 'follow-up' )
                    ? 'TODD checked reply and follow-up signals before selecting the next move.'
                    : 'TODD checked for reply momentum before shifting channels.',
                proofLine: `Reviewed ${campaignCount} campaign${campaignCount === 1 ? '' : 's'} · ${replyCount > 0 ? `${replyCount} replies detected` : 'no new replies detected'} · today`,
                state: 'checked'
            },
            {
                label: 'Channel options reviewed',
                detail: executionSuggestions.length > 1 || ( strategy.availableActions || [] ).length > 0
                    ? 'TODD compared the available channels and selected the strongest path.'
                    : 'TODD reviewed the available channel options from current momentum data.',
                proofLine: `Compared ${channelCount} channel path${channelCount === 1 ? '' : 's'} · ${this.toProofResultLabel( selectedPath )} selected · today`,
                state: 'checked'
            }
        ];
    }

    private resolveAuditMetricCount (
        executionSuggestions: MomentumExecutionSuggestion[],
        metricKeys: string[],
        arrayKeys: string[] = []
    ): number {
        return executionSuggestions.reduce( ( highest, suggestion ) => {
            const payload = suggestion.payload || {};
            const values = [
                ...metricKeys.map( key => this.toNumberMetric( payload[key] ) ),
                ...arrayKeys.map( key => Array.isArray( payload[key] ) ? payload[key].length : 0 )
            ];
            return Math.max( highest, ...values, 0 );
        }, 0 );
    }

    private toProofResultLabel ( value: string ): string {
        const normalized = String( value || '' ).trim().toLowerCase()
            .replace( /^prepared\s+/i, '' )
            .replace( /^review\s+/i, '' );
        return normalized || 'recovery path';
    }

    private buildDailyMomentumApprovalChecklist (
        goalStatus: MomentumGoalStatus,
        strategy: MomentumStrategy,
        executionSuggestions: MomentumExecutionSuggestion[],
        blockers: string[],
        nextAction: ToddMomentumAction | null,
        closeModeActive: boolean,
        persistedDecision?: DailyMomentumDecisionState | null,
        approvalPolicy?: MomentumApprovalPolicy,
        socialQueueSummary?: MomentumSocialQueueSummary | null
    ): DailyMomentumApprovalChecklist | null {
        const status = this.normalizeMomentumStatus( goalStatus.status );
        if ( status !== 'behind' ) {
            return null;
        }

        const actions = this.buildApprovalActions( goalStatus, executionSuggestions, blockers, nextAction, persistedDecision, approvalPolicy, socialQueueSummary );
        if ( actions.length === 0 ) {
            return null;
        }

        const tried = this.buildApprovalTriedItems( goalStatus, strategy, executionSuggestions, blockers, nextAction, persistedDecision );
        const blockedBy = this.buildApprovalBlockedBy( goalStatus, blockers, actions );
        const primaryTarget = actions.find( action => action.risk === 'high' ) || actions[0];
        const primaryCta = primaryTarget?.route
            ? {
                label: primaryTarget.risk === 'high' ? 'Approve TODD actions' : 'Let TODD proceed',
                route: primaryTarget.route,
                actionPath: primaryTarget.actionPath
            }
            : null;
        const secondaryCta = actions.length > 1 || primaryTarget?.risk === 'high'
            ? {
                label: 'Review actions',
                route: '/daily-momentum',
                actionPath: 'Open Daily Momentum at /daily-momentum to review what TODD tried, what is blocked, and what needs approval.'
            }
            : null;

        return {
            headline: closeModeActive ? 'What I am executing before midnight' : 'I could not meet today\'s goal because I need approval to do the following.',
            summary: closeModeActive
                ? 'Close Mode is reducing approval friction. TODD will execute the lowest-friction path now and keep the blocked actions visible.'
                : this.buildApprovalSummary( actions, blockers, strategy ),
            tried,
            blockedBy,
            actions,
            primaryCta,
            secondaryCta
        };
    }

    private buildApprovalSummary (
        actions: DailyMomentumApprovalAction[],
        blockers: string[],
        strategy: MomentumStrategy
    ): string {
        const highRiskCount = actions.filter( action => action.risk === 'high' ).length;
        const blockerLead = blockers[0] || String( strategy.summary || strategy.explanation || '' ).trim();

        if ( highRiskCount > 0 ) {
            return blockerLead
                ? `TODD already worked the safe checks. To close the remaining gap, it needs approval for higher-impact actions and access that are still blocked by: ${blockerLead}`
                : 'TODD already worked the safe checks. To close the remaining gap, it needs approval for the higher-impact actions below.';
        }

        return blockerLead
            ? `TODD reached a practical limit because a required permission or connection is still missing: ${blockerLead}`
            : 'TODD reached a practical limit because the next useful actions still need your permission or a connected system.';
    }

    private buildApprovalTriedItems (
        goalStatus: MomentumGoalStatus,
        strategy: MomentumStrategy,
        executionSuggestions: MomentumExecutionSuggestion[],
        blockers: string[],
        nextAction: ToddMomentumAction | null,
        persistedDecision?: DailyMomentumDecisionState | null
    ): string[] {
        const tried: string[] = [];
        const revenueVerification = goalStatus.revenueVerification || {};
        const calendarVerification = this.getCalendarVerification( goalStatus );

        tried.push(
            revenueVerification.connected
                ? 'TODD checked revenue against the active daily goal.'
                : 'TODD checked whether revenue verification was available.'
        );

        tried.push(
            calendarVerification.status === 'connected'
                ? 'TODD checked meeting activity for today.'
                : 'TODD checked whether meeting verification was available.'
        );

        if ( executionSuggestions.length > 0 || nextAction ) {
            tried.push( persistedDecision?.lastActionTaken || nextAction?.detail || 'TODD compared the available moves and selected the strongest one it could take.' );
        } else if ( strategy.summary || strategy.explanation ) {
            tried.push( String( strategy.summary || strategy.explanation ).trim() );
        }

        if ( blockers.some( blocker => /contact|lead|verified/i.test( blocker ) ) ) {
            tried.push( 'TODD checked whether there was enough lead and contact coverage to push volume.' );
        }

        return tried.filter( Boolean ).slice( 0, 4 );
    }

    private buildApprovalBlockedBy (
        goalStatus: MomentumGoalStatus,
        blockers: string[],
        actions: DailyMomentumApprovalAction[]
    ): string[] {
        const items = [...blockers];
        const revenueVerification = goalStatus.revenueVerification || {};
        const calendarVerification = this.getCalendarVerification( goalStatus );

        if (
            revenueVerification.status === 'connection_required'
            && !items.some( item => item.toLowerCase().includes( 'stripe' ) )
        ) {
            items.push( revenueVerification.message || 'Stripe is not connected yet.' );
        }

        if (
            calendarVerification.status !== 'connected'
            && !items.some( item => item.toLowerCase().includes( 'calendar' ) )
        ) {
            items.push( calendarVerification.message || 'Calendar verification is not connected yet.' );
        }

        actions.forEach( action => {
            if ( action.missingApproval && !items.includes( action.missingApproval ) ) {
                items.push( action.missingApproval );
            }
        } );

        return items.filter( Boolean ).slice( 0, 5 );
    }

    private buildApprovalActions (
        goalStatus: MomentumGoalStatus,
        executionSuggestions: MomentumExecutionSuggestion[],
        blockers: string[],
        nextAction: ToddMomentumAction | null,
        persistedDecision?: DailyMomentumDecisionState | null,
        approvalPolicy?: MomentumApprovalPolicy,
        socialQueueSummary?: MomentumSocialQueueSummary | null
    ): DailyMomentumApprovalAction[] {
        const actions: DailyMomentumApprovalAction[] = [];
        const addAction = ( action: DailyMomentumApprovalAction | null ) => {
            if ( !action ) return;
            const key = `${action.label}|${action.route}|${action.risk}`;
            if ( actions.some( existing => `${existing.label}|${existing.route}|${existing.risk}` === key ) ) {
                return;
            }
            actions.push( action );
        };

        const revenueVerification = goalStatus.revenueVerification || {};
        if ( revenueVerification.status === 'connection_required' || blockers.some( blocker => blocker.toLowerCase().includes( 'stripe' ) ) ) {
            addAction( {
                label: 'Use Stripe for revenue verification',
                description: 'Connect Stripe so TODD can verify revenue and work from a real gap instead of an estimated one.',
                missingApproval: 'Stripe access is still missing.',
                risk: 'low',
                route: '/daily-momentum',
                actionPath: 'Open Daily Momentum at /daily-momentum and use the Connect Stripe action.'
            } );
        }

        const calendarVerification = this.getCalendarVerification( goalStatus );
        if ( calendarVerification.status !== 'connected' ) {
            addAction( {
                label: 'Use Calendar for meeting verification',
                description: 'Review and connect meeting tracking so TODD can verify whether appointments are helping today\'s goal.',
                missingApproval: 'Calendar access is still missing.',
                risk: 'low',
                route: '/daily-momentum?tab=operator',
                actionPath: 'Open Daily Momentum at /daily-momentum?tab=operator and review the meeting tracking requirements.'
            } );
        }

        const primaryAction = this.toApprovalAction(
            nextAction ? {
                action: nextAction.title,
                title: nextAction.title,
                detail: persistedDecision?.lastActionTaken || nextAction.detail,
                route: nextAction.route,
                requiresConfirmation: nextAction.state === 'confirm',
                actionPath: nextAction.actionPath
            } : null,
            blockers,
            approvalPolicy,
            socialQueueSummary
        );
        addAction( primaryAction );

        executionSuggestions
            .slice( 0, 4 )
            .forEach( suggestion => addAction( this.toApprovalAction( suggestion, blockers, approvalPolicy, socialQueueSummary ) ) );

        return actions.slice( 0, 5 );
    }

    private toApprovalAction (
        suggestion: MomentumExecutionSuggestion | null,
        blockers: string[],
        approvalPolicy?: MomentumApprovalPolicy,
        socialQueueSummary?: MomentumSocialQueueSummary | null
    ): DailyMomentumApprovalAction | null {
        if ( !suggestion ) {
            return null;
        }

        const route = String( suggestion.route || '' ).trim();
        const title = String( suggestion.title || suggestion.action || '' ).trim();
        const detail = this.buildSuggestionFallback( suggestion );
        const raw = `${title} ${detail} ${suggestion.action || ''} ${route}`.toLowerCase();
        const scopedSocialState = this.resolveScopedSocialState( suggestion );

        if ( !title && !detail ) {
            return null;
        }

        // Route-based classification takes priority over text matching.
        // Outreach routes always require explicit approval (high risk).
        if ( route === '/outreach/app' || route.startsWith( '/outreach/app' ) ) {
            if ( this.isApprovalCategoryAuto( approvalPolicy, 'outreach_sending' ) ) {
                return null;
            }
            const reviewRoute = this.buildOutreachApprovalReviewRoute();
            return {
                label: 'Send outreach emails',
                description: 'Approve TODD to send or queue the outreach batch it prepared to close today\'s gap.',
                missingApproval: 'Explicit approval is required before TODD sends outreach on your behalf.',
                risk: 'high',
                route: reviewRoute,
                actionPath: String(
                    suggestion.actionPath || `Open Outbox Cockpit Drafts at ${reviewRoute} and review the prepared outreach batch before approving it.`
                ).trim()
            };
        }

        if ( /lead-vault|search for leads|generate fresh leads|warm leads|lead search/.test( raw ) ) {
            return {
                label: 'Search for more leads',
                description: 'Let TODD expand the pool of people or companies it can work today.',
                missingApproval: 'TODD needs permission to keep working additional lead search.',
                risk: 'low',
                route: route || '/lead-vault',
                actionPath: String( suggestion.actionPath || 'Open Lead Vault at /lead-vault and continue the lead search TODD selected.' ).trim()
            };
        }

        if ( /send|queue outreach|queue follow-ups|prepared outreach|compose-email|outreach\/app/.test( raw ) ) {
            if ( this.isApprovalCategoryAuto( approvalPolicy, 'outreach_sending' ) ) {
                return null;
            }
            const reviewRoute = this.buildOutreachApprovalReviewRoute();
            return {
                label: 'Send outreach emails',
                description: 'Approve TODD to send or queue the outreach batch it prepared to close today\'s gap.',
                missingApproval: 'Explicit approval is required before TODD sends outreach on your behalf.',
                risk: 'high',
                route: route || reviewRoute,
                actionPath: String(
                    suggestion.actionPath || `Open Outbox Cockpit Drafts at ${reviewRoute} and review the prepared outreach batch before approving it.`
                ).trim()
            };
        }

        if ( /reply|follow-up|thread/.test( raw ) && !/send|queue/.test( raw ) ) {
            return {
                label: 'Analyze replies and recommend follow-ups',
                description: 'Let TODD review live conversations and recommend the next follow-up moves.',
                missingApproval: 'TODD needs permission to keep working reply analysis and follow-up recommendations.',
                risk: 'low',
                route: route || '/outreach/momentum-threads',
                actionPath: String( suggestion.actionPath || 'Open the outreach threads view and review TODD\'s next reply recommendations.' ).trim()
            };
        }

        if ( scopedSocialState?.stage === 'draft' ) {
            if ( this.isApprovalCategoryAuto( approvalPolicy, 'social_drafting' ) ) {
                return null;
            }
            return {
                label: 'Approve Drafts',
                description: `TODD already created ${scopedSocialState.draftPostIds.length} draft${scopedSocialState.draftPostIds.length === 1 ? '' : 's'} for review in Social.`,
                missingApproval: 'Explicit approval is required before TODD can move the prepared drafts forward.',
                risk: 'high',
                route: scopedSocialState.route,
                actionPath: scopedSocialState.actionPath
            };
        }

        if ( scopedSocialState?.stage === 'approved' ) {
            if ( this.isApprovalCategoryAuto( approvalPolicy, 'social_posting' ) ) {
                return null;
            }
            return {
                label: 'Open social queue to publish',
                description: `${scopedSocialState.approvedPostIds.length} approved social post${scopedSocialState.approvedPostIds.length === 1 ? ' is' : 's are'} ready on the Social page — open it to publish them.`,
                missingApproval: 'Explicit approval is required before TODD publishes approved social posts.',
                risk: 'high',
                route: scopedSocialState.route,
                actionPath: scopedSocialState.actionPath
            };
        }

        if ( scopedSocialState?.stage === 'rejected' ) {
            return {
                label: 'Dismiss stale recommendation',
                description: 'All drafts tied to this social handoff were rejected, so the original recommendation is no longer actionable.',
                missingApproval: 'The stale recommendation still needs to be cleared or replaced.',
                risk: 'low',
                route: scopedSocialState.route,
                actionPath: scopedSocialState.actionPath
            };
        }

        if ( /linkedin|threads|social|post/.test( raw ) ) {
            const pendingDraftCount = Number( socialQueueSummary?.draftCount || 0 );
            const approvedSocialCount = Number( socialQueueSummary?.approvedCount || 0 );
            if ( pendingDraftCount > 0 ) {
                if ( this.isApprovalCategoryAuto( approvalPolicy, 'social_drafting' ) ) {
                    return null;
                }
                return {
                    label: 'Approve Drafts',
                    description: `TODD already created ${pendingDraftCount} draft${pendingDraftCount === 1 ? '' : 's'} for review in Social.`,
                    missingApproval: 'Explicit approval is required before TODD can move the prepared drafts forward.',
                    risk: 'high',
                    route: '/outreach/social',
                    actionPath: 'Open Social at /outreach/social and review the prepared drafts.'
                };
            }
            if ( this.isApprovalCategoryAuto( approvalPolicy, 'social_posting' ) ) {
                return null;
            }
            return {
                label: approvedSocialCount > 0 ? 'Publish approved social' : 'Draft or post to social',
                description: approvedSocialCount > 0
                    ? `Approve TODD to publish from the ${approvedSocialCount} approved social post${approvedSocialCount === 1 ? '' : 's'} already queued for today.`
                    : 'Approve TODD to create or publish the social move it selected for today.',
                missingApproval: 'Explicit approval is required before TODD publishes or schedules social content.',
                risk: 'high',
                route: route || '/pulse/app',
                actionPath: String( suggestion.actionPath || ( approvedSocialCount > 0
                    ? 'Open Pulse at /outreach/social to review the approved social queue TODD can publish from.'
                    : 'Open Pulse to review the social draft or posting action TODD selected.' ) ).trim()
            };
        }

        if ( /optimiz|campaign|targeting|subject line|page/.test( raw ) ) {
            return {
                label: 'Optimize key pages',
                description: 'Let TODD tighten campaign or page-level conversion details before the next push.',
                missingApproval: 'TODD needs approval to apply optimization changes.',
                risk: 'low',
                route: route || '/docs/app',
                actionPath: String( suggestion.actionPath || 'Open the selected page and review the optimization changes TODD wants to make.' ).trim()
            };
        }

        if ( /offer|proposal|quote|sales/.test( raw ) ) {
            return {
                label: 'Prepare offers and sales actions',
                description: 'Approve TODD to prepare the offer or sales-support step it believes will move the deal.',
                missingApproval: 'Explicit approval is required before TODD prepares or advances sales-facing materials.',
                risk: 'high',
                route: route || '/docs/app',
                actionPath: String( suggestion.actionPath || 'Open Docs and review the offer or sales action TODD prepared.' ).trim()
            };
        }

        if ( blockers.some( blocker => /contact|verified/i.test( blocker ) ) ) {
            return {
                label: 'Search for more leads',
                description: 'TODD needs more workable lead coverage before it can push volume with confidence.',
                missingApproval: 'Lead coverage still needs your approval or attention.',
                risk: 'low',
                route: '/lead-vault',
                actionPath: 'Open Lead Vault at /lead-vault and review the next lead search TODD recommends.'
            };
        }

        return null;
    }

    private isApprovalCategoryAuto ( approvalPolicy: MomentumApprovalPolicy | undefined, category: string ): boolean {
        const normalizedCategory = String( category || '' ).trim();
        const mode = String( approvalPolicy?.categories?.[normalizedCategory]?.mode || '' ).trim().toLowerCase();
        return mode === 'auto';
    }

    private buildSocialQueueActionRows (
        socialQueueSummary?: MomentumSocialQueueSummary | null
    ): DailyMomentumActionRow[] {
        const draftCount = Number( socialQueueSummary?.draftCount || 0 );
        const approvedCount = Number( socialQueueSummary?.approvedCount || 0 );
        const rows: DailyMomentumActionRow[] = [];

        if ( draftCount > 0 ) {
            rows.push( {
                label: 'Social drafts need review',
                detail: `Drafts waiting for approval in Social.`,
                state: 'waiting_for_approval',
                stateLabel: this.formatActionStateLabel( 'waiting_for_approval' ),
                preparedSummary: `Drafts waiting in Social.`,
                approvalSummary: 'Open Social and approve, reject, edit, or publish the prepared drafts.',
                route: '/outreach/social/calendar',
                actionPath: 'Open the Social Calendar and review the prepared drafts waiting for approval.',
                reviewLabel: 'Review drafts',
                approvalLabel: 'Review drafts',
                metrics: [],
                secondaryCtaLabel: '',
                secondaryCtaRoute: '',
                secondaryCtaPath: '',
                offerContext: null,
                tacticContext: null,
                actionType: 'social_draft_review',
                payload: {
                    source: 'socialQueueSummary',
                    draftCount,
                    approvedCount
                },
                receipt: undefined
            } );
        }

        if ( approvedCount > 0 ) {
            rows.push( {
                label: 'Approved social posts ready',
                detail: `${approvedCount} approved social post${approvedCount === 1 ? '' : 's'} ready in Social.`,
                state: 'prepared_by_todd',
                stateLabel: this.formatActionStateLabel( 'prepared_by_todd' ),
                preparedSummary: `${approvedCount} approved social post${approvedCount === 1 ? '' : 's'} ready for manual publish.`,
                approvalSummary: 'Open Social to publish or schedule approved posts. TODD will not publish from this queue unless the publish flow is used.',
                route: '/outreach/social#approved-posts',
                actionPath: 'Open Social at /outreach/social#approved-posts and review approved posts ready for publishing.',
                reviewLabel: 'Open social queue',
                approvalLabel: 'Open social queue',
                metrics: [],
                secondaryCtaLabel: '',
                secondaryCtaRoute: '',
                secondaryCtaPath: '',
                offerContext: null,
                tacticContext: null,
                actionType: 'social_publish_review',
                payload: {
                    source: 'socialQueueSummary',
                    draftCount,
                    approvedCount
                },
                receipt: undefined
            } );
        }

        return rows;
    }

    private buildDailyMomentumActionsTaken (
        executionSuggestions: MomentumExecutionSuggestion[],
        nextAction: ToddMomentumAction | null,
        blockers: string[],
        executionStatus: DailyMomentumExecutionStatus,
        persistedDecision?: DailyMomentumDecisionState | null,
        socialQueueSummary?: MomentumSocialQueueSummary | null
    ): DailyMomentumActionRow[] {
        const rows = executionSuggestions
            .map( ( suggestion, index ) => this.toDailyMomentumActionRow( suggestion, index === 0 ? nextAction : null ) )
            .filter( ( row ): row is DailyMomentumActionRow => Boolean( row ) );


        const socialReviewRows = this.buildSocialQueueActionRows( socialQueueSummary );

        const mergeSocialRows = ( baseRows: DailyMomentumActionRow[] ): DailyMomentumActionRow[] => {
            const existingKeys = new Set(
                baseRows.map( row => `${String( row.label || '' ).toLowerCase()}|${String( row.route || '' ).toLowerCase()}` )
            );

            const merged = [...baseRows];

            socialReviewRows.forEach( row => {
                const key = `${String( row.label || '' ).toLowerCase()}|${String( row.route || '' ).toLowerCase()}`;
                if ( !existingKeys.has( key ) ) {
                    merged.push( row );
                    existingKeys.add( key );
                }
            } );

            return merged;
        };

        if ( rows.length > 0 ) {
            if ( persistedDecision?.lastActionTaken && rows[0] ) {
                const persistedState = this.mapExecutionStatusToActionState( executionStatus );
                rows[0] = {
                    ...rows[0],
                    detail: persistedDecision.lastActionTaken,
                    state: persistedState,
                    stateLabel: this.formatActionStateLabel( persistedState )
                };
            }
            return mergeSocialRows( rows );
        }

        if ( nextAction ) {
            const nextActionState = this.mapExecutionStatusToActionState( executionStatus );
            return [
                {
                    label: nextAction.title,
                    detail: persistedDecision?.lastActionTaken || nextAction.detail,
                    state: nextActionState,
                    stateLabel: this.formatActionStateLabel( nextActionState ),
                    preparedSummary: this.ensureSentence( nextAction.detail || 'I prepared the strongest next move I could support from today\'s data.' ),
                    approvalSummary: executionStatus === 'waiting_for_confirmation'
                        ? 'If you approve it, I will carry this prepared move forward and report the result.'
                        : executionStatus === 'queued'
                            ? 'I already moved this action into execution and will keep watching the early signals.'
                            : 'I will keep carrying this prepared move forward and report what happens next.',
                    route: nextAction.route,
                    actionPath: nextAction.actionPath,
                    reviewLabel: nextAction.route ? `Review in ${this.routeToDestinationLabel( nextAction.route )}` : 'Review prepared work',
                    approvalLabel: 'Approve next move',
                    metrics: [],
                    secondaryCtaLabel: '',
                    secondaryCtaRoute: '',
                    secondaryCtaPath: '',
                    offerContext: null,
                    tacticContext: null,
                    actionType: '',
                    payload: {},
                    receipt: undefined
                }
            ];
        }

        if ( blockers.length > 0 ) {
            return [
                {
                    label: 'Waiting on blocker resolution',
                    detail: blockers[0],
                    state: 'blocked',
                    stateLabel: 'blocked',
                    preparedSummary: 'I identified the blocker that is holding today\'s momentum back.',
                    approvalSummary: 'Once the blocker is cleared, I can resume the next prepared move.',
                    route: '',
                    actionPath: '',
                    reviewLabel: 'Review blocker',
                    approvalLabel: 'Resolve blocker',
                    metrics: [],
                    secondaryCtaLabel: '',
                    secondaryCtaRoute: '',
                    secondaryCtaPath: '',
                    offerContext: null,
                    tacticContext: null,
                    actionType: '',
                    payload: {},
                    receipt: undefined
                }
            ];
        }

        return socialReviewRows;
    }

    private toDailyMomentumActionRow (
        suggestion: MomentumExecutionSuggestion,
        primaryAction: ToddMomentumAction | null
    ): DailyMomentumActionRow | null {
        const detail = this.buildSuggestionFallback( suggestion );
        if ( !detail ) {
            return null;
        }

        const state = primaryAction
            ? primaryAction.state
            : this.resolveToddActionState( { actionState: suggestion.status, requiresConfirmation: suggestion.requiresConfirmation }, suggestion, detail );
        const suggestionExecutionStatus = this.mapSuggestionStatusToExecutionStatus( suggestion, state );
        const executionStatus = primaryAction
            && !['completed', 'queued', 'blocked', 'failed'].includes( suggestionExecutionStatus )
            ? this.mapToddStateToExecutionStatus( state )
            : suggestionExecutionStatus;
        const executionState = this.mapExecutionStatusToActionState(
            executionStatus
        );
        const receipt = this.findReceiptForSuggestion( suggestion );
        const suggestionType = String( suggestion.action || '' ).trim().toLowerCase();
        const resolvedRoute = this.resolveReceiptReviewRoute( suggestion, receipt ) || String( suggestion.route || primaryAction?.route || '' ).trim();
        const actionDetail = this.buildReceiptBackedDetail( suggestion, receipt ) || detail;
        const reviewLabel = this.normalizeReviewLabel( String( suggestion.reviewLabel || '' ).trim() || this.buildReviewLabel( suggestion ) );
        const secondaryCta = this.buildReceiptSecondaryCta( suggestion, receipt );
        const receiptSummary = String( receipt?.summary || '' ).trim();
        const preparedSummary = suggestionType === 'prepare_lead_addition'
            ? this.buildLeadAdditionPreparedSummary( suggestion )
            : ( String( suggestion.preparedSummary || '' ).trim() || receiptSummary || this.buildPreparedActionSummary( suggestion, actionDetail ) );
        const approvalSummary = suggestionType === 'prepare_lead_addition'
            ? this.buildLeadAdditionApprovalSummary( suggestion )
            : ( String( suggestion.approvalSummary || '' ).trim() || this.buildApprovalActionSummary( suggestion, actionDetail ) );

        return {
            label: String( suggestion.title || primaryAction?.title || 'Prepared action' ).trim(),
            detail: actionDetail,
            state: executionState,
            stateLabel: this.formatActionStateLabel( executionState ),
            preparedSummary,
            approvalSummary,
            route: resolvedRoute,
            actionPath: this.buildToddActionPath(
                resolvedRoute,
                String( suggestion.ctaLabel || primaryAction?.ctaLabel || '' ).trim(),
                suggestion
            ),
            reviewLabel,
            approvalLabel: String( suggestion.approvalLabel || '' ).trim() || this.buildApprovalLabel( suggestion ),
            actionPlanId: suggestion.actionPlanId,
            metrics: this.buildReceiptMetrics( suggestion, receipt ),
            secondaryCtaLabel: secondaryCta?.label || '',
            secondaryCtaRoute: secondaryCta?.route || '',
            secondaryCtaPath: secondaryCta?.path || '',
            behaviorAlignment: suggestion.behaviorAlignment || receipt?.behaviorAlignment || null,
            behaviorContext: suggestion.behaviorContext || receipt?.behaviorContext || null,
            behaviorContextMeta: suggestion.behaviorContextMeta || receipt?.behaviorContextMeta || null,
            behaviorCommandSummary: String( receipt?.behaviorCommandSummary || suggestion.behaviorCommandSummary || suggestion.payload?.['behaviorCommandSummary'] || '' ).trim(),
            offerContext: suggestion.offerContext || null,
            tacticContext: suggestion.tacticContext || null,
            featurePromotion: suggestion.featurePromotion || suggestion.payload?.featurePromotion || null,
            actionType: String( suggestion.action || '' ).trim(),
            payload: suggestion.payload || {},
            receipt
        };
    }

    private mapToddStateToExecutionStatus ( state: ToddMomentumActionState ): DailyMomentumExecutionStatus {
        if ( state === 'confirm' ) return 'waiting_for_confirmation';
        if ( state === 'queued' ) return 'queued';
        if ( state === 'drafted' ) return 'drafted';
        return 'selected';
    }

    private mapSuggestionStatusToExecutionStatus (
        suggestion: MomentumExecutionSuggestion,
        fallbackState: ToddMomentumActionState
    ): DailyMomentumExecutionStatus {
        const raw = `${suggestion.status || ''} ${suggestion.detail || ''} ${suggestion.title || ''} ${suggestion.action || ''}`.toLowerCase();

        if ( /sent|posted|published|completed|finished|delivered|added to contact store|added leads|ran analysis/.test( raw ) ) {
            return 'completed';
        }

        if ( /queued|scheduled|auto-executed|auto executed|live now/.test( raw ) ) {
            return 'queued';
        }

        if ( /failed|failure/.test( raw ) ) {
            return 'failed';
        }

        if ( /approval needed|waiting for approval|needs review/.test( raw ) ) {
            return 'waiting_for_confirmation';
        }

        if ( /blocked|failed|error|missing/.test( raw ) ) {
            return 'blocked';
        }

        return this.mapToddStateToExecutionStatus( fallbackState );
    }

    private mapExecutionStatusToActionState ( status: DailyMomentumExecutionStatus ): DailyMomentumActionState {
        if ( status === 'completed' ) return 'completed';
        if ( status === 'failed' ) return 'failed';
        if ( status === 'queued' ) return 'auto_executed';
        if ( status === 'blocked' ) return 'blocked';
        if ( status === 'waiting_for_confirmation' ) return 'waiting_for_approval';
        return 'prepared_by_todd';
    }

    private formatActionStateLabel ( state: DailyMomentumActionState ): string {
        switch ( state ) {
            case 'prepared_by_todd':
                return 'Ready to send';
            case 'waiting_for_approval':
            case 'approval_needed':
                return 'Will execute unless stopped';
            case 'deferred':
                return 'waiting on window';
            case 'setup_needed':
                return 'setup needed';
            case 'auto_executed':
                return 'auto-executed';
            case 'blocked':
                return 'blocked';
            case 'completed':
                return 'completed';
            case 'failed':
                return 'failed';
            default:
                return 'Ready to send';
        }
    }

    private buildPreparedActionSummary ( suggestion: MomentumExecutionSuggestion, detail: string ): string {
        const raw = `${suggestion.title || ''} ${detail} ${suggestion.action || ''} ${suggestion.route || ''}`.toLowerCase();
        const offerName = this.getSuggestionOfferName( suggestion );

        if ( /outreach|follow-up|compose-email/.test( raw ) ) {
            if ( offerName ) {
                return `I prepared the strongest outreach move I could support for ${offerName} and left the next message ready for review.`;
            }
            return 'I prepared the strongest outreach move I could support from today\'s momentum and left the next message ready for review.';
        }

        if ( /lead|lead vault|network/.test( raw ) ) {
            const candidateCount = this.getLeadCandidateRecords( suggestion ).length;
            if ( candidateCount > 0 ) {
                return `I identified ${candidateCount} candidate lead${candidateCount === 1 ? '' : 's'} worth reviewing for today's momentum push.`;
            }
            return 'I prepared the strongest lead candidates I could support for today\'s momentum push.';
        }

        if ( /linkedin/.test( raw ) ) {
            return 'I drafted a LinkedIn post built around a timely idea worth sharing today.';
        }

        if ( /threads/.test( raw ) ) {
            return 'I drafted a Threads post that turns today\'s focus into something simple and shareable.';
        }

        if ( /recommend_rss_fallback_social_draft|rss-fallback/.test( raw ) ) {
            if ( offerName ) {
                return `I found a recent RSS article that can support ${offerName} and prepared review-first social drafts from it.`;
            }
            return 'I found a recent RSS article that matches today\'s momentum goals and prepared review-first social drafts from it.';
        }

        if ( /recommend_social_follow_up/.test( raw ) ) {
            if ( offerName ) {
                return `I recommended a social follow-up for ${offerName} because the relationship signal is already warm enough to justify a lighter, faster channel.`;
            }
            return 'I recommended a social follow-up because the relationship signal is already warm enough to justify a lighter, faster channel.';
        }

        if ( /recommend_contact_handoff_task/.test( raw ) ) {
            if ( offerName ) {
                return `I prepared a contact handoff for ${offerName} so a human can move the warm signal with sharper context instead of restarting the conversation cold.`;
            }
            return 'I prepared a contact handoff so a human can move the warm signal with sharper context instead of restarting the conversation cold.';
        }

        if ( /recommend_direct_note/.test( raw ) ) {
            if ( offerName ) {
                return `I recommended a short direct note for ${offerName} because the live signal is strong enough that a broad batch would slow the next move down.`;
            }
            return 'I recommended a short direct note because the live signal is strong enough that a broad batch would slow the next move down.';
        }

        if ( /recommend_appointment_first_push/.test( raw ) ) {
            if ( offerName ) {
                return `I recommended an appointment-first push for ${offerName} because the contact is already showing intent and TODD should tighten the path to a booked conversation.`;
            }
            return 'I recommended an appointment-first push because the contact is already showing intent and TODD should tighten the path to a booked conversation.';
        }

        if ( /social|pulse|post/.test( raw ) ) {
            if ( offerName ) {
                return `I prepared social drafts for ${offerName} that translate today\'s focus into something human and relatable.`;
            }
            return 'I prepared social drafts that translate today\'s focus into something human and relatable.';
        }

        const featurePromotion = suggestion.featurePromotion || suggestion.payload?.featurePromotion || null;
        if ( featurePromotion?.name ) {
            return `I picked ${featurePromotion.name} as the strongest supporting feature to help recover today's momentum.`;
        }

        if ( /reactivat|stale|inactive/.test( raw ) ) {
            return 'I found stale contacts in the current database and prepared them for reactivation.';
        }

        if ( /page|landing|offer|proposal|quote|docs/.test( raw ) ) {
            if ( offerName ) {
                return `I prepared the next conversion or sales-support change for ${offerName} that looks most useful today.`;
            }
            return 'I prepared the next conversion or sales-support change that looks most useful today.';
        }

        const tenantActionContextSummary = this.getSuggestionTenantActionContextSummary( suggestion );
        if ( tenantActionContextSummary && offerName ) {
            return `I prepared the next move for ${offerName} and kept it tied to the tenant\'s current context.`;
        }

        return this.ensureSentence( detail || 'I prepared the strongest next move I could support from today\'s data.' );
    }

    private buildApprovalActionSummary ( suggestion: MomentumExecutionSuggestion, detail: string ): string {
        const raw = `${suggestion.title || ''} ${detail} ${suggestion.action || ''} ${suggestion.route || ''}`.toLowerCase();
        const offerName = this.getSuggestionOfferName( suggestion );

        if ( /outreach|follow-up|compose-email/.test( raw ) ) {
            if ( offerName ) {
                return `If you approve it, I will move this ${offerName} outreach work into the next live batch and report what happens.`;
            }
            return 'If you approve it, I will move this outreach work into the next live batch and report what happens.';
        }

        if ( /lead|lead vault|network/.test( raw ) ) {
            const candidateCount = this.getLeadCandidateRecords( suggestion ).length;
            if ( candidateCount > 0 ) {
                return 'If you approve it, I will move the strongest candidates into today\'s working set and keep momentum moving.';
            }
            return 'Lead coverage was too thin, so I shifted to Lead Vault review work instead.';
        }

        if ( /linkedin/.test( raw ) ) {
            return 'If you approve it, I will finalize the LinkedIn post and move it into today\'s publishing flow.';
        }

        if ( /threads/.test( raw ) ) {
            return 'If you approve it, I will finalize the Threads post and move it into today\'s publishing flow.';
        }

        if ( /recommend_rss_fallback_social_draft|rss-fallback/.test( raw ) ) {
            if ( offerName ) {
                return `Queue was empty, so I found a recent RSS article that can support ${offerName} and prepared review-only drafts for your review.`;
            }
            return 'Queue was empty, so I found a recent RSS article that matches momentum goals and prepared review-only drafts for your review.';
        }

        if ( /recommend_social_follow_up/.test( raw ) ) {
            if ( offerName ) {
                return `Open Social and use the warm relationship signal to create a faster follow-up for ${offerName} instead of starting another cold move.`;
            }
            return 'Open Social and use the warm relationship signal to create a faster follow-up instead of starting another cold move.';
        }

        if ( /recommend_contact_handoff_task/.test( raw ) ) {
            if ( offerName ) {
                return `Open the contact workspace and move the ${offerName} handoff with the live signal context TODD already found.`;
            }
            return 'Open the contact workspace and move the handoff with the live signal context TODD already found.';
        }

        if ( /recommend_direct_note/.test( raw ) ) {
            if ( offerName ) {
                return `Open Compose and send the short direct note for ${offerName} while the interest signal is still warm.`;
            }
            return 'Open Compose and send the short direct note while the interest signal is still warm.';
        }

        if ( /recommend_appointment_first_push/.test( raw ) ) {
            if ( offerName ) {
                return `Open Compose and move the next ${offerName} note toward a booked conversation or decision instead of another nurture step.`;
            }
            return 'Open Compose and move the next note toward a booked conversation or decision instead of another nurture step.';
        }

        if ( /social|pulse|post/.test( raw ) ) {
            if ( offerName ) {
                return `If you approve it, I will move the prepared ${offerName} social drafts into today\'s publishing flow.`;
            }
            return 'If you approve it, I will move the prepared social drafts into today\'s publishing flow.';
        }

        const featurePromotion = suggestion.featurePromotion || suggestion.payload?.featurePromotion || null;
        if ( featurePromotion?.name ) {
            return `If you approve it, I will push the ${featurePromotion.name} path as today's supporting tactic and watch for movement.`;
        }

        if ( /page|landing|offer|proposal|quote|docs/.test( raw ) ) {
            if ( offerName ) {
                return `If you approve it, I will apply the prepared ${offerName} conversion or offer changes and report what happens next.`;
            }
            return 'If you approve it, I will apply the prepared conversion or offer changes and report what happens next.';
        }

        const tenantActionContextSummary = this.getSuggestionTenantActionContextSummary( suggestion );
        if ( tenantActionContextSummary && offerName ) {
            return `If you approve it, I will carry this prepared ${offerName} move forward and report the result.`;
        }

        return 'If you approve it, I will carry this prepared move forward and report the result.';
    }

    private getSuggestionTenantActionContext ( suggestion: MomentumExecutionSuggestion ): MomentumTenantActionContext | null {
        const direct = suggestion.payload?.['tenantActionContext'];
        if ( direct && typeof direct === 'object' ) {
            return direct as MomentumTenantActionContext;
        }

        return null;
    }

    private getSuggestionOfferName ( suggestion: MomentumExecutionSuggestion ): string {
        const tenantActionContext = this.getSuggestionTenantActionContext( suggestion );
        const payloadOfferContext = suggestion.payload?.['offerContext'];
        const payloadOfferSummary = String( suggestion.payload?.['offerSummary'] || '' ).trim();

        return String(
            suggestion.offerContext?.name
            || tenantActionContext?.offerContext?.title
            || tenantActionContext?.offerSummary
            || ( payloadOfferContext && typeof payloadOfferContext === 'object'
                ? String( ( payloadOfferContext as Record<string, unknown> )['title'] || '' ).trim()
                : '' )
            || payloadOfferSummary
            || ''
        ).trim();
    }

    private getSuggestionTenantActionContextSummary ( suggestion: MomentumExecutionSuggestion ): string {
        const tenantActionContext = this.getSuggestionTenantActionContext( suggestion );
        return String(
            tenantActionContext?.summary
            || tenantActionContext?.behaviorSummary
            || ''
        ).trim();
    }

    private buildLeadAdditionPreparedSummary ( suggestion: MomentumExecutionSuggestion ): string {
        const candidateCount = this.getLeadCandidateRecords( suggestion ).length;
        if ( candidateCount > 0 ) {
            return `I staged ${candidateCount} lead candidate${candidateCount === 1 ? '' : 's'} for today's momentum push.`;
        }

        return 'Lead coverage was too thin, so I shifted into lower-risk fallback work.';
    }

    private buildLeadAdditionApprovalSummary ( suggestion: MomentumExecutionSuggestion ): string {
        const candidateCount = this.getLeadCandidateRecords( suggestion ).length;
        if ( candidateCount > 0 ) {
            return 'If you approve it, I will add this staged lead set into today\'s working set and keep momentum moving.';
        }

        return 'I could not stage enough qualified leads automatically, so I prepared the strongest fallback path available instead.';
    }

    private buildReviewLabel ( suggestion: MomentumExecutionSuggestion ): string {
        const route = String( suggestion.route || '' ).toLowerCase();

        if ( route.includes( '/signal-engine' ) ) return 'Review in Outbox Cockpit';
        if ( route.includes( 'sourceType=rss-fallback' ) ) return 'Review recommended drafts';
        if ( route.includes( '/outreach' ) || route.includes( '/compose-email' ) ) return 'Review in Compose';
        if ( route.includes( '/contact-list' ) ) return 'Review in Contacts';
        if ( route.includes( '/pricing' ) ) return 'Review in Pricing';
        if ( route.includes( '/pulse' ) ) return 'Review in Social';
        if ( route.includes( '/social' ) ) return 'Review in Social';
        if ( route.includes( '/lead-vault' ) || route.includes( '/network' ) ) return 'Review in Lead Vault';
        if ( route.includes( '/docs' ) ) return 'Review in Docs';
        return 'Review prepared work';
    }

    private normalizeReviewLabel ( label: string ): string {
        const normalized = String( label || '' ).trim();
        if ( /^review in compose email$/i.test( normalized ) ) {
            return 'Review in Compose';
        }

        if ( /^review in the next step$/i.test( normalized ) ) {
            return 'Review prepared work';
        }

        return normalized;
    }

    private buildApprovalLabel ( suggestion: MomentumExecutionSuggestion ): string {
        const raw = `${suggestion.title || ''} ${suggestion.detail || ''} ${suggestion.action || ''} ${suggestion.route || ''}`.toLowerCase();

        if ( /outreach|follow-up|compose-email/.test( raw ) ) return 'Approve campaign';
        if ( /lead|lead vault|network/.test( raw ) ) return 'Approve adding leads';
        if ( /recommend_rss_fallback_social_draft|rss-fallback/.test( raw ) ) return 'Review recommended drafts';
        if ( /recommend_social_follow_up/.test( raw ) ) return 'Open social follow-up';
        if ( /recommend_contact_handoff_task/.test( raw ) ) return 'Open handoff task';
        if ( /recommend_direct_note/.test( raw ) ) return 'Open direct note';
        if ( /recommend_appointment_first_push/.test( raw ) ) return 'Open appointment push';
        if ( /social|linkedin|threads|post|pulse/.test( raw ) ) return 'Approve social drafts';
        if ( /features|pricing|signature builder/.test( raw ) ) return 'Approve feature push';
        if ( /page|landing|offer|proposal|quote|docs/.test( raw ) ) return 'Approve optimization';
        return 'Approve next move';
    }

    private resolveDailyMomentumExecutionStatus (
        status: 'behind' | 'on_track' | 'met' | 'unknown',
        nextAction: ToddMomentumAction | null,
        blockers: string[],
        persistedDecision?: DailyMomentumDecisionState | null,
        primarySuggestion?: MomentumExecutionSuggestion
    ): DailyMomentumExecutionStatus {
        if ( status === 'met' ) {
            return 'completed';
        }

        if ( persistedDecision?.executionStatus ) {
            return persistedDecision.executionStatus;
        }

        if ( primarySuggestion ) {
            const inferredStatus = this.mapSuggestionStatusToExecutionStatus(
                primarySuggestion,
                nextAction?.state || 'selected'
            );
            if ( inferredStatus !== 'selected' ) {
                return inferredStatus;
            }
        }

        if ( !nextAction && blockers.length > 0 ) {
            return 'blocked';
        }

        if ( nextAction?.state === 'confirm' ) return 'waiting_for_confirmation';
        if ( nextAction?.state === 'drafted' ) return 'drafted';
        if ( nextAction?.state === 'queued' ) return 'queued';
        return 'selected';
    }

    private resolveDailyMomentumExecutionMode (
        executionStatus: DailyMomentumExecutionStatus,
        nextAction: ToddMomentumAction | null,
        persistedDecision?: DailyMomentumDecisionState | null,
        primaryActionPlan?: MomentumActionPlan | null
    ): DailyMomentumExecutionMode {
        const planMode = String( primaryActionPlan?.executionMode || '' ).trim().toLowerCase();
        if ( planMode === 'manual' || planMode === 'approval-first' || planMode === 'auto' ) {
            return planMode as DailyMomentumExecutionMode;
        }

        const actionText = `${nextAction?.detail || ''} ${persistedDecision?.lastActionTaken || ''}`.toLowerCase();

        if ( executionStatus === 'queued' || executionStatus === 'completed' || /auto[- ]?execut|scheduled|queued/.test( actionText ) ) {
            return 'auto';
        }

        if ( executionStatus === 'waiting_for_confirmation' || nextAction?.state === 'confirm' ) {
            return 'approval-first';
        }

        return 'manual';
    }

    private resolveLastActionTaken (
        executionStatus: DailyMomentumExecutionStatus,
        actionsTaken: DailyMomentumActionRow[],
        blockers: string[],
        persistedDecision?: DailyMomentumDecisionState | null,
        offerContext?: ToddSelectedOffer | null
    ): string {
        if ( persistedDecision?.lastActionTaken ) {
            return persistedDecision.lastActionTaken;
        }

        if ( actionsTaken[0]?.detail ) {
            return actionsTaken[0].state === 'completed' || actionsTaken[0].state === 'auto_executed'
                ? actionsTaken[0].detail
                : actionsTaken[0].preparedSummary;
        }

        if ( executionStatus === 'blocked' && blockers[0] ) {
            return `I checked the path and hit this blocker: ${blockers[0]}`;
        }

        if ( executionStatus === 'completed' ) {
            return offerContext
                ? `I completed the active ${offerContext.name} path and shifted into protection mode.`
                : 'I completed today\'s goal path and shifted into protection mode.';
        }

        if ( executionStatus === 'failed' && blockers[0] ) {
            return `I attempted the prepared move but it failed because ${blockers[0].charAt( 0 ).toLowerCase() + blockers[0].slice( 1 )}`;
        }

        return '';
    }

    private isExecutionReady (
        executionStatus: DailyMomentumExecutionStatus,
        nextAction: ToddMomentumAction | null
    ): boolean {
        return executionStatus === 'waiting_for_confirmation'
            || executionStatus === 'drafted'
            || executionStatus === 'selected'
            || Boolean( nextAction?.route );
    }

    private buildPendingAction (
        executionStatus: DailyMomentumExecutionStatus,
        nextAction: ToddMomentumAction | null,
        blockers: string[],
        closeModeActive: boolean,
        persistedDecision?: DailyMomentumDecisionState | null,
        offerContext?: ToddSelectedOffer | null
    ): DailyMomentumPendingAction | null {
        if ( persistedDecision?.pendingAction ) {
            return persistedDecision.pendingAction;
        }

        if ( executionStatus === 'waiting_for_confirmation' && nextAction?.route ) {
            return {
                label: offerContext?.cta || 'Execute now',
                description: closeModeActive
                    ? `I will push the strongest same-day rescue path${offerContext ? ` for ${offerContext.name}` : ''} unless stopped`
                    : `I will execute ${nextAction.title.toLowerCase()}${offerContext ? ` for ${offerContext.name}` : ''} and carry the prepared work forward immediately`,
                route: nextAction.route,
                actionPath: nextAction.actionPath
            };
        }

        if ( executionStatus === 'drafted' && nextAction?.route ) {
            return {
                label: 'Open execution path',
                description: `I prepared ${nextAction.title.toLowerCase()}${offerContext ? ` for ${offerContext.name}` : ''} and can move from planning into execution from this path`,
                route: nextAction.route,
                actionPath: nextAction.actionPath
            };
        }

        if ( executionStatus === 'blocked' ) {
            const blockerCta = this.buildBlockerFallbackCta( blockers );
            if ( blockerCta ) {
                return {
                    label: blockerCta.label,
                    description: blockerCta.description,
                    route: blockerCta.route,
                    actionPath: blockerCta.actionPath
                };
            }
        }

        if ( executionStatus === 'failed' ) {
            const blockerCta = this.buildBlockerFallbackCta( blockers );
            if ( blockerCta ) {
                return {
                    label: blockerCta.label,
                    description: blockerCta.description,
                    route: blockerCta.route,
                    actionPath: blockerCta.actionPath
                };
            }
        }

        return null;
    }

    private buildPrimaryCta (
        executionStatus: DailyMomentumExecutionStatus,
        nextAction: ToddMomentumAction | null,
        blockers: string[],
        pendingAction: DailyMomentumPendingAction | null,
        socialQueueSummary?: MomentumSocialQueueSummary | null,
        persistedDecision?: DailyMomentumDecisionState | null,
        actionPlans: MomentumActionPlan[] = []
    ): DailyMomentumCta | null {
        const scopedSocialState = actionPlans
            .map( actionPlan => this.resolveScopedSocialState( actionPlan ) )
            .find( ( state ): state is MomentumScopedSocialState => Boolean( state ) );

        if ( scopedSocialState?.stage === 'draft' ) {
            return {
                label: 'Approve Drafts',
                description: `TODD already created ${scopedSocialState.draftPostIds.length} draft${scopedSocialState.draftPostIds.length === 1 ? '' : 's'} tied to this recommendation for review.`,
                route: scopedSocialState.route,
                actionPath: scopedSocialState.actionPath,
                kind: 'primary'
            };
        }

        if ( scopedSocialState?.stage === 'approved' ) {
            return {
                label: 'Open social queue to publish',
                description: `${scopedSocialState.approvedPostIds.length} approved social post${scopedSocialState.approvedPostIds.length === 1 ? ' is' : 's are'} ready on the Social page — open it to publish them.`,
                route: scopedSocialState.route,
                actionPath: scopedSocialState.actionPath,
                kind: 'primary'
            };
        }

        if ( scopedSocialState?.stage === 'rejected' ) {
            return {
                label: 'Dismiss stale recommendation',
                description: 'The drafts tied to this recommendation were rejected, so the original social task is no longer active.',
                route: scopedSocialState.route,
                actionPath: scopedSocialState.actionPath,
                kind: 'primary'
            };
        }

        if ( scopedSocialState?.stage === 'published' || scopedSocialState?.stage === 'archived' ) {
            return null;
        }

        const pendingDraftCount = Number( socialQueueSummary?.draftCount || 0 );
        if ( pendingDraftCount > 0 ) {
            return {
                label: 'Approve Drafts',
                description: `TODD already created ${pendingDraftCount} draft${pendingDraftCount === 1 ? '' : 's'} for review. Open Social and approve the queue.`,
                route: '/outreach/social',
                actionPath: 'Open Social at /outreach/social and review the drafts TODD already prepared.',
                kind: 'primary'
            };
        }

        const route = pendingAction?.route || persistedDecision?.route || nextAction?.route || '';
        const actionPath = pendingAction?.actionPath || persistedDecision?.actionPath || nextAction?.actionPath || '';
        const executionLabel = this.buildExecutionCtaLabel( nextAction, route );

        if ( executionStatus === 'waiting_for_confirmation' && route ) {
            return {
                label: executionLabel || ( nextAction?.title && /lead/i.test( nextAction.title ) ? 'Execute lead add' : 'Execute now' ),
                description: pendingAction?.description || 'Open the prepared execution path so TODD can carry it forward now.',
                route,
                actionPath,
                kind: 'primary'
            };
        }

        if ( executionStatus === 'drafted' && route ) {
            return {
                label: executionLabel || 'Open execution path',
                description: 'TODD already prepared the next execution path. Open it and keep the day moving.',
                route,
                actionPath,
                kind: 'primary'
            };
        }

        if ( executionStatus === 'queued' && route ) {
            return {
                label: 'Open live execution',
                description: 'TODD already moved this action into execution. Open the live page for status and results.',
                route,
                actionPath,
                kind: 'primary'
            };
        }

        if ( executionStatus === 'blocked' ) {
            const blockerCta = this.buildBlockerFallbackCta( blockers );
            if ( blockerCta ) {
                return {
                    ...blockerCta,
                    label: 'Resolve blocker'
                };
            }
        }

        if ( executionStatus === 'failed' ) {
            const blockerCta = this.buildBlockerFallbackCta( blockers );
            if ( blockerCta ) {
                return {
                    ...blockerCta,
                    label: 'Review failed action'
                };
            }
        }

        if ( route ) {
            return {
                label: executionLabel || ( this.isExecutionReady( executionStatus, nextAction ) ? 'Open execution path' : 'Open prepared work' ),
                description: nextAction?.detail || 'TODD prepared the strongest executable move for today.',
                route,
                actionPath,
                kind: 'primary'
            };
        }

        return null;
    }

    private buildExecutionCtaLabel (
        nextAction: ToddMomentumAction | null,
        route: string
    ): string {
        const raw = `${nextAction?.title || ''} ${nextAction?.detail || ''} ${route}`.toLowerCase();
        const normalizedRoute = String( route || '' ).trim().toLowerCase();
        const offerName = this.extractOfferNameFromText( `${nextAction?.title || ''} ${nextAction?.detail || ''}` );
        const withOffer = ( label: string ): string => offerName ? `${label} for ${offerName}` : label;

        if ( /publish approved queue|open social queue|publish approved social/.test( raw ) ) return 'Open social queue to publish';
        if ( /approve drafts|review recommended drafts/.test( raw ) ) return 'Approve Drafts';
        if ( /dismiss stale recommendation/.test( raw ) ) return 'Dismiss stale recommendation';
        if ( /\/compose-email/.test( normalizedRoute ) && /linkedin|threads|social|draft/.test( raw ) ) return withOffer( 'Review in Compose' );
        if ( /\/outreach\/social/.test( normalizedRoute ) ) return 'Open market visibility fallback';
        if ( /reactivat|past client|former client|warm contact/.test( raw ) ) return withOffer( 'Run warm reactivation' );
        if ( /audit|health check|teardown|diagnostic/.test( raw ) ) return withOffer( 'Run same-day audit' );
        if ( /workflow-fix|workflow pain|integration rescue|api|automation rescue|emergency implementation/.test( raw ) ) return withOffer( 'Run workflow-fix offer' );
        if ( /referral partner|trusted subcontractor|referral/.test( raw ) ) return withOffer( 'Activate referral partners' );
        if ( /linkedin|threads|social|draft/.test( raw ) ) return 'Open market visibility fallback';
        if ( /outreach|follow-up|compose-email/.test( raw ) ) return withOffer( 'Review in Compose' );
        if ( /lead|lead vault|network/.test( raw ) ) return 'Review in Lead Vault';
        if ( /docs|offer|proposal|quote|landing/.test( raw ) ) return 'Review in Docs';

        return '';
    }

    private extractOfferNameFromText ( value: string ): string {
        const raw = String( value || '' ).trim();
        const parenthetical = raw.match( /\(([^()]+?)(?:\s*[·,]\s*[^()]*)?\)/ );
        if ( parenthetical?.[1] ) {
            return parenthetical[1].trim();
        }

        const forMatch = raw.match( /\bfor\s+([A-Z][A-Za-z0-9 '&/-]{2,60})(?:[.;:]|$)/ );
        return forMatch?.[1]?.trim() || '';
    }

    private buildDecisionState (
        selectedMove: string,
        selectedMoveTitle: string,
        executionStatus: DailyMomentumExecutionStatus,
        lastActionTaken: string,
        route: string,
        actionPath: string,
        pendingAction: DailyMomentumPendingAction | null
    ): DailyMomentumDecisionState | null {
        if ( !selectedMove ) {
            return null;
        }

        return {
            selectedMove,
            selectedMoveTitle,
            executionStatus,
            lastActionTaken,
            route,
            actionPath,
            pendingAction
        };
    }

    private formatExecutionStatusLabel ( status: DailyMomentumExecutionStatus ): string {
        switch ( status ) {
            case 'drafted':
                return 'Ready to send';
            case 'queued':
                return 'Execution live';
            case 'waiting_for_confirmation':
                return 'Will execute unless stopped';
            case 'blocked':
                return 'Blocked';
            case 'completed':
                return 'Completed';
            case 'failed':
                return 'Failed';
            default:
                return 'Ready to send';
        }
    }

    private formatExecutionModeLabel ( mode: DailyMomentumExecutionMode ): string {
        switch ( mode ) {
            case 'auto':
                return 'Auto mode';
            case 'approval-first':
                return 'Approval-first mode';
            default:
                return 'Manual mode';
        }
    }

    private buildBlockerFallbackCta ( blockers: string[] ): DailyMomentumCta | null {
        const blockerText = blockers.join( ' ' ).toLowerCase();
        if ( blockerText.includes( 'stripe' ) ) {
            return {
                label: 'Connect Stripe',
                description: 'Connect Stripe so TODD can verify tenant revenue before judging today\'s gap.',
                route: '/daily-momentum',
                actionPath: 'Open Daily Momentum at /daily-momentum and use the Connect Stripe action.',
                kind: 'primary'
            };
        }

        if ( blockerText.includes( 'contact' ) || blockerText.includes( 'verified' ) ) {
            return {
                label: 'Review contacts',
                description: 'Increase verified contact coverage so TODD can push more volume.',
                route: '/network/app',
                actionPath: 'Open Network at /network/app to review contact coverage.',
                kind: 'primary'
            };
        }

        if ( blockerText.includes( 'social' ) ) {
            return {
                label: 'Review prepared social',
                description: 'Review the social channel setup before TODD advances the prepared post sequence.',
                route: '/pulse/app',
                actionPath: 'Open Pulse at /pulse/app to review the social publishing setup.',
                kind: 'primary'
            };
        }

        if ( blockerText.includes( 'landing page' ) || blockerText.includes( 'homepage' ) || blockerText.includes( 'conversion' ) ) {
            return {
                label: 'Review page optimization',
                description: 'Review the conversion blocker so TODD can push traffic into a stronger page.',
                route: '/docs/app',
                actionPath: 'Open Docs at /docs/app and review the page optimization TODD wants to make.',
                kind: 'primary'
            };
        }

        if ( blockerText.includes( 'lead' ) ) {
            return {
                label: 'Review lead flow',
                description: 'Review the lead pipeline so TODD can keep today\'s momentum push stocked.',
                route: '/lead-vault',
                actionPath: 'Open Lead Vault at /lead-vault and review the next lead set TODD prepared.',
                kind: 'primary'
            };
        }

        if ( blockerText.includes( 'offer' ) || blockerText.includes( 'promotion' ) || blockerText.includes( 'messaging' ) ) {
            return {
                label: 'Review prepared offer',
                description: 'Review the offer or messaging blocker so TODD can move today\'s campaign forward.',
                route: '/docs/app',
                actionPath: 'Open Docs at /docs/app and review the offer or messaging adjustment TODD prepared.',
                kind: 'primary'
            };
        }

        if ( blockerText.includes( 'reactivat' ) || blockerText.includes( 'old contacts' ) ) {
            return {
                label: 'Review reactivation set',
                description: 'Review the stale contact segment TODD prepared for reactivation.',
                route: '/network/app',
                actionPath: 'Open Network at /network/app and review the reactivation list TODD assembled.',
                kind: 'primary'
            };
        }

        return null;
    }

    private buildStripeConnectionNotice (
        goalStatus: MomentumGoalStatus,
        blockers: string[]
    ): { title: string; message: string; tone: 'info' | 'attention'; items?: string[]; actionLabel?: string; } | null {
        const revenueVerification = goalStatus.revenueVerification || {};
        const status = String( revenueVerification.status || '' ).trim().toLowerCase();
        const connected = revenueVerification.connected === true || revenueVerification.stripeConnected === true;
        const blockerText = blockers.join( ' ' ).toLowerCase();

        if ( status === 'connection_required' || blockerText.includes( 'cannot verify revenue until stripe is connected' ) ) {
            return {
                title: 'Stripe connection required',
                message: revenueVerification.message || 'TODD cannot verify revenue until Stripe is connected for this workspace.',
                tone: 'attention',
                actionLabel: 'Connect Stripe'
            };
        }

        if ( status === 'not_started' || ( !status && !connected ) ) {
            return {
                title: 'Stripe not connected',
                message: revenueVerification.message || 'Connect Stripe so TODD can verify revenue against today\'s target with live data.',
                tone: 'attention',
                actionLabel: 'Connect Stripe'
            };
        }

        if ( status === 'lookup_failed' ) {
            return {
                title: 'Stripe needs attention',
                message: revenueVerification.message || 'TODD connected to Stripe, but could not read today\'s revenue yet.',
                tone: 'attention',
                actionLabel: 'Connect Stripe'
            };
        }

        if ( status === 'onboarding_incomplete' ) {
            const items = Array.isArray( revenueVerification.requirementsDisplay )
                ? revenueVerification.requirementsDisplay.filter( Boolean )
                : [];
            return {
                title: 'Stripe onboarding incomplete',
                message: revenueVerification.message || ( items.length > 0
                    ? 'Stripe still needs a few details before this workspace can use Stripe.'
                    : 'Stripe is still reviewing your account.' ),
                tone: 'attention',
                items,
                actionLabel: 'Continue Stripe setup'
            };
        }

        if ( status === 'legacy_customer' ) {
            return {
                title: 'Stripe connection can be upgraded',
                message: revenueVerification.message || 'TODD is using a legacy Stripe customer link. A tenant Stripe connection gives cleaner revenue verification for Momentum.',
                tone: 'info',
                actionLabel: 'Connect Stripe'
            };
        }

        return null;
    }

    private buildCalendarConnectionNotice (
        goalStatus: MomentumGoalStatus,
        blockers: string[]
    ): { title: string; message: string; tone: 'info' | 'attention'; actionLabel?: string; } | null {
        const calendarVerification = this.getCalendarVerification( goalStatus );
        const blockerText = blockers.join( ' ' ).toLowerCase();

        if ( calendarVerification.status === 'not_connected' || blockerText.includes( 'calendar not connected' ) ) {
            return {
                title: 'Calendar not connected',
                message: 'Connect your calendar so TODD can track meetings and detect revenue activity.',
                tone: 'attention',
                actionLabel: 'Connect Calendar'
            };
        }

        if ( calendarVerification.status === 'unavailable' || blockerText.includes( 'calendar unavailable' ) ) {
            return {
                title: 'Calendar unavailable',
                message: calendarVerification.message || 'Calendar unavailable — meeting tracking unavailable',
                tone: 'attention',
                actionLabel: 'Reconnect Calendar'
            };
        }

        return null;
    }

    private buildSupportCtas (
        goalStatus: MomentumGoalStatus,
        stripeConnectionNotice: { title: string; message: string; tone: 'info' | 'attention'; items?: string[]; actionLabel?: string; } | null
    ): DailyMomentumSupportCta[] {
        const revenueVerification = goalStatus.revenueVerification || {};
        const status = String( revenueVerification.status || '' ).trim().toLowerCase();
        const ctas: DailyMomentumSupportCta[] = [];

        if ( status === 'connected' ) {
            ctas.push( {
                label: 'Manage Stripe',
                route: '/daily-momentum',
                actionPath: 'Open the Stripe Express Dashboard from Daily Momentum to manage payouts and account details.',
                kind: 'secondary'
            } );
            return ctas;
        }

        if ( !stripeConnectionNotice ) {
            return ctas;
        }

        if ( status === 'onboarding_incomplete' ) {
            ctas.unshift( {
                label: 'Continue Stripe onboarding',
                route: '/daily-momentum',
                actionPath: 'Open Daily Momentum at /daily-momentum and continue the Stripe onboarding flow.',
                kind: 'secondary'
            } );
            return ctas;
        }

        if ( stripeConnectionNotice.tone === 'attention' || stripeConnectionNotice.title.includes( 'upgraded' ) ) {
            ctas.unshift( {
                label: 'Connect Stripe',
                route: '/daily-momentum',
                actionPath: 'Open Daily Momentum at /daily-momentum and use the Connect Stripe action.',
                kind: 'secondary'
            } );
        }

        return ctas;
    }

    private buildAppointmentMetric ( goalStatus: MomentumGoalStatus ): {
        label: string;
        value: string;
        note: string;
        state: 'connected' | 'not_connected' | 'unavailable';
    } {
        const calendarVerification = this.getCalendarVerification( goalStatus );

        if ( calendarVerification.status !== 'connected' ) {
            return {
                label: 'Meeting tracking',
                value: 'Unavailable',
                note: calendarVerification.message,
                state: calendarVerification.status === 'unavailable' ? 'unavailable' : 'not_connected'
            };
        }

        const rawValue = goalStatus.appointmentsSoFar
            ?? goalStatus.appointmentCount
            ?? goalStatus.appointments
            ?? calendarVerification.appointmentsToday
            ?? 0;
        const amount = Number( rawValue || 0 );

        return {
            label: 'Appointments so far',
            value: Number.isFinite( amount ) ? String( amount ) : '0',
            note: calendarVerification.message,
            state: 'connected'
        };
    }

    private getCalendarVerification ( goalStatus: MomentumGoalStatus ): {
        status: 'connected' | 'not_connected' | 'unavailable';
        provider: string;
        connected: boolean;
        message: string;
        appointmentsToday: number | null;
    } {
        const verification = goalStatus.calendarVerification || {};
        const status = String( verification.status || '' ).trim().toLowerCase();
        const normalizedStatus: 'connected' | 'not_connected' | 'unavailable' = status === 'connected'
            ? 'connected'
            : status === 'unavailable'
                ? 'unavailable'
                : 'not_connected';
        const appointmentsToday = Number( verification.appointmentsToday );

        return {
            status: normalizedStatus,
            provider: String( verification.provider || '' ).trim().toLowerCase(),
            connected: normalizedStatus === 'connected',
            message: String(
                verification.message
                || ( normalizedStatus === 'connected'
                    ? 'Calendar connected — meeting tracking available.'
                    : normalizedStatus === 'unavailable'
                        ? 'Calendar unavailable — meeting tracking unavailable'
                        : 'Calendar not connected — meeting tracking unavailable' )
            ).trim(),
            appointmentsToday: Number.isFinite( appointmentsToday ) ? appointmentsToday : null
        };
    }

    private ensureSentence ( value: string ): string {
        const trimmed = String( value || '' ).trim();
        if ( !trimmed ) {
            return '';
        }

        return /[.!?]$/.test( trimmed ) ? trimmed : `${trimmed}.`;
    }

    private isGenericActionMenu ( value: string ): boolean {
        const normalized = String( value || '' ).trim().toLowerCase();
        if ( !normalized ) {
            return false;
        }

        const soundsLikeChooser = /choose|pick/.test( normalized )
            || ( /select/.test( normalized ) && ( normalized.includes( ' across ' ) || normalized.includes( ' strongest next move' ) ) );

        return soundsLikeChooser
            && ( /outreach|follow-?up|lead search|social posting|channel/.test( normalized ) )
            && ( normalized.includes( ' or ' ) || normalized.includes( ' across ' ) );
    }

    private formatMoney ( value: number ): string {
        const amount = Number( value || 0 );
        return `$${amount.toFixed( 2 )}`;
    }

    private escapeHtml ( value: string ): string {
        return String( value || '' )
            .replace( /&/g, '&amp;' )
            .replace( /</g, '&lt;' )
            .replace( />/g, '&gt;' )
            .replace( /"/g, '&quot;' )
            .replace( /'/g, '&#39;' );
    }
}
