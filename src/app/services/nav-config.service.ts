import { Injectable } from '@angular/core';
import { NavItem, QuickAction } from '../shared/data/interfaces/nav-config.models';
import { PageAction } from '../shared/data/interfaces/page-actions.models';
import { SettingsService } from './settings.service';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';
import { getFindHomeUrl, getSayitHomeUrl, getSignatureBuilderUrl } from '../shared/utils/public-app-url.util';


@Injectable( {
  providedIn: 'root'
} )
export class NavConfigService {
  private openInNewTab ( url: string ): void {
    if ( typeof window === 'undefined' ) return;
    window.open( url, '_blank', 'noopener,noreferrer' );
  }

  private readonly allItems: NavItem[] = [
    {
      label: 'Contacts',
      icon: 'tabler:users',
      route: '/contact-list',
      feature: 'contact',
      description: 'Browse, filter, and manage contacts',
      children: [
        { label: 'Netowrk Home', route: '/network/app', description: 'Network Home' },
        { label: 'Add Contact', route: '/contact-edit', description: 'Create a new contact' },
        { label: 'Import Contacts', route: '/contact-import', description: 'Bulk import from CSV' },
        { label: 'Contact Overview', route: '/network/app', description: 'Charts & recent activity' },
        { label: 'Pipeline', route: '/contact-deal-flow', description: 'Check the health of your Pipeline' }
      ]
    },
    {
      label: 'Communication',
      icon: 'tabler:mail',
      route: '/compose-email',
      feature: 'communication',
      description: 'Draft emails and manage outbound messages',
      children: [
        { label: 'Outreach Home', route: '/outreach/app', description: 'Outreach Home' },
        { label: 'Compose Email', route: '/compose-email', description: 'Write a new message with AI' },
        { label: 'Inbox', route: '/inbox-access', description: 'Setup and access to your external inbox' },
        { label: 'Catalyst', route: '/email-processor', description: 'Process email activity, review signals, and find the next useful outreach move.' },
        { label: 'Engagement', route: '/engagement', description: 'See who opened, clicked, replied, or showed activity that deserves a follow-up.' },
      ]
    },
    {
      label: 'Pulse',
      icon: 'tabler:chart-bar',
      route: '/survey',
      feature: 'survey',
      description: 'Create, send, and analyze surveys (Pulse)',
      children: [
        { label: 'Pulse Home', route: '/pulse/app', description: 'Pulse Home' },
        { label: 'Pulses', route: '/survey-list', description: 'All Pulses' },
        { label: 'Create Pulse', route: '/survey', description: 'New Pulse builder' },
        { label: 'Pulse Dashboard', route: '/survey-dashboard', description: 'Charts & responses' }
      ]
    },
    {
      label: 'Documents',
      icon: 'tabler:folder',
      route: '/documents',
      feature: 'documents',
      description: 'Docs, notes, and uploads',
      children: [
        { label: 'Docs Home', route: '/docs/app', description: 'Document Home' },
        { label: 'Docs', route: '/documents', description: 'Browse and search documents' },
        { label: 'Upload', route: '/document', description: 'Upload a new document' },
        { label: 'Editor', route: '/document-editor', description: 'Create a new document or edit existing one' },
        { label: 'Proposals', route: '/proposal-history', description: 'History of proposals' },
        { label: 'RFP Upload', route: '/rfp-upload', description: 'Upload an RFP and create a Proposal from the RFP' }
      ]
    },
    {
      label: 'Moves',
      icon: 'tabler:checklist',
      route: '/tasks',
      feature: 'tasks',
      description: 'Plan and track tasks',
      children: [
        { label: 'Moves Home', route: '/moves/app', description: 'Moves Home' },
        { label: 'Open Moves', route: '/tasks', description: 'All Moves' },
        { label: 'New Task', route: '/task-edit', description: 'Create a Move' },
        { label: 'Mission', route: '/mission', description: 'Mission' }
      ]
    },
    {
      label: 'Knowledge Base',
      icon: 'tabler:book',
      route: '/knowledge-base',
      feature: 'assistant',
      description: 'Articles and how-tos'
    },
    {
      label: 'Admin',
      icon: 'tabler:shield-cog',
      route: '/admin',
      feature: 'admin',
      description: 'TODD Administration'
    },
    {
      label: 'Settings',
      icon: 'tabler:settings',
      route: '/settings',
      feature: 'settings',
      description: 'Preferences and configuration'
    }
  ];

