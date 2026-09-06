import { Injectable } from '@angular/core';
import { LoggerService } from './logger.service';




@Injectable( {
  providedIn: 'root'
} )
export class AssistantBoxHelperService {


  private routeLabelMap: Record<string, string> = {
    '/network/app': 'Network Overview',
    '/contact-deal-flow': 'Pipeline',
    '/match-maker': 'Best Fit',
    '/contact-edit': 'Add to Network',
    '/contact-list': 'Open Network List',
    '/contact-import': 'Import',
    '/moves/app': 'Open Moves',
    '/document': 'Upload',
    '/docs/app': 'Docs',
    '/document-editor': 'Editor',
    '/rfp-upload': 'RFP Upload',
    '/rfp-list': 'RFPs',
    '/proposal-history': 'Proposal History',
    '/compose-email': 'Compose Email',
    '/engagement': 'Engagement',
    '/outbox': 'Outbox',
    '/email-sent': 'Sent',
    '/settings': 'Settings',
    '/pulse/app': 'Open Pulse',
    '/survey-list': 'Pulse List',
    '/survey-dashboard': 'Pulse Dashboard',
    '/survey-dashboard/:surveyId': 'Pulse Dashboard',
    '/knowledge-base': 'Knowledge Base',
    '/update-profile': 'Profile',
    '/app-dashboard': 'App Dashboard',
    '/help': 'Help',
  };

  constructor ( private logger: LoggerService ) { }

