import { Injectable, runInInjectionContext, Injector } from '@angular/core';
import { Firestore, collectionData, collection, query, where, doc, setDoc, getDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, of, throwError } from 'rxjs';
import { Contact } from '../shared/data/interfaces/contact.model';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { LoggerService } from './logger.service';
import { buildPhoneLookupKeys } from './helpers/phone-normalization.helper';
@Injectable( {
  providedIn: 'root'
} )
export class UserService {

  private loggedInContactInfo: Contact | null = null;
  private readonly tenantStorageKey = 'todd_active_tenant_id';

  constructor ( private firestore: Firestore, private auth: Auth, private logger: LoggerService, private injector: Injector, private http: HttpClient ) { }

  private isCypressRuntime (): boolean {
    if ( typeof window === 'undefined' ) return false;

    try {
      if ( window.localStorage?.getItem( '__useRealFirebaseAuth' ) === 'true' ) return false;
      return !!( window as any ).Cypress || !!window.localStorage?.getItem( '__cypressAuthOverride' );
    } catch {
      return !!( window as any ).Cypress;
    }
  }

  private shouldFailCypressUpdateContact (): boolean {
    if ( !this.isCypressRuntime() || typeof window === 'undefined' || !window.localStorage ) return false;
    return window.localStorage.getItem( '__cypressUpdateContactFailure' ) === 'true';
  }

  private getCypressAuthOverride (): { uid: string; tenantId: string; email: string | null; } | null {
    if ( !this.isCypressRuntime() || typeof window === 'undefined' || !window.localStorage ) return null;

    try {
      const raw = window.localStorage.getItem( '__cypressAuthOverride' );
      if ( !raw ) return null;
      const parsed = JSON.parse( raw );
      if ( !parsed || typeof parsed.uid !== 'string' || !parsed.uid.trim() ) return null;

      return {
        uid: parsed.uid.trim(),
        tenantId: typeof parsed.tenantId === 'string' && parsed.tenantId.trim()
          ? parsed.tenantId.trim()
          : parsed.uid.trim(),
        email: typeof parsed.email === 'string' && parsed.email.trim()
          ? parsed.email.trim().toLowerCase()
          : null
      };
    } catch {
      return null;
    }
  }

  private buildCypressFallbackContact ( override: { uid: string; tenantId: string; email: string | null; } ): Contact {
    const existingContact = this.getCypressContactById( override.uid );
    if ( existingContact ) return existingContact;

    return {
      id: override.uid,
      tenantId: override.tenantId,
      loginID: override.uid,
      email: override.email || '',
      emailAddresses: override.email
        ? [{ emailAddress: override.email, emailAddressType: 'primary', blocked: false }]
        : [],
      firstName: '',
      middleName: '',
      lastName: '',
      company: {
        name: '',
        numberOfEmployees: '',
        other: '',
        phoneNumbers: [],
        emailAddresses: [],
        addresses: [],
        url: '',
        sicCode: '',
        status: '',
        shared: false,
        capabilities: []
      },
      dateAdded: new Date().toISOString(),
      timeStamp: new Date()
    } as Contact;
  }

  private getCypressContacts (): Contact[] | null {
    try {
      if ( typeof window === 'undefined' || !this.isCypressRuntime() || !window.localStorage ) return null;
      const raw = window.localStorage.getItem( '__cypressContacts' );
      if ( !raw ) return null;
      const parsed = JSON.parse( raw );
      return Array.isArray( parsed ) ? parsed as Contact[] : null;
    } catch {
      return null;
    }
  }

  private setCypressContacts ( contacts: Contact[] ): void {
    try {
      if ( typeof window === 'undefined' || !this.isCypressRuntime() || !window.localStorage ) return;
      window.localStorage.setItem( '__cypressContacts', JSON.stringify( contacts || [] ) );
    } catch {
      // ignore Cypress storage failures
    }
  }

  private getCypressContactById ( id: string ): Contact | null {
    const contacts = this.getCypressContacts();
    if ( !contacts || !id ) return null;
    return contacts.find( contact => String( contact?.id || '' ) === String( id ) ) || null;
  }

