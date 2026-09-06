import { Injectable } from '@angular/core';
import { AssistantPageContext } from './todd-assistant-bus.service';
import { ToddActivationResolution } from './todd-activation-state.service';
import { TODD_NEXT_STEP_REGISTRY } from './todd-next-step-registry';

export type ToddCounselingAudience = 'trial_or_eval' | 'single_module_paid' | 'suite_paid';

export interface ToddCounselingAction {
  label: string;
  route: string;
}

export interface ToddCounselingContract {
  audience: ToddCounselingAudience;
  title: string;
  message: string;
  whyItMatters: string;
  primaryAction: ToddCounselingAction;
  secondaryAction?: ToddCounselingAction;
  teachingPoints: string[];
  currentStage: string;
  nextStage?: string;
  crossSellAllowed: boolean;
}

@Injectable( { providedIn: 'root' } )
export class ToddCounselingContractService {
  build ( activation: ToddActivationResolution | null, context: AssistantPageContext | null ): ToddCounselingContract | null {
    if ( !activation ) return null;

    const facts = activation.facts;
    const entitlements = facts.entitlements || {};
    const paidModules = [
      entitlements.network,
      entitlements.moves,
      entitlements.outreach,
      entitlements.docs,
      entitlements.knowledge,
      entitlements.pulse
    ].filter( Boolean ).length;
    const audience: ToddCounselingAudience = entitlements.suite
      ? 'suite_paid'
      : paidModules === 1 ? 'single_module_paid' : 'trial_or_eval';
    const currentPage = String( context?.page || '' ).trim().toLowerCase();
    const summary = context?.summary || {};
    const singleModule = this.getSinglePaidModule( entitlements, paidModules );

    const primaryAction: ToddCounselingAction = {
      label: this.actionLabel( activation.stage ),
      route: this.toRoute( activation.recommendedRoute?.path, activation.recommendedRoute?.queryParams )
    };
    const secondaryAction = this.secondaryAction( activation, currentPage );

    if ( !facts.profileComplete ) {
      if ( currentPage === 'update-profile' ) {
        const nextProfileStep = this.getNextProfileStep( summary );
        return {
          audience,
          title: 'Do this next',
          message: nextProfileStep.message,
          whyItMatters: 'TODD should point to the next unfinished piece of context, not send you back to a page you are already using.',
          primaryAction: { label: nextProfileStep.label, route: `/update-profile?guided=profile#${nextProfileStep.fragment}` },
          teachingPoints: [
            `Personal Information is complete. The next unfinished section is ${nextProfileStep.section}.`,
            facts.profileReadiness.toddView,
            facts.profileReadiness.mayaView
          ],
          currentStage: 'Profile setup',
          nextStage: 'Relationship inventory',
          crossSellAllowed: false
        };
      }
      return {
        audience,
        title: 'Finish the profile before the advice gets specific.',
        message: `Profile readiness is ${facts.profileReadiness.score}%. TODD can see the workspace, but important business context is still missing.`,
        whyItMatters: 'Your profile is the operating brief TODD and Maya use to decide what matters, how to prioritize it, and how to sound like you.',
        primaryAction: { label: 'Finish Profile', route: '/update-profile?guided=profile' },
        secondaryAction,
        teachingPoints: [
          `TODD is still missing: ${facts.profileReadiness.missingSections.join( ', ' ) || 'business context'}.`,
          facts.profileReadiness.toddView,
          facts.profileReadiness.mayaView
        ],
        currentStage: 'Profile setup',
        nextStage: 'Relationship inventory',
        crossSellAllowed: false
      };
    }

    if ( audience === 'single_module_paid' && singleModule ) {
      const pageModule = this.moduleForPage( currentPage );
      if ( pageModule && pageModule !== singleModule ) {
        return this.buildEntitlementBoundaryContract( singleModule, audience );
      }
    }

    const registryContract = this.buildFromRegistry( currentPage, summary, activation, audience );
    if ( registryContract ) return registryContract;

    const moduleContract = this.buildModuleContract( currentPage, audience, summary );
    if ( moduleContract ) return moduleContract;

    const pageContract = this.buildPageContract( currentPage, activation, audience, summary );
    if ( pageContract ) return pageContract;

    return {
      audience,
      title: activation.title,
      message: activation.message,
      whyItMatters: this.whyItMatters( activation.stage ),
      primaryAction,
      secondaryAction,
      teachingPoints: this.teachingPoints( activation.stage ),
      currentStage: this.stageLabel( activation.stage ),
      nextStage: this.nextStage( activation.stage ),
      crossSellAllowed: audience !== 'single_module_paid' || activation.stage === 'contacts_ready'
    };
  }

