import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { addDoc, collection, collectionData, CollectionReference, deleteDoc, doc, docData, DocumentData, DocumentReference, Firestore, getDoc, getDocs, limit, orderBy, Query, query, setDoc, startAfter, updateDoc, where } from '@angular/fire/firestore';
import { BehaviorSubject, catchError, from, map, Observable, of, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Communication, Contact, EmailAddress } from '../shared/data/interfaces/contact.model';
import { CacheService } from './cache.service';
import { ENDPOINTS } from './endpoints';
import { LoggerService } from './logger.service';
import { toContactTableRow } from './helpers/data/contact-mapper';
import { resolveTenantIdForEndpoint } from './helpers/data/tenant-resolver';

@Injectable( {
    providedIn: 'root'
} )
export class DataService {
    private readonly tenantStorageKey = 'todd_active_tenant_id';
    private readonly networkContactLimitMessage = "You've reached your contact limit. Add another 1,000-contact pack to continue.";
    private statusSubject = new BehaviorSubject<{ latest: string; log: string[]; }>( { latest: '', log: [] } );
    status$: Observable<{ latest: string; log: string[]; }> = this.statusSubject.asObservable();

    private lastVisible: DocumentData | null = null;

    private pageCursors: Record<string, DocumentData | null> = {};
    private events = new BehaviorSubject<any[]>( [] );
    events$ = this.events.asObservable();

    // CONTACTS table optimization
    // Goal: never load 10,000 contacts into memory for list view.
    // Use paged reads and map each contact to a lightweight row object.
    private contactsTableCursor: DocumentData | null = null;
    private appActivityEnrichmentPromise?: Promise<any>;

    private getCypressValue<T> ( key: string ): T | null {
        try {
            if ( typeof window === 'undefined' || !window.localStorage ) return null;
            const raw = window.localStorage.getItem( key );
            if ( !raw ) return null;
            return JSON.parse( raw ) as T;
        } catch {
            return null;
        }
    }

    private getCypressAuthOverride (): { uid: string; tenantId: string | null; email: string | null; } | null {
        if ( !this.isCypressRuntime() ) return null;

        const override = this.getCypressValue<{ uid?: string; tenantId?: string; email?: string; }>( '__cypressAuthOverride' );
        if ( !override || typeof override.uid !== 'string' || !override.uid.trim() ) {
            return null;
        }

        return {
            uid: override.uid.trim(),
            tenantId: typeof override.tenantId === 'string' && override.tenantId.trim()
                ? override.tenantId.trim()
                : override.uid.trim(),
            email: typeof override.email === 'string' && override.email.trim()
                ? override.email.trim().toLowerCase()
                : null
        };
    }

    private isCypressRuntime (): boolean {
        if ( typeof window === 'undefined' ) return false;

        try {
            if ( window.localStorage?.getItem( '__useRealFirebaseData' ) === 'true' ) {
                return false;
            }
            return !!( window as any ).Cypress || !!window.localStorage?.getItem( '__cypressAuthOverride' );
        } catch {
            return !!( window as any ).Cypress;
        }
    }

    private getCypressSayItProfiles (): any[] | null {
        if ( !this.isCypressRuntime() ) return null;
        const profiles = this.getCypressValue<any[]>( '__cypressSayItProfiles' );
        return Array.isArray( profiles ) ? profiles.map( profile => ( { ...profile } ) ) : null;
    }

    private getCypressSayItPosts (): any[] | null {
        if ( !this.isCypressRuntime() ) return null;
        const posts = this.getCypressValue<any[]>( '__cypressSayItPosts' );
        return Array.isArray( posts ) ? posts.map( post => ( { ...post } ) ) : null;
    }

    private getCypressContacts (): Contact[] | null {
        if ( !this.isCypressRuntime() ) return null;
        const contacts = this.getCypressValue<Contact[]>( '__cypressContacts' );
        return Array.isArray( contacts ) ? contacts.map( contact => ( { ...contact } ) ) : null;
    }

    private getCypressDropdownData ( endpointKey: keyof typeof ENDPOINTS ): any[] | null {
        if ( !this.isCypressRuntime() ) return null;
        const dropdowns = this.getCypressValue<Record<string, any[]>>( '__cypressDropdownData' );
        if ( !dropdowns || typeof dropdowns !== 'object' ) return null;
        const values = dropdowns[endpointKey] || dropdowns[ENDPOINTS[endpointKey]];
        return Array.isArray( values ) ? values.map( value => ( typeof value === 'string' ? { name: value } : { ...value } ) ) : null;
    }

    private setCypressContacts ( contacts: Contact[] ): void {
        if ( !this.isCypressRuntime() || typeof window === 'undefined' || !window.localStorage ) return;
        window.localStorage.setItem( '__cypressContacts', JSON.stringify( contacts ) );
    }

    private getCypressContactById ( id: string ): Contact | null {
        const contacts = this.getCypressContacts();
        if ( !contacts || !id ) return null;
        return contacts.find( contact => String( contact?.id || '' ).trim() === String( id ).trim() ) || null;
    }

    private getCypressContactByEmail ( email: string ): Contact | null {
        const contacts = this.getCypressContacts();
        const normalizedEmail = String( email || '' ).trim().toLowerCase();
        if ( !contacts || !normalizedEmail ) return null;
        return contacts.find( contact => {
            const primaryEmail = String( contact?.email || '' ).trim().toLowerCase();
            const emailAddresses = Array.isArray( contact?.emailAddresses ) ? contact.emailAddresses : [];
            return primaryEmail === normalizedEmail
                || emailAddresses.some( item => String( item?.emailAddress || '' ).trim().toLowerCase() === normalizedEmail );
        } ) || null;
    }

    private shouldFailCypressContactWrite ( operation: 'add' | 'update' ): boolean {
        if ( !this.isCypressRuntime() || typeof window === 'undefined' || !window.localStorage ) return false;
        const raw = String( window.localStorage.getItem( '__cypressContactWriteFailure' ) || '' ).trim().toLowerCase();
        return raw === operation || raw === 'all';
    }

    private getCypressResponseFlows (): any[] | null {
        if ( !this.isCypressRuntime() ) return null;
        const responseFlows = this.getCypressValue<any[]>( '__cypressResponseFlows' );
        return Array.isArray( responseFlows ) ? responseFlows.map( item => ( { ...item } ) ) : null;
    }

    private getCypressAffiliateState (): { profiles?: Record<string, any>; metrics?: Record<string, any>; paidCustomers?: Record<string, any[]>; } | null {
        if ( !this.isCypressRuntime() ) return null;
        const state = this.getCypressValue<any>( '__cypressAffiliateState' );
        return state && typeof state === 'object' ? { ...state } : null;
    }

    private getCypressAffiliateProfile ( affiliateUid: string ): any | null {
        const state = this.getCypressAffiliateState();
        if ( !state || !affiliateUid ) return null;
        return state.profiles?.[affiliateUid] ? { ...state.profiles[affiliateUid] } : null;
    }

    private getCypressAffiliateMetrics ( affiliateUid: string ): any | null {
        const state = this.getCypressAffiliateState();
        if ( !state || !affiliateUid ) return null;
        return state.metrics?.[affiliateUid] ? { ...state.metrics[affiliateUid] } : null;
    }

    private getCypressAffiliatePaidCustomers ( affiliateUid: string ): any[] | null {
        const state = this.getCypressAffiliateState();
        if ( !state || !affiliateUid ) return null;
        const records = state.paidCustomers?.[affiliateUid];
        return Array.isArray( records ) ? records.map( record => ( { ...record } ) ) : null;
    }

    private setCypressResponseFlows ( responseFlows: any[] ): void {
        if ( !this.isCypressRuntime() || typeof window === 'undefined' || !window.localStorage ) return;
        window.localStorage.setItem( '__cypressResponseFlows', JSON.stringify( responseFlows ) );
    }

    private getCypressResponseFlowById ( id: string ): any | null {
        const responseFlows = this.getCypressResponseFlows();
        if ( !responseFlows || !id ) return null;
        return responseFlows.find( item => String( item?.id || '' ).trim() === String( id ).trim() ) || null;
    }



    resetContactsTableCursor (): void { this.contactsTableCursor = null; }

    async fetchContactsTablePage ( user: string, opts?: { pageSize?: number; direction?: 'asc' | 'desc'; orderField?: string; } ): Promise<Partial<Contact>[]> {
        const tenantId = environment.multiTenant ? this.getTenantId() : undefined;
        const colRef = this.getCollectionReference( 'CONTACTS', tenantId );
        const pageSize = opts?.pageSize ?? 100;
        const orderField = opts?.orderField ?? 'lastUpdated';
        const direction = opts?.direction ?? 'desc';
        const q = this.contactsTableCursor
            ? query( colRef, orderBy( orderField, direction ), startAfter( this.contactsTableCursor ), limit( pageSize ) )
            : query( colRef, orderBy( orderField, direction ), limit( pageSize ) );
        const snaps = await this.runInContext( () => getDocs( q ) );
        this.contactsTableCursor = snaps.docs[snaps.docs.length - 1] ?? null;
        return snaps.docs.map( d => toContactTableRow( { id: d.id, ...d.data() } ) );
    }

    async getContactFullByIdOnce ( contactId: string, user: string ): Promise<Contact | null> {
        if ( !contactId ) return null;
        const cypressContact = this.getCypressContactById( contactId );
        if ( cypressContact ) return cypressContact;
        const tenantId = environment.multiTenant ? this.getTenantId() : undefined;
        const ref = this.getCollectionReference( 'CONTACTS', tenantId );
        try {
            const snap = await this.runInContext( () => getDoc( doc( ref, contactId ) ) );
            return snap.exists() ? { id: snap.id, ...( snap.data() as any ) } as Contact : null;
        } catch ( err ) {
            this.logger.error( `Error fetching contact`, err );
            return null;
        }
    }

    // Add near your other paging cursors:
    private profilePostCursors: Record<string, DocumentData | null> = {};

    constructor ( private firestore: Firestore, private logger: LoggerService, private auth: Auth, private injector: Injector, private cacheService: CacheService ) {
        this.clearStaleCypressOverrides();
    }

    private async enrichActivityMetadata ( metadata?: any ): Promise<any> {
        const baseMetadata = metadata && typeof metadata === 'object' ? { ...metadata } : {};
        const runtimeMetadata = this.getRuntimeActivityMetadata();
        const remoteMetadata = await this.getRemoteActivityMetadataIfNeeded( baseMetadata );

        return this.mergeActivityMetadata( runtimeMetadata, remoteMetadata, baseMetadata );
    }

    private mergeActivityMetadata ( ...sources: any[] ): any {
        const result: any = {};

        for ( const source of sources ) {
            if ( !source || typeof source !== 'object' ) continue;

            Object.entries( source ).forEach( ( [key, value] ) => {
                if ( value === undefined || value === null || value === '' ) return;

                if ( value && typeof value === 'object' && !Array.isArray( value ) ) {
                    result[key] = this.mergeActivityMetadata( result[key] || {}, value );
                    return;
                }

                result[key] = value;
            } );
        }

        return result;
    }

    private getRuntimeActivityMetadata (): any {
        const browserInfo = this.getBrowserInfo();
        const email = this.auth.currentUser?.email || 'Anonymous';
        const pageUrl = this.getCurrentPageUrl();
        const pageTitle = this.getCurrentPageTitle();
        const referrer = this.getReferrer();
        const hostname = this.getCurrentHostname();
        const sessionId = this.getOrCreateActivitySessionId();

        return {
            email,
            pageUrl,
            pageTitle,
            referrer,
            hostname,
            sessionId,
            browserInfo,
            timestamp: new Date().toISOString(),
            location: {
                country: '',
                city: '',
            },
        };
    }