  constructor ( private settings: SettingsService, private auth: AuthService ) { }

  /** Full, unfiltered nav for diagnostics or admin */
  getAll (): NavItem[] { return this.allItems; }

  /** Feature-flag filtered nav tree */
  getFiltered (): NavItem[] {
    const flags = this.getFeatureFlags();
    // if all are false, fall back to show all (keeps your current behavior)
    const allDisabled = Object.values( flags ).every( v => v === false );
    if ( allDisabled ) return this.allItems;

    return this.allItems.filter( it => flags[it.feature as keyof typeof flags] !== false );
  }

  /** Flat quick actions, capped; derived from filtered nav + common children */
  getQuickActions ( max = 6 ): QuickAction[] {
    const filtered = this.getFiltered();
    const primary = filtered.map( it => ( { label: it.label, route: it.route, hint: it.description, icon: it.icon } ) );

    // include a few high-value children (Add, Import, Compose, Upload)
    const children: QuickAction[] = [];
    for ( const it of filtered ) {
      if ( !it.children ) continue;
      for ( const c of it.children ) {
        if ( /^(Add|Import|Compose Email|Upload|List|Overview|Pipeline)$/i.test( c.label ) ) {
          children.push( { label: c.label, route: c.route, hint: c.description } );
        }
      }
    }

    const dedup = new Map<string, QuickAction>();
    [...primary, ...children].forEach( a => dedup.set( a.route, a ) );
    return Array.from( dedup.values() ).slice( 0, max );
  }

  /** Export a route→label map so Assistant keeps labels consistent for buttons */
  getRouteLabelMap (): Record<string, string> {
    const map: Record<string, string> = {};
    for ( const it of this.allItems ) {
      map[it.route] = it.label;
      it.children?.forEach( c => map[c.route] = c.label );
    }
    // Include parameterized variants that show up in answers
    map['/survey-dashboard'] = 'Survey Dashboard';
    map['/survey-dashboard/:surveyId'] = 'Survey Dashboard';
    return map;
  }

  getAssistantRouteAliases (): Record<string, string> {
    const aliases: Record<string, string> = {};
    const addAlias = ( label: string, route: string ) => {
      const normalizedLabel = this.normalizeAssistantAlias( label );
      const normalizedRoute = this.normalizeAssistantRoute( route );
      if ( !normalizedLabel || !normalizedRoute ) return;
      aliases[normalizedLabel] = normalizedRoute;
    };

    const routeLabelMap = this.getRouteLabelMap();
    for ( const [route, label] of Object.entries( routeLabelMap ) ) {
      addAlias( label, route );
    }

    // Main TODD navigation labels live outside the nav-config tree today, so
    // register them here once for Ask TODD instead of duplicating them in the
    // assistant service.
    addAlias( 'Relationships', '/network/app' );
    addAlias( 'Growth', '/outreach/app' );
    addAlias( 'Knowledge', '/docs/app' );
    addAlias( 'Execution', '/moves/app' );
    addAlias( 'Feedback', '/pulse/app' );
    addAlias( 'Signals', '/signal-engine' );
    addAlias( 'Momentum', '/daily-momentum' );
    addAlias( 'Visibility', '/outreach/social/command' );
    addAlias( 'Profile', '/update-profile' );
    addAlias( 'Billing', '/billing' );
    addAlias( 'Help', '/help' );

    return aliases;
  }

  private normalizeAssistantAlias ( value: string ): string {
    return String( value || '' )
      .trim()
      .toLowerCase()
      .replace( /[^a-z0-9]+/g, ' ' )
      .replace( /\s+/g, ' ' )
      .trim();
  }

  private normalizeAssistantRoute ( value: string ): string {
    const trimmed = String( value || '' ).trim();
    if ( !trimmed ) return '';
    return trimmed.startsWith( '/' ) ? trimmed.slice( 1 ) : trimmed;
  }

