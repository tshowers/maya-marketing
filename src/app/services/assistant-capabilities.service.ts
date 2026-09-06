import { Inject, Injectable } from '@angular/core';
import { NavConfigService } from './nav-config.service';

export type LocalCapability = {
  id: string;
  label: string;
  hint?: string;
  patterns: string[];
  guard?: () => boolean;
};

export type DirectNavResult =
  | { handled: false; }
  | { handled: true; kind: 'message'; message: string; }
  | { handled: true; kind: 'navigate'; path: string; };

type WorkflowGuide = {
  id: string;
  patterns: RegExp[];
  message: string;
};

type RouteIntentGuide = {
  id: string;
  route: string;
  phrases: string[];
  message: string;
};

export type CapabilityContext = {
  hasSelectedContact: boolean;
  selectedContactName?: string;
  placeholderChoices: string[];
};

@Injectable( {
  providedIn: 'root'
} )
export class AssistantCapabilitiesService {
  constructor (
    @Inject( NavConfigService ) private readonly navConfig: Pick<NavConfigService, 'getAssistantRouteAliases'> = {
      getAssistantRouteAliases: () => ( {} )
    }
  ) { }

  private readonly directRouteAliases: Record<string, string> = {
    'contacts': 'network/app',
    'my contacts': 'network/app',
    'contact list': 'contact-list',
    'add contact': 'contact-edit',
    'import contacts': 'contact-import',
    'email composer': 'compose-email',
    'compose email': 'compose-email',
    'create email': 'compose-email',
    'create an email': 'compose-email',
    'email editor': 'compose-email',
    'email inbox': 'inbox-access',
    'my inbox': 'inbox-access',
    'inbox': 'inbox-access',
    'connect inbox': 'inbox-access',
    'inbox access': 'inbox-access',
    'email queue': 'signal-engine',
    'catalyst': 'email-processor',
    'growth': 'outreach/app',
    'network': 'network/app',
    'my network': 'network/app',
    'signal engine': 'signal-engine',
    'outreach home': 'outreach/app',
    'network overview': 'network/app',
    'relationships': 'network/app',
    'my relationships': 'network/app',
    'profile': 'update-profile',
    'my profile': 'update-profile',
    'user profile': 'update-profile',
    'user-profile': 'update-profile',
    'user': 'update-profile',
    'execution': 'moves/app',
    'moves home': 'moves/app',
    'knowledge': 'docs/app',
    'docs home': 'docs/app',
    'document home': 'docs/app',
    'open docs': 'docs/app',
    'documents library': 'documents',
    'document library': 'documents',
    'proposal history': 'proposal-history',
    'response flows': 'response-flow',
    'knowledge base': 'knowledge-base',
    'customer health': 'pulse/app',
    'visibility': 'outreach/social/command',
    'social command': 'outreach/social/command',
    'maya': 'marketing-director/session',
    'marketing director': 'marketing-director/session',
    'marketing employee': 'marketing-employee',
    'daily momentum': 'daily-momentum',
    'lead vault': 'lead-vault',
    'today': 'today'
  };

  private readonly directCommandRoutes: { path: string; requiresId?: boolean; idParam?: string; }[] = [
    { path: 'home' },
    { path: 'app-dashboard' },
    { path: 'today' },
    { path: 'daily-momentum' },
    { path: 'momentum-receipts' },
    { path: 'mission' },
    { path: 'admin' },
    { path: 'logout' },
    { path: 'terms-and-conditions' },
    { path: 'privacy-policy' },
    { path: 'contact-list' },
    { path: 'match-maker' },
    { path: 'response-flow' },
    { path: 'knowledge-base' },
    { path: 'contact-edit' },
    { path: 'task-edit' },
    { path: 'contact/:id', requiresId: true, idParam: 'id' },
    { path: 'network/app' },
    { path: 'inbox-access' },
    { path: 'engagement' },
    { path: 'signal-engine' },
    { path: 'email-processor' },
    { path: 'contact-import' },
    { path: 'contact-deal-flow' },
    { path: 'outreach' },
    { path: 'outreach/app' },
    { path: 'lead-vault' },
    { path: 'outreach/social' },
    { path: 'outreach/social/command' },
    { path: 'outreach/social/accounts' },
    { path: 'outreach/social/queue' },
    { path: 'outreach/social/strategy' },
    { path: 'outreach/social/source' },
    { path: 'outreach/social/signals' },
    { path: 'sayit' },
    { path: 'pulse' },
    { path: 'moves' },
    { path: 'docs' },
    { path: 'network' },
    { path: 'say-it' },
    { path: 'post/:id', requiresId: true, idParam: 'id' },
    { path: 'pricing' },
    { path: 'compose-email' },
    { path: 'marketing-director' },
    { path: 'marketing-director/session' },
    { path: 'marketing-employee' },
    { path: 'dropdown-manager' },
    { path: 'update-profile' },
    { path: 'notes' },
    { path: 'upload' },
    { path: 'help' },
    { path: 'api-docs' },
    { path: 'settings' },
    { path: 'bad-request' },
    { path: 'forgot-password' },
    { path: 'reseller-signup' },
    { path: 'reseller-onboarding' },
    { path: 'reseller-program' },
    { path: 'investor-relations' },
    { path: 'investment-overview' },
    { path: 'reseller-terms' },
    { path: 'survey' },
    { path: 'survey-dashboard' },
    { path: 'survey-dashboard/:surveyId', requiresId: true, idParam: 'surveyId' },
    { path: 'survey-list' },
    { path: 'take-survey/:id', requiresId: true, idParam: 'id' },
    { path: 'survey-home' },
    { path: 'task-home' },
    { path: 'todd' },
    { path: 'tasks' },
    { path: 'document' },
    { path: 'documents' },
    { path: 'document-editor' },
    { path: 'document-editor/:id', requiresId: true, idParam: 'id' },
    { path: 'proposal-history' },
    { path: 'rfp-list' },
    { path: 'rfp-upload' }
  ];