  private cacheTenantId ( tenantId: string | null | undefined ): void {
    try {
      if ( typeof window === 'undefined' || !window.localStorage ) return;
      const normalizedTenantId = String( tenantId || '' ).trim();
      if ( normalizedTenantId ) {
        window.localStorage.setItem( this.tenantStorageKey, normalizedTenantId );
      } else {
        window.localStorage.removeItem( this.tenantStorageKey );
      }
    } catch {
      // ignore storage failures
    }
  }

  private getCachedTenantId (): string | null {
    try {
      if ( typeof window === 'undefined' || !window.localStorage ) return null;
      const cachedTenantId = window.localStorage.getItem( this.tenantStorageKey );
      return cachedTenantId ? cachedTenantId.trim() || null : null;
    } catch {
      return null;
    }
  }

  private async resolveCurrentTenantId ( user: any ): Promise<string | null> {
    if ( !user?.uid ) {
      return null;
    }

    const contactTenantId = String(
      this.loggedInContactInfo?.tenantId
      || ( this.loggedInContactInfo as any )?.companyId
      || ''
    ).trim();
    if ( contactTenantId ) {
      this.cacheTenantId( contactTenantId );
      return contactTenantId;
    }

    const cachedTenantId = this.getCachedTenantId();
    if ( cachedTenantId ) {
      return cachedTenantId;
    }


    try {
      const userRef = doc( this.firestore, 'users', user.uid );
      const userSnapshot = await runInInjectionContext( this.injector, () => getDoc( userRef ) );
      const assignedTenantId = String( userSnapshot.data()?.['companyId'] || '' ).trim();
      const resolvedTenantId = assignedTenantId || user.uid;
      this.cacheTenantId( resolvedTenantId );
      return resolvedTenantId;
    } catch ( error ) {
      this.logger.warn( 'UserService.resolveCurrentTenantId: falling back to auth uid', error );
      this.cacheTenantId( user.uid );
      return user.uid;
    }
  }

  /*******************************Multi Tenant ********************************************************/

  private findTenantContactById ( tenantId: string, userId: string ): Observable<Contact | null> {
    return new Observable<Contact | null>( observer => {
      runInInjectionContext( this.injector, async () => {
        try {
          const contactRef = doc( this.firestore, `tenants/${tenantId}/contacts/${userId}` );
          const docSnapshot = await getDoc( contactRef );
          if ( docSnapshot.exists() ) {
            observer.next( docSnapshot.data() as Contact );
          } else {
            observer.next( null );
          }
        } catch ( error ) {
          observer.error( new Error( `Failed to fetch tenant contact: ${error}` ) );
        } finally {
          observer.complete();
        }
      } );
    } );
  }

  getTenantLoggedInContactInfo ( forceRefresh = false ): Observable<Contact | null> {
    try {
      if ( this.isSayItContext() ) {
        return this.sayItNull<Contact>( 'getTenantLoggedInContactInfo' );
      }
      if ( this.loggedInContactInfo && !forceRefresh ) {
        return of( this.loggedInContactInfo );
      }

      const cypressOverride = this.getCypressAuthOverride();
      if ( cypressOverride ) {
        const contact = this.buildCypressFallbackContact( cypressOverride );
        this.loggedInContactInfo = contact;
        return of( contact );
      }

      const user = this.auth.currentUser;
      if ( !user ) {
        this.logger.info( 'No tenant user logged in; returning null contact info.' );
        return of( null );
      }

      return from( this.resolveCurrentTenantId( user ) ).pipe(
        switchMap( tenantId => {
          if ( !tenantId ) {
            this.logger.info( 'No tenant context resolved for logged in user; returning null contact info.' );
            return of( null );
          }

          return this.findTenantContactById( tenantId, user.uid ).pipe(
            switchMap( contact => {
              if ( contact ) {
                this.logger.info( "Found logged in Contact", contact );
                this.loggedInContactInfo = contact;
                this.cacheTenantId( String( contact.tenantId || tenantId || '' ).trim() || tenantId );
                return of( contact );
              } else {
                const newContact: Contact = {
                  firstName: '',
                  lastName: '',
                  id: user.uid,
                  email: user.email ?? '',
                  tenantId: tenantId,
                  loginID: user.uid,
                  dateAdded: new Date().toISOString(),
                  timeStamp: new Date(),
                  subscription: {
                    plan: null,
                    status: 'inactive',
                    billingCycle: null,
                    audience: null,
                    expiresAt: new Date( Date.now() + 14 * 24 * 60 * 60 * 1000 ).toISOString(),
                    stripeCustomerId: null,
                    stripeSubscriptionId: null,
                    stripePriceId: null
                  },
                };
                this.logger.info( "Creating logged in Contact", newContact );
                const contactRef = doc( this.firestore, `tenants/${tenantId}/contacts/${user.uid}` );
                return from( setDoc( contactRef, newContact ) ).pipe(
                  map( () => {
                    this.loggedInContactInfo = newContact;
                    this.cacheTenantId( tenantId );
                    return newContact;
                  } ),
                  catchError( error => {
                    this.logger.error( 'Error creating new tenant contact:', error );
                    return of( null );
                  } )
                );
              }
            } ),
            catchError( error => {
              this.logger.error( 'Error getting logged in tenant contact info:', error );
              return of( null );
            } )
          );
        } )
      );
    } catch ( error ) {
      this.logger.warn( 'Unexpected error in Tenant Logged In Contact Info:', error );
      return of( null );
    }
  }

