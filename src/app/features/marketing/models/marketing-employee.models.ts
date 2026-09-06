import {
  DEFAULT_EMPLOYEE_CONTEXT_PROFILE,
  DEFAULT_EMPLOYEE_PERSONA,
  EmployeeActionOrigin,
  EmployeeActionOwner,
  EmployeeActionPriority,
  EmployeeActionRecord,
  EmployeeActionExecutionLane,
  EmployeeActionStatus,
  EmployeeAuthority,
  EmployeeContextProfile,
  EmployeeConversationMessageRecord,
  EmployeeConversationMessageRole,
  EmployeeConversationRecord,
  EmployeeOutcomeRecord,
  EmployeePersona,
  EmployeePlanRecord,
  EmployeePlanStatus,
  EmployeeRecord,
  EmployeeStatus
} from '../../employees/models/employee.models';

export type MarketingEmployeeType = 'marketing';
export type MarketingEmployeeStatus = EmployeeStatus;

export type MarketingActionType =
  | 'social_post'
  | 'email'
  | 'blog'
  | 'seo_fix'
  | 'campaign'
  | 'research';

export type MarketingActionStatus = EmployeeActionStatus;
export type MarketingActionPriority = EmployeeActionPriority;
export type MarketingPlanSourceType = 'pasted' | 'uploaded' | 'generated';
export type MarketingPlanStatus = EmployeePlanStatus;
export type MarketingConversationMessageRole = EmployeeConversationMessageRole;
export type MarketingConversationActionIntent =
  | 'create'
  | 'update'
  | 'pause'
  | 'reject'
  | 'reprioritize'
  | 'approve'
  | 'schedule';

export type MarketingActionOrigin = Extract<EmployeeActionOrigin, 'daily_plan' | 'plan_ingestion' | 'chat'>;
export type MarketingActionOwner = EmployeeActionOwner;
export type MarketingActionExecutionLane = EmployeeActionExecutionLane;

export interface MarketingEmployeeAuthority extends EmployeeAuthority {
  canDraftPosts: boolean;
  canDraftEmails: boolean;
  canPublishWithoutApproval: boolean;
  canSendEmailsWithoutApproval: boolean;
  maxAdSpendWithoutApproval: number;
  emailOperatingMode: 'draft_only' | 'queue_with_approval' | 'auto_send';
  senderIdentityMode: 'tenant_user' | 'maya_branded';
  brandedSenderName?: string | null;
  brandedSenderEmail?: string | null;
  brandedReplyToEmail?: string | null;
}

export interface MarketingEmployeeRecord extends Omit<EmployeeRecord, 'type' | 'authority'> {
  id?: string;
  type: MarketingEmployeeType;
  audiences: string[];
  brandVoice: string;
  persona?: EmployeePersona;
  contextProfile?: EmployeeContextProfile;
  authority: MarketingEmployeeAuthority;
}