  private buildFromRegistry (
    page: string,
    summary: Record<string, any>,
    activation: ToddActivationResolution,
    audience: ToddCounselingAudience
  ): ToddCounselingContract | null {
    const ctx = { summary, activation, audience };
    for ( const rule of TODD_NEXT_STEP_REGISTRY ) {
      const pages = Array.isArray( rule.page ) ? rule.page : [ rule.page ];
      if ( !pages.includes( page ) ) continue;
      if ( rule.when && !rule.when( ctx ) ) continue;
      const result = rule.build( ctx );
      return {
        audience,
        title: result.title,
        message: result.message,
        whyItMatters: result.whyItMatters,
        primaryAction: result.primaryAction,
        secondaryAction: result.secondaryAction,
        teachingPoints: result.teachingPoints,
        currentStage: result.currentStage,
        nextStage: result.nextStage,
        crossSellAllowed: result.crossSellAllowed ?? ( audience !== 'single_module_paid' )
      };
    }
    return null;
  }

  private getSinglePaidModule ( entitlements: any, paidModules: number ): string | null {
    if ( paidModules !== 1 ) return null;
    const moduleKeys = ['network', 'outreach', 'docs', 'knowledge', 'moves', 'pulse'];
    return moduleKeys.find( key => entitlements[key] === true ) || null;
  }

  private getNextProfileStep ( summary: Record<string, any> ): { section: string; label: string; fragment: string; message: string; } {
    const status = ( summary['profileSectionStatus'] || {} ) as Record<string, boolean>;
    if ( !status['organization'] ) {
      return {
        section: 'About Company',
        label: 'Complete About Company',
        fragment: 'org-card',
        message: 'Personal Information is complete. Next, tell TODD what your company does, who it serves, and why it matters so Maya can make the rest of the guidance specific.'
      };
    }
    if ( !status['howToddHelps'] ) {
      return {
        section: 'How TODD Helps You',
        label: 'Describe the Work',
        fragment: 'helps-card',
        message: 'Your company context is in place. Next, describe the work you want TODD and Maya to move forward so the system can prioritize the right outcomes.'
      };
    }
    if ( !status['communication'] ) {
      return {
        section: 'Communication',
        label: 'Set Up Communication',
        fragment: 'communication-card',
        message: 'Your operating context is nearly ready. Next, set up your communication details so TODD can help turn recommendations into consistent follow-up.'
      };
    }
    return {
      section: 'Profile review',
      label: 'Review Profile',
      fragment: 'personal-card',
      message: 'Your profile is nearly ready. Review the remaining setup details, then TODD can move you into contacts and the next live workflow.'
    };
  }

  private moduleForPage ( page: string ): string | null {
    if ( ['contact-home', 'contact-list', 'contact-import', 'contact-create', 'pipeline-dashboard', 'lead-vault'].includes( page ) ) return 'network';
    if ( ['outreach-home', 'outbox-cockpit', 'signal-engine'].includes( page ) ) return 'outreach';
    if ( ['document-home', 'document-editor'].includes( page ) ) return 'docs';
    if ( page === 'knowledge-base' || page.includes( 'knowledge' ) ) return 'knowledge';
    if ( page === 'moves-view' || page.includes( 'moves' ) || page.includes( 'task' ) ) return 'moves';
    if ( ['survey-list', 'survey-view', 'survey-home', 'survey-dashboard', 'survey-add'].includes( page ) || page.includes( 'pulse' ) ) return 'pulse';
    return null;
  }

  private buildEntitlementBoundaryContract ( moduleKey: string, audience: ToddCounselingAudience ): ToddCounselingContract {
    const labels: Record<string, string> = {
      network: 'Network',
      outreach: 'Outreach',
      docs: 'Docs',
      knowledge: 'Knowledge',
      moves: 'Moves',
      pulse: 'Pulse'
    };
    const routes: Record<string, string> = {
      network: '/network/app',
      outreach: '/outreach/app',
      docs: '/docs/app',
      knowledge: '/knowledge-base',
      moves: '/moves/app',
      pulse: '/pulse/app'
    };
    const label = labels[moduleKey] || 'your purchased app';
    return {
      audience,
      title: `Your plan is focused on ${label}.`,
      message: `TODD is keeping the advice specific to ${label}, because that is where your current access and next result live. The other applications are available when you are ready to expand the operating system.`,
      whyItMatters: 'Focused guidance reduces noise. TODD should help you get a result from the product you chose before asking you to learn another workflow.',
      primaryAction: { label: `Open ${label}`, route: routes[moduleKey] || '/daily-momentum' },
      teachingPoints: [
        `TODD will coach the complete ${label} workflow, including its supporting tools and completion signals.`,
        'Daily Momentum may still summarize the next action, but it will not redirect you into an unlocked product workflow.',
        'The rest of the suite can be explored separately when expansion is the right business decision.'
      ],
      currentStage: `${label} focus`,
      nextStage: `${label} result`,
      crossSellAllowed: false
    };
  }

