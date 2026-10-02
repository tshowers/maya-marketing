import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { getAuth } from 'firebase/auth';
import { firstValueFrom } from 'rxjs';
import { DEFAULT_PROFILE_ROLE, PROFILE_ROLES } from '@taliferro/ui/platform/profile-choices.model';
import { environment } from '../../environments/environment';

export interface OnboardingProfileDraft {
  firstName: string;
  lastName: string;
  role: string;
  companyName: string;
  /** Required in the wizard; whole number as typed (e.g. "12"). */
  numberOfEmployees: string;
  helpWith: string[];
  helpNote: string;
  timezone: string;
  /** Set once the visitor reaches the sign-in step - an abandoned draft
   * (they took "Already have an account?") is never submitted. */
  readyToSubmit: boolean;
}

/** Roles that live in their contacts - one is always preselected so the
 * step is a single click. "Other" (not stored) reveals a free-text field.
 * Shared with the in-app profile page and the iOS apps via @taliferro/ui. */
export const ROLE_OPTIONS = PROFILE_ROLES;
export const DEFAULT_ROLE = DEFAULT_PROFILE_ROLE;

/**
 * The wizard's company-size answer as a whole number, or '' when it isn't
 * one. Commas and spaces are allowed ("1,200"). The backend applies the same
 * rule and treats a missing count as 2.
 */
export function employeeCount ( value: string ): string {
  const digits = String( value || '' ).replace( /[\s,]/g, '' );
  if ( !/^\d+$/.test( digits ) ) return '';
  const count = Number.parseInt( digits, 10 );
  return count >= 1 && count <= 10_000_000 ? String( count ) : '';
}

/** Same choices as maya-ios's MayaOnboardingView. */
export const HELP_OPTIONS = [
  'Sharpen my message',
  'Find my best audience',
  'Clarify my offer',
  'Plan my marketing',
  'Write posts and emails',
  'Grow my sales',
];

/**
 * Holds the answers from the pre-sign-in /get-started wizard and saves them
 * to the TODD profile once the visitor has signed in
 * (`POST /api/onboarding/profile`, which only fills blank fields - an
 * existing profile is never overwritten). Same endpoint and payload as
 * maya-ios's `AuthService.submitOnboardingProfileIfNeeded()`.
 *
 * The draft lives in localStorage, not memory: signing in leaves this app
 * entirely for todd.taliferro.tech/login, and the answers have to survive
 * that round trip back to /auth/callback.
 */
@Injectable( { providedIn: 'root' } )
export class OnboardingProfileService {
  private readonly storageKey = 'maya_onboarding_profile_draft';

  constructor ( private readonly http: HttpClient ) { }

  load (): OnboardingProfileDraft {
    const empty: OnboardingProfileDraft = {
      firstName: '',
      lastName: '',
      role: DEFAULT_ROLE,
      companyName: '',
      numberOfEmployees: '',
      helpWith: [HELP_OPTIONS[0]],
      helpNote: '',
      timezone: this.detectTimezone(),
      readyToSubmit: false,
    };
    try {
      const raw = localStorage.getItem( this.storageKey );
      return raw ? { ...empty, ...JSON.parse( raw ) } : empty;
    } catch {
      return empty;
    }
  }

  save ( draft: OnboardingProfileDraft ): void {
    try {
      localStorage.setItem( this.storageKey, JSON.stringify( draft ) );
    } catch { }
  }

  clear (): void {
    try {
      localStorage.removeItem( this.storageKey );
    } catch { }
  }

  /** "Help me reconnect with quiet contacts and follow up faster. <note>" -
   * stored in jobDescriptionForTODD, the field TODD's own profile wizard
   * asks "What should TODD help you do each week?" for. */
  jobDescription ( draft: OnboardingProfileDraft ): string {
    const goals = draft.helpWith.map( ( goal ) => goal.charAt( 0 ).toLowerCase() + goal.slice( 1 ) );
    let sentence = '';
    if ( goals.length === 1 ) {
      sentence = `Help me ${goals[0]}.`;
    } else if ( goals.length > 1 ) {
      sentence = `Help me ${goals.slice( 0, -1 ).join( ', ' )} and ${goals[goals.length - 1]}.`;
    }
    return [sentence, draft.helpNote.trim()].filter( Boolean ).join( ' ' );
  }

  /**
   * Called from AuthCallbackComponent right after sign-in. Never throws -
   * a failed save must not block getting into the app; the draft stays in
   * localStorage so the next sign-in retries it.
   */
  async submitIfPending (): Promise<void> {
    const draft = this.load();
    const user = getAuth().currentUser;
    if ( !draft.readyToSubmit || !user ) return;

    try {
      const idToken = await user.getIdToken();
      await firstValueFrom( this.http.post( `${environment.backendURL}/onboarding/profile`, {
        source: 'maya-web',
        profile: {
          firstName: draft.firstName,
          lastName: draft.lastName,
          // `role` on a Contact is the admin/reviewer/contractor permission -
          // a job role belongs in `profession`.
          profession: draft.role,
          companyName: draft.companyName,
          numberOfEmployees: employeeCount( draft.numberOfEmployees ),
          jobDescriptionForTODD: this.jobDescription( draft ),
          timezone: draft.timezone,
        },
      }, { headers: { Authorization: `Bearer ${idToken}` } } ) );
      this.clear();
    } catch ( error ) {
      console.warn( '[OnboardingProfileService] profile save failed; will retry next sign-in', error );
    }
  }

  detectTimezone (): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch {
      return '';
    }
  }
}
