export type LandingVisitSource =
  | 'email'
  | 'instagram'
  | 'threads'
  | 'linkedin'
  | 'google'
  | 'bing'
  | 'search'
  | 'social'
  | 'referral'
  | 'direct'
  | 'unknown';

export type LandingVisitChannel =
  | 'email'
  | 'social'
  | 'search'
  | 'referral'
  | 'direct'
  | 'unknown';

export type LandingVisitInterestArea =
  | 'moves'
  | 'outreach'
  | 'network'
  | 'pulse'
  | 'docs'
  | 'sayit'
  | 'lead-vault'
  | 'suite'
  | 'momentum'
  | 'general';

export interface LandingPage4VisitContext {
  source: LandingVisitSource;
  channel: LandingVisitChannel;
  sourceLabel: string;
  campaign: string;
  audience: string;
  interestArea: LandingVisitInterestArea;
  interestLabel: string;
  tenantId: string;
  emailId: string;
  ref: string;
  referrer: string;
  isKnownEmailJourney: boolean;
  isKnownContactJourney: boolean;
  personalizationMode: 'email' | 'contact' | 'source' | 'audience' | 'default';
}

export interface LandingPage4AdViewModel {
  heading: string;
  subheading: string;
  bullet1: string;
  bullet2: string;
  finalAppeal: string;
  finalAppealSub?: string;
  image1?: string;
  heading2?: string;
  subHeading2?: string;
  image2?: string;
  heading3?: string;
  subHeading3?: string;
  image3?: string;
  heading4?: string;
  subHeading4?: string;
  image4?: string;
  heading5?: string;
  subHeading5?: string;
  image5?: string;
  heading6?: string;
  subHeading6?: string;
  image6?: string;
}

export interface LandingPage4ExitIntentContent {
  eyebrow: string;
  title: string;
  body: string;
  imageSrc: string;
  imageAlt: string;
  formTitle: string;
  formBody: string;
  ctaLabel: string;
}

export function resolveLandingPage4VisitContext (
  rawParams: Record<string, string | null | undefined>,
  referrer: string
): LandingPage4VisitContext {
  const sourceParam = firstNonEmpty( rawParams['source'], rawParams['utm_source'] ).toLowerCase();
  const mediumParam = firstNonEmpty( rawParams['channel'], rawParams['utm_medium'] ).toLowerCase();
  const refParam = firstNonEmpty( rawParams['ref'] ).trim();
  const audience = firstNonEmpty( rawParams['audience'] ).trim();
  const emailId = firstNonEmpty( rawParams['emailId'] ).trim();
  const tenantId = firstNonEmpty( rawParams['tenantId'] ).trim();
  const referrerHost = normalizeHost( referrer );
  const destination = firstNonEmpty( rawParams['destination'] ).toLowerCase();
  const campaign = firstNonEmpty( rawParams['campaign'], rawParams['utm_campaign'] ).trim();

  const source = inferVisitSource( sourceParam, mediumParam, referrerHost, emailId );
  const channel = inferVisitChannel( source, mediumParam, emailId );
  const interestArea = inferInterestArea( {
    destination,
    audience,
    campaign,
    ref: refParam,
  } );
  const isKnownEmailJourney = !!emailId;
  const isKnownContactJourney = !!refParam && !looksLikeOfferKey( refParam );

  return {
    source,
    channel,
    sourceLabel: formatSourceLabel( source, referrerHost ),
    campaign,
    audience,
    interestArea,
    interestLabel: formatInterestLabel( interestArea ),
    tenantId,
    emailId,
    ref: refParam,
    referrer,
    isKnownEmailJourney,
    isKnownContactJourney,
    personalizationMode: isKnownEmailJourney
      ? 'email'
      : isKnownContactJourney
        ? 'contact'
        : source !== 'direct' && source !== 'unknown'
          ? 'source'
          : audience
            ? 'audience'
            : 'default'
  };
}