  findTenantCreateContact ( tenantId: string, userId: string, email: string, phoneNumber?: string ): Observable<Contact> {
    if ( this.isSayItContext() ) {
      return this.sayItNotSupported<Contact>( 'findTenantCreateContact' );
    }

    if ( this.isCypressRuntime() ) {
      const existingContact = this.getCypressContactById( userId );
      if ( existingContact ) {
        this.loggedInContactInfo = existingContact;
        return of( existingContact );
      }

      const newContact = this.buildCypressFallbackContact( {
        uid: userId,
        tenantId,
        email
      } );
      this.applyRecordStateToContact( newContact as any, tenantId );
      this.setCypressContacts( [...( this.getCypressContacts() || [] ), newContact] );
      this.loggedInContactInfo = newContact;
      return of( newContact );
    }

    return new Observable<Contact>( observer => {
      runInInjectionContext( this.injector, async () => {
        try {
          const contactRef = doc( this.firestore, `tenants/${tenantId}/contacts/${userId}` );
          const docSnapshot = await getDoc( contactRef );

          if ( docSnapshot.exists() ) {
            const contact = docSnapshot.data() as Contact;
            this.loggedInContactInfo = contact;
            this.cacheTenantId( String( contact.tenantId || tenantId || '' ).trim() || tenantId );
            observer.next( contact );
            return;
          }

          const newContact: Contact = {
            id: userId,
            email: email,
            emailAddresses: [{ emailAddress: email, emailAddressType: 'primary', blocked: false }],
            firstName: '',
            middleName: '',
            lastName: '',
            subscriber: true,
            images: [{
              src: 'assets/nophoto.svg',
              alt: 'No photo available'
            }],
            company: {
              name: '',
              numberOfEmployees: '',
              other: '',
              phoneNumbers: [],
              emailAddresses: [],
              addresses: [],
              url: '',
              sicCode: '',
              status: '',
              shared: false,
              capabilities: []
            },
            connectionDetails: {
              startDate: new Date().toISOString(),
              mutualConnections: 0,
              transactionHistory: []
            },
            engagements: [],
            type: 'subscriber',
            interactions: [],
            acquisitionSource: 'sign-up',
            dateAdded: new Date().toISOString(),
            lastContacted: new Date().toISOString(),
            subscription: {
              plan: null,
              status: 'active',
              billingCycle: null,
              audience: null,
              expiresAt: new Date( Date.now() + 14 * 24 * 60 * 60 * 1000 ).toISOString(),
              stripeCustomerId: null,
              stripeSubscriptionId: null,
              stripePriceId: null
            },
            ...( phoneNumber ? { phoneNumbers: [{ phoneNumber, phoneNumberType: 'mobile' }] } : {} ),
          };

          await setDoc( contactRef, newContact );
          this.loggedInContactInfo = newContact;
          this.cacheTenantId( tenantId );
          observer.next( newContact );
        } catch ( error ) {
          observer.error( new Error( `Failed to find or create tenant contact: ${error}` ) );
        } finally {
          observer.complete();
        }
      } );
    } );
  }

