import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { getAuth } from 'firebase/auth';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface GettingStartedStep {
  id: 'profile' | 'firstQuestion' | 'otherApps' | 'tenQuestions' | string;
  title: string;
  detail: string;
  done: boolean;
}

export interface GettingStarted {
  steps: GettingStartedStep[];
  completedSteps: number;
  totalSteps: number;
  allDone: boolean;
}

/**
 * Maya's Getting Started checklist (`GET /api/getting-started/maya`) -
 * profile, a first question, something in another TODD app, ten questions
 * - the same data maya-ios shows. On the Help page, and opened after
 * sign-in while steps remain. Mirrors Pulse web's getting-started.service.ts.
 */
@Injectable( { providedIn: 'root' } )
export class GettingStartedService {
  private readonly showAfterSignInKey = 'maya_getting_started_show_after_sign_in';
  private readonly shownThisSessionKey = 'maya_getting_started_shown';

  constructor ( private readonly http: HttpClient ) { }

  async load (): Promise<GettingStarted | null> {
    const user = getAuth().currentUser;
    if ( !user ) return null;
    const response = await firstValueFrom( this.http.get<{ data: GettingStarted }>(
      `${environment.backendURL}/getting-started/maya`,
      { headers: { Authorization: `Bearer ${await user.getIdToken()}` } },
    ) );
    return response.data;
  }

  get showAfterSignIn (): boolean {
    try { return localStorage.getItem( this.showAfterSignInKey ) !== 'false'; } catch { return true; }
  }

  set showAfterSignIn ( value: boolean ) {
    try { localStorage.setItem( this.showAfterSignInKey, String( value ) ); } catch { }
  }

  /** True at most once per browser session while steps remain. Never throws. */
  async shouldShowAfterSignIn (): Promise<boolean> {
    try {
      if ( !this.showAfterSignIn || sessionStorage.getItem( this.shownThisSessionKey ) ) return false;
      const progress = await this.load();
      if ( !progress || progress.allDone ) return false;
      sessionStorage.setItem( this.shownThisSessionKey, '1' );
      return true;
    } catch {
      return false;
    }
  }

  /** Absolute URLs for the other apps; '/' is Maya's chat. */
  routeFor ( step: GettingStartedStep ): string {
    switch ( step.id ) {
      case 'profile': return '/profile';
      case 'otherApps': return 'https://network.taliferro.tech';
      default: return '/';
    }
  }

  actionFor ( step: GettingStartedStep ): string {
    switch ( step.id ) {
      case 'profile': return step.done ? 'View profile' : 'Complete profile';
      case 'otherApps': return step.done ? 'Open Network' : 'Add contacts in Network';
      default: return 'Talk to Maya';
    }
  }
}
