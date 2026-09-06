import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable( {
  providedIn: 'root'
} )
export class ResponseFlowService {

  private readonly baseUrl = `${environment.backendURL}/response-flows`;

  constructor ( private http: HttpClient ) { }

  createResponseFlow ( flow: any ): Observable<any> {
    return this.http.post<any>( this.baseUrl, flow );
  }

  getResponseFlows (): Observable<any[]> {
    return this.http.get<any[]>( this.baseUrl );
  }

  getResponseFlow ( id: string ): Observable<any> {
    return this.http.get<any>( `${this.baseUrl}/${id}` );
  }

  updateResponseFlow ( id: string, flow: any ): Observable<any> {
    return this.http.put<any>( `${this.baseUrl}/${id}`, flow );
  }

  removeResponseFlow ( id: string ): Observable<any> {
    return this.http.delete<any>( `${this.baseUrl}/${id}` );
  }
}
