import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TopDogComponent } from '../../../core/top-dog/top-dog.component';
import { AuthService } from '../../../services/auth.service';
import { SettingsService } from '../../../services/settings.service';
import { SoundService } from '../../../services/sound.service';
import { LoggerService } from '../../../services/logger.service';
import { Router } from '@angular/router';
import { NomenclatureService } from '../../../services/nomenclature.service';
import { Task } from '../../../shared/data/interfaces/task.model';
import { BehaviorSubject, map, shareReplay } from 'rxjs';
import { Dropdown } from '../../../shared/data/interfaces/dropdown.model';
import { TruncatePipe } from '../../../shared/pipes/truncate.pipe';
import { PreloaderComponent } from '../../../shared/page/preloader/preloader.component';


type Mode = 'hover' | 'panel' | 'page';

@Component( {
  selector: 'app-project-view',
  imports: [CommonModule,
    PreloaderComponent,
    TruncatePipe
  ],
  templateUrl: './project-view.component.html',
  styleUrl: './project-view.component.css'
} )
export class ProjectViewComponent extends TopDogComponent implements OnInit {
  @Input() mode: Mode = 'page';
  @Input() showToolbar = true;
  private projectSubject = new BehaviorSubject<Dropdown | null>( null );
  @Input() set project ( value: Dropdown | null | undefined ) {
    this.projectSubject.next( value ?? null );
    this.logger.info( 'ProjectView received project input:', value );
  }
  readonly project$ = this.projectSubject.asObservable();
  readonly projectName$ = this.project$.pipe( map( p => p?.name ?? '' ) );


  private tasksSubject = new BehaviorSubject<Task[]>( [] );
  @Input() set tasks ( value: Task[] | null | undefined ) {
    this.tasksSubject.next( value ?? [] );
  }
  readonly tasks$ = this.tasksSubject.asObservable().pipe(
    shareReplay( { bufferSize: 1, refCount: true } )
  );



  constructor ( protected override authService: AuthService,
    protected override settingsService: SettingsService,
    protected override soundService: SoundService,
    protected override logger: LoggerService,
    protected override router: Router,
    protected override nomenclatureService: NomenclatureService,
  ) {
    super( authService, settingsService, soundService, logger, router, nomenclatureService );

  }

  override ngOnInit (): void {
    super.ngOnInit();
    this.logger.info( 'ProjectView initialized' );
  }


  // --------- Helpers ---------
  private ms ( d: any ): number {
    if ( !d ) return Number.POSITIVE_INFINITY;
    if ( d instanceof Date ) return d.getTime();
    if ( typeof d === 'string' ) return new Date( d ).getTime() || Number.POSITIVE_INFINITY;
    if ( d?.toDate ) return d.toDate().getTime();
    return Number.POSITIVE_INFINITY;
  }
  private isOpen ( t: Task ): boolean {
    const s = ( t.status ?? '' ).toLowerCase();
    return s !== 'done' && s !== 'complete' && t.progress !== 100;
  }

  // --------- Derivations / rollups ---------

  readonly stats$ = this.tasks$.pipe(
    map( tasks => {
      const flat = this.flatten( tasks );
      const now = Date.now();
      const open = flat.filter( t => this.isOpen( t ) );
      const done = flat.filter( t => !this.isOpen( t ) );
      const overdue = open.filter( t => this.ms( t.dueDate ) < now );
      const due7 = open.filter( t => {
        const m = this.ms( t.dueDate );
        return m >= now && m <= now + 7 * 86400000;
      } );
      const pct = flat.length ? Math.round( ( done.length / flat.length ) * 100 ) : 0;

      // scope (simple): epics are tasks with subTasks
      const epics = tasks.filter( t => ( t.subTasks?.length ?? 0 ) > 0 ).length;
      return { total: flat.length, open: open.length, done: done.length, overdue: overdue.length, due7: due7.length, pct, epics };
    } )
  );

  readonly lanes$ = this.tasks$.pipe(
    map( tasks => {
      const flat = this.flatten( tasks );
      const group = ( s: string ) => flat.filter( t => ( t.status ?? '' ).toLowerCase() === s );
      return {
        todo: group( 'todo' ),
        doing: group( 'doing' ),
        blocked: group( 'blocked' ),
        done: group( 'done' )
      };
    } )
  );

  readonly upcoming$ = this.tasks$.pipe(
    map( tasks => {
      const flat = this.flatten( tasks ).filter( t => this.isOpen( t ) ).sort( ( a, b ) => this.ms( a.dueDate ) - this.ms( b.dueDate ) );
      return flat.slice( 0, 8 );
    } )
  );

  readonly risks$ = this.tasks$.pipe(
    map( tasks => {
      const flat = this.flatten( tasks );
      return flat.filter( t => t.needsAttention || ( t.status ?? '' ).toLowerCase() === 'blocked' ).slice( 0, 5 );
    } )
  );

  readonly team$ = this.tasks$.pipe(
    map( tasks => {
      const ids = new Set<string>();
      this.flatten( tasks ).forEach( t => ( t.contactIds ?? [] ).forEach( id => ids.add( id ) ) );
      return Array.from( ids );
    } )
  );

  // flatten tasks + subtasks into a single list for rollups
  private flatten ( tasks: Task[] = [] ): Task[] {
    const out: Task[] = [];
    const walk = ( t: Task ) => {
      out.push( t );
      ( t.subTasks ?? [] ).forEach( walk );
    };
    tasks.forEach( walk );
    return out;
  }

  // UI events

  trackById = ( _: number, t: Task ) => t?.id ?? _;
}
