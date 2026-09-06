import { PageAction } from '../data/interfaces/page-actions.models';
import { getSignatureBuilderUrl } from './public-app-url.util';

interface DocumentPageActionOptions {
  includeNotes?: boolean;
  noteVisible?: () => boolean;
  noteHandler?: () => void;
  includeMenuEditor?: boolean;
}

interface OutreachPageActionOptions {
  includeCatalyst?: boolean;
  extraActions?: PageAction[];
}

const OUTREACH_BASE_PAGE_ACTIONS: PageAction[] = [
  {
    id: 'outreach-home',
    label: 'Outreach Home',
    icon: 'fa-solid fa-house-signal',
    kind: 'route',
    route: '/outreach/app',
    order: 10,
    feature: 'outreach',
    group: 'context',
  },
  {
    id: 'outreach-compose-email',
    label: 'Compose Email',
    icon: 'fa-solid fa-envelope',
    kind: 'route',
    route: '/compose-email',
    order: 20,
    feature: 'outreach',
    group: 'context',
  },
  {
    id: 'outreach-inbox',
    label: 'Inbox',
    icon: 'fa-solid fa-inbox',
    kind: 'route',
    route: '/inbox-access',
    order: 30,
    feature: 'outreach',
    group: 'context',
  },
  {
    id: 'outreach-signal-engine',
    label: 'Signal Engine',
    icon: 'fa-solid fa-tower-broadcast',
    kind: 'route',
    route: '/signal-engine',
    order: 40,
    feature: 'outreach',
    group: 'context',
  },
  {
    id: 'outreach-catalyst',
    label: 'Catalyst',
    icon: 'fa-solid fa-wand-magic-sparkles',
    kind: 'route',
    route: '/email-processor',
    order: 70,
    feature: 'outreach',
    group: 'context',
  },
  {
    id: 'outreach-email-engagement',
    label: 'Email Engagement',
    icon: 'fa-solid fa-chart-line',
    kind: 'route',
    route: '/engagement',
    order: 80,
    feature: 'outreach',
    group: 'context',
  },
  {
    id: 'outreach-signature-builder',
    label: 'Signature Builder',
    icon: 'fa-solid fa-signature',
    kind: 'callback',
    handler: () => {
      if ( typeof window !== 'undefined' ) window.open( getSignatureBuilderUrl(), '_blank', 'noopener' );
    },
    order: 120,
    feature: 'outreach',
    group: 'context',
  },
];

export function buildDocumentPageActions ( options: DocumentPageActionOptions = {} ): PageAction[] {
  const actions: PageAction[] = [
    {
      id: 'documents-knowledge-base',
      label: 'Knowledge Base',
      icon: 'fa-solid fa-book-open',
      kind: 'route',
      route: '/knowledge-base',
      order: 20,
      feature: 'docs',
      group: 'context',
    },
    {
      id: 'documents-home',
      label: 'Documents',
      icon: 'fa-regular fa-folder',
      kind: 'route',
      route: '/docs/app',
      order: 0,
      feature: 'docs',
      group: 'context',
    },
    {
      id: 'documents-response-flow',
      label: 'Response Flow',
      icon: 'fa-solid fa-layer-group',
      kind: 'route',
      route: '/response-flow',
      order: 30,
      feature: 'docs',
      group: 'context',
    },
    {
      id: 'documents-editor',
      label: 'Editor',
      icon: 'fa-solid fa-file-lines',
      kind: 'route',
      route: '/document-editor',
      order: 40,
      feature: 'docs',
      group: 'context',
    },
    {
      id: 'documents-proposal-history',
      label: 'Proposal History',
      icon: 'fa-solid fa-clock-rotate-left',
      kind: 'route',
      route: '/proposal-history',
      order: 50,
      feature: 'docs',
      group: 'context',
    },
    {
      id: 'documents-rfp-upload',
      label: 'RFP Upload',
      icon: 'fa-solid fa-upload',
      kind: 'route',
      route: '/rfp-upload',
      order: 60,
      feature: 'docs',
      group: 'context',
    },
    {
      id: 'documents-rfp-list',
      label: 'RFPs',
      icon: 'fa-solid fa-folder-open',
      kind: 'route',
      route: '/rfp-list',
      order: 70,
      feature: 'docs',
      group: 'context',
    },
  ];

  if ( options.includeNotes && options.noteHandler ) {
    actions.push( {
      id: 'documents-notes',
      label: 'Notes',
      icon: 'fa-regular fa-note-sticky',
      kind: 'callback',
      handler: options.noteHandler,
      visible: options.noteVisible,
      order: 80,
      group: 'context',
    } );
  }

  if ( options.includeMenuEditor ) {
    actions.push( {
      id: 'documents-menu-editor',
      label: 'Menu Editor',
      icon: 'fa-solid fa-bars',
      kind: 'route',
      route: '/dropdown-manager',
      order: 90,
      group: 'context',
    } );
  }

  return actions;
}

export function buildOutreachPageActions ( options: OutreachPageActionOptions = {} ): PageAction[] {
  const actions: PageAction[] = OUTREACH_BASE_PAGE_ACTIONS.map( action => ( { ...action } ) );

  if ( options.includeCatalyst ) {
    // Kept for backward compatibility. Catalyst now ships in the default outreach action set.
  }

  if ( options.extraActions?.length ) {
    actions.push( ...options.extraActions );
  }

  return actions.filter( ( action, index, list ) => {
    if ( action.kind === 'separator' ) return true;
    return list.findIndex( candidate => candidate.kind === action.kind && candidate.route === action.route && candidate.id === action.id ) === index;
  } );
}
