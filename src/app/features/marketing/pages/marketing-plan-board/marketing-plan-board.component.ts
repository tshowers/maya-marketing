import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, combineLatest } from 'rxjs';

import { TopDogComponent } from '../../../../core/top-dog/top-dog.component';
import { AuthService } from '../../../../services/auth.service';
import { SettingsService } from '../../../../services/settings.service';
import { SoundService } from '../../../../services/sound.service';
import { LoggerService } from '../../../../services/logger.service';
import { ActivatedRoute, Router } from '@angular/router';
import { NomenclatureService } from '../../../../services/nomenclature.service';
import { Task } from '../../../../shared/data/interfaces/task.model';
import { Dropdown } from '../../../../shared/data/interfaces/dropdown.model';
import { ProjectViewComponent } from '../../../tasks/project-view/project-view.component';
import { ProjectStickyBoardComponent } from '../../../tasks/project-sticky-board/project-sticky-board.component';
import { MarketingEmployeeService } from '../../services/marketing-employee.service';
import { MarketingPlanRecord, DEFAULT_MARKETING_EMPLOYEE_ID } from '../../models/marketing-employee.models';

// Stable id Maya's daily planner stamps on every Move it creates - see
// MARKETING_PLAN_PROJECT_ID in scheduledMarketingEmployeePlanner.js. Not a
// Firestore document id, just the shared tag both sides key off of.
const MARKETING_PLAN_PROJECT_ID = 'marketing-plan';

@Component( {
  selector: 'app-marketing-plan-board',
  standalone: true,
  imports: [CommonModule, ProjectViewComponent, ProjectStickyBoardComponent],
  templateUrl: './marketing-plan-board.component.html',
  styleUrl: './marketing-plan-board.component.css'
} )
export class MarketingPlanBoardComponent extends TopDogComponent implements OnInit, OnDestroy {
  readonly projectId = MARKETING_PLAN_PROJECT_ID;
  readonly projectDropdown: Dropdown = { id: MARKETING_PLAN_PROJECT_ID, name: 'Marketing Plan' };

  tasks: Task[] = [];
  activePlan: MarketingPlanRecord | null = null;
  planLoading = true;
  isEmbedded = false;
  activeView: 'summary' | 'work' | 'board' = 'summary';
  planEvidenceLabel = 'No execution evidence yet';
  planEvidenceDetail = 'The written plan is saved, but no current Maya work is linked to it yet.';
  planLinkedWorkCount = 0;

  private planSubscription?: Subscription;

  constructor (
    protected override authService: AuthService,
    protected override settingsService: SettingsService,
    protected override soundService: SoundService,
    protected override logger: LoggerService,
    protected override router: Router,
    protected override nomenclatureService: NomenclatureService,
    private readonly marketingEmployeeService: MarketingEmployeeService,
    private readonly route: ActivatedRoute
  ) {
    super( authService, settingsService, soundService, logger, router, nomenclatureService );
  }

  override ngOnInit (): void {
    this.isEmbedded = this.route.snapshot.queryParamMap.get( 'embedded' ) === 'true';
    super.ngOnInit();
    this.readySubscription = this.ready$.subscribe( ( isReady ) => {
      if ( isReady && this.tenantId ) {
        this.loadActivePlan( this.tenantId );
      }
    } );
  }

  override ngOnDestroy (): void {
    super.ngOnDestroy();
    this.planSubscription?.unsubscribe();
  }

  onTasksChange ( tasks: Task[] ): void {
    this.tasks = tasks;
  }

  selectView ( view: 'summary' | 'work' | 'board' ): void {
    this.activeView = view;
  }

  async signIn (): Promise<void> {
    try {
      await this.authService.signInWithGoogle();
    } catch ( error ) {
      this.logger.error( '[MarketingPlanBoard] sign-in failed', error );
    }
  }

  private loadActivePlan ( tenantId: string ): void {
    this.planSubscription?.unsubscribe();
    const today = new Intl.DateTimeFormat( 'en-CA', { timeZone: 'America/Los_Angeles' } ).format( new Date() );
    this.planSubscription = combineLatest( [
      this.marketingEmployeeService.watchMarketingPlans( tenantId, DEFAULT_MARKETING_EMPLOYEE_ID, { status: 'active', limit: 1 } ),
      this.marketingEmployeeService.watchCurrentWork( tenantId, DEFAULT_MARKETING_EMPLOYEE_ID, { plannedForDate: today } ),
      this.marketingEmployeeService.watchPendingApprovals( tenantId, DEFAULT_MARKETING_EMPLOYEE_ID, { plannedForDate: today } ),
      this.marketingEmployeeService.watchCompletedWork( tenantId, DEFAULT_MARKETING_EMPLOYEE_ID, { plannedForDate: today } )
    ] )
      .subscribe( {
        next: ( [plans, current, pending, completed] ) => {
          this.activePlan = ( Array.isArray( plans ) && plans.length > 0 ) ? plans[0] : null;
          const linked = [...current, ...pending, ...completed].filter( action => String( action.sourcePlanId || '' ) === String( this.activePlan?.id || '' ) );
          this.planLinkedWorkCount = linked.length;
          this.planEvidenceLabel = linked.length > 0 ? 'Maya is working from this plan' : 'No linked execution evidence yet';
          this.planEvidenceDetail = linked.length > 0
            ? `${linked.length} current, review, or completed item${linked.length === 1 ? '' : 's'} explicitly reference this written plan.`
            : 'The plan exists in TODD, but the current work records do not yet prove that Maya has started following it.';
          this.planLoading = false;
        },
        error: ( error ) => {
          this.logger.error( '[MarketingPlanBoard] failed to load active plan', error );
          this.planLoading = false;
        }
      } );
  }
}
