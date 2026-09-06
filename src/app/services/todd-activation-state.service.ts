import { Injectable } from '@angular/core';
import { firstValueFrom, of, take, catchError } from 'rxjs';
import { AuthService } from './auth.service';
import { Contact } from '../shared/data/interfaces/contact.model';
import { DataService } from './data.service';
import { EntitlementService, Entitlements } from './entitlement.service';
import { LoggerService } from './logger.service';
import { OutreachApiService, OutreachProvisioningState } from './outreach-api.service';
import { UserService } from './user.service';
import { ToddProfileReadiness, ToddProfileReadinessService } from './todd-profile-readiness.service';

export type ToddActivationStage =
  | 'visitor'
  | 'activation_goal_pending'
  | 'profile_ready'
  | 'contacts_missing'
  | 'contacts_ready'
  | 'sender_provisioning_required'
  | 'sender_pending_admin'
  | 'operator_controls_pending'
  | 'module_specific_start'
  | 'first_campaign_pending';

export type ToddActivationGoal =
  | 'get_more_leads'
  | 'follow_up_better'
  | 'organize_work'
  | 'understand_customers'
  | 'store_reusable_proof'
  | 'not_sure';

export interface ToddActivationRouteTarget {
  path: string;
  queryParams: Record<string, string>;
}

export interface ToddActivationResolution {
  stage: ToddActivationStage;
  recommendedRoute: ToddActivationRouteTarget;
  title: string;
  message: string;
  facts: {
    profileComplete: boolean;
    profileReadiness: ToddProfileReadiness;
    contactCount: number;
    entitlements: Entitlements;
    senderEmail: string;
    provisioningStatus: string;
    activationGoal: ToddActivationGoal | null;
    activationGoalSelected: boolean;
  };
}

@Injectable( { providedIn: 'root' } )
export class ToddActivationStateService {
  private readonly activationGoalStoragePrefix = 'todd_activation_goal';

  constructor (
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly entitlementService: EntitlementService,
    private readonly dataService: DataService,
    private readonly outreachApiService: OutreachApiService,
    private readonly logger: LoggerService,
    private readonly profileReadinessService: ToddProfileReadinessService
  ) { }

