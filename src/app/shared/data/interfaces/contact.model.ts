/*****************************************************************************
 *                 Taliferro License Notice
 *
 * The contents of this file are subject to the Taliferro License
 * (the "License"). You may not use this file except in
 * compliance with the License. A copy of the License is available at
 * http://taliferro.com/license/
 *
 *
 * Title: Contact
 * @author Tyrone Showers
 *
 * @copyright 1997-2026 Taliferro, Inc. All Rights Reserved.
 *
 *        Change Log
 *
 * Version     Date       Description
 * -------   ----------  -------------------------------------------------------
 *  0.1      08/17/2017  Baselined
 *  0.2      08/18/2017  Added state and dropdown interface
 *  0.3      10/21/2017  Removed constructors
 *  0.4      04/23/2024  Upgrade to 17 and adhere to Typescript Naming
 *  0.5      05/14/2024  chnages to Contact to return arrays on certain fields
 *****************************************************************************/

import { Image } from './image.model';
import { JustText } from './just-text.model';
import { State } from './state.model';
import { Document } from './docuttach.model';
import { ToddWritingIdentity } from './todd-writing-identity.model';


export interface Contact extends State {
  firstName: string;
  middleName?: string;
  lastName: string;
  tenantId?: string;
  isCompany?: boolean;
  ssn?: string;
  company?: Company;
  selected?: any;
  prefix?: string;
  url?: string;
  opened?: any;
  openedAt?: any;
  isReconfigured?: boolean;
  lastReconfigured?: string;
  isEnriched?: boolean;
  lastEnriched?: string;
  _insight?: any;
  signature?: string;
  favoredPosts?: any[];
  affiliateCode?: string;
  subscription?: Subscription;
  affiliate?: boolean;
  reseller?: boolean;
  profession?: string;
  status?: string;
  statusHistory?: any[];
  emails?: any[];
  sector?: string;
  successStory?: string;
  profileTypes?: any[];
  category?: string | any[];
  type?: string;
  linkedInUrl?: string;
  referral?: string;
  nickname?: string;
  birthday?: string;
  anniversary?: any;
  gender?: string;
  email?: string;
  subscriber?: boolean;
  important?: boolean;
  addresses?: Address[];
  phoneNumbers?: PhoneNumber[];
  emailAddresses?: EmailAddress[];
  socialMedia?: SocialMedia[];
  jobDescriptionForTODD?: string;
  notes?: JustText[];
  dependents?: any[];
  preferences?: any[];
  opportunities?: any[];
  proposals?: any[];
  contracts?: any[];
  orders?: any[];
  FOPs?: any[];
  events?: any[];
  alerts?: any[];
  projects?: any[];
  invoices?: any[];
  ratings?: any[];
  documents?: Document[];
  images?: Image[];
  tempScore?: number;
  tempReason?: any;
  shared?: boolean;
  systemUser?: boolean;
  employee?: boolean;
  billingRate?: number;
  loginID?: string;
  timezone?: string;
  timezoneSource?: 'contact' | 'company' | 'coordinates' | 'state' | 'phone' | 'tenantDefault' | 'unknown';
  timezoneConfidence?: 'high' | 'medium' | 'low';
  timezoneLastResolvedAt?: string;
  engagements?: Engagement[];
  connectionDetails?: ConnectionDetail;
  interactions?: Interaction[];
  lastContacted?: string;
  clicks?: number;
  lastOpenedAt?: Date;
  lastClickedAt?: Date;
  acquisitionSource?: string;
  stripeCustomerId?: any;
  recentCampaign?: boolean;
  campaigns?: any[];
  statusClasses?: string;
  statusTooltip?: string;
  emailStage?: any;
  contactValue?: number;
  avatar?: string;
  displayName?: string;
  toddWritingIdentity?: ToddWritingIdentity;

  uid?: string; // Firebase UID if this contact has an account
  /**
   * Public username (vanity handle). Store as lowercase, no spaces.
   * Normalize on write: handle = handle.trim().toLowerCase()
   */
  handle?: string;
  publicProfile?: boolean; // Whether profile can be viewed publicly
  publicFields?: string[]; // Whitelist of safe fields to expose on the public profile view

  // Normalized fields for search (lowercase for Firestore prefix queries)
  displayNameLower?: string;
  companyNameLower?: string; // mirror of company.name in lowercase for search
  tagsLower?: string[];      // optional normalized tags (if you use tags on contact)

  // GDPR/CASL consent tracking
  marketingConsent?: boolean;
  marketingConsentTimestamp?: string; // ISO timestamp of user's own signup consent
  consentSource?: string;             // e.g. 'signup_form', 'import', 'manual', 'lead_vault'
  consentTimestamp?: string;          // ISO timestamp of contact-level consent capture
  phoneLookupKeys?: string[];
  onboardingSeries?: ContactOnboardingSeriesState;
  activationMilestone?: ContactActivationMilestoneState;
}

export interface ContactOnboardingSeriesStep {
  stepNumber: number;
  subject: string;
  html: string;
  text: string;
  delayDays?: number;
}

export interface ContactOnboardingSeriesState {
  seriesId: string;
  seriesName: string;
  trigger: 'signup' | string;
  status: 'enrolled' | 'suppressed' | 'completed' | string;
  enrolledAt?: string;
  suppressedAt?: string;
  suppressionReason?: string;
  lastSentStepNumber?: number;
  sequenceSteps?: ContactOnboardingSeriesStep[];
}