  claimPublicLeadIntoTenantContact ( tenantId: string, userId: string, email: string, fallbackContact: Contact ): Observable<Contact> {
    if ( this.isSayItContext() ) {
      return of( fallbackContact );
    }

    if ( this.isCypressRuntime() ) {
      this.loggedInContactInfo = fallbackContact;
      return of( fallbackContact );
    }

    const headers = new HttpHeaders()
      .set( 'x-tenant-id', String( tenantId || '' ).trim() )
      .set( 'x-user-id', String( userId || '' ).trim() )
      .set( 'x-user-email', String( email || '' ).trim().toLowerCase() );

    return this.http.post<{
      success?: boolean;
      claimed?: boolean;
      contact?: Contact;
    }>( `${environment.backendURL}/marketing/public-lead/claim`, {
      email: String( email || '' ).trim().toLowerCase()
    }, { headers } ).pipe(
      map( response => {
        const nextContact = response?.contact || fallbackContact;
        this.loggedInContactInfo = nextContact;
        this.cacheTenantId( String( nextContact?.tenantId || tenantId || '' ).trim() || tenantId );
        return nextContact;
      } ),
      catchError( error => {
        this.logger.warn( 'UserService.claimPublicLeadIntoTenantContact failed', error );
        this.loggedInContactInfo = fallbackContact;
        this.cacheTenantId( String( fallbackContact?.tenantId || tenantId || '' ).trim() || tenantId );
        return of( fallbackContact );
      } )
    );
  }



  findAffiliateCreateContact ( affiliateUid: string, email: string, source?: string ): Observable<Contact> {
    if ( this.isSayItContext() ) {
      return this.sayItNotSupported<Contact>( 'findAffiliateCreateContact' );
    }
    const contactRef = doc( this.firestore, `tenants/${affiliateUid}/contacts/${affiliateUid}` );
    return from( getDoc( contactRef ) ).pipe(
      switchMap( docSnapshot => {
        if ( docSnapshot.exists() ) {
          // Return the existing contact if it exists
          const contact = docSnapshot.data() as Contact;
          return of( contact );
        } else {
          // Create a new contact if none exists
          const newContact: Contact = {
            id: affiliateUid,
            email: email,
            // Add other contact fields as needed
            emailAddresses: [{ emailAddress: email, emailAddressType: 'primary', blocked: false }],
            firstName: '',
            middleName: '',
            lastName: '',
            images: [{
              src: 'assets/nophoto.svg',
              alt: 'No photo available'
            }],
            company: {
              name: '',
              numberOfEmployees: '',
              other: '',
              phoneNumbers: [],
              emailAddresses: [],
              addresses: [],
              url: '',
              sicCode: '',
              status: '',
              shared: false,
              capabilities: []
            },
            connectionDetails: {
              startDate: new Date().toISOString(),
              mutualConnections: 0,
              transactionHistory: []
            },
            engagements: [],
            interactions: [],
            type: source ? source : 'affiliate',
            acquisitionSource: source ? source : 'affiliate',
            dateAdded: new Date().toISOString(),
            lastContacted: new Date().toISOString(),
            subscription: {
              plan: null,
              status: 'active', // or 'trialing', depending on your default logic
              billingCycle: null,
              audience: null,
              expiresAt: new Date( Date.now() + 14 * 24 * 60 * 60 * 1000 ).toISOString(), // default 14-day trial
              stripeCustomerId: null,
              stripeSubscriptionId: null,
              stripePriceId: null
            },
          };
          // Set the new contact document in Firestore and return the contact
          return from( setDoc( contactRef, newContact ) ).pipe(
            map( () => {
              this.loggedInContactInfo = newContact;
              return newContact;
            } ),
            catchError( error => {
              throw new Error( `Failed to create contact: ${error}` );
            } )
          );
        }
      } ),
      catchError( error => {
        throw new Error( `Failed to find or create tenant contact: ${error}` );
      } )
    );
  }