  async resolveActivationState (): Promise<ToddActivationResolution> {
    const [user, tenantId, entitlements, profile] = await Promise.all( [
      firstValueFrom( this.authService.getUser().pipe( take( 1 ) ) ),
      firstValueFrom( this.authService.getTenantId().pipe( take( 1 ) ) ),
      firstValueFrom( this.entitlementService.getResolvedEntitlements().pipe( take( 1 ) ) ),
      firstValueFrom( this.userService.getLoggedInContactInfo( true ).pipe(
        take( 1 ),
        catchError( error => {
          this.logger.warn( '[ToddActivationState] could not load logged-in contact info', error );
          return of( null );
        } )
      ) )
    ] );

    if ( !( user as any )?.uid || !tenantId ) {
      return {
        stage: 'visitor',
        recommendedRoute: {
          path: '/login',
          queryParams: {}
        },
        title: 'Sign in to continue setup',
        message: 'TODD needs a signed-in workspace before it can decide the next activation move.',
        facts: {
          profileComplete: false,
          profileReadiness: this.profileReadinessService.evaluate( null ),
          contactCount: 0,
          entitlements,
          senderEmail: '',
          provisioningStatus: 'not_requested',
          activationGoal: null,
          activationGoalSelected: false
        }
      };
    }

    const userId = String( ( user as any ).uid || '' ).trim();
    const userEmail = String( ( user as any ).email || '' ).trim().toLowerCase();
    const contactCount = await this.getContactCount( userId );
    const profileReadiness = this.profileReadinessService.evaluate( profile );
    const profileComplete = profileReadiness.coreComplete;
    const provisioning = await this.getProvisioningStateIfNeeded( {
      entitlements,
      tenantId: String( tenantId ),
      userId,
      userEmail
    } );

    const senderEmail = this.getPreferredSenderEmail( profile, provisioning, userEmail );
    const provisioningStatus = String( provisioning?.provisioningStatus || 'not_requested' ).trim().toLowerCase();
    const senderReady = ['provisioned', 'active', 'ready'].includes( provisioningStatus );
    const paidModuleCount = [
      entitlements.network,
      entitlements.moves,
      entitlements.outreach,
      entitlements.docs,
      entitlements.knowledge,
      entitlements.pulse
    ].filter( Boolean ).length;
    const activationGoal = this.getActivationGoal( String( tenantId ), userId );

    const facts = {
      profileComplete,
      profileReadiness,
      contactCount,
      entitlements,
      senderEmail,
      provisioningStatus,
      activationGoal,
      activationGoalSelected: !!activationGoal
    };

    // Do not hold an established workspace in first-run profile onboarding.
    // Profile context is required to activate a new workspace, but users with
    // an existing network already have live momentum TODD can work with.
    if ( !profileComplete ) {
      return {
        stage: 'profile_ready',
        recommendedRoute: {
          path: '/update-profile',
          queryParams: {
            guided: 'profile'
          }
        },
        title: 'Finish your profile first',
        message: 'TODD still needs your profile context before it can guide activation intelligently.',
        facts
      };
    }

    // Sending is a hard dependency for Outreach. Resolve it before Network
    // inventory so users are never sent to import contacts while their sender
    // still cannot deliver email.
    if ( entitlements.suite || entitlements.outreach ) {
      if ( !senderReady && ['requested', 'pending', 'manual_review'].includes( provisioningStatus ) ) {
        return {
          stage: 'sender_pending_admin',
          recommendedRoute: this.buildTodayActivationRoute( 'sender-provisioning', 'sender_pending_admin' ),
          title: 'Sender request is pending approval',
          message: 'The master tenant still needs to provision your sending address, so TODD should hold the user in the outreach activation lane until that is complete.',
          facts
        };
      }

      if ( !senderReady ) {
        return {
          stage: 'sender_provisioning_required',
          recommendedRoute: this.buildTodayActivationRoute( 'sender-provisioning', 'sender_provisioning_required' ),
          title: 'Provision the sending address next',
          message: 'Outreach is part of this workspace, so the next operational dependency is getting the sender approved before TODD can run email.',
          facts
        };
      }

    }

    // Network needs relationship inventory before TODD can recommend useful
    // work. Single-module products without Network stay in their own lane.
    if ( contactCount <= 0 && entitlements.network ) {
      return {
        stage: 'contacts_missing',
        recommendedRoute: this.buildTodayActivationRoute( 'import', 'contacts_missing' ),
        title: 'Add or import contacts next',
        message: 'Your profile is ready, but Network still needs contacts. Add them one at a time or import them so TODD has people and relationships to work with.',
        facts
      };
    }

    // Once contacts exist, TODD should prescribe the next operating step. Do
    // not make the user choose an abstract first outcome before TODD has
    // helped them turn their network into usable work.
    if ( !activationGoal && contactCount > 0 ) {
      return {
        stage: 'contacts_ready',
        recommendedRoute: {
          path: '/contact-list',
          queryParams: {
            onboarding: '1',
            guided: 'network-ready'
          }
        },
        title: 'Your network is ready for its next move',
        message: `TODD sees ${contactCount.toLocaleString( 'en-US' )} contacts. Validation and enrichment now continue automatically in the backend. Review Network when convenient, then activate Pipeline to decide who needs attention first.`,
        facts
      };
    }

    if ( entitlements.suite || entitlements.outreach ) {
      return {
        stage: 'operator_controls_pending',
        recommendedRoute: this.buildTodayActivationRoute( 'operator-setup', 'operator_controls_pending' ),
        title: 'Tune the operator controls next',
        message: 'The sender is ready, so TODD should move the user into operator setup before asking for real outreach execution.',
        facts
      };
    }

    const goalRoute = this.resolveGoalRoute( activationGoal );
    if ( goalRoute && activationGoal !== 'follow_up_better' ) {
      if ( activationGoal === 'get_more_leads' && contactCount <= 0 ) {
        return {
          stage: 'contacts_missing',
          recommendedRoute: goalRoute,
          title: 'Build the people layer first',
          message: 'The selected first win is more leads, so TODD should start by creating relationship inventory through import or lead capture before asking for outreach or analysis.',
          facts
        };
      }

      return {
        stage: 'module_specific_start',
        recommendedRoute: goalRoute,
        title: this.getGoalTitle( activationGoal ),
        message: this.getGoalMessage( activationGoal ),
        facts
      };
    }

    if ( entitlements.pulse && paidModuleCount === 1 ) {
      return {
        stage: 'module_specific_start',
        recommendedRoute: {
          path: '/pulse/app',
          queryParams: {
            onboarding: '1',
            guided: 'pulse'
          }
        },
        title: 'Start in Pulse',
        message: 'This user paid for Pulse, so TODD should begin in the survey workflow instead of pushing import or outreach.',
        facts
      };
    }

    if ( entitlements.moves && paidModuleCount === 1 ) {
      return {
        stage: 'module_specific_start',
        recommendedRoute: {
          path: '/moves/app',
          queryParams: {
            onboarding: '1',
            guided: 'moves'
          }
        },
        title: 'Start in Moves',
        message: 'This user paid for Moves, so TODD should begin in the task workflow instead of generic onboarding.',
        facts
      };
    }

    if ( contactCount <= 0 ) {
      return {
        stage: 'contacts_missing',
        recommendedRoute: this.buildTodayActivationRoute( 'import', 'contacts_missing' ),
        title: 'Import contacts next',
        message: 'TODD still needs contacts before it can build momentum from real people and real work.',
        facts
      };
    }

    return {
      stage: 'contacts_ready',
      recommendedRoute: this.buildTodayActivationRoute( 'next-move', 'contacts_ready' ),
      title: 'Your network is ready',
      message: 'The profile and contact base are in place, so TODD can now move the user into live work instead of raw setup.',
      facts
    };
  }