  private buildModuleContract ( page: string, audience: ToddCounselingAudience, summary: Record<string, any> ): ToddCounselingContract | null {
    if ( ['document-home', 'document-editor'].includes( page ) ) {
      return {
        audience,
        title: 'Docs turns scattered knowledge into reusable proof.',
        message: page === 'document-editor'
          ? 'You are shaping the proof layer now. Give the document a clear audience, claim, and next use so Maya can reuse it instead of making the same explanation from scratch.'
          : 'Use Docs when a lesson, explanation, or proof should survive beyond one conversation and become available to the rest of the operating system.',
        whyItMatters: 'Reusable proof shortens the distance between knowing something and using it in outreach, sales, onboarding, or the next decision.',
        primaryAction: { label: page === 'document-editor' ? 'Keep Editing' : 'Open Documents', route: '/document' },
        secondaryAction: { label: 'Open Daily Momentum', route: '/daily-momentum' },
        teachingPoints: [
          'Start with the problem the document helps someone solve, not a dump of background information.',
          'Link proof to the relationship, move, or outreach context where it should be used.',
          'When the document is ready, Daily Momentum can surface it when the next move needs supporting context.'
        ],
        currentStage: 'Reusable proof',
        nextStage: 'Knowledge and application',
        crossSellAllowed: audience !== 'single_module_paid'
      };
    }

    if ( page === 'knowledge-base' || page.includes( 'knowledge' ) ) {
      return {
        audience,
        title: 'Knowledge is useful when it changes the next decision.',
        message: 'TODD is helping you build a searchable business memory. Capture the answer, source, or operating rule once, then let Maya and Daily Momentum use it when the work calls for it.',
        whyItMatters: 'A knowledge base should reduce repeated explanation and make good judgment available at the moment a decision needs it.',
        primaryAction: { label: 'Review Knowledge', route: '/knowledge-base' },
        secondaryAction: { label: 'Open Daily Momentum', route: '/daily-momentum' },
        teachingPoints: [
          'Save durable answers, sources, and rules—not temporary notes that will be obsolete tomorrow.',
          'Use categories and citations so Maya can distinguish memory from speculation.',
          'Docs stores reusable proof; Knowledge gives the system the context to apply it correctly.'
        ],
        currentStage: 'Business memory',
        nextStage: 'Apply knowledge to live work',
        crossSellAllowed: audience !== 'single_module_paid'
      };
    }

    if ( page === 'moves-view' || page.includes( 'moves' ) || page.includes( 'task' ) ) {
      const activeMoves = Number( summary['activeMoves'] || summary['totalMoves'] || 0 );
      const dueToday = Number( summary['dueToday'] || 0 );
      return {
        audience,
        title: dueToday > 0 ? 'Moves is showing where execution needs attention today.' : 'Moves turns intention into accountable execution.',
        message: dueToday > 0
          ? `${dueToday.toLocaleString( 'en-US' )} Move${dueToday === 1 ? '' : 's'} need attention today. Use the cockpit to choose the highest-leverage commitment, then let Daily Momentum keep it visible.`
          : `TODD sees ${activeMoves.toLocaleString( 'en-US' )} active Move${activeMoves === 1 ? '' : 's'}. Keep each Move attached to an owner, a due date, and the smallest next action that proves progress.`,
        whyItMatters: 'A plan creates possibility; a Move creates ownership, timing, and evidence that something actually changed.',
        primaryAction: { label: 'Open Moves Cockpit', route: '/moves-view' },
        secondaryAction: { label: 'Open Daily Momentum', route: '/daily-momentum' },
        teachingPoints: [
          'Use the hierarchy to understand how a Move supports the larger mission.',
          'Use the calendar and timeline to see timing pressure without losing the reason the Move exists.',
          'Completed Moves become evidence that Daily Momentum can use to choose what deserves attention next.'
        ],
        currentStage: 'Execution',
        nextStage: 'Proof of progress',
        crossSellAllowed: audience !== 'single_module_paid'
      };
    }

    if ( ['survey-list', 'survey-view', 'survey-home', 'survey-dashboard', 'survey-add'].includes( page ) || page.includes( 'pulse' ) ) {
      const responses = Number( summary['totalResponses'] || summary['responseCount'] || 0 );
      const published = Number( summary['publishedCount'] || summary['activeSurveyCount'] || 0 );
      return {
        audience,
        title: responses > 0 ? 'Pulse has signal. Now decide what it changes.' : 'Pulse turns customer opinion into usable signal.',
        message: responses > 0
          ? `TODD sees ${responses.toLocaleString( 'en-US' )} response${responses === 1 ? '' : 's'}. Review the pattern, decide what deserves a response, and send the resulting decision into Daily Momentum.`
          : `Pulse currently has ${published.toLocaleString( 'en-US' )} published instrument${published === 1 ? '' : 's'} and is waiting for customer signal. Keep the question focused, distribute it, and use the responses as evidence—not applause.`,
        whyItMatters: 'Customer signal matters when it changes what you build, say, prioritize, or stop doing.',
        primaryAction: { label: page === 'survey-add' ? 'Finish Pulse Setup' : 'Review Pulse Signal', route: '/pulse/app' },
        secondaryAction: { label: 'Open Daily Momentum', route: '/daily-momentum' },
        teachingPoints: [
          'Ask one decision-shaped question instead of collecting opinions with no owner or next step.',
          'Use the response trail to separate a loud answer from a repeated pattern.',
          'Daily Momentum is where a meaningful customer signal becomes an action, Move, or follow-up.'
        ],
        currentStage: 'Customer signal',
        nextStage: 'Decision and response',
        crossSellAllowed: audience !== 'single_module_paid'
      };
    }

    return null;
  }

