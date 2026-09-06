import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Survey, SurveyListResult, SurveyStatus, SurveyVisibility } from '../models/survey.model';
import {
  SurveyNlpSearchRequest,
  SurveyNlpSearchResponse,
  SurveySearchRequest,
  SurveySearchResponse
} from '../models/survey-search.model';

export interface SurveyResponsePayload {
  surveyId: string;
  tenantId: string | null;
  responses: any[];
  submittedAt: Date;
}

export interface SubmitSurveyResponseResult {
  success: boolean;
  responseId?: string;
  message?: string;
}

export interface SurveyResponseRecord {
  id: string;
  surveyId: string;
  submittedAt: string | Date;
  tenantId: string | null;
  responses: any[];
}

export interface PublishSurveyResult {
  id?: string;
  status?: SurveyStatus;
  visibility?: SurveyVisibility;
  title?: string;
}

export interface PublicSurveyResponsePayload {
  surveyId: string;
  responses: any[];
  submittedAt: Date;
}


export interface SurveyCheckoutRequest {
  tenantId: string;
  email: string;
}

export interface SurveyCheckoutResult {
  success: boolean;
  checkoutUrl?: string;
  sessionId?: string;
}

@Injectable( {
  providedIn: 'root'
} )
export class SurveyApiService {

  private readonly baseUrl = environment.backendURL + '/surveys';

  constructor ( private http: HttpClient ) { }

  createSurvey ( survey: Survey ): Observable<Survey> {
    return this.http.post<Survey>( this.baseUrl, survey );
  }

  getSurveyResponses ( id: string ): Observable<SurveyResponseRecord[]> {
    return this.http.get<SurveyResponseRecord[]>( `${this.baseUrl}/${id}/responses` );
  }


  updateSurvey ( id: string, survey: Survey ): Observable<Survey> {
    return this.http.put<Survey>( `${this.baseUrl}/${id}`, survey );
  }

  getSurveyById ( id: string ): Observable<Survey | null> {
    return this.http.get<Survey | null>( `${this.baseUrl}/${id}` );
  }

  getPublicSurveyById ( id: string ): Observable<Survey | null> {
    return this.http.get<Survey | null>( `${environment.backendURL}/public/surveys/${id}` );
  }

  publishSurvey ( id: string ): Observable<PublishSurveyResult> {
    return this.http.post<PublishSurveyResult>( `${this.baseUrl}/${id}/publish`, {} );
  }

  unpublishSurvey ( id: string ): Observable<PublishSurveyResult> {
    return this.http.post<PublishSurveyResult>( `${this.baseUrl}/${id}/unpublish`, {} );
  }

  submitSurveyResponse ( id: string, payload: SurveyResponsePayload ): Observable<SubmitSurveyResponseResult> {
    return this.http.post<SubmitSurveyResponseResult>( `${this.baseUrl}/${id}/responses`, payload );
  }

  submitPublicSurveyResponse ( id: string, payload: PublicSurveyResponsePayload ): Observable<SubmitSurveyResponseResult> {
    return this.http.post<SubmitSurveyResponseResult>( `${environment.backendURL}/public/surveys/${id}/responses`, payload );
  }

  listSurveys ( request?: SurveySearchRequest ): Observable<SurveyListResult> {
    let params = new HttpParams();

    if ( request?.pageSize ) {
      params = params.set( 'pageSize', String( request.pageSize ) );
    }

    if ( request?.pageToken ) {
      params = params.set( 'pageToken', request.pageToken );
    }

    if ( request?.filters?.query?.trim() ) {
      params = params.set( 'query', request.filters.query.trim() );
    }

    if ( request?.filters?.status ) {
      params = params.set( 'status', request.filters.status );
    }

    if ( request?.filters?.visibility ) {
      params = params.set( 'visibility', request.filters.visibility );
    }

    if ( request?.filters?.ownerId ) {
      params = params.set( 'ownerId', request.filters.ownerId );
    }

    if ( request?.filters?.tenantId ) {
      params = params.set( 'tenantId', request.filters.tenantId );
    }

    if ( request?.filters?.sortBy ) {
      params = params.set( 'sortBy', request.filters.sortBy );
    }

    if ( request?.filters?.sortDirection ) {
      params = params.set( 'sortDirection', request.filters.sortDirection );
    }

    return this.http.get<SurveyListResult>( this.baseUrl, { params } );
  }

  deleteSurvey ( id: string ): Observable<void> {
    return this.http.delete<void>( `${this.baseUrl}/${id}` );
  }

  searchSurveys ( request: SurveySearchRequest ): Observable<SurveySearchResponse> {
    return this.http.post<SurveySearchResponse>( `${this.baseUrl}/search`, request );
  }

  nlpSearchSurveys ( request: SurveyNlpSearchRequest ): Observable<SurveyNlpSearchResponse> {
    return this.http.post<SurveyNlpSearchResponse>( `${this.baseUrl}/search/nlp`, request );
  }
  createSurveyCheckout ( request: SurveyCheckoutRequest ): Observable<SurveyCheckoutResult> {
    return this.http.post<SurveyCheckoutResult>(
      `${environment.backendURL}/survey/checkout`,
      request
    );
  }

  confirmSurveyCheckout ( sessionId: string ): Observable<any> {
    return this.http.post(
      `${environment.backendURL}/survey/checkout/confirm`,
      { sessionId }
    );
  }
}
