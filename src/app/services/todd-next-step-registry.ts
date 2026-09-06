import { ToddCounselingAction, ToddCounselingAudience } from './todd-counseling-contract.service';
import { ToddActivationResolution } from './todd-activation-state.service';

export interface ToddNextStepContext {
  summary: Record<string, any>;
  activation: ToddActivationResolution;
  audience: ToddCounselingAudience;
}

export interface ToddNextStepResult {
  title: string;
  message: string;
  whyItMatters: string;
  primaryAction: ToddCounselingAction;
  secondaryAction?: ToddCounselingAction;
  teachingPoints: string[];
  currentStage: string;
  nextStage?: string;
  crossSellAllowed?: boolean;
}

export interface ToddNextStepRule {
  id: string;
  page: string | string[];
  when?: ( ctx: ToddNextStepContext ) => boolean;
  build: ( ctx: ToddNextStepContext ) => ToddNextStepResult;
}

// Each rule reads as "on this page, if this is true, the next step is this."
// Rules for the same page are evaluated in array order; the first one whose
// `when` is omitted or returns true wins. Order is semantically load-bearing.
export const TODD_NEXT_STEP_REGISTRY: ToddNextStepRule[] = [
  {
    id: 'contact-home:empty',
    page: 'contact-home',
    when: ( { summary, activation } ) => Number( summary['totalContacts'] || activation.facts.contactCount || 0 ) <= 0,
    build: () => ( {
      title: 'Start with the people who make the work matter.',
      message: 'Network is ready, but it has no relationship inventory yet. Import a list or add one important contact so TODD can begin seeing patterns instead of guessing.',
      whyItMatters: 'TODD needs real relationships before it can diagnose risk, recommend outreach, or create momentum.',
      primaryAction: { label: 'Import Contacts', route: '/contact-import' },
      secondaryAction: { label: 'Add a Contact', route: '/contact-edit' },
      teachingPoints: [ 'Import when you have a list; add manually when you know the first person to work with.', 'Network is the source for validation, enrichment, and reachability.', 'Pipeline comes after there is something real to prioritize.' ],
      currentStage: 'Relationship inventory',
      nextStage: 'Enrichment and reachability'
    } )
  },
  {
    id: 'contact-home:has-contacts',
    page: 'contact-home',
    build: ( { summary, activation } ) => {
      const total = Number( summary['totalContacts'] || activation.facts.contactCount || 0 );
      return {
        title: 'The relationship graph is ready for its next layer.',
        message: `TODD sees ${total.toLocaleString( 'en-US' )} contacts. Review the health signals, keep enrichment moving, and open Pipeline when you are ready to turn relationships into decisions.`,
        whyItMatters: 'Network tells TODD who exists and how trustworthy the record is; Pipeline tells TODD what should happen next.',
        primaryAction: { label: 'Review Contact List', route: '/contact-list' },
        secondaryAction: { label: 'Open Pipeline', route: '/contact-deal-flow' },
        teachingPoints: [ 'Watch valid email, enriched, and reconfigured counts to see whether records are becoming actionable.', 'Use Load More to keep enrichment moving through the network.', 'Export Contacts and Ideal Customer Persona are available when you need to take the network elsewhere.' ],
        currentStage: 'Relationship health',
        nextStage: 'Pipeline activation'
      };
    }
  },
  {
    id: 'contact-list:has-contacts',
    page: 'contact-list',
    when: ( { activation } ) => activation.facts.contactCount > 0,
    build: ( { activation } ) => ( {
      title: 'Your relationship layer is alive. Now give it a next move.',
      message: `TODD sees ${activation.facts.contactCount.toLocaleString( 'en-US' )} contact${activation.facts.contactCount === 1 ? '' : 's'}. Validation and enrichment continue automatically in the backend. Review Network when convenient, then activate Pipeline to decide who needs attention.`,
      whyItMatters: 'Better relationship data gives TODD better judgment about who is warm, who is cooling, and what deserves a follow-up.',
      primaryAction: { label: 'Open Pipeline', route: '/contact-deal-flow' },
      secondaryAction: { label: 'Find More Contacts', route: '/lead-vault' },
      teachingPoints: [ 'Load More brings additional records into the enrichment process.', 'Export Contacts and Ideal Customer Persona are supporting tools in Network.', 'Daily Momentum will turn these relationship signals into today’s highest-impact action.' ],
      currentStage: 'Relationship inventory',
      nextStage: 'Pipeline activation'
    } )
  },
  {
    id: 'contact-list:empty',
    page: 'contact-list',
    build: () => ( {
      title: 'A network starts with one reachable person.',
      message: 'TODD does not need a perfect database. Add one contact or import a small list, then let the backend validate and enrich it automatically.',
      whyItMatters: 'Without relationship inventory, TODD has no signal to rank, protect, or turn into momentum.',
      primaryAction: { label: 'Import Contacts', route: '/contact-import' },
      secondaryAction: { label: 'Add a Contact', route: '/contact-edit' },
      teachingPoints: [ 'Import a CSV when you already have a list; add a contact manually when you want to start with one important relationship.', 'After the first record arrives, Network becomes the place where TODD validates and enriches it.', 'Lead Vault is the optional path for finding additional relationships later.' ],
      currentStage: 'Relationship inventory',
      nextStage: 'Enrichment and reachability'
    } )
  },
  {
    id: 'pipeline-dashboard:needs-you-in-outreach',
    page: 'pipeline-dashboard',
    when: ( { summary, activation, audience } ) =>
      Number( summary['outreachNeedsYouCount'] || 0 ) > 0
      && ( audience !== 'single_module_paid' || activation.facts.entitlements?.outreach === true ),
    build: ( { summary } ) => ( {
      title: 'The pipeline has movement Signal Engine is waiting on.',
      message: `TODD sees ${summary['outreachNeedsYouCount']} thread${Number( summary['outreachNeedsYouCount'] ) === 1 ? '' : 's'} in Signal Engine that need your judgment on contacts already in this pipeline. Review those first — the pipeline board will still be here.`,
      whyItMatters: 'A pipeline stage is a snapshot; Signal Engine is where the next real conversation with these same contacts is waiting on you.',
      primaryAction: { label: 'Open Signal Engine', route: '/signal-engine' },
      secondaryAction: { label: 'Open Daily Momentum', route: '/daily-momentum' },
      teachingPoints: [
        'A contact can sit in a pipeline stage and still have a live thread waiting in Signal Engine — the two views don’t update each other automatically.',
        'Approve, reject, or edit each draft in Signal Engine so the thread keeps moving instead of going stale.',
        'Come back to Pipeline once Signal Engine is caught up to decide the next stage move.'
      ],
      currentStage: 'Pipeline activation',
      nextStage: 'Live outreach'
    } )
  },
  {
    id: 'pipeline-dashboard:has-pipeline-contacts',
    page: 'pipeline-dashboard',
    when: ( { summary } ) => Number( summary['pipelineContacts'] || summary['extra']?.[ 'pipelineContacts' ] || 0 ) > 0,
    build: ( { summary } ) => {
      const pipelineContacts = Number( summary['pipelineContacts'] || summary['extra']?.[ 'pipelineContacts' ] || 0 );
      return {
        title: 'The pipeline is where relationships become decisions.',
        message: `TODD sees ${pipelineContacts.toLocaleString( 'en-US' )} contact${pipelineContacts === 1 ? '' : 's'} in the pipeline. Review the stages, choose who needs a next move, and let Daily Momentum keep the work from going quiet.`,
        whyItMatters: 'A contact becomes useful when there is a current decision attached to the relationship—not merely a record sitting in Network.',
        primaryAction: { label: 'Open Daily Momentum', route: '/daily-momentum' },
        secondaryAction: { label: 'Open Outreach', route: '/outreach/app' },
        teachingPoints: [ 'Use funnel stages to separate cold reserve from relationships that need attention now.', 'Open a contact from the pipeline when the next action needs context or a human decision.', 'Daily Momentum turns pipeline pressure into a short list of today’s next moves.' ],
        currentStage: 'Pipeline activation',
        nextStage: 'Daily Momentum'
      };
    }
  },
  {
    id: 'pipeline-dashboard:empty',
    page: 'pipeline-dashboard',
    build: () => ( {
      title: 'Your contacts are here. Now give the pipeline a shape.',
      message: 'The pipeline is empty or has no contacts in view. Start by returning to Network, enrich a few reachable records, and then bring the relationships that deserve attention into Pipeline.',
      whyItMatters: 'A pipeline is not a second contact list; it is the decision layer where TODD can see movement, drift, and the next intervention.',
      primaryAction: { label: 'Open Network', route: '/contact-list' },
      secondaryAction: { label: 'Find More Contacts', route: '/lead-vault' },
      teachingPoints: [ 'Use Network to improve missing names, companies, email paths, and business context.', 'Use Lead Vault when the issue is not data quality but finding more right-fit relationships.', 'Return here when a contact is ready for a real next step.' ],
      currentStage: 'Pipeline activation',
      nextStage: 'Daily Momentum'
    } )
  },
  {
    id: 'outreach:needs-you',
    page: [ 'outreach-home', 'outbox-cockpit', 'signal-engine' ],
    when: ( { summary } ) => Number( summary['needsYouCount'] || summary['needsHuman'] || 0 ) > 0,
    build: ( { summary } ) => {
      const needsYou = Number( summary['needsYouCount'] || summary['needsHuman'] || 0 );
      return {
        title: 'Outreach is waiting for human judgment.',
        message: `TODD has ${needsYou.toLocaleString( 'en-US' )} thread${needsYou === 1 ? '' : 's'} that need your judgment. Review the draft, approve or revise it, and let TODD carry the live thread after the send.`,
        whyItMatters: 'Outreach is where a prioritized relationship becomes a real conversation. TODD prepares the work; you keep control of judgment, consent, and tone.',
        primaryAction: { label: 'Review Threads', route: '/signal-engine' },
        secondaryAction: { label: 'Open Daily Momentum', route: '/daily-momentum' },
        teachingPoints: [
          'Signal Engine is the approval lane for drafts and replies that need a human decision.',
          'Outbox proves what was approved, queued, sent, or blocked; it is the evidence layer after drafting.',
          'When a thread is sent, TODD watches for the next signal instead of treating send as the finish line.'
        ],
        currentStage: 'Live outreach',
        nextStage: 'Daily Momentum and reply signals'
      };
    }
  },
  {
    id: 'outreach:idle',
    page: [ 'outreach-home', 'outbox-cockpit', 'signal-engine' ],
    build: ( { summary } ) => {
      const drafts = Number( summary['draftReady'] || summary['draftReadyCount'] || 0 );
      return {
        title: 'Outreach turns a relationship signal into a live thread.',
        message: `Outreach is ${drafts > 0 ? `holding ${drafts.toLocaleString( 'en-US' )} draft${drafts === 1 ? '' : 's'} for review` : 'ready for the next qualified relationship signal'}. The job here is not to send more—it is to create the right next conversation.`,
        whyItMatters: 'Outreach is where a prioritized relationship becomes a real conversation. TODD prepares the work; you keep control of judgment, consent, and tone.',
        primaryAction: { label: 'Open Signal Engine', route: '/signal-engine' },
        secondaryAction: { label: 'Open Daily Momentum', route: '/daily-momentum' },
        teachingPoints: [
          'Signal Engine is the approval lane for drafts and replies that need a human decision.',
          'Outbox proves what was approved, queued, sent, or blocked; it is the evidence layer after drafting.',
          'When a thread is sent, TODD watches for the next signal instead of treating send as the finish line.'
        ],
        currentStage: 'Live outreach',
        nextStage: 'Daily Momentum and reply signals'
      };
    }
  },
  {
    id: 'daily-momentum:has-attention-items',
    page: 'daily-momentum',
    when: ( { summary } ) =>
      summary['hasPendingAction'] === true
      || Number( summary['immediateAttentionCount'] || 0 ) > 0
      || ( Array.isArray( summary['blockers'] ) && summary['blockers'].length > 0 ),
    build: ( { summary } ) => {
      const attentionCount = Number( summary['immediateAttentionCount'] || 0 );
      const blockerCount = Array.isArray( summary['blockers'] ) ? summary['blockers'].length : 0;
      const status = String( summary['status'] || '' ).trim();
      return {
        title: 'This is where the suite becomes one next move.',
        message: `TODD found ${attentionCount || blockerCount || 1} item${( attentionCount || blockerCount || 1 ) === 1 ? '' : 's'} that deserve attention${status ? `, and the current status is ${status.toLowerCase()}` : ''}. Start with the first card, complete or approve it, and let the next signal surface after that.`,
        whyItMatters: 'Daily Momentum prevents every application from becoming another place you have to remember to check. It gathers the strongest signals and gives the work an order.',
        primaryAction: { label: 'Work the Top Move', route: '/daily-momentum' },
        secondaryAction: { label: 'Refresh Momentum', route: '/daily-momentum' },
        teachingPoints: [
          'Start with the highest-priority card instead of opening every module at once.',
          'TODD prepares work; you approve or complete the moments that require human judgment.',
          'When the move is complete, the next signal should replace it—momentum is a loop, not a checklist.'
        ],
        currentStage: 'Daily operating rhythm',
        nextStage: 'Complete today’s highest-impact move'
      };
    }
  },
  {
    id: 'daily-momentum:quiet',
    page: 'daily-momentum',
    build: () => ( {
      title: 'Daily Momentum is your one place to decide what is next.',
      message: 'TODD is watching the relationship, outreach, proof, and execution signals together. There is no urgent item right now, so use this page as the daily starting point and return when a signal changes.',
      whyItMatters: 'The suite creates value when its signals converge into action. Daily Momentum is where you see that convergence without manually checking every application.',
      primaryAction: { label: 'Refresh Today’s Signal', route: '/daily-momentum' },
      secondaryAction: { label: 'Review Network', route: '/contact-list' },
      teachingPoints: [
        'Open Daily Momentum at the start of the workday to see the strongest available move.',
        'Use the source module only when TODD points you there for context or approval.',
        'A quiet board is useful information: it means TODD did not invent work just to keep the screen busy.'
      ],
      currentStage: 'Daily operating rhythm',
      nextStage: 'Respond to the next signal'
    } )
  }
];
