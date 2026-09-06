import { Injectable } from '@angular/core';
import { LoggerService } from './logger.service';

export type LandingFlowResult = {
  step: number;
  assistantText?: string;
  placeholder?: string;
  showUserAnswer?: boolean;
  clearInput?: boolean;
  done?: boolean;
  profile?: any;
  assistantPrompt?: any;
  assistantResponse?: any;
};

@Injectable( {
  providedIn: 'root'
} )
export class LandingIntakeFlowControllerService {

  landingFlowStep: number = 0; // 0 = inactive
  FINAL_STEP_NUMBER: number = 5;
  prospectData: any = {};


  constructor ( private logger: LoggerService ) { }

  startLandingIntakeFlow (): LandingFlowResult {
    this.logger.info( 'START LANDING PAGE FLOW' );
    this.landingFlowStep = 1;
    this.prospectData = {};

    this.logger.info( 'END LANDING PAGE FLOW' );
    return {
      step: this.landingFlowStep,
      assistantText: "What's your name?",
      placeholder: 'First name is fine…',
      showUserAnswer: true,
      clearInput: true
    };
  }


  handleLandingIntakeStep ( input: string ): LandingFlowResult {
    const value = ( input || '' ).trim();
    const skipped = !value;

    switch ( this.landingFlowStep ) {

      case 1:
        this.prospectData.name = skipped ? null : value;
        this.prospectData.nameSkipped = skipped;
        this.landingFlowStep = 2;
        return {
          step: this.landingFlowStep,
          assistantText: "What's your role?",
          placeholder: 'e.g. Founder, Program Manager',
          showUserAnswer: true,
          clearInput: true
        };

      case 2:
        this.prospectData.role = skipped ? null : value;
        this.prospectData.roleSkipped = skipped;
        this.landingFlowStep = 3;
        return {
          step: this.landingFlowStep,
          assistantText: 'What industry are you in?',
          placeholder: 'e.g. Healthcare, Construction, SaaS',
          showUserAnswer: true,
          clearInput: true
        };

      case 3:
        this.prospectData.industry = skipped ? null : value;
        this.prospectData.industrySkipped = skipped;
        this.landingFlowStep = 4;
        return {
          step: this.landingFlowStep,
          assistantText: 'What are you trying to make easier or faster right now?',
          placeholder: 'e.g. follow-ups, outreach, coordination',
          showUserAnswer: true,
          clearInput: true
        };

      case 4:
        this.prospectData.goal = skipped ? null : value;
        this.prospectData.goalSkipped = skipped;
        this.landingFlowStep = 5;
        return {
          step: this.landingFlowStep,
          assistantText: 'What’s your company called?',
          placeholder: 'Company name',
          showUserAnswer: true,
          clearInput: true
        };

      case 5:
        this.prospectData.companyName = skipped ? null : value;
        this.prospectData.companyNameSkipped = skipped;

        const profile = {
          name: this.prospectData.name || undefined,
          role: this.prospectData.role || undefined,
          company: this.prospectData.companyName || undefined,
          industry: this.prospectData.industry || undefined,
          goal: this.prospectData.goal || undefined
        };

        this.prospectData.landingProfile = profile;
        this.landingFlowStep = 0;

        this.logger.info('LANDING INTAKE COMPLETE', {
          skipped: {
            name: this.prospectData.nameSkipped,
            role: this.prospectData.roleSkipped,
            industry: this.prospectData.industrySkipped,
            goal: this.prospectData.goalSkipped,
            companyName: this.prospectData.companyNameSkipped
          }
        });

        return {
          step: 0,
          assistantText: 'Got it. Give me a second — tailoring the page now.',
          placeholder: 'Working on your tailored page…',
          showUserAnswer: false,
          clearInput: true,
          done: true,
          profile
        };

      default:
        return this.startLandingIntakeFlow();
    }
  }

  public extractJsonObject ( raw: string ): any | null {
    try {
      // Try direct parse first
      return JSON.parse( raw );
    } catch { }

    try {
      // Try to extract the first {...} block
      const start = raw.indexOf( '{' );
      const end = raw.lastIndexOf( '}' );
      if ( start >= 0 && end > start ) {
        const candidate = raw.slice( start, end + 1 );
        return JSON.parse( candidate );
      }
    } catch { }

    return null;
  }


  calculateLossPercent (): number {
    if ( !this.prospectData?.monthlyInterest || !this.prospectData?.averageSale ) return 0;

    let followRate = 0.3;
    if ( this.prospectData.followUpBehavior?.includes( "yes" ) ) followRate = 0.8;
    else if ( this.prospectData.followUpBehavior?.includes( "sometimes" ) ) followRate = 0.5;
    else followRate = 0.2;

    const interest = this.prospectData.monthlyInterest;
    const lostLeads = interest * ( 1 - followRate );
    const percent = ( lostLeads / interest ) * 100;
    return Math.round( percent );
  }

}
