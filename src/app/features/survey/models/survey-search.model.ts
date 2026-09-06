import { Survey, SurveyStatus, SurveyVisibility } from './survey.model';

export interface SurveySearchFilters {
    query?: string;
    status?: SurveyStatus;
    visibility?: SurveyVisibility;
    ownerId?: string;
    tenantId?: string;
    sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'lastViewedAt' | 'responseCount';
    sortDirection?: 'asc' | 'desc';
}

export interface SurveySearchRequest {
    filters?: SurveySearchFilters;
    pageSize?: number;
    pageToken?: string | null;
}

export interface SurveySearchResponse {
    surveys: Survey[];
    nextPageToken?: string | null;
    totalCount?: number;
}

export interface SurveyNlpSearchRequest {
    query: string;
    pageSize?: number;
    pageToken?: string | null;
}

export interface SurveyNlpSearchResponse {
    surveys: Survey[];
    nextPageToken?: string | null;
    interpretedQuery?: string;
    totalCount?: number;
}