export interface MarketingEmployeeActionRecord extends Omit<EmployeeActionRecord, 'type' | 'status' | 'priority' | 'origin'> {
  id?: string;
  employeeId: string;
  employeeType?: MarketingEmployeeType;
  type: MarketingActionType;
  strategyId?: string | null;
  segmentId?: string | null;
  angleId?: string | null;
  title: string;
  description: string;
  channel?: string;
  status: MarketingActionStatus;
  priority: MarketingActionPriority;
  reasoning: string;
  contentDraft?: string;
  scheduledFor?: string | null;
  plannedForDate?: string | null;
  sourcePlanId?: string | null;
  origin?: MarketingActionOrigin;
  domainTags?: string[];
  approvalRequired?: boolean;
  planningOwner?: MarketingActionOwner | null;
  executionLane?: MarketingActionExecutionLane | null;
  targetCount?: number | null;
  completedCount?: number | null;
  moveId?: string | null;
  moveStatus?: string | null;
  monitorRoute?: string | null;
  monitorLabel?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface MarketingPlanExtractedPayload {
  goals: string[];
  audiences: string[];
  channels: string[];
  campaigns: string[];
  contentThemes: string[];
  surveyTopics?: string[];
  kpis: string[];
  timeline: string;
}

export interface MarketingPlanRecord extends Omit<EmployeePlanRecord, 'employeeType' | 'planKind' | 'extracted' | 'status'> {
  id?: string;
  employeeId: string;
  employeeType?: MarketingEmployeeType;
  title: string;
  sourceType: MarketingPlanSourceType;
  rawText: string;
  extracted: MarketingPlanExtractedPayload;
  status: MarketingPlanStatus;
  sourceFileName?: string;
  sourceFileUrl?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface MarketingEmployeeConversationRecord extends Omit<EmployeeConversationRecord, 'employeeType'> {
  id?: string;
  employeeId: string;
  employeeType?: MarketingEmployeeType;
  title: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface MarketingEmployeeConversationMessageRecord extends Omit<EmployeeConversationMessageRecord, 'role' | 'actionIntent'> {
  id?: string;
  conversationId?: string;
  role: MarketingConversationMessageRole;
  content: string;
  relatedActionIds: string[];
  actionIntent?: MarketingConversationActionIntent;
  createdAt?: string | null;
}

export interface MarketingEmployeeOutcomeRecord extends Omit<EmployeeOutcomeRecord, 'employeeType'> {
  employeeType?: MarketingEmployeeType;
}

export interface MarketingEmployeeChatContext {
  employee: MarketingEmployeeRecord | null;
  currentWork: MarketingEmployeeActionRecord[];
  pendingApprovals: MarketingEmployeeActionRecord[];
  completedWork: MarketingEmployeeActionRecord[];
  activePlans: MarketingPlanRecord[];
  conversationMessages?: MarketingEmployeeConversationMessageRecord[];
  selectedActionId?: string | null;
}

export interface MarketingPlanPreview {
  title: string;
  sourceType: MarketingPlanSourceType;
  rawText: string;
  extracted: MarketingPlanExtractedPayload;
  proposedActions: MarketingEmployeeActionRecord[];
  sourceFileName?: string;
  sourceFileUrl?: string;
}

export interface MarketingEmployeeWorkspaceSnapshot {
  employee: MarketingEmployeeRecord | null;
  currentWork: MarketingEmployeeActionRecord[];
  pendingApprovals: MarketingEmployeeActionRecord[];
  completedWork: MarketingEmployeeActionRecord[];
}

export const DEFAULT_MARKETING_EMPLOYEE_ID = 'marketing-employee';

export const DEFAULT_MARKETING_EMPLOYEE_AUTHORITY: MarketingEmployeeAuthority = {
  canDraft: true,
  canDraftPosts: true,
  canDraftEmails: true,
  canPublishWithoutApproval: false,
  canSendWithoutApproval: false,
  canSendEmailsWithoutApproval: false,
  maxSpendWithoutApproval: 0,
  maxAdSpendWithoutApproval: 0,
  executionModes: ['draft'],
  emailOperatingMode: 'draft_only',
  senderIdentityMode: 'tenant_user',
  brandedSenderName: 'Maya',
  brandedSenderEmail: null,
  brandedReplyToEmail: null
};

export const DEFAULT_MARKETING_EMPLOYEE_RECORD: MarketingEmployeeRecord = {
  type: 'marketing',
  title: 'Marketing Director',
  status: 'active',
  mission: '',
  goals: [],
  audiences: [],
  brandVoice: '',
  persona: {
    ...DEFAULT_EMPLOYEE_PERSONA,
    displayName: 'Marketing Director',
    voice: 'Clear, direct, practical, and confident.',
    tone: 'strategic',
    roleSummary: 'Turns marketing plans into draft work, approvals, and visible execution.'
  },
  contextProfile: {
    ...DEFAULT_EMPLOYEE_CONTEXT_PROFILE,
    audiences: [],
    channels: [],
    themes: []
  },
  authority: { ...DEFAULT_MARKETING_EMPLOYEE_AUTHORITY }
};