    private getBrowserInfo (): any {
        if ( typeof navigator === 'undefined' ) {
            return {
                appName: '',
                appVersion: '',
                platform: '',
                userAgent: '',
            };
        }

        return {
            appName: navigator.appName || '',
            appVersion: navigator.appVersion || '',
            platform: navigator.platform || '',
            userAgent: navigator.userAgent || '',
        };
    }

    private getCurrentPageUrl (): string {
        try {
            return window.location?.href || '';
        } catch {
            return '';
        }
    }

    private getCurrentPageTitle (): string {
        try {
            return document?.title || '';
        } catch {
            return '';
        }
    }

    private getReferrer (): string {
        try {
            return document?.referrer || '';
        } catch {
            return '';
        }
    }

    private getCurrentHostname (): string {
        try {
            return window.location?.hostname || '';
        } catch {
            return '';
        }
    }

    private getOrCreateActivitySessionId (): string {
        const storageKey = 'todd_app_activity_session_id';

        try {
            const existing = window.sessionStorage?.getItem( storageKey );
            if ( existing ) return existing;

            const generated = `activity-${Date.now()}-${Math.random().toString( 36 ).slice( 2, 10 )}`;
            window.sessionStorage?.setItem( storageKey, generated );
            return generated;
        } catch {
            return `activity-${Date.now()}`;
        }
    }

    private async getRemoteActivityMetadataIfNeeded ( metadata?: any ): Promise<any> {
        const hasIpAddress = !!String( metadata?.ipAddress || '' ).trim();
        const hasLocation = !!String( metadata?.location?.city || '' ).trim() || !!String( metadata?.location?.country || '' ).trim();

        if ( hasIpAddress && hasLocation ) {
            return {};
        }

        if ( this.appActivityEnrichmentPromise ) {
            return this.appActivityEnrichmentPromise;
        }

        this.appActivityEnrichmentPromise = ( async () => {
            try {
                if ( typeof fetch !== 'function' ) return {};

                const [ipResponse, locationResponse] = await Promise.allSettled( [
                    fetch( 'https://api.ipify.org?format=json' ),
                    fetch( 'https://ipapi.co/json/' ),
                ] );

                const ipData = ipResponse.status === 'fulfilled'
                    ? await ipResponse.value.json().catch( () => ( {} ) )
                    : {};
                const locationData = locationResponse.status === 'fulfilled'
                    ? await locationResponse.value.json().catch( () => ( {} ) )
                    : {};

                return {
                    ipAddress: ipData?.ip || '',
                    location: {
                        country: locationData?.country_name || '',
                        city: locationData?.city || '',
                    },
                };
            } catch ( error ) {
                this.logger.warn( '[logActivity] Could not enrich IP/location metadata.', error );
                return {};
            }
        } )();

        return this.appActivityEnrichmentPromise;
    }

    private clearStaleCypressOverrides (): void {
        if ( this.isCypressRuntime() ) return;

        try {
            if ( typeof window === 'undefined' || !window.localStorage ) return;

            window.localStorage.removeItem( '__cypressSayItProfiles' );
            window.localStorage.removeItem( '__cypressSayItPosts' );
            window.localStorage.removeItem( '__cypressAuthOverride' );
            window.localStorage.removeItem( '__cypressAffiliateState' );
        } catch {
            // Ignore storage cleanup failures in normal runtime.
        }
    }

    getTenantId (): string {
        const cypressAuthOverride = this.getCypressAuthOverride();
        if ( cypressAuthOverride?.tenantId ) {
            return cypressAuthOverride.tenantId;
        }

        try {
            if ( typeof window !== 'undefined' && window.localStorage ) {
                const cachedTenantId = window.localStorage.getItem( this.tenantStorageKey );
                if ( cachedTenantId?.trim() ) {
                    return cachedTenantId.trim();
                }
            }
        } catch {
            // ignore localStorage failures and fall back to auth state
        }

        const user = this.auth.currentUser;
        if ( !user ) throw new Error( 'User not authenticated' );
        return user.uid;
    }

    private buildNetworkAuthHeaders ( tenantId: string ): HeadersInit {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'x-tenant-id': String( tenantId || '' ).trim()
        };
        const currentUser = this.auth.currentUser;
        const userId = String( currentUser?.uid || tenantId || '' ).trim();
        const userEmail = String( currentUser?.email || '' ).trim().toLowerCase();

        if ( userId ) {
            headers['x-user-id'] = userId;
        }

        if ( userEmail ) {
            headers['x-user-email'] = userEmail;
        }

