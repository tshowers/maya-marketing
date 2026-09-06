import { Injectable } from '@angular/core';

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
      route: '/outreach/app',
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
        '<p>Open <strong>/outreach/app</strong> for the big-picture view of outreach health, progress, activity, opportunities, and recommended next moves.</p>'
      ].join( '' )
    },
    {
      id: 'compose-email',
      route: '/compose-email',
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
        '<p>Open <strong>/compose-email</strong> to write, revise, personalize, or prepare an individual email.</p>'
      ].join( '' )
    },
    {
      id: 'email-queue',
      route: '/signal-engine',
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
        '<p>Open <strong>/signal-engine</strong> to review, approve, or reject drafts waiting to be sent.</p>'
      ].join( '' )
    },
    {
      id: 'email-engagement',
      route: '/engagement',
      phrases: [
        'who opened our last email',
        'who clicked our email',
        'show email engagement',
        'who engaged with the campaign',
        'show opens and clicks'
      ],
      message: [
        '<p><strong>This is engagement work.</strong></p>',
        '<p>Open <strong>/engagement</strong> to see who opened, clicked, or otherwise engaged with email.</p>'
      ].join( '' )
    },
    {
      id: 'outbox-cockpit',
      route: '/signal-engine',
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
        '<p>Open <strong>/signal-engine</strong> to understand engagement signals, responses, stalled outreach, and what follow-up should happen next.</p>'
      ].join( '' )
    },
    {
      id: 'inbox-access',
      route: '/inbox-access',
      phrases: [
        'connect my inbox',
        'connect our inbox',
        'enable inbox access',
        'set up inbox access',
        'let todd observe email activity'
      ],
      message: [
        '<p><strong>This is inbox setup.</strong></p>',
        '<p>Open <strong>/inbox-access</strong> to connect an inbox or enable TODD to observe and coordinate email activity.</p>'
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
        '<p>Open <strong>signature.taliferro.tech</strong> to create or improve an email signature.</p>'
      ].join( '' )
    },
    {
      id: 'social-home',
      route: '/outreach/social',
      phrases: [
        'show social overview',
        'show social health',
        'what is happening in social',
        'show social priorities',
        'open social'
      ],
      message: [
        '<p><strong>This belongs in Social.</strong></p>',
        '<p>Open <strong>/outreach/social</strong> for the overview of social visibility, activity, health, and priorities.</p>'
      ].join( '' )
    },
    {
      id: 'social-command',
      route: '/outreach/social/command',
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
        '<p>Open <strong>/outreach/social/command</strong> to actively direct, manage, or execute today’s social-media work.</p>'
      ].join( '' )
    },
    {
      id: 'social-accounts',
      route: '/outreach/social/accounts',
      phrases: [
        'connect our linkedin account',
        'connect our social account',
        'manage social accounts',
        'disconnect social accounts',
        'inspect social accounts'
      ],
      message: [
        '<p><strong>This is account-connection work.</strong></p>',
        '<p>Open <strong>/outreach/social/accounts</strong> to connect, disconnect, inspect, or manage social-media accounts.</p>'
      ].join( '' )
    },
    {
      id: 'social-drafts',
      route: '/outreach/social/calendar',
      phrases: [
        'show me the social posts todd drafted',
        'show social drafts',
        'review drafted social posts',
        'revise proposed social content',
        'work with social drafts'
      ],
      message: [
        '<p><strong>This is draft-content work.</strong></p>',
        '<p>Open the Social Calendar to review and approve Maya\'s proposed social-media content.</p>'
      ].join( '' )
    },
    {
      id: 'social-queue',
      route: '/outreach/social/queue',
      phrases: [
        'what is approved to publish',
        'show approved social posts',
        'show the social queue',
        'what is waiting to publish',
        'show approved content'
      ],
      message: [
        '<p><strong>This is publishing-queue work.</strong></p>',
        '<p>Open <strong>/outreach/social/queue</strong> to review content that has been approved or is waiting to be published.</p>'
      ].join( '' )
    },
    {
      id: 'social-strategy',
      route: '/outreach/social/strategy',
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
        '<p>Open <strong>/outreach/social/strategy</strong> to define audiences, channels, themes, goals, posting cadence, and overall social direction.</p>'
      ].join( '' )
    },
    {
      id: 'social-signals',
      route: '/outreach/social/signals',
      phrases: [
        'what social opportunities did todd find',
        'show social opportunities',
        'show social engagement signals',
        'show reactions and opportunities',
        'recommended social follow up'
      ],
      message: [
        '<p><strong>This is social-signals work.</strong></p>',
        '<p>Open <strong>/outreach/social/signals</strong> to understand social engagement, reactions, opportunities, and recommended follow-up actions.</p>'
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