  private readonly workflowGuides: WorkflowGuide[] = [
    {
      id: 'create-campaign',
      patterns: [
        /\bhow do i create (an |a )?campaign\b/i,
        /\bhow to create (an |a )?campaign\b/i,
        /\bhelp me create (an |a )?campaign\b/i,
        /\bcan you help me create (an |a )?campaign\b/i,
        /\bcreate (an |a )?campaign\b/i,
      ],
      message: [
        '<p><strong>There is no campaign to build anymore - Maya drafts individual outreach automatically.</strong></p>',
        '<p><strong>A.</strong> If you already know who should receive individual follow-up, open <strong>/outreach/app</strong> and let Maya help prepare the next move.</p>',
        '<p><strong>B.</strong> If you want TODD to choose from the strongest contacts, open Catalyst at <strong>/email-processor</strong>.</p>',
        '<p><strong>C.</strong> If you need guidance on the angle, offer, or messaging, use Maya at <strong>/marketing-director/session</strong>.</p>',
        '<p><strong>D.</strong> Import contacts and Maya will start drafting thoughtful, individual outreach and follow-up on her own - review what she drafts at <strong>/signal-engine</strong>.</p>'
      ].join( '' )
    },
    {
      id: 'add-contacts',
      patterns: [
        /\bhow do i add (a )?contact\b/i,
        /\bhow to add (a )?contact\b/i,
        /\bhow do i import contacts\b/i,
        /\bhow to import contacts\b/i,
      ],
      message: [
        '<p><strong>For contacts, there are two main paths.</strong></p>',
        '<p><strong>A.</strong> Add one person manually at <strong>/contact-edit</strong>.</p>',
        '<p><strong>B.</strong> Import a CSV or larger list at <strong>/contact-import</strong>.</p>',
        '<p>If you want to review everything after that, open <strong>/contact-list</strong> or the Network cockpit at <strong>/network/app</strong>.</p>'
      ].join( '' )
    },
    {
      id: 'create-move',
      patterns: [
        /\bhow do i create (a )?(move|task)\b/i,
        /\bhow to create (a )?(move|task)\b/i,
      ],
      message: [
        '<p><strong>To create a Move, you have two good options.</strong></p>',
        '<p><strong>A.</strong> Open <strong>/task-edit</strong> for a direct new Move.</p>',
        '<p><strong>B.</strong> Open the Execution cockpit at <strong>/moves/app</strong> if you want TODD to help you place that work in context.</p>',
        '<p>If the work belongs to a larger outcome, use Mission Workspace at <strong>/mission</strong>.</p>'
      ].join( '' )
    },
    {
      id: 'create-doc',
      patterns: [
        /\bhow do i create (a )?(document|doc|proposal)\b/i,
        /\bhow to create (a )?(document|doc|proposal)\b/i,
        /\bhow do i upload (a )?document\b/i,
      ],
      message: [
        '<p><strong>Docs has a few different entry points.</strong></p>',
        '<p><strong>A.</strong> Start in the Knowledge cockpit at <strong>/docs/app</strong> if you want the full command deck.</p>',
        '<p><strong>B.</strong> Use <strong>/document-editor</strong> to draft or edit a document directly.</p>',
        '<p><strong>C.</strong> Use <strong>/document</strong> to upload a file for TODD to work from.</p>',
        '<p><strong>D.</strong> Use <strong>/rfp-upload</strong> if the goal is to turn an RFP into a proposal.</p>'
      ].join( '' )
    },
    {
      id: 'create-pulse',
      patterns: [
        /\bhow do i create (a )?(pulse|survey)\b/i,
        /\bhow to create (a )?(pulse|survey)\b/i,
      ],
      message: [
        '<p><strong>Pulse has two main routes.</strong></p>',
        '<p><strong>A.</strong> Use <strong>/survey</strong> to create a new Pulse directly.</p>',
        '<p><strong>B.</strong> Use <strong>/pulse/app</strong> if you want the full Customer Health cockpit first.</p>',
        '<p>After that, <strong>/survey-list</strong> is where you review existing Pulses.</p>'
      ].join( '' )
    },
    {
      id: 'social-command',
      patterns: [
        /\bhow do i create (a )?(social post|social campaign)\b/i,
        /\bhow to create (a )?(social post|social campaign)\b/i,
        /\bhow do i use social\b/i,
      ],
      message: [
        '<p><strong>For social work, start with Visibility.</strong></p>',
        '<p><strong>A.</strong> Open <strong>/outreach/social/command</strong> for the command center.</p>',
        '<p><strong>B.</strong> Use the Social Calendar to review and approve Maya\'s prepared content.</p>',
        '<p><strong>C.</strong> Use <strong>/outreach/social/accounts</strong> to connect and manage channels.</p>'
      ].join( '' )
    }
  ];