  findResellerCreateContact ( resellerUid: string, email: string, source?: string ): Observable<Contact> {
    if ( this.isSayItContext() ) {
      return this.sayItNotSupported<Contact>( 'findResellerCreateContact' );
    }
    const contactRef = doc( this.firestore, `tenants/${resellerUid}/contacts/${resellerUid}` );
    return from( getDoc( contactRef ) ).pipe(
      switchMap( docSnapshot => {
        if ( docSnapshot.exists() ) {
          // Return the existing contact if it exists
          const contact = docSnapshot.data() as Contact;
          return of( contact );
        } else {
          // Create a new contact if none exists
          const newContact: Contact = {
            id: resellerUid,
            email: email,
            // Add other contact fields as needed
            emailAddresses: [{ emailAddress: email, emailAddressType: 'primary', blocked: false }],
            firstName: '',
            middleName: '',
            lastName: '',
            images: [{
              src: 'assets/nophoto.svg',
              alt: 'No photo available'
            }],
            company: {
              name: '',
              numberOfEmployees: '',
              other: '',
              phoneNumbers: [],
              emailAddresses: [],
              addresses: [],
              url: '',
              sicCode: '',
              status: '',
              shared: false,
              capabilities: []
            },
            connectionDetails: {
              startDate: new Date().toISOString(),
              mutualConnections: 0,
              transactionHistory: []
            },
            engagements: [],
            interactions: [],
            type: source ? source : 'reseller',
            acquisitionSource: source ? source : 'reseller',
            dateAdded: new Date().toISOString(),
            lastContacted: new Date().toISOString(),
            subscription: {
              plan: null,
              status: 'active', // or 'trialing', depending on your default logic
              billingCycle: null,
              audience: null,
              expiresAt: new Date( Date.now() + 14 * 24 * 60 * 60 * 1000 ).toISOString(), // default 14-day trial
              stripeCustomerId: null,
              stripeSubscriptionId: null,
              stripePriceId: null
            },
          };
          // Set the new contact document in Firestore and return the contact
          return from( setDoc( contactRef, newContact ) ).pipe(
            map( () => {
              this.loggedInContactInfo = newContact;
              return newContact;
            } ),
            catchError( error => {
              throw new Error( `Failed to create contact: ${error}` );
            } )
          );
        }
      } ),
      catchError( error => {
        throw new Error( `Failed to find or create tenant contact: ${error}` );
      } )
    );
  }


  /*******************************Single Tenant ********************************************************/

  private findContactById ( userId: string ): Observable<Contact[]> {
    const contactsRef = collection( this.firestore, 'contacts' );
    const q = query( contactsRef, where( 'userId', '==', userId ) );
    return collectionData( q, { idField: 'id' } ) as Observable<Contact[]>;
  }

