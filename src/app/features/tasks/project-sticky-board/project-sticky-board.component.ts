import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnDestroy, OnInit, Output, signal, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Task } from '../../../shared/data/interfaces/task.model';
import { Timestamp } from 'firebase/firestore';
import { Observable, Subject, Subscription, map, shareReplay, takeUntil, tap } from 'rxjs';

import { DataService } from '../../../services/data.service';
import { TopDogComponent } from '../../../core/top-dog/top-dog.component';
import { AuthService } from '../../../services/auth.service';
import { SettingsService } from '../../../services/settings.service';
import { SoundService } from '../../../services/sound.service';
import { LoggerService } from '../../../services/logger.service';
import { Router } from '@angular/router';
import { NomenclatureService } from '../../../services/nomenclature.service';
import { ENDPOINTS } from '../../../services/endpoints';
import { Dropdown } from '../../../shared/data/interfaces/dropdown.model';
import { InputTypeAheadComponent } from '../../../shared/page/input-type-ahead/input-type-ahead.component';
import { TaskCountdownPipe } from '../../../shared/pipes/task-countdown.pipe';
import { DropDownEditButtonComponent } from '../../../shared/page/drop-down-edit-button/drop-down-edit-button.component';

import { PreloaderComponent } from '../../../shared/page/preloader/preloader.component';