  getGlobalPageActions (): PageAction[] {
    return [
      {
        id: 'global-ask-todd',
        label: 'Ask TODD',
        image: '/assets/TODD-icon.png',
        kind: 'route',
        context: 'todd',
        feature: 'global',
        route: '/ask-todd',
        order: 205,
        group: 'global',
        pinned: true
      },
      {
        id: 'global-talk-to-maya',
        label: 'Maya',
        image: '/assets/marketing/marketing-director-avatar.png',
        kind: 'route',
        context: 'todd',
        feature: 'global',
        route: '/marketing-director/session',
        order: 206,
        group: 'global',
        pinned: true
      },
      {
        id: 'global-divider-free-tools',
        kind: 'separator',
        context: 'all',
        order: 300,
        group: 'global'
      },
      {
        id: 'global-heading-free-tools',
        label: 'Free Tools',
        kind: 'heading',
        context: 'all',
        order: 301,
        group: 'global'
      },
      {
        id: 'global-tool-taliferro-music',
        label: 'Taliferro Music',
        image: '/assets/find/entities/music/logo-icon.png',
        kind: 'callback',
        context: 'all',
        handler: () => this.openInNewTab( 'https://music.taliferro.com' ),
        order: 330,
        group: 'global'
      },
      {
        id: 'global-tool-find',
        label: 'Find',
        image: '/assets/find/entities/find/logo-icon.png',
        kind: 'callback',
        context: 'all',
        handler: () => this.openInNewTab( getFindHomeUrl() ),
        order: 331,
        group: 'global'
      },
      {
        id: 'global-tool-sayit',
        label: 'SayIt',
        image: '/assets/find/entities/sayit/logo-icon.png',
        kind: 'callback',
        context: 'all',
        handler: () => this.openInNewTab( getSayitHomeUrl() ),
        order: 332,
        group: 'global'
      },
      {
        id: 'global-tool-email-signature-builder',
        label: 'Email Signature Builder',
        image: '/assets/find/entities/email-signature-builder/logo-icon.png',
        kind: 'callback',
        context: 'all',
        handler: () => this.openInNewTab( getSignatureBuilderUrl() ),
        order: 333,
        group: 'global'
      },
      {
        id: 'global-divider-user',
        kind: 'separator',
        context: 'todd',
        order: 400,
        group: 'global'
      },
      {
        id: 'global-profile',
        label: 'Profile',
        icon: 'fa-solid fa-user',
        kind: 'route',
        context: 'todd',
        feature: 'global',
        route: '/update-profile',
        order: 410,
        group: 'global',
        pinned: true
      },
      {
        id: 'global-admin',
        label: 'Admin',
        icon: 'fa-solid fa-shield-halved',
        kind: 'route',
        context: 'todd',
        feature: 'global',
        route: '/admin',
        order: 415,
        group: 'global',
        pinned: true,
        visible: () => this.auth.getCurrentUserIdSync() === environment.taliferroTenantId
      },
      {
        id: 'global-logout',
        label: 'Log Out',
        icon: 'fa-solid fa-right-from-bracket',
        kind: 'route',
        context: 'todd',
        feature: 'global',
        route: '/logout',
        order: 420,
        group: 'global',
        pinned: true
      },
      {
        id: 'global-help',
        label: 'Help',
        icon: 'fa-solid fa-circle-question',
        kind: 'route',
        context: 'todd',
        feature: 'global',
        route: '/help',
        order: 430,
        group: 'global',
        pinned: true
      },
    ];
  }

