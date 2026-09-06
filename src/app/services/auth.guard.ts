import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { catchError, map, switchMap, take } from 'rxjs/operators';
import { of } from 'rxjs';
import { LoggerService } from './logger.service';
import { EntitlementService } from './entitlement.service';

export const authGuard: CanActivateFn = ( route, state ) => {
  const authService = inject( AuthService );
  const userService = inject( UserService );
  const logger = inject( LoggerService );
  const router = inject( Router );
  const entitlementService = inject( EntitlementService );
  const normalizedPath = state.url.split( '?' )[0].split( '#' )[0];
  const allowSignedInWithoutSubscription = new Set( [
    '/update-profile',
    '/user-profile',
    '/billing',
    '/dropdown-manager',
    '/settings',
  ] );
  const suiteEntitledRoutes = new Set( [
    '/marketing-employee',
    '/marketing-employee/plan',
  ] );



  return authService.getUser().pipe(
    take( 1 ),
    switchMap( user => {
      if ( !user ) {
        const demoParamValue = String( route.queryParamMap?.get( 'demo' ) || '' ).trim().toLowerCase();
        const demoAccessRequested = ['1', 'true', 'yes', 'on'].includes( demoParamValue );
        const demoableRoute = ['/daily-momentum', '/mission', '/outreach/social'].includes( normalizedPath );

        if ( demoAccessRequested && demoableRoute ) {
          logger.log( `AuthGuard - unauthenticated demo access requested for ${normalizedPath}, allowing access` );
          return of( true );
        }

        logger.log( "AuthGuard - no user, redirecting to not-authorized" );
        return of( router.createUrlTree( ['/not-authorized'] ) );
      }


      const suiteAccess$ = suiteEntitledRoutes.has( normalizedPath ) ?
        entitlementService.getResolvedEntitlements().pipe(
          take( 1 ),
          map( entitlements => !!entitlements.suite ),
          catchError( () => of( false ) ),
        ) :
        of( false );

      return suiteAccess$.pipe(
        switchMap( suiteAccess => userService.getContactByFirebaseUid( user.uid ).pipe(
        take( 1 ),
        map( contact => {
          // Affiliate (and optional reseller) bypass – these users may not have paid subscriptions
          const isAffiliate = (
            ( contact?.affiliate === true ) ||
            ( typeof contact?.type === 'string' && contact.type.toLowerCase() === 'affiliate' ) ||
            ( typeof contact?.acquisitionSource === 'string' && contact.acquisitionSource.toLowerCase() === 'affiliate' ) ||
            ( typeof ( contact as any )?.role === 'string' && ( contact as any ).role.toLowerCase() === 'affiliate' )
          );

          const isReseller = (
            ( typeof contact?.type === 'string' && contact.type.toLowerCase() === 'reseller' ) ||
            ( typeof contact?.acquisitionSource === 'string' && contact.acquisitionSource.toLowerCase() === 'reseller' )
          );

          if ( isAffiliate || isReseller ) {
            logger.log( 'AuthGuard - affiliate/reseller detected, allowing access', contact );
            return true;
          }

          if ( allowSignedInWithoutSubscription.has( normalizedPath ) ) {
            logger.log( 'AuthGuard - account route allowed for signed-in user without subscription check', normalizedPath, contact );
            return true;
          }

          if ( suiteAccess ) {
            logger.log( 'AuthGuard - active Suite entitlement, allowing access', normalizedPath, contact );
            return true;
          }

          if ( !contact?.subscription ) {
            logger.log( "AuthGuard - no subscription object found, allowing access", contact );
            return true;  // No subscription object yet → allow access
          }

          const subscription = contact.subscription;
          const status = ( subscription.status || '' ).toLowerCase();
          const expiresAt = subscription.expiresAt ? new Date( subscription.expiresAt ).getTime() : 0;
          const now = Date.now();

          logger.log(
            'AuthGuard subscription status:', status,
            'expiresAt:', expiresAt,
            'now:', now,
            contact
          );

          // Treat both Stripe-style 'trialing' and our own 'trial' as valid trials
          if ( status === 'trial' || status === 'trialing' ) {
            if ( expiresAt >= now ) {
              logger.log( 'AuthGuard - trial is still valid, allowing access', contact );
              return true;
            } else {
              logger.log( 'AuthGuard - trial expired, redirecting to suite pricing', contact );
              return router.createUrlTree( ['/suite/pricing'], { queryParams: { reason: 'trialExpired' } } );
            }
          }

          if ( status === 'active' || status === 'paid' ) {
            logger.log( 'AuthGuard - active subscription, allowing access', contact );
            return true;
          }

          logger.log( "AuthGuard - invalid or inactive subscription, redirecting to suite pricing", contact );
          return router.createUrlTree( ['/suite/pricing'], { queryParams: { reason: 'subscriptionInactive' } } );
        } ) ) ),
        catchError( error => {
          logger.error( 'Error fetching contact:', error );
          return of( router.createUrlTree( ['/login-error'] ) );
        } )
      );
    } ),
    catchError( error => {
      logger.error( 'AuthGuard error:', error );
      logger.log( "AuthGuard - unexpected error, redirecting to /login-error" );
      return of( router.createUrlTree( ['/login-error'] ) );
    } )
  );
};