  private readonly routeIntentGuides: RouteIntentGuide[] = [
    {
      id: 'network-cockpit',
      route: '/network/app',
      phrases: [
        'open relationships',
        'go to relationships',
        'show relationships',
        'open my relationship dashboard',
        'show my relationship dashboard',
        'take me to my network',
        'open my network',
        'show my network',
        'show the network dashboard',
        'show the contact dashboard',
        'open the contact dashboard',
        'show me the big picture',
        'give me a relationship overview',
        'give me a network overview',
        'summarize my relationships',
        'summarize my contact network',
        'how healthy is my network',
        'how healthy are my relationships',
        'what is my relationship health',
        'show relationship health',
        'show network health',
        'show contact health',
        'what is my momentum score',
        'how is my relationship momentum',
        'is my network healthy',
        'is my contact data healthy',
        'what is wrong with my network',
        'where is my network weak',
        'what relationship problems do i have',
        'diagnose my relationships',
        'diagnose my network',
        'show my relationship problems',
        'show business health',
        'who needs attention',
        'how many contacts need attention',
        'how many relationships need attention',
        'are any relationships going cold',
        'show relationships going cold',
        'show cooling relationships',
        'are contacts going quiet',
        'how many contacts have gone quiet',
        'am i losing relationship momentum',
        'where am i losing momentum',
        'do i have overdue follow ups',
        'how much follow up risk do i have',
        'show my follow up risk',
        'are important contacts being ignored',
        'how many important contacts need attention',
        'how complete is my contact data',
        'is my contact data complete',
        'show data readiness',
        'what is my data readiness',
        'how many contacts need enrichment',
        'how many records need enrichment',
        'show enrichment progress',
        'how many contacts are enriched',
        'what percentage of contacts are enriched',
        'are my contact records incomplete',
        'show incomplete contact data',
        'how much contact information is missing',
        'is my network ready for outreach',
        'how outreach ready is my network',
        'how many contacts are reachable',
        'show reachability',
        'what is my reachability score',
        'how many valid emails do i have',
        'how many contacts have valid emails',
        'what percentage of contacts have valid emails',
        'are my email addresses verified',
        'how many emails are verified',
        'how many contacts cannot be reached',
        'show unreachable contacts',
        'is my contact information trustworthy',
        'can i trust my contact data',
        'what is my bounce risk',
        'is my network safe for email outreach',
        'how ready are my contacts for email',
        'how many contacts have a next move',
        'show next move readiness',
        'how many next moves are ready',
        'how many contacts are staged',
        'show contacts staged for action',
        'are opportunities becoming inactive',
        'show inactive opportunities',
        'where is opportunity motion missing',
        'how many contacts do not have a next step',
        'show next step progress',
        'is todd preparing follow ups',
        'what should happen next',
        'is todd finding the next move',
        'how many relationships are ready for action',
        'what is todd doing',
        'what is todd doing about my relationships',
        'show todd activity',
        'show the treatment log',
        'open the treatment log',
        'what problems is todd treating',
        'what is todd working on',
        'show active treatments',
        'what has todd fixed',
        'show relief progress',
        'is relationship health improving',
        'what relief has todd delivered',
        'show proof of improvement',
        'show symptom treatment and relief',
        'show the care cycle',
        'what is todd monitoring',
        'how many contacts do i have',
        'what is my total contact count',
        'show total contacts',
        'how large is my network',
        'how many important contacts do i have',
        'how many subscribers do i have',
        'show my network numbers',
        'show contact statistics',
        'show relationship metrics',
        'show network metrics',
        'what is my contact limit',
        'how much contact capacity do i have',
        'how much capacity is left',
        'how many contacts can i add',
        'how many contacts do i have remaining',
        'am i near my contact limit',
        'have i reached my contact limit',
        'am i over capacity',
        'show capacity usage',
        'what percentage of capacity am i using',
        'why can i not add more contacts',
        'why can i not import more contacts',
        'do i need more contact capacity'
      ],
      message: [
        '<p><strong>This sounds like a Network cockpit question.</strong></p>',
        '<p>Open <strong>/network/app</strong> for relationship health, contact quality, reachability, enrichment, and next-move readiness.</p>'
      ].join( '' )
    },
    {
      id: 'inbox-access',
      route: '/inbox-access',
      phrases: [
        'connect my inbox',
        'connect email inbox',
        'connect my email',
        'open inbox access',
        'set up inbox access',
        'setup inbox access',
        'open my inbox',
        'take me to inbox access',
        'how do i connect my inbox',
        'how do i connect my email'
      ],
      message: [
        '<p><strong>Inbox setup lives in Inbox Access.</strong></p>',
        '<p>Open <strong>/inbox-access</strong> to connect your inbox so TODD can read, draft, and track email work from one place.</p>'
      ].join( '' )
    },
    {
      id: 'compose-email',
      route: '/compose-email',
      phrases: [
        'create an email',
        'create email',
        'open the email editor',
        'open email editor',
        'open compose email',
        'take me to compose email',
        'go to compose email'
      ],
      message: [
        '<p><strong>Email drafting lives in Compose.</strong></p>',
        '<p>Open <strong>/compose-email</strong> to create or edit an email in the editor.</p>'
      ].join( '' )
    },
    {
      id: 'contact-list-operations',
      route: '/contact-list',
      phrases: [
        'find john smith',
        'show me john smith',
        'look up john smith',
        'do i know john smith',
        'is john smith in my contacts',
        'search for sarah at microsoft',
        'find everyone named michael',
        'show contacts at microsoft',
        'find people at accenture',
        'who do i know at deloitte',
        'show everyone from amazon',
        'show people who work for google',
        'show seattle contacts i have not emailed',
        'find customers with valid email addresses',
        'show executives at technology companies',
        'find contacts worth more than ten thousand dollars',
        'show contacts in seattle',
        'find people in washington',
        'show california contacts',
        'who do i know in atlanta',
        'show government contacts',
        'find minority owned businesses',
        'show vendors',
        'find prospects',
        'find companies that do cybersecurity',
        'show contacts with cloud capabilities',
        'find software development companies',
        'show architects',
        'find marketing directors',
        'show people in healthcare',
        'find technology executives',
        'show active contacts',
        'show inactive contacts',
        'show hot contacts',
        'open my hot contacts',
        'show contacts due for follow up',
        'show vip contacts',
        'find people who have not been emailed',
        'show contacts ready for outreach',
        'find contacts who opened an email',
        'show contacts on the hilco project',
        'find project stakeholders',
        'show contacts with invalid emails',
        'find contacts with no phone number',
        'show incomplete contacts',
        'show contacts that need enrichment',
        'verify these email addresses',
        'show unverified emails',
        'check email quality',
        'show contacts that need reconfiguration',
        'clean up contact data',
        'sort contacts by company',
        'sort by last name',
        'show newest contacts first',
        'show the table',
        'switch to table view',
        'show raw json',
        'change visible columns',
        'show the phone column',
        'select all contacts',
        'select everyone in this list',
        'clear my selections',
        'bulk update contacts',
        'update all visible contacts',
        'queue these contacts for outreach',
        'email everyone selected',
        'add these people to the email queue',
        'prepare outreach for this list',
        'delete the selected contacts',
        'export these contacts',
        'download the contact list',
        'export the current results',
        'clear contact filters',
        'reset the list',
        'remove all filters'
      ],
      message: [
        '<p><strong>This sounds like contact-list work.</strong></p>',
        '<p>Open <strong>/contact-list</strong> to browse, filter, sort, select, export, queue outreach, or inspect individual records.</p>',
        '<p>Once you are there, the TODD popup has page context and can help with the list you are looking at.</p>'
      ].join( '' )
    },
    {
      id: 'contact-import-operations',
      route: '/contact-import',
      phrases: [
        'import contacts',
        'open contact import',
        'take me to contact import',
        'show the contact importer',
        'upload contacts',
        'add contacts from a file',
        'bring contacts into todd',
        'import people into my network',
        'load contacts from a spreadsheet',
        'start a contact import',
        'open network import',
        'add a contact list',
        'upload a csv',
        'upload my contact file',
        'choose a contact csv',
        'import this csv',
        'load this spreadsheet',
        'drag in my contact file',
        'select a csv file',
        'upload my mailing list',
        'upload my customer list',
        'upload my prospect list',
        'bring in contacts from excel',
        'load contacts from a file',
        'what format should my contact file use',
        'what columns are required',
        'what headers does the csv need',
        'how should i format my csv',
        'what fields can i import',
        'what contact fields are supported',
        'is email required',
        'show import instructions',
        'how do i prepare my contact file',
        'download the contact template',
        'show me the csv template',
        'give me an import template',
        'download a sample csv',
        'load the sample csv',
        'show me how import works',
        'use sample contacts',
        'map my csv columns',
        'match the headers',
        'match contact fields',
        'fix the column mapping',
        'preview the contacts',
        'review the import',
        'show me the mapped data',
        'check the contacts before importing',
        'show what will be imported',
        'start the import',
        'import these contacts',
        'complete the contact import',
        'submit the contact import',
        'what is the import status',
        'is the import still running',
        'how far along is the import',
        'show import progress',
        'how many contacts were imported',
        'show the import results',
        'how many contacts failed',
        'show import failures',
        'show the import log',
        'why did the import fail',
        'show failed contacts',
        'which records failed',
        'show import errors',
        'help me fix the import',
        'cancel the import',
        'reset the contact import',
        'start another import',
        'upload another csv',
        'why can i not import these contacts',
        'have i reached my contact limit',
        'how much contact capacity is left',
        'do i need to upgrade to import',
        'buy more contacts',
        'upgrade my contact limit',
        'import contacts for this campaign',
        'add contacts to my campaign',
        'upload a campaign audience',
        'return to my campaign',
        'go back to the campaign',
        'continue the campaign',
        'show the imported contacts',
        'view the contacts i imported'
      ],
      message: [
        '<p><strong>This sounds like contact-import work.</strong></p>',
        '<p>Open <strong>/contact-import</strong> to upload a CSV, map fields, preview records, run the import, review results, or resolve contact-capacity issues.</p>',
        '<p>Once you are there, the TODD popup has import-page context and can help with the current step.</p>'
      ].join( '' )
    },
    {
      id: 'document-home-operations',
      route: '/docs/app',
      phrases: [
        'open knowledge',
        'open the knowledge dashboard',
        'show my knowledge dashboard',
        'take me to docs',
        'open docs',
        'show document health',
        'show knowledge health',
        'open the document cockpit',
        'show the knowledge cockpit',
        'take me to business knowledge',
        'show my business memory',
        'open document home',
        'give me a knowledge overview',
        'summarize my documents',
        'summarize my knowledge base',
        'what knowledge do we have',
        'show the big picture for documents',
        'how is our business knowledge doing',
        'what is the state of our documents',
        'give me a document summary',
        'show knowledge metrics',
        'show document metrics',
        'how much knowledge is stored',
        'what is happening in docs',
        'how healthy is my knowledge base',
        'what is my knowledge health',
        'show my knowledge score',
        'is our business knowledge healthy',
        'diagnose my documents',
        'what is wrong with our knowledge',
        'where is our knowledge system weak',
        'how healthy are our documents',
        'is our knowledge organized',
        'how strong is our business memory',
        'how easy are my documents to find',
        'show findability health',
        'is our knowledge easy to find',
        'do we have a document findability problem',
        'how organized is the document library',
        'are documents getting lost',
        'can people find the right document',
        'what is hurting document findability',
        'show knowledge retrieval health',
        'how searchable is our knowledge',
        'do we have naming problems',
        'how fresh is our knowledge',
        'show knowledge freshness',
        'are any documents going stale',
        'how many stale documents do we have',
        'is our information out of date',
        'show aging documents',
        'how current are our documents',
        'how many proposals can we reuse',
        'show proposal reuse',
        'do we have reusable proposal content',
        'how many drafts do we have',
        'show draft pressure',
        'what drafts need attention',
        'show capture readiness',
        'how ready is our knowledge for reuse',
        'can todd use our saved knowledge',
        'how much reusable knowledge do we have',
        'show reusable assets',
        'what documents can todd reuse',
        'how many documents do i have',
        'show total document count',
        'how large is my document library',
        'show document inventory',
        'what knowledge problems do i have',
        'show knowledge symptoms',
        'what is wrong with our docs',
        'what is todd doing with my documents',
        'show knowledge treatment',
        'show todd activity in docs',
        'show knowledge relief',
        'is document health improving',
        'show proof of knowledge improvement',
        'show the knowledge care cycle',
        'show symptom treatment relief and proof',
        'open the knowledge diagnosis board',
        'preview the knowledge dashboard',
        'what can i see before signing in',
        'show knowledge preview',
        'why are the document values zero'
      ],
      message: [
        '<p><strong>This sounds like Docs cockpit work.</strong></p>',
        '<p>Open <strong>/docs/app</strong> for knowledge health, freshness, findability, proposal reuse, draft pressure, and TODD knowledge-treatment activity.</p>',
        '<p>Once you are there, the TODD popup has the live Docs page context and can help from that cockpit.</p>'
      ].join( '' )
    },
    {
      id: 'document-list-operations',
      route: '/documents',
      phrases: [
        'open documents',
        'show my documents',
        'take me to documents',
        'open the document vault',
        'show my files',
        'browse my documents',
        'open saved files',
        'show the document library',
        'take me to the document repository',
        'show files todd knows about',
        'open my business files',
        'show stored documents',
        'show all documents',
        'browse all files',
        'show everything in the vault',
        'list my documents',
        'show all saved files',
        'browse the document library',
        'show every document',
        'show all uploaded files',
        'let me look through my documents',
        'show everything todd has stored',
        'open the full document list',
        'show my document collection',
        'search my documents',
        'find a document',
        'search the document vault',
        'look for a file',
        'find documents about pricing',
        'search files by title',
        'find documents by topic',
        'search by author',
        'find documents by type',
        'look through document summaries',
        'search stored files',
        'find something in my vault',
        'find the acme proposal',
        'show the security policy',
        'find the document named onboarding plan',
        'look for the microsoft presentation',
        'show the file called project scope',
        'find my business plan',
        'show documents about cybersecurity',
        'find files about pricing',
        'show documents related to onboarding',
        'find our ai policy documents',
        'show documents written by vikki',
        'find files authored by tyrone',
        'show documents from this author',
        'show pdfs',
        'find all images',
        'show videos',
        'find spreadsheets',
        'show presentations',
        'show stale documents',
        'show old documents',
        'find documents that need review',
        'find outdated documents',
        'show documents with duplicate titles',
        'find duplicate document names',
        'clear document search',
        'reset the document list',
        'remove document filters',
        'open this document',
        'view this file',
        'show the full document',
        'preview this document',
        'show this file without leaving the page',
        'open the lightbox',
        'play this video',
        'open the video',
        'watch this file',
        'edit this draft',
        'open this document in the editor',
        'continue writing this document',
        'update this proposal',
        'add a document',
        'upload a document',
        'store a new file',
        'add something to the vault',
        'upload a pdf',
        'save a new file',
        'open the document editor',
        'start writing a document',
        'create a draft',
        'write a new document',
        'compose a document',
        'delete this document',
        'remove this file',
        'remove this document from the vault',
        'turn this document into a post',
        'make a social post from this file',
        'use this document for social media',
        'create content from this pdf',
        'show carousel view',
        'switch to the carousel',
        'open desk view',
        'show documents on the desk',
        'switch to desk view',
        'open pins view',
        'show document pins',
        'switch to pins',
        'reset the desk layout',
        'show the previous document',
        'previous file',
        'show the next document',
        'next document',
        'focus on this document',
        'make this the active document',
        'select this file',
        'add knowledge from these documents',
        'create a knowledge entry',
        'teach todd from a document',
        'turn a document into reusable knowledge',
        'open proposal history',
        'show past proposals',
        'browse old proposals',
        'upload an rfp',
        'add an rfp',
        'show my rfps',
        'open the rfp list',
        'help me with documents',
        'how do documents work',
        'show document help',
        'how do i use the document vault',
        'help me find a file',
        'what can i do with documents'
      ],
      message: [
        '<p><strong>This sounds like Documents workspace work.</strong></p>',
        '<p>Open <strong>/documents</strong> to browse, search, preview, organize, upload, edit, or remove stored files, and to jump into related document actions like <strong>/response-flow</strong>, <strong>/document-editor</strong>, <strong>/proposal-history</strong>, <strong>/rfp-upload</strong>, or <strong>/rfp-list</strong>.</p>',
        '<p>Once you are there, the TODD popup has the live Documents page context and can help with the current file or view.</p>'
      ].join( '' )
    },
    {
      id: 'maya-session-operations',
      route: '/marketing-director/session',
      phrases: [
        'talk with maya',
        'talk to maya',
        'open maya',
        'start a marketing conversation',
        'work with the marketing director',
        'ask maya',
        'start a strategy session',
        'open my maya session',
        'get marketing advice',
        'start the marketing review',
        'bring in maya',
        'why is my marketing not working',
        'what is wrong with our marketing',
        'diagnose my marketing',
        'why are we not getting traction',
        'why are people not responding',
        'why is this campaign failing',
        'help me find the real marketing problem',
        'review my offer',
        'is my offer clear',
        'help me improve the offer',
        'help me with positioning',
        'how should we position this',
        'what makes us different',
        'who should we market to',
        'who is the right audience',
        'help me define the customer',
        'review my message',
        'does this message work',
        'improve our marketing language',
        'what should the headline say',
        'what campaign should we run',
        'help me choose a campaign',
        'what is the right marketing approach',
        'what should we fix first',
        'what is the next marketing move',
        'which marketing task matters most',
        'review this campaign',
        'will this campaign work',
        'review my landing page',
        'why is this page not converting',
        'review this sales email',
        'help me improve this outreach email',
        'review my social strategy',
        'what should we post about',
        'is our brand clear',
        'review our company message',
        'create a marketing plan',
        'give me a marketing strategy',
        'build a marketing roadmap',
        'what should we test',
        'suggest a marketing experiment',
        'what should we stop doing',
        'what marketing is wasting time',
        'turn this into work',
        'prepare this for execution',
        'have todd carry this out',
        'explain your reasoning',
        'why is this the priority',
        'summarize the session',
        'what did maya recommend',
        'give me the marketing diagnosis'
      ],
      message: [
        '<p><strong>This sounds like Maya work.</strong></p>',
        '<p>Open <strong>/marketing-director/session</strong> when you want Maya to diagnose a marketing problem, review an offer, clarify positioning, define the audience, improve messaging, or turn strategy into execution-ready direction.</p>',
        '<p>Once you are there, Maya can carry the strategy conversation directly in her own session.</p>'
      ].join( '' )
    },
    {
      id: 'response-flow-operations',
      route: '/response-flow',
      phrases: [
        'add knowledge',
        'open knowledge entry',
        'create a knowledge entry',
        'capture some knowledge',
        'save something to the knowledge base',
        'add something to the knowledge base',
        'open the knowledge builder',
        'record business knowledge',
        'store an answer',
        'create a reusable answer',
        'teach todd something',
        'add information for todd to remember',
        'create a new knowledge entry',
        'save a new question and answer',
        'add a reusable answer',
        'record an answer to a common question',
        'create an answer todd can use later',
        'add a question to the knowledge base',
        'save this information for later',
        'turn this into reusable knowledge',
        'save this answer',
        'remember this answer',
        'keep this response for later',
        'store what todd just said',
        'turn this answer into a knowledge entry',
        'edit this knowledge entry',
        'update this answer',
        'change the saved response',
        'revise this knowledge',
        'correct this answer',
        'add a question',
        'write the question',
        'save this common question',
        'categorize this knowledge',
        'add a category',
        'classify this entry',
        'add the answer',
        'write a response',
        'save this response',
        'tell todd how to answer this',
        'add a sourced answer',
        'cite the source',
        'add evidence for this answer',
        'attach an existing document',
        'link this answer to a document',
        'attach a file from my document library',
        'upload a supporting document',
        'attach a file',
        'upload evidence',
        'attach a pdf',
        'add a recommendation',
        'recommend a practice',
        'add a policy recommendation',
        'add a resource',
        'attach a useful link',
        'save this reference',
        'add keywords',
        'tag this knowledge',
        'add search terms',
        'improve how this entry is found',
        'make this easier to find',
        'help todd reuse this answer',
        'prepare this answer for reuse',
        'preview the knowledge entry',
        'show me how the answer will look',
        'review the saved answer',
        'save this knowledge entry',
        'submit the answer',
        'publish this to the knowledge base',
        'turn this into a post',
        'make a social post from this',
        'repurpose this answer',
        'exit knowledge entry',
        'go back to the knowledge base',
        'cancel this entry',
        'discard this entry'
      ],
      message: [
        '<p><strong>This sounds like Response Flow work.</strong></p>',
        '<p>Open <strong>/response-flow</strong> to create or update reusable knowledge with questions, answers, sources, recommendations, resources, categories, and keywords.</p>',
        '<p>Once you are there, the TODD popup has the live Response Flow context and can help with the current step.</p>'
      ].join( '' )
    },
    {
      id: 'knowledge-base-operations',
      route: '/knowledge-base',
      phrases: [
        'open the knowledge base',
        'show the knowledge base',
        'take me to the knowledge base',
        'open saved knowledge',
        'show what todd knows',
        'browse business knowledge',
        'open the knowledge repository',
        'show saved answers',
        'show our reusable knowledge',
        'open business memory',
        'show stored questions and answers',
        'take me to saved knowledge',
        'show all knowledge entries',
        'browse saved answers',
        'show all questions and answers',
        'show everything todd knows',
        'browse the knowledge library',
        'show our knowledge items',
        'list saved responses',
        'show reusable answers',
        'show the full knowledge base',
        'let me browse our business knowledge',
        'show captured knowledge',
        'list all knowledge entries',
        'search the knowledge base',
        'find knowledge about pricing',
        'find our answer about refunds',
        'search saved answers',
        'look for information about onboarding',
        'find a question about security',
        'search our business knowledge',
        'look through saved responses',
        'find knowledge containing microsoft',
        'search questions and answers',
        'find anything about proposals',
        'look for saved guidance',
        'find the question about pricing',
        'show our refund question',
        'find the entry about security',
        'do we have a question about onboarding',
        'show the saved question about contracts',
        'find common questions about todd',
        'show questions about implementation',
        'do we already have this question saved',
        'find the answer that mentions 30 days',
        'show answers about implementation',
        'find our approved pricing answer',
        'search answers for microsoft',
        'find the response about data security',
        'show saved answers mentioning contracts',
        'find what we say about onboarding',
        'search response text',
        'find our standard response',
        'show knowledge in the pricing category',
        'filter knowledge by category',
        'show policy knowledge',
        'show entries in technology',
        'find answers categorized as security',
        'show sales knowledge',
        'filter the knowledge base to email',
        'show only onboarding entries',
        'find knowledge in the proposal category',
        'filter saved responses by category',
        'show all items under customer support',
        'clear the knowledge search',
        'reset the knowledge base',
        'show all knowledge again',
        'remove the search filter',
        'clear the category filter',
        'reset saved answers',
        'remove knowledge filters',
        'show every knowledge item',
        'open this knowledge entry',
        'show this answer',
        'open the saved question',
        'show the full knowledge item',
        'inspect this response',
        'open this question and answer',
        'show the supporting evidence',
        'view this knowledge record',
        'show everything saved for this question',
        'open the entry details',
        'show the evidence for this answer',
        'where did this answer come from',
        'show the sources',
        'show supporting documents',
        'what supports this response',
        'show citations for this answer',
        'open the evidence summary',
        'show the source links',
        'which documents support this answer',
        'show recommendations for this answer',
        'what do we recommend',
        'show the recommended practice',
        'show policy recommendations',
        'what should someone do next',
        'show best practices for this question',
        'show the recommendation section',
        'what actions are recommended',
        'show saved advice',
        'show resources for this answer',
        'show supporting links',
        'what resources are attached',
        'show further reading',
        'open the saved resources',
        'show useful links for this question',
        'show external references',
        'show the resource list',
        'show keywords for this entry',
        'what is this knowledge tagged with',
        'show search terms',
        'what keywords help todd find this',
        'show the saved tags',
        'show entry keywords',
        'how is this answer indexed',
        'show knowledge tags',
        'copy the citation',
        'copy this source',
        'give me a citation for this answer',
        'copy the evidence citation',
        'copy the reference',
        'edit this knowledge entry',
        'update this saved answer',
        'change this response',
        'revise this knowledge',
        'correct this answer',
        'change the category',
        'edit the sources',
        'add more recommendations',
        'update the keywords',
        'improve this saved knowledge',
        'delete this knowledge entry',
        'remove this answer',
        'delete the saved question',
        'remove this from the knowledge base',
        'get rid of this response',
        'delete this knowledge item',
        'take this out of todd',
        'turn this into a post',
        'make a social post from this answer',
        'use this knowledge for social media',
        'create content from this entry',
        'repurpose this answer',
        'write a linkedin post from this',
        'show knowledge sourced from microsoft',
        'find answers using this website',
        'show entries with government sources',
        'find knowledge linked to this document',
        'find entries using this url',
        'show knowledge from this domain',
        'search knowledge by citation',
        'show knowledge bookmarked from find',
        'show saved find results',
        'find knowledge captured from search',
        'show bookmarked answers',
        'show saved search results',
        'show find bookmarks',
        'what does todd know',
        'what answers are already saved',
        'what knowledge have we captured',
        'what topics are in the knowledge base',
        'what questions can todd answer',
        'what business knowledge do we have',
        'what categories are represented',
        'what reusable responses exist',
        'what information is stored here',
        'what has been added to the knowledge base'
      ],
      message: [
        '<p><strong>This sounds like Knowledge Base work.</strong></p>',
        '<p>Open <strong>/knowledge-base</strong> to browse, search, inspect, organize, edit, remove, cite, or reuse knowledge already stored in TODD.</p>',
        '<p>If you need to create a brand new reusable answer, use <strong>/response-flow</strong>. Once you are in the Knowledge Base, the TODD popup has the live repository context.</p>'
      ].join( '' )
    }
  ];

