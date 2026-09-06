import {
  EmployeeActionRecord,
  EmployeeChatContext,
  EmployeeConversationMessageRecord,
  EmployeeConversationRecord,
  EmployeePlanPreview,
  EmployeePlanExtractedPayload,
  EmployeePlanRecord,
  EmployeeRecord
} from './employee.models';
import {
  MarketingEmployeeActionRecord,
  MarketingEmployeeAuthority,
  MarketingEmployeeChatContext,
  MarketingEmployeeConversationMessageRecord,
  MarketingEmployeeConversationRecord,
  MarketingEmployeeRecord,
  MarketingPlanExtractedPayload,
  MarketingPlanPreview,
  MarketingPlanRecord
} from '../../marketing/models/marketing-employee.models';

export function marketingEmployeeToEmployeeRecord (record: MarketingEmployeeRecord): EmployeeRecord {
  return {
    id: record.id,
    type: record.type,
    title: record.title,
    status: record.status,
    mission: record.mission,
    goals: [...record.goals],
    persona: record.persona,
    contextProfile: record.contextProfile,
    authority: record.authority,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

export function marketingActionToEmployeeAction (record: MarketingEmployeeActionRecord): EmployeeActionRecord {
  return {
    ...record,
    employeeType: record.employeeType || 'marketing',
    domainTags: record.domainTags || []
  };
}

export function marketingPlanToEmployeePlan (record: MarketingPlanRecord): EmployeePlanRecord {
  return {
    ...record,
    employeeType: record.employeeType || 'marketing',
    planKind: record.sourceType,
    extracted: marketingExtractedToEmployeeExtracted( record.extracted )
  };
}

export function marketingConversationToEmployeeConversation (record: MarketingEmployeeConversationRecord): EmployeeConversationRecord {
  return {
    ...record,
    employeeType: record.employeeType || 'marketing'
  };
}

export function marketingMessageToEmployeeMessage (record: MarketingEmployeeConversationMessageRecord): EmployeeConversationMessageRecord {
  return {
    ...record
  };
}

export function employeeRecordToMarketingEmployee (record: EmployeeRecord): MarketingEmployeeRecord {
  return {
    ...record,
    type: 'marketing',
    audiences: [...( record.contextProfile?.audiences || [] )],
    brandVoice: String( record.persona?.voice || '' ).trim(),
    authority: toMarketingAuthority( record.authority )
  };
}

export function employeePatchToMarketingEmployeePatch (record: Partial<EmployeeRecord>): Partial<MarketingEmployeeRecord> {
  const patch: Partial<MarketingEmployeeRecord> = {
    type: 'marketing'
  };

  if ( record.id !== undefined ) patch.id = record.id;
  if ( record.title !== undefined ) patch.title = record.title;
  if ( record.status !== undefined ) patch.status = record.status;
  if ( record.mission !== undefined ) patch.mission = record.mission;
  if ( record.goals !== undefined ) patch.goals = [...record.goals];
  if ( record.persona !== undefined ) patch.persona = record.persona;
  if ( record.contextProfile !== undefined ) patch.contextProfile = record.contextProfile;
  if ( record.createdAt !== undefined ) patch.createdAt = record.createdAt;
  if ( record.updatedAt !== undefined ) patch.updatedAt = record.updatedAt;

  if ( record.authority !== undefined ) {
    patch.authority = toMarketingAuthority( record.authority );
  }

  if ( record.contextProfile !== undefined ) {
    patch.audiences = [...( record.contextProfile?.audiences || [] )];
  }

  if ( record.persona !== undefined ) {
    patch.brandVoice = String( record.persona?.voice || '' ).trim();
  }

  return patch;
}

export function employeeActionToMarketingAction (record: EmployeeActionRecord): MarketingEmployeeActionRecord {
  return {
    ...record,
    employeeType: 'marketing',
    type: record.type as MarketingEmployeeActionRecord['type'],
    status: record.status,
    priority: record.priority,
    origin: record.origin as MarketingEmployeeActionRecord['origin']
  };
}

export function employeeActionPatchToMarketingActionPatch (
  record: Partial<EmployeeActionRecord>
): Partial<MarketingEmployeeActionRecord> {
  return {
    ...record,
    employeeType: 'marketing',
    type: record.type as MarketingEmployeeActionRecord['type'],
    status: record.status as MarketingEmployeeActionRecord['status'],
    priority: record.priority as MarketingEmployeeActionRecord['priority'],
    origin: record.origin as MarketingEmployeeActionRecord['origin']
  };
}

export function employeePlanToMarketingPlan (record: EmployeePlanRecord): MarketingPlanRecord {
  return {
    ...record,
    employeeType: 'marketing',
    sourceType: ( record.planKind || 'pasted' ) as MarketingPlanRecord['sourceType'],
    extracted: employeeExtractedToMarketingExtracted( record.extracted )
  };
}

export function employeeMessageToMarketingMessage (record: EmployeeConversationMessageRecord): MarketingEmployeeConversationMessageRecord {
  return {
    ...record,
    actionIntent: record.actionIntent as MarketingEmployeeConversationMessageRecord['actionIntent']
  };
}

export function employeeChatContextToMarketingChatContext (record: EmployeeChatContext): MarketingEmployeeChatContext {
  return {
    employee: record.employee ? employeeRecordToMarketingEmployee( record.employee ) : null,
    currentWork: ( record.currentWork || [] ).map( employeeActionToMarketingAction ),
    pendingApprovals: ( record.pendingApprovals || [] ).map( employeeActionToMarketingAction ),
    completedWork: ( record.completedWork || [] ).map( employeeActionToMarketingAction ),
    activePlans: ( record.activePlans || [] ).map( employeePlanToMarketingPlan ),
    conversationMessages: ( record.conversationMessages || [] ).map( employeeMessageToMarketingMessage ),
    selectedActionId: record.selectedActionId || null
  };
}

export function employeeExtractedToMarketingExtracted (record: EmployeePlanExtractedPayload): MarketingPlanExtractedPayload {
  return {
    goals: [...( record.goals || [] )],
    audiences: [...( record.audiences || [] )],
    channels: [...( record.channels || [] )],
    campaigns: [...( record.campaigns || [] )],
    contentThemes: [...( record.themes || [] )],
    kpis: [...( record.kpis || [] )],
    timeline: String( record.timeline || '' ).trim()
  };
}

export function marketingExtractedToEmployeeExtracted (record: MarketingPlanExtractedPayload): EmployeePlanExtractedPayload {
  return {
    goals: [...( record.goals || [] )],
    audiences: [...( record.audiences || [] )],
    channels: [...( record.channels || [] )],
    campaigns: [...( record.campaigns || [] )],
    themes: [...( record.contentThemes || [] )],
    kpis: [...( record.kpis || [] )],
    timeline: String( record.timeline || '' ).trim()
  };
}

export function marketingPreviewToEmployeePlanPreview (record: MarketingPlanPreview): EmployeePlanPreview {
  return {
    title: record.title,
    planKind: record.sourceType,
    rawText: record.rawText,
    extracted: marketingExtractedToEmployeeExtracted( record.extracted ),
    proposedActions: ( record.proposedActions || [] ).map( marketingActionToEmployeeAction ),
    sourceFileName: record.sourceFileName,
    sourceFileUrl: record.sourceFileUrl
  };
}

export function employeePreviewToMarketingPlanPreview (record: EmployeePlanPreview): MarketingPlanPreview {
  const sourceType = record.planKind === 'uploaded' || record.planKind === 'generated'
    ? record.planKind
    : 'pasted';

  return {
    title: record.title,
    sourceType,
    rawText: record.rawText,
    extracted: employeeExtractedToMarketingExtracted( record.extracted ),
    proposedActions: ( record.proposedActions || [] ).map( employeeActionToMarketingAction ),
    sourceFileName: record.sourceFileName,
    sourceFileUrl: record.sourceFileUrl
  };
}

function toMarketingAuthority (
  authority: EmployeeRecord['authority'] | Partial<EmployeeRecord['authority']> | undefined
): MarketingEmployeeAuthority {
  return {
    canDraft: authority?.canDraft === true,
    canDraftPosts: authority?.canDraftPosts === true,
    canDraftEmails: authority?.canDraftEmails === true,
    canPublishWithoutApproval: authority?.canPublishWithoutApproval === true,
    canSendWithoutApproval: authority?.canSendWithoutApproval === true,
    canSendEmailsWithoutApproval: authority?.canSendEmailsWithoutApproval === true,
    maxSpendWithoutApproval: Number( authority?.maxSpendWithoutApproval || 0 ),
    maxAdSpendWithoutApproval: Number( authority?.maxAdSpendWithoutApproval || 0 ),
    executionModes: authority?.executionModes || [],
    emailOperatingMode:
      authority?.emailOperatingMode === 'auto_send' ||
      authority?.emailOperatingMode === 'queue_with_approval' ?
        authority.emailOperatingMode :
        'draft_only',
    senderIdentityMode:
      authority?.senderIdentityMode === 'maya_branded' ?
        'maya_branded' :
        'tenant_user',
    brandedSenderName: authority?.brandedSenderName || 'Maya',
    brandedSenderEmail: authority?.brandedSenderEmail || null,
    brandedReplyToEmail: authority?.brandedReplyToEmail || null
  };
}