  findOrCreateContact ( userId: string, email: string ): Observable<Contact> {
    if ( this.isSayItContext() ) {
      return this.sayItNotSupported<Contact>( 'findOrCreateContact' );
    }
    if ( environment.multiTenant ) {
      const tenantId = userId;
      return this.findTenantCreateContact( tenantId, userId, email );
    } else {
      return this.findContactById( userId ).pipe(
        switchMap( contacts => {
          if ( contacts.length > 0 ) {
            const contact = contacts[0]; // Take the first matching contact
            return of( contact ); // Return the contact if it already has a userId
          } else {
            // Create a new contact if none exists
            const newContact: Contact = {
              emailAddresses: [{ emailAddress: email, emailAddressType: 'primary', blocked: false }],
              userId: userId,
              firstName: '',
              middleName: '',
              lastName: '',
              images: [{
                src: 'assets/nophoto.svg',
                alt: 'No photo available'
              }],
              company: {  // Add default company object here
                name: '',  // Default empty name
                numberOfEmployees: '', // Default value can be empty or a placeholder
                other: '', // Default or initial value
                phoneNumbers: [], // Initialize as empty array
                emailAddresses: [], // Initialize as empty array
                addresses: [], // Initialize as empty array
                url: '', // Default or initial value
                sicCode: '', // Default or initial value
                status: '', // Default or initial value
                shared: false, // Default boolean value
                capabilities: []
              },
              // Default values for new properties
              connectionDetails: {
                startDate: new Date().toISOString(),  // Consider what default makes sense for your use case
                mutualConnections: 0,
                transactionHistory: []
              },
              engagements: [],
              interactions: [],
              acquisitionSource: 'web',
              dateAdded: new Date().toISOString(),
              lastContacted: new Date().toISOString(),
              subscription: {
                plan: null,
                status: 'active', // or 'trialing', depending on your default logic
                billingCycle: null,
                audience: null,
                expiresAt: new Date( Date.now() + 14 * 24 * 60 * 60 * 1000 ).toISOString(), // default 14-day trial
                stripeCustomerId: null,
                stripeSubscriptionId: null,
                stripePriceId: null
              },
            };
            const newContactRef = doc( collection( this.firestore, 'contacts' ), userId );
            return from( setDoc( newContactRef, newContact ) ).pipe(
              map( () => ( { ...newContact, id: newContactRef.id } ) )
            );
          }
        } ),
        catchError( error => {
          throw new Error( `Failed to find or create contact: ${error}` );
        } )
      );
    }
  }

  /**
   * Updates the specified contact for a given tenant using Firestore. If no user is logged in, it throws an error.
   * If the contact does not have an ID, the logged in user's UID is assigned as the contact's ID.
   * Supports multi-tenant environments by modifying the Firestore path.
   *
   * @param {Contact} contact - The contact object to be updated, which should include an ID.
   * @param {any} tenantId - The ID of the tenant to which the contact belongs.
   * @returns {Observable<void>} An observable that completes when the contact has been updated, or errors if the update fails.
   */
  updateContact ( contact: Contact, tenantId: any ): Observable<void> {
    if ( this.isSayItContext() ) {
      return this.sayItNoop( 'updateContact' );
    }

    // Cypress path must come before auth.currentUser check because visitWithCypressAuth
    // uses a localStorage override rather than real Firebase auth, so currentUser is null.
    const cypressContacts = this.getCypressContacts();
    if ( this.isCypressRuntime() ) {
      if ( this.shouldFailCypressUpdateContact() ) {
        return throwError( () => new Error( 'Cypress update contact failure' ) );
      }

      const nextContact = { ...( contact as any ) } as Contact;
      this.applyRecordStateToContact( nextContact as any, String( tenantId ) );
      const currentContacts = Array.isArray( cypressContacts ) ? cypressContacts : [];
      const nextRecords = [...currentContacts.filter( existing => String( existing?.id || '' ) !== String( nextContact.id ) ), nextContact];
      this.setCypressContacts( nextRecords );
      this.loggedInContactInfo = nextContact;
      return of( void 0 );
    }

    const user = this.auth.currentUser;

    if ( !user ) {
      return throwError( () => new Error( 'No user logged in' ) );
    }

    // Check if contact.id is set, otherwise use the user's UID
    if ( !contact.id ) {
      contact.id = user.uid;
    }

    // Ensure record state fields are consistently maintained for all Contact writes.
    this.applyRecordStateToContact( contact as any, String( tenantId ) );
    // If caller provided a tenantId and the contact already has tenantId, keep it as-is (do not overwrite).

    const sanitizedContact = this.sanitizeFirestorePayload( contact as any ) as Contact;

    const path = environment.multiTenant
      ? `tenants/${tenantId}/contacts/${sanitizedContact.id}`
      : `contacts/${sanitizedContact.id}`;

    this.logger.info( "Saving", path, sanitizedContact );
    const contactDocRef = doc( this.firestore, path );

    return from( setDoc( contactDocRef, { ...sanitizedContact }, { merge: true } ) ).pipe(
      tap( () => {
        this.loggedInContactInfo = { ...( sanitizedContact as any ) } as Contact;
      } ),
      catchError( error => {
        this.logger.error( "Failed to update contact:", error );
        throw new Error( `Failed to update contact: ${error.message}` );
      } )
    );
  }

