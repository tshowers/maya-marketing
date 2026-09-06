import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface DocumentLimits {
  isPaidUser: boolean;
  currentCount: number;
  freeDocumentLimit: number;
  remainingFreeDocuments: number;
  canCreateDocument: boolean;
}

@Injectable( {
  providedIn: 'root'
} )
export class DocService {
  private readonly baseUrl = `${environment.backendURL}/docs`;

  constructor ( private http: HttpClient ) { }

  createDocument ( document: any, _userId?: string ): Observable<any> {
    return this.http.post<any>( this.baseUrl, document ).pipe(
      map( response => response?.document ?? response )
    );
  }

  getDocuments ( _userId?: string ): Observable<any[]> {
    return this.http.get<any>( this.baseUrl ).pipe(
      map( response => response?.documents ?? response )
    );
  }

  getDocument ( id: string, _userId?: string ): Observable<any> {
    return this.http.get<any>( `${this.baseUrl}/${id}` ).pipe(
      map( response => response?.document ?? response )
    );
  }

  updateDocument ( id: string, document: any, _userId?: string ): Observable<any> {
    return this.http.put<any>( `${this.baseUrl}/${id}`, document ).pipe(
      map( response => response?.document ?? response )
    );
  }

  removeDocument ( id: string, _userId?: string ): Observable<any> {
    return this.http.delete<any>( `${this.baseUrl}/${id}` );
  }

  getLimits (): Observable<DocumentLimits> {
    return this.http.get<any>( `${this.baseUrl}/limits` ).pipe(
      map( response => {
        const limits = response?.limits || {};
        return {
          isPaidUser: !!limits.isPaidUser,
          currentCount: Number( limits.currentCount ) || 0,
          freeDocumentLimit: Number( limits.freeDocumentLimit ) || 10,
          remainingFreeDocuments: Number( limits.remainingFreeDocuments ) || 0,
          canCreateDocument: !!limits.canCreateDocument
        } as DocumentLimits;
      } )
    );
  }
}