@Component( {
  selector: 'app-project-sticky-board',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTypeAheadComponent, TaskCountdownPipe,
    PreloaderComponent, DropDownEditButtonComponent
  ],
  templateUrl: './project-sticky-board.component.html',
  styleUrls: ['./project-sticky-board.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class ProjectStickyBoardComponent extends TopDogComponent implements OnInit, OnDestroy {
  @Input( { required: true } ) projectId!: string;

  // simple client-side filters (optional)
  search = signal<string>( '' );
  status = signal<string | null>( null ); // e.g., 'todo' | 'doing' | 'done' if you use status
  selectedProject!: any;
  selectedTaskType!: any;
  @Output() selectedProjectEvent = new EventEmitter<any>();
  @Output() selectedTaskTypeEvent = new EventEmitter<string>();
  @Output() tasksChange = new EventEmitter<Task[]>();
  statusFilter: string | null = null;
  tasks$!: Observable<Task[]>;
  private destroy$ = new Subject<void>();
  private getDropdownDataSubscription!: Subscription;
  dropdownData: { [key: string]: any[]; } = {}; // To store the fetched dropdown data

  allTasks: Task[] = [];
  filteredTasks: Task[] = [];

  constructor (
    protected override authService: AuthService,
    protected override settingsService: SettingsService,
    protected override soundService: SoundService,
    protected override logger: LoggerService,
    protected override router: Router,
    protected override nomenclatureService: NomenclatureService,
    private data: DataService ) {
    super( authService, settingsService, soundService, logger, router, nomenclatureService );
  }

  override ngOnInit (): void {
    super.ngOnInit();
    this.readySubscription = this.ready$.subscribe( ( isReady ) => {
      this.logger.info( "PROJECT STICKY COMPONENT READY?", isReady );
      if ( isReady ) {
        this.fetchDropdownData(); // Fetch dropdown data on initialization

        if ( !this.projectId ) {
          this.logger.warn( 'ProjectStickyBoardComponent: No projectId provided. Cannot load tasks.' );
          return;
        }
        this.loadTasks( this.projectId );
      }
    } );
  }

  ngOnChanges ( changes: SimpleChanges ): void {
    if ( changes['projectId'] && changes['projectId'].currentValue ) {
      const pid = changes['projectId'].currentValue;
      this.logger.info( 'ProjectStickyBoardComponent: projectId changed to', pid );
      this.loadTasks( pid );
    }
  }

  private loadTasks ( projectId: string ) {
    if ( !projectId ) return;
    if ( !this.userId ) {
      this.logger.warn( 'loadTasks: userId not ready yet' );
      return;
    }
    this.logger.info( 'Loading tasks for projectId', projectId );
    this.tasks$ = this.data.getTasksByProject$( projectId, this.userId ).pipe(
      map( tasks => this.sortByDueDateAsc( tasks || [] ) ),
      tap( sorted => {
        this.allTasks = sorted;
        this.applyFilters();
        this.tasksChange.emit( sorted );
        this.isLoading = false;
      } ),
      shareReplay( 1 )
    );
    this.tasks$
      .pipe( takeUntil( this.destroy$ ) )
      .subscribe();
  }


  setStatus ( v: string | null ) {
    this.status.set( v );
    this.applyFilters();
  }

  // trackBy for perf
  trackById = ( _: number, t: Task ) => t.id ?? t.title;


  override ngOnDestroy (): void {
    super.ngOnDestroy();
    this.destroy$.next();
    this.destroy$.complete();
    if ( this.getDropdownDataSubscription ) this.getDropdownDataSubscription.unsubscribe();

  }

  onDetail ( task: Task ) {
    this.router.navigate( ['/task', task.id] );
  }

  onTaskTypeChange ( value: any ) {
    // Empty string from the "All task types" option should clear the filter
    this.selectedTaskType = value || null;
    this.selectedTaskTypeEvent.emit( this.selectedTaskType );
    this.applyFilters();
  }


  handleProjectChange ( selected: Dropdown | Dropdown[] ): void {
    this.logger.info( "SELECTED PROJECT", selected );
    this.selectedProjectEvent.emit( selected );
    if ( Array.isArray( selected ) ) {
      this.selectedProject = selected;
      if ( selected.length > 0 ) {
        this.projectId = selected[0].id; // extract ID from first project

      }
    } else {
      this.selectedProject = [selected];
      this.projectId = selected.id; // extract ID from single project
    }

    this.logger.info( "Set projectId to:", this.projectId );
    this.loadTasks( this.projectId );
  }



  fetchDropdownData () {
    if ( this.getDropdownDataSubscription )
      this.getDropdownDataSubscription.unsubscribe();


    const endpoints: ( keyof typeof ENDPOINTS )[] = ['PROJECTS', 'TASK_TYPES'];
    endpoints.forEach( endpoint => {
      this.getDropdownDataSubscription = this.data.getDropdownData( endpoint, this.userId ).subscribe(
        data => {
          this.dropdownData[endpoint] = data;
        },
        error => {
          this.logger.error( `Error fetching data for endpoint ${endpoint}:`, error );
        }
      );
    } );
  }

  applyFilters () {
    const currentStatus = this.status();
    const selectedType = this.selectedTaskType;

    this.filteredTasks = this.allTasks.filter( task => {
      const statusMatch = currentStatus ? task.status === currentStatus : true;
      const typeMatch = selectedType ? task.taskTypeId === selectedType : true;
      return statusMatch && typeMatch;
    } );
  }

  // normalize dueDate (Date | string | Timestamp | undefined) to a number for sorting
  private dueMs ( d: any ): number {
    if ( !d ) return Number.POSITIVE_INFINITY;          // no due date -> push to bottom
    if ( d instanceof Date ) return d.getTime();
    if ( typeof d === 'string' ) return new Date( d ).getTime() || Number.POSITIVE_INFINITY;
    if ( ( d as Timestamp )?.toDate ) return ( d as Timestamp ).toDate().getTime();
    return Number.POSITIVE_INFINITY;
  }

  private sortByDueDateAsc<T extends { dueDate?: any; lastUpdated?: any; }> ( arr: T[] ): T[] {
    return [...arr].sort( ( a, b ) => {
      const aMs = this.dueMs( a.dueDate );
      const bMs = this.dueMs( b.dueDate );
      if ( aMs !== bMs ) return aMs - bMs;
      // tie-breaker: lastUpdated desc (newer first)
      const au = this.dueMs( a.lastUpdated );
      const bu = this.dueMs( b.lastUpdated );
      return bu - au;
    } );
  }



}