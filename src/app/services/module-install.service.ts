import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { environment } from '../../environments/environment';
import { ModuleInstallConfig } from '../shared/utils/module-install-config.util';

type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

interface DeferredInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string; }>;
}

export interface ModuleInstallState {
  canPrompt: boolean;
  isIosSafari: boolean;
  isInstalled: boolean;
  isUnsupported: boolean;
}

@Injectable( {
  providedIn: 'root'
} )
export class ModuleInstallService {
  private readonly defaultManifestPath = '/manifest.webmanifest';
  private readonly defaultIconPath = '/assets/TODD-icon.png';
  private readonly defaultThemeColor = '#1976d2';
  private readonly defaultAppTitle = 'TODD';

  private deferredPrompt: DeferredInstallPromptEvent | null = null;
  private initialized = false;
  private currentConfig: ModuleInstallConfig | null = null;
  private readonly customPromptEnabled = environment.enableCustomInstallPrompt !== false;

  private readonly stateSubject = new BehaviorSubject<ModuleInstallState>( {
    canPrompt: false,
    isIosSafari: false,
    isInstalled: false,
    isUnsupported: false
  } );

  readonly state$ = this.stateSubject.asObservable();

  constructor ( @Inject( DOCUMENT ) private document: Document ) { }

  init (): void {
    if ( this.initialized || typeof window === 'undefined' ) {
      return;
    }

    this.initialized = true;
    if ( this.customPromptEnabled ) {
      window.addEventListener( 'beforeinstallprompt', this.onBeforeInstallPrompt );
    }
    window.addEventListener( 'appinstalled', this.onAppInstalled );
    this.refreshState();
  }

  activateConfig ( config: ModuleInstallConfig | null ): void {
    this.init();
    this.currentConfig = config;
    this.applyDocumentMetadata( config );
    this.refreshState();
  }

  deactivateConfig ( config: ModuleInstallConfig | null ): void {
    if ( this.currentConfig?.key !== config?.key ) {
      return;
    }

    this.currentConfig = null;
    this.applyDocumentMetadata( null );
    this.refreshState();
  }

  getSnapshot (): ModuleInstallState {
    return this.stateSubject.value;
  }

  async promptInstall (): Promise<InstallOutcome> {
    if ( !this.deferredPrompt ) {
      return 'unavailable';
    }

    const prompt = this.deferredPrompt;
    this.deferredPrompt = null;
    this.refreshState();

    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    this.refreshState();
    return outcome;
  }

  private readonly onBeforeInstallPrompt = ( event: Event ): void => {
    const promptEvent = event as DeferredInstallPromptEvent;
    if ( typeof promptEvent.preventDefault === 'function' ) {
      promptEvent.preventDefault();
    }

    this.deferredPrompt = promptEvent;
    this.refreshState();
  };

  private readonly onAppInstalled = (): void => {
    this.deferredPrompt = null;
    this.refreshState();
  };

  private refreshState (): void {
    const isIosSafari = this.isIosSafari();
    const isInstalled = this.isInstalled();
    const canPrompt = !!this.deferredPrompt && !isInstalled;
    const isUnsupported = !isInstalled && !canPrompt && !isIosSafari;

    this.stateSubject.next( {
      canPrompt,
      isIosSafari,
      isInstalled,
      isUnsupported
    } );
  }

  private isInstalled (): boolean {
    if ( typeof window === 'undefined' ) {
      return false;
    }

    const standaloneMatch = typeof window.matchMedia === 'function'
      ? window.matchMedia( '(display-mode: standalone)' ).matches
      : false;
    const navigatorStandalone = !!( window.navigator as Navigator & { standalone?: boolean; } ).standalone;
    const androidReferrer = this.document.referrer.startsWith( 'android-app://' );

    return standaloneMatch || navigatorStandalone || androidReferrer;
  }

  private isIosSafari (): boolean {
    if ( typeof navigator === 'undefined' ) {
      return false;
    }

    const userAgent = navigator.userAgent || '';
    const isIos = /iPad|iPhone|iPod/.test( userAgent ) ||
      ( navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1 );
    const isSafari = /Safari/i.test( userAgent ) &&
      !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test( userAgent );

    return isIos && isSafari && !this.isInstalled();
  }

  private applyDocumentMetadata ( config: ModuleInstallConfig | null ): void {
    const manifestPath = config?.manifestPath || this.defaultManifestPath;
    const iconPath = config?.iconPath || this.defaultIconPath;
    const themeColor = config?.themeColor || this.defaultThemeColor;
    const appTitle = config?.moduleName || this.defaultAppTitle;

    this.setLinkTag( 'manifest', manifestPath );
    this.setLinkTag( 'apple-touch-icon', iconPath );
    this.setMetaTag( 'apple-mobile-web-app-title', appTitle );
    this.setMetaTag( 'application-name', appTitle );
    this.setMetaTag( 'mobile-web-app-capable', 'yes' );
    this.setMetaTag( 'apple-mobile-web-app-capable', 'yes' );
    this.setMetaTag( 'theme-color', themeColor );
  }

  private setLinkTag ( rel: string, href: string ): void {
    let link = this.document.head.querySelector( `link[rel="${rel}"]` ) as HTMLLinkElement | null;
    if ( !link ) {
      link = this.document.createElement( 'link' );
      link.setAttribute( 'rel', rel );
      this.document.head.appendChild( link );
    }

    link.setAttribute( 'href', href );
  }

  private setMetaTag ( name: string, content: string ): void {
    let meta = this.document.head.querySelector( `meta[name="${name}"]` ) as HTMLMetaElement | null;
    if ( !meta ) {
      meta = this.document.createElement( 'meta' );
      meta.setAttribute( 'name', name );
      this.document.head.appendChild( meta );
    }

    meta.setAttribute( 'content', content );
  }
}
