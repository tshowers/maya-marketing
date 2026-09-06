import { Injectable } from '@angular/core';
import { Contact } from '../shared/data/interfaces/contact.model';

export interface ToddProfileSectionReadiness {
  id: string;
  label: string;
  weight: number;
  complete: boolean;
  impact: string;
}

export interface ToddProfileReadiness {
  score: number;
  completedSections: number;
  totalSections: number;
  coreComplete: boolean;
  fullyComplete: boolean;
  sections: ToddProfileSectionReadiness[];
  missingSections: string[];
  toddView: string;
  mayaView: string;
}

@Injectable( { providedIn: 'root' } )
export class ToddProfileReadinessService {
  evaluate ( contact: Contact | null ): ToddProfileReadiness {
    const company = contact?.company;
    const has = ( value: unknown ): boolean => String( value || '' )
      .replace( /<[^>]*>/g, '' )
      .replace( /&nbsp;/gi, ' ' )
      .trim().length > 0;
    const hasList = ( value: unknown ): boolean => Array.isArray( value )
      ? value.some( item => has( item ) )
      : has( value );
    const sections: ToddProfileSectionReadiness[] = [
      // displayName and email can live on the authenticated user profile
      // rather than the tenant contact document. The profile screen uses
      // those same values, so do not make a duplicated contact.displayName
      // field a false blocker for an otherwise complete Personal section.
      { id: 'personal', label: 'Personal Information', weight: 20, complete: has( contact?.firstName ) && has( contact?.lastName ) && has( contact?.email || contact?.emailAddresses?.[0]?.emailAddress ) && has( contact?.timezone ) && has( company?.name ), impact: 'TODD can identify you and address you correctly.' },
      { id: 'organization', label: 'About Your Organization', weight: 25, complete: has( company?.name ) && has( company?.description ) && has( company?.goal ) && has( company?.valueProp ) && hasList( company?.keyFeatures ), impact: 'TODD can describe your organization, its value, and what it offers accurately.' },
      { id: 'goal', label: 'Business Goal', weight: 20, complete: has( company?.goal ), impact: 'TODD can rank work against the outcome you care about.' },
      { id: 'how-todd-helps', label: 'How TODD Helps You', weight: 25, complete: has( contact?.jobDescriptionForTODD ), impact: 'Maya can prepare useful work in the way you actually operate.' },
      // A tone preference or social-voice note is useful context, but it is not
      // a communication setup. TODD needs an actual signature before it should
      // tell the user that the communication section is complete.
      { id: 'communication', label: 'Communication and Voice', weight: 10, complete: has( contact?.signature ), impact: 'Maya can make drafts sound more like you.' }
    ];
    const score = sections.reduce( ( total, section ) => total + ( section.complete ? section.weight : 0 ), 0 );
    const missingSections = sections.filter( section => !section.complete ).map( section => section.label );
    // Every section represented here is required for TODD activation. Social
    // Voice is intentionally not included in this service because it remains
    // an optional refinement in the profile UI.
    const coreComplete = sections.every( section => section.complete );
    return {
      score,
      completedSections: sections.filter( section => section.complete ).length,
      totalSections: sections.length,
      coreComplete,
      fullyComplete: sections.every( section => section.complete ),
      sections,
      missingSections,
      toddView: coreComplete ? 'TODD has the business context needed to prioritize your next move.' : 'TODD can recognize your workspace, but some business context is still missing.',
      mayaView: sections[3].complete ? 'Maya understands the work you want help with.' : 'Maya can draft, but her recommendations may remain generic until you describe the work you want help with.'
    };
  }
}