        return headers;
    }

    private getBackendUrl (): string {
        try {
            if ( window.localStorage?.getItem( '__useBackendEmulator' ) === 'true' ) {
                return 'http://127.0.0.1:5001/taliferrotech/us-central1/api/api';
            }
        } catch { }

        return environment.backendURL;
    }

    private createContactLimitError (): Error {
        return new Error( this.networkContactLimitMessage );
    }

    private async fetchNetworkEntitlementState ( tenantId: string ): Promise<{ hasNetwork: boolean; baseLimit: number; extraPacks: number; effectiveLimit: number; currentCount: number; remaining: number; }> {
        const response = await fetch( `${this.getBackendUrl()}/network/entitlement`, {
            method: 'POST',
            headers: this.buildNetworkAuthHeaders( tenantId ),
            body: JSON.stringify( { tenantId } )
        } );

        const result = await response.json().catch( () => ( {} ) );

        if ( !response.ok || !result?.success ) {
            throw new Error( result?.message || 'Unable to load network entitlement.' );
        }

        return {
            hasNetwork: !!result?.hasNetwork,
            baseLimit: Number( result?.baseLimit ) || 1000,
            extraPacks: Number( result?.extraPacks ) || 0,
            effectiveLimit: Number( result?.effectiveLimit ) || 0,
            currentCount: Number( result?.currentCount ) || 0,
            remaining: Number( result?.remaining ) || 0,
        };
    }

    private async ensureContactCapacityForAdds ( additionalContacts: number ): Promise<void> {
        if ( additionalContacts <= 0 ) return;

        const tenantId = environment.multiTenant ? this.getTenantId() : undefined;
        if ( !tenantId ) return;

        const entitlement = await this.fetchNetworkEntitlementState( tenantId );
        const paidLimit = Math.max( 0, Number( entitlement?.effectiveLimit ) || 0 );
        const currentCount = Math.max( 0, Number( entitlement?.currentCount ) || 0 );
        const capacityLimit = entitlement?.hasNetwork ? paidLimit : 10;
        const remaining = Math.max( 0, capacityLimit - currentCount );

        if ( remaining < additionalContacts ) {
            throw this.createContactLimitError();
        }
    }

    private collectNormalizedEmails ( item: any ): string[] {
        const emailAddresses = Array.isArray( item?.emailAddresses ) ? item.emailAddresses : [];
        const candidates = [
            String( item?.email || '' ).trim().toLowerCase(),
            ...emailAddresses.map( ( address: any ) => String( address?.emailAddress || '' ).trim().toLowerCase() )
        ];

        return Array.from( new Set( candidates.filter( email => !!email ) ) );
    }

    private async estimateNewContactAdds ( items: any[], tenantId?: string ): Promise<number> {
        const reservedEmails = new Set<string>();
        let additions = 0;

        for ( const item of items || [] ) {
            const emails = this.collectNormalizedEmails( item );
            if ( emails.length === 0 ) continue;

            let exists = false;

            for ( const email of emails ) {
                if ( reservedEmails.has( email ) ) {
                    exists = true;
                    break;
                }

                const existingRef = await this.checkIfExists( email, tenantId );
                if ( existingRef ) {
                    exists = true;
                    break;
                }
            }

            if ( exists ) {
                continue;
            }

            additions++;
            emails.forEach( email => reservedEmails.add( email ) );
        }

        return additions;
    }

    private getCollectionReference ( endpointKey: keyof typeof ENDPOINTS, tenantId?: string ): CollectionReference<DocumentData> {
        const path = environment.multiTenant && tenantId
            ? `tenants/${tenantId}/${ENDPOINTS[endpointKey]}`
            : ENDPOINTS[endpointKey];
        let ref: CollectionReference<DocumentData>;
        runInInjectionContext( this.injector, () => { ref = collection( this.firestore, path ); } );
        return ref!;
    }

    getRealtimeData ( endpointKey: keyof typeof ENDPOINTS, user: string, limitValue?: number, startDate?: Date ): Observable<any[]> {
        if ( endpointKey === 'RESPONSE_FLOW' ) {
            const cypressResponseFlows = this.getCypressResponseFlows();
            if ( cypressResponseFlows ) {
                return of( cypressResponseFlows );
            }
        }

        const tenantId = environment.multiTenant ? this.getTenantId() : undefined;
        let ref: Query<DocumentData> = this.getCollectionReference( endpointKey, tenantId );
        if ( startDate ) ref = query( ref, where( 'lastUpdated', '>=', startDate.toISOString() ) );
        if ( limitValue ) ref = query( ref, limit( limitValue ) );
        this.logEvent( `${user} subscribed to ${ENDPOINTS[endpointKey]}`, user );
        return runInInjectionContext( this.injector, () =>
            collectionData( ref, { idField: 'id' } ).pipe(
                map( ( docs: any[] ) => docs.map( doc => ( { ...doc, id: doc.id } ) ) )
            )
        );
    }

    getCollectionData ( endpointKey: keyof typeof ENDPOINTS, user: string ): Promise<any[]> {
        if ( endpointKey === 'CONTACTS' ) {
            const cypressContacts = this.getCypressContacts();
            if ( cypressContacts ) {
                return Promise.resolve( cypressContacts );
            }
        }

        const tenantId = environment.multiTenant ? this.getTenantId() : undefined;
        const ref = this.getCollectionReference( endpointKey, tenantId );
        return this.cacheService.checkCacheOrReturnPromise<any>(
            ENDPOINTS[endpointKey], tenantId,
            () => {
                this.logger.info( `[READ] collection=${ref.path} user=${user}` );
                return new Promise( ( resolve, reject ) => {
                    runInInjectionContext( this.injector, async () => {
                        try {
                            const snapshot = await getDocs( ref );
                            this.logEvent( `${user} fetched from ${ref.path}`, user );
                            resolve( snapshot.docs.map( doc => ( { ...doc.data(), id: doc.id } ) ) );
                        } catch ( error ) {
                            this.logger.error( `[ERROR] collection=${ref.path}`, error );
                            reject( error );
                        }
                    } );
                } );
            }
        );
    }

    /**
     * Real-time stream of tasks scoped to a projectId.
     * Mirrors getRealtimeData style with multi-tenant awareness and logging.
     *
     * @param projectId - The project ID to filter tasks by.
     * @param user - Identifier for logging/audit.
     * @param opts - Optional filters: status, pageSize, startAfterDueDate.
     */
    getTasksByProject$ (
        projectId: string,
        user: string,
        opts?: { status?: string | null; pageSize?: number; startAfterDueDate?: any; }
    ): Observable<any[]> {
        const tenantId = environment.multiTenant ? this.getTenantId() : undefined;
        this.logger.info( `[getTasksByProject$] tenantId=${tenantId}, projectId=${projectId}, user=${user}` );
        let ref: Query<DocumentData> = this.getCollectionReference( 'TASKS', tenantId );

        const pageSize = opts?.pageSize ?? 200;

        // Build query similar to other methods
        if ( opts?.status ) {
            ref = query(
                ref,
                where( 'projectId', '==', projectId ),
                where( 'status', '==', opts.status ),
                limit( pageSize )
            );
        } else {
            ref = query(
                ref,
                where( 'projectId', '==', projectId ),
                limit( pageSize )
            );
        }

        if ( opts?.startAfterDueDate ) {
            ref = query( ref, startAfter( opts.startAfterDueDate ) );
        }

        // Log & stream
        this.logEvent( `${user} started a real-time task subscription for project ${projectId}`, user );
        this.logger.info( `[Firestore READ] tasks stream projectId=${projectId} user=${user}` );

        return runInInjectionContext( this.injector, () =>
            collectionData( ref, { idField: 'id' } ).pipe(
                map( ( docs: any[] ) => docs.map( doc => ( { ...doc, id: doc.id } ) ) )
            )
        );
    }

    /**
     * One-shot fetch of tasks for a projectId with caching, patterned after getCollectionData.
     *
     * @param projectId - The project to filter by.
     * @param user - Identifier for logging/audit.
     * @param opts - Optional filters: status, pageSize, startAfterDueDate.
     */
    getTasksByProjectOnce (
        projectId: string,
        user: string,
        opts?: { status?: string | null; pageSize?: number; startAfterDueDate?: any; }
    ): Promise<any[]> {
        const tenantId = environment.multiTenant ? this.getTenantId() : undefined;
        const pageSize = opts?.pageSize ?? 500;

        return this.cacheService.checkCacheOrReturnPromise<any>(
            'tasks_by_project',
            tenantId,
            () => {
                this.logger.info( `[Firestore READ] tasks one-shot projectId=${projectId} user=${user}` );
                return new Promise( ( resolve, reject ) => {
                    runInInjectionContext( this.injector, async () => {
                        try {
                            const ref = this.getCollectionReference( 'TASKS', tenantId );
                            let q: Query<DocumentData>;
                            if ( opts?.status ) {
                                q = query(
                                    ref,
                                    where( 'projectId', '==', projectId ),
                                    where( 'status', '==', opts.status ),
                                    orderBy( 'dueDate', 'asc' ),
                                    limit( pageSize )
                                );
                            } else {
                                q = query(
                                    ref,
                                    where( 'projectId', '==', projectId ),
                                    orderBy( 'dueDate', 'asc' ),
                                    limit( pageSize )
                                );
                            }
                            if ( opts?.startAfterDueDate ) {
                                q = query( q, startAfter( opts.startAfterDueDate ) );
                            }

                            const snapshot = await getDocs( q );
                            this.logger.info( `[Firestore READ] tasks fetched count=${snapshot.size} projectId=${projectId}` );
                            this.logEvent( `${user} fetched tasks for project ${projectId}`, user );
                            const data = snapshot.docs.map( doc => ( { ...doc.data(), id: doc.id } ) );
                            resolve( data );
                        } catch ( error ) {
                            this.logger.error( `[Firestore ERROR] tasks fetch projectId=${projectId} user=${user} error=${error}` );
                            this.logEvent( `${user} failed to fetch tasks for project ${projectId} due to ${error}`, user );
                            reject( error );
                        }
                    } );
                } );
            },
            // cache key filters
            `${projectId}_${opts?.status ?? ''}_${pageSize}_${opts?.startAfterDueDate ?? ''}`
        );
    }

    /**
     * Retrieves contacts associated with a specific project ID.
     * For table/list views, returns lightweight rows by default to reduce memory/DOM pressure.
     * Pass opts.fullRecord=true to return full Contact objects.
     * @param endpointKey - The key of the endpoint from the ENDPOINTS object to fetch contacts.
     * @param userId - The user ID to filter contacts based on user data.
     * @param projectId - The ID of the project to filter contacts by.
     * @param opts - Optional: { fullRecord?: boolean } (default is lightweight rows)
     * @returns A promise that resolves to an array of contacts (lightweight or full) linked to the given project ID.
     * @throws Will throw an error if the contacts can't be fetched.
     */
    async getContactsByProjectId (
        endpointKey: keyof typeof ENDPOINTS,
        userId: string,
        projectId: string,
        opts?: { fullRecord?: boolean; }
    ): Promise<any[]> {
        try {
            const contacts = ( await this.getCollectionData( endpointKey, userId ) ) as Contact[];
            const filtered = contacts.filter( contact =>
                contact.projects?.some( project => project.id === projectId )
            );

            // For table/list views, return lightweight rows to reduce memory/DOM pressure.
            if ( opts?.fullRecord ) {
                return filtered;
            }
            return filtered.map( c => toContactTableRow( c ) );
        } catch ( error ) {
            this.logger.error( `Failed to fetch contacts for project ID ${projectId}:`, error );
            throw error;
        }
    }

    getTopLevelData ( endpointKey: keyof typeof ENDPOINTS, user: string, useLastUpdated?: boolean ): Observable<any[]> {
        const tenantId = environment.multiTenant ? this.getTenantId() : undefined;
        const ref = this.getCollectionReference( endpointKey, tenantId );
        const limitedRef = useLastUpdated
            ? query( ref, limit( 300 ) )
            : query( ref, orderBy( 'timestamp', 'desc' ), limit( 300 ) );
        this.logEvent( `${user} started subscription to ${ENDPOINTS[endpointKey]}`, user );
        return runInInjectionContext( this.injector, () =>
            collectionData( limitedRef, { idField: 'id' } ).pipe(
                map( ( docs: any[] ) => docs.map( doc => ( { ...doc, id: doc.id } ) ) )
            )
        ) as Observable<any[]>;
    }

    getDocumentByField ( endpointKey: keyof typeof ENDPOINTS, field: string, value: any, user: string ): Observable<any | null> {
        let tenantId: string | undefined = undefined;
        if ( endpointKey === 'WAITLIST' ) {
            tenantId = environment.taliferroTenantId;
        } else if ( environment.multiTenant ) {
            try { tenantId = this.getTenantId(); } catch { }
        }
        const ref = this.getCollectionReference( endpointKey, tenantId );
        return from( this.runInContext( () => getDocs( query( ref, where( field as any, '==', value ), limit( 1 ) ) ) ) ).pipe(
            map( ( snap ) => !snap.empty ? { id: snap.docs[0].id, ...snap.docs[0].data() } : null ),
            catchError( ( err ) => { this.logger.error( 'getDocumentByField error:', err ); return of( null ); } )
        );
    }

    /**
     * Convenience: fetch a public profile contact by handle.
     * Assumes handle is stored lowercase; will try lowercase equality.
     */
    getContactByHandle ( handle: string, user: string ): Observable<Contact | null> {
        const normalized = ( handle || '' ).trim().toLowerCase();
        if ( !normalized ) return of( null );

        // Public profiles always live under the Taliferro master tenant.
        const masterTenantId: string | undefined = environment.taliferroTenantId;
        if ( !masterTenantId ) return of( null );

        const ref = this.getCollectionReference( 'CONTACTS', masterTenantId );
        const q = query( ref, where( 'handle', '==', normalized ), limit( 1 ) );

        return from( this.runInContext( () => getDocs( q ) ) ).pipe(
            map( ( snap ) => {
                if ( !snap.empty ) {
                    const d = snap.docs[0];
                    this.logger.info( `[Firestore READ] getContactByHandle tenants/${masterTenantId}/CONTACTS handle==${normalized} user=${user}` );
                    return { id: d.id, ...d.data() } as Contact;
                }
                return null;
            } ),
            catchError( ( err ) => {
                this.logger.error( 'getContactByHandle error:', err );
                return of( null );
            } )
        );
    }

    /**
     * Convenience: fetch a CONTACT by email (master tenant) for public/profile prefill flows.
     * Uses getDocumentByField which already forces CONTACTS to the Taliferro master tenant.
     */
    getContactByEmailForSayIt ( email: string, user: string ): Observable<Contact | null> {
        const normalized = ( email || '' ).trim().toLowerCase();
        if ( !normalized ) return of( null );

        // Public/profile prefill flows always read from master tenant.
        const masterTenantId: string | undefined = environment.taliferroTenantId;
        if ( !masterTenantId ) return of( null );

        const ref = this.getCollectionReference( 'CONTACTS', masterTenantId );
        const q = query( ref, where( 'email', '==', normalized ), limit( 1 ) );

        return from( this.runInContext( () => getDocs( q ) ) ).pipe(
            map( ( snap ) => {
                if ( !snap.empty ) {
                    const d = snap.docs[0];
                    this.logger.info( `[Firestore READ] getContactByEmailForSayIt tenants/${masterTenantId}/CONTACTS email==${normalized} user=${user}` );
                    return { id: d.id, ...d.data() } as Contact;
                }
                return null;
            } ),
            catchError( ( err ) => {
                this.logger.error( 'getContactByEmailForSayIt error:', err );
                return of( null );
            } )
        );
    }

    /**
     * Upsert a SayIt profile doc under the Taliferro master tenant.
     * Source of truth: /tenants/{environment.taliferroTenantId}/say-it-profiles/{uid}
     * NOTE: this is intentionally NOT scoped to the signed-in user's tenant.
     * This is intentionally stored under the Taliferro master tenant.
     */
    async upsertUserProfile ( uid: string, data: any, user: string ): Promise<void> {
        if ( !uid ) throw new Error( 'upsertUserProfile called with empty uid' );

        return this.runInContext( async () => {
            try {
                const masterTenantId = ( environment as any )?.taliferroTenantId as string | undefined;
                if ( !masterTenantId ) throw new Error( 'Missing environment.taliferroTenantId for SayIt profile upsert' );

                // Prefer ENDPOINTS.SAYIT_PROFILES when present; fallback to literal.
                const sayItEndpoint = ( ENDPOINTS as any )?.SAYIT_PROFILES || 'say-it-profiles';

                // SayIt profiles live under the master tenant.
                const path = `tenants/${masterTenantId}/${sayItEndpoint}/${uid}`;
                const docRef = doc( this.firestore, path );

                // Keep timestamp behavior aligned with the rest of the app.
                // bypass=true so we do NOT inject tenantId (the doc is already under the master tenant path).
                this.setRecordState( data, true );
                const cleaned = this.cleanObject( data );

                this.logger.info( `[Firestore WRITE] document=${docRef.path} user=${user} (say-it profile upsert)` );
                await setDoc( docRef, cleaned, { merge: true } as any );
            } catch ( err ) {
                this.logger.error( 'upsertUserProfile (say-it) error:', err );
                throw err;
            }
        } );
    }

    async getSayItProfileByUidOnce ( uid: string, user: string ): Promise<any | null> {
        const normalizedUid = ( uid || '' ).trim();
        if ( !normalizedUid ) return null;

        const cypressProfiles = this.getCypressSayItProfiles();
        if ( cypressProfiles ) {
            const match = cypressProfiles.find( profile => String( profile?.uid || profile?.id || '' ).trim() === normalizedUid );
            if ( match ) return { ...match };
        }

        return this.runInContext( async () => {
            try {
                const masterTenantId = ( environment as any )?.taliferroTenantId as string | undefined;
                if ( !masterTenantId ) return null;

                const sayItEndpoint = ( ENDPOINTS as any )?.SAYIT_PROFILES || 'say-it-profiles';
                const path = `tenants/${masterTenantId}/${sayItEndpoint}/${normalizedUid}`;
                const docRef = doc( this.firestore, path );

                this.logger.info( `[Firestore READ] document=${docRef.path} user=${user} (say-it profile by uid)` );
                const snap = await getDoc( docRef );
                if ( snap.exists() ) {
                    return { id: snap.id, ...snap.data() };
                }

                const colRef = collection( this.firestore, `tenants/${masterTenantId}/${sayItEndpoint}` );
                const uidQuery = query( colRef, where( 'uid', '==', normalizedUid ), limit( 1 ) );
                const uidSnap = await getDocs( uidQuery );
                if ( uidSnap.empty ) return null;

                const d = uidSnap.docs[0];
                return { id: d.id, ...d.data() };
            } catch ( err ) {
                this.logger.error( 'getSayItProfileByUidOnce error:', err );
                return null;
            }
        } );
    }

    async getSayItProfileByClaimEmailOnce ( email: string, user: string ): Promise<any | null> {
        const normalizedEmail = ( email || '' ).trim().toLowerCase();
        if ( !normalizedEmail ) return null;

        const cypressProfiles = this.getCypressSayItProfiles();
        if ( cypressProfiles ) {
            const match = cypressProfiles.find( profile => String( profile?.claimEmail || profile?.email || '' ).trim().toLowerCase() === normalizedEmail );
            return match ? { ...match } : null;
        }

        return this.runInContext( async () => {
            try {
                const masterTenantId = ( environment as any )?.taliferroTenantId as string | undefined;
                if ( !masterTenantId ) return null;

                const sayItEndpoint = ( ENDPOINTS as any )?.SAYIT_PROFILES || 'say-it-profiles';
                const colRef = collection( this.firestore, `tenants/${masterTenantId}/${sayItEndpoint}` );
                const q = query( colRef, where( 'claimEmail', '==', normalizedEmail ), limit( 1 ) );
                const snap = await getDocs( q );
                if ( snap.empty ) return null;

                const d = snap.docs[0];
                this.logger.info( `[Firestore READ] collection=${colRef.path} claimEmail=${normalizedEmail} user=${user} (say-it profile by claimEmail)` );
                return { id: d.id, ...d.data() };
            } catch ( err ) {
                this.logger.error( 'getSayItProfileByClaimEmailOnce error:', err );
                return null;
            }
        } );
    }

    async getSayItProfileByHandleOnce ( handle: string, user: string ): Promise<any | null> {
        const normalizedHandle = ( handle || '' ).trim().toLowerCase();
        if ( !normalizedHandle ) return null;

        const cypressProfiles = this.getCypressSayItProfiles();
        if ( cypressProfiles ) {
            const match = cypressProfiles.find( profile => String( profile?.handle || '' ).trim().toLowerCase() === normalizedHandle );
            if ( match ) return { ...match };
        }

        return this.runInContext( async () => {
            try {
                const masterTenantId = ( environment as any )?.taliferroTenantId as string | undefined;
                if ( !masterTenantId ) return null;

                const sayItEndpoint = ( ENDPOINTS as any )?.SAYIT_PROFILES || 'say-it-profiles';
                const colRef = collection( this.firestore, `tenants/${masterTenantId}/${sayItEndpoint}` );
                const q = query(
                    colRef,
                    where( 'handle', '==', normalizedHandle ),
                    where( 'publicProfile', '==', true ),
                    limit( 1 )
                );

                this.logger.info( `[Firestore READ] collection=${colRef.path} handle=${normalizedHandle} user=${user} (say-it profile by handle)` );
                const snap = await getDocs( q );
                if ( snap.empty ) return null;

                const d = snap.docs[0];
                return { id: d.id, ...d.data() };
            } catch ( err ) {
                this.logger.error( 'getSayItProfileByHandleOnce error:', err );
                return null;
            }
        } );
    }

    async getPublicSayItProfilesOnce ( user: string, opts?: { limit?: number; } ): Promise<any[]> {
        const cypressProfiles = this.getCypressSayItProfiles();
        if ( cypressProfiles ) {
            const lim = Math.max( 1, Math.min( opts?.limit ?? 60, 200 ) );
            const docs = cypressProfiles
                .filter( ( profile: any ) => profile?.publicProfile !== false )
                .filter( ( profile: any ) => {
                    const label = (
                        profile?.businessName ||
                        profile?.displayName ||
                        profile?.companyName ||
                        ''
                    ).toString().trim();
                    return !!label;
                } )
                .sort( ( a: any, b: any ) => this.extractComparableDate( b?.lastUpdated || b?.createdAt ) - this.extractComparableDate( a?.lastUpdated || a?.createdAt ) )
                .slice( 0, lim )
                .map( profile => ( { ...profile } ) );

            this.logger.info( '[SayIt Directory] Cypress profile source', {
                user,
                requestedLimit: opts?.limit ?? 60,
                returnedCount: docs.length,
                sampleIds: docs.slice( 0, 5 ).map( ( profile: any ) => String( profile?.id || profile?.uid || '' ) ),
            } );

            return docs;
        }

        return this.runInContext( async () => {
            try {
                const masterTenantId = ( environment as any )?.taliferroTenantId as string | undefined;
                if ( !masterTenantId ) return [];

                const sayItEndpoint = ( ENDPOINTS as any )?.SAYIT_PROFILES || 'say-it-profiles';
                const colRef = collection( this.firestore, `tenants/${masterTenantId}/${sayItEndpoint}` );
                const lim = Math.max( 1, Math.min( opts?.limit ?? 60, 200 ) );
                const seededConfigRef = doc( this.firestore, `tenants/${masterTenantId}/sayit-config/seeded-directory` );
                const seededConfigSnap = await getDoc( seededConfigRef );
                const seededDirectoryEnabled = seededConfigSnap.exists() ? seededConfigSnap.data()?.['enabled'] !== false : true;
                const snap = await getDocs( query(
                    colRef,
                    where( 'publicProfile', '==', true ),
                    limit( lim )
                ) );
                const rawDocs = snap.docs.map( d => ( { id: d.id, ...d.data() } ) );

                const docs = rawDocs
                    .filter( ( profile: any ) => {
                        const isSeeded = String( profile?.profileSource || '' ).trim() === 'lead_vault_seed';
                        if ( !isSeeded ) return true;
                        if ( !seededDirectoryEnabled ) return false;

                        const seedStatus = String( profile?.seedStatus || '' ).trim().toLowerCase();
                        const directoryVisibility = String( profile?.directoryVisibility || '' ).trim().toLowerCase();
                        return ( seedStatus === 'unclaimed' || seedStatus === 'invited' || directoryVisibility === 'member_profile' )
                            && directoryVisibility !== 'suppressed';
                    } )
                    .filter( ( profile: any ) => {
                        const label = (
                            profile?.businessName ||
                            profile?.displayName ||
                            profile?.companyName ||
                            ''
                        ).toString().trim();
                        return !!label;
                    } )
                    .sort( ( a: any, b: any ) => this.extractComparableDate( b?.lastUpdated || b?.createdAt ) - this.extractComparableDate( a?.lastUpdated || a?.createdAt ) );

                this.logger.info( `[Firestore READ] collection=${colRef.path} user=${user} (public SayIt profiles)` );
                this.logger.info( '[SayIt Directory] Firestore profile source', {
                    user,
                    collection: colRef.path,
                    requestedLimit: lim,
                    seededDirectoryEnabled,
                    rawCount: rawDocs.length,
                    returnedCount: docs.length,
                    filteredOutCount: rawDocs.length - docs.length,
                    sampleIds: docs.slice( 0, 5 ).map( ( profile: any ) => String( profile?.id || profile?.uid || '' ) ),
                    sampleLabels: docs.slice( 0, 5 ).map( ( profile: any ) =>
                        String( profile?.businessName || profile?.displayName || profile?.companyName || '' )
                    ),
                } );
                return docs;
            } catch ( err ) {
                this.logger.error( 'getPublicSayItProfilesOnce error:', err );
                return [];
            }
        } );
    }

    async toggleSayItBusinessWatch ( currentUid: string, targetProfileId: string, user: string ): Promise<{ watching: boolean; watchlistProfileIds: string[]; watcherCount: number; }> {
        const normalizedCurrentUid = ( currentUid || '' ).trim();
        const normalizedTargetId = ( targetProfileId || '' ).trim();
        if ( !normalizedCurrentUid ) throw new Error( 'Missing current uid.' );
        if ( !normalizedTargetId ) throw new Error( 'Missing target profile id.' );

        const cypressProfiles = this.getCypressSayItProfiles();
        if ( cypressProfiles ) {
            const nextProfiles = cypressProfiles.map( profile => ( { ...profile } ) );
            const currentProfile = nextProfiles.find( profile => String( profile?.uid || profile?.id || '' ).trim() === normalizedCurrentUid );
            const targetProfile = nextProfiles.find( profile => String( profile?.uid || profile?.id || '' ).trim() === normalizedTargetId );

            if ( !targetProfile ) throw new Error( 'Missing target profile in Cypress override.' );

            const existingWatchlist = Array.isArray( currentProfile?.watchlistProfileIds )
                ? currentProfile.watchlistProfileIds.map( ( id: any ) => String( id || '' ).trim() ).filter( Boolean )
                : [];

            const isWatching = existingWatchlist.includes( normalizedTargetId );
            const nextWatchlist = isWatching
                ? existingWatchlist.filter( ( id: string ) => id !== normalizedTargetId )
                : [...existingWatchlist, normalizedTargetId];

            if ( currentProfile ) {
                currentProfile.watchlistProfileIds = nextWatchlist;
                currentProfile.watchlistCount = nextWatchlist.length;
            }

            const currentWatcherCount = Number( targetProfile?.watcherCount || 0 );
            const nextWatcherCount = Math.max( 0, currentWatcherCount + ( isWatching ? -1 : 1 ) );
            targetProfile.watcherCount = nextWatcherCount;
            targetProfile.lastUpdated = new Date().toISOString();

            try {
                window.localStorage.setItem( '__cypressSayItProfiles', JSON.stringify( nextProfiles ) );
            } catch {
                // ignore storage failures in non-browser contexts
            }

            return {
                watching: !isWatching,
                watchlistProfileIds: nextWatchlist,
                watcherCount: nextWatcherCount,
            };
        }

        return this.runInContext( async () => {
            const masterTenantId = ( environment as any )?.taliferroTenantId as string | undefined;
            if ( !masterTenantId ) throw new Error( 'Missing environment.taliferroTenantId.' );

            const sayItEndpoint = ( ENDPOINTS as any )?.SAYIT_PROFILES || 'say-it-profiles';
            const currentRef = doc( this.firestore, `tenants/${masterTenantId}/${sayItEndpoint}/${normalizedCurrentUid}` );
            const targetRef = doc( this.firestore, `tenants/${masterTenantId}/${sayItEndpoint}/${normalizedTargetId}` );

            const [currentSnap, targetSnap] = await Promise.all( [getDoc( currentRef ), getDoc( targetRef )] );

            const currentData = currentSnap.exists() ? ( currentSnap.data() as any ) : {};
            const targetData = targetSnap.exists() ? ( targetSnap.data() as any ) : {};

            const existingWatchlist = Array.isArray( currentData?.watchlistProfileIds )
                ? currentData.watchlistProfileIds.map( ( id: any ) => String( id || '' ).trim() ).filter( Boolean )
                : [];

            const isWatching = existingWatchlist.includes( normalizedTargetId );
            const nextWatchlist = isWatching
                ? existingWatchlist.filter( ( id: string ) => id !== normalizedTargetId )
                : [...existingWatchlist, normalizedTargetId];

            const currentWatcherCount = Number( targetData?.watcherCount || 0 );
            const nextWatcherCount = Math.max( 0, currentWatcherCount + ( isWatching ? -1 : 1 ) );

            await setDoc( currentRef, {
                uid: normalizedCurrentUid,
                watchlistProfileIds: nextWatchlist,
                watchlistCount: nextWatchlist.length,
                lastUpdated: new Date(),
            }, { merge: true } as any );

            try {
                await setDoc( targetRef, {
                    watcherCount: nextWatcherCount,
                    lastUpdated: new Date(),
                }, { merge: true } as any );
            } catch ( watcherWriteError ) {
                this.logger.warn( 'toggleSayItBusinessWatch watcher count update skipped', {
                    currentUid: normalizedCurrentUid,
                    targetProfileId: normalizedTargetId,
                    message: ( watcherWriteError as any )?.message || watcherWriteError,
                } );
            }

            this.logger.info( `[Firestore WRITE] toggleSayItBusinessWatch current=${normalizedCurrentUid} target=${normalizedTargetId} user=${user}` );
            return {
                watching: !isWatching,
                watchlistProfileIds: nextWatchlist,
                watcherCount: nextWatcherCount,
            };
        } );
    }

    async getProjectByName ( name: string, user: string ): Promise<any | null> {
        if ( !name?.trim() ) return null;
        const tenantId = environment.multiTenant ? this.getTenantId() : undefined;
        const ref = this.getCollectionReference( 'PROJECTS', tenantId );
        const trimmed = name.trim();
        return this.runInContext( async () => {
            try {
                let q = query( ref, where( 'nameLower', '==', trimmed.toLowerCase() ), limit( 1 ) );
                let snap = await getDocs( q );
                if ( snap.empty ) {
                    q = query( ref, where( 'name', '==', trimmed ), limit( 1 ) );
                    snap = await getDocs( q );
                }
                return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
            } catch ( error ) {
                this.logger.error( 'Error getting project:', error );
                return null;
            }
        } );
    }

    private extractComparableDate ( raw: any ): number {
        try {
            const date = raw?.toDate ? raw.toDate() : new Date( raw );
            const millis = date?.getTime?.() ?? 0;
            return Number.isFinite( millis ) ? millis : 0;
        } catch {
            return 0;
        }
    }

    private hasAffiliateMetricCounts ( metrics: any ): boolean {
        if ( !metrics || typeof metrics !== 'object' ) return false;

        const countFields = [
            'totalClicks',
            'uniqueClicks',
            'signups',
            'totalConversions',
            'paidConversions',
            'paidRevenueCents',
            'compensationTrackedCents',
            'accountCreditCents',
        ];

        return countFields.some( field => {
            const value = Number( metrics?.[field] ?? 0 );
            return Number.isFinite( value ) && value > 0;
        } );
    }

    private deriveAffiliateMetricsFromEvents ( events: any[] ): any | null {
        if ( !Array.isArray( events ) || events.length === 0 ) return null;

        const uniqueSessions = new Set<string>();
        let totalClicks = 0;
        let signups = 0;
        let totalConversions = 0;
        let lastClickAt: any = null;
        let lastConversionAt: any = null;
        let updatedAt: any = null;

        for ( const event of events ) {
            const type = String( event?.type || '' ).trim().toLowerCase();
            const createdAt = event?.createdAt ?? null;
            const createdAtMs = this.extractComparableDate( createdAt );
            const sessionId = String( event?.sessionId || '' ).trim();

            if ( createdAtMs > this.extractComparableDate( updatedAt ) ) {
                updatedAt = createdAt;
            }

            if ( type === 'click' ) {
                totalClicks++;
                if ( sessionId ) {
                    uniqueSessions.add( sessionId );
                }
                if ( createdAtMs > this.extractComparableDate( lastClickAt ) ) {
                    lastClickAt = createdAt;
                }
            }

            if ( type === 'signup' ) {
                signups++;
                totalConversions++;
                if ( createdAtMs > this.extractComparableDate( lastConversionAt ) ) {
                    lastConversionAt = createdAt;
                }
            }
        }

        return {
            totalClicks,
            uniqueClicks: uniqueSessions.size,
            signups,
            totalConversions,
            lastClickAt,
            lastConversionAt,
            updatedAt,
        };
    }

    getDocByPath$ ( path: string, user: string ): Observable<any | null> {
        if ( !path?.trim() ) return of( null );
        try {
            const docRef = doc( this.firestore, path );
            return docData( docRef, { idField: 'id' } ).pipe(
                map( ( d: any ) => d ? { ...d } : null ),
                catchError( err => { this.logger.warn( `docByPath failed:`, err ); return of( null ); } )
            );
        } catch ( err ) {
            return of( null );
        }
    }

    getAffiliateProfile$ ( affiliateUid: string, user: string ): Observable<any | null> {
        const uid = ( affiliateUid || '' ).trim();
        const master = ( environment as any )?.taliferroTenantId as string | undefined;
        const cypressProfile = this.getCypressAffiliateProfile( uid );
        if ( cypressProfile ) return of( cypressProfile );
        return ( uid && master ) ? this.getDocByPath$( `tenants/${master}/${ENDPOINTS.AFFILIATES}/${uid}`, user ) : of( null );
    }

    getAffiliateMetrics$ ( affiliateUid: string, user: string ): Observable<any | null> {
        const uid = ( affiliateUid || '' ).trim();
        const master = ( environment as any )?.taliferroTenantId as string | undefined;
        const cypressMetrics = this.getCypressAffiliateMetrics( uid );
        if ( cypressMetrics ) return of( cypressMetrics );
        return ( uid && master ) ? this.getDocByPath$( `tenants/${master}/${ENDPOINTS.AFFILIATES}/${uid}/metrics/current`, user ) : of( null );
    }

    getAffiliatePaidCustomers$ ( affiliateUid: string, user: string, options?: { limit?: number; } ): Observable<any[]> {
        const uid = ( affiliateUid || '' ).trim();
        const cypressRecords = this.getCypressAffiliatePaidCustomers( uid );
        if ( cypressRecords ) {
            const max = Math.max( 1, Math.min( options?.limit ?? 25, 100 ) );
            return of( cypressRecords.slice( 0, max ) );
        }

        const master = ( environment as any )?.taliferroTenantId as string | undefined;
        if ( !uid || !master ) return of( [] );

        try {
            const paidCustomersRef = collection( this.firestore, `tenants/${master}/${ENDPOINTS.AFFILIATES}/${uid}/paidCustomers` );
            const paidCustomersQuery = query( paidCustomersRef, orderBy( 'updatedAt', 'desc' ), limit( Math.max( 1, Math.min( options?.limit ?? 25, 100 ) ) ) );
            return collectionData( paidCustomersQuery, { idField: 'id' } ).pipe(
                map( ( records: any[] ) => Array.isArray( records ) ? records.map( record => ( { ...record } ) ) : [] ),
                catchError( err => {
                    this.logger.warn( 'affiliate paid customers read failed', err );
                    return of( [] );
                } )
            );
        } catch {
            return of( [] );
        }
    }

    async getAllAffiliateStatsOnce ( user: string, opts?: { limit?: number; } ): Promise<any[]> {
        const cypressState = this.getCypressAffiliateState();
        if ( cypressState ) {
            const profileEntries = Object.entries( cypressState.profiles || {} );
            return profileEntries.map( ( [uid, profile] ) => ( {
                affiliateUid: uid,
                ...( profile || {} ),
                metrics: cypressState.metrics?.[uid] || null,
                paidCustomersPreview: Array.isArray( cypressState.paidCustomers?.[uid] ) ? cypressState.paidCustomers?.[uid].slice( 0, 3 ) : []
            } ) );
        }

        const master = ( environment as any )?.taliferroTenantId as string | undefined;
        if ( !master ) return [];
        const lim = Math.max( 1, Math.min( opts?.limit ?? 200, 2000 ) );
        const affiliatesRef = this.getCollectionReference( 'AFFILIATES', master );
        try {
            const snap = await this.runInContext( () => getDocs( query( affiliatesRef, limit( lim ) ) ) );
            const results = await Promise.all(
                snap.docs.map( async ( d: any ) => {
                    const uid = ( d?.affiliateUid || d?.id || '' ).toString().trim();
                    if ( !uid ) return null;

                    let metrics: any = null;
                    let paidCustomersPreview: any[] = [];

                    try {
                        const metricsRef = doc( this.firestore, `tenants/${master}/${ENDPOINTS.AFFILIATES}/${uid}/metrics/current` );
                        const metricsSnap = await this.runInContext( () => getDoc( metricsRef ) );
                        metrics = metricsSnap.exists() ? metricsSnap.data() : null;

                        if ( !this.hasAffiliateMetricCounts( metrics ) ) {
                            const eventsRef = collection( this.firestore, `tenants/${master}/${ENDPOINTS.AFFILIATES}/${uid}/events` );
                            const eventsSnap = await this.runInContext( () => getDocs( eventsRef ) );
                            const derivedMetrics = this.deriveAffiliateMetricsFromEvents(
                                eventsSnap.docs.map( eventDoc => eventDoc.data() )
                            );

                            if ( derivedMetrics ) {
                                metrics = {
                                    ...( metrics || {} ),
                                    ...derivedMetrics,
                                };
                            }
                        }
                    } catch ( err ) {
                        this.logger.warn( 'affiliate metrics aggregation failed', { uid, err } );
                    }

                    try {
                        const paidCustomersRef = collection( this.firestore, `tenants/${master}/${ENDPOINTS.AFFILIATES}/${uid}/paidCustomers` );
                        const paidCustomersSnap = await this.runInContext( () => getDocs( query( paidCustomersRef, orderBy( 'updatedAt', 'desc' ), limit( 3 ) ) ) );
                        paidCustomersPreview = paidCustomersSnap.docs.map( paidDoc => ( { id: paidDoc.id, ...paidDoc.data() } ) );
                    } catch ( err ) {
                        this.logger.warn( 'affiliate paid customers preview failed', { uid, err } );
                    }

                    return { affiliateUid: uid, ...d.data(), metrics, paidCustomersPreview };
                } )
            );
            return results.filter( Boolean ) as any[];
        } catch ( err ) {
            this.logger.error( 'getAllAffiliateStats failed', err );
            return [];
        }
    }

    async getProjectIdByName ( name: string, user: string ): Promise<string | undefined> {
        const proj = await this.getProjectByName( name, user );
        return proj?.id as string | undefined;
    }

    addDocument ( endpointKey: keyof typeof ENDPOINTS, data: any, user: string ) {
        if ( endpointKey === 'CONTACTS' ) {
            if ( this.shouldFailCypressContactWrite( 'add' ) ) {
                return Promise.reject( new Error( 'Cypress contact create failure' ) );
            }

            const cypressContacts = this.getCypressContacts();
            if ( cypressContacts ) {
                const nextId = String( data?.id || `cypress-contact-${Date.now()}` );
                const nextRecord = this.cleanObject( { ...data, id: nextId } );
                this.setRecordState( nextRecord );
                this.setCypressContacts( [...cypressContacts, nextRecord] as Contact[] );
                return Promise.resolve( nextId );
            }
        }

        const tenantId = environment.multiTenant ? this.getTenantId() : undefined;
        this.setRecordState( data );
        const ref = this.getCollectionReference( endpointKey, tenantId );
        const cleanedData = this.cleanObject( data );
        const addPromise = async () => {
            if ( endpointKey === 'CONTACTS' ) {
                await this.ensureContactCapacityForAdds( 1 );
            }

            const docRef = await this.runInContext( () => addDoc( ref, cleanedData ) );
            this.logEvent( `${user} added document ${docRef.id}`, user );
            await this.updateDocument( endpointKey, docRef.id, { ...data, id: docRef.id }, user );
            return docRef.id;
        };
        return addPromise().then( docId => {
            return docId;
        } ).catch( error => {
            this.logger.error( "Error adding document:", error );
            this.logEvent( `${user} failed to add document`, user );
            throw error;
        } );
    }

    /**
     * Adds a public waitlist signup. Unlike addDocument(), this always writes under the
     * master Taliferro tenant and never calls getTenantId(), so it works for anonymous
     * visitors — firestore.rules leaves tenants/{tenantId}/waitlist open to anyone.
     */
    addWaitlistEntry ( data: Partial<Contact> & { email: string; } ): Promise<string> {
        const ref = this.getCollectionReference( 'WAITLIST', environment.taliferroTenantId );
        const cleanedData = this.cleanObject( {
            ...data,
            category: data.category || 'waitlist',
            createdAt: new Date().toISOString(),
        } );
        return this.runInContext( () => addDoc( ref, cleanedData ) ).then( docRef => docRef.id );
    }

    updateDocument ( endpointKey: keyof typeof ENDPOINTS, id: string, data: any, user: string ) {
        if ( endpointKey === 'CONTACTS' ) {
            if ( this.shouldFailCypressContactWrite( 'update' ) ) {
                return Promise.reject( new Error( 'Cypress contact update failure' ) );
            }

            const cypressContacts = this.getCypressContacts();
            if ( cypressContacts ) {
                const nextRecord = this.cleanObject( { ...data, id } );
                this.setRecordState( nextRecord );
                const updated = cypressContacts.map( contact =>
                    String( contact?.id || '' ) === String( id )
                        ? { ...contact, ...nextRecord }
                        : contact
                );
                this.setCypressContacts( updated as Contact[] );
                return Promise.resolve( { success: true, id } );
            }
        }

        this.setRecordState( data );
        const tenantId = environment.multiTenant ? this.getTenantId() : undefined;
        const docRef = doc( this.getCollectionReference( endpointKey, tenantId ), id );
        const cleanedData = this.cleanObject( data );
        return this.runInContext( () => updateDoc( docRef, cleanedData ) ).then( () => {
            this.logEvent( `${user} updated document ${id}`, user );
            return { success: true, id };
        } ).catch( error => {
            this.logger.error( "Error updating document:", error );
            this.logEvent( `${user} failed to update document`, user );
            throw error;
        } );
    }

    setDocument ( endpointKey: keyof typeof ENDPOINTS, id: string, data: any, _user: string ) {
        if ( endpointKey === 'CONTACTS' ) {
            const cypressContacts = this.getCypressContacts();
            if ( cypressContacts ) {
                const nextRecord = this.cleanObject( { ...data, id } );
                this.setRecordState( nextRecord );
                const existingIndex = cypressContacts.findIndex( contact => String( contact?.id || '' ) === String( id ) );
                if ( existingIndex >= 0 ) {
                    cypressContacts[existingIndex] = { ...cypressContacts[existingIndex], ...nextRecord };
                    this.setCypressContacts( cypressContacts as Contact[] );
                } else {
                    this.setCypressContacts( [...cypressContacts, nextRecord] as Contact[] );
                }
                return Promise.resolve( { success: true, id } );
            }
        }

        this.setRecordState( data );
        const tenantId = environment.multiTenant ? this.getTenantId() : undefined;
        const docRef = doc( this.getCollectionReference( endpointKey, tenantId ), id );
        return this.runInContext( () => setDoc( docRef, data ) ).then( () => ( { success: true, id } ) ).catch( error => {
            this.logger.error( "Error setting document:", error );
            throw error;
        } );
    }

    deleteDocument ( endpointKey: keyof typeof ENDPOINTS, id: string, user: string ) {
        if ( endpointKey === 'CONTACTS' ) {
            const cypressContacts = this.getCypressContacts();
            if ( cypressContacts ) {
                this.setCypressContacts( cypressContacts.filter( contact => String( contact?.id || '' ) !== String( id ) ) as Contact[] );
                return Promise.resolve( { success: true, id } );
            }
        }

        if ( endpointKey === 'RESPONSE_FLOW' ) {
            const cypressResponseFlows = this.getCypressResponseFlows();
            if ( cypressResponseFlows ) {
                this.setCypressResponseFlows( cypressResponseFlows.filter( item => String( item?.id || '' ) !== String( id ) ) );
                return Promise.resolve( { success: true, id } );
            }
        }

        const tenantId = environment.multiTenant ? this.getTenantId() : undefined;
        const collectionRef = this.getCollectionReference( endpointKey, tenantId );
        const docRef = doc( collectionRef, id );
        return this.runInContext( () => deleteDoc( docRef ) ).then( () => {
            this.logEvent( `${user} deleted document ${id}`, user );
            this.cacheService.removeItem<any>( ENDPOINTS[endpointKey], tenantId, item => item.id === id );
            return { success: true, id };
        } ).catch( error => {
            this.logger.error( `Error deleting document: ${id}`, error );
            this.logEvent( `${user} failed to delete document in ${collectionRef.path}`, user );
            throw error;
        } );
    }

    deleteContactByEmail ( email: string, user: string ): Observable<string> {
        const tenantId = environment.multiTenant ? this.getTenantId() : undefined;
        const ref = this.getCollectionReference( 'CONTACTS', tenantId );
        return from( this.runInContext( () => getDocs( query( ref, where( 'email', '==', email ) ) ) ) ).pipe(
            switchMap( snapshot => {
                if ( !snapshot.empty ) {
                    const docRef = doc( this.firestore, snapshot.docs[0].ref.path );
                    return from( runInInjectionContext( this.injector, () => deleteDoc( docRef ) ) ).pipe(
                        map( () => `Contact ${email} deleted` ),
                        catchError( error => of( `Error deleting: ${error.message}` ) )
                    );
                }
                return of( `No contact found: ${email}` );
            } ),
            catchError( error => of( `Error: ${error.message}` ) )
        );
    }

    private static isPermissionDenied ( error: unknown ): boolean {
        const code = String( ( error as any )?.code || '' );
        const msg = String( ( error as any )?.message || '' );
        return code.includes( 'permission-denied' ) || msg.includes( 'Missing or insufficient permissions' );
    }

    addKnownTenantDocument ( endpointKey: keyof typeof ENDPOINTS, data: any, user: string, tenantID: string ) {
        this.setRecordState( data, true );
        const ref = runInInjectionContext( this.injector, () =>
            collection( this.firestore, `tenants/${tenantID}/${ENDPOINTS[endpointKey]}` )
        );
        const cleanedData = this.cleanObject( data );
        return this.runInContext( () => addDoc( ref, cleanedData ) )
            .then( docRef => {
                const updatedData = { ...data, id: docRef.id };
                return this.updateKnowTenantDocument( endpointKey, docRef.id, updatedData, user, tenantID )
                    .then( () => docRef.id );
            } )
            .catch( error => {
                if ( DataService.isPermissionDenied( error ) ) return null;
                this.logger.error( "Error adding document:", error );
                throw error;
            } );
    }

    private updateKnowTenantDocument ( endpointKey: keyof typeof ENDPOINTS, id: string, data: any, _user: string, tenantId: string ) {
        const docRef = runInInjectionContext( this.injector, () =>
            doc( this.firestore, `tenants/${tenantId}/${ENDPOINTS[endpointKey]}`, id )
        );
        const cleanedData = this.cleanObject( data );
        return this.runInContext( () => updateDoc( docRef, cleanedData ) ).then( () => {
            return { success: true, id: id };
        } ).catch( error => { this.logger.error( "Error updating:", error ); throw error; } );
    }

    getDropdownData ( endpointKey: keyof typeof ENDPOINTS, user: string ): Observable<any[]> {
        const cypressDropdownData = this.getCypressDropdownData( endpointKey );
        if ( cypressDropdownData ) {
            return of( cypressDropdownData );
        }

        const tenantId = resolveTenantIdForEndpoint( endpointKey, () => this.getTenantId() );
        const ref = this.getCollectionReference( endpointKey, tenantId );
        return this.cacheService.checkCacheOrReturn<any[]>( ENDPOINTS[endpointKey], tenantId,
            () => {
                this.logEvent( `${user} opened dropdown for ${ENDPOINTS[endpointKey]}`, user );
                return runInInjectionContext( this.injector, () =>
                    collectionData( ref, { idField: 'id' } ).pipe( map( ( docs: any[] ) => docs.map( doc => ( { ...doc, id: doc.id } ) ) ) )
                );
            }
        );
    }

    async searchPublicContacts ( prefix: string, user: string, maxResults: number = 8 ): Promise<Contact[]> {
        const term = ( prefix || '' ).trim().toLowerCase();
        if ( !term ) return [];
        const tenantId: string | undefined = environment.taliferroTenantId;
        const ref = this.getCollectionReference( 'CONTACTS', tenantId );
        const start = term, end = term + '\uf8ff';
        const run = async ( field: string ): Promise<Contact[]> => {
            try {
                const q = query( ref, where( 'publicProfile', '==', true ), orderBy( field, 'asc' ), where( field, '>=', start ), where( field, '<=', end ), limit( maxResults ) );
                const snap = await this.runInContext( () => getDocs( q ) );
                return snap.docs.map( d => ( { id: d.id, ...d.data() } as Contact ) );
            } catch ( err ) {
                this.logger.warn( `searchPublicContacts ${field} error`, err );
                return [];
            }
        };
        const [r1, r2, r3] = await Promise.all( [run( 'handle' ), run( 'displayNameLower' ), run( 'company.nameLower' )] );
        const seen = new Set<string>();
        const merged: Contact[] = [];
        for ( const arr of [r1, r2, r3] ) {
            for ( const c of arr ) {
                const id = ( c as any ).id as string;
                if ( !id || seen.has( id ) ) continue;
                seen.add( id );
                merged.push( c );
                if ( merged.length >= maxResults ) break;
            }
            if ( merged.length >= maxResults ) break;
        }
        return merged.filter( c => !( c as any )?.suspended && !( c as any )?.hidden );
    }

    public logEvent ( action: string, user: string ) {
        try {
            const logEntry = { action, user: user?.trim() || 'System', timestamp: new Date() };
            const tenantId = resolveTenantIdForEndpoint( 'AUDITLOGS', () => this.getTenantId() );
            const logRef = this.getCollectionReference( 'AUDITLOGS', tenantId );
            runInInjectionContext( this.injector, () => {
                addDoc( logRef, this.cleanObject( logEntry ) )
                    .then( () => this.events.next( [...this.events.value, logEntry] ) )
                    .catch( error => this.logger.error( 'Error logging event:', error ) );
            } );
            // AUDITLOGS is centralized to the master tenant above (see resolveTenantIdForEndpoint /
            // MASTER_TENANT_ENDPOINTS) so real per-tenant activity never reached each tenant's own
            // auditLogs - which is what the backend's tenant-staleness gate reads to decide whether
            // to run scheduled work for that tenant. Mirror the write into the visiting tenant's own
            // collection so that signal reflects real usage again.
            this.writeVisitingTenantActivityLog( 'AUDITLOGS', tenantId, this.cleanObject( logEntry ) );
        } catch ( error ) {
            this.logger.error( 'Error logging event:', error );
        }
    }

    /**
     * AUDITLOGS/APP_ACTIVITY are always written to the master Taliferro tenant (see
     * MASTER_TENANT_ENDPOINTS) to keep analytics centralized and avoid permission errors for
     * public/affiliate visitors. That means a real tenant's own auditLogs/app-activity collection -
     * which the backend reads to determine whether a tenant is actively using the product - never
     * gets written to. This mirrors the same log entry into the visiting tenant's own collection
     * when one can be resolved, and is a no-op (not an error) for anonymous/public routes or when
     * the visiting tenant already *is* the master tenant.
     */
    private writeVisitingTenantActivityLog ( endpointKey: keyof typeof ENDPOINTS, masterTenantId: string | undefined, logEntry: Record<string, any> ): void {
        let visitingTenantId: string;
        try {
            visitingTenantId = this.getTenantId();
        } catch {
            return;
        }
        if ( !visitingTenantId || visitingTenantId === masterTenantId ) {
            return;
        }
        try {
            runInInjectionContext( this.injector, () => {
                const tenantLogRef = this.getCollectionReference( endpointKey, visitingTenantId );
                addDoc( tenantLogRef, logEntry ).catch( ( error: any ) => {
                    const code = ( error && ( error.code || error?.name ) ) ? String( error.code || error.name ) : '';
                    const msg = error?.message ? String( error.message ) : '';
                    const isPermissionDenied = code.includes( 'permission-denied' ) || msg.includes( 'Missing or insufficient permissions' );
                    if ( !isPermissionDenied ) {
                        this.logger.warn( `[${endpointKey}] tenant-scoped activity write failed`, error );
                    }
                } );
            } );
        } catch ( error ) {
            this.logger.warn( `[${endpointKey}] tenant-scoped activity write failed`, error );
        }
    }

    async fetchEmailData ( pageSize: number, endpointKey: keyof typeof ENDPOINTS, _id: string ): Promise<any[]> {
        const tenantId = environment.multiTenant ? this.getTenantId() : undefined;
        const colRef = this.getCollectionReference( endpointKey, tenantId );
        const q = this.lastVisible
            ? query( colRef, orderBy( 'date' ), startAfter( this.lastVisible ), limit( pageSize ) )
            : query( colRef, orderBy( 'date' ), limit( pageSize ) );
        const documentSnapshots = await this.runInContext( () => getDocs( q ) );
        this.lastVisible = documentSnapshots.docs[documentSnapshots.docs.length - 1];
        return documentSnapshots.docs.map( doc => ( { ...doc.data(), id: doc.id } ) );
    }

    async fetchPaged ( endpointKey: keyof typeof ENDPOINTS, pageSize: number = 50, orderField: string = 'lastUpdated', direction: 'asc' | 'desc' = 'desc' ): Promise<any[]> {
        const tenantId = environment.multiTenant ? this.getTenantId() : undefined;
        const colRef = this.getCollectionReference( endpointKey, tenantId );
        const cursorKey = ENDPOINTS[endpointKey];
        const cursor = this.pageCursors[cursorKey] ?? null;
        const q = cursor
            ? query( colRef, orderBy( orderField, direction ), startAfter( cursor ), limit( pageSize ) )
            : query( colRef, orderBy( orderField, direction ), limit( pageSize ) );
        const snaps = await this.runInContext( () => getDocs( q ) );
        this.pageCursors[cursorKey] = snaps.docs[snaps.docs.length - 1] ?? null;
        return snaps.docs.map( doc => ( { id: doc.id, ...doc.data() } ) );
    }

    public async uploadData ( data: Contact[], _message: string ) {
        const tenantId = environment.multiTenant ? this.getTenantId() : undefined;
        const ref = this.getCollectionReference( 'CONTACTS', tenantId );
        this.logger.info( `[UPLOAD] Uploading ${data.length} contacts` );

        let successCount = 0, failureCount = 0, skippedCount = 0;
        const projectedAdds = await this.estimateNewContactAdds( data, tenantId );
        await this.ensureContactCapacityForAdds( projectedAdds );

        for ( const item of data ) {
            try {
                if ( ( !item.emailAddresses || item.emailAddresses.length === 0 ) && item.email ) {
                    item.emailAddresses = [{ emailAddress: item.email.toLowerCase(), emailAddressType: 'Primary', blocked: false }];
                }

                const allEmails = new Set<string>();
                if ( item.email ) allEmails.add( item.email.toLowerCase() );
                if ( item.emailAddresses ) {
                    item.emailAddresses.forEach( e => { if ( e.emailAddress ) allEmails.add( e.emailAddress.toLowerCase() ); } );
                }

                const deletedRef = this.getCollectionReference( 'DELETED_CONTACTS', tenantId );
                let isDeleted = false;
                for ( const email of allEmails ) {
                    const snap = await this.runInContext( () => getDocs( query( deletedRef, where( 'email', '==', email ) ) ) );
                    if ( !snap.empty ) { isDeleted = true; break; }
                }
                if ( isDeleted ) { this.setStatus( `Skipped (Deleted): ${item.firstName}` ); skippedCount++; continue; }

                if ( item.emailAddresses && item.emailAddresses.length > 0 && item.emailAddresses[0].emailAddress ) {
                    item.email = item.emailAddresses[0].emailAddress.toLowerCase();
                    let docRef: DocumentReference<DocumentData> | null = null;
                    for ( const email of allEmails ) {
                        docRef = await this.checkIfExists( email, tenantId );
                        if ( docRef ) break;
                    }

                    if ( docRef ) {
                        const preservedFields = ['status', 'subscription', 'emailStage', 'lastContacted'];
                        const existingSnap = await this.runInContext( () => getDoc( docRef ) );
                        const preserved: any = {};

                        if ( existingSnap.exists() ) {
                            const existingData = existingSnap.data();
                            preservedFields.forEach( f => { if ( existingData[f] !== undefined ) preserved[f] = existingData[f]; } );

                            const existingEmails = ( existingData['emailAddresses'] || [] ) as EmailAddress[];
                            const emailMap = new Map( existingEmails.map( e => [e.emailAddress.toLowerCase(), e] ) );
                            item.emailAddresses = ( item.emailAddresses || [] ).map( incoming => {
                                const match = emailMap.get( incoming.emailAddress.toLowerCase() );
                                return match ? { ...incoming, checked: match.checked ?? incoming.checked, dateChecked: match.dateChecked ?? incoming.dateChecked, isEmailEnriched: match.isEmailEnriched ?? incoming.isEmailEnriched, lastEmailEnriched: match.lastEmailEnriched ?? incoming.lastEmailEnriched } : incoming;
                            } );
                        }

                        const cleanedData = this.cleanObject( item );
                        await this.deepMergeFirestore( docRef, cleanedData );
                        await this.updateDocument( 'CONTACTS', docRef.id, preserved, item.email );
                        this.setStatus( `Merged: ${item.firstName}` );
                        successCount++;
                    } else {
                        const cleanedData = this.cleanObject( item );
                        await addDoc( ref, cleanedData );
                        this.setStatus( `Added: ${item.firstName}` );
                        successCount++;
                    }
                } else {
                    skippedCount++;
                }
            } catch ( error ) {
                this.logger.error( `Error processing contact`, error );
                failureCount++;
            }
        }

        const summary = `Upload: ${successCount} added/merged, ${failureCount} failed, ${skippedCount} skipped.`;
        this.logger.info( summary );
        this.setStatus( summary );
        return { successCount, failureCount, skippedCount };
    }

    async checkIfExists ( email: string, tenantId?: string ): Promise<DocumentReference<DocumentData> | null> {
        if ( !email ) return null;
        const cypressContact = this.getCypressContactByEmail( email );
        if ( cypressContact ) {
            return { id: cypressContact.id } as DocumentReference<DocumentData>;
        }
        const resolvedTenantId = environment.multiTenant ? tenantId ?? this.getTenantId() : undefined;
        const ref = this.getCollectionReference( 'CONTACTS', resolvedTenantId );
        try {
            const snapshot = await this.runInContext( () => getDocs( query( ref, where( 'email', '==', email ) ) ) );
            return !snapshot.empty ? snapshot.docs[0].ref : null;
        } catch ( error ) {
            this.logger.error( `Error checking if exists:`, error );
            return null;
        }
    }

    async checkIfExistsUsingKnownTenant ( email: string, tenantId?: string ): Promise<DocumentReference<DocumentData> | null> {
        if ( !email ) return null;
        const ref = this.getCollectionReference( 'CONTACTS', tenantId );
        try {
            const snapshot = await this.runInContext( () => getDocs( query( ref, where( 'email', '==', email ) ) ) );
            return !snapshot.empty ? snapshot.docs[0].ref : null;
        } catch ( error ) {
            this.logger.error( `Error checking if exists:`, error );
            return null;
        }
    }

    async getRecordIdIfExists ( email: string, tenantId?: string ): Promise<string | undefined> {
        if ( !email ) return undefined;
        const cypressContact = this.getCypressContactByEmail( email );
        if ( cypressContact?.id ) return String( cypressContact.id );
        if ( this.isCypressRuntime() ) return undefined;
        const resolvedTenantId = environment.multiTenant ? tenantId ?? this.getTenantId() : undefined;
        const ref = this.getCollectionReference( 'CONTACTS', resolvedTenantId );
        try {
            const snapshot = await this.runInContext( () => getDocs( query( ref, where( 'email', '==', email ) ) ) );
            return !snapshot.empty ? snapshot.docs[0].id : undefined;
        } catch ( error ) {
            this.logger.error( `Error getting record id:`, error );
            return undefined;
        }
    }

    async getKnownTenantContactByEmail ( email: string, tenantId?: string ): Promise<Contact | null> {
        if ( !email ) return null;
        const ref = this.getCollectionReference( 'CONTACTS', tenantId );
        try {
            const snapshot = await getDocs( query( ref, where( 'email', '==', email ) ) );
            return !snapshot.empty ? snapshot.docs[0].data() as Contact : null;
        } catch ( error ) {
            this.logger.error( `Error fetching contact:`, error );
            return null;
        }
    }


    public updateKnownTenantDocument (
        endpointKey: keyof typeof ENDPOINTS,
        id: string,
        data: any,
        user: string,
        tenantID: string
    ): Promise<{ success: boolean; id: string; }> {
        // bypass tenantId injection since tenant is explicitly provided
        this.setRecordState( data, true );
        return this.updateKnowTenantDocument( endpointKey, id, data, user, tenantID );
    }


    /**
     * Logs an activity with provided action details to the database.
     * If the environment is multi-tenant and metadata contains a tenantId,
     * it is used; otherwise, the default tenantId is retrieved.
     * An activity entry is created in the 'APP_ACTIVITY' collection with appropriate metadata.
     *
     * @param action An object with `type`, `description` and optional `metadata` for the activity.
     * @returns A promise that resolves on successful logging or rejects with an error.
     */
    public logActivity ( action: { type: string; description: string; metadata?: any; } ): Promise<void> {
        return new Promise<void>( ( resolve, reject ) => {
            try {
                runInInjectionContext( this.injector, async () => {
                    // APP_ACTIVITY should always be written to the Taliferro master tenant.
                    // This avoids permission issues for public/affiliate tenants and keeps analytics centralized.
                    const masterTenantId: string | undefined = environment.taliferroTenantId;
                    let resolvedTenantId: string | undefined;
                    if ( !masterTenantId ) {
                        this.logger.warn( 'Skipping logActivity: missing environment.taliferroTenantId.' );
                        resolve();
                        return;
                    }
                    resolvedTenantId = masterTenantId;

                    // Allow an explicit override only when absolutely necessary.
                    if ( action?.metadata?.tenantId ) {
                        resolvedTenantId = String( action.metadata.tenantId );
                    }

                    try {
                        const logRef = this.getCollectionReference( 'APP_ACTIVITY', resolvedTenantId );
                        const metadata = await this.enrichActivityMetadata( action.metadata );
                        const logEntry = {
                            action: action.type,
                            description: action.description,
                            metadata,
                            timestamp: new Date().toISOString()
                        };
                        this.logger.info( `[Firestore WRITE] APP_ACTIVITY tenant=${resolvedTenantId} type=${action.type}` );
                        await addDoc( logRef, logEntry );
                        this.writeVisitingTenantActivityLog( 'APP_ACTIVITY', masterTenantId, logEntry );
                        resolve();
                    } catch ( error: any ) {
                        // IMPORTANT: logging must never break product flows.
                        // If Firestore rules deny write (common for SayIt/public views), swallow the error.
                        const code = ( error && ( error.code || error?.name ) ) ? String( error.code || error.name ) : '';
                        const msg = error?.message ? String( error.message ) : '';
                        const isPermissionDenied = code.includes( 'permission-denied' ) || msg.includes( 'Missing or insufficient permissions' );

                        if ( isPermissionDenied ) { resolve(); return; }

                        this.logger.error( 'Failed to log event:', error );
                        reject( error );
                    }
                } );
            } catch ( outerError ) {
                this.logger.error( 'Injection context failed:', outerError );
                reject( outerError );
            }
        } );
    }

    public setRecordState ( data: any, bypass?: boolean ): void {
        if ( !data.id ) data.dateAdded = new Date().toISOString();
        data.lastUpdated = new Date().toISOString();
        data.lastViewed = new Date().toISOString();
        data.timeStamp = new Date();
        if ( environment.multiTenant && !bypass ) data.tenantId = this.getTenantId();
    }

    getDocument ( endpointKey: keyof typeof ENDPOINTS, id: string, user: string ): Observable<any> {
        return this.getDocumentRealtime( endpointKey, id, user );
    }

    getDocumentRealtime ( endpointKey: keyof typeof ENDPOINTS, id: string, user: string ): Observable<any> {
        if ( endpointKey === 'CONTACTS' ) {
            const cypressContact = this.getCypressContactById( id );
            if ( cypressContact ) {
                return of( cypressContact );
            }
        }

        if ( endpointKey === 'RESPONSE_FLOW' ) {
            const cypressResponseFlow = this.getCypressResponseFlowById( id );
            if ( cypressResponseFlow ) {
                return of( cypressResponseFlow );
            }
        }

        const tenantId = environment.multiTenant ? this.getTenantId() : undefined;
        const docRef = doc( this.getCollectionReference( endpointKey, tenantId ), id );
        return runInInjectionContext( this.injector, () =>
            docData( docRef, { idField: 'id' } ).pipe(
                catchError( error => { this.logger.error( "Error in realtime subscription:", error ); return of( null ); } )
            )
        ) as Observable<any>;
    }

    async getRecentMessages (): Promise<any[]> {
        const tenantId = environment.multiTenant ? this.getTenantId() : undefined;
        const snapshot = await this.runInContext( () => getDocs( query( this.getCollectionReference( 'EMAILS', tenantId ), orderBy( 'date', 'desc' ), limit( 4 ) ) ) );
        return snapshot.docs.map( doc => ( { id: doc.id, ...doc.data() } ) );
    }

    resetPagination (): void { this.lastVisible = null; }
    resetPagedCursor ( endpointKey: keyof typeof ENDPOINTS ): void { this.pageCursors[ENDPOINTS[endpointKey]] = null; }

    private setStatus ( message: string ): void {
        const current = this.statusSubject.getValue();
        this.statusSubject.next( { latest: message, log: [...current.log, message] } );
    }

    async updateContact ( contact: Contact, userId: string ): Promise<void> {
        if ( contact?.id ) {
            this.setRecordState( contact );
            await this.updateDocument( 'CONTACTS', contact.id, this.cleanObject( contact ), userId );
        } else {
            this.logger.error( 'Invalid contact' );
        }
    }

    private deepMerge ( target: any, source: any ): any {
        for ( const key of Object.keys( source ) ) {
            if ( this.isObject( source[key] ) && this.isObject( target[key] ) ) {
                target[key] = this.deepMerge( target[key], source[key] );
            } else {
                target[key] = source[key];
            }
        }
        return target;
    }

    private isObject ( obj: any ): boolean { return obj && typeof obj === 'object' && !Array.isArray( obj ); }
    private runInContext<T> ( fn: () => Promise<T> ): Promise<T> { return runInInjectionContext( this.injector, fn ); }
    public clearAll (): void { this.events.next( [] ); this.lastVisible = null; }
    cleanObject ( obj: any ) { return JSON.parse( JSON.stringify( obj ) ); }
    findUndefined ( obj: any, path = '' ) { for ( const key in obj ) { const fullPath = path ? `${path}.${key}` : key; if ( obj[key] === undefined ) this.logger.warn( `Undefined: ${fullPath}` ); else if ( typeof obj[key] === 'object' && obj[key] !== null ) this.findUndefined( obj[key], fullPath ); } }
    async deepMergeFirestore ( docRef: DocumentReference<DocumentData>, newData: any ): Promise<void> { const docSnap = await this.runInContext( () => getDoc( docRef ) ); const existing = docSnap.exists() ? docSnap.data() : {}; await this.runInContext( () => setDoc( docRef, this.deepMerge( existing, newData ), { merge: false } ) ); }
    profileCursorKey ( criteria: any ): string { return JSON.stringify( criteria ); }

    getCommunicationsLastNDays$ ( days: number = 30, contactId?: string, pageSize: number = 500 ): Observable<Communication[]> {
        const tenantId = environment.multiTenant ? this.getTenantId() : undefined;
        const ref = this.getCollectionReference( 'COMMUNICATIONS', tenantId );
        const startDate = new Date();
        startDate.setDate( startDate.getDate() - days );
        let q: Query<DocumentData> = contactId
            ? query( ref, where( 'contactId', '==', contactId ), where( 'date', '>=', startDate.toISOString() ), orderBy( 'date', 'asc' ), limit( pageSize ) )
            : query( ref, where( 'date', '>=', startDate.toISOString() ), orderBy( 'date', 'asc' ), limit( pageSize ) );
        return runInInjectionContext( this.injector, () =>
            collectionData( q, { idField: 'id' } ).pipe( map( ( docs: any[] ) => docs.map( d => ( { ...d, id: d.id } ) ) as Communication[] ) )
        );
    }

    getCommunicationsForContactLast30$ ( contactId: string, pageSize: number = 500 ): Observable<Communication[]> {
        return this.getCommunicationsLastNDays$( 30, contactId, pageSize );
    }

    private async getProfilePostsPage ( criteria: { authorContactId?: string; authorHandle?: string; userId?: string; }, cursor: DocumentData | null, pageSize: number = 10 ): Promise<any[]> {
        const colRef = this.getCollectionReference( 'POSTS', undefined );
        let q: Query<DocumentData>;
        if ( criteria.authorContactId ) {
            q = query( colRef, where( 'authorContactId', '==', criteria.authorContactId ), orderBy( 'timestamp', 'desc' ), limit( pageSize ) );
        } else if ( criteria.authorHandle ) {
            q = query( colRef, where( 'authorHandle', '==', criteria.authorHandle.toLowerCase() ), orderBy( 'timestamp', 'desc' ), limit( pageSize ) );
        } else if ( criteria.userId ) {
            q = query( colRef, where( 'userId', '==', criteria.userId ), orderBy( 'timestamp', 'desc' ), limit( pageSize ) );
        } else {
            return [];
        }
        if ( cursor ) q = query( q, startAfter( cursor ) );
        const snaps = await this.runInContext( () => getDocs( q ) );
        const key = this.profileCursorKey( criteria );
        this.profilePostCursors[key] = snaps.docs[snaps.docs.length - 1] ?? null;
        return snaps.docs.map( d => ( { id: d.id, ...d.data() } ) ).filter( p => !( p as any )?.hidden && !( p as any )?.suspended );
    }

    async getProfilePostsFirstPage ( criteria: { authorContactId?: string; authorHandle?: string; userId?: string; }, pageSize: number = 10 ): Promise<any[]> {
        const cypressPosts = this.getCypressSayItPosts();
        if ( cypressPosts ) {
            const filtered = cypressPosts.filter( post => {
                if ( criteria.authorContactId ) return String( post?.authorContactId || '' ) === criteria.authorContactId;
                if ( criteria.authorHandle ) return String( post?.authorHandle || '' ).toLowerCase() === criteria.authorHandle.toLowerCase();
                if ( criteria.userId ) return String( post?.userId || '' ) === criteria.userId;
                return false;
            } );

            return filtered
                .filter( post => !( post as any )?.hidden && !( post as any )?.suspended )
                .sort( ( a, b ) => this.extractComparableDate( b?.timestamp ) - this.extractComparableDate( a?.timestamp ) )
                .slice( 0, pageSize )
                .map( post => ( { ...post } ) );
        }

        return this.getProfilePostsPage( criteria, null, pageSize );
    }

    async getProfilePostsNextPage ( criteria: { authorContactId?: string; authorHandle?: string; userId?: string; }, pageSize: number = 10 ): Promise<any[]> {
        const key = this.profileCursorKey( criteria );
        return this.profilePostCursors[key] ? this.getProfilePostsPage( criteria, this.profilePostCursors[key], pageSize ) : [];
    }

    async getEmailWarmupState ( userId: string ): Promise<any | null> {
        const tenantId = environment.multiTenant ? this.getTenantId() : undefined;
        const basePath = tenantId ? `tenants/${tenantId}/emailWarmupState` : `emailWarmupState`;
        return this.runInContext( async () => {
            try {
                const warmupDocRef = doc( this.firestore, basePath, 'global' );
                const snap = await getDoc( warmupDocRef );
                return snap.exists() ? { id: snap.id, ...snap.data() } : null;
            } catch ( error ) {
                this.logger.error( 'Error fetching email warmup state:', error );
                return null;
            }
        } );
    }
    getDocumentById ( endpointKey: keyof typeof ENDPOINTS, id: string, user: string ): Observable<any> {
        return this.getDocumentRealtime( endpointKey, id, user );
    }

    async getEmailsByEmailAddress ( emailAddress: string, tenantId?: string ): Promise<any[]> {
        const resolvedTenantId = environment.multiTenant ? tenantId ?? this.getTenantId() : undefined;
        const ref = this.getCollectionReference( 'EMAILS', resolvedTenantId );
        const snapshot = await this.runInContext( () => getDocs( query( ref, where( 'to', '==', emailAddress ) ) ) );
        return snapshot.docs.map( doc => ( { id: doc.id, ...doc.data() } ) );
    }

    async getContactByEmail ( emailAddress: string, tenantId?: string ): Promise<Contact | null> {
        const resolvedTenantId = environment.multiTenant ? tenantId ?? this.getTenantId() : undefined;
        const ref = this.getCollectionReference( 'CONTACTS', resolvedTenantId );
        const snapshot = await this.runInContext( () => getDocs( query( ref, where( 'email', '==', emailAddress ), limit( 1 ) ) ) );
        return !snapshot.empty ? { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Contact : null;
    }

    getEmailsByCampaignId ( campaignId: string, tenantId?: string ): Promise<any[]> {
        const resolvedTenantId = environment.multiTenant ? tenantId ?? this.getTenantId() : undefined;
        const ref = this.getCollectionReference( 'EMAILS', resolvedTenantId );
        return this.cacheService.checkCacheOrReturnPromise<any>( 'emails_by_campaign', tenantId,
            () => this.runInContext( () => getDocs( query( ref, where( 'campaignId', '==', campaignId ) ) ) )
                .then( snapshot => snapshot.docs.map( doc => ( { id: doc.id, ...doc.data() } ) ) ),
            campaignId
        );
    }

    getCollectionDataWithLimit ( endpointKey: keyof typeof ENDPOINTS, user: string, limitTo: number = 1000, orderByField: 'lastUpdated' | 'timestamp' = 'lastUpdated' ): Promise<any[]> {
        const tenantId = environment.multiTenant ? this.getTenantId() : undefined;
        const ref = this.getCollectionReference( endpointKey, tenantId );
        const q = query( ref, orderBy( orderByField, 'desc' ), limit( limitTo ) );
        return this.cacheService.checkCacheOrReturnPromise<any>( ENDPOINTS[endpointKey], tenantId,
            () => this.runInContext( () => getDocs( q ) ).then( snap => snap.docs.map( d => ( { ...d.data(), id: d.id } ) ) ),
            `${limitTo}-${orderByField}`
        );
    }

    async getKnownTenantDocuments ( endpointKey: keyof typeof ENDPOINTS, tenantId: string, opts?: { limit?: number; orderField?: string; } ): Promise<any[]> {
        const ref = this.getCollectionReference( endpointKey, tenantId );
        const pageSize = opts?.limit ?? 1000;
        const orderField = opts?.orderField ?? 'lastUpdated';
        try {
            const snapshot = await this.runInContext( () =>
                getDocs( query( ref, orderBy( orderField, 'desc' ), limit( pageSize ) ) )
            );
            return snapshot.docs.map( doc => ( { id: doc.id, ...doc.data() } ) );
        } catch ( error ) {
            if ( DataService.isPermissionDenied( error ) ) return [];
            throw error;
        }
    }

    async getKnownTenantDocument ( endpointKey: keyof typeof ENDPOINTS, id: string, tenantId: string ): Promise<any | null> {
        const ref = this.getCollectionReference( endpointKey, tenantId );
        const docRef = doc( ref, id );
        const snapshot = await this.runInContext( () => getDoc( docRef ) );
        return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
    }

}
