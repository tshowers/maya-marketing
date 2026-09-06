import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Firestore, collection } from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';
import {
  DocumentData,
  Query,
  onSnapshot,
  orderBy,
  query,
  limit
} from 'firebase/firestore';

import { environment } from '../../environments/environment';

export type CockpitActivityDomain = 'signal_engine' | 'momentum' | 'social_media';
export type CockpitActivitySurface = 'outbox-cockpit' | 'daily-momentum' | 'social-outreach';
export type CockpitLaneId = 'daily_momentum' | 'outbox' | 'social_outreach';

export interface CockpitDailyLaneRecord {
  laneId: string;
  dateKey: string;
  timezone: string;
  totalCount: number;
  startedCount: number;
  completedCount: number;
  failedCount: number;
  blockedCount: number;
  deferredCount: number;
  observedCount: number;
  activeLightCount: number;
  lightCountTouched: number;
  lastCategoryId?: string | null;
  lastLightId?: string | null;
  lastEventAt?: string | null;
}

export interface CockpitDailyLightRecord {
  lightId: string;
  laneId: string;
  categoryId: string;
  label: string;
  sortOrder: number;
  dateKey: string;
  timezone: string;
  active: boolean;
  totalCount: number;
  startedCount: number;
  completedCount: number;
  failedCount: number;
  blockedCount: number;
  deferredCount: number;
  observedCount: number;
  lastEventAt?: string | null;
  lastEventId?: string | null;
  lastStatus?: string | null;
  lastSeverity?: string | null;
  lastMessage?: string;
  lastDetail?: string;
  lastStateBucket?: string | null;
  lastActor?: string | null;
  lastSourceComponent?: string | null;
  lastSourceEntrypoint?: string | null;
  lastTriggerType?: string | null;
  lastCompletedAt?: string | null;
  lastFailedAt?: string | null;
  lastBlockedAt?: string | null;
  lastDeferredAt?: string | null;
  lastStartedAt?: string | null;
  lastObservedAt?: string | null;
  lastMetadata?: Record<string, unknown>;
  lastEntityRefs?: Record<string, unknown>;
}

export interface CockpitDailyLightEvent {
  id: string;
  tenantId?: string;
  dateKey?: string;
  timezone?: string;
  laneId?: string;
  categoryId?: string | null;
  lightId?: string;
  label?: string;
  sortOrder?: number;
  stateBucket?: string;
  status?: string;
  severity?: string;
  message?: string;
  detail?: string;
  actor?: string;
  sourceComponent?: string | null;
  sourceEntrypoint?: string | null;
  triggerType?: string | null;
  entityRefs?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
  createdAt?: string;
}

export interface CockpitDailyLaneStateResponse {
  tenantId: string;
  dateKey: string;
  timezone: string;
  lane: CockpitDailyLaneRecord;
  lights: CockpitDailyLightRecord[];
}

export interface CockpitDailyLightDetailResponse {
  tenantId: string;
  dateKey: string;
  timezone: string;
  light: CockpitDailyLightRecord;
  events: CockpitDailyLightEvent[];
}

export interface CockpitActivityItem {
  id?: string;
  tenantId?: string;
  domain?: CockpitActivityDomain | string;
  surface?: CockpitActivitySurface | string;
  type?: string;
  status?: string;
  message?: string;
  detail?: string;
  severity?: string;
  occurredAt?: string;
  createdAt?: string;
  actor?: string;
  entityRefs?: Record<string, unknown>;
  statePatch?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  frontendVisible?: boolean;
  expiresAt?: string;
  triggerType?: string;
  sourceComponent?: string;
  sourceEntrypoint?: string;
}

export interface CockpitActivityStreamSnapshot {
  items: CockpitActivityItem[];
  newItems: CockpitActivityItem[];
  initial: boolean;
}

@Injectable( {
  providedIn: 'root'
} )
export class CockpitActivityService {
  private readonly firestore = inject( Firestore );

  constructor ( private readonly http: HttpClient ) { }

