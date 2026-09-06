import { Injectable } from '@angular/core';
import adsManifest from '../../assets/ads/ads-manifest.json';

import { CatalystAssistantContext } from '../features/email/components/emailer/emailer.component';
import { EmailSentAssistantContext } from '../features/email/components/email-sent/email-sent.component';
import {
  AssistantPageContext,
  ToddAssistantTranscriptMsg,
  ToddEngagementDecision
} from './todd-assistant-bus.service';

export type ToddGuestPreviewContext =
  | AssistantPageContext
  | CatalystAssistantContext
  | EmailSentAssistantContext
  | null;

export interface ToddGuestPreviewCopy {
  mode: 'guest_preview';
  title: string;
  message: string;
  ctaRoute?: string;
  ctaLabel?: string;
  displayMode?: 'text' | 'ad';
  adTitle?: string;
  adMessage?: string;
  adImageUrl?: string;
  adAlt?: string;
}

@Injectable( {
  providedIn: 'root'
} )
export class ToddGuestPreviewService {
  private readonly adManifest = adsManifest as Record<string, string[]>;
  // In-memory only (not sessionStorage): picked fresh at random on every app load/hard
  // reload, but cached per route for the life of that load so repeated getter calls within
  // one render (image/title/message are resolved independently) stay coherent and don't flicker.
  private readonly resolvedAdCache = new Map<string, { adImageUrl?: string; adTitle: string; adMessage: string; }>();
  private readonly guestAdCopy: Array<{ title: string; message: string; }> = [
    { title: 'Your business already knows more than you think.', message: 'TODD turns scattered signals into forward motion.' },
    { title: 'Momentum doesn’t happen by accident.', message: 'TODD helps your people, priorities, and decisions move together.' },
    { title: 'The next move is already in the room.', message: 'TODD helps you find it.' },
    { title: 'Your business is talking.', message: 'TODD helps you hear what matters.' },
    { title: 'Busy is not the same as moving forward.', message: 'TODD helps turn effort into momentum.' },
    { title: 'Most businesses don’t need more noise.', message: 'They need a clearer signal. TODD helps uncover it.' },
    { title: 'The work is happening. Is it adding up?', message: 'TODD helps connect daily effort to meaningful progress.' },
    { title: 'You don’t need another dashboard.', message: 'You need to know what deserves attention next.' },
    { title: 'Every decision creates momentum—or friction.', message: 'TODD helps your business choose momentum.' },
    { title: 'Your blind spots are expensive.', message: 'TODD helps you see what your business is missing.' },
    { title: 'Growth gets easier when the business moves as one.', message: 'TODD helps make that possible.' },
    { title: 'The gap between knowing and doing is where momentum disappears.', message: 'TODD helps close the gap.' },
    { title: 'A business can be full of activity and short on progress.', message: 'TODD helps you see the difference.' },
    { title: 'What if your business could tell you what to do next?', message: 'TODD brings the signal into focus.' },
    { title: 'Momentum is not a feeling. It’s a system.', message: 'TODD helps build the system behind progress.' }
  ];

  isGuestPreviewContext ( context: ToddGuestPreviewContext ): boolean {
    const summary = this.getSummary( context );
    return summary['isAuthenticated'] === false
      || summary['isLoggedIn'] === false
      || String( summary['interactionMode'] || '' ).trim().toLowerCase() === 'guest';
  }