  private async getContactCount ( userId: string ): Promise<number> {
    try {
      const contacts = await this.dataService.getCollectionData( 'CONTACTS', userId );
      return Array.isArray( contacts ) ? contacts.length : 0;
    } catch ( error ) {
      this.logger.warn( '[ToddActivationState] could not load contact count', error );
      return 0;
    }
  }

  private async getProvisioningStateIfNeeded ( args: {
    entitlements: Entitlements;
    tenantId: string;
    userId: string;
    userEmail: string;
  } ): Promise<OutreachProvisioningState | null> {
    if ( !( args.entitlements.suite || args.entitlements.outreach ) ) {
      return null;
    }

    try {
      const response = await firstValueFrom( this.outreachApiService.getOutreachProvisioning( {
        tenantId: args.tenantId,
        userId: args.userId,
        userEmail: args.userEmail
      } ).pipe(
        take( 1 ),
        catchError( error => {
          this.logger.warn( '[ToddActivationState] could not load outreach provisioning', error );
          return of( null );
        } )
      ) );

      return response?.data || null;
    } catch {
      return null;
    }
  }

  private getPreferredSenderEmail ( profile: Contact | null, provisioning: OutreachProvisioningState | null, fallbackEmail: string ): string {
    return String(
      profile?.emailAddresses?.[0]?.emailAddress
      || profile?.email
      || provisioning?.senderEmail
      || fallbackEmail
      || ''
    ).trim().toLowerCase();
  }

  private buildTodayActivationRoute ( guided: string, stage: ToddActivationStage ): ToddActivationRouteTarget {
    return {
      path: '/ask-todd',
      queryParams: {
        onboarding: '1',
        guided,
        activationStage: stage
      }
    };
  }

  async selectActivationGoal ( goal: ToddActivationGoal ): Promise<ToddActivationRouteTarget> {
    const [user, tenantId] = await Promise.all( [
      firstValueFrom( this.authService.getUser().pipe( take( 1 ) ) ),
      firstValueFrom( this.authService.getTenantId().pipe( take( 1 ) ) )
    ] );
    const userId = String( ( user as any )?.uid || '' ).trim();
    const normalizedTenantId = String( tenantId || '' ).trim();

    if ( userId && normalizedTenantId ) {
      this.storeActivationGoal( normalizedTenantId, userId, goal );
    }

    return this.resolveGoalRoute( goal ) || this.buildTodayActivationRoute( 'next-move', 'contacts_ready' );
  }

