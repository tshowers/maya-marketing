import { Injectable } from '@angular/core';
import { AssistantPageContext } from './todd-assistant-bus.service';
import { AssistantBoxUtilityService } from './assistant-box-utility.service';
import { Contact } from '../shared/data/interfaces/contact.model';
import { CatalystAssistantContext } from '../features/email/components/emailer/emailer.component';
import { EmailSentAssistantContext } from '../features/email/components/email-sent/email-sent.component';

/**
 * Centralizes construction of user/page context snippets and UI hints for LLM prompts.
 * Keep methods stateless and parameterized so the component stays thin and testable.
 */
@Injectable( { providedIn: 'root' } )
export class AssistantContextService {
    constructor ( private utility: AssistantBoxUtilityService ) { }

    /** Build the user-context snippet from the logged-in user. */
    buildUserContextSnippet ( user: Contact | null | undefined ): string {
        if ( !user ) return '';

        const u: any = user as any;
        const lines: string[] = [];

        if ( u.firstName ) lines.push( `User first name: ${u.firstName}` );

        const roleParts = [u.profession, u.status].filter( Boolean ) as string[];
        if ( roleParts.length ) lines.push( `User role: ${roleParts.join( ' - ' )}` );

        if ( u.jobDescriptionForTODD ) lines.push( `User job for TODD: ${u.jobDescriptionForTODD}` );

        const company: any = u.company || {};
        if ( company.name ) lines.push( `Company name: ${company.name}` );
        if ( company.companyDescriptionForTODD ) lines.push( `Company description: ${company.companyDescriptionForTODD}` );
        if ( company.companyGoalForTODD ) lines.push( `Company goal with TODD: ${company.companyGoalForTODD}` );
        if ( company.companyValuePropForTODD ) lines.push( `Company value proposition: ${company.companyValuePropForTODD}` );
        if ( company.companyKeyFeaturesForTODD ) lines.push( `Key products or services: ${company.companyKeyFeaturesForTODD}` );

        if ( !lines.length ) return '';
        return `\n\n[user-context]\n${lines.join( '\n' )}`;
    }

    /** Append user context if present. */
    withUserContext ( prompt: string, user: Contact | null | undefined ): string {
        const ctx = this.buildUserContextSnippet( user );
        if ( !ctx ) return prompt;
        return `${prompt}${ctx}`;
    }

    /**
     * Append page and user context to a prompt.
     * Page context snippet is built via AssistantBoxUtilityService to avoid duplication.
     */
    withPageAndUserContext (
        prompt: string,
        user: Contact | null | undefined,
        pageContext: CatalystAssistantContext | EmailSentAssistantContext | AssistantPageContext | null
    ): string {
        const userCtx = this.buildUserContextSnippet( user );
        const pageCtx = this.utility.buildPageContextSnippet( pageContext as any );
        return `${prompt}${userCtx}${pageCtx}`;
    }

    /** Build a concise UI hint string describing the current UI for the LLM. */
    buildUiHint ( route: string | null | undefined, isLoggedIn: boolean, hasMusic: boolean ): string {
        const activeRoute = route || '/';
        const iconLine = isLoggedIn
            ? 'navbar has a single TODD logo icon that opens a dropdown'
            : 'navbar shows a single TODD logo icon linking to /';

        const baseMenu = ['Home', 'Network', 'Outreach', 'Docs', 'Moves', 'Pulse', 'SayIt'];
        const visibleMenu = hasMusic ? baseMenu.concat( 'Music' ) : baseMenu;
        const dropdowns = isLoggedIn ? ['Network', 'Outreach', 'Docs', 'Moves', 'Pulse'] : [];

        return [
            `activeRoute=${activeRoute}`,
            `iconCount=1 (${iconLine})`,
            `visibleMenu=${visibleMenu.join( ', ' )}`,
            dropdowns.length ? `dropdowns=${dropdowns.join( ', ' )}` : ''
        ]
            .filter( Boolean )
            .join( '\n' );
    }
}