  resolveGuestPreviewCopy ( context: ToddGuestPreviewContext, routeHint?: string ): ToddGuestPreviewCopy | null {
    if ( !this.isGuestPreviewContext( context ) ) {
      return null;
    }

    const page = this.getNormalizedPage( context );
    const normalizedRoute = this.getNormalizedRoute( routeHint );
    const title = String( ( context as any )?.title || '' ).trim();
    const description = String( ( context as any )?.description || '' ).trim();

    const copyMap: Record<string, { title: string; message: string; }> = {
      'contact-home': {
        title: 'Network shows how TODD manages relationship momentum',
        message: 'TODD uses this page to diagnose relationship health, surface follow-up pressure, and prove where relief is showing up. In preview mode you can see the structure; after sign-in, the same page works against your real contacts and companies.'
      },
      'contact-list': {
        title: 'Relationships helps TODD rank who matters most',
        message: 'This page matters because TODD turns a contact list into a relationship cockpit. It helps you see who is reachable, who needs attention, and where momentum can build once your real network is connected.'
      },
      'contact-deal-flow': {
        title: 'Pipeline shows how TODD reads relationship movement',
        message: 'TODD uses this page to separate progressing relationships from stalled ones so follow-up does not depend on memory alone. In preview mode you can see the structure; after sign-in, the same board works against your live pipeline.'
      },
      'contact-import': {
        title: 'Import is where TODD turns contact files into usable momentum',
        message: 'This page exists to convert a spreadsheet into a relationship graph TODD can actually work with. In preview mode you can see the workflow; after sign-in, this is where raw contact data becomes live operating data.'
      },
      'outreach-home': {
        title: 'Outreach shows how TODD turns context into live follow-up',
        message: 'TODD uses this page to turn relationship context into drafts, campaigns, and follow-up pressure. In preview mode you can explore the workflow; after sign-in, it runs against your actual outreach activity.'
      },
      'outbox-cockpit': {
        title: 'Signals shows how TODD catches momentum before it goes cold',
        message: 'TODD uses this page to watch reply pressure, stalled outreach, and handoff risk so follow-up does not depend on memory alone. In preview mode you can see the signal workflow; after sign-in, it works against your live conversations.'
      },
      'daily-momentum': {
        title: 'Daily Momentum is where TODD scores the day',
        message: 'TODD uses this page to compare goals, blockers, and the strongest next move available across the business. In preview mode you can see the operating-system layout; after sign-in, it reflects your real workday.'
      },
      'task-home': {
        title: 'Moves shows how TODD turns priority into execution',
        message: 'TODD uses this page to spot blocked work, overdue work, and the fastest route to relief. In preview mode you see the execution framework; after sign-in, it works against your live tasks.'
      },
      'document-home': {
        title: 'Knowledge shows how TODD turns files into reusable proof',
        message: 'TODD uses this page to surface stale assets, missing proof, and reusable business memory. In preview mode you can see the structure; after sign-in, it connects to your real documents.'
      },
      'knowledge-base': {
        title: 'Knowledge Base turns repeated answers into reusable business memory',
        message: 'TODD uses this page to keep questions, sourced answers, recommendations, and resources together so the right context can be found again. In preview mode you can see the workflow; after sign-in, it connects to your private knowledge library.'
      },
      'survey-home': {
        title: 'Customer Health shows how TODD turns questions into signal',
        message: 'TODD uses this page to diagnose customer pain, treatment, relief, and proof from live responses. In preview mode you can see the framework; after sign-in, it works against real feedback.'
      },
      'social-outreach': {
        title: 'Visibility shows how TODD turns content into follow-up signal',
        message: 'TODD uses this page to create social drafts, capture engagement, and identify which responses deserve real follow-up. In preview mode you can see the workflow; after sign-in, it works against your connected social accounts and live audience signals.'
      },
      'network-landing': {
        title: 'Network is the relationship layer behind the rest of TODD',
        message: 'This page shows why relationships come first. Once the network is connected, TODD can diagnose where trust is strong, where follow-up is weak, and where momentum should move next.'
      },
      'moves-landing': {
        title: 'Moves is where TODD turns intention into completion',
        message: 'This page shows how TODD tracks blocked work, overdue work, and the fastest path to relief. After sign-in, that same execution model works against your actual workload.'
      },
      'pulse-landing': {
        title: 'Pulse is how TODD turns feedback into business signal',
        message: 'This page shows how TODD turns questions, responses, and patterns into usable customer signal. After sign-in, the same workflow interprets your real feedback instead of a product preview.'
      }
    };

    const copy = copyMap[page];
    if ( copy ) {
      return this.decorateGuestPreviewCopy( {
        mode: 'guest_preview',
        title: copy.title,
        message: copy.message
      }, page, normalizedRoute );
    }

    if ( title && description ) {
      return this.decorateGuestPreviewCopy( {
        mode: 'guest_preview',
        title: `${title} is being shown in preview mode`,
        message: `${description} TODD is focused on explaining the value of this page until the workspace is signed in and connected to real data.`
      }, page, normalizedRoute );
    }

    if ( title ) {
      return this.decorateGuestPreviewCopy( {
        mode: 'guest_preview',
        title: `${title} is being shown in preview mode`,
        message: 'TODD is focused on explaining the value of this page first. After sign-in, the same page works against your real business data instead of a product preview.'
      }, page, normalizedRoute );
    }

    return this.decorateGuestPreviewCopy( {
      mode: 'guest_preview',
      title: 'TODD is showing the value of this page in preview mode',
      message: 'Guests see the workflow and value story first. After sign-in, TODD uses the same page to work against real business data instead of a product preview.'
    }, page, normalizedRoute );
  }

