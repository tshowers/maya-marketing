import { Injectable } from '@angular/core';
import { BehaviorSubject, filter, Observable, take } from 'rxjs';
import { DataService } from './data.service';
import { LoggerService } from './logger.service';
import { AuthService } from './auth.service';

@Injectable( {
  providedIn: 'root'
} )
export class SettingsService {

  private settingsSubject = new BehaviorSubject<any>( {} );
  settings$ = this.settingsSubject.asObservable();
  private userId: string = '';
  private isLoggedIn: boolean = false;
  private showOutageBanner: boolean = false;
  private readonly sayItMode: boolean = this.isSayItContext();
  private readonly missingFeatureWarnings = new Set<string>();

  constructor (
    private dataService: DataService,
    private logger: LoggerService,
    private authService: AuthService
  ) {
    if ( this.sayItMode ) {
      // SayIt does not use per-user settings; keep defaults and avoid any DB calls.
      this.settingsSubject.next( {} );
      return;
    }
    try {
      this.authService.isLoggedIn().subscribe( isLoggedIn => {
        this.isLoggedIn = isLoggedIn;
        this.authService.getUserId().subscribe( userId => {
          if ( userId && !this.hasSettingsBeenLoaded() ) {
            this.userId = userId;
            this.fetchAndSetSettings( userId );
          }
        } );
      } );
    } catch ( error ) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        ( error as any ).code === 'auth/missing-project-id' ||
        ( error as any ).code === 'auth/network-request-failed'
      ) {
        this.showOutageBanner = true;
        this.logger.error( "User Not logged In" );
      }
    }
  }

  isGoogleCloudDown (): boolean {
    return this.showOutageBanner;
  }

  getSettings (): any {
    return this.settingsSubject.getValue();
  }

  updateSetting ( key: string, value: any ): void {
    if ( this.sayItMode ) {
      // No settings persistence in SayIt
      return;
    }
    const current = this.getSettings();
    const updated = { ...current, [key]: value };
    this.settingsSubject.next( updated );
    this.dataService.setDocument( 'SETTINGS', this.userId, updated, this.userId ).catch( err => {
      this.logger.error( 'Auto-saving setting failed', err );
    } );
  }


  private hasSettingsBeenLoaded (): boolean {
    const settings = this.settingsSubject.getValue();
    return settings && Object.keys( settings ).length > 1;
  }

  waitForSettings (): Observable<any> {
    if ( this.sayItMode ) {
      return this.settings$.pipe( take( 1 ) );
    }
    return this.settings$.pipe(
      filter( settings => !!settings && Object.keys( settings ).length > 1 ),
      take( 1 )
    );
  }


  private fetchAndSetSettings ( userId: string ): void {
    if ( this.sayItMode ) {
      return;
    }
    try {
      if ( this.isLoggedIn )
        this.dataService.getDocument( 'SETTINGS', userId, userId ).pipe( take( 1 ) ).subscribe( doc => {
          const normalized = doc ? { ...doc, id: doc.id || userId } : { id: userId };
          const migrated = this.migrateSettingsIfNeeded( normalized, userId );
          this.settingsSubject.next( migrated );
        } );
    } catch ( error ) {
      this.logger.info( "Can't get settings for user not logged in" );
    }
  }

  private migrateSettingsIfNeeded ( settings: any, userId: string ): any {
    if ( settings.settingsVersion && settings.settingsVersion >= 2 ) {
      return settings;
    }

    const categories = [
      'contactFeatures', 'contactFields', 'surveyFeatures', 'taskFeatures',
      'communicationFeatures', 'accessibilityFeatures', 'projectVendorManagementFeatures',
      'educationFeatures', 'regulatoryFeatures', 'documentManagementFeatures',
      'userInterfacePersonalizationFeatures', 'dataManagementFeatures',
      'knowledgeFeatures', 'todayFeatures', 'sayItFeatures',
    ];

    const migrated: any = { ...settings, settingsVersion: 2 };

    for ( const category of categories ) {
      const features = migrated[category];
      if ( !Array.isArray( features ) ) continue;
      migrated[category] = features.map( ( f: any ) => ( {
        ...f,
        enabled: f.futureFeature ? false : true,
      } ) );
    }

    this.dataService.setDocument( 'SETTINGS', userId, migrated, userId ).catch( err => {
      this.logger.error( 'Settings migration save failed', err );
    } );

    return migrated;
  }

  isSurveyFeatureEnabled ( shortDescription: string ): boolean {
    const feature = this.getSettings().surveyFeatures?.find( ( f: { shortDescription: string; } ) => f.shortDescription === shortDescription );

    if ( feature === undefined ) {
      this.warnMissingFeatureOnce( 'survey', shortDescription, `Survey Feature "${shortDescription}" not found — defaulting to TRUE` );
      return true;
    }

    return feature.enabled ?? true;
  }

  isTaskFeatureEnabled ( shortDescription: string ): boolean {
    const feature = this.getSettings().taskFeatures?.find( ( f: { shortDescription: string; } ) => f.shortDescription === shortDescription );

    if ( feature === undefined ) {
      this.warnMissingFeatureOnce( 'task', shortDescription, `Task Feature "${shortDescription}" not found — defaulting to TRUE` );
      return true;
    }

    return feature.enabled ?? true;
  }

  isCommunicationFeatureEnabled ( shortDescription: string ): boolean {
    const feature = this.getSettings().communicationFeatures?.find( ( f: { shortDescription: string; } ) => f.shortDescription === shortDescription );

    if ( feature === undefined ) {
      this.warnMissingFeatureOnce( 'communication', shortDescription, `Communication Feature "${shortDescription}" not found — defaulting to TRUE` );
      return true;
    }

    return feature.enabled ?? true;
  }

  isAccessibilityFeatureEnabled ( shortDescription: string ): boolean {
    const feature = this.getSettings().accessibilityFeatures?.find( ( f: { shortDescription: string; } ) => f.shortDescription === shortDescription );

    if ( feature === undefined ) {
      this.warnMissingFeatureOnce( 'accessibility', shortDescription, `Accessibility Feature "${shortDescription}" not found — defaulting to TRUE` );
      return true;
    }

    return feature.enabled ?? true;
  }

  isContactFeatureEnabled ( shortDescription: string ): boolean {
    const feature = this.getSettings().contactFeatures?.find( ( f: { shortDescription: string; } ) => f.shortDescription === shortDescription );

    if ( feature === undefined ) {
      this.warnMissingFeatureOnce( 'contact', shortDescription, `Contact Feature "${shortDescription}" not found — defaulting to TRUE` );
      return true;
    }

    return feature.enabled ?? true;
  }

  isProjectVendorManagementFeatureEnabled ( shortDescription: string ): boolean {
    const feature = this.getSettings().projectVendorManagementFeatures?.find( ( f: { shortDescription: string; } ) => f.shortDescription === shortDescription );

    if ( feature === undefined ) {
      this.warnMissingFeatureOnce( 'project_vendor_management', shortDescription, `Project Vendor Management Feature "${shortDescription}" not found — defaulting to TRUE` );
      return true;
    }

    return feature.enabled ?? true;
  }

  isEducationFeatureEnabled ( shortDescription: string ): boolean {
    const feature = this.getSettings().educationFeatures?.find( ( f: { shortDescription: string; } ) => f.shortDescription === shortDescription );

    if ( feature === undefined ) {
      this.warnMissingFeatureOnce( 'education', shortDescription, `Education Feature "${shortDescription}" not found — defaulting to TRUE` );
      return true;
    }

    return feature.enabled ?? true;
  }

  isRegulatoryFeatureEnabled ( shortDescription: string ): boolean {
    const feature = this.getSettings().educationFeatures?.find( ( f: { shortDescription: string; } ) => f.shortDescription === shortDescription );

    if ( feature === undefined ) {
      this.warnMissingFeatureOnce( 'regulatory', shortDescription, `Regaluatory Feature "${shortDescription}" not found — defaulting to TRUE` );
      return true;
    }

    return feature.enabled ?? true;
  }

  isdocumentManagementFeatureEnabled ( shortDescription: string ): boolean {
    const feature = this.getSettings().documentManagementFeatures?.find( ( f: { shortDescription: string; } ) => f.shortDescription === shortDescription );

    if ( feature === undefined ) {
      this.warnMissingFeatureOnce( 'document_management', shortDescription, `Document Management Feature "${shortDescription}" not found — defaulting to TRUE` );
      return true;
    }

    return feature.enabled ?? true;
  }

  isUserInterfacePersonalizationFeatureEnabled ( shortDescription: string ): boolean {
    const feature = this.getSettings().userInterfacePersonalizationFeatures?.find( ( f: { shortDescription: string; } ) => f.shortDescription === shortDescription );

    if ( feature === undefined ) {
      this.warnMissingFeatureOnce( 'ui_personalization', shortDescription, `User Interface Personalization Feature "${shortDescription}" not found — defaulting to TRUE` );
      return true;
    }

    return feature.enabled ?? true;
  }

  isDataManagementFeatureEnabled ( shortDescription: string ): boolean {
    const feature = this.getSettings().dataManagementFeatures?.find( ( f: { shortDescription: string; } ) => f.shortDescription === shortDescription );

    if ( feature === undefined ) {
      this.warnMissingFeatureOnce( 'data_management', shortDescription, `Data Management Feature "${shortDescription}" not found — defaulting to TRUE` );
      return true;
    }

    return feature.enabled ?? true;
  }

  isContactFieldEnabled ( fieldName: string ): boolean {
    const feature = this.getSettings().contactFields?.find( ( f: { shortDescription: string; } ) => f.shortDescription === fieldName );

    if ( feature === undefined ) {
      this.warnMissingFeatureOnce( 'contact_field', fieldName, `Contact Field Feature "${fieldName}" not found — defaulting to TRUE` );
      return true;
    }

    return feature.enabled ?? true;
  }

  private isSayItContext (): boolean {
    try {
      const path = ( window.location?.pathname || '' ).toLowerCase();
      const hostname = ( window.location?.hostname || '' ).toLowerCase();
      return path.includes( 'say-it' )
        || path.includes( 'sayit' )
        || hostname === 'sayit.taliferro.tech'
        || hostname === 'todd-sayit.web.app';
    } catch {
      return false;
    }
  }

  public clearAll (): void {
    // Reset BehaviorSubject state
    this.settingsSubject.next( {} );

    // Reset in-memory state
    this.userId = '';
    this.isLoggedIn = false;
    this.showOutageBanner = false;
    this.missingFeatureWarnings.clear();
  }

  private warnMissingFeatureOnce ( domain: string, shortDescription: string, message: string ): void {
    const key = `${domain}:${shortDescription}`;
    if ( this.missingFeatureWarnings.has( key ) ) return;
    this.missingFeatureWarnings.add( key );
    this.logger.warn( message );
  }

}
