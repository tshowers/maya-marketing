import { environment } from '../../../../environments/environment';
import { ENDPOINTS } from '../../endpoints';

const MASTER_TENANT_ENDPOINTS = new Set<keyof typeof ENDPOINTS>( [
    'SECTORS',
    'CATEGORIES',
    'AUDITLOGS',
    'APP_ACTIVITY',
] );

export function resolveTenantIdForEndpoint (
    endpointKey: keyof typeof ENDPOINTS,
    getTenantId: () => string
): string | undefined {
    if ( !environment.multiTenant ) return undefined;

    if ( MASTER_TENANT_ENDPOINTS.has( endpointKey ) ) {
        return ( environment as any )?.taliferroTenantId as string | undefined;
    }

    try {
        return getTenantId();
    } catch {
        return ( environment as any )?.taliferroTenantId as string | undefined;
    }
}