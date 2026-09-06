import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  PageAction,
  PageActionsConfig,
  PageActionContext,
  PageActionContextScope,
} from '../shared/data/interfaces/page-actions.models';
import { NavConfigService } from './nav-config.service';

@Injectable( {
  providedIn: 'root'
} )
export class PageActionsService {
  private static readonly MOBILE_MAX_ACTIONABLE_ITEMS_WITH_GLOBALS = 8;
  private static readonly TABLET_MAX_ACTIONABLE_ITEMS_WITH_GLOBALS = 12;
  private static readonly DESKTOP_MAX_ACTIONABLE_ITEMS_WITH_GLOBALS = 20;
  private readonly configSubject =
    new BehaviorSubject<PageActionsConfig | null>( null );
  private readonly viewportWidthSubject =
    new BehaviorSubject<number>( this.getViewportWidth() );
  private readonly handleViewportResize = (): void => {
    this.viewportWidthSubject.next( this.getViewportWidth() );
  };

  readonly config$ = this.configSubject.asObservable();
  readonly viewportWidth$ = this.viewportWidthSubject.asObservable();

  readonly context$ = this.config$.pipe(
    map( ( config ): PageActionContext | null => config?.context ?? null )
  );

  readonly actions$ = combineLatest( [this.config$, this.viewportWidth$] ).pipe(
    map( ( [config, viewportWidth] ) => {
      const pageActions = config?.actions ?? [];
      const candidateGlobalActions = config?.includeGlobalActions === false
        ? []
        : this.navConfig.getGlobalPageActions();
      const pinnedGlobalActions = candidateGlobalActions.filter( action => action.pinned === true );
      const optionalGlobalActions = candidateGlobalActions.filter( action => action.pinned !== true );
      const pageActionCount = this.countActionableItems( pageActions );
      const globalActionCount = this.countActionableItems( optionalGlobalActions );
      const maxActionableItemsWithGlobals = this.getMaxActionableItemsWithGlobals( viewportWidth );
      const includeGlobalActions = pageActionCount + globalActionCount
        <= maxActionableItemsWithGlobals;
      const globalActions = [
        ...pinnedGlobalActions,
        ...( includeGlobalActions ? optionalGlobalActions : [] )
      ];
      const networkActions = this.navConfig.getNetworkPageActions();
      const outreachActions = this.navConfig.getOutreachPageActions();
      const documentActions = this.navConfig.getDocumentPageActions();
      const movesActions = this.navConfig.getMovesPageActions();
      const pulseActions = this.navConfig.getPulsePageActions();
      const adminActions = this.navConfig.getAdminPageActions();

      return this.normalizeActions( [...pageActions, ...networkActions, ...outreachActions, ...documentActions, ...movesActions, ...pulseActions, ...adminActions, ...globalActions] );
    } )
  );

  constructor (
    private navConfig: NavConfigService,
    private router: Router
  ) {
    if ( typeof window !== 'undefined' ) {
      window.addEventListener( 'resize', this.handleViewportResize );
    }
  }

  setPageActions ( config: PageActionsConfig ): void {
    this.configSubject.next( config );
  }

  clearPageActions ( pageId?: string ): void {
    const current = this.configSubject.value;

    if ( !pageId || current?.pageId === pageId ) {
      this.configSubject.next( null );
    }
  }

  isDisabled ( action: PageAction ): boolean {
    if ( typeof action.disabled === 'function' ) {
      return action.disabled();
    }

    return !!action.disabled;
  }

  isVisible ( action: PageAction ): boolean {
    if ( typeof action.visible === 'function' ) {
      return action.visible();
    }

    if ( typeof action.visible === 'boolean' ) {
      return action.visible;
    }

    return true;
  }

  private normalizeActions ( actions: PageAction[] ): PageAction[] {
    const filtered = actions
      .filter( ( action ) => this.matchesRouteContext( action ) )
      .filter( ( action ) => this.matchesFeatureContext( action ) )
      .filter( ( action ) => this.isVisible( action ) )
      .filter( ( action ) => !this.isCurrentRouteAction( action ) )
      .sort( ( a, b ) => ( a.order ?? 999 ) - ( b.order ?? 999 ) );

    const deduplicated = filtered.filter( ( action, index, list ) => {
      if ( action.kind !== 'route' || !action.route ) return true;
      return list.findIndex( candidate => candidate.kind === 'route' && candidate.route === action.route ) === index;
    } );

    return deduplicated.filter( ( action, index ) => {
      if ( action.kind !== 'separator' ) return true;

      const previous = deduplicated[index - 1];
      const next = deduplicated[index + 1];
      return previous?.kind !== 'separator' && !!next;
    } );
  }

