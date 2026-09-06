import {
  AfterViewInit,
  Component,
  Input,
  HostListener,
  inject,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  BehaviorSubject,
  Observable,
  Subscription,
  filter,
  take,
  combineLatest,
} from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { LoggerService } from '../../services/logger.service';
import {
  Nomenclature,
  NomenclatureService,
} from '../../services/nomenclature.service';
import { RoutePerfService } from '../../services/route-perf.service';
import { SettingsService } from '../../services/settings.service';
import { SoundService } from '../../services/sound.service';
import { DiagnosticComponent } from '../../shared/page/diagnostic/diagnostic.component';


@Component( {
  selector: 'app-top-dog',
  imports: [],
  templateUrl: './top-dog.component.html',
  styleUrl: './top-dog.component.css',
} )
export class TopDogComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild( 'diagnosticRef' ) diagnosticComponent!: DiagnosticComponent;
  topMenu = environment.topMenu;

  isLoading = false;

  nomenclature$: Observable<Nomenclature>;
  nomenclatureSubscription!: Subscription;
  @Input() nomenclature!: Nomenclature;
  readySubscription!: Subscription;

  readonly COMPANY_NAME = environment.COMPANY_NAME;

  version: string = environment.VERSION;

  @Input() userId!: string;

  @Input() tenantId!: any;

  isLoggedIn: boolean = false;

  isMobile: boolean = false;

  private sayItMode = false;

  @Input() firebaseUser!: any;

  restrictedUser: boolean = true;

  private userIdSubscription!: Subscription;
  private tenantIdSubscription!: Subscription;
  private loggedInSubscription!: Subscription;
  private firebaseUserSubscription!: Subscription;

  private perf = inject( RoutePerfService );
  protected zone = inject( NgZone );

  private readySubject = new BehaviorSubject<boolean>( false );
  public ready$ = this.readySubject.asObservable();

  private pageReadySubject = new BehaviorSubject<boolean>( false );
  public pageReady$ = this.pageReadySubject.asObservable();

  constructor (
    protected authService: AuthService,
    protected settingsService: SettingsService,
    protected soundService: SoundService,
    protected logger: LoggerService,
    protected router: Router,
    protected nomenclatureService: NomenclatureService,
  ) {
    this.nomenclature$ = this.nomenclatureService.currentNomenclature$;
  }

  /**
   * Initializes the component by setting the tenant ID, user ID, and login status
   * when the component is being loaded.
   */
  ngOnInit (): void {
    this.sayItMode = this.isSayItContext();
    this.setFirebaseUser();
    this.setTenantId();
    this.setUserId();
    this.setLoggedIn();
    // SayIt is public-facing and does not use per-tenant settings/nomenclature.
    if ( !this.sayItMode ) {
      this.setNomenclature();
    } else {
      // Provide a harmless value so readiness checks can pass.
      this.nomenclature = {} as any;
    }

    this.isMobile = window.innerWidth < 768;
  }

  /**
   * Cleans up subscriptions to prevent memory leaks when the component is destroyed.
   */
  ngOnDestroy (): void {
    if ( this.userIdSubscription ) this.userIdSubscription.unsubscribe();
    if ( this.tenantIdSubscription ) this.tenantIdSubscription.unsubscribe();
    if ( this.loggedInSubscription ) this.loggedInSubscription.unsubscribe();
    if ( this.firebaseUserSubscription )
      this.firebaseUserSubscription.unsubscribe();
    if ( this.readySubscription ) this.readySubscription.unsubscribe();
  }

  /**
   * Angular lifecycle hook that is called after a component's view has been fully initialized.
   * This implementation waits for both auth/nomenclature readiness and page content readiness before marking render.
   */
  ngAfterViewInit (): void {
    if ( this.shouldScrollPageToTopOnInit() ) {
      window.scrollTo( 0, 0 );
    }
    this.isLoading = false;

    // Wait for auth/nomenclature readiness *and* page content readiness
    this.readySubscription = combineLatest( [
      this.ready$.pipe( filter( Boolean ) ),
      this.pageReady$.pipe( filter( Boolean ) ),
    ] )
      .pipe( take( 1 ) )
      .subscribe( () => {
        this.zone.runOutsideAngular( () =>
          requestAnimationFrame( () =>
            this.perf.markRendered( { page: 'TopDog' } )
          )
        );
      } );
  }

  /** Embedded components can opt out of moving the host page on init. */
  protected shouldScrollPageToTopOnInit (): boolean {
    return true;
  }

  /**
   * Signal from child components that page content (data + DOM) is ready to measure.
   */
  public signalContentReady (): void {
    this.pageReadySubject.next( true );
  }

  /**
   * SayIt is a single-tenant public-facing app.
   * For SayIt pages, we always use the Taliferro master tenant for Firestore paths.
   * The authenticated Firebase UID is still the userId, but NOT the tenantId.
   */
  private isSayItContext (): boolean {
    try {
      const path = ( window.location?.pathname || '' ).toLowerCase();
      const hostname = ( window.location?.hostname || '' ).toLowerCase();
      // Covers /sayit, /say-it, and any nested routes
      return path.includes( 'sayit' )
        || path.includes( 'say-it' )
        || hostname === 'sayit.taliferro.tech'
        || hostname === 'todd-sayit.web.app';
    } catch {
      return false;
    }
  }

  /**
   * Initializes the subscription to `tenantId` from the authentication service.
   * For SayIt routes, tenantId must be the Taliferro master tenant (NOT the user UID).
   */
  setTenantId () {
    if ( !this.tenantId ) {
      this.tenantIdSubscription = this.authService
        .getTenantId()
        .subscribe( ( tenantId ) => {
          const masterTenantId =
            ( environment as any )?.taliferroTenantId || 'yH3nWanUv0RqDCNfwXBOXLWuxt52';

          // SayIt always reads/writes under the master tenant
          if ( this.isSayItContext() ) {
            this.tenantId = masterTenantId;
            this.logger.info( 'TENANT ID (SayIt → master)', this.tenantId );
            this.checkIfReady();
            return;
          }

          // Default behavior for the rest of the app
          this.tenantId = tenantId || masterTenantId;
          this.logger.info( 'TENANT ID', this.tenantId );
          this.checkIfReady();
        } );
    }
  }

  /**
   * Initializes the subscription to the `userId` from the `authService` and
   * updates the component's `userId` property whenever a new `userId` is emitted.
   */
  setUserId () {
    if ( !this.userId ) {
      this.userIdSubscription = this.authService
        .getUserId()
        .subscribe( ( userId ) => {
          this.userId = ( this.isSayItContext() ) ? environment.taliferroTenantId : ( userId || environment.taliferroTenantId );
          this.logger.info( 'USER ID', this.userId );
          this.checkIfReady();
        } );
    }
  }

  /**
   * Subscribes to the authentication service to set the logged-in status.
   * Upon receiving the logged-in status, updates the `isLoggedIn` property.
   */
  setLoggedIn () {
    this.loggedInSubscription = this.authService
      .isLoggedIn()
      .subscribe( ( isLoggedIn ) => {
        this.isLoggedIn = isLoggedIn;
      } );

  }

  /**
   * Event handler for window resize events. It sets the `isMobile` property
   * based on the window width.
   */
  @HostListener( 'window:resize', [] )
  onResize () {
    this.isMobile = window.innerWidth < 768;
  }

  /**
   * Handles click events to route to a specified path with an optional fragment.
   * @param goto The target route as a string, which may include a '#' to denote the fragment.
   */
  onClickRoute ( goto: string ) {
    const [path, fragment] = goto.split( '#' );
    this.router.navigate( [path], { fragment } );
  }

  /**
   * Toggles the diagnostic state of the child diagnostic component if it exists.
   */
  toggleDiagnosticInChild () {
    if ( this.diagnosticComponent ) {
      this.diagnosticComponent.toggleDiagnostic();
    }
  }

  /**
   * Subscribes to the user observable from the authentication service,
   * and updates the `firebaseUser` property with the user data when it is emitted.
   */
  setFirebaseUser (): void {
    if ( !this.firebaseUser ) {
      this.firebaseUserSubscription = this.authService
        .getUser()
        .subscribe( ( user ) => {
          this.firebaseUser = user;
          this.checkIfReady();
          this.checkUserMore();
        } );
    } else {
      this.checkUserMore();
    }
  }

  setNomenclature () {
    if ( this.sayItMode ) {
      // SayIt bypasses settings/nomenclature reads.
      this.nomenclature = {} as any;
      this.checkIfReady();
      return;
    }
    if ( !this.nomenclature ) {
      this.nomenclatureSubscription = this.nomenclature$.subscribe(
        ( settings ) => {
          this.nomenclature = settings;
          this.checkIfReady();
        }
      );
    }
  }

  /**
   * Checks if all necessary conditions are met and notifies the readiness state.
   * If a Firebase user, userId, and tenantId are present, it emits a `true` value
   * to the `readySubject`.
   */
  private checkIfReady () {
    if ( this.isSayItContext() )
      return;

    const hasNomenclature = this.sayItMode ? true : ( this.nomenclature != undefined );

    if (
      this.firebaseUser &&
      this.userId &&
      this.tenantId !== undefined &&
      hasNomenclature
    ) {
      this.readySubject.next( true );
    }
  }



  private allowedProjects = new Set<string>();

  private checkUserMore () {
    if ( this.isSayItContext() )
      return;



    try {
      // defaults
      this.restrictedUser = false;
      this.allowedProjects.clear();


      const email = ( this.firebaseUser?.email ?? '' ).trim().toLowerCase();
      if ( !email ) {
        this.logger.warn( 'No firebaseUser.email yet → unrestricted' );
        return;
      }

    } catch ( err ) {
      this.logger.error( 'checkUserMore error', err );
      this.restrictedUser = false;
      this.allowedProjects.clear();
    }
  }

  // Gate checks wherever you need them
  canAccessProject ( projectId: string ): boolean {
    return !this.restrictedUser || this.allowedProjects.has( projectId );
  }
}