  private normalizeCommand ( text: string ): string {
    return ( text || '' )
      .toLowerCase()
      .replace( /[\/\-]/g, ' ' )
      .replace( /[^a-z0-9\s]/g, ' ' )
      .replace( /\s+/g, ' ' )
      .trim();
  }

  private stripLeadingVerb ( text: string ): string {
    const verbs = ['show', 'open', 'go', 'goto', 'navigate', 'add', 'upload', 'take', 'bring'];
    const fillers = new Set( ['me', 'to', 'the', 'a', 'an', 'page'] );
    const parts = ( text || '' ).trim().toLowerCase().split( /\s+/ );
    if ( !parts.length ) return '';

    let idx = 0;
    if ( verbs.includes( parts[0] ) ) {
      idx = 1;
      while ( idx < parts.length && fillers.has( parts[idx] ) ) idx++;
    }
    return parts.slice( idx ).join( ' ' );
  }

  public tryDirectNavCommand ( prompt: string ): DirectNavResult {
    const raw = ( prompt || '' ).trim();
    if ( !raw ) return { handled: false };

    const withoutVerb = this.stripLeadingVerb( raw );
    if ( !withoutVerb ) return { handled: false };

    const normalizedInput = this.normalizeCommand( withoutVerb );
    const rawLower = raw.toLowerCase();
    const aliasedPath = this.getDirectRouteAliases()[normalizedInput];

    if ( aliasedPath ) {
      return { handled: true, kind: 'navigate', path: '/' + aliasedPath };
    }

    for ( const route of this.directCommandRoutes ) {
      const normalizedRoute = this.normalizeCommand( route.path );

      if ( route.requiresId ) {
        if ( normalizedInput === normalizedRoute ) {
          const baseLabel = normalizedRoute;
          return {
            handled: true,
            kind: 'message',
            message: `To open a ${baseLabel}, type "${baseLabel} YOUR_ID" (for example: "${baseLabel} 12345").`
          };
        }

        if ( normalizedInput.startsWith( normalizedRoute + ' ' ) ) {
          const idPart = normalizedInput.slice( normalizedRoute.length + 1 ).trim();
          if ( !idPart ) continue;
          const navPath = route.path.replace( /:([^\/]+)/, idPart );
          return { handled: true, kind: 'navigate', path: '/' + navPath };
        }

        continue;
      }

      if ( normalizedInput === normalizedRoute || rawLower === route.path.toLowerCase() ) {
        return { handled: true, kind: 'navigate', path: '/' + route.path };
      }
    }

    return { handled: false };
  }