export function applyVisitContextToAd (
  ad: LandingPage4AdViewModel,
  context: LandingPage4VisitContext
): LandingPage4AdViewModel {
  const next = { ...ad };
  const interest = context.interestLabel;

  if ( context.isKnownEmailJourney ) {
    next.subheading = interest !== 'TODD'
      ? `You clicked through from an email because ${interest} matters right now. This page picks up that conversation and shows how TODD helps the work keep moving.`
      : 'You clicked through from an email for a reason. This page picks up that conversation and shows how TODD helps work keep moving.';
    next.bullet1 = 'Continue the conversation without losing context.';
    next.bullet2 = 'See the next move without more admin work.';
    next.finalAppeal = interest !== 'TODD' ? `See how TODD supports ${interest}` : 'See what TODD can move for you';
    next.finalAppealSub = 'If you are not ready to buy, book a meeting and we will walk through the real fit together.';
    return next;
  }

  switch ( context.source ) {
    case 'instagram':
    case 'threads':
      next.heading = interest !== 'TODD'
        ? `${interest} should feel lighter, not heavier`
        : 'Work should feel lighter, not heavier';
      next.subheading = `You came from ${context.sourceLabel}. Here is the short version: TODD reduces the chasing, checking, and remembering that slows work down.`;
      next.finalAppeal = interest !== 'TODD' ? `See ${interest} in motion` : 'See TODD in motion';
      next.finalAppealSub = 'Watch the flow, ask a quick question, or book a short walkthrough.';
      break;
    case 'linkedin':
      next.heading = interest !== 'TODD'
        ? `${interest} needs operating clarity`
        : 'Operations need more clarity, not more software';
      next.subheading = 'You came from LinkedIn, so let’s keep it practical. TODD connects signals, follow-up, and next actions so progress does not depend on memory.';
      next.bullet1 = 'Turn signals into clear next steps.';
      next.bullet2 = 'Reduce operational drag without adding more dashboards.';
      next.finalAppealSub = 'Book a meeting if you want to see the operating model, not just the marketing story.';
      break;
    case 'google':
    case 'bing':
    case 'search':
      next.heading = 'Most software gives you more work';
      next.subheading = `You came from ${context.sourceLabel}, probably looking for a better answer. TODD is built for people who are tired of tools that create more checking, more setup, and more stress.`;
      next.bullet1 = 'Less system babysitting.';
      next.bullet2 = 'More visible movement.';
      next.heading5 = 'That is the scam nobody talks about';
      next.subHeading5 = 'Software should reduce the burden, not quietly add more work to your day.';
      next.image5 = '/assets/ads/todd-asset9.webp';
      next.finalAppeal = 'Want the honest walkthrough?';
      next.finalAppealSub = 'Leave your info or book a meeting and we will explain what makes TODD different.';
      break;
    default:
      if ( context.interestArea !== 'general' ) {
        next.finalAppeal = `See how TODD helps with ${interest}`;
        next.finalAppealSub = `If ${interest} is what pulled you in, we can show you the clearest next step.`;
      }
      break;
  }

  return next;
}

export function buildJourneyBannerCopy ( context: LandingPage4VisitContext ): {
  eyebrow: string;
  title: string;
  body: string;
} {
  if ( context.isKnownEmailJourney ) {
    return {
      eyebrow: 'Email Journey',
      title: 'You did not land here cold',
      body: context.interestArea !== 'general'
        ? `This visit started from an email and points toward ${context.interestLabel}. TODD can keep that conversation moving without losing context.`
        : 'This visit started from an email. TODD can keep that conversation moving without losing context.'
    };
  }

  if ( context.source === 'instagram' || context.source === 'threads' ) {
    return {
      eyebrow: context.sourceLabel,
      title: 'Curious from social? Start with the short version',
      body: 'TODD is built to reduce the invisible work that piles up behind growth. If the message caught your eye, this page gives you the practical version.'
    };
  }

  if ( context.source === 'linkedin' ) {
    return {
      eyebrow: 'LinkedIn Visit',
      title: 'This is the operating-system conversation',
      body: 'TODD is about visibility, momentum, and less coordination drag. If you came from LinkedIn, we assume you want the practical explanation.'
    };
  }

  if ( context.source === 'google' || context.source === 'bing' || context.source === 'search' ) {
    return {
      eyebrow: `${context.sourceLabel} Visit`,
      title: 'You were probably looking for a better answer',
      body: 'Most people who land here from search are trying to solve a real workflow problem. TODD is built for that kind of visit.'
    };
  }

  return {
    eyebrow: 'Journey Context',
    title: context.interestArea !== 'general'
      ? `Interested in ${context.interestLabel}?`
      : 'See why TODD was built',
    body: context.interestArea !== 'general'
      ? `If ${context.interestLabel} is what brought you here, the next sections are tuned to that interest.`
      : 'This page is designed to help you quickly see where TODD fits and whether it is worth a conversation.'
  };
}

export function buildExitIntentContent ( context: LandingPage4VisitContext ): LandingPage4ExitIntentContent {
  const sourceLead = context.source === 'google' || context.source === 'bing' || context.source === 'search'
    ? `Thanks for checking us out from ${context.sourceLabel}.`
    : context.isKnownEmailJourney
      ? 'Thanks for following the email through to here.'
      : `Thanks for stopping by from ${context.sourceLabel}.`;

  return {
    eyebrow: 'Before You Go',
    title: 'Most software gives you more work - Nobody says that part aloud',
    body: `${sourceLead} If you want, leave your info and we will explain how TODD reduces the extra work most systems quietly create.`,
    imageSrc: '/assets/ads/todd-asset9.webp',
    imageAlt: 'Most software gives you more work - Nobody says that part aloud',
    formTitle: context.interestArea !== 'general'
      ? `Want to talk about ${context.interestLabel}?`
      : 'Want to stay in touch?',
    formBody: 'Leave your name, email, and phone, or book a meeting if you want the faster path.',
    ctaLabel: 'Book a meeting'
  };
}