  getActivationGoal ( tenantId: string, userId: string ): ToddActivationGoal | null {
    const raw = this.readStoredValue( this.buildActivationGoalStorageKey( tenantId, userId ) );
    return this.isActivationGoal( raw ) ? raw : null;
  }

  private storeActivationGoal ( tenantId: string, userId: string, goal: ToddActivationGoal ): void {
    if ( !this.isActivationGoal( goal ) ) {
      return;
    }

    this.writeStoredValue( this.buildActivationGoalStorageKey( tenantId, userId ), goal );
  }

  private resolveGoalRoute ( goal: ToddActivationGoal | null ): ToddActivationRouteTarget | null {
    const routeByGoal: Record<ToddActivationGoal, ToddActivationRouteTarget> = {
      get_more_leads: {
        path: '/contact-import',
        queryParams: {
          onboarding: '1',
          guided: 'leads',
          activationGoal: 'get_more_leads'
        }
      },
      follow_up_better: {
        path: '/signal-engine',
        queryParams: {
          onboarding: '1',
          guided: 'sender-provisioning',
          activationGoal: 'follow_up_better'
        }
      },
      organize_work: {
        path: '/mission',
        queryParams: {
          onboarding: '1',
          guided: 'project',
          activationGoal: 'organize_work'
        }
      },
      understand_customers: {
        path: '/pulse/app',
        queryParams: {
          onboarding: '1',
          guided: 'pulse',
          activationGoal: 'understand_customers'
        }
      },
      store_reusable_proof: {
        path: '/docs/app',
        queryParams: {
          onboarding: '1',
          guided: 'proof',
          activationGoal: 'store_reusable_proof'
        }
      },
      not_sure: {
        path: '/ask-todd',
        queryParams: {
          onboarding: '1',
          guided: 'next-move',
          activationGoal: 'not_sure'
        }
      }
    };

    return goal ? routeByGoal[goal] : null;
  }

  private getGoalTitle ( goal: ToddActivationGoal | null ): string {
    const titleByGoal: Partial<Record<ToddActivationGoal, string>> = {
      organize_work: 'Start with Mission Workspace',
      understand_customers: 'Start with customer signal',
      store_reusable_proof: 'Start with reusable proof',
      not_sure: 'Let TODD choose the next move'
    };

    return goal ? titleByGoal[goal] || 'Start the selected activation lane' : 'Start activation';
  }

  private getGoalMessage ( goal: ToddActivationGoal | null ): string {
    const messageByGoal: Partial<Record<ToddActivationGoal, string>> = {
      organize_work: 'The selected first win is organizing work, so TODD should move the user into Mission Workspace and help turn loose tasks into a guided operating path.',
      understand_customers: 'The selected first win is understanding customers, so TODD should move the user into Pulse and help collect useful signal instead of guessing.',
      store_reusable_proof: 'The selected first win is reusable proof, so TODD should move the user into Docs and help build a memory bank that can support outreach and answers later.',
      not_sure: 'The user is not sure where to start, so TODD should open Daily Momentum and choose the next move from current setup, blockers, and available product paths.'
    };

    return goal ? messageByGoal[goal] || 'TODD should move the user into the selected activation lane.' : 'TODD should move the user into activation.';
  }

  private buildActivationGoalStorageKey ( tenantId: string, userId: string ): string {
    return `${this.activationGoalStoragePrefix}:${tenantId}:${userId}`;
  }

  private isActivationGoal ( value: unknown ): value is ToddActivationGoal {
    return [
      'get_more_leads',
      'follow_up_better',
      'organize_work',
      'understand_customers',
      'store_reusable_proof',
      'not_sure'
    ].includes( String( value || '' ) );
  }

  private readStoredValue ( key: string ): string {
    try {
      if ( typeof localStorage === 'undefined' ) {
        return '';
      }

      return localStorage.getItem( key ) || '';
    } catch {
      return '';
    }
  }

  private writeStoredValue ( key: string, value: string ): void {
    try {
      if ( typeof localStorage === 'undefined' ) {
        return;
      }

      localStorage.setItem( key, value );
    } catch {
      // Activation goal memory is helpful, but it should never block onboarding.
    }
  }
}