  getNetworkPageActions (): PageAction[] {
    return [
      {
        id: 'network-home',
        label: 'Network Home',
        icon: 'fa-solid fa-house',
        kind: 'route',
        context: 'todd',
        feature: 'network',
        route: '/network/app',
        order: 0,
        group: 'context'
      },
      {
        id: 'network-contacts',
        label: 'Contacts',
        icon: 'fa-solid fa-address-book',
        kind: 'route',
        context: 'todd',
        feature: 'network',
        route: '/contact-list',
        order: 20,
        group: 'context'
      },
      {
        id: 'network-add-contact',
        label: 'Add Contact',
        icon: 'fa-solid fa-user-plus',
        kind: 'route',
        context: 'todd',
        feature: 'network',
        route: '/contact-edit',
        order: 30,
        group: 'context'
      },
      {
        id: 'network-import-contacts',
        label: 'Import Contacts',
        icon: 'fa-solid fa-file-import',
        kind: 'route',
        context: 'todd',
        feature: 'network',
        route: '/contact-import',
        order: 40,
        group: 'context'
      },
      {
        id: 'network-pipeline',
        label: 'Pipeline',
        icon: 'fa-solid fa-diagram-project',
        kind: 'route',
        context: 'todd',
        feature: 'network',
        route: '/contact-deal-flow',
        order: 50,
        group: 'context'
      },
      {
        id: 'network-match-maker',
        label: 'Match Maker',
        icon: 'fa-solid fa-people-arrows',
        kind: 'route',
        context: 'todd',
        feature: 'network',
        route: '/match-maker',
        order: 60,
        group: 'context'
      }
    ];
  }

  getOutreachPageActions (): PageAction[] {
    const action = ( config: Pick<PageAction, 'id' | 'label' | 'icon' | 'route' | 'order'> ): PageAction => ( {
      ...config,
      kind: 'route',
      context: 'todd',
      feature: 'outreach',
      group: 'context'
    } );

    return [
      action( { id: 'outreach-home', label: 'Outreach Home', icon: 'fa-solid fa-house', route: '/outreach/app', order: 0 } ),
      action( { id: 'outreach-compose-email', label: 'Compose Email', icon: 'fa-solid fa-envelope', route: '/compose-email', order: 20 } ),
      action( { id: 'outreach-inbox', label: 'Inbox', icon: 'fa-solid fa-inbox', route: '/inbox-access', order: 30 } ),
      action( { id: 'outreach-signal-engine', label: 'Signal Engine', icon: 'fa-solid fa-tower-broadcast', route: '/signal-engine', order: 40 } ),
      action( { id: 'outreach-catalyst', label: 'Catalyst', icon: 'fa-solid fa-wand-magic-sparkles', route: '/email-processor', order: 50 } ),
      action( { id: 'outreach-engagement', label: 'Email Engagement', icon: 'fa-solid fa-chart-line', route: '/engagement', order: 60 } ),
      {
        ...action( { id: 'outreach-signature-builder', label: 'Signature Builder', icon: 'fa-solid fa-signature', route: undefined, order: 80 } ),
        kind: 'callback',
        handler: () => this.openInNewTab( getSignatureBuilderUrl() )
      }
    ];
  }

  getDocumentPageActions (): PageAction[] {
    const action = ( config: Pick<PageAction, 'id' | 'label' | 'icon' | 'route' | 'order'> ): PageAction => ( {
      ...config,
      kind: 'route',
      context: 'todd',
      feature: 'docs',
      group: 'context'
    } );

    return [
      action( { id: 'documents-home', label: 'Docs Home', icon: 'fa-regular fa-folder', route: '/docs/app', order: 0 } ),
      action( { id: 'documents', label: 'Documents', icon: 'fa-solid fa-folder-open', route: '/documents', order: 20 } ),
      action( { id: 'documents-knowledge-base', label: 'Knowledge Base', icon: 'fa-solid fa-book-open', route: '/knowledge-base', order: 30 } ),
      action( { id: 'documents-response-flow', label: 'Response Flow', icon: 'fa-solid fa-layer-group', route: '/response-flow', order: 40 } ),
      action( { id: 'documents-editor', label: 'Editor', icon: 'fa-solid fa-file-lines', route: '/document-editor', order: 50 } ),
      action( { id: 'documents-proposal-history', label: 'Proposal History', icon: 'fa-solid fa-clock-rotate-left', route: '/proposal-history', order: 60 } ),
      action( { id: 'documents-rfp-list', label: 'RFPs', icon: 'fa-solid fa-folder-open', route: '/rfp-list', order: 70 } ),
      action( { id: 'documents-rfp-upload', label: 'RFP Upload', icon: 'fa-solid fa-upload', route: '/rfp-upload', order: 80 } )
    ];
  }

