export type EmployeeType =
  | 'marketing'
  | 'pr'
  | 'sales'
  | 'operations'
  | 'fundraising'
  | 'custom';

export type EmployeeStatus = 'active' | 'paused' | 'archived';
export type EmployeeActionStatus =
  | 'draft'
  | 'needs_approval'
  | 'approved'
  | 'paused'
  | 'completed'
  | 'rejected';
export type EmployeeActionPriority = 'low' | 'medium' | 'high';

export interface EmployeeActionNoteEntry {
  at: string;
  author: 'maya' | 'user';
  authorLabel?: string;
  text: string;
}
export type EmployeePlanStatus = 'active' | 'archived';
export type EmployeeConversationMessageRole = 'user' | 'employee' | 'system';
export type EmployeeConversationActionIntent =
  | 'create'
  | 'update'
  | 'pause'
  | 'reject'
  | 'reprioritize'
  | 'approve'
  | 'schedule';
export type EmployeePlanKind =
  | 'pasted'
  | 'uploaded'
  | 'generated'
  | 'strategy'
  | 'campaign'
  | 'playbook';
export type EmployeeActionOrigin = 'daily_plan' | 'plan_ingestion' | 'chat' | 'system';
export type EmployeeOutcomeStatus = 'positive' | 'neutral' | 'negative' | 'blocked';
export type EmployeeActionOwner = 'maya' | 'todd' | 'operator';
export type EmployeeActionExecutionLane =
  | 'marketing_employee'
  | 'outbox'
  | 'social'
  | 'daily_momentum'
  | 'moves'
  | 'docs'
  | 'network'
  | 'survey';
export type EmployeeOutcomeKind =
  | 'daily_review'
  | 'weekly_review'
  | 'execution_handoff'
  | 'status_update';

export interface EmployeeOutcomeMetric {
  label: string;
  value: string;
  detail?: string;
}

export interface EmployeeOutcomeGoal {
  label: string;
  baseline: string;
  target: string;
  status?: string;
}

export interface EmployeeOutcomeHandoff {
  owner: string;
  summary: string;
  nextActions: string[];
  routes?: string[];
}

export interface EmployeePersona {
  displayName: string;
  voice: string;
  tone: string;
  roleSummary: string;
}

export interface EmployeeContextProfile {
  audiences?: string[];
  stakeholders?: string[];
  channels?: string[];
  themes?: string[];
  riskAreas?: string[];
  priorities?: string[];
  operatingCadence?: string;
}

export interface EmployeeAuthority {
  canDraft: boolean;
  canDraftPosts?: boolean;
  canDraftEmails?: boolean;
  canPublishWithoutApproval: boolean;
  canSendWithoutApproval: boolean;
  canSendEmailsWithoutApproval?: boolean;
  maxSpendWithoutApproval: number;
  maxAdSpendWithoutApproval?: number;
  executionModes?: string[];
  emailOperatingMode?: string;
  senderIdentityMode?: string;
  brandedSenderName?: string | null;
  brandedSenderEmail?: string | null;
  brandedReplyToEmail?: string | null;
}

export interface EmployeeRecord {
  id?: string;
  type: EmployeeType;
  title: string;
  status: EmployeeStatus;
  mission: string;
  goals: string[];
  persona?: EmployeePersona;
  contextProfile?: EmployeeContextProfile;
  authority: EmployeeAuthority;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface EmployeeActionRecord {
  id?: string;
  employeeId: string;
  employeeType?: EmployeeType;
  type: string;
  strategyId?: string | null;
  segmentId?: string | null;
  angleId?: string | null;
  domainTags?: string[];
  title: string;
  description: string;
  channel?: string;
  status: EmployeeActionStatus;
  priority: EmployeeActionPriority;
  reasoning: string;
  contentDraft?: string;
  scheduledFor?: string | null;
  plannedForDate?: string | null;
  sourcePlanId?: string | null;
  origin?: EmployeeActionOrigin;
  approvalRequired?: boolean;
  planningOwner?: EmployeeActionOwner | null;
  executionLane?: EmployeeActionExecutionLane | null;
  targetCount?: number | null;
  completedCount?: number | null;
  moveId?: string | null;
  moveStatus?: string | null;
  monitorRoute?: string | null;
  monitorLabel?: string | null;
  // Maya's own execution-progress reporting - source of truth for this
  // action, mirrored outward to its Move but never overwritten by the
  // reverse direction. See EmployeeActionNoteEntry for the notes thread
  // shape (Maya's status/blocker notes interleaved with human replies).
  progress?: number | null;
  // Set by Maya's midday self-check (assessMayaTaskProgress) - true only
  // when she's reported something only a human can unblock, in which case
  // notesLog's latest Maya entry states exactly what she needs.
  blocked?: boolean;
  notesLog?: EmployeeActionNoteEntry[];
  lastWorkedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface EmployeePlanExtractedPayload {
  goals: string[];
  audiences?: string[];
  stakeholders?: string[];
  channels?: string[];
  campaigns?: string[];
  themes?: string[];
  kpis?: string[];
  timeline?: string;
  risks?: string[];
  priorities?: string[];
}

export interface EmployeePlanRecord {
  id?: string;
  employeeId: string;
  employeeType?: EmployeeType;
  title: string;
  planKind?: EmployeePlanKind;
  rawText: string;
  extracted: EmployeePlanExtractedPayload;
  status: EmployeePlanStatus;
  sourceFileName?: string;
  sourceFileUrl?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface EmployeeConversationRecord {
  id?: string;
  employeeId: string;
  employeeType?: EmployeeType;
  title: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface EmployeeConversationMessageRecord {
  id?: string;
  conversationId?: string;
  role: EmployeeConversationMessageRole;
  content: string;
  relatedActionIds: string[];
  actionIntent?: EmployeeConversationActionIntent;
  createdAt?: string | null;
}

export interface EmployeeChatContext {
  employee: EmployeeRecord | null;
  currentWork: EmployeeActionRecord[];
  pendingApprovals: EmployeeActionRecord[];
  completedWork: EmployeeActionRecord[];
  activePlans: EmployeePlanRecord[];
  planStatus?: {
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
  } | null;
  conversationMessages?: EmployeeConversationMessageRecord[];
  selectedActionId?: string | null;
}

export interface EmployeePlanPreview {
  title: string;
  planKind: EmployeePlanKind;
  rawText: string;
  extracted: EmployeePlanExtractedPayload;
  proposedActions: EmployeeActionRecord[];
  sourceFileName?: string;
  sourceFileUrl?: string;
}

export interface EmployeeOutcomeRecord {
  id?: string;
  employeeId: string;
  employeeType?: EmployeeType;
  actionId?: string | null;
  planId?: string | null;
  outcomeKind?: EmployeeOutcomeKind | null;
  periodKey?: string | null;
  status: EmployeeOutcomeStatus;
  signalSource: string;
  summary: string;
  details?: string;
  metrics?: EmployeeOutcomeMetric[];
  weeklyGoals?: EmployeeOutcomeGoal[];
  handoff?: EmployeeOutcomeHandoff | null;
  reviewedAt: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export const DEFAULT_EMPLOYEE_PERSONA: EmployeePersona = {
  displayName: '',
  voice: '',
  tone: '',
  roleSummary: ''
};

export const DEFAULT_EMPLOYEE_CONTEXT_PROFILE: EmployeeContextProfile = {
  audiences: [],
  stakeholders: [],
  channels: [],
  themes: [],
  riskAreas: [],
  priorities: [],
  operatingCadence: ''
};