  getGuestPreviewSuggestionMessage ( context: ToddGuestPreviewContext ): string {
    return this.resolveGuestPreviewCopy( context )?.message || '';
  }

  getAssistantPlaceholder ( context: ToddGuestPreviewContext ): string {
    if ( !this.isGuestPreviewContext( context ) ) {
      return 'What do you want TODD to do next?';
    }

    const title = String( ( context as any )?.title || '' ).trim();
    return title
      ? `Ask what ${title} helps you do`
      : 'Ask what this page helps you do';
  }

  normalizeTranscriptMessage (
    msg: ToddAssistantTranscriptMsg,
    context: ToddGuestPreviewContext
  ): ToddAssistantTranscriptMsg {
    if ( msg.role !== 'assistant' ) {
      return msg;
    }

    const copy = this.resolveGuestPreviewCopy( context );
    if ( !copy ) {
      return {
        ...msg,
        mode: msg.mode || 'default'
      };
    }

    return {
      ...msg,
      content: copy.message,
      mode: copy.mode
    };
  }

  normalizeEngagementDecision (
    decision: ToddEngagementDecision | null,
    context: ToddGuestPreviewContext
  ): ToddEngagementDecision | null {
    if ( !decision ) {
      return null;
    }

    const copy = this.resolveGuestPreviewCopy( context );
    if ( !copy ) {
      return {
        ...decision,
        mode: decision.mode || 'default'
      };
    }

    return {
      ...decision,
      title: copy.title,
      message: copy.message,
      type: 'feature_discovery',
      primaryActionLabel: undefined,
      primaryAction: undefined,
      primaryActionPayload: undefined,
      secondaryActionLabel: undefined,
      secondaryAction: undefined,
      secondaryActionPayload: undefined,
      actionOptions: undefined,
      imageUrl: undefined,
      imageAlt: undefined,
      ctaRoute: copy.ctaRoute,
      mode: copy.mode
    };
  }

  private getSummary ( context: ToddGuestPreviewContext ): Record<string, any> {
    const summary = ( context as any )?.summary;
    return summary && typeof summary === 'object' ? summary : {};
  }

  private decorateGuestPreviewCopy (
    copy: ToddGuestPreviewCopy,
    page: string,
    routeHint: string
  ): ToddGuestPreviewCopy {
    const resolvedAd = this.resolveGuestAd( page, routeHint );
    if ( !resolvedAd.adImageUrl ) {
      return {
        ...copy,
        displayMode: 'text',
        ctaRoute: copy.ctaRoute || '/login',
        ctaLabel: copy.ctaLabel || 'Sign in to activate'
      };
    }

    return {
      ...copy,
      displayMode: 'ad',
      adTitle: resolvedAd.adTitle,
      adMessage: resolvedAd.adMessage,
      adImageUrl: resolvedAd.adImageUrl,
      adAlt: `${this.getRouteLabel( page, routeHint )} preview ad`,
      ctaRoute: copy.ctaRoute || '/login',
      ctaLabel: copy.ctaLabel || 'Sign in to activate'
    };
  }

