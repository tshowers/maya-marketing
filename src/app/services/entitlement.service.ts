import { Injectable, inject } from '@angular/core';
import { Observable, of, combineLatest } from 'rxjs';
import { debounceTime, take, switchMap, map, catchError, startWith, shareReplay } from 'rxjs/operators';

import { AccountBillingService, AccountSummaryResponse } from './account-billing.service';
import { AuthService } from './auth.service';

export interface Entitlements {
  network: boolean;
  moves: boolean;
  outreach: boolean;
  docs: boolean;
  knowledge: boolean;
  pulse: boolean;
  suite: boolean;
}

const DEFAULTS: Entitlements = {
  network: false,
  moves: false,
  outreach: false,
  docs: false,
  knowledge: false,
  pulse: false,
  suite: false,
};

@Injectable( { providedIn: 'root' } )
export class EntitlementService {
  private readonly authService = inject( AuthService );
  private readonly accountBillingService = inject( AccountBillingService );

  // Cached per app session — invalidated on page reload.
  private cached$: Observable<Entitlements> | null = null;

  /**
   * Returns an observable of the current user's paid entitlements.
   * Emits DEFAULTS immediately (all false = show pricing buttons), then
   * resolves the real values once auth and the account summary settle.
   * Suite subscribers get every feature flag set to true.
   */
  getEntitlements (): Observable<Entitlements> {
    if ( !this.cached$ ) {
      this.cached$ = this.fetchResolvedEntitlements().pipe(
        // Emit DEFAULTS synchronously so templates never wait on async.
        startWith( DEFAULTS ),
        shareReplay( { bufferSize: 1, refCount: false } ),
      );
    }
    return this.cached$;
  }

  getResolvedEntitlements (): Observable<Entitlements> {
    return this.fetchResolvedEntitlements();
  }

  resetCache (): void {
    this.cached$ = null;
  }

  private fetchResolvedEntitlements (): Observable<Entitlements> {
    return combineLatest( [
      this.authService.getTenantId(),
      this.authService.getUser(),
    ] ).pipe(
      debounceTime( 0 ),
      take( 1 ),
      switchMap( ( [ tenantId, user ] ) => {
        if ( !tenantId || !( user as any )?.uid ) return of( DEFAULTS );
        return this.accountBillingService
          .getSummary( {
            tenantId,
            userId: ( user as any ).uid,
            userEmail: ( user as any ).email ?? '',
          } )
          .pipe(
            map( ( res ) => this.mapToEntitlements( res ) ),
            catchError( () => of( DEFAULTS ) ),
          );
      } ),
    );
  }

  private mapToEntitlements ( res: AccountSummaryResponse ): Entitlements {
    const tenant = res?.data?.tenant;
    if ( !tenant ) return DEFAULTS;
    const suiteStatus = String( tenant[ 'stripeToddSuiteSubscriptionStatus' ] || '' ).trim().toLowerCase();
    const suite = !!tenant[ 'toddSuitePaidAccess' ] ||
      [ 'active', 'paid', 'trial', 'trialing' ].includes( suiteStatus );
    return {
      suite,
      network: suite || !!tenant[ 'networkPaidAccess' ],
      moves: suite || !!tenant[ 'movesPaidAccess' ],
      outreach: suite || !!tenant[ 'outreachPaidAccess' ],
      docs: suite || !!tenant[ 'docsPaidAccess' ],
      knowledge: suite || !!tenant[ 'knowledgePaidAccess' ],
      pulse: suite || !!tenant[ 'surveyPaidAccess' ],
    };
  }
}
