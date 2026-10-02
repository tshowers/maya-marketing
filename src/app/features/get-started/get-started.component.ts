import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { MayaAuthService } from '../../services/maya-auth.service';
import { HELP_OPTIONS, OnboardingProfileDraft, OnboardingProfileService, ROLE_OPTIONS, employeeCount } from '../../services/onboarding-profile.service';

type StepKey = 'firstName' | 'lastName' | 'role' | 'company' | 'employees' | 'helpWith' | 'timezone' | 'signIn';

interface Section { key: string; title: string; }

interface Step {
  key: StepKey;
  section: number;
  question: string;
  hint: string;
  optional?: boolean;
}

/**
 * Maya's sign-in wizard - the web twin of maya-ios's MayaOnboardingView,
 * ported from Network web's /get-started. The TODD profile is shared across
 * apps, so it leads with "Already use Network or another TODD app? Sign in";
 * Maya's chat itself keeps working without an account. One question per screen under a 4-segment progress bar whose
 * first segment ("Start") is already complete when the page opens, so
 * every visitor begins a quarter of the way done. The questions mirror
 * TODD's first-login profile wizard (update-profile.component.ts); the
 * answers are saved to the TODD profile after sign-in by
 * OnboardingProfileService.submitIfPending() in AuthCallbackComponent.
 *
 * Returning users skip straight to /login via "Already have an account?".
 */
@Component( {
  selector: 'app-get-started',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './get-started.component.html',
  styleUrl: './get-started.component.css',
} )
export class GetStartedComponent implements OnInit {
  @ViewChild( 'answerInput' ) answerInput?: ElementRef<HTMLInputElement>;

  readonly sections: Section[] = [
    { key: 'start', title: 'Start' },
    { key: 'about', title: 'About you' },
    { key: 'business', title: 'Business' },
    { key: 'setup', title: 'Get set up' },
  ];

  readonly steps: Step[] = [
    { key: 'firstName', section: 1, question: "What's your first name?", hint: 'So Maya knows who she\'s advising.' },
    { key: 'lastName', section: 1, question: 'And your last name?', hint: '' },
    { key: 'role', section: 1, question: "What's your role?", hint: 'Pick the closest fit.' },
    { key: 'company', section: 2, question: "What's your company called?", hint: 'Maya uses it in the plans and posts she drafts.', optional: true },
    { key: 'employees', section: 2, question: 'How many people work there?', hint: "Including you. Enter 1 if it's just you. Maya uses this to set realistic goals for a business your size." },
    { key: 'helpWith', section: 2, question: 'What should Maya help you with?', hint: 'Pick as many as you like.' },
    { key: 'timezone', section: 3, question: 'What timezone is your workday in?', hint: 'So reminders and follow-ups land during your business hours.' },
    { key: 'signIn', section: 3, question: 'Last step: sign in', hint: 'Your answers go to your TODD profile, so Network, Docs and the rest know you too.' },
  ];

  readonly roleOptions = ROLE_OPTIONS;
  readonly helpOptions = HELP_OPTIONS;
  readonly timezones: string[] = this.supportedTimezones();

  draft!: OnboardingProfileDraft;
  stepIndex = 0;
  isSigningIn = false;

  private returnUrl = '/';

  constructor (
    private readonly route: ActivatedRoute,
    private readonly title: Title,
    private readonly authService: MayaAuthService,
    private readonly onboarding: OnboardingProfileService,
  ) { }

  ngOnInit (): void {
    this.title.setTitle( 'Get started — Maya | Taliferro Tech' );
    this.returnUrl = this.route.snapshot.queryParamMap.get( 'returnUrl' ) || '/';
    this.draft = this.onboarding.load();
    if ( !this.draft.timezone ) this.draft.timezone = this.onboarding.detectTimezone();
    if ( this.draft.timezone && !this.timezones.includes( this.draft.timezone ) ) {
      this.timezones.unshift( this.draft.timezone );
    }
    this.focusAnswer();
  }