  watchTenantCockpitActivityStream (
    tenantId: string,
    options?: {
      limit?: number;
      domains?: string[];
      surfaces?: string[];
    }
  ): Observable<CockpitActivityStreamSnapshot> {
    const normalizedTenantId = String( tenantId || '' ).trim();
    if ( !normalizedTenantId ) {
      return new Observable<CockpitActivityStreamSnapshot>( subscriber => {
        subscriber.next( { items: [], newItems: [], initial: true } );
        subscriber.complete();
      } );
    }

    return new Observable<CockpitActivityStreamSnapshot>( subscriber => {
      const perQueryLimit = Math.max( 1, Math.min( Number( options?.limit || 25 ), 100 ) );
      const normalizedDomains = this.normalizeFilters( options?.domains );
      const normalizedSurfaces = this.normalizeFilters( options?.surfaces );
      const fetchLimit = Math.max(
        perQueryLimit,
        Math.min( 100, perQueryLimit * Math.max( 1, normalizedDomains.length || 1 ) * Math.max( 1, normalizedSurfaces.length || 1 ) )
      );
      const baseRef = collection( this.firestore, `tenants/${normalizedTenantId}/cockpit-activity` );
      const previousById = new Map<string, string>();
      let initialEmissionSent = false;

      const emitSnapshot = ( rawItems: CockpitActivityItem[] ): void => {
        const mergedItems = this.dedupeAndSortItems(
          rawItems.filter( item => this.isFrontendVisible( item ) && this.matchesFilters( item, normalizedDomains, normalizedSurfaces ) ),
          perQueryLimit
        );
        const currentById = new Map<string, string>();
        const newItems: CockpitActivityItem[] = [];

        for ( const item of mergedItems ) {
          const identity = this.getItemIdentity( item );
          const fingerprint = this.getItemFingerprint( item );
          currentById.set( identity, fingerprint );
          if ( initialEmissionSent ) {
            const previous = previousById.get( identity );
            if ( previous !== fingerprint ) newItems.push( item );
          }
        }

        previousById.clear();
        currentById.forEach( ( fingerprint, identity ) => previousById.set( identity, fingerprint ) );

        subscriber.next( {
          items: mergedItems,
          newItems: initialEmissionSent ? newItems : [],
          initial: !initialEmissionSent
        } );

        initialEmissionSent = true;
      };

      const activityQuery: Query<DocumentData> = query(
        baseRef,
        orderBy( 'occurredAt', 'desc' ),
        limit( fetchLimit )
      );

      const unsubscribe = onSnapshot(
        activityQuery,
        snapshot => {
          emitSnapshot(
            snapshot.docs.map( doc => ( { id: doc.id, ...( doc.data() as Record<string, unknown> ) } as CockpitActivityItem ) )
          );
        },
        error => subscriber.error( error )
      );

      return () => {
        unsubscribe();
      };
    } );
  }

  watchTenantCockpitActivity (
    tenantId: string,
    options?: {
      limit?: number;
      domains?: string[];
      surfaces?: string[];
    }
  ): Observable<CockpitActivityItem[]> {
    return this.watchTenantCockpitActivityStream( tenantId, options ).pipe(
      map( snapshot => snapshot.items )
    );
  }

  getCockpitActivity (
    tenantId: string,
    options?: {
      limit?: number;
      domains?: string[];
      surfaces?: string[];
    }
  ) {
    const params: Record<string, string> = {
      tenantId: String( tenantId || '' ).trim()
    };

    if ( typeof options?.limit === 'number' && Number.isFinite( options.limit ) ) {
      params['limit'] = String( options.limit );
    }

    if ( Array.isArray( options?.domains ) && options.domains.length > 0 ) {
      params['domains'] = options.domains.join( ',' );
    }

    if ( Array.isArray( options?.surfaces ) && options.surfaces.length > 0 ) {
      params['surfaces'] = options.surfaces.join( ',' );
    }

    return this.http.get<{ success: boolean; data?: { items?: CockpitActivityItem[]; }; }>(
      `${environment.backendURL}/momentum/cockpit-activity`,
      { params }
    );
  }