  private buildPageContract ( page: string, activation: ToddActivationResolution, audience: ToddCounselingAudience, summary: Record<string, any> ): ToddCounselingContract | null {
    const facts = activation.facts;
    if ( page === 'contact-import' ) {
      return this.buildImportContract( facts.contactCount, audience, summary );
    }

    if ( page === 'lead-vault' ) {
      return {
        audience,
        title: 'More names are useful only when they create more motion.',
        message: 'Lead Vault can expand the network. Bring the right-fit contacts back into Network, enrich them, and let Pipeline decide which relationships deserve attention.',
        whyItMatters: 'The goal is not a larger list. It is a healthier set of reachable relationships with a clear next move.',
        primaryAction: { label: 'Open Network', route: '/contact-list' },
        secondaryAction: { label: 'Open Pipeline', route: '/contact-deal-flow' },
        teachingPoints: [
          'Add contacts that match your profile and current outcome—not every possible contact.',
          'Validation and enrichment continue automatically in the backend after records are added.',
          'Use Pipeline to decide who moves from inventory into active work.'
        ],
        currentStage: 'Relationship expansion',
        nextStage: 'Enrichment and reachability',
        crossSellAllowed: audience !== 'single_module_paid'
      };
    }

    return null;
  }

  private buildImportContract ( contactCount: number, audience: ToddCounselingAudience, summary: Record<string, any> ): ToddCounselingContract {
    const completed = summary['importCompleted'] === true;
    const processing = summary['processing'] === true;
    const previewCount = Number( summary['previewContactCount'] || summary['mappedRowCount'] || 0 );
    if ( completed ) {
      return {
        audience,
        title: 'The import landed. Now let TODD work the network.',
        message: `Your import is complete and Network now has ${Number( contactCount || summary['contactCount'] || 0 ).toLocaleString( 'en-US' )} contact${Number( contactCount || summary['contactCount'] || 0 ) === 1 ? '' : 's'}. Validation and enrichment will continue automatically in the backend; review the list when convenient, then activate Pipeline.`,
        whyItMatters: 'Import is only the handoff. The value appears when records become reachable, prioritized, and connected to a next move.',
        primaryAction: { label: 'Review Network', route: '/contact-list' },
        secondaryAction: { label: 'Open Pipeline', route: '/contact-deal-flow' },
        teachingPoints: [
          'TODD validates email addresses and enriches available records automatically in the backend; Network does not need to stay open.',
          'Review the list when you want to see the latest processing results.',
          'After review, activate Pipeline so the most important relationships have somewhere to move.'
        ],
        currentStage: 'Import complete',
        nextStage: 'Enrichment and reachability',
        crossSellAllowed: audience !== 'single_module_paid'
      };
    }

    if ( processing ) {
      return {
        audience,
        title: 'The network is being written now.',
        message: 'TODD is processing the import. Keep this workflow open until it finishes, then review the records in Network before deciding what deserves a pipeline stage.',
        whyItMatters: 'A clean handoff prevents partial imports from becoming bad guidance later.',
        primaryAction: { label: 'Stay With Import', route: '/contact-import' },
        teachingPoints: [ 'Wait for the completion confirmation before starting another import.', 'After completion, Network is the next screen—not Pipeline yet.', 'TODD will remember that the import finished.' ],
        currentStage: 'Import in progress',
        nextStage: 'Import complete',
        crossSellAllowed: false
      };
    }

    return {
      audience,
      title: previewCount > 0 ? 'Your list is mapped. One careful review comes next.' : 'Bring the relationship layer into view.',
      message: previewCount > 0
        ? `TODD sees ${previewCount.toLocaleString( 'en-US' )} records ready for preview. Spot-check the mapping, confirm the import, and then Network can begin the real work.`
        : 'Upload a CSV, map the fields, and preview the records before writing them into Network.',
      whyItMatters: 'The preview is where small field mistakes are caught before they multiply across the relationship graph.',
      primaryAction: { label: previewCount > 0 ? 'Review Import' : 'Choose a CSV', route: '/contact-import' },
      secondaryAction: { label: 'Add One Contact Instead', route: '/contact-edit' },
      teachingPoints: [ 'Confirm names, companies, email addresses, and profile fields before importing.', 'Use Add Contact when one important relationship should start the network.', 'After import, validation and enrichment continue automatically in the backend.' ],
      currentStage: 'Relationship inventory',
      nextStage: 'Import complete',
      crossSellAllowed: false
    };
  }