  public normalizeAssistantText ( text: string ): string {
    return String( text || '' )
      .replace( /\r\n?/g, '\n' )
      .replace( /```[a-zA-Z0-9_-]*\n?/g, '' )
      .replace( /```/g, '' )
      .replace( /\\([*_`])/g, '$1' )
      .trim();
  }


  // Remove markdown backticks around route/feature labels so they don't render as quotes
  public stripBackticksAroundRoutes ( s: string ): string {
    if ( !s ) return s;

    // Known feature/route labels we often button-ize
    const terms = [
      'Open Moves', 'Moves', 'Docs', 'Document Editor', 'Editor', 'Compose', 'Compose Email',
      'Open Pulse', 'Pulse', 'Network', 'Network List', 'Network Overview', 'Pulse', 'Moves',
      'Network', 'Outreach', 'Docs', 'SayIt', 'Home'
    ];
    for ( const term of terms ) {
      const esc = term.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );
      s = s.replace( new RegExp( '`\\s*' + esc + '\\s*`', 'g' ), term );
    }

    // Also strip backticks around route-like fragments such as `/path`, `/path#frag`, etc.
    s = s.replace( /`(\/[a-z0-9\-\/#]+)`/gi, '$1' );
    return s;
  }

  // Convert route-link buttons to anchors so Angular sanitizer won't drop them
  public ensureAnchorRouteLinks ( html: string ): string {
    if ( !html ) return html;
    return html.replace(
      /<a([^>]*class="[^"]*route-link[^"]*"[^>]*)>([\s\S]*?)<\/a>/gi,
      ( _m, attrs: string, label: string ) => {
        const pathMatch = attrs.match( /data-path="([^"]+)"/i );
        const path = pathMatch ? pathMatch[1] : '#';
        return `<a href="${path}" class="route-link" data-path="${path}">${label}</a>`;
      }
    );
  }

  // After markdown/linkifying, remove any stray backticks that wrapped rendered buttons
  public postCleanButtonTicks ( html: string ): string {
    if ( !html ) return html;

    // Case: the whole <button> ... </button> ended up between literal backticks
    html = html.replace( /`(\s*)<a([^>]*)>([\s\S]*?)<\/a>(\s*)`/g, '<a$2>$3</a>' );
    // Defensive: handle &grave; entities around buttons (some sanitizers emit these)
    html = html.replace( /&grave;(\s*)<a([^>]*)>([\s\S]*?)<\/a>(\s*)&grave;/g, '<a$2>$3</a>' );
    return html;
  }

  public replaceMarkdownLinksWithButtons ( src: string ): string {
    if ( !src ) return src;

    // 1) Replace full [label](url) with a button that carries data-path (no href)
    const buttonized = src.replace( /\[([^\]]+)\]\(([^)]+)\)/g, ( _m, label: string, url: string ) => {
      // Normalize routes: drop leading # if present
      let path = ( url || '' ).trim();
      if ( path.startsWith( '#/' ) ) path = path.slice( 1 );   // "#/contact-list" -> "/contact-list"
      if ( path.startsWith( '#' ) ) path = path.slice( 1 );   // "#something" -> "something"

      // Keep only app-internal routes; ignore full http(s) links to avoid sanitizer issues
      const internal = path.startsWith( '/' ) ? path : `/${path}`;

      const text = ( label || '' ).trim() || 'Open';
      return `<a class="btn-ios route-link" data-path="${internal}">${this.escapeHtml( text )}</a>`;
    } );

    // 2) Safety net: if sanitizer already turned a leftover url into (about:blank),
    // strip that trailing parenthesized segment that follows one of our buttons.
    const cleaned = buttonized
      .replace( /(<a[^>]+class="btn-ios route-link"[^>]*>[^<]+<\/a>)\s*\(about:blank\)/gi, '$1' )
      .replace( /(<a[^>]+class="btn-ios route-link"[^>]*>[^<]+<\/a>)\s*\((?:#\/|\/)?[^\)]+\)/gi, '$1' );

    return cleaned;
  }

  private escapeHtml ( text: string ): string {
    return text
      .replace( /&/g, '&amp;' )
      .replace( /</g, '&lt;' )
      .replace( />/g, '&gt;' )
      .replace( /"/g, '&quot;' )
      .replace( /'/g, '&#39;' );
  }

  public parseAssistantResponse ( res: any ): string {
    // res is a string
    if ( typeof res === 'string' ) return res;

    // res is an object with string inside response
    if ( res && typeof res.response === 'string' ) return res.response;

    // res is an object with response object inside it (double-wrapped)
    if ( res && typeof res.response === 'object' && res.response !== null ) {
      const inner = res.response;

      if ( typeof inner.response === 'string' ) {
        return inner.response;
      }

      // Optionally support future AI patterns
      if ( typeof inner === 'string' ) return inner;
    }

    return "🤖 Sorry, I didn't understand that.";
  }

  public resolveAssistantRoute ( route: string | null | undefined, prompt?: string | null, response?: string | null ): string | null {
    const cleaned = String( route || '' ).trim();
    if ( !cleaned ) return null;

    const path = cleaned.startsWith( '/' ) ? cleaned : `/${cleaned}`;
    const routeLower = path.toLowerCase();
    const promptLower = String( prompt || '' ).toLowerCase();
    const responseLower = String( response || '' ).toLowerCase();
    const combined = `${promptLower} ${responseLower}`.trim();

    if ( routeLower === '/contact-list' && /\bpipeline\b|\badvance stage\b/.test( combined ) ) {
      return '/contact-deal-flow';
    }

    return path;
  }

  // Central HTML post-processor for assistant output:
  // 1) strip accidental backticks around route terms
  // 2) convert route-link <button> elements to anchors (Angular sanitizer-friendly)
  // 3) remove any stray backticks around rendered buttons
  public normalizeAssistantHtml ( html: string ): string {
    let out = html || '';
    out = this.stripBackticksAroundRoutes( out );
    out = this.ensureAnchorRouteLinks( out );
    out = this.postCleanButtonTicks( out );
    return out;
  }

  convertMarkdownToHtml ( text: string ): string {
    if ( !text ) return '';
    text = this.normalizeAssistantText( this.stripBackticksAroundRoutes( text ) );
    try { this.logger.info( '[AssistantBox] markdown->html IN:', text ); } catch { }

    // 1) Normalize & sanitize weird LLM artifacts and stray pseudo-tags
    let cleaned = text
      // Fix bold markers emitted as pseudo tags
      .replace( /<\s*Go\s*to\s*strong\s*>/gi, '<strong>' )
      .replace( /<\s*\/\s*Go\s*to\s*strong\s*>/gi, '</strong>' )
      // Remove fake paragraph wrappers (we add real <p> tags below)
      .replace( /<\s*Go\s*to\s*p\s*>/gi, '' )
      .replace( /<\s*\/\s*Go\s*to\s*p\s*>/gi, '' )
      // Any other `<Go to ...>` constructs (including escaped)
      .replace( /<\s*Go\s*to[^>]*>/gi, '' )
      .replace( /<\s*\/\s*Go\s*to[^>]*>/gi, '' )
      .replace( /&lt;\s*Go\s*to[^&]*&gt;/gi, '' )
      // Texty remnants like `Go to p>` or `Go to strong>`
      .replace( /\bGo\s*to\s*p>/gi, '' )
      .replace( /\*\*(.*?)\*\*/g, '<strong>$1</strong>' )
      .replace( /\n\-\s(.+)/g, '<li>$1</li>' )
      .replace( /\bGo\s*to\s*strong>/gi, '' );

    // 1b) Convert phrases like `route: Go to messaging` into explicit route tokens
    const routeAlias: Record<string, string> = {
      'outbox': '/signal-engine',
      'engagement': '/engagement',
    };

    cleaned = cleaned.replace( /route:\s*go\s*to\s*([a-z][a-z\s\-]+)/gi, ( _m, p1: string ) => {
      const key = ( p1 || '' ).trim().toLowerCase();
      const path = routeAlias[key];
      return path ? ` ${path} ` : _m; // inject route token so linkifier will button-ize it
    } );

    // 1c) Support phrases like `route: Contact Overview` or `via the route: Contact Overview`
    const reverseRouteLabels: Record<string, string> = {};
    Object.keys( this.routeLabelMap ).forEach( path => {
      const label = this.routeLabelMap[path];
      if ( label ) reverseRouteLabels[label.toLowerCase()] = path;
    } );

    cleaned = cleaned.replace( /(?:via\s+the\s+)?route\s*:\s*([A-Za-z][A-Za-z\s\-]+)/gi, ( _m, p1: string ) => {
      const key = ( p1 || '' ).trim().toLowerCase();
      const path = reverseRouteLabels[key];
      return path ? ` ${path} ` : _m;
    } );

    // 2) Basic Markdown → HTML (lightweight)
    // Bold **text**
    let html = cleaned.replace( /\*\*(.*?)\*\*/g, '<strong>$1</strong>' );

    const lines = html
      .split( '\n' )
      .map( line => line.trim() )
      .filter( line => line.length > 0 );

    const blocks: string[] = [];
    let index = 0;
    while ( index < lines.length ) {
      if ( /^\d+\.\s+/.test( lines[index] ) ) {
        const items: string[] = [];
        while ( index < lines.length && /^\d+\.\s+/.test( lines[index] ) ) {
          items.push( lines[index].replace( /^\d+\.\s+/, '' ) );
          index++;
        }
        blocks.push( `<ol>${items.map( item => `<li>${item}</li>` ).join( '' )}</ol>` );
        continue;
      }

      if ( /^[-*]\s+/.test( lines[index] ) ) {
        const items: string[] = [];
        while ( index < lines.length && /^[-*]\s+/.test( lines[index] ) ) {
          items.push( lines[index].replace( /^[-*]\s+/, '' ) );
          index++;
        }
        blocks.push( `<ul>${items.map( item => `<li>${item}</li>` ).join( '' )}</ul>` );
        continue;
      }

      blocks.push( `<p>${lines[index]}</p>` );
      index++;
    }

    html = blocks.join( '' );

    // 3) Convert inline app routes like `/contact-edit` into inline links
    html = this.linkifyAppRoutes( html );

    // 4) Final sweep for any lingering artifacts after paragraphing/linkifying
    html = html
      .replace( /<\s*Go\s*to[^>]*>/gi, '' )
      .replace( /<\s*\/\s*Go\s*to[^>]*>/gi, '' )
      .replace( /&lt;\s*Go\s*to[^&]*&gt;/gi, '' )
      .replace( /\bGo\s*to\s*p>/gi, '' );

    html = this.normalizeAssistantHtml( html );
    html = this.replaceMarkdownLinksWithButtons( html );
    html = html.replace( /\*\*(.*?)\*\*/g, '<strong>$1</strong>' );
    try { this.logger.info( '[AssistantBox] markdown->html OUT:', html ); } catch { }
    return this.postCleanButtonTicks( html );
  }

  /**
 * Turn inline route tokens like `/contact-edit` into tappable links rendered inside the message HTML.
 * Safer version: avoids matching inside HTML tags and ignores substrings like internal/external.
 */
  public linkifyAppRoutes ( html: string ): string {
    if ( !html ) return html;

    // allow ":" so we catch /route/:param, but only in text nodes, never inside HTML tags
    const routeRe = /(^|[^A-Za-z0-9_])((?:\/[a-z0-9][a-z0-9\-]*)(?:\/[a-z0-9:\-]+)*)(?=$|[^A-Za-z0-9_\/])/gi;
    const segments = html.split( /(<[^>]+>)/g );

    return segments.map( segment => {
      if ( !segment || segment.startsWith( '<' ) ) return segment;

      return segment.replace( routeRe, ( _match, prefix: string, route: string ) => {
        return `${prefix}<a href="${route}" class="route-link" data-path="${route}">${route}</a>`;
      } );
    } ).join( '' );
  }

  // ---- Terminal-style direct navigation commands (no OpenAI) ----
  public normalizeCommand ( text: string ): string {
    return ( text || '' )
      .toLowerCase()
      .replace( /[\/\-]/g, ' ' )   // `/` and `-` -> space
      .replace( /\s+/g, ' ' )      // collapse whitespace
      .trim();
  }


  public tryWhatWorkIntent ( p: string ): string | null {
    if ( /\b(what work do you do|what do you actually do|do you actually do work|what work you do)\b/i.test( p ) ) {
      return this.normalizeAssistantHtml( `
      <strong>Here’s what I actually do for you, automatically:</strong>
      <ul>
        <li>Validate email addresses (mark blocked/checked, catch bounces)</li>
        <li>Enrich & clean contacts (add missing data, fix formatting, normalize phones)</li>
        <li>Detect duplicates & stale records; flag low-quality data</li>
        <li>Track last contact and nudge timely follow-ups</li>
        <li>Suggest who to contact today based on inactivity & engagement</li>
        <li>Draft replies & new outreach using your voice</li>
        <li>Generate proposals from RFPs/opportunities</li>
        <li>Remind you to close/advance overdue moves</li>
        <li>Surface contacts without communication history for cleanup</li>
      </ul>
    `);
    }
    return null;
  }

  // Minimal email-sent briefing generator used by EmailSentAssistantService
  public buildEmailSentBriefingHtml ( ctx: any ): string {
    if ( !ctx ) return '';
    const total = Number( ctx.totalEmails || 0 );
    const opened = Number( ctx.openedEmails || 0 );
    const unopened = Number( ctx.unopenedEmails || 0 );
    const clicks = Number( ctx.clickedEmails || 0 );
    const openRate = Number( ctx.openRate || 0 );
    const ctr = Number( ctx.clickThroughRate || 0 );
    const topSubjects = Array.isArray( ctx.topSubjects ) ? ctx.topSubjects.slice( 0, 3 ).map( ( x: any ) => x?.subject || 'n/a' ).join( ' | ' ) : '';
    const html = `
      <p><strong>Sent emails:</strong> ${total}</p>
      <p><strong>Opened:</strong> ${opened} • <strong>Unopened:</strong> ${unopened}</p>
      <p><strong>Clicks:</strong> ${clicks}</p>
      <p><strong>Open Rate:</strong> ${openRate}% • <strong>CTR:</strong> ${ctr}%</p>
      ${topSubjects ? `<p><strong>Top Subjects:</strong> ${topSubjects}</p>` : ''}
    `;
    return this.normalizeAssistantHtml( html );
  }




}