  getCockpitLaneState (
    tenantId: string,
    laneId: CockpitLaneId | string,
    dateKey?: string
  ) {
    const params: Record<string, string> = {
      tenantId: String( tenantId || '' ).trim(),
      laneId: String( laneId || '' ).trim()
    };

    if ( String( dateKey || '' ).trim() ) {
      params['dateKey'] = String( dateKey || '' ).trim();
    }

    return this.http.get<{ success: boolean; data?: CockpitDailyLaneStateResponse; }>(
      `${environment.backendURL}/momentum/cockpit-lights`,
      { params }
    );
  }

  getCockpitLightDetail (
    tenantId: string,
    laneId: CockpitLaneId | string,
    lightId: string,
    options?: {
      dateKey?: string;
      eventLimit?: number;
    }
  ) {
    const params: Record<string, string> = {
      tenantId: String( tenantId || '' ).trim()
    };

    if ( String( options?.dateKey || '' ).trim() ) {
      params['dateKey'] = String( options?.dateKey || '' ).trim();
    }

    if ( typeof options?.eventLimit === 'number' && Number.isFinite( options.eventLimit ) ) {
      params['eventLimit'] = String( options.eventLimit );
    }

    return this.http.get<{ success: boolean; data?: CockpitDailyLightDetailResponse; }>(
      `${environment.backendURL}/momentum/cockpit-lights/${ encodeURIComponent( String( laneId || '' ).trim() ) }/${ encodeURIComponent( String( lightId || '' ).trim() ) }`,
      { params }
    );
  }

  private normalizeFilters ( values?: string[] ): string[] {
    return Array.from( new Set( ( values || [] ).map( value => String( value || '' ).trim().toLowerCase() ).filter( Boolean ) ) );
  }

  private matchesFilters ( item: CockpitActivityItem, domains: string[], surfaces: string[] ): boolean {
    const itemDomain = String( item?.domain || '' ).trim().toLowerCase();
    const itemSurface = String( item?.surface || '' ).trim().toLowerCase();
    const domainMatch = domains.length === 0 || domains.includes( itemDomain );
    const surfaceMatch = surfaces.length === 0 || surfaces.includes( itemSurface );
    return domainMatch && surfaceMatch;
  }

  private isFrontendVisible ( item: CockpitActivityItem | null | undefined ): boolean {
    return item?.frontendVisible !== false;
  }

  private dedupeAndSortItems ( items: CockpitActivityItem[], limitCount: number ): CockpitActivityItem[] {
    const byId = new Map<string, CockpitActivityItem>();
    for ( const item of items || [] ) {
      byId.set( this.getItemIdentity( item ), item );
    }

    return Array.from( byId.values() )
      .sort( ( left, right ) => this.getItemTimeValue( right ) - this.getItemTimeValue( left ) )
      .slice( 0, limitCount );
  }

  private getItemIdentity ( item: CockpitActivityItem | null | undefined ): string {
    const id = String( item?.id || '' ).trim();
    if ( id ) return id;
    return [
      String( item?.type || '' ).trim(),
      String( item?.occurredAt || item?.createdAt || '' ).trim(),
      String( item?.message || '' ).trim(),
      String( item?.surface || '' ).trim(),
      String( item?.domain || '' ).trim()
    ].join( '::' );
  }

  private getItemFingerprint ( item: CockpitActivityItem | null | undefined ): string {
    return JSON.stringify( {
      type: String( item?.type || '' ).trim(),
      status: String( item?.status || '' ).trim(),
      severity: String( item?.severity || '' ).trim(),
      message: String( item?.message || '' ).trim(),
      detail: String( item?.detail || '' ).trim(),
      occurredAt: String( item?.occurredAt || '' ).trim(),
      createdAt: String( item?.createdAt || '' ).trim()
    } );
  }

  private getItemTimeValue ( item: CockpitActivityItem | null | undefined ): number {
    const raw = String( item?.occurredAt || item?.createdAt || '' ).trim();
    const value = raw ? Date.parse( raw ) : 0;
    return Number.isFinite( value ) ? value : 0;
  }
}