  private countActionableItems ( actions: PageAction[] ): number {
    return actions.filter( ( action ) => action.kind !== 'separator' && action.kind !== 'heading' ).length;
  }

  private getViewportWidth (): number {
    if ( typeof window === 'undefined' ) {
      return 1440;
    }

    return Number( window.innerWidth || 0 );
  }

  private getMaxActionableItemsWithGlobals ( viewportWidth: number ): number {
    if ( viewportWidth <= 680 ) {
      return PageActionsService.MOBILE_MAX_ACTIONABLE_ITEMS_WITH_GLOBALS;
    }

    if ( viewportWidth <= 1080 ) {
      return PageActionsService.TABLET_MAX_ACTIONABLE_ITEMS_WITH_GLOBALS;
    }

    return PageActionsService.DESKTOP_MAX_ACTIONABLE_ITEMS_WITH_GLOBALS;
  }

  private matchesRouteContext ( action: PageAction ): boolean {
    const contexts = Array.isArray( action.context )
      ? action.context
      : [action.context || 'all'];

    return contexts.some( ( context: PageActionContextScope ) => {
      switch ( context ) {
        case 'say-it':
          return false;
        case 'todd':
        case 'all':
        default:
          return true;
      }
    } );
  }

  private matchesFeatureContext ( action: PageAction ): boolean {
    if ( !action.feature || action.feature === 'global' ) {
      return true;
    }

    if ( action.feature === 'network' ) {
      return this.isNetworkRoute( this.getPathname() );
    }

    if ( action.feature === 'outreach' ) {
      return this.isOutreachRoute( this.getPathname() );
    }

    if ( action.feature === 'docs' ) {
      return this.isDocumentRoute( this.getPathname() );
    }

    if ( action.feature === 'moves' ) {
      return this.isMovesRoute( this.getPathname() );
    }

    if ( action.feature === 'pulse' ) {
      return this.isPulseRoute( this.getPathname() );
    }

    if ( action.feature === 'admin' ) {
      return this.getPathname() === '/admin';
    }

    return true;
  }

  private getPathname (): string {
    return String( this.router.url || '' ).split( /[?#]/, 1 )[0].replace( /\/$/, '' ) || '/';
  }

  private isNetworkRoute ( path: string ): boolean {
    return path === '/network'
      || path === '/network/app'
      || path === '/contact-list'
      || path === '/contact-edit'
      || path === '/contact-import'
      || path === '/contact-deal-flow'
      || path === '/match-maker'
      || path.startsWith( '/contact/' );
  }

  private isOutreachRoute ( path: string ): boolean {
    return path === '/outreach'
      || path === '/outreach/app'
      || path === '/compose-email'
      || path === '/inbox-access'
      || path === '/engagement'
      || path === '/signal-engine'
      || path === '/email-processor';
  }

  private isDocumentRoute ( path: string ): boolean {
    return path === '/docs'
      || path === '/docs/app'
      || path === '/documents'
      || path === '/document'
      || path === '/document-editor'
      || path.startsWith( '/document-editor/' )
      || path === '/proposal-history'
      || path === '/rfp-list'
      || path === '/rfp-upload'
      || path === '/response-flow'
      || path.startsWith( '/response-flow/' )
      || path === '/knowledge-base'
      || path === '/dropdown-manager';
  }

  private isMovesRoute ( path: string ): boolean {
    return path === '/moves'
      || path === '/moves/app'
      || path === '/task-home'
      || path === '/tasks'
      || path === '/moves-view'
      || path === '/move'
      || path.startsWith( '/move/' )
      || path === '/mission'
      || path === '/moves/ai-missions';
  }

  private isPulseRoute ( path: string ): boolean {
    return path === '/pulse'
      || path === '/pulse/app'
      || path === '/survey'
      || path === '/survey-home'
      || path === '/survey-dashboard'
      || path.startsWith( '/survey-dashboard/' )
      || path === '/survey-edit'
      || path === '/survey-list'
      || path.startsWith( '/survey-view/' );
  }

  private isCurrentRouteAction ( action: PageAction ): boolean {
    if ( action.kind !== 'route' || !action.route ) {
      return false;
    }

    const actionPath = String( action.route ).split( /[?#]/, 1 )[0].replace( /\/$/, '' ) || '/';
    return actionPath === this.getPathname();
  }
}