  private resolveGuestAd ( page: string, routeHint: string ): { adImageUrl?: string; adTitle: string; adMessage: string; } {
    const key = this.getStableRouteKey( page, routeHint );
    const cached = this.resolvedAdCache.get( key );
    if ( cached ) return cached;

    const textCopy = this.guestAdCopy[Math.floor( Math.random() * this.guestAdCopy.length )];
    const resolved = {
      adImageUrl: this.pickRandomAdImage( page, routeHint ),
      adTitle: textCopy.title,
      adMessage: textCopy.message
    };
    this.resolvedAdCache.set( key, resolved );
    return resolved;
  }

  private pickRandomAdImage ( page: string, routeHint: string ): string | undefined {
    const family = this.resolveAdFamily( page, routeHint );
    const familyAds = this.adManifest[family] || [];
    const fallbackAds = this.adManifest['todd'] || [];
    const pool = familyAds.length > 0 ? familyAds : fallbackAds;
    if ( pool.length <= 0 ) {
      return undefined;
    }

    return pool[Math.floor( Math.random() * pool.length )];
  }

  private resolveAdFamily ( page: string, routeHint: string ): string {
    const normalizedPage = String( page || '' ).trim().toLowerCase();
    const normalizedRoute = String( routeHint || '' ).trim().toLowerCase();

    const pageFamilies: Record<string, string> = {
      'home': 'home',
      'landing-page4': 'home',
      'contact-home': 'network',
      'contact-list': 'network',
      'document-home': 'docs',
      'task-home': 'moves',
      'survey-home': 'pulse',
      'outreach-home': 'outreach',
      'daily-momentum': 'momentum',
      'outbox-cockpit': 'outbox',
      'social-outreach': 'social'
    };
    const routeFamilies: Array<{ route: string; family: string; }> = [
      { route: '/network/app', family: 'network' },
      { route: '/docs/app', family: 'docs' },
      { route: '/moves/app', family: 'moves' },
      { route: '/pulse/app', family: 'pulse' },
      { route: '/outreach/app', family: 'outreach' },
      { route: '/daily-momentum', family: 'momentum' },
      { route: '/signal-engine', family: 'outbox' },
      { route: '/outreach/social', family: 'social' },
      { route: '/products', family: 'products' },
      { route: '/help', family: 'help' }
    ];

    if ( pageFamilies[normalizedPage] ) {
      return pageFamilies[normalizedPage];
    }

    const matchedRoute = routeFamilies.find( ( item ) => normalizedRoute.startsWith( item.route ) );
    return matchedRoute?.family || 'todd';
  }

  private getNormalizedRoute ( routeHint?: string ): string {
    return String( routeHint || '' ).split( '?' )[0].split( '#' )[0].trim().toLowerCase();
  }

  private getStableRouteKey ( page: string, routeHint: string ): string {
    return this.getNormalizedRoute( routeHint ) || String( page || '' ).trim().toLowerCase() || 'guest-preview';
  }

  getGuestPreviewPageLabel ( context: ToddGuestPreviewContext, routeHint = '' ): string {
    return this.getRouteLabel( this.getNormalizedPage( context ), this.getNormalizedRoute( routeHint ) );
  }

  private getRouteLabel ( page: string, routeHint: string ): string {
    const family = this.resolveAdFamily( page, routeHint );
    const familyLabels: Record<string, string> = {
      network: 'Network',
      docs: 'Docs',
      moves: 'Moves',
      pulse: 'Pulse',
      outreach: 'Outreach',
      momentum: 'Daily Momentum',
      outbox: 'Outbox',
      social: 'Social',
      home: 'Home',
      products: 'Products',
      help: 'Help',
      todd: 'TODD'
    };
    return familyLabels[family] || 'TODD';
  }

  private getNormalizedPage ( context: ToddGuestPreviewContext ): string {
    return String( ( context as any )?.page || '' ).trim().toLowerCase();
  }
}