  private getDirectRouteAliases (): Record<string, string> {
    return {
      ...this.navConfig.getAssistantRouteAliases(),
      ...this.directRouteAliases,
    };
  }

  public tryWorkflowGuide ( prompt: string ): DirectNavResult {
    const raw = String( prompt || '' ).trim();
    if ( !raw ) {
      return { handled: false };
    }

    const guide = this.workflowGuides.find( item => item.patterns.some( pattern => pattern.test( raw ) ) );
    if ( !guide ) {
      return { handled: false };
    }

    return {
      handled: true,
      kind: 'message',
      message: guide.message
    };
  }

  public tryRouteIntentGuide ( prompt: string ): DirectNavResult {
    const normalizedPrompt = this.normalizeCommand( prompt );
    if ( !normalizedPrompt ) {
      return { handled: false };
    }

    const guide = this.routeIntentGuides.find( item =>
      item.phrases.some( phrase => {
        const normalizedPhrase = this.normalizeCommand( phrase );
        return normalizedPrompt === normalizedPhrase || normalizedPrompt.includes( normalizedPhrase );
      } )
    );

    if ( !guide ) {
      return { handled: false };
    }

    return {
      handled: true,
      kind: 'message',
      message: guide.message
    };
  }

  private getNavCommandCapabilities (): LocalCapability[] {
    return this.directCommandRoutes
      .filter( c => !c.requiresId )
      .map( c => {
        const label = this.normalizeCommand( c.path );
        return {
          id: `nav-${c.path}`,
          label,
          hint: `Go to ${label}`,
          patterns: [label, c.path.toLowerCase()],
          guard: () => true
        };
      } );
  }

