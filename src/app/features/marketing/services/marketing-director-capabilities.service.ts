import { Injectable } from '@angular/core';
import { getAdminUrl, getDocumentUrl } from '@taliferro/ui/platform/account-menu.model';

export type MarketingDirectorCapabilityResult =
  | { handled: false; }
  | { handled: true; kind: 'message'; message: string; };

interface MarketingDirectorRouteGuide {
  id: string;
  route: string;
  phrases: string[];
  message: string;
}

@Injectable( {
  providedIn: 'root'
} )
export class MarketingDirectorCapabilitiesService {
  private readonly routeGuides: MarketingDirectorRouteGuide[] = [
    {
      id: 'outreach-home',
      route: 'https://outreach.taliferro.tech/app',
      phrases: [
        'what outreach should we be doing',
        'show me outreach',
        'show outreach health',
        'show outreach progress',
        'show outreach activity',
        'what is happening in outreach',
        'what outreach opportunities do we have',
        'show recommended outreach next moves',
        'give me the outreach overview'
      ],
      message: [
        '<p><strong>This belongs in Outreach.</strong></p>',
        '<p>Open <a href="https://outreach.taliferro.tech/app" target="_blank" rel="noopener noreferrer">Outreach</a> for the big-picture view of outreach health, progress, activity, opportunities, and recommended next moves.</p>'
      ].join( '' )
    },
    {
      id: 'compose-email',
      route: 'https://outreach.taliferro.tech/compose-email',
      phrases: [
        'help me write an email to this prospect',
        'write an email',
        'compose an email',
        'revise this email',
        'personalize this email',
        'prepare an individual email',
        'draft an outreach email'
      ],
      message: [
        '<p><strong>This is email-composer work.</strong></p>',
        '<p>Open <a href="https://outreach.taliferro.tech/compose-email" target="_blank" rel="noopener noreferrer">Compose Email</a> to write, revise, personalize, or prepare an individual email.</p>'
      ].join( '' )
    },
    {
      id: 'email-queue',
      route: 'https://outreach.taliferro.tech/signal-engine',
      phrases: [
        'what emails are waiting for approval',
        'show the email queue',
        'review queued emails',
        'approve emails',
        'schedule queued emails',
        'inspect emails waiting to send'
      ],
      message: [
        '<p><strong>This is queue work.</strong></p>',
        '<p>Open the <a href="https://outreach.taliferro.tech/signal-engine" target="_blank" rel="noopener noreferrer">Signal Engine</a> to review, approve, or reject drafts waiting to be sent.</p>'
      ].join( '' )
    },
    {
      id: 'email-engagement',
      route: 'https://outreach.taliferro.tech/engagement',
      phrases: [
        'who opened our last email',
        'who clicked our email',
        'show email engagement',
        'who engaged with the campaign',
        'show opens and clicks'
      ],
      message: [
        '<p><strong>This is engagement work.</strong></p>',
        '<p>Open <a href="https://outreach.taliferro.tech/engagement" target="_blank" rel="noopener noreferrer">Engagement</a> to see who opened, clicked, or otherwise engaged with email.</p>'
      ].join( '' )
    },
    {
      id: 'outbox-cockpit',
      route: 'https://outreach.taliferro.tech/signal-engine',
      phrases: [
        'what happened after we sent the campaign',
        'show follow up signals',
        'show stalled outreach',
        'what follow up should happen next',
        'show me the outreach signals',
        'what happened after we sent it'
      ],
      message: [
        '<p><strong>This belongs in the Signal Engine.</strong></p>',
        '<p>Open the <a href="https://outreach.taliferro.tech/signal-engine" target="_blank" rel="noopener noreferrer">Signal Engine</a> to understand engagement signals, responses, stalled outreach, and what follow-up should happen next.</p>'
      ].join( '' )
    },
    {
      id: 'inbox-access',
      route: 'https://outreach.taliferro.tech/inbox-access',
      phrases: [
        'connect my inbox',
        'connect our inbox',
        'enable inbox access',
        'set up inbox access',
        'let todd observe email activity'
      ],
      message: [
        '<p><strong>This is inbox setup.</strong></p>',
        '<p>Open <a href="https://outreach.taliferro.tech/inbox-access" target="_blank" rel="noopener noreferrer">Inbox Access</a> to connect an inbox or enable TODD to observe and coordinate email activity.</p>'
      ].join( '' )
    },
    {
      id: 'email-signature-builder',
      route: 'https://signature.taliferro.tech',
      phrases: [
        'create an email signature',
        'improve my email signature',
        'build an email signature',
        'open the signature builder'
      ],
      message: [
        '<p><strong>This is signature-builder work.</strong></p>',
        '<p>Open the <a href="https://signature.taliferro.tech" target="_blank" rel="noopener noreferrer">Signature Builder</a> to create or improve an email signature.</p>'
      ].join( '' )
    },
    {
      id: 'social-home',
      route: 'https://social.taliferro.tech/',
      phrases: [
        'show social overview',
        'show social health',
        'what is happening in social',
        'show social priorities',
        'open social'
      ],
      message: [
        '<p><strong>This belongs in Social.</strong></p>',
        '<p>Open <a href="https://social.taliferro.tech/" target="_blank" rel="noopener noreferrer">Social</a> for the overview of social visibility, activity, health, and priorities.</p>'
      ].join( '' )
    },
    {
      id: 'social-command',
      route: 'https://social.taliferro.tech/command',
      phrases: [
        'manage today’s social work',
        'manage today social work',
        'show social command',
        'direct social work',
        'execute social work',
        'manage social work today'
      ],
      message: [
        '<p><strong>This is social-command work.</strong></p>',
        '<p>Open <a href="https://social.taliferro.tech/command" target="_blank" rel="noopener noreferrer">Social Command</a> to actively direct, manage, or execute today’s social-media work.</p>'
      ].join( '' )
    },
    {
      id: 'social-accounts',
      route: 'https://social.taliferro.tech/accounts',
      phrases: [
        'connect our linkedin account',
        'connect our social account',
        'manage social accounts',
        'disconnect social accounts',
        'inspect social accounts'
      ],
      message: [
        '<p><strong>This is account-connection work.</strong></p>',
        '<p>Open <a href="https://social.taliferro.tech/accounts" target="_blank" rel="noopener noreferrer">Social Accounts</a> to connect, disconnect, inspect, or manage social-media accounts.</p>'
      ].join( '' )
    },
    {
      id: 'social-drafts',
      route: 'https://social.taliferro.tech/calendar',
      phrases: [
        'show me the social posts todd drafted',
        'show social drafts',
        'review drafted social posts',
        'revise proposed social content',
        'work with social drafts'
      ],
      message: [
        '<p><strong>This is draft-content work.</strong></p>',
        '<p>Open the <a href="https://social.taliferro.tech/calendar" target="_blank" rel="noopener noreferrer">Social Calendar</a> to review and approve Maya\'s proposed social-media content.</p>'
      ].join( '' )
    },
    {
      id: 'social-queue',
      route: 'https://social.taliferro.tech/queue',
      phrases: [
        'what is approved to publish',
        'show approved social posts',
        'show the social queue',
        'what is waiting to publish',
        'show approved content'
      ],
      message: [
        '<p><strong>This is publishing-queue work.</strong></p>',
        '<p>Open the <a href="https://social.taliferro.tech/queue" target="_blank" rel="noopener noreferrer">Social Queue</a> to review content that has been approved or is waiting to be published.</p>'
      ].join( '' )
    },
    {
      id: 'social-strategy',
      route: 'https://social.taliferro.tech/strategy',
      phrases: [
        'what should our social strategy be',
        'define our social strategy',
        'plan social audiences',
        'choose social channels',
        'set posting cadence',
        'set social themes',
        'set social goals',
        'overall social direction'
      ],
      message: [
        '<p><strong>This is social-strategy work.</strong></p>',
        '<p>Open <a href="https://social.taliferro.tech/strategy" target="_blank" rel="noopener noreferrer">Social Strategy</a> to define audiences, channels, themes, goals, posting cadence, and overall social direction.</p>'
      ].join( '' )
    },
    {
      id: 'social-signals',
      route: 'https://social.taliferro.tech/',
      phrases: [
        'what social opportunities did todd find',
        'show social opportunities',
        'show social engagement signals',
        'show reactions and opportunities',
        'recommended social follow up'
      ],
      message: [
        '<p><strong>This is social-signals work.</strong></p>',
        '<p>Open <a href="https://social.taliferro.tech/" target="_blank" rel="noopener noreferrer">Social</a> to understand social engagement, reactions, opportunities, and recommended follow-up actions.</p>'
      ].join( '' )
    },
    {
      id: 'invite-teammate',
      route: getAdminUrl(),
      phrases: [
        'how do i add a teammate',
        'add a team member',
        'add a teammate',
        'invite a team member',
        'invite a teammate',
        'invite someone',
        'add a user',
        'add users',
        'give someone access',
        'where do i manage my team',
        'where is admin',
        'go to admin',
        'manage my team'
      ],
      message: [
        '<p><strong>That\'s an Admin task.</strong></p>',
        `<p>Open <a href="${getAdminUrl()}" target="_blank" rel="noopener noreferrer">Admin</a> to invite teammates, assign roles, or manage who has access.</p>`
      ].join( '' )
    },
    {
      id: 'document-review',
      route: getDocumentUrl(),
      phrases: [
        'can i upload a document',
        'upload a document for you to review',
        'upload a document for maya to review',
        'can maya review a document',
        'can you review a document',
        'can you review a file',
        'review my document',
        'review this document'
      ],
      message: [
        '<p><strong>Yes — use Document.</strong></p>',
        `<p>Open <a href="${getDocumentUrl()}" target="_blank" rel="noopener noreferrer">Document</a> to upload a file for review.</p>`
      ].join( '' )
    },
    {
      id: 'team-status-outreach',
      route: '',
      phrases: [
        'give maya my team\'s emails',
        'give her the emails for the other team',
        'give her the emails for my team',
        'have maya email my team',
        'have her email my team',
        'how do i give her contacts for status updates',
        'reach out to my team for updates',
        'reach out to my team for statuses'
      ],
      message: [
        '<p><strong>Not yet — Maya can\'t email your team directly.</strong></p>',
        '<p>She doesn\'t have a way to hold your team\'s contacts or send emails on your behalf right now. In the meantime, use "Generate status report" above and share it with them yourself.</p>'
      ].join( '' )
    }
  ];

  tryRouteGuide ( prompt: string ): MarketingDirectorCapabilityResult {
    const normalizedPrompt = this.normalize( prompt );
    if ( !normalizedPrompt ) {
      return { handled: false };
    }

    const guide = this.routeGuides.find( item =>
      item.phrases.some( phrase => normalizedPrompt.includes( this.normalize( phrase ) ) )
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

  private normalize ( value: string ): string {
    return String( value || '' )
      .trim()
      .toLowerCase()
      .replace( /[’']/g, '\'' )
      .replace( /\s+/g, ' ' );
  }
}