  private secondaryAction ( activation: ToddActivationResolution, currentPage: string ): ToddCounselingAction | undefined {
    if ( activation.stage === 'profile_ready' ) return undefined;
    if ( currentPage !== 'daily-momentum' ) return { label: 'Open Daily Momentum', route: '/daily-momentum' };
    return undefined;
  }

  private actionLabel ( stage: string ): string {
    const labels: Record<string, string> = {
      activation_goal_pending: 'Choose First Win',
      contacts_missing: 'Import Contacts',
      sender_provisioning_required: 'Set Up Sender',
      sender_pending_admin: 'Open Operator Controls',
      operator_controls_pending: 'Open Operator Controls',
      module_specific_start: 'Start Here',
      first_campaign_pending: 'Start First Campaign',
      contacts_ready: 'Review Contact List'
    };
    return labels[stage] || 'See Next Move';
  }

  private stageLabel ( stage: string ): string {
    return String( stage || 'activation' ).replaceAll( '_', ' ' ).replace(/\b\w/g, char => char.toUpperCase());
  }

  private nextStage ( stage: string ): string | undefined {
    const next: Record<string, string> = {
      activation_goal_pending: 'First outcome',
      contacts_missing: 'Relationship inventory',
      contacts_ready: 'Pipeline activation',
      sender_provisioning_required: 'Outreach readiness',
      sender_pending_admin: 'Operator setup',
      operator_controls_pending: 'First outreach result'
    };
    return next[stage];
  }

  private whyItMatters ( stage: string ): string {
    if ( stage === 'contacts_missing' ) return 'Without relationship inventory, TODD has no real signal to prioritize.';
    if ( stage === 'activation_goal_pending' ) return 'A first outcome gives TODD a standard for deciding what “next” means.';
    if ( stage.includes( 'sender' ) ) return 'Outreach cannot create momentum until sending is safe, connected, and approved.';
    return 'TODD is most useful when every page ends with a clear next action and a reason it matters.';
  }

  private teachingPoints ( stage: string ): string[] {
    if ( stage === 'contacts_missing' ) return [ 'Import a list or add one contact manually.', 'Lead Vault is the optional path for finding additional relationships.', 'After contacts arrive, validation and enrichment continue automatically in the backend.' ];
    if ( stage === 'activation_goal_pending' ) return [ 'Choose the outcome you want first.', 'TODD will use that outcome to rank the rest of the suite.', 'You can change the goal later as the work becomes clearer.' ];
    if ( stage === 'contacts_ready' ) return [ 'TODD validates and enriches available records automatically in the backend.', 'Review Network when you want to see the latest relationship health signals.', 'Activate Pipeline when you are ready to decide which relationships deserve attention.' ];
    return [ 'TODD keeps the current blocker visible.', 'Maya prepares the work that follows the blocker.', 'Daily Momentum turns completed setup into a daily operating rhythm.' ];
  }

  private toRoute ( path: string | undefined, queryParams?: Record<string, string> ): string {
    const normalized = String( path || '/daily-momentum' ).trim() || '/daily-momentum';
    const query = queryParams ? new URLSearchParams( queryParams ).toString() : '';
    return query ? `${normalized}?${query}` : normalized;
  }
}