  /**
   * Sets the information for the currently logged-in contact.
   * @param contact - An object containing the contact details to be set.
   */
  setLoggedInContactInfo ( contact: Contact ): void {
    this.loggedInContactInfo = contact;
    const tenantId = String( ( contact as any )?.tenantId || ( contact as any )?.companyId || '' ).trim();
    if ( tenantId ) {
      this.cacheTenantId( tenantId );
    }
  }

  /**
   * Retrieves the currently logged in user's contact information as an Observable.
   * If running in multi-tenant mode, it delegates to `getTenantLoggedInContactInfo`.
   * If contact info is already fetched, it returns that info. Otherwise, it attempts
   * to find or create the contact info based on the current authenticated user. It
   * logs relevant info or errors during the process.
   * @returns {Observable<Contact | null>} An Observable that emits the logged in user's contact
   *                                       info, or `null` if an error occurs or no user is logged in.
   */
  getLoggedInContactInfo ( forceRefresh = false ): Observable<Contact | null> {
    if ( this.isSayItContext() ) {
      return this.sayItNull<Contact>( 'getLoggedInContactInfo' );
    }
    if ( environment.multiTenant ) {
      return this.getTenantLoggedInContactInfo( forceRefresh );
    }
    else {
      if ( this.loggedInContactInfo && !forceRefresh ) {
        this.logger.info( "Already have logged in contact", this.loggedInContactInfo );
        return of( this.loggedInContactInfo );
      } else {
        const cypressOverride = this.getCypressAuthOverride();
        if ( cypressOverride ) {
          const contact = this.buildCypressFallbackContact( cypressOverride );
          this.loggedInContactInfo = contact;
          return of( contact );
        }

        const user = this.auth.currentUser;

        if ( !user ) {
          this.logger.info( 'No user logged in; returning null contact info.' );
          return of( null );
        }

        return this.findOrCreateContact( user.uid, user.email ?? '' ).pipe(
          map( contact => {
            this.logger.info( "Get Contact by Firebase UID", contact );
            this.loggedInContactInfo = contact;
            return contact;
          } ),
          catchError( error => {
            this.logger.error( 'Error getting logged in contact info:', error );
            return of( null );
          } )
        );
      }
    }
  }

  /**
   * Retrieves a contact based on the given Firebase UID.
   * This function checks if there is an authenticated user and also if there are tenant-specific overrides.
   * If the application is in a multi-tenant configuration, it looks up the contact in the relevant tenant's subcollection.
   * Otherwise, it queries the contacts collection by the Firebase UID.
   *
   * @param {string} firebaseUid - The unique identifier for the Firebase user.
   * @returns {Observable<Contact | null>} An observable that will emit the contact if found, or null if not.
   */
  getContactByFirebaseUid ( firebaseUid: string ): Observable<Contact | null> {
    if ( this.isSayItContext() ) {
      return this.sayItNull<Contact>( 'getContactByFirebaseUid' );
    }
    const cypressContact = this.getCypressContactById( firebaseUid );
    if ( cypressContact ) {
      return of( cypressContact );
    }
    const user = this.auth.currentUser;

    if ( !user ) {
      this.logger.error( 'No authenticated user found for tenant override check.' );
      return of( null );
    }

    if ( environment.multiTenant ) {
      return new Observable<Contact | null>( observer => {
        runInInjectionContext( this.injector, async () => {
          try {
            const tenantId = await this.resolveCurrentTenantId( user );
            if ( !tenantId ) {
              observer.next( null );
              return;
            }

            const contactRef = doc( this.firestore, `tenants/${tenantId}/contacts/${firebaseUid}` );
            const docSnapshot = await getDoc( contactRef );
            if ( docSnapshot.exists() ) {
              const contact = docSnapshot.data() as Contact;
              this.loggedInContactInfo = contact;
              this.cacheTenantId( String( contact.tenantId || tenantId || '' ).trim() || tenantId );
              observer.next( contact );
            } else {
              observer.next( null );
            }
          } catch ( error ) {
            this.logger.error( 'Error fetching contact by Firebase UID:', error );
            observer.next( null );
          } finally {
            observer.complete();
          }
        } );
      } );
    } else {
      const contactsRef = collection( this.firestore, 'contacts' );
      const q = query( contactsRef, where( 'loginID', '==', firebaseUid ) );
      return ( collectionData( q, { idField: 'id' } ) as Observable<Contact[]> ).pipe(
        map( contacts => contacts.length > 0 ? contacts[0] : null ),
        catchError( error => {
          this.logger.error( 'Error fetching contact by Firebase UID:', error );
          return of( null );
        } )
      );
    }
  }

