import {
  Injectable,
  OnDestroy,
  runInInjectionContext,
  Injector,
  NgZone,
} from '@angular/core';
import {
  Auth,
  updateProfile,
  updateEmail,
  createUserWithEmailAndPassword,
  signInWithEmailLink,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  ActionCodeSettings,
  authState,
  signOut,
  User,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithCustomToken,
} from '@angular/fire/auth';
import { Observable, Subscription, from, of, throwError, merge, Subject } from 'rxjs';

import { environment } from '../../environments/environment';
import { LoggerService } from './logger.service';
import { catchError, distinctUntilChanged, map, switchMap, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import firebase from 'firebase/compat/app';
import {
  Firestore,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
} from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';

import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  OAuthProvider,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
  ActionCodeSettings as FirebaseActionCodeSettings,
  ConfirmationResult,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { GuidedTourService } from './guided-tour.service';


@Injectable( {
  providedIn: 'root',
} )
export class AuthService implements OnDestroy {
  url = environment.PLATFORM_URL;
  config = environment.firebaseConfig;
  private readonly tenantStorageKey = 'todd_active_tenant_id';
  getUserSubscription!: Subscription;
  private _buyOption!: string;
  private _plan!: string;
  private _billingCycle!: string;
  private _audience!: string;

  private _amount!: string;

  private _stripeSessionId!: string;

  private _stripePriceId!: string;

  private recaptchaVerifier!: RecaptchaVerifier;
  private recaptchaElementId: string | null = null;
  message!: string;
  private showOutageBanner: boolean = false;
  private userMetaData!: any;

  paid = environment.paid;
  private userLoggedIn = new BehaviorSubject<boolean>( false );
  private readonly userRefresh = new Subject<any>();

  authState: any;
  multiTenant = environment.multiTenant;

  private isRealFirebaseCypress (): boolean {
    try {
      return window.localStorage?.getItem( '__useRealFirebaseAuth' ) === 'true';
    } catch {
      return false;
    }
  }

  private getCypressAuthOverride (): { uid: string; tenantId: string | null; email: string | null; } | null {
    if ( typeof window === 'undefined' || !( window as any ).Cypress || this.isRealFirebaseCypress() ) {
      return null;
    }

    try {
      const raw = window.localStorage.getItem( '__cypressAuthOverride' );
      if ( !raw ) {
        return null;
      }

      const parsed = JSON.parse( raw );
      if ( !parsed || typeof parsed.uid !== 'string' || !parsed.uid.trim() ) {
        return null;
      }

      return {
        uid: parsed.uid.trim(),
        tenantId: typeof parsed.tenantId === 'string' && parsed.tenantId.trim()
          ? parsed.tenantId.trim()
          : parsed.uid.trim(),
        email: typeof parsed.email === 'string' && parsed.email.trim()
          ? parsed.email.trim()
          : null,
      };
    } catch {
      return null;
    }
  }

  private getCachedTenantId (): string | null {
    if ( typeof window === 'undefined' ) return null;

    try {
      const value = window.localStorage.getItem( this.tenantStorageKey );
      return value ? value.trim() || null : null;
    } catch {
      return null;
    }
  }

  private cacheTenantId ( tenantId: string | null | undefined ): void {
    if ( typeof window === 'undefined' ) return;

    try {
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

  private async resolveAssignedTenantId ( user: User | null ): Promise<string | null> {
    if ( !user ) {
      this.cacheTenantId( null );
      return null;
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
      this.logger.warn( 'AuthService.resolveAssignedTenantId: falling back to auth uid', error );
      this.cacheTenantId( user.uid );
      return user.uid;
    }
  }

  constructor (
    private firestore: Firestore,
    public auth: Auth,
    private logger: LoggerService,
    private router: Router,
    private injector: Injector,
    private zone: NgZone,
    private guidedTourService: GuidedTourService
  ) {
    try {
      this.checkUserLoggedIn();
    } catch ( error ) {
      if (
        ( typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          ( error as any ).code === 'auth/missing-project-id' ) ||
        ( error as any ).code === 'auth/network-request-failed'
      ) {
        this.showOutageBanner = true;
        this.logger.error( 'User Not logged In' );
      }
    }
  }

  /**
   * A lifecycle hook that is called when the component is destroyed.
   * Used to perform any necessary cleanup, such as unsubscribing from any subscriptions to avoid memory leaks.
   */
  ngOnDestroy (): void {
    if ( this.getUserSubscription ) this.getUserSubscription.unsubscribe();
  }

  /**
   * Checks if the Google Cloud service is down.
   * @returns {boolean} A boolean indicating whether the outage banner should be shown or not.
   */
  isGoogleCloudDown (): boolean {
    return this.showOutageBanner;
  }

  /**
   * Checks if a user is logged in and updates the userLoggedIn observable.
   * Unsubscribes from any existing getUserSubscription before re-subscribing
   * to the getUser() observable to listen for changes in the user's authentication state.
   */
  private checkUserLoggedIn () {
    if ( this.getUserSubscription ) this.getUserSubscription.unsubscribe();

    this.getUserSubscription = this.getUser().subscribe( ( user ) => {
      this.zone.run( () => {
        this.userLoggedIn.next( !!user );
      } );
    } );
  }

  /**
   * Initiates the process of sending a sign-up link to the specified email.
   * Stores the email in localStorage and returns an Observable that will
   * contain the result of the email sending operation.
   *
   * @param email - The email address to which the sign-up link will be sent.
   * @returns An Observable that emits when the link has been sent.
   */
  sendSignupLink ( email: string ): Observable<void> {
    const actionCodeSettings: ActionCodeSettings = {
      url: this.url + '/finish-sign-up',
      handleCodeInApp: true,
    };

    localStorage.setItem( 'emailForSignUp', email );
    return from( sendSignInLinkToEmail( this.auth, email, actionCodeSettings ) );
  }

  /**
   * Triggers sending a waitlist sign-in link to a specified email address.
   *
   * The function stores the email in local storage for later retrieval,
   * and constructs the action code settings to define the URL to which
   * the user will be redirected after completing the waitlist process
   * and to ensure the sign-in link is handled within the app.
   *
   * @param {string} email - The email address to which the sign-in link will be sent.
   * @returns {Observable<void>} An observable that completes when the email has been sent.
   */
  sendWaitlistLink ( email: string ): Observable<void> {
    const actionCodeSettings: ActionCodeSettings = {
      url: this.url + '/finish-waitlist',
      handleCodeInApp: true,
    };

    localStorage.setItem( 'emailForWaitlist', email );
    return from( sendSignInLinkToEmail( this.auth, email, actionCodeSettings ) );
  }

  /**
   * Checks if a user is currently logged in.
   * @returns {boolean} True if a user is logged in, false otherwise.
   */
  checkLogin (): boolean {
    return this.auth.currentUser != null;
  }

  /**
   * Attempts to verify a sign-in with an email link for the current user.
   *
   * If the URL matches an email sign-in link, prompts the user for their email if it's
   * not already stored, then tries to sign them in using the provided email and link.
   * On successful sign-in, removes the stored email from local storage and returns the
   * user. If the link is not valid for sign-in, resolves the returned observable with null.
   *
   * @returns {Observable<User | null>} An observable emitting the signed-in user or null.
   */
  verifyLink (): Observable<User | null> {
    if ( isSignInWithEmailLink( this.auth, window.location.href ) ) {
      let email = window.localStorage.getItem( 'emailForSignIn' );
      if ( !email ) {
        email = window.prompt( 'Please provide your email for confirmation' );
      }
      return from(
        signInWithEmailLink( this.auth, email!, window.location.href ).then(
          ( { user } ) => {
            window.localStorage.removeItem( 'emailForSignIn' );
            return user;
          }
        )
      );
    } else {
      return from( Promise.resolve( null ) );
    }
  }

  /**
   * Initiates the process of sending a sign-in link to the provided email.
   * Before sending, it stores the email in localStorage under 'emailForSignIn'.
   * The method utilizes Firebase Auth to generate the sign-in link, which
   * redirects to a specified URL upon completion of the sign-in process.
   * If an error occurs during the sending process, it is logged and
   * re-thrown to be handled by subscribers of the returned Observable.
   *
   * @param {string} email The email address to which the sign-in link will be sent.
   * @returns {Observable<void>} An Observable that completes when the link has been sent, or errors if sending fails.
   */
  sendLoginLink ( email: string ): Observable<void> {
    return this.sendLoginLinkWithRedirect( email, `${this.url}/finish-sign-in` );
  }

  sendLoginLinkWithRedirect ( email: string, redirectUrl: string ): Observable<void> {
    // Store the email in localStorage right before sending the link
    localStorage.setItem( 'emailForSignIn', email );
    const actionCodeSettings: firebase.auth.ActionCodeSettings = {
      // URL you want to redirect back to. The domain (www.example.com) for this
      // URL must be in the authorized domains list in the Firebase this.logger.
      url: redirectUrl,
      handleCodeInApp: true,
    };

    return from(
      sendSignInLinkToEmail( this.auth, email, actionCodeSettings )
    ).pipe(
      catchError( ( error ) => {
        this.logger.error( 'Error in sending sign-in link:', error );
        // You might also want to log this error to an external logging service if you have one
        throw error; // Re-throw the error so that subscribers to this Observable can handle it
      } )
    );
  }

  sendTenantInviteLoginLink ( email: string, inviteId: string, tenantId: string ): Observable<void> {
    const redirectUrl =
      `${this.url}/finish-sign-in?inviteId=${encodeURIComponent( inviteId )}&tenantId=${encodeURIComponent( tenantId )}&email=${encodeURIComponent( email )}`;
    if ( typeof window !== 'undefined' && !!( window as any ).Cypress && !this.isRealFirebaseCypress() ) {
      localStorage.setItem( 'todd_lastSignInRedirectUrl', redirectUrl );
      return of( void 0 );
    }
    return this.sendLoginLinkWithRedirect( email, redirectUrl );
  }

  sendTenantInviteEmail ( email: string, inviteId: string, tenantId: string ): Observable<void> {
    if ( typeof window !== 'undefined' && !!( window as any ).Cypress && !this.isRealFirebaseCypress() ) {
      localStorage.setItem( 'todd_lastTenantInviteEmail', JSON.stringify( {
        email,
        inviteId,
        tenantId
      } ) );
      return of( void 0 );
    }

    return from( ( async () => {
      const user = this.auth.currentUser;
      if ( !user ) {
        throw new Error( 'You must be signed in to send invites.' );
      }

      const idToken = await user.getIdToken( true );
      const response = await fetch( `${environment.backendURL}/public/auth/send-tenant-invite-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify( {
          idToken,
          inviteId,
          tenantId,
          email
        } )
      } );

      const payload = await response.json().catch( () => ( {} ) );
      if ( !response.ok || !payload?.success ) {
        throw new Error( payload?.message || 'Unable to send tenant invite email.' );
      }
    } )() );
  }

  /**
   * Exchanges the current session for a Firebase custom token a native app
   * can redeem, handing it back through the fixed callback scheme
   * todd-backend's MOBILE_AUTH_CLIENTS allowlist maps `client` to
   * (authAccessRoutes.js) - LoginComponent is the only caller, used when a
   * TODDAuthKit HostedLogin session opened this page for a mobile app
   * rather than a browser tab.
   */
  async exchangeForMobileSessionToken ( client: string ): Promise<{ customToken: string; redirectUri: string }> {
    const user = this.auth.currentUser;
    if ( !user ) {
      throw new Error( 'You must be signed in to complete this sign-in.' );
    }

    const idToken = await user.getIdToken( true );
    const response = await fetch( `${environment.backendURL}/public/auth/mobile-session-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify( { idToken, client } )
    } );

    const payload = await response.json().catch( () => ( {} ) );
    if ( !response.ok || !payload?.success || !payload?.customToken || !payload?.redirectUri ) {
      throw new Error( payload?.message || 'Unable to complete sign-in for this app.' );
    }

    return { customToken: payload.customToken, redirectUri: payload.redirectUri };
  }

  /**
   * Sends an email containing a sign-in link to the given affiliate's email address.
   * The sign-in link directs the user back to a specific URL upon successful sign-in.
   * The email is temporarily saved in localStorage for retrieval during the sign-in process.
   *
   * @param {string} email - The email address to which the sign-in link will be sent.
   * @returns {Observable<void>} An observable that completes when the email is sent, or errors if sending fails.
   */
  sendAffiliateLoginLink ( email: string ): Observable<void> {
    // Store the email in localStorage right before sending the link
    localStorage.setItem( 'emailForSignIn', email );
    const actionCodeSettings: firebase.auth.ActionCodeSettings = {
      // URL you want to redirect back to. The domain (www.example.com) for this
      // URL must be in the authorized domains list in the Firebase this.logger.
      url: `${this.url}/finish-affiliate-sign-in`, // Adjust this URL to your application
      handleCodeInApp: true,
    };

    return from(
      sendSignInLinkToEmail( this.auth, email, actionCodeSettings )
    ).pipe(
      catchError( ( error ) => {
        this.logger.error( 'Error in sending Affiliate sign-in link:', error );
        // You might also want to log this error to an external logging service if you have one
        throw error; // Re-throw the error so that subscribers to this Observable can handle it
      } )
    );
  }

  /**
   * Mobile browsers (particularly iOS Safari) frequently block or kill
   * `signInWithPopup`'s window.open regardless of gesture timing, so
   * provider sign-in uses a full-page redirect there instead. Desktop
   * keeps the popup flow since it doesn't leave the page.
   */
  isMobileDevice (): boolean {
    return /Android|iPhone|iPad|iPod/i.test( navigator.userAgent );
  }

  /**
   * Signs in a user using Google authentication.
   * On success, returns the signed-in user object. On mobile, this instead
   * starts a full-page redirect and returns null; the redirect result is
   * picked up by `checkRedirectResult()` after the page reloads.
   * On failure, logs the error and rethrows it.
   * @returns {Promise<User | null>} A promise that resolves to the signed-in user or null.
   */
  async signInWithGoogle (): Promise<User | null> {
    const googleProvider = new GoogleAuthProvider();

    try {
      if ( this.isMobileDevice() ) {
        await signInWithRedirect( this.auth, googleProvider );
        return null;
      }
      const result = await signInWithPopup( this.auth, googleProvider );
      return result.user;
    } catch ( error ) {
      this.logger.error( 'Error during Google sign-in:', error );
      throw error;
    }
  }

  /**
   * Attempts to sign in a user via Yahoo OAuth provider.
   * If sign-in is successful, validates the user and returns the user object.
   * On failure, logs the error, navigates to the error route, and returns null.
   *
   * @returns {Promise<User | null>} A promise that resolves to the user object if successful, or null if sign-in fails.
   */
  async signInWithYahoo (): Promise<User | null> {
    const provider = new OAuthProvider( 'yahoo.com' );

    try {
      const result = await signInWithPopup( this.auth, provider );
      // const credential = OAuthProvider.credentialFromResult(result);
      // const accessToken = credential?.accessToken || null;
      // const idToken = credential?.idToken || null;

      this.validUser( result.user ); // Assuming this is a method that you want to call after a valid user is retrieved.

      return result.user;
    } catch ( error ) {
      this.logger.error( 'Error during Yahoo sign-in:', error );
      this.router.navigate( ['/error'] );
      return null;
    }
  }

  /**
   * Initiates a sign-in flow using Microsoft as OAuth provider.
   *
   * This method creates a new OAuthProvider instance for Microsoft, sets a custom parameter to
   * prompt users to select an account, and attempts to sign in with a popup window. If successful,
   * the user information is returned; otherwise, an error is logged and a redirect to an error page
   * is performed.
   *
   * @returns {Promise<User | null>} The User object on successful sign-in, or null if sign-in fails.
   */
  async signInWithMicrosoft (): Promise<User | null> {
    const provider = new OAuthProvider( 'microsoft.com' );
    provider.setCustomParameters( {
      prompt: 'select_account',
    } );

    try {
      const result = await signInWithPopup( this.auth, provider );
      // const credential = OAuthProvider.credentialFromResult(result);
      // const accessToken = credential?.accessToken || null;
      // const idToken = credential?.idToken || null;

      return result.user;
    } catch ( error ) {
      this.logger.error( 'Error during Microsoft sign-in:', error );
      this.router.navigate( ['/error'] );
      return null;
    }
  }

  /**
   * Attempts to sign in a user using email and password.
   * On success, returns the authenticated user's data.
   * On failure, logs the error, alerts the user, redirects to the login page, and returns null.
   * @param email - The user's email address.
   * @param password - The user's password.
   * @returns A promise that resolves to the User object on success or null on failure.
   */
  async signInWithEmailPassword (
    email: string,
    password: string
  ): Promise<User | null> {
    try {
      const result = await signInWithEmailAndPassword(
        this.auth,
        email,
        password
      );
      return result.user;
    } catch ( err: unknown ) {
      const friendly = this.authErrorMessage( err );
      // Prefer showing inline UI error rather than alert()
      // e.g., this.toast.error(friendly)
      alert( friendly );
      return null;
    }
  }

  authErrorMessage ( err: unknown ): string {
    // Default fallback
    let message = 'Unable to sign in. Please try again.';

    // Narrow to FirebaseError
    if ( err && typeof err === 'object' && 'code' in err ) {
      const code = ( err as FirebaseError ).code;

      switch ( code ) {
        case 'auth/invalid-email':
          message = 'The email address is not valid.';
          break;
        case 'auth/user-disabled':
          message =
            'This account has been disabled. Contact support if this is unexpected.';
          break;
        case 'auth/user-not-found':
          message = 'No account found with that email. Try signing up first.';
          break;
        // Firebase now commonly returns this for wrong email or password:
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
          message =
            'Incorrect email or password. Try again or reset your password.';
          break;
        case 'auth/too-many-requests':
          message =
            'Too many failed attempts. Wait a few minutes or reset your password.';
          break;
        case 'auth/operation-not-allowed':
          message = 'Password sign-in is not enabled. Contact support.';
          break;
        default:
          message =
            'Unable to sign in. Try again or use the secure sign-in link.';
          break;
      }
    }

    return message;
  }

  /**
   * Attempts to sign in a user via Apple as OAuth provider. Uses the same
   * `apple.com` provider id the native iOS apps authenticate through
   * (`TODDAuthKit.AppleSignIn`), so a person who already has an account
   * from one platform resolves to the same Firebase user on the other,
   * rather than depending on matching email addresses across providers.
   * On success, returns the signed-in user object. On mobile, this instead
   * starts a full-page redirect and returns null; the redirect result is
   * picked up by `checkRedirectResult()` after the page reloads.
   * On failure, logs the error and rethrows it so the caller can show a
   * provider-specific message.
   *
   * @returns {Promise<User | null>} A promise that resolves to the user object if successful.
   */
  async signInWithApple (): Promise<User | null> {
    const provider = new OAuthProvider( 'apple.com' );
    provider.addScope( 'email' );
    provider.addScope( 'name' );

    try {
      if ( this.isMobileDevice() ) {
        await signInWithRedirect( this.auth, provider );
        return null;
      }
      const result = await signInWithPopup( this.auth, provider );
      this.validUser( result.user );
      return result.user;
    } catch ( error ) {
      this.logger.error( 'Error during Apple sign-in:', error );
      throw error;
    }
  }

  /**
   * Picks up the result of a mobile `signInWithRedirect()` call after the
   * page reloads back from the provider. Returns null if the page load
   * wasn't a redirect return (the normal case for every other page visit).
   * On failure, logs the error and rethrows it so the caller can show a
   * provider-specific message, matching signInWithApple/signInWithGoogle.
   * @returns {Promise<User | null>} The signed-in user, or null if this load isn't a redirect return.
   */
  async checkRedirectResult (): Promise<User | null> {
    try {
      const result = await getRedirectResult( this.auth );
      return result?.user ?? null;
    } catch ( error ) {
      this.logger.error( 'Error resolving redirect sign-in result:', error );
      throw error;
    }
  }

  /**
   * Checks if the provided user is deemed valid under single tenant environments by verifying
   * if the user's email is included in the list of authorized emails. Updates message for valid
   * users or navigates to a 'not authorized' route for invalid users.
   * @param {any} user - The user object to validate.
   */
  validUser ( user: any ) {
    if ( !environment.multiTenant ) {
      if (
        user &&
        user.email
      ) {
        this.message = 'User OK to proceed';
      } else {
        this.router.navigate( ['/not-authorized'] );
      }
    }
  }

  /**
   * Initiates a sign-in flow using a popup with the specified auth provider.
   * Upon successful authentication, it processes the result to extract the user
   * information, Google Access Token, and validates the user. If sign-in fails,
   * it captures and processes the error information.
   *
   * @param {any} provider The authentication provider (e.g., Google, Facebook) to authenticate with.
   */
  loginService ( provider: any ) {
    signInWithPopup( this.auth, provider )
      .then( ( result ) => {
        // This gives you a Google Access Token. You can use it to access the Google API.
        // const credential = GoogleAuthProvider.credentialFromResult(result);
        // const token = credential ? credential.accessToken : null;
        // The signed-in user info.
        const user = result.user;
        this.validUser( user );
        // IdP data available using getAdditionalUserInfo(result)
        // ...
      } )
      .catch( ( error ) => {
        this.logger.error( error );
        // Handle Errors here.
        // const errorCode = error.code;
        // const errorMessage = error.message;
        // The email of the user's account used.
        // const email = error.customData.email;
        // The AuthCredential type that was used.
        // const credential = GoogleAuthProvider.credentialFromError(error);
        // ...
      } );
  }

  /**
   * Initiates the process of sending a password reset link to the given email.
   * Resolves on success and rejects on failure; callers own presenting feedback to the user.
   * @param email The email address to which the password reset link will be sent.
   */
  sendPasswordResetLink ( email: string ) {
    const startedAt = performance.now();
    const addrRaw = ( email || '' ).trim();
    const addr = addrRaw;

    // Mask email in logs: j***@d***.com
    const maskEmail = ( e: string ) => {
      const [user, domain] = e.split( '@' );
      if ( !user || !domain ) return 'invalid-email';
      const userMasked = user.length > 1 ? user[0] + '***' : '*';
      const [host, ...tldParts] = domain.split( '.' );
      const hostMasked = host ? host[0] + '***' : '*';
      const tld = tldParts.join( '.' ) || '';
      return `${userMasked}@${hostMasked}${tld ? '.' + tld : ''}`;
    };

    this.logger.info( 'sendPasswordResetLink: start', {
      email: maskEmail( addr ),
      href: typeof window !== 'undefined' ? window.location.href : undefined,
    } );

    // Set the language (so email template uses device language)
    try {
      ( this.auth as any ).languageCode = navigator.language || 'en';
    } catch { }

    // Optional continue URL; adjust route if you handle reset in-app
    const actionSettings: FirebaseActionCodeSettings = {
      url: `${this.url}/finish-password-reset`,
      handleCodeInApp: true,
    };

    // Check if an account exists for this email (for diagnostics only; do not surface raw result to user)
    const p = fetchSignInMethodsForEmail( this.auth, addr )
      .then( ( methods ) => {
        this.logger.info( 'sendPasswordResetLink: signInMethods', {
          email: maskEmail( addr ),
          methods,
        } );
        // Proceed to send reset email regardless to avoid account enumeration in UI
        return sendPasswordResetEmail( this.auth, addr, actionSettings );
      } )
      .then( () => {
        const ms = Math.round( performance.now() - startedAt );
        this.logger.info( 'sendPasswordResetLink: success', {
          email: maskEmail( addr ),
          durationMs: ms,
        } );
      } )
      .catch( ( error ) => {
        const ms = Math.round( performance.now() - startedAt );
        this.logger.error( 'sendPasswordResetLink: failure', {
          email: maskEmail( addr ),
          durationMs: ms,
          code: ( error as any )?.code,
          message: ( error as any )?.message,
        } );
        throw error; // rethrow so callers can detect failure and present it
      } );

    return p;
  }

  /**
   * Completes the sign-in process for a user that has been sent an email sign-in link.
   * If the multi-tenant environment is enabled, defers to `completeTenantSignInWithEmailLink`.
   * Otherwise, verifies the link before completing the sign-in process.
   *
   * @param {string} email The email address of the user.
   * @param {string} url The URL of the sign-in link.
   * @returns {Observable<any>} An observable that emits the sign-in result.
   * @throws Error if the link provided is invalid.
   */
  completeSignInWithEmailLink ( email: string, url: string ): Observable<any> {
    if ( typeof window !== 'undefined' && !!( window as any ).Cypress && !this.isRealFirebaseCypress() ) {
      const raw = window.localStorage.getItem( '__cypressEmailLinkSignInTarget' );
      if ( !raw ) {
        return throwError( () => new Error( 'Invalid link' ) );
      }

      try {
        const parsed = JSON.parse( raw );
        if ( !parsed?.uid || !parsed?.email ) {
          return throwError( () => new Error( 'Invalid link' ) );
        }

        return of( {
          user: {
            uid: parsed.uid,
            email: parsed.email
          } as User
        } );
      } catch ( error ) {
        return throwError( () => error );
      }
    }

    if ( environment.multiTenant ) {
      return this.completeTenantSignInWithEmailLink( email, url );
    } else {
      if ( isSignInWithEmailLink( this.auth, url ) ) {
        return from( signInWithEmailLink( this.auth, email, url ) );
      } else {
        throw new Error( 'Invalid link' );
      }
    }
  }

  /**
   * Completes affiliate sign-in with email link. If multi-tenant environment is enabled,
   * it delegates to the appropriate method for handling multi-tenant sign-ins; otherwise,
   * it proceeds with normal sign-in flow.
   *
   * @param email - The email of the user trying to sign in.
   * @param url - The URL used to complete the sign-in process.
   * @returns Observable resolving to sign-in result or error.
   * @throws Will throw an error if the URL is not a valid sign-in link.
   */
  completeAffiliateSignInWithEmailLink (
    email: string,
    url: string
  ): Observable<any> {
    if ( environment.multiTenant ) {
      return this.completeAffiliateTenantSignInWithEmailLink( email, url );
    } else {
      if ( isSignInWithEmailLink( this.auth, url ) ) {
        return from( signInWithEmailLink( this.auth, email, url ) );
      } else {
        throw new Error( 'Invalid link' );
      }
    }
  }

  /**
   * Completes the sign-in process for a reseller using an email link. If the environment supports multi-tenancy,
   * it delegates the process to completeResellerTenantSignInWithEmailLink. Otherwise, it checks if the provided
   * URL is a valid sign-in link and attempts to sign in using email and URL. Throws an error if the link is invalid.
   * @param email - The email address of the reseller attempting to sign in.
   * @param url - The URL used for sign-in, which should contain a sign-in link.
   * @returns An Observable that resolves upon successful sign-in or throws an error for an invalid link.
   */
  completeResellerSignInWithEmailLink (
    email: string,
    url: string
  ): Observable<any> {
    if ( environment.multiTenant ) {
      return this.completeResellerTenantSignInWithEmailLink( email, url );
    } else {
      if ( isSignInWithEmailLink( this.auth, url ) ) {
        return from( signInWithEmailLink( this.auth, email, url ) );
      } else {
        throw new Error( 'Invalid link' );
      }
    }
  }

  /**
   * Completes the sign-up process for a tenant using an email link.
   * It authenticates the user, creates a new tenant document with the user's UID as the tenantId,
   * logs the attempt to create a contact reference, and throws an error if sign-in fails.
   *
   * @param {string} email - The email address of the tenant.
   * @param {string} url - The sign-in email link.
   * @returns {Observable<any>} An observable that resolves with the authentication result.
   */
  completeTenantSignUpWithEmailLink (
    email: string,
    url: string
  ): Observable<any> {
    const authInstance = getAuth();

    if ( isSignInWithEmailLink( authInstance, url ) ) {
      return from(
        signInWithEmailLink( authInstance, email, url )
          .then( async ( result ) => {
            const user = result.user;
            if ( user ) {
              await user.getIdToken( true );
              const tenantId = user.uid; // Use Firebase UID as tenant ID
              const claims = { tenantId };

              const tenantRef = doc( this.firestore, `tenants/${tenantId}` );

              await setDoc( tenantRef, claims );

              let referralCode = localStorage.getItem( 'referralCode' );
              referralCode = referralCode ? referralCode : '';

              // Log contact creation attempt
              const contactRef = doc(
                this.firestore,
                `tenants/${tenantId}/contacts/${user.uid}`
              );
              const contactData = {
                email: user.email,
                subscriber: true,
                type: 'subscriber',
                acquisitionSource: 'sign-up',
                referral: referralCode,
                tenantId: tenantId,
                loginID: user.uid,
                dateAdded: new Date().toISOString(),
                timeStamp: new Date(),
              };

              await setDoc( contactRef, contactData, { merge: true } );
            } else {
              this.message = 'No user found.';
            }

            return result;
          } )
          .catch( ( error ) => {
            this.logger.error( 'Error during sign-in with email link:', error );
            throw error;
          } )
      );
    } else {
      this.logger.error( 'Invalid sign-in link.' );
      throw new Error( 'Invalid link' );
    }
  }

  /**
   * Completes the user sign-up process for a waitlist using an email link.
   * @param email The email address used during the initial sign-up.
   * @param url The unique sign-in link sent to the user's email.
   * @returns {Observable<any>} An observable that emits the result of the sign-in process.
   * @throws Will throw an error if the sign-in link is invalid or if the sign-in process fails.
   */
  completeWaitListSignUpWithEmailLink (
    email: string,
    url: string
  ): Observable<any> {
    const authInstance = getAuth();

    if ( isSignInWithEmailLink( authInstance, url ) ) {
      return from(
        signInWithEmailLink( authInstance, email, url )
          .then( async ( result ) => {
            return result;
          } )
          .catch( ( error ) => {
            this.logger.error(
              'Error during Waitlist sign-up with email link:',
              error
            );
            throw error;
          } )
      );
    } else {
      this.logger.error( 'Invalid waitlist sign-up link.' );
      throw new Error( 'Invalid link' );
    }
  }

  /**
   * Completes the sign-in process for a tenant using an email link.
   * Verifies if the provided url is a valid sign-in link and if so, signs in the user,
   * obtaining a token, setting up tenant and contact information in the Firestore.
   * Also handles referral codes if present in local storage.
   *
   * @param {string} email - The email address of the user attempting to sign in.
   * @param {string} url - The email link used for signing in.
   * @returns {Observable<any>} An observable that resolves with the sign-in result or errors out.
   */
  completeTenantSignInWithEmailLink (
    email: string,
    url: string
  ): Observable<any> {
    if ( isSignInWithEmailLink( this.auth, url ) ) {
      return from(
        signInWithEmailLink( this.auth, email, url )
          .then( async ( result ) => {
            const user = result.user;
            if ( user ) {
              await user.getIdToken( true );
              const tenantId = user.uid; // Use Firebase UID as tenant ID
              const claims = { tenantId };

              const tenantRef = doc( this.firestore, `tenants/${tenantId}` );

              await setDoc( tenantRef, claims );

              let referralCode = localStorage.getItem( 'referralCode' );
              referralCode = referralCode ? referralCode : '';

              const contactRef = doc(
                this.firestore,
                `tenants/${tenantId}/contacts/${user.uid}`
              );
              const contactData = {
                email: user.email,
                subscriber: true,
                type: 'subscriber',
                acquisitionSource: 'sign-up',
                referral: referralCode,
                tenantId: tenantId,
                loginID: user.uid,
                dateAdded: new Date().toISOString(),
                timeStamp: new Date(),
              };

              await setDoc( contactRef, contactData, { merge: true } );
            } else {
              throw new Error( 'No user found after sign-in' );
            }

            return result;
          } )
          .catch( ( error ) => {
            console.error( 'Error during sign-up with email link:', error );
            throw error;
          } )
      );
    } else {
      return throwError( () => new Error( 'Invalid sign-up link.' ) );
    }
  }

  /**
   * Completes the sign-in process for an affiliate tenant user using an email link.
   * It confirms the sign-in link, signs in the user, sets tenant-specific claims,
   * and updates tenant and contact information in Firestore.
   * If the sign-in link is invalid or no user is found after sign-in, errors are logged.
   *
   * @param {string} email The email address of the user attempting to sign in.
   * @param {string} url The URL containing the sign-in email link.
   * @returns {Observable<any>} An observable that resolves with the sign-in result or rejects with an error.
   */
  completeAffiliateTenantSignInWithEmailLink (
    email: string,
    url: string
  ): Observable<any> {
    if ( isSignInWithEmailLink( this.auth, url ) ) {
      return from(
        signInWithEmailLink( this.auth, email, url )
          .then( async ( result ) => {
            const user = result.user;
            if ( user ) {
              await user.getIdToken( true );
              const tenantId = user.uid; // Use Firebase UID as tenant ID
              const claims = { tenantId };

              const tenantRef = doc( this.firestore, `tenants/${tenantId}` );

              await setDoc( tenantRef, claims );

              let referralCode = localStorage.getItem( 'referralCode' );
              referralCode = referralCode ? referralCode : '';

              const contactRef = doc(
                this.firestore,
                `tenants/${tenantId}/contacts/${user.uid}`
              );
              const contactData = {
                email: user.email,
                tenantId: tenantId,
                loginID: user.uid,
                dateAdded: new Date().toISOString(),
                timeStamp: new Date(),
              };

              await setDoc( contactRef, contactData, { merge: true } );
            } else {
              throw new Error( 'Complete Affiliate Tenant Sign In With Email Link - No user found.' );
            }

            return result;
          } )
          .catch( ( error ) => {
            console.error(
              'Complete Affiliate Tenant Sign In With Email Link - Error during sign-up with email link:',
              error
            );
            throw error;
          } )
      );
    } else {
      return throwError( () => new Error( 'Invalid sign-up link.' ) );
    }
  }

  /**
   * Completes the sign-in process for a reseller's tenant using an email link.
   * @param {string} email User's email address for authenticating.
   * @param {string} url The URL containing the sign-in link.
   * @returns {Observable<any>} An observable that resolves with the authentication result.
   */
  completeResellerTenantSignInWithEmailLink (
    email: string,
    url: string
  ): Observable<any> {
    if ( isSignInWithEmailLink( this.auth, url ) ) {
      return from(
        signInWithEmailLink( this.auth, email, url )
          .then( async ( result ) => {
            const user = result.user;
            if ( user ) {
              await user.getIdToken( true );
              const tenantId = user.uid; // Use Firebase UID as tenant ID
              const claims = { tenantId };

              const tenantRef = doc( this.firestore, `tenants/${tenantId}` );

              await setDoc( tenantRef, claims );

              let referralCode = localStorage.getItem( 'referralCode' );
              referralCode = referralCode ? referralCode : '';

              const contactRef = doc(
                this.firestore,
                `tenants/${tenantId}/contacts/${user.uid}`
              );
              const contactData = {
                email: user.email,
                tenantId: tenantId,
                loginID: user.uid,
                dateAdded: new Date().toISOString(),
                timeStamp: new Date(),
              };

              await setDoc( contactRef, contactData, { merge: true } );
            } else {
              throw new Error( 'Complete Reseller Sign In With Email Link - No user found.' );
            }

            return result;
          } )
          .catch( ( error ) => {
            console.error(
              'Complete Reseller Tenant Sign In With Email Link - Error during sign-up with email link:',
              error
            );
            throw error;
          } )
      );
    } else {
      return throwError( () => new Error( 'Invalid sign-up link.' ) );
    }
  }

  /**
   * Retrieves the current user's authentication state as an observable stream.
   * It subscribes to the user's auth state changes and propagates those changes to
   * the observers of this observable. This function ensures the subscription occurs
   * within the proper injection context.
   * @returns {Observable<any>} An Observable that can emit the user's auth state.
   */
  getUser (): Observable<any> {
    return new Observable( ( observer ) => {
      const cypressAuthOverride = this.getCypressAuthOverride();
      if ( cypressAuthOverride ) {
        observer.next( {
          uid: cypressAuthOverride.uid,
          email: cypressAuthOverride.email,
        } );
        observer.complete();
        return;
      }

      return runInInjectionContext( this.injector, () => {
        const subscription = merge( authState( this.auth ), this.userRefresh.asObservable() ).subscribe( {
          next: ( user ) => observer.next( user ),
          error: ( err ) => observer.error( err ),
          complete: () => observer.complete(),
        } );
        return () => subscription.unsubscribe();
      } );
    } );
  }

  /**
   * Creates an Observable that emits the UID of the currently authenticated user.
   * If the user is not logged in, it emits 'user not logged in'.
   * @returns {Observable<string>} An Observable that can be subscribed to for getting the user's UID or an error message.
   */
  getUserId (): Observable<string> {
    return new Observable<string>( ( observer ) => {
      const cypressAuthOverride = this.getCypressAuthOverride();
      if ( cypressAuthOverride ) {
        observer.next( cypressAuthOverride.uid );
        observer.complete();
        return;
      }

      runInInjectionContext( this.injector, () => {
        authState( this.auth )
          .pipe(
            map( ( user ) => {
              if ( !user ) {
                return 'user not logged in';
              }
              return user.uid;
            } )
          )
          .subscribe( {
            next: ( uid ) => observer.next( uid ),
            error: ( err ) => observer.error( err ),
            complete: () => observer.complete(),
          } );
      } );
    } );
  }

  getCurrentUserIdSync (): string | null {
    const cypressAuthOverride = this.getCypressAuthOverride();
    if ( cypressAuthOverride ) {
      return cypressAuthOverride.uid;
    }

    return this.auth.currentUser?.uid ?? null;
  }

  getCurrentUserEmailSync (): string | null {
    const cypressAuthOverride = this.getCypressAuthOverride();
    if ( cypressAuthOverride?.email ) {
      return cypressAuthOverride.email.trim().toLowerCase();
    }

    const email = String( this.auth.currentUser?.email || '' ).trim().toLowerCase();
    return email || null;
  }

  /**
   * Determines if the user is currently logged in.
   * @returns {Observable<boolean>} An observable that emits the user's login status.
   */
  isLoggedIn (): Observable<boolean> {
    return this.getUser().pipe(
      map( user => !!user ),
      distinctUntilChanged()
    );
  }

  /**
   * Performs user logout, removes 'emailForSignIn' from localStorage, signs out from Firebase,
   * navigates to login page, and handles any errors that occur during the sign out process.
   * @returns {Observable<void>} An observable that completes when the navigation to login page is done.
   */
  logout (): Observable<void> {
    localStorage.removeItem( 'emailForSignIn' );
    this.cacheTenantId( null );
    this.guidedTourService.clearTour();
    return from( signOut( this.auth ) ).pipe(
      map( () => {
        this.router.navigate( ['login'] );
      } ),
      catchError( ( error ) => {
        this.logger.error( 'Logout failed:', error );
        throw error;
      } )
    );
  }

  /**
   * Updates the profile of the current authenticated user with a new display name and email.
   * Executes Firebase API calls inside Angular's injection context to avoid zone-related hydration issues.
   * If no user is currently authenticated, the function returns an observable error.
   * If a displayName or email is not provided, the corresponding profile update is skipped.
   * @param {string} displayName - The new display name for the user's profile.
   * @param {string} email - The new email for the user's profile.
   * @returns {Observable<void>} An observable that completes when the update is done or emits an error if it fails.
   */
  updateProfile ( displayName: string, email: string ): Observable<void> {
    return new Observable<void>( ( observer ) => {
      runInInjectionContext( this.injector, () => {
        const user = this.auth.currentUser;

        if ( !user ) {
          observer.error( new Error( 'No user logged in' ) );
          return;
        }

        const updateDisplayName = displayName
          ? from( updateProfile( user, { displayName } ) )
          : of( undefined );
        const updateEmailPromise = email
          ? from( updateEmail( user, email ) )
          : of( undefined );

        updateDisplayName
          .pipe(
            switchMap( () => updateEmailPromise ),
            switchMap( () => from( user.reload() ) ),
            map( () => void 0 ),
            catchError( ( error ) => {
              this.logger.error(
                'Update profile (displayName and email) failed:',
                error
              );
              return throwError( () => error );
            } )
          )
          .subscribe( {
            next: () => {
              this.userRefresh.next( this.auth.currentUser );
              observer.next();
            },
            error: ( err ) => observer.error( err ),
            complete: () => observer.complete(),
          } );
      } );
    } );
  }

  /**
   * Updates the current user's profile with the provided photo URL.
   * If the user is not logged in, it returns an error observable.
   * In case of a successful update, an Observable of void is returned.
   * Any errors during the update are logged and rethrown as an observable error.
   *
   * @param {string} photoURL The new photo URL to set for the user profile.
   * @returns {Observable<void>} An observable that completes when the update is done or emits an error if it fails.
   */
  updatePhotoURL ( photoURL: string ): Observable<void> {
    const user = this.auth.currentUser;

    if ( !user ) {
      return throwError( () => new Error( 'No user logged in' ) );
    }

    const updatePhotoURL = photoURL
      ? from( updateProfile( user, { photoURL } ) ).pipe(
        switchMap( () => from( user.reload() ) ),
        tap( () => this.userRefresh.next( this.auth.currentUser ) )
      )
      : of( undefined );

    return updatePhotoURL.pipe(
      map( () => void 0 ),
      catchError( ( error ) => {
        this.logger.error( 'Update profile photoURL failed:', error );
        return throwError( () => error );
      } )
    );
  }

  getTenantId (): Observable<string | null> {
    const multiTenant = environment.multiTenant;

    if ( !multiTenant ) {
      return of( null );
    }

    return new Observable<string | null>( ( observer ) => {
      const cypressAuthOverride = this.getCypressAuthOverride();
      if ( cypressAuthOverride ) {
        observer.next( cypressAuthOverride.tenantId );
        observer.complete();
        return;
      }

      runInInjectionContext( this.injector, () => {
        authState( this.auth )
          .pipe(
            switchMap( ( user: User | null ) => from( this.resolveAssignedTenantId( user ) ) )
          )
          .subscribe( {
            next: ( tenantId ) => observer.next( tenantId ),
            error: ( err ) => observer.error( err ),
            complete: () => observer.complete(),
          } );
      } );
    } );
  }

  /**
   * Retrieves the unique identifier (UID) of the currently authenticated tenant user.
   * If no user is currently authenticated, returns null.
   *
   * @returns {string | null} The UID of the authenticated user or null if no user is authenticated.
   */
  getTenant (): string | null {
    const multiTenant = environment.multiTenant;

    if ( !multiTenant ) {
      return null;
    }

    const cachedTenantId = this.getCachedTenantId();
    if ( cachedTenantId ) {
      return cachedTenantId;
    }

    const user = this.auth.currentUser;
    if ( !user ) {
      return null;
    }


    return user.uid;
  }

  /**
   * Completes affiliate sign-in using an email link authentication.
   *
   * @param {string} email - The email address of the user attempting to sign in.
   * @param {string} url - The sign-in link that the user is converting to a sign-in process.
   * @returns {Observable<any>} An observable that resolves with the sign-in result.
   */
  completeAffiliateSignInEmailLink (
    email: string,
    url: string
  ): Observable<any> {
    const authInstance = getAuth();

    if ( isSignInWithEmailLink( authInstance, url ) ) {
      return from(
        signInWithEmailLink( authInstance, email, url )
          .then( async ( result ) => {
            const user = result.user;
            if ( user ) {
              await user.getIdToken( true );
              const tenantId = user.uid; // Use Firebase UID as tenant ID
              const claims = { tenantId };

              const tenantRef = doc( this.firestore, `tenants/${tenantId}` );

              await setDoc( tenantRef, claims );

              const contactRef = doc(
                this.firestore,
                `tenants/${tenantId}/contacts/${user.uid}`
              );
              const contactData = {
                email: user.email,
                tenantId: tenantId,
                affiliate: true,
                type: 'affiliate',
                acquisitionSource: 'affiliate',
                loginID: user.uid,
                dateAdded: new Date().toISOString(),
                timeStamp: new Date(),
              };

              await setDoc( contactRef, contactData, { merge: true } );
            } else {
              this.message = 'No user found.';
            }

            return result;
          } )
          .catch( ( error ) => {
            this.logger.error(
              'Error during affiliate sign-in with email link:',
              error
            );
            throw error;
          } )
      );
    } else {
      this.logger.error( 'Invalid sign-in link.' );
      throw new Error( 'Invalid link' );
    }
  }

  /**
   * Sends an affiliate signup link to the provided email address.
   * Stores the intended email for sign up in localStorage and sends a sign in link to email.
   * @param {string} email - The email address to send the signup link to.
   * @returns {Observable<void>} An Observable that completes when the link has been sent.
   */
  sendAffiliateSignupLink ( email: string ): Observable<void> {
    const actionCodeSettings: ActionCodeSettings = {
      url: this.url + '/finish-affiliate-sign-up',
      handleCodeInApp: true,
    };

    localStorage.setItem( 'emailForSignUp', email );
    return from( sendSignInLinkToEmail( this.auth, email, actionCodeSettings ) );
  }

  /**
   * Sends a sign-up link to a potential reseller's email address.
   * Stores the email in local storage and sends an email with an
   * action code link that, when clicked, redirects to a URL to
   * complete the sign-up within the app.
   *
   * @param {string} email - The email address where the sign-up link will be sent.
   * @returns {Observable<void>} An observable that completes when the email is sent.
   */
  sendResellerSignupLink ( email: string ): Observable<void> {
    const actionCodeSettings: ActionCodeSettings = {
      url: this.url + '/finish-reseller-sign-up',
      handleCodeInApp: true,
    };

    localStorage.setItem( 'emailForSignUp', email );
    return from( sendSignInLinkToEmail( this.auth, email, actionCodeSettings ) );
  }

  /**
   * Deletes the currently authenticated user.
   * If no user is logged in, it throws an error.
   * In case of failure during deletion, logs the error and rethrows it.
   * @returns {Observable<void>} An Observable that completes when the user is deleted or errors if deletion fails.
   */
  deleteUser (): Observable<void> {
    const user = this.auth.currentUser;
    if ( !user ) {
      return throwError( () => new Error( 'No user logged in' ) );
    }

    return from( user.delete() ).pipe(
      catchError( ( error ) => {
        this.logger.error( 'Failed to delete user:', error );
        return throwError( () => error );
      } )
    );
  }

  /**
   * Deletes a multi-tenant account and associated contact information from Firestore.
   *
   * First, it deletes the contact information document for the given user and then deletes
   * the tenant document itself. Logs an error and throws an observable error if the deletion fails.
   *
   * @param {string} userId - The ID of the user for which to delete the account.
   * @return {Observable<void>} An observable that completes when the deletion is finished.
   */
  deleteMultiTenantAccount ( userId: string ): Observable<void> {
    const tenantRef = doc( this.firestore, `tenants/${userId}` );
    const contactRef = doc(
      this.firestore,
      `tenants/${userId}/contacts/${userId}`
    );

    return from( deleteDoc( contactRef ) ).pipe(
      switchMap( () => from( deleteDoc( tenantRef ) ) ),
      catchError( ( error ) => {
        this.logger.error( '****Failed to delete multi-tenant account:', error );
        return throwError( () => error );
      } )
    );
  }

  /**
   * Asynchronously loads current user's metadata including browser info, user email, IP address, and location.
   * It fetches IP address and location data using external APIs and stores the gathered metadata.
   * If any of the API requests fail, the error is logged using the internal logger service.
   * @returns {Promise<any>} Promise that resolves to the user's metadata object.
   */
  async loadUserMetadata (): Promise<any> {
    try {
      const browserInfo = {
        appName: navigator.appName,
        appVersion: navigator.appVersion,
        platform: navigator.platform,
        userAgent: navigator.userAgent,
      };

      const user = this.auth.currentUser;
      const email = user ? user.email : 'Anonymous';

      let ipData, locationData;

      try {
        const ipResponse = await fetch( 'https://api.ipify.org?format=json' );
        ipData = await ipResponse.json();

        const locationResponse = await fetch( 'https://ipapi.co/json/' );
        locationData = await locationResponse.json();
      } catch ( error ) {
        this.logger.warn( 'Could not fetch IP/location:', error );
      }

      const metadata = {
        email: email,
        ipAddress: ipData?.ip || '',
        location: {
          country: locationData?.country_name || '',
          city: locationData?.city || '',
        },
        browserInfo: browserInfo,
        timestamp: new Date().toISOString(),
      };

      this.userMetaData = metadata;

      return metadata;
    } catch ( error ) {
      this.logger.error( 'Error loading user metadata:', error );
      return null;
    }
  }

  /**
   * Retrieves the metadata associated with the user.
   * @returns {Object} The user metadata object.
   */
  getUserMeta () {
    return this.userMetaData;
  }

  /**
   * Attempts to sign up a user using Google authentication.
   * If successful, returns the user object; otherwise, returns null.
   * Errors are logged and an alert is displayed to the user.
   * @returns {Promise<User | null>} A promise that resolves to the user object or null.
   */
  async signUpWithGoogle (): Promise<User | null> {
    const GOOGLE_PROVIDER = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup( this.auth, GOOGLE_PROVIDER );
      return result.user;
    } catch ( error ) {
      this.logger.error( error );
      alert( error );
      this.router.navigate( ['/error'] );
      return null;
    }
  }

  /**
   * Asynchronously signs up a user using Yahoo as the OAuth provider.
   * @returns {Promise<User | null>} A promise that resolves to the authenticated user object, or null if an error occurs.
   */
  async signUpWithYahoo (): Promise<User | null> {
    const provider = new OAuthProvider( 'yahoo.com' );

    try {
      const result = await signInWithPopup( this.auth, provider );
      // const credential = OAuthProvider.credentialFromResult(result);
      // const accessToken = credential?.accessToken || null;
      // const idToken = credential?.idToken || null;

      return result.user;
    } catch ( error ) {
      this.logger.error( error );
      alert( error );
      this.router.navigate( ['/error'] );
      return null;
    }
  }

  /**
   * Signs up a user with Microsoft OAuth using a popup window and returns the user if successful.
   * It configures OAuth to always prompt for consent. If sign-in fails, it logs the error,
   * navigates to an error page and returns null.
   *
   * @returns {Promise<User | null>} A promise that resolves to the authenticated user object or null if an error occurs.
   */
  async signUpWithMicrosoft (): Promise<User | null> {
    const provider = new OAuthProvider( 'microsoft.com' );
    provider.setCustomParameters( {
      prompt: 'consent',
    } );

    try {
      const result = await signInWithPopup( this.auth, provider );
      // User is signed in.
      // IdP data available in result.additionalUserInfo.profile.

      // Get the OAuth access token and ID Token
      // const credential = OAuthProvider.credentialFromResult(result);
      // const accessToken = credential?.accessToken || null;

      return result.user;
    } catch ( error ) {
      // Handle error.
      this.logger.error( 'Error during Microsoft sign-in:', error );
      this.router.navigate( ['/error'] );
      return null;
    }
  }

  /**
   * Asynchronously signs up a new user with email and password.
   * @param email The email address of the user to sign up.
   * @param password The password for the user account.
   * @returns A promise that resolves to the User object if successful, or a custom error object if an error occurs.
   */
  async signUpWithEmailPassword (
    email: string,
    password: string
  ): Promise<User | any> {
    try {
      const result = await createUserWithEmailAndPassword(
        this.auth,
        email,
        password
      );
      return result.user;
    } catch ( error ) {
      this.logger.error( error );
      if ( ( error as any )?.code === 'auth/email-already-in-use' ) {
        return { errorCode: 'email-already-in-use' } as any;
      } else {
        return { error: ( error as any )?.message } as any;
      }
    }
  }

  /**
   * Initiates a sign-up process using a phone number. It requires a valid phone number
   * and uses reCAPTCHA for verification. On success, returns a ConfirmationResult object
   * that can be used to verify the user's phone number with a verification code. In case
   * of an error, logs the error, alerts the user, and returns null.
   *
   * @param {string} phoneNumber - The user's phone number to sign up with.
   * @returns {Promise<ConfirmationResult | null>} A promise that resolves to a ConfirmationResult object
   * if the sign-up is initiated successfully, or null if an error occurs.
   */
  async signUpWithPhoneNumber (
    phoneNumber: string
  ): Promise<ConfirmationResult | null> {
    try {
      const confirmationResult = await signInWithPhoneNumber(
        this.auth,
        phoneNumber,
        this.recaptchaVerifier
      );
      return confirmationResult; // Return this to verify the code later
    } catch ( error ) {
      this.logger.error( 'Error during phone number sign-up:', error );
      alert( error );
      return null;
    }
  }

  private _phoneConfirmationResult: ConfirmationResult | null = null;

  private clearRecaptchaVerifier (): void {
    if ( !this.recaptchaVerifier ) {
      return;
    }

    try {
      this.recaptchaVerifier.clear();
    } catch ( error ) {
      this.logger.warn( 'AuthService.clearRecaptchaVerifier: clear failed', error );
    }

    this.recaptchaVerifier = undefined!;
  }

  initRecaptchaVerifier ( elementId: string, forceRecreate: boolean = false ): void {
    if ( typeof document === 'undefined' ) {
      return;
    }

    const element = document.getElementById( elementId );
    if ( !element ) {
      throw new Error( `reCAPTCHA container #${elementId} was not found.` );
    }

    if ( this.recaptchaVerifier && !forceRecreate ) {
      this.recaptchaElementId = elementId;
      return;
    }

    if ( forceRecreate && this.recaptchaVerifier ) {
      this.clearRecaptchaVerifier();
    }

    try {
      element.innerHTML = '';
    } catch { }

    this.recaptchaVerifier = new RecaptchaVerifier( this.auth, elementId, {
      size: 'invisible',
    } );
    this.recaptchaElementId = elementId;
  }

  private ensureRecaptchaVerifier ( forceRecreate: boolean = false ): void {
    const elementId = this.recaptchaElementId || 'recaptcha-container';
    this.initRecaptchaVerifier( elementId, forceRecreate );
  }

  async sendPhoneSignInCode ( phoneNumber: string ): Promise<{ success: boolean; error?: string; errorCode?: string; }> {
    if ( typeof window !== 'undefined' && !!( window as any ).Cypress ) {
      window.localStorage.setItem( '__cypressPendingPhoneNumber', phoneNumber );
      return { success: true };
    }

    try {
      this.ensureRecaptchaVerifier( false );
      this._phoneConfirmationResult = await signInWithPhoneNumber(
        this.auth,
        phoneNumber,
        this.recaptchaVerifier
      );
      return { success: true };
    } catch ( error: any ) {
      const message = String( error?.message || '' ).toLowerCase();
      const code = String( error?.code || '' ).toLowerCase();

      if (
        message.includes( 'recaptcha client element has been removed' ) ||
        message.includes( 'recaptcha has already been rendered' ) ||
        code === 'auth/internal-error'
      ) {
        try {
          this.logger.warn( 'AuthService.sendPhoneSignInCode: retrying after reCAPTCHA reset', error );
          this.ensureRecaptchaVerifier( true );
          this._phoneConfirmationResult = await signInWithPhoneNumber(
            this.auth,
            phoneNumber,
            this.recaptchaVerifier
          );
          return { success: true };
        } catch ( retryError ) {
          this.logger.error( 'AuthService.sendPhoneSignInCode retry failed:', retryError );
        }
      }

      this.logger.error( 'AuthService.sendPhoneSignInCode failed:', error );
      return {
        success: false,
        error: this.getPhoneAuthErrorMessage( error ),
        errorCode: String( error?.code || 'phone_send_failed' )
      };
    }
  }

  private getPhoneAuthErrorMessage ( error: any ): string {
    const code = String( error?.code || '' ).toLowerCase();

    if ( code === 'auth/invalid-phone-number' ) {
      return 'Enter a valid mobile number, including area code.';
    }

    if ( code === 'auth/too-many-requests' ) {
      return 'Firebase temporarily blocked more verification texts. Please wait a bit and try again.';
    }

    if ( code === 'auth/invalid-app-credential' ) {
      if ( typeof window !== 'undefined' ) {
        const host = window.location.hostname.toLowerCase();
        if ( host === 'localhost' || host === '127.0.0.1' ) {
          return 'Phone recovery cannot send real SMS codes from localhost. Test this flow on a deployed TODD domain instead.';
        }
      }

      return 'Phone verification was rejected by Firebase app credentials. Check the authorized domain and phone auth settings in Firebase.';
    }

    if ( code === 'auth/captcha-check-failed' ) {
      return 'Phone verification failed the reCAPTCHA check. Refresh and try again.';
    }

    return 'Failed to send verification code. Please try again in a moment.';
  }

  async confirmPhoneSignInCode ( code: string ): Promise<any | null> {
    if ( typeof window !== 'undefined' && !!( window as any ).Cypress ) {
      const pendingPhoneNumber = window.localStorage.getItem( '__cypressPendingPhoneNumber' ) || '';
      if ( !pendingPhoneNumber || !code.trim() ) {
        return null;
      }

      return {
        user: {
          uid: 'cypress-phone-user',
          phoneNumber: pendingPhoneNumber
        } as User
      };
    }

    if ( !this._phoneConfirmationResult ) {
      this.logger.error( 'AuthService.confirmPhoneSignInCode: no pending confirmation result' );
      return null;
    }
    try {
      const credential = await this._phoneConfirmationResult.confirm( code );
      this._phoneConfirmationResult = null;
      return credential;
    } catch ( error ) {
      this.logger.error( 'AuthService.confirmPhoneSignInCode failed:', error );
      return null;
    }
  }

  async recoverToddAccountFromPhoneUser ( phoneUser: User, recoveryEmail?: string | null ): Promise<{ success: boolean; user?: User | null; error?: string; errorCode?: string; }> {
    if ( !phoneUser ) {
      return {
        success: false,
        error: 'Phone verification did not produce a user session.',
        errorCode: 'missing_phone_user'
      };
    }

    if ( typeof window !== 'undefined' && !!( window as any ).Cypress ) {
      try {
        const raw = window.localStorage.getItem( '__cypressPhoneRecoveryTarget' );
        const parsed = raw ? JSON.parse( raw ) : null;
        const outcome = String( window.localStorage.getItem( '__cypressPhoneRecoveryOutcome' ) || 'success' ).trim();
        const expectedEmail = String( recoveryEmail || '' ).trim().toLowerCase();

        if ( outcome === 'email_not_found' ) {
          return { success: false, error: 'No TODD account was found for that email address.', errorCode: 'email_not_found' };
        }

        if ( outcome === 'phone_mismatch' ) {
          return { success: false, error: 'That verified phone number does not match the phone saved on this TODD profile.', errorCode: 'phone_mismatch' };
        }

        if ( outcome === 'no_match' ) {
          return { success: false, error: 'No TODD account matched that phone number.', errorCode: 'no_match' };
        }

        if ( outcome === 'ambiguous_match' ) {
          return { success: false, error: 'Multiple TODD accounts matched that phone number.', errorCode: 'ambiguous_match' };
        }

        if ( !parsed?.uid || !parsed?.email ) {
          return { success: false, error: 'Cypress phone recovery target is missing.', errorCode: 'missing_target' };
        }

        if ( expectedEmail && String( parsed.email || '' ).trim().toLowerCase() !== expectedEmail ) {
          return { success: false, error: 'No TODD account was found for that email address.', errorCode: 'email_not_found' };
        }

        window.localStorage.setItem( '__cypressAuthOverride', JSON.stringify( {
          uid: parsed.uid,
          tenantId: parsed.tenantId || parsed.uid,
          email: parsed.email
        } ) );

        return {
          success: true,
          user: {
            uid: parsed.uid,
            email: parsed.email,
            phoneNumber: phoneUser.phoneNumber || null
          } as User
        };
      } catch ( error: any ) {
        return { success: false, error: error?.message || 'Cypress phone recovery failed.', errorCode: 'cypress_failed' };
      }
    }

    try {
      const idToken = await phoneUser.getIdToken( true );
      const endpoint = recoveryEmail ? 'email-phone-recover' : 'phone-recover';
      const response = await fetch( `${environment.backendURL}/public/auth/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify( {
          idToken,
          email: recoveryEmail || ''
        } )
      } );
      const payload = await response.json();

      if ( !response.ok || !payload?.success || !payload?.customToken ) {
        return {
          success: false,
          error: payload?.message || 'Unable to recover your TODD account from this phone number.',
          errorCode: payload?.errorCode || 'recover_failed'
        };
      }

      await firebaseSignOut( this.auth );
      const signInResult = await signInWithCustomToken( this.auth, payload.customToken );

      return {
        success: true,
        user: signInResult.user
      };
    } catch ( error: any ) {
      this.logger.error( 'AuthService.recoverToddAccountFromPhoneUser failed:', error );
      return {
        success: false,
        error: error?.message || 'Unable to recover your TODD account from this phone number.',
        errorCode: 'recover_failed'
      };
    }
  }

  async acceptTenantInviteAfterSignIn ( user: User, inviteContext: { inviteId: string; tenantId: string; email?: string | null; } ): Promise<any> {
    if ( !user ) {
      throw new Error( 'No signed-in user is available to accept the invite.' );
    }

    const idToken = await user.getIdToken( true );

    const response = await fetch( `${environment.backendURL}/public/auth/accept-invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify( {
        idToken,
        inviteId: inviteContext.inviteId,
        tenantId: inviteContext.tenantId,
        email: inviteContext.email || user.email || ''
      } )
    } );

    const payload = await response.json();

    if ( !response.ok || !payload?.success ) {
      throw new Error( payload?.message || 'Unable to accept tenant invite.' );
    }

    return payload;
  }

  /**
   * Getter for the `buyOption` property.
   * @returns The value of the `_buyOption` property.
   */
  public get buyOption (): string {
    return this._buyOption;
  }

  /**
   * Sets the buy option for the current instance.
   * @param value The value to set for the buyOption property
   */
  public set buyOption ( value: string ) {
    this._buyOption = value;
  }

  /**
   * Getter for the plan property.
   * @returns The current value of the _plan property.
   */
  public get plan (): string {
    return this._plan;
  }

  /**
   * Sets the plan property for the class instance.
   * @param {string} value - The new plan value to assign to the instance.
   */
  public set plan ( value: string ) {
    this._plan = value;
  }

  /**
   * Sets the billing cycle for the current instance.
   * @param {string} value - The new value for the billing cycle.
   */
  public set billingCycle ( value: string ) {
    this._billingCycle = value;
  }

  /**
   * Gets the billing cycle for the current instance.
   * @returns {string} The current billing cycle value.
   */
  public get billingCycle (): string {
    return this._billingCycle;
  }

  /**
   * Getter for the audience property.
   * @returns {string} The current value of the _audience private property.
   */
  public get audience (): string {
    return this._audience;
  }

  /**
   * Sets the audience property of the class.
   * @param {string} value - The value to set for the audience.
   */
  public set audience ( value: string ) {
    this._audience = value;
  }

  /**
   * Getter for the formatted amount.
   * @returns {string} The formatted amount value.
   */
  public get amount (): string {
    return this._amount;
  }

  /**
   * Sets the private `_amount` property to the given value.
   *
   * @param {string} value - The value to set the `_amount` property to.
   */
  public set amount ( value: string ) {
    this._amount = value;
  }

  /**
   * Retrieves the Stripe session ID.
   * @returns {string} The current Stripe session ID.
   */
  public get stripeSessionId (): string {
    return this._stripeSessionId;
  }

  /**
   * Sets the Stripe session identifier for the current instance.
   *
   * @param value - The Stripe session ID to be stored.
   */
  public set stripeSessionId ( value: string ) {
    this._stripeSessionId = value;
  }

  /**
   * Getter for the `stripePriceId` property.
   * @returns {string} The ID associated with the Stripe price.
   */
  public get stripePriceId (): string {
    return this._stripePriceId;
  }

  /**
   * Sets the stripePriceId property of the current instance.
   *
   * @param {string} value - The new Stripe Price ID to be set.
   */
  public set stripePriceId ( value: string ) {
    this._stripePriceId = value;
  }

  public clearAll (): void {
    // Reset subscriptions
    if ( this.getUserSubscription ) {
      this.getUserSubscription.unsubscribe();
      this.getUserSubscription = undefined!;
    }

    // Clear internal state
    this._buyOption = '';
    this._plan = '';
    this._billingCycle = '';
    this._audience = '';
    this._amount = '';
    this._stripeSessionId = '';
    this._stripePriceId = '';

    // Clear user metadata
    // Note: userMetaData is now managed by UserProfileService

    // Clear BehaviorSubject state
    this.userLoggedIn.next( false );

    // Clear outage flag and message
    this.showOutageBanner = false;
    this.message = '';

    // Clear recaptcha verifier (optional)
    this.clearRecaptchaVerifier();
    this.recaptchaElementId = null;
  }
}
