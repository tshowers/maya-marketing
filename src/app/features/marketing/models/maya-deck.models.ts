export type MayaDeckTheme = 'corporate' | 'minimal';

export interface MayaKnownFacts {
  presentationType?: string;
  audience?: string;
  objective?: string;
  company?: string;
  productOrIdea?: string;
  differentiators: string[];
  suppliedEvidence: string[];
  suppliedExamples: string[];
  constraints: string[];
  assumptions: string[];
}

export interface MayaContentSufficiency {
  score: number;
  criticalUnknowns: string[];
  optionalUnknowns: string[];
  readyToBuild: boolean;
}

export interface MayaPresentationStrategy {
  audience: string;
  objective: string;
  deckThesis: string;
  audienceCurrentState: string;
  audienceDesiredState: string;
  centralTension: string;
  audienceConcerns: string[];
  corePromise: string;
  likelyObjections: string[];
  proofStrategy: string[];
  narrativeArc: string[];
  payoff: string;
  callToAction: string;
  researchNeeded: Array<{ question: string; reason: string }>;
}

export interface MayaEnrichedArgument {
  developedPositioning: string[];
  logicalImplications: string[];
  applications: string[];
  bestPractices: string[];
  evidence: Array<{ claim: string; support: string; sourceType: 'supplied' | 'researched' | 'recommendation' | 'assumption' }>;
  objectionsAndResponses: Array<{ objection: string; response: string }>;
}

export interface MayaDeckCritique {
  storyScore: number;
  specificityScore: number;
  evidenceScore: number;
  persuasivenessScore: number;
  payoffScore: number;
  weakSlides: number[];
  repetition: string[];
  missingArguments: string[];
  recommendedChanges: string[];
  passesThreshold: boolean;
}

export type MayaDeckComposition =
  | 'hero'
  | 'bigStatement'
  | 'problem'
  | 'opportunity'
  | 'threeIdeas'
  | 'comparison'
  | 'process'
  | 'timeline'
  | 'metrics'
  | 'chart'
  | 'quote'
  | 'imageStatement'
  | 'product'
  | 'roadmap'
  | 'recommendation'
  | 'closing';

export interface MayaDeckSlide {
  type: MayaDeckComposition;
  purpose: string;
  narrativeRole: string;
  takeaway: string;
  headline: string;
  supportingContent: string[];
  evidence: string[];
  supportingText?: string;
  bullets?: string[];
  metrics?: Array<{ value: string; label: string }>;
  /** Short labels used by threeIdeas, process, timeline, or roadmap slides. */
  steps?: Array<{ title: string; detail?: string; date?: string }>;
  /** Editable chart values. Only use when backed by supplied evidence. */
  chartData?: Array<{ label: string; value: number }>;
  quote?: string;
  attribution?: string;
  visualIntent?: string;
  transitionToNextSlide: string;
  speakerNotes?: string;
  image?: string;
}

/** Layout families the slide renderer implements. Compositions from Maya resolve to one of these. */
export type MayaSlideLayout = 'cover' | 'statement' | 'bullets' | 'split' | 'columns' | 'steps' | 'metrics' | 'chart' | 'quote' | 'closing';

export type MayaSlideTone = 'light' | 'dark' | 'tint';

/**
 * How an image may be placed.
 * - backdrop: the slide background the art was made to sit on (stock art uses transparency and blends into it).
 * - fit: 'cover' may be cropped to fill a region; 'contain' is shown whole.
 * - figure: user-supplied material (screenshots, charts, photos) that is framed, never cropped.
 */
export interface MayaDeckImage {
  src: string;
  backdrop: 'dark' | 'light';
  fit: 'cover' | 'contain';
  position?: string;
  figure?: boolean;
  tags?: string[];
}

export interface MayaSlideItem { title: string; detail?: string; date?: string }

/** A slide after layout resolution, ready for the renderer. */
export interface MayaRenderedSlide {
  index: number;
  layout: MayaSlideLayout;
  tone: MayaSlideTone;
  slide: MayaDeckSlide;
  items: MayaSlideItem[];
  image?: MayaDeckImage;
}

export interface MayaDeck {
  metadata: {
    title: string;
    organization?: string;
    audience?: string;
    objective?: string;
    theme: MayaDeckTheme;
    accentColor: string;
  };
  assets: {
    logo?: string;
    uploadedImages: string[];
    selectedStockImages: string[];
  };
  slides: MayaDeckSlide[];
  strategy?: MayaPresentationStrategy;
  enrichedArgument?: MayaEnrichedArgument;
  critique?: MayaDeckCritique;
}