  public getLocalCapabilities ( ctx: CapabilityContext ): LocalCapability[] {
    const { hasSelectedContact, selectedContactName } = ctx;

    const dynamic: LocalCapability[] = [];
    if ( hasSelectedContact && selectedContactName ) {
      dynamic.push(
        {
          id: 'summarize-selected-contact',
          label: `Summarize ${selectedContactName}`,
          hint: 'Recent activity, tags, next move',
          patterns: ['summary', 'summarize contact', 'overview', 'recap', 'what’s up'],
          guard: () => true
        },
        {
          id: 'qa-selected-contact',
          label: `What is ${selectedContactName}'s email?`,
          hint: 'Ask about email, phone, title, company…',
          patterns: ['email', 'phone', 'title', 'company', 'project', 'tags', 'category'],
          guard: () => true
        },
        {
          id: 'last-contact-selected',
          label: `When did I last email ${selectedContactName}?`,
          hint: 'Last contact date, last follow-up',
          patterns: ['last email', 'last contacted', 'last follow up'],
          guard: () => true
        },
        {
          id: 'draft-email-to-contact',
          label: `Write an email to ${selectedContactName}`,
          hint: 'Cold outreach, follow-up, or reply',
          patterns: ['write email', 'draft email', 'compose', 'reply', 'follow up email'],
          guard: () => true
        }
      );
    }

    const base: LocalCapability[] = [
      {
        id: 'filter-contacts',
        label: 'Filter contacts by tag or status',
        hint: 'Segment by tag, source, owner',
        patterns: ['filter', 'segment', 'show contacts', 'list', 'find contacts'],
        guard: () => true
      },
      {
        id: 'lookup-contact',
        label: 'Find a contact by name',
        hint: 'Search by name, email, company',
        patterns: ['find contact', 'lookup contact', 'search contact', 'go to contact'],
        guard: () => true
      },
      {
        id: 'draft-email',
        label: 'Write an email',
        hint: 'Cold outreach, follow-up, or reply',
        patterns: ['write email', 'draft email', 'compose email', 'reply', 'send email'],
        guard: () => true
      },
      {
        id: 'write-document',
        label: 'Write a document',
        hint: 'One-pager, letter, brief, or summary',
        patterns: ['write document', 'draft document', 'create document', 'one-pager', 'letter', 'brief', 'summary', 'doc'],
        guard: () => true
      },
      {
        id: 'write-proposal',
        label: 'Create a proposal from an RFP',
        hint: 'Paste RFP text to generate a draft',
        patterns: ['proposal', 'generate proposal', 'rfp', 'request for proposal', 'sow', 'statement of work'],
        guard: () => true
      },
      {
        id: 'add-new-contact',
        label: 'Add a new contact',
        hint: 'Quick add with name and company',
        patterns: ['add contact', 'new contact', 'create contact'],
        guard: () => true
      },
      {
        id: 'update-contact-field',
        label: 'Update a contact field',
        hint: 'Email, phone, title, status…',
        patterns: ['update', 'change', 'set field', 'edit contact'],
        guard: () => hasSelectedContact
      },
      {
        id: 'help',
        label: 'How this works',
        hint: 'Open Assistant Box help',
        patterns: ['help', 'how it works', 'what can you do'],
        guard: () => true
      }
    ];

    return [...dynamic, ...base, ...this.getNavCommandCapabilities()].filter( c => ( c.guard ? c.guard() : true ) );
  }

  public scoreLocalSuggestions ( query: string, ctx: CapabilityContext ): string[] {
    const caps = this.getLocalCapabilities( ctx );
    const q = ( query || '' ).trim().toLowerCase();
    if ( !q ) return [];

    const terms = q.split( /\s+/ );
    const termScore = ( text: string, weight = 1 ) => terms.reduce( ( s, t ) => ( text.includes( t ) ? s + weight : s ), 0 );

    const ranked = caps
      .map( c => {
        const label = c.label.toLowerCase();
        const hint = ( c.hint || '' ).toLowerCase();
        const patterns = c.patterns.join( ' ' ).toLowerCase();
        const score = termScore( label, 3 ) + termScore( patterns, 2 ) + termScore( hint, 1 );
        return { c, score };
      } )
      .filter( x => x.score > 0 )
      .sort( ( a, b ) => b.score - a.score )
      .map( x => x.c.label );

    if ( !ranked.length ) {
      return ( ctx.placeholderChoices || [] ).filter( p => p.toLowerCase().includes( q ) ).slice( 0, 8 );
    }

    return Array.from( new Set( ranked ) ).slice( 0, 8 );
  }
}