  /**
   * Normalizes common record state fields for Contact writes.
   * - dateAdded: set once if missing
   * - lastUpdated/lastViewed: always updated
   * - timeStamp: always set (Firestore will store as Timestamp)
   * - tenantId: only set if missing (never overwrite an explicit tenantId such as Taliferro master)
   */
  private applyRecordStateToContact ( contact: any, tenantId?: string ): void {
    if ( !contact ) return;

    // Preserve existing dateAdded if present
    if ( !contact.dateAdded ) {
      contact.dateAdded = new Date().toISOString();
    }

    contact.lastUpdated = new Date().toISOString();
    contact.lastViewed = new Date().toISOString();
    contact.timeStamp = new Date();

    // Never overwrite an explicit tenantId (important for master-tenant mirrors)
    if ( environment.multiTenant && tenantId && !contact.tenantId ) {
      contact.tenantId = tenantId;
    }

    const phoneValues = [
      ...( Array.isArray( contact.phoneNumbers ) ? contact.phoneNumbers.map( ( item: any ) => item?.phoneNumber ) : [] ),
      ...( Array.isArray( contact.company?.phoneNumbers ) ? contact.company.phoneNumbers.map( ( item: any ) => item?.phoneNumber ) : [] )
    ];
    contact.phoneLookupKeys = buildPhoneLookupKeys( phoneValues );
  }

  private sanitizeFirestorePayload<T> ( value: T ): T {
    if ( value === undefined ) {
      return undefined as T;
    }

    if ( value === null ) {
      return value;
    }

    if (
      value instanceof Date ||
      typeof value !== 'object'
    ) {
      return value;
    }

    if ( Array.isArray( value ) ) {
      return value
        .map( ( item ) => this.sanitizeFirestorePayload( item ) )
        .filter( ( item ) => item !== undefined ) as T;
    }

    const candidate = value as Record<string, unknown>;
    const hasPlainObjectPrototype =
      Object.getPrototypeOf( candidate ) === Object.prototype ||
      Object.getPrototypeOf( candidate ) === null;

    if ( !hasPlainObjectPrototype ) {
      return value;
    }

    const sanitizedEntries = Object.entries( candidate )
      .map( ( [key, entryValue] ) => [key, this.sanitizeFirestorePayload( entryValue )] as const )
      .filter( ( [, entryValue] ) => entryValue !== undefined );

    return Object.fromEntries( sanitizedEntries ) as T;
  }

  public clearAll (): void {
    this.loggedInContactInfo = null;
  }

  private isSayItContext (): boolean {
    try {
      const path = ( window.location?.pathname || '' ).toLowerCase();
      const hostname = ( window.location?.hostname || '' ).toLowerCase();
      return path.includes( 'sayit' )
        || path.includes( 'say-it' )
        || hostname === 'sayit.taliferro.tech'
        || hostname === 'todd-sayit.web.app';
    } catch {
      return false;
    }
  }

  private sayItNull<T> ( method: string ): Observable<T | null> {
    this.logger.warn( `UserService.${method} skipped: SayIt context.` );
    return of( null );
  }

  private sayItNoop ( method: string ): Observable<void> {
    this.logger.warn( `UserService.${method} skipped: SayIt context.` );
    return of( void 0 );
  }

  private sayItNotSupported<T> ( method: string ): Observable<T> {
    this.logger.warn( `UserService.${method} blocked: SayIt context.` );
    return throwError( () => new Error( `UserService.${method} is not available in SayIt context.` ) );
  }

}