  get step (): Step {
    return this.steps[this.stepIndex];
  }

  get isTextStep (): boolean {
    return ['firstName', 'lastName', 'company', 'employees'].includes( this.step.key )
      || ( this.step.key === 'role' && this.hasCustomRole );
  }

  get textValue (): string {
    switch ( this.step.key ) {
      case 'firstName': return this.draft.firstName;
      case 'lastName': return this.draft.lastName;
      case 'role': return this.draft.role;
      case 'company': return this.draft.companyName;
      case 'employees': return this.draft.numberOfEmployees;
      default: return '';
    }
  }

  set textValue ( value: string ) {
    switch ( this.step.key ) {
      case 'firstName': this.draft.firstName = value; break;
      case 'lastName': this.draft.lastName = value; break;
      case 'role': this.draft.role = value; break;
      case 'company': this.draft.companyName = value; break;
      case 'employees': this.draft.numberOfEmployees = value; break;
    }
    this.persist();
  }

  get textAutocomplete (): string {
    switch ( this.step.key ) {
      case 'firstName': return 'given-name';
      case 'lastName': return 'family-name';
      case 'role': return 'organization-title';
      case 'company': return 'organization';
      default: return 'off';
    }
  }

  get canAdvance (): boolean {
    switch ( this.step.key ) {
      case 'firstName': return !!this.draft.firstName.trim();
      case 'lastName': return !!this.draft.lastName.trim();
      case 'role': return !!this.draft.role.trim();
      case 'employees': return !!employeeCount( this.draft.numberOfEmployees );
      case 'helpWith': return this.draft.helpWith.length > 0 || !!this.draft.helpNote.trim();
      case 'timezone': return !!this.draft.timezone;
      default: return true;
    }
  }

  /** 0...1 fill of a progress segment - earlier sections are full, the
   * active one fills partially as its screens are completed. */
  sectionFill ( index: number ): number {
    if ( index < this.step.section ) return 1;
    if ( index > this.step.section ) return 0;
    const siblings = this.steps.filter( ( s ) => s.section === index );
    return ( siblings.indexOf( this.step ) + 1 ) / ( siblings.length + 1 );
  }

  next (): void {
    if ( !this.canAdvance || this.stepIndex >= this.steps.length - 1 ) return;
    this.stepIndex++;
    if ( this.step.key === 'signIn' ) {
      this.draft.readyToSubmit = true;
      this.persist();
    }
    this.focusAnswer();
  }

  skip (): void {
    this.stepIndex++;
    this.focusAnswer();
  }

  back (): void {
    if ( this.stepIndex > 0 ) {
      this.stepIndex--;
      this.focusAnswer();
    }
  }

  /** True when the role is a custom one typed under "Other". */
  get hasCustomRole (): boolean {
    return !this.roleOptions.includes( this.draft.role );
  }

  selectRole ( option: string ): void {
    this.draft.role = option;
    this.persist();
  }

  selectOtherRole (): void {
    if ( !this.hasCustomRole ) {
      this.draft.role = '';
      this.persist();
    }
    this.focusAnswer();
  }

  toggleHelp ( option: string ): void {
    const selected = this.draft.helpWith;
    this.draft.helpWith = selected.includes( option )
      ? selected.filter( ( item ) => item !== option )
      : [...selected, option];
    this.persist();
  }

  persist (): void {
    this.onboarding.save( this.draft );
  }

  timezoneLabel ( zone: string ): string {
    return zone.replace( /_/g, ' ' );
  }

  signIn (): void {
    this.isSigningIn = true;
    this.persist();
    this.authService.signIn( this.returnUrl );
  }

  private focusAnswer (): void {
    setTimeout( () => this.answerInput?.nativeElement.focus(), 0 );
  }

  private supportedTimezones (): string[] {
    try {
      const intl = Intl as unknown as { supportedValuesOf?: ( key: string ) => string[] };
      return intl.supportedValuesOf ? [...intl.supportedValuesOf( 'timeZone' )] : [];
    } catch {
      return [];
    }
  }
}
