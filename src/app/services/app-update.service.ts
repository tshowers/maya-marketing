import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import { BUILD_VERSION } from '../version';
import { MayaChatStateService } from './maya-chat-state.service';

/**
 * Keeps an open Maya tab on the latest deploy, like Docs, Network and
 * Outreach, but without a service worker (it would serve one cached page for
 * every route, which breaks the prerendered Home, Help and About).
 *
 * The build writes assets/version.json (scripts/generate-version.js). When the
 * deployed version differs from this build, Maya reloads: at once where
 * nothing would be lost, otherwise at the next navigation, so a conversation
 * (guest chats live only in memory) is never cut off mid-thought. A chunk from
 * an old deploy that fails to load also triggers a reload. Each reload is
 * tried once per tab session, so a stale cache can't cause a reload loop.
 */
@Injectable( { providedIn: 'root' } )
export class AppUpdateService {
  private readonly router = inject( Router );
  private readonly chat = inject( MayaChatStateService );
  private readonly isBrowser = isPlatformBrowser( inject( PLATFORM_ID ) );
  private readonly reloadKey = 'maya-update-reload-attempted';
  private readonly chunkReloadKey = 'maya-chunk-reload-attempted';
  private reloadPending = false;
  private started = false;

  start (): void {
    if ( this.started || !this.isBrowser || !environment.production ) return;
    this.started = true;

    window.addEventListener( 'error', ( event ) => this.onError( `${event.message || ''} ${event.filename || ''}` ), true );
    window.addEventListener( 'unhandledrejection', ( event ) => {
      const reason = event.reason as { message?: string } | string | undefined;
      this.onError( typeof reason === 'string' ? reason : String( reason?.message || reason || '' ) );
    } );

    this.router.events.pipe( filter( ( event ) => event instanceof NavigationEnd ) ).subscribe( () => {
      if ( this.reloadPending ) this.reload( this.reloadKey );
    } );

    document.addEventListener( 'visibilitychange', () => {
      if ( document.visibilityState === 'visible' ) void this.checkDeployedVersion();
    } );
    void this.checkDeployedVersion();
    window.setInterval( () => void this.checkDeployedVersion(), 60_000 );
  }

  private async checkDeployedVersion (): Promise<void> {
    if ( this.reloadPending ) return;
    try {
      const response = await fetch( `/assets/version.json?t=${ Date.now() }`, { cache: 'no-store' } );
      if ( !response.ok ) return;
      const deployed = String( ( await response.json() as { version?: string } ).version || '' ).trim();
      if ( !deployed || deployed === BUILD_VERSION.version ) {
        this.clear( this.reloadKey );
        return;
      }
      if ( this.isSafeToReloadNow() ) this.reload( this.reloadKey );
      else this.reloadPending = true;
    } catch {
      // Offline or blocked; try again on the next check.
    }
  }

  /** Pages where a reload loses nothing the person typed or was shown. */
  private isSafeToReloadNow (): boolean {
    const path = this.router.url.split( /[?#]/ )[0];
    if ( path === '/' ) return !this.chat.hasConversation;
    return ['/help', '/about', '/pricing'].includes( path );
  }

  private onError ( details: string ): void {
    const text = details.toLowerCase();
    const chunkFailed = text.includes( 'failed to fetch dynamically imported module' ) ||
      text.includes( 'loading chunk' ) ||
      text.includes( 'expected a javascript module script' ) ||
      text.includes( 'mime type of "text/html"' );
    if ( chunkFailed ) this.reload( this.chunkReloadKey );
  }

  private reload ( key: string ): void {
    try {
      if ( sessionStorage.getItem( key ) === '1' ) return;
      sessionStorage.setItem( key, '1' );
    } catch {
      // Without storage there is no loop guard, so don't reload.
      return;
    }
    window.location.reload();
  }

  private clear ( key: string ): void {
    try {
      sessionStorage.removeItem( key );
    } catch {
      // Storage blocked.
    }
  }
}