  getMovesPageActions (): PageAction[] {
    const action = ( config: Pick<PageAction, 'id' | 'label' | 'icon' | 'route' | 'order'> ): PageAction => ( {
      ...config,
      kind: 'route',
      context: 'todd',
      feature: 'moves',
      group: 'context'
    } );

    return [
      action( { id: 'moves-home', label: 'Moves Home', icon: 'fa-solid fa-house', route: '/moves/app', order: 0 } ),
      action( { id: 'moves-board', label: 'Execution Board', icon: 'fa-solid fa-list-check', route: '/moves-view', order: 20 } ),
      action( { id: 'moves-create', label: 'Create a Move', icon: 'fa-solid fa-square-plus', route: '/move', order: 30 } ),
      action( { id: 'moves-mission', label: 'Mission Workspace', icon: 'fa-solid fa-compass', route: '/mission', order: 40 } ),
      action( { id: 'moves-ai-missions', label: 'AI Missions', icon: 'fa-solid fa-robot', route: '/moves/ai-missions', order: 50 } )
    ];
  }

  getPulsePageActions (): PageAction[] {
    const action = ( config: Pick<PageAction, 'id' | 'label' | 'icon' | 'route' | 'order'> ): PageAction => ( {
      ...config,
      kind: 'route',
      context: 'todd',
      feature: 'pulse',
      group: 'context'
    } );

    return [
      action( { id: 'pulse-home', label: 'Pulse Home', icon: 'fa-solid fa-house', route: '/pulse/app', order: 0 } ),
      action( { id: 'pulse-list', label: 'Pulses', icon: 'fa-solid fa-list-check', route: '/survey-list', order: 20 } ),
      action( { id: 'pulse-create', label: 'Create Pulse', icon: 'fa-solid fa-square-plus', route: '/survey-edit', order: 30 } ),
      action( { id: 'pulse-dashboard', label: 'Pulse Dashboard', icon: 'fa-solid fa-chart-line', route: '/survey-dashboard', order: 40 } )
    ];
  }

  getAdminPageActions (): PageAction[] {
    const action = ( config: Pick<PageAction, 'id' | 'label' | 'icon' | 'route' | 'order'> ): PageAction => ( {
      ...config,
      kind: 'route',
      context: 'todd',
      feature: 'admin',
      group: 'context'
    } );

    return [
      action( { id: 'admin-dropdown-manager', label: 'Dropdown Manager', icon: 'fa-solid fa-list-check', route: '/dropdown-manager', order: 20 } ),
      action( { id: 'admin-update-profile', label: 'Update Profile', icon: 'fa-solid fa-user-pen', route: '/update-profile', order: 30 } ),
      action( { id: 'admin-app-dashboard', label: 'App Dashboard', icon: 'fa-solid fa-table-columns', route: '/app-dashboard', order: 40 } ),
      {
        ...action( { id: 'admin-affiliates', label: 'Affiliates', icon: 'fa-solid fa-handshake', route: '/affiliates', order: 50 } ),
        visible: () => this.auth.getCurrentUserIdSync() === environment.taliferroTenantId
      }
    ];
  }

  /** Feature flags (mirrors your Start Page logic) */
  private getFeatureFlags () {
    const featureFlags: Record<string, boolean> = {
      contact: this.settings.isContactFeatureEnabled( 'Contacts' ),
      communication: this.settings.isCommunicationFeatureEnabled( 'Communication' ),
      survey: this.settings.isSurveyFeatureEnabled( 'Surveys' ),
      documents: this.settings.isdocumentManagementFeatureEnabled( 'Documents' ),
      tasks: this.settings.isTaskFeatureEnabled( 'Task Management' ),
      settings: true,
      tour: true,
      assistant: true,
      cleanup: true,
    };

    // fallback defaults like your Start Page
    for ( const k of Object.keys( featureFlags ) ) {
      if ( featureFlags[k] === false && !['cleanup', 'settings', 'tour', 'assistant'].includes( k ) ) {
        featureFlags[k] = true;
      }
    }
    return featureFlags;
  }
}
