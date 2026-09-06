export type SurveyQuestionType =
    | 'text'
    | 'textarea'
    | 'multiple_choice'
    | 'checkbox'
    | 'yes_no'
    | 'rating'
    | 'dropdown'
    | 'date'
    | 'email'
    | 'number';

export type SurveyStatus = 'draft' | 'published' | 'archived';

export type SurveyVisibility = 'private' | 'public' | 'link_only';

export interface SurveyQuestion {
    id?: string;
    order?: number;
    questionText: string;
    questionType: SurveyQuestionType | string;
    options: string[];
    required?: boolean;
    helpText?: string;
    placeholder?: string;
}

export interface Survey {
    id?: string;
    tenantId?: string;
    ownerId?: string;
    title: string;
    description: string;
    questions: SurveyQuestion[];
    status?: SurveyStatus;
    visibility?: SurveyVisibility;
    responseCount?: number;
    publishedAt?: string;
    createdAt?: string;
    updatedAt?: string;
    lastViewedAt?: string;

    // Legacy timestamp support during migration.
    dateAdded?: string;
    lastUpdated?: string;
    lastViewed?: string;
}

export interface SurveyListResult {
    surveys: Survey[];
    nextPageToken?: string | null;
}

export interface SurveySearchRequest {
    query?: string;
    pageSize?: number;
    pageToken?: string | null;
    status?: SurveyStatus;
    visibility?: SurveyVisibility;
}