function inferVisitSource (
  sourceParam: string,
  mediumParam: string,
  referrerHost: string,
  emailId: string
): LandingVisitSource {
  if ( emailId ) return 'email';
  if ( includesAny( sourceParam, ['instagram', 'ig'] ) || referrerHost.includes( 'instagram.' ) ) return 'instagram';
  if ( includesAny( sourceParam, ['threads'] ) || referrerHost.includes( 'threads.net' ) ) return 'threads';
  if ( includesAny( sourceParam, ['linkedin'] ) || referrerHost.includes( 'linkedin.' ) ) return 'linkedin';
  if ( includesAny( sourceParam, ['google'] ) || referrerHost.includes( 'google.' ) ) return 'google';
  if ( includesAny( sourceParam, ['bing'] ) || referrerHost.includes( 'bing.' ) ) return 'bing';
  if ( includesAny( sourceParam, ['email', 'mail'] ) || mediumParam === 'email' || referrerHost.includes( 'mail.' ) || referrerHost.includes( 'outlook.' ) ) return 'email';
  if ( includesAny( mediumParam, ['social', 'post'] ) ) return 'social';
  if ( includesAny( mediumParam, ['search', 'cpc'] ) ) return 'search';
  if ( referrerHost ) return 'referral';
  return 'direct';
}

function inferVisitChannel (
  source: LandingVisitSource,
  mediumParam: string,
  emailId: string
): LandingVisitChannel {
  if ( emailId || source === 'email' || mediumParam === 'email' ) return 'email';
  if ( ['instagram', 'threads', 'linkedin', 'social'].includes( source ) ) return 'social';
  if ( ['google', 'bing', 'search'].includes( source ) ) return 'search';
  if ( source === 'referral' ) return 'referral';
  if ( source === 'direct' ) return 'direct';
  return 'unknown';
}

function inferInterestArea ( params: {
  destination: string;
  audience: string;
  campaign: string;
  ref: string;
} ): LandingVisitInterestArea {
  const haystack = `${params.destination} ${params.audience} ${params.campaign} ${params.ref}`.toLowerCase();
  if ( haystack.includes( 'moves' ) ) return 'moves';
  if ( haystack.includes( 'outreach' ) || haystack.includes( 'signal' ) ) return 'outreach';
  if ( haystack.includes( 'network' ) ) return 'network';
  if ( haystack.includes( 'pulse' ) || haystack.includes( 'survey' ) ) return 'pulse';
  if ( haystack.includes( 'docs' ) || haystack.includes( 'knowledge' ) ) return 'docs';
  if ( haystack.includes( 'sayit' ) || haystack.includes( 'say-it' ) ) return 'sayit';
  if ( haystack.includes( 'lead' ) && haystack.includes( 'vault' ) ) return 'lead-vault';
  if ( haystack.includes( 'suite' ) ) return 'suite';
  if ( haystack.includes( 'momentum' ) ) return 'momentum';
  return 'general';
}

function formatSourceLabel ( source: LandingVisitSource, referrerHost: string ): string {
  switch ( source ) {
    case 'instagram': return 'Instagram';
    case 'threads': return 'Threads';
    case 'linkedin': return 'LinkedIn';
    case 'google': return 'Google Search';
    case 'bing': return 'Bing Search';
    case 'email': return 'Email';
    case 'search': return 'Search';
    case 'social': return 'Social';
    case 'referral': return referrerHost ? `Referral · ${referrerHost}` : 'Referral';
    case 'direct': return 'Direct';
    default: return 'Visitor';
  }
}

function formatInterestLabel ( interestArea: LandingVisitInterestArea ): string {
  switch ( interestArea ) {
    case 'moves': return 'Moves';
    case 'outreach': return 'Outreach';
    case 'network': return 'Network';
    case 'pulse': return 'Pulse';
    case 'docs': return 'Docs';
    case 'sayit': return 'SayIt';
    case 'lead-vault': return 'Lead Vault';
    case 'suite': return 'TODD Suite';
    case 'momentum': return 'Momentum';
    default: return 'TODD';
  }
}

function normalizeHost ( referrer: string ): string {
  try {
    if ( !referrer ) return '';
    return new URL( referrer ).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function firstNonEmpty ( ...values: Array<string | null | undefined> ): string {
  for ( const value of values ) {
    const normalized = String( value || '' ).trim();
    if ( normalized ) {
      return normalized;
    }
  }

  return '';
}

function includesAny ( value: string, needles: string[] ): boolean {
  return needles.some( needle => value.includes( needle ) );
}

function looksLikeOfferKey ( ref: string ): boolean {
  return ['realestate', 'consulting', 'speaking'].includes( ref.toLowerCase() );
}