export interface ContactActivationMilestoneState {
  activatedAt?: string;
  activationType?: 'profile_completed' | 'contacts_ready' | 'module_action' | string;
  activationSource?: string;
  activationRoute?: string;
  activationTitle?: string;
}

export interface Company {
  name: string;
  nameLower?: string; // normalized lowercase for search
  dba?: string;
  numberOfEmployees?: string;
  capabilities?: any;
  other?: string;
  description?: string;
  goal?: string;
  valueProp?: string;
  keyFeatures?: string[];
  /** Optional public scheduling link used by Maya when offering a meeting. */
  calendarLink?: string;
  mentionBrandInEmails?: boolean;
  phoneNumbers?: Array<PhoneNumber>;
  emailAddresses?: Array<EmailAddress>;
  addresses?: Array<Address>;
  publicInfo?: string;
  uei?: string;
  ubi?: string;
  size?: string;
  url?: string;
  sicCode?: string;
  status?: string;
  shared?: boolean;
}

export interface SocialMedia {
  platform: string; // Type of social media, e.g., 'Instagram', 'LinkedIn'
  url: string; // URL to the social media profile
  username?: string | null;
  verified?: boolean; // Optional flag to indicate if the account is verified
  checked?: boolean;
  dateChecked?: string;
}

export interface Address extends State {
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  county: string;
  addressType: string;
  latitude: number;
  longitude: number;
  timezone?: string;

  contact_id?: string;
}

export interface Subscription {
  plan?: string | null;
  status?: string | null;
  billingCycle?: string | null;
  audience?: string | null;
  expiresAt?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
}

export interface EmailAddress {
  name?: string;
  emailAddress: string;
  emailAddressType: string;
  blocked: boolean;
  checked?: boolean;
  dateChecked?: string;
  isEmailEnriched?: boolean;
  lastEmailEnriched?: string;
}

export interface PhoneNumber {
  name?: string;
  phoneNumber: string;
  phoneNumberType: string;
}

export interface Dependent {
  firstName: string;
  lastName: string;
  relationship: string;
}

export interface Interaction {
  type: string; // e.g., 'email', 'phone call', 'meeting'
  date: string;
  duration: number; // Duration in minutes, applicable for calls or meetings
  notes: string; // Optional, any notes about the interaction
}

export interface Engagement {
  interactionId: string; // Link to a specific interaction
  responseTime: number; // Time in hours or days
  outcome: string; // e.g., 'successful deal', 'follow-up required', etc.
  engagementLevel: number; // A score or metric assessing engagement depth
}

export interface ConnectionDetail {
  startDate: string; // When you first connected
  mutualConnections: number; // Count of mutual connections, if applicable
  transactionHistory: Transaction[]; // If applicable, a history of transactions
}

export interface Transaction {
  date: string;
  amount: number;
  description: string;
}

export interface Communication {
  id?: string;
  contactId: string;
  date: string;

  messageSent?: string;
  replyReceived?: string;
}

export interface SuggestedContact {
  contact: Contact;
  reason: string;
  score: number;
  lastCommDate?: Date | string; // add `string` if it's coming from JSON
  lastUpdated?: Date | string;
}

export type RubricKey =
  | 'projectDelivery'
  | 'clientFeedback'
  | 'documentationQuality'
  | 'verifiedExperience'
  | 'communityInvestment'
  | 'certifications'
  | 'responsiveness';

export type RubricState = Record<RubricKey, number>; // 1–5 each

export interface RubricWeights extends Record<RubricKey, number> { }
export interface ScoreDraft {
  companyName: string;
  reviewerId: string;
  tenantId: string;
  rubric: RubricState;         // 1–5 sliders
  comments: string;
  needsFollowUp: boolean;
  updatedAt: string;           // ISO
}

export interface FinalScore extends ScoreDraft {
  weightedScore: number;       // 0–100
  letter: 'A' | 'B' | 'C' | 'D' | 'F';
  submittedAt: string;         // ISO
}

// company-overview.model.ts
export interface CompanyOverviewModel {
  companyName: string;
  peopleCount: number;
  domains: string[];
  address?: string;
  phones?: string[];
  publicInfo?: string;
  signals?: { opens90d: number; clicks90d: number; bounces90d?: number; unsub90d?: number; };
  loading?: boolean;
}

export interface AppUser {
  id: string;
  email: string;
  displayName?: string;
  role: UserRole;
  companyId?: string;
  status: 'active' | 'invited' | 'disabled';
  isTenantOwner?: boolean;
}

export type UserRole = 'admin' | 'reviewer' | 'contractor';

export interface TenantInvite {
  id: string;
  tenantId: string;
  email: string;
  emailLower: string;
  displayName: string;
  phone?: string;
  phoneLookupKeys?: string[];
  role: UserRole;
  status: 'pending' | 'accepted' | 'cancelled';
  invitedByUid?: string;
  invitedAt?: string;
  acceptedAt?: string;
  acceptedByUid?: string;
}

export interface CompanyOverview {
  id: string;
  name: string;
  ownershipDemographics?: {
    minorityOwned?: boolean;
    womenOwned?: boolean;
    veteranOwned?: boolean;
    other?: string[];
  };
  certifications?: string[];
  averageGrade?: string; // A+, A, B, etc.
  isPublic?: boolean;
  status?: string;
  publicPortfolioUrl?: string;
  submittedAt?: Date;
}


export interface GradingWeights {
  projectDelivery: number;
  clientFeedback: number;
  documentationQuality: number;
  verifiedExperience: number;
  communityInvestment: number;
  certifications: number;
  responsiveness: number;
}
