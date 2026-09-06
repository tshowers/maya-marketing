import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';

function isBackendApiRequest ( url: string ): boolean {
    return url.includes( '/api/' );
}

function isAnonymousTrackingRequest ( url: string ): boolean {
    return url.includes( '/anonymous-behavior/' );
}

export const tenantInterceptor: HttpInterceptorFn = ( req, next ) => {
    if ( !isBackendApiRequest( req.url ) || isAnonymousTrackingRequest( req.url ) ) {
        return next( req );
    }

    const authService = inject( AuthService );
    const tenantId = authService.getTenant();
    const userId = authService.getCurrentUserIdSync();
    const userEmail = authService.getCurrentUserEmailSync();


    if ( !tenantId || !userId ) {
        return next( req );
    }

    const cloned = req.clone( {
        setHeaders: {
            'X-Tenant-Id': tenantId,
            'X-User-Id': userId ?? '',
            'X-User-Email': userEmail ?? ''
        }
    } );

    return next( cloned );
};
