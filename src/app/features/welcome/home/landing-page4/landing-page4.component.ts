import { Component, AfterViewInit, OnInit, OnDestroy, ElementRef, ViewChild, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { LoggerService } from '../../../../services/logger.service';
import { AuthService } from '../../../../services/auth.service';
import { OpenAIService } from '../../../../services/open-ai.service';
import { ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { Contact } from '../../../../shared/data/interfaces/contact.model';
import { environment } from '../../../../../environments/environment';
import { DataService } from '../../../../services/data.service';
import { AssistantBoxComponent } from '../../../../shared/page/assistant-box/assistant-box.component';
import { ActivatedRoute } from '@angular/router';
import { inject, Injector, runInInjectionContext } from '@angular/core';
import { Analytics, logEvent } from '@angular/fire/analytics';
import { RecaptchaVerifier } from 'firebase/auth';
import { EmailService } from '../../../../services/email.service';
import { Email } from '../../../../shared/data/interfaces/email.model';
import { NotificationService } from '../../../../services/notification.service';
import { SoundService } from '../../../../services/sound.service';
import { AppleTransitionSection } from '../../../../shared/page/apple-transition/apple-transition.component';
import { HomeSectionsComponent } from '../../../../shared/page/home-sections/home-sections.component';
import {
  applyVisitContextToAd,
  buildExitIntentContent,
  LandingPage4AdViewModel,
  LandingPage4ExitIntentContent,
  LandingPage4VisitContext,
  resolveLandingPage4VisitContext
} from './landing-page4-journey.helpers';

type CredibilityLink = { label: string; href: string; url?: string; title?: string; };

type Testimonial = {
  quote: string;
  text?: string;
  name: string;
  author?: string;
  title?: string;
};

type OfferKey = 'realestate' | 'consulting' | 'speaking' | 'default';

type OfferConfig = {
  key: OfferKey;
  kicker: string;
  headline: string;
  subhead: string;
  title?: string;
  description?: string;
  oneLiner?: string;
  outcomes: string[];
  notes?: string;
  credibilityLinks: CredibilityLink[];
  testimonials: Testimonial[];
  stripeUrl: string;
  deliveryDays: number;
};

type LandingProductStory = {
  id: string;
  eyebrow: string;
  heading: string;
  body: string;
  route: string;
  cta: string;
  imageUrl?: string;
  imageAlt?: string;
};

const offers: Record<OfferKey, OfferConfig> = {
  default: {
    key: 'default',
    kicker: 'TODD',
    headline: 'Most software gives you more work.',
    subhead: 'TODD tries to give you your time back.',
    oneLiner: 'Less admin. Less chasing. More movement.',
    outcomes: [
      'A focused review of what is stealing time',
      'Clear next actions to reduce slow operations',
      'A practical system for keeping work moving',
      'A short summary your team can act on immediately'
    ],
    notes: 'You do not need another dashboard. You need less work.',
    credibilityLinks: [
      { label: 'Taliferro (Consulting)', href: 'https://taliferro.com' },
      { label: 'Taliferro Tech (Products)', href: 'https://taliferro.tech' }
    ],
    testimonials: [],
    stripeUrl: 'https://buy.stripe.com/8x200jdZ6eCb7mGcG42VG0o',
    deliveryDays: 3
  },

  realestate: {
    key: 'realestate',
    kicker: 'Deal Rescue',
    headline: 'Stop losing deals to follow-up fatigue.',
    subhead: 'TODD keeps outreach moving so opportunities stop dying quietly.',
    oneLiner: 'Less chasing spreadsheets. More closed business.',
    outcomes: [
      'Stalled deals reviewed',
      'Follow-up gaps identified',
      'Outreach drafted automatically',
      'Next moves prioritized clearly'
    ],
    notes: 'The problem usually is not effort. It is operational slowness.',
    credibilityLinks: [
      { label: 'Taliferro (Consulting)', href: 'https://taliferro.com' },
      { label: 'TODD (Product)', href: 'https://todd.taliferro.tech' }
    ],
    testimonials: [],
    stripeUrl: 'https://buy.stripe.com/8x200jdZ6eCb7mGcG42VG0o',
    deliveryDays: 3
  },

  consulting: {
    key: 'consulting',
    kicker: 'Decision Context',
    headline: 'Your team should not spend all day reconstructing context.',
    subhead: 'TODD captures movement, rationale, and decisions automatically.',
    oneLiner: 'Less rework. Less confusion. More forward motion.',
    outcomes: [
      'Key decisions documented',
      'Lost context reconstructed',
      'Reduced rework risk',
      'Clear operational summaries'
    ],
    notes: 'Most organizations waste time rediscovering what they already knew.',
    credibilityLinks: [
      { label: 'Taliferro (Consulting)', href: 'https://taliferro.com' },
      { label: 'Taliferro Tech (Products)', href: 'https://taliferro.tech' }
    ],
    testimonials: [],
    stripeUrl: 'https://buy.stripe.com/8x200jdZ6eCb7mGcG42VG0o',
    deliveryDays: 3
  },

  speaking: {
    key: 'speaking',
    kicker: 'Speaking',
    headline: 'The Hidden Cost of Bad Systems',
    subhead: 'How software quietly steals time, momentum, and attention.',
    oneLiner: 'A grounded talk about operational slowness, AI, and modern work.',
    outcomes: [
      '45–60 minute keynote',
      'Real-world operational examples',
      'Practical takeaways',
      'Audience Q&A'
    ],
    notes: 'This is not another AI hype talk.',
    credibilityLinks: [
      { label: 'Taliferro Group (Consulting)', href: 'https://taliferro.com' },
      { label: 'Taliferro Tech (Products)', href: 'https://taliferro.tech' }
    ],
    testimonials: [],
    stripeUrl: 'https://buy.stripe.com/8x200jdZ6eCb7mGcG42VG0o',
    deliveryDays: 3
  }
};

export const ads: {
  [key: string]: {
    headingA: string;
    headingB: string;
    subheading: string;
    bullet1: string;
    bullet2: string;
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
    finalAppeal: string;
    finalAppealSub?: string;
    link: string;
    audienceDescription: string;
  };
} = {
  BMS: {
    headingA: "Software should move work, not create more of it",
    headingB: "Stop feeding systems that do not feed you back",
    subheading: "TODD is a Momentum System that turns contacts, emails, documents, feedback, and tasks into clear next moves.",
    bullet1: "Less chasing work.",
    bullet2: "More work moving.",

    image1: "/assets/images/postcrm-hero-1.webp",

    heading2: "Your team was not hired to babysit software",
    subHeading2: "Most tools ask people to update records, check dashboards, and remember what should happen next.",
    image2: "/assets/images/postcrm-hero-2.webp",

    heading3: "Work stalls when signals live in different places",
    subHeading3: "A reply sits in email. A task sits somewhere else. A document gets buried. The follow-up gets missed.",
    image3: "/assets/images/postcrm-hero-3.webp",

    heading4: "TODD connects the signal to the next move",
    subHeading4: "It helps draft the message, create the task, organize the document, and keep the work from going cold.",
    image4: "/assets/images/postcrm-hero-4.webp",

    heading5: "You stay in control TODD carries the weight",
    subHeading5: "The system handles repetitive follow-up and coordination so your team can focus on judgment, relationships, and decisions.",
    image5: "/assets/images/postcrm-hero-5.webp",

    heading6: "Get time back without losing control",
    subHeading6: "Ask TODD what is stuck, what needs action, and what should happen next.",
    image6: "/assets/images/todd-screenshot1.webp",

    finalAppeal: "See what TODD can move for you",
    finalAppealSub: "Ask a question, book a meeting, or start with one workflow.",

    link: `${environment.PLATFORM_URL}/landing-page?audience=bms`,

    audienceDescription: "Teams tired of maintaining software instead of moving work forward"
  },

  automation: {
    headingA: "Automation should give you time back",
    headingB: "Not another system to manage",
    subheading: "TODD handles follow-ups, reminders, coordination, and repetitive work so your brain doesn't have to.",
    bullet1: "Less mental overhead.",
    bullet2: "More room to think.",

    image1: "/assets/images/automation-hero-1.webp",

    heading2: "Your brain was never built to track everything",
    subHeading2: "Deadlines, replies, reminders, outreach. It adds up fast.",
    image2: "/assets/images/automation-hero-2.webp",

    heading3: "Most automation still needs babysitting",
    subHeading3: "TODD tries to quietly carry the repetitive work for you.",
    image3: "/assets/images/automation-hero-3.webp",

    heading4: "Busy is not the goal",
    subHeading4: "Relief is.",
    image4: "/assets/images/automation-hero-4.webp",

    heading5: "You stay in control",
    subHeading5: "TODD just removes the repetitive stuff.",
    image5: "/assets/images/automation-hero-5.webp",

    heading6: "Get your headspace back",
    subHeading6: "Because mental overload is real.",
    image6: undefined,

    finalAppeal: "Let the system carry some weight",
    finalAppealSub: "So your brain can focus on bigger things.",

    link: `${environment.PLATFORM_URL}/landing-page?audience=automation`,

    audienceDescription: "People overwhelmed by repetitive admin work and constant follow-up."
  },


  solo: {
    headingA: "You are not disorganized - You are carrying too much",
    headingB: "Run solo without running scattered",
    subheading: "TODD helps solo founders, coaches, and small teams keep follow-ups, tasks, notes, and deals moving without living inside admin work.",
    bullet1: "Fewer missed follow-ups.",
    bullet2: "More room to sell.",
    image1: "/assets/ads/todd-asset21.webp",
    heading2: "You cannot close what you forget",
    subHeading2: "Leads go cold when the next move depends on memory, timing, and another tab you meant to check.",
    image2: "/assets/ads/todd-asset22.webp",
    heading3: "Doing everything alone creates hidden leaks",
    subHeading3: "A missed reply, late proposal, or forgotten note can quietly cost the deal.",
    image3: "/assets/ads/todd-asset9.webp",
    heading4: "TODD keeps the next move visible",
    subHeading4: "It helps draft the message, track the reply, and nudge the work before momentum slips.",
    image4: "/assets/ads/todd-asset10.webp",
    heading5: "You still own the relationship",
    subHeading5: "TODD handles the repetitive coordination so you can focus on judgment, trust, and the close.",
    image5: "/assets/ads/todd-asset11.webp",
    heading6: "Stop carrying the whole system in your head",
    subHeading6: "Ask TODD what needs attention and what should happen next.",
    image6: undefined,
    finalAppeal: "Run your solo act like a system",
    finalAppealSub: "Doing it all should not mean remembering it all.",
    link: `${environment.PLATFORM_URL}/landing-page?audience=solo`,
    audienceDescription: "Solo founders, business coaches, and small teams that lose momentum when follow-up depends on memory."
  },
  overwhelmed: {
    headingA: "You are not lazy - The work is spread everywhere",
    headingB: "One system for the work your brain keeps carrying",
    subheading: "TODD coordinates emails, tasks, documents, follow-ups, and timing so you stop juggling the same work all day.",
    bullet1: "Clear next moves.",
    bullet2: "Less mental load.",
    image1: "/assets/ads/todd-asset1.webp",
    heading2: "The problem is not effort",
    subHeading2: "It is the constant context switching between inboxes, calendars, files, tasks, and people.",
    image2: "/assets/ads/todd-asset2.webp",
    heading3: "Your brain is managing too many systems",
    subHeading3: "Memory, admin, pipeline, messages, and timing should not all depend on you.",
    image3: "/assets/ads/todd-asset3.webp",
    heading4: "TODD gives the work a place to move",
    subHeading4: "It connects what happened to what should happen next so fewer things slip.",
    image4: "/assets/ads/todd-asset4.webp",
    heading5: "Trying harder is not a system",
    subHeading5: "A better system reduces the chasing, checking, and remembering.",
    image5: "/assets/ads/todd-asset6.webp",
    heading6: "Close loops without chasing every detail",
    subHeading6: "Ask TODD what is stalled, what is due, and what needs action.",
    image6: "/assets/ads/todd-asset6.webp",
    finalAppeal: "Let TODD carry some of the load",
    finalAppealSub: "So you can lead the work instead of juggling it.",
    link: `${environment.PLATFORM_URL}/landing-page?audience=overwhelmed`,
    audienceDescription: "Solo founders and small teams doing too much across too many disconnected tools."
  },
  supplier: {
    headingA: "Supplier work should not live in spreadsheets",
    headingB: "See who is active, stalled, and ready for support",
    subheading: "TODD helps supplier programs track engagement, spot gaps, and move follow-up from scattered files into one working system.",
    bullet1: "Clear vendor visibility.",
    bullet2: "Better follow-through.",
    image1: "/assets/images/supplier-hero-1.webp",
    heading2: "You cannot support what you cannot see",
    subHeading2: "Spreadsheets rarely show who is drifting, who needs help, or which relationship needs action now.",
    image2: "/assets/images/supplier-hero-2.webp",
    heading3: "Engagement should not be guesswork",
    subHeading3: "TODD helps show who is active, quiet, overdue, or ready for the next step.",
    image3: "/assets/images/supplier-hero-3.webp",
    heading4: "Manual tracking creates missed opportunity",
    subHeading4: "One forgotten follow-up can weaken a vendor relationship or delay a real opportunity.",
    image4: "/assets/images/supplier-hero-4.webp",
    heading5: "TODD connects activity across people, forms, emails, and documents",
    subHeading5: "Your team gets a clearer picture without hunting through every inbox and folder.",
    image5: "/assets/images/supplier-hero-5.webp",
    heading6: "Replace static files with a living workflow",
    subHeading6: "Turn scattered supplier data into visible next steps.",
    image6: undefined,
    finalAppeal: "See your supplier flow clearly",
    finalAppealSub: "Book a demo and see how TODD helps close the loop.",
    link: `${environment.PLATFORM_URL}/landing-page?audience=supplier`,
    audienceDescription: "Supplier diversity teams, ecosystem builders, and nonprofit organizers managing vendors across spreadsheets, inboxes, and forms."
  },
  chamber: {
    headingA: "Support more businesses without losing the thread",
    headingB: "See who needs help before they disappear",
    subheading: "TODD helps chambers, incubators, and business centers track engagement, needs, follow-up, and movement across their ecosystem.",
    bullet1: "Spot stalls early.",
    bullet2: "Route support faster.",
    image1: "/assets/images/org-hero-1.webp",
    heading2: "More outreach is not always the answer",
    subHeading2: "You need to know who is moving, who is stuck, and who needs a real next step.",
    image2: "/assets/images/org-hero-2.webp",
    heading3: "Quiet members are easy to miss",
    subHeading3: "No-shows, stalled applications, cold replies, and missed timing are signals your team can act on.",
    image3: "/assets/images/org-hero-3.webp",
    heading4: "Your staff cannot chase everyone manually",
    subHeading4: "TODD helps prioritize where attention can create the most movement.",
    image4: "/assets/images/org-hero-4.webp",
    heading5: "Move beyond spreadsheets and scattered notes",
    subHeading5: "Give your team a clearer way to see engagement and follow-through.",
    image5: "/assets/images/org-hero-5.webp",
    heading6: "Support becomes easier when signals are visible",
    subHeading6: "TODD helps turn member activity into clear action.",
    image6: undefined,
    finalAppeal: "Give your team clearer visibility",
    finalAppealSub: "Book a demo and see who is active, stalled, and ready for support.",
    link: `${environment.PLATFORM_URL}/landing-page?audience=chamber`,
    audienceDescription: "Chambers of commerce, incubators, and business support organizations that need visibility across engagement and follow-up."
  },
  bootstrap: {
    headingA: "Build with a system, not grit",
    headingB: "TODD turns chaos into flow",
    subheading: "TODD runs the back office—emails, nudges, tracking—while you build.",
    bullet1: "One place for motion.",
    bullet2: "Progress without hiring.",
    image1: "/assets/ads/todd-asset1.webp",
    heading2: "This isn't entrepreneurship - This is survival mode",
    subHeading2: "You're wearing 5 hats. TODD wears a few for you.",
    image2: "/assets/ads/todd-asset3.webp",
    heading3: "Every missed follow-up is money walking away",
    subHeading3: "You don't have to be everywhere at once.",
    image3: "/assets/ads/todd-asset5.webp",
    heading4: "TODD does the boring stuff you hate",
    subHeading4: "Emails, nudges, data cleanup—automated.",
    image4: "/assets/ads/todd-asset7.webp",
    heading5: "Admin isn't the job. Growth is",
    subHeading5: "Stop managing tasks. Start moving forward.",
    image5: "/assets/ads/todd-asset9.webp",
    heading6: "Get your hours—and your headspace—back",
    subHeading6: "TODD handles the load. You handle the mission.",
    image6: undefined,
    finalAppeal: "Let TODD be your ops system",
    finalAppealSub: "So you can get back to building.", link: `${environment.PLATFORM_URL}/?audience=bootstrap`,
    audienceDescription: "Bootstrapped founders, part-time operators, or community connectors who need an assistant but can't afford to hire. TODD becomes the doer.",

  },
  spreadsheet: {
    headingA: "Spreadsheets track - TODD moves",
    headingB: "Trade tabs for a system",
    subheading: "TODD turns scattered rows into coordinated action.",
    bullet1: "From data to doing.",
    bullet2: "Flow replaces manual steps.",
    image1: "/assets/ads/todd-asset1.webp",
    heading2: "Spreadsheets weren't built for relationships",
    subHeading2: "They were built for accountants. You're not one.",
    image2: "/assets/ads/todd-asset2.webp",
    heading3: "Manual systems kill consistency",
    subHeading3: "One missed row = one missed deal.",
    image3: "/assets/images/spreadsheet-hero-3.webp",
    heading4: "Color-coding is not a strategy",
    subHeading4: "You shouldn't need 10 columns to remember who to call.",
    image4: "/assets/images/spreadsheet-hero-4.webp",
    heading5: "TODD replaces the chaos with clarity",
    subHeading5: "Searchable, trackable, and always on point.",
    image5: "/assets/images/software-scam.webp",
    heading6: "Drop the spreadsheet. Keep the progress",
    subHeading6: "TODD moves your work forward—automatically.",
    image6: undefined,
    finalAppeal: "See momentum when the system runs",
    finalAppealSub: "Book a demo. Get out of the grid.", link: `${environment.PLATFORM_URL}/?audience=spreadsheet`,
    audienceDescription: "People managing tasks or businesses using spreadsheets",

  },
  tasks: {
    headingA: "Manage outcomes - not lists",
    headingB: "TODD shows flow, blocks, next steps",
    subheading: "TODD makes work visible across people, tasks, and timing.",
    bullet1: "What’s moving, live.",
    bullet2: "Who owns the next move.",
    image1: "/assets/ads/todd-asset2.webp",
    heading2: "The to-do list is lying to you",
    subHeading2: "Just because it's listed doesn't mean it's moving.",
    image2: "/assets/ads/todd-asset4.webp",
    heading3: "Progress should be visible—not remembered",
    subHeading3: "You shouldn't have to ask what's done. You should know.",
    image3: "/assets/ads/todd-asset6.webp",
    heading4: "Delegation without visibility is a guessing game",
    subHeading4: "TODD shows where things stand—no meetings required.",
    image4: "/assets/ads/todd-asset8.webp",
    heading5: "No more buried tasks and forgotten follow-ups",
    subHeading5: "Every task has a status. Every status drives action.",
    image5: "/assets/ads/todd-asset10.webp",
    heading6: "Manage outcomes, not lists",
    subHeading6: "TODD keeps projects moving—even when no one's watching.",
    image6: undefined,
    finalAppeal: "Run projects as a system",
    finalAppealSub: "Let TODD show what's really getting done.",
    link: `${environment.PLATFORM_URL}/?audience=tasks`,
    audienceDescription: "Project Leads or Program Coordinators",

  },
  survey: {
    headingA: "Feedback should not sit in a report",
    headingB: "Turn answers into action",
    subheading: "TODD reads survey responses, finds the patterns, and helps you create the follow-up work before momentum fades.",
    bullet1: "Signals become next steps.",
    bullet2: "Feedback turns into follow-through.",
    image1: "/assets/images/pulse-hero-1.webp",
    heading2: "Raw responses are only the beginning",
    subHeading2: "TODD looks across the feedback and surfaces the trends, gaps, outliers, and people who may need attention.",
    image2: "/assets/images/pulse-hero-2.webp",
    heading3: "You should not need a pivot table to know what matters",
    subHeading3: "TODD helps explain what the responses mean so your team can act faster.",
    image3: "/assets/images/pulse-hero-3.webp",
    heading4: "The system creates movement from the insight",
    subHeading4: "Turn findings into tasks, outreach, documents, and follow-up without starting from scratch.",
    image4: "/assets/images/pulse-hero-4.webp",
    heading5: "See who needs support before they disappear",
    subHeading5: "TODD connects feedback to people, timing, and next actions so quiet issues do not stay hidden.",
    image5: "/assets/images/pulse-hero-5.webp",
    heading6: "Close the loop while the signal is still fresh",
    subHeading6: "Survey data becomes a plan your team can move on immediately.",
    image6: undefined,
    finalAppeal: "See what TODD surfaces",
    finalAppealSub: "Ask TODD what action your feedback should trigger next.", link: `${environment.PLATFORM_URL}/?audience=survey`,
    audienceDescription: "Program evaluators, nonprofit administrators, and equity teams that need survey feedback to produce visible follow-up, not another static report.",

  },

  marketingbaby: {
    headingA: "You move fast. Your system should keep up",
    headingB: "All hustle Less pull",
    subheading: "TODD helps solo founders and contractors keep leads, emails, tasks, proposals, and documents moving in one connected system.",
    bullet1: "Less tab-hopping.",
    bullet2: "More finished work.",
    image1: "/assets/ads/todd-asset11.webp",
    heading2: "Fast work breaks when the system is slow",
    subHeading2: "You should not lose momentum because a lead, note, email, or proposal lives in a different place.",
    image2: "/assets/ads/todd-asset13.webp",
    heading3: "No more bouncing between tabs and tools",
    subHeading3: "TODD brings the work into one motion so you can see what needs attention and act without hunting for context.",
    image3: "/assets/ads/todd-asset15.webp",
    heading4: "Most tools track effort. TODD makes moves",
    subHeading4: "From warm lead to signed proposal, TODD helps push the next step forward.",
    image4: "/assets/ads/todd-asset17.webp",
    heading5: "Looking busy is not the goal",
    subHeading5: "Closed loops, sent follow-ups, finished tasks, and paid work are the goal.",
    image5: "/assets/ads/todd-asset19.webp",
    heading6: "You do not need more hours You need less problems",
    subHeading6: "TODD handles the repetitive coordination so you can stay focused on the win.",
    image6: undefined,
    finalAppeal: "Watch TODD do the doing",
    finalAppealSub: "Less grind. More progress. Same hustle.", link: `${environment.PLATFORM_URL}/?audience=marketingbaby`,
    audienceDescription: "Solo founders and contractors juggling sales, admin, marketing, documents, and follow-up without enough time.",

  },
  recovery: {
    headingA: "Recover momentum you missed",
    headingB: "TODD watches the quiet signals",
    subheading: "TODD surfaces silent replies and restarts the flow.",
    bullet1: "Find the almost‑wins.",
    bullet2: "Re‑engage automatically.",
    image1: "/assets/ads/todd-asset20.webp",
    heading2: "You missed a message. It cost you money",
    subHeading2: "TODD catches the quiet replies you never saw.",
    image2: "/assets/ads/todd-asset21.webp",
    heading3: "Most deals don't go cold—they go quiet",
    subHeading3: "And without follow-up, silence becomes a no.",
    image3: "/assets/ads/todd-asset22.webp",
    heading4: "Not every opportunity knocks twice",
    subHeading4: "But TODD makes sure you're at the door when it does.",
    image4: "/assets/ads/todd-asset23.webp",
    heading5: "Your inbox shouldn't be a graveyard",
    subHeading5: "Resurrect missed replies and lost momentum.",
    image5: "/assets/ads/solo-2.webp",
    heading6: "Follow-up is the difference between maybe and money",
    subHeading6: "TODD makes sure you never miss your shot again.",
    image6: undefined,
    finalAppeal: "Win back stalled opportunities",
    finalAppealSub: "TODD's watching—even when you're not.",
    link: `${environment.PLATFORM_URL}/?audience=recovery`,
    audienceDescription: "Operators losing out because they can't follow up fast enough, or don't even know a reply came in. TODD catches it all.",
  }


};

@Component( {
  selector: 'app-landing-page4',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule, HomeSectionsComponent],
  templateUrl: './landing-page4.component.html',
  styleUrls: ['./landing-page4.component.css', '../todd-landing-page/todd-landing-page.component.css']
} )
export class LandingPage4Component implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild( 'symphonyPlayer', { static: false } ) symphonyPlayer!: ElementRef<HTMLVideoElement>;
  @ViewChild( 'videoSection', { static: true } ) videoSection!: ElementRef;
  videoVisible = false;
  currentVideoIndex = 0;

  showVideoSection: boolean = false;
  productVideoSrc = 'https://www.youtube.com/embed/K5RBkEdfPFw?start=9&autoplay=1&mute=1&loop=1&controls=0&rel=0&modestbranding=1&playsinline=1';

  private analytics = inject( Analytics );
  private readonly injector = inject( Injector );
  isBMS: boolean = false;
  isLoggedIn: boolean = false;
  private getUserSubscription!: Subscription;
  contactForm: FormGroup;

  @ViewChild( AssistantBoxComponent ) assistantBoxRef!: AssistantBoxComponent;
  siteKey = environment.RECAPTCHA_KEY;
  showOutageBanner: boolean = false;
  isLoading: boolean = false;
  sendSubscription!: Subscription;
  adSubscription!: Subscription;
  openAISubscription!: Subscription;
  checkEmailSubscription!: Subscription;
  adStats: { [key: string]: number; } = {};
  private currenUserEmail!: string;

  recaptchaVerifier!: RecaptchaVerifier;
  recaptchaVerified = false;
  verificationId!: string;
  private adStartTime: number = 0;
  showAd = true;

  showForm: boolean = false;
  aiResponse!: string | null;
  exitAppeal!: string | null;
  selectedAds: LandingPage4AdViewModel[] = [];
  selectedAd: LandingPage4AdViewModel | null = null;
  landingSections: AppleTransitionSection[] = [];
  visitContext!: LandingPage4VisitContext;
  exitIntentContent!: LandingPage4ExitIntentContent;
  showExitIntentModal = false;
  exitIntentDismissed = false;

  public userMeta: any = null;
  offer: OfferConfig | null = null;
  credibilityLinks: CredibilityLink[] = [];
  testimonials: Testimonial[] = [];
  stripeUrl = '';
  deliveryDays: number | null = null;

  contact: Contact = {
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    images: [{
      src: 'assets/nophoto.svg',
      alt: 'No photo available'
    }],
    company: {  // Add default company object here
      name: '',  // Default empty name
      numberOfEmployees: '', // Default value can be empty or a placeholder
      other: '', // Default or initial value
      phoneNumbers: [], // Initialize as empty array
      emailAddresses: [], // Initialize as empty array
      addresses: [], // Initialize as empty array
      url: '', // Default or initial value
      sicCode: '', // Default or initial value
      status: '', // Default or initial value
      shared: false, // Default boolean value
      capabilities: []
    },
    // Default values for new properties
    connectionDetails: {
      startDate: new Date().toISOString(),  // Consider what default makes sense for your use case
      mutualConnections: 0,
      transactionHistory: []
    },
    engagements: [],
    interactions: [],
    statusHistory: [],
    notes: [],
    acquisitionSource: 'web',
    dateAdded: new Date().toISOString(),
    lastContacted: new Date().toISOString()
  };

  private readonly platformId = inject( PLATFORM_ID );

  readonly insights = [
    "Nobody says that part aloud.",
    "That's the scam nobody talks about."
  ];
  insight = '';
  insightVariantKey = 0;

  private sessionId = '';
  private experimentStartedAt = 0;
  private maxScrollDepth = 0;
  private experimentClicked = false;
  private experimentEngaged = false;
  private insightExitFired = false;
  private scrollHandler: ( () => void ) | null = null;
  private thirtySecondTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly pageHideHandler = () => this.fireInsightExitEvent();
  private readonly storyImagePlaceholders = {
    intro: '/assets/about-todd1.png',
    problem: '/assets/about-todd2.png',
    solution: '/assets/about-todd3.png'
  };
  private readonly coreProductStories: LandingProductStory[] = [
    {
      id: 'product-signals',
      eyebrow: 'Signals — Step 1 of the loop',
      heading: 'This is where TODD watches',
      body: 'Every email open, contact change, social response, and missed follow-up is a signal. Signals collects them all and surfaces what changed since you last looked.',
      route: '/signal-engine',
      cta: 'Open Signals',
      imageUrl: '/assets/outreach/signal-engine.png',
      imageAlt: 'Signals workspace preview'
    },
    {
      id: 'product-momentum',
      eyebrow: 'Momentum — Step 2 of the loop',
      heading: 'This is where your day gets organized',
      body: `Momentum takes the signals and turns them into a ranked list of what matters today. It drafts the responses, flags the blockers, and puts the decisions in front of you — so your morning starts with clarity instead of catch-up.`,
      route: '/daily-momentum',
      cta: 'Open Momentum',
      imageUrl: '/assets/network/momentum.png',
      imageAlt: 'Momentum workspace preview'
    },
    {
      id: 'product-social',
      eyebrow: 'Social — Step 3 of the loop',
      heading: 'This is how you show up publicly',
      body: 'Social drafts posts based on what is happening in your business, queues them for your approval, and publishes on schedule. Your public presence stays active without manual effort.',
      route: '/outreach/social',
      cta: 'Open Social',
      imageUrl: '/assets/outreach/todd-social2.png',
      imageAlt: 'TODD Social Preview'
    },
    {
      id: 'product-network',
      eyebrow: 'Network — Step 4 of the loop',
      heading: 'This is who you are reaching',
      body: 'Network is where the people, firms, and relationship context behind the work stay connected instead of getting scattered across notes and inboxes.',
      route: '/network',
      cta: 'Open Network',
      imageUrl: '/assets/network/network.png',
      imageAlt: 'Network workspace preview'
    },
    {
      id: 'product-outreach',
      eyebrow: 'Outreach — Step 5 of the loop',
      heading: 'This is how you reach them',
      body: 'Outreach helps draft, stage, send, and continue the conversation so momentum does not die after the first message.',
      route: '/outreach',
      cta: 'Open Outreach',
      imageUrl: '/assets/outreach/outreach.png',
      imageAlt: 'Outreach workspace preview'
    },
    {
      id: 'product-docs',
      eyebrow: 'Docs — Step 6 of the loop',
      heading: 'This is what powers the words',
      body: 'Docs stores the reusable content, internal knowledge, and supporting material that should help the next move happen faster.',
      route: '/docs',
      cta: 'Open Docs',
      imageUrl: '/assets/docs/docs.png',
      imageAlt: 'Docs workspace preview'
    },
    {
      id: 'product-moves',
      eyebrow: 'Moves — Step 7 of the loop',
      heading: 'This is the work that follows',
      body: 'Every conversation leads somewhere. Moves captures the next action, connects it to real context, and keeps execution from depending on memory alone.',
      route: '/moves',
      cta: 'Open Moves',
      imageUrl: '/assets/moves/moves.png',
      imageAlt: 'Moves workspace preview'
    },
    {
      id: 'product-pulse',
      eyebrow: 'Pulse — Step 8 of the loop',
      heading: 'This is how you listen back',
      body: 'Pulse makes it easier to ask sharper questions, collect response data, and turn that feedback into a signal that starts the loop again.',
      route: '/pulse',
      cta: 'Open Pulse',
      imageUrl: '/assets/pulse/pulse.png',
      imageAlt: 'Pulse workspace preview'
    }
  ];

  constructor ( private router: Router,
    private notificationService: NotificationService,
    private soundService: SoundService,
    private emailService: EmailService,
    private route: ActivatedRoute, private dataService: DataService, private fb: FormBuilder, private logger: LoggerService, private cd: ChangeDetectorRef, private authService: AuthService, private openAIService: OpenAIService ) {
    this.contactForm = this.fb.group( {
      firstName: ['', [Validators.required, Validators.minLength( 2 )]],
      lastName: ['', [Validators.required, Validators.minLength( 2 )]],
      companyName: ['', [Validators.required, Validators.minLength( 2 )]],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: ['', [Validators.required, Validators.pattern( '^[+]?[0-9\\-\\s]{10,15}$' )]] // Regex pattern for phone number validation
    } );
  }

  ngOnInit (): void {
    // Show video section only if not already shown in this browser
    const videoShown = localStorage.getItem( 'videoShown' );
    if ( !videoShown ) {
      this.showVideoSection = true;
      localStorage.setItem( 'videoShown', 'true' );
    } else {
      this.showVideoSection = false;
    }
    window.addEventListener( 'beforeunload', this.beforeUnloadHandler );
    this.adStartTime = performance.now();
    this.isLoading = true;
    this.visitContext = this.resolveVisitContext();
    this.exitIntentContent = buildExitIntentContent( this.visitContext );
    this.setUser();
    this.determineContentToDisplay();
    this.setOfferFromQuery();
    this.initInsightExperiment();
    this.rebuildLandingSections();
    document.addEventListener( 'mouseout', this.handleExitIntent );
    setTimeout( () => {
      this.userMeta = this.authService.getUserMeta() ?? null;
      if ( this.userMeta ) {
        this.logger.info( "User Meta", this.userMeta );
      }
      this.isLoading = false;
    }, 1500 );
  }

  ngAfterViewInit (): void {
    // Check for emailId in the URL query parameters
    const emailId = this.route.snapshot.queryParamMap.get( 'emailId' );
    if ( emailId ) {
      this.logger.log( "EmailId found in query param:", emailId );
      this.checkEmailSent( emailId );
    }

    this.setupIntersectionObserver();
  }



  onQuickPill ( question: string ): void {
    try {
      const prompt = String( question || '' ).trim();
      if ( !prompt ) return;

      this.buttonClick();
      this.logAdEngagement( 'click', 'quick_pill' );

      this.safeLogEvent( 'landing_quick_pill_to_todd', { prompt } );

      this.router.navigate( ['/ask-todd'], {
        queryParams: { q: prompt }
      } );
    } catch ( error ) {
      this.logger.error( 'Error routing quick pill to TODD', error );
    }
  }

  handleLandingStoryAction ( actionId: string ): void {
    switch ( actionId ) {
      case 'ask_intro':
        this.onQuickPill( 'How can TODD help my organization today?' );
        return;
      case 'ask_problem':
        this.onQuickPill( 'Why are we spending more on technology and still moving slow?' );
        return;
      case 'ask_solution':
        this.onQuickPill( 'What should I understand first about how TODD solves operational slowness?' );
        return;
      case 'book_meeting':
        this.buttonClick();
        this.logAdEngagement( 'click', 'landing_story_book_meeting' );
        window.open( 'https://calendar.app.google/Z4zHCJ8Xq3EuwTPd9', '_blank', 'noopener,noreferrer' );
        return;
      case 'start_now':
        this.buttonClick();
        this.logAdEngagement( 'click', 'landing_story_start_now' );
        void this.router.navigate( ['/suite/pricing'] );
        return;
      default:
        return;
    }
  }

  private rebuildLandingSections (): void {
    const sections: AppleTransitionSection[] = [
      this.buildIntroSection(),
      this.buildPainSection(),
      this.buildSolutionSection(),
      ...this.buildCoreProductSections(),
      this.buildProofSection(),
      this.buildClosingSection()
    ];

    this.landingSections = sections.filter( section => !!section );
  }

  private setOfferFromQuery (): void {
    const ref = ( this.route.snapshot.queryParamMap.get( 'ref' ) || '' ).trim().toLowerCase();

    // If ref matches a known offer key, use it.
    if ( ref === 'realestate' || ref === 'consulting' || ref === 'speaking' ) {
      this.offer = this.normalizeOffer( offers[ref as OfferKey] );
      this.syncOfferViewModel();
      this.rebuildLandingSections();
      return;
    }

    // Backward compatibility: if ref is present but NOT an offer key, treat it as a contact token.
    if ( ref ) {
      this.checkContactPassed( ref );
    }

    this.offer = this.normalizeOffer( offers.default );
    this.syncOfferViewModel();
    this.rebuildLandingSections();
  }

  private normalizeOffer ( offer: OfferConfig ): OfferConfig {
    return {
      ...offer,
      title: offer.title || offer.headline,
      description: offer.description || offer.subhead,
      credibilityLinks: ( offer.credibilityLinks || [] ).map( link => ( {
        ...link,
        url: link.url || link.href,
        title: link.title || link.label
      } ) ),
      testimonials: ( offer.testimonials || [] ).map( testimonial => ( {
        ...testimonial,
        text: testimonial.text || testimonial.quote,
        author: testimonial.author || testimonial.name
      } ) )
    };
  }

  private syncOfferViewModel (): void {
    this.credibilityLinks = this.offer?.credibilityLinks || [];
    this.testimonials = this.offer?.testimonials || [];
    this.stripeUrl = this.offer?.stripeUrl || '';
    this.deliveryDays = this.offer?.deliveryDays || null;
  }

  onPayClick (): void {
    try {
      const stripeUrl = this.offer?.stripeUrl;
      this.logAdEngagement( 'click', 'stripe_checkout' );
      if ( !stripeUrl || stripeUrl.includes( 'REPLACE_ME' ) ) {
        this.notificationService.show( 'Missing Stripe Link', 'Add your Stripe checkout link for this offer.', 'error' );
        return;
      }
      // Let the anchor navigate normally; this is just a safety/log hook.
    } catch ( e ) {
      // no-op
    }
  }

  setupIntersectionObserver () {
    const observer = new IntersectionObserver( entries => {
      entries.forEach( entry => {
        if ( entry.isIntersecting ) {
          this.videoVisible = true;
          observer.unobserve( entry.target );
        }
      } );
    }, { threshold: 0.1 } );

    if ( this.videoSection?.nativeElement ) {
      observer.observe( this.videoSection.nativeElement );
    }
  }

  private buildIntroSection (): AppleTransitionSection {
    return {
      id: 'todd-intro',
      type: 'image',
      eyebrow: 'What is TODD?',
      heading: `TODD is a Momentum System`,
      body: 'What is a Momentum System? A Momentum System answers one question: "Given what I know right now, what should I do next?"',
      imageUrl: this.storyImagePlaceholders.intro,
      imageAlt: 'TODD intro',
      actions: [
        {
          label: this.isLoggedIn ? 'Enter' : 'Login',
          route: this.isLoggedIn ? '/ask-todd' : '/login',
          variant: 'primary'
        }
      ],
      mediaPosition: 'right',
      panelClass: 'apple-story__panel--intro todd-landing-story-panel todd-landing-story-panel--intro'
    };
  }

  private buildPainSection (): AppleTransitionSection {
    return {
      id: 'todd-problem',
      type: 'video',
      eyebrow: 'The real problem',
      heading: 'Every Day Starts With The Same Question',
      body: 'What should I do next? Most people answer that question by checking email, opening dashboards, scrolling through tasks, and hoping nothing important gets missed. Opportunities cool off. Relationships weaken. Projects slow down. Not because people are lazy. Because no system connected what happened to what should happen next.',

      imageUrl: this.storyImagePlaceholders.problem,
      imageAlt: 'TODD Problem',
      mediaPosition: 'right',

      panelClass: 'todd-landing-story-panel todd-landing-story-panel--problem'
    };
  }

  private buildSolutionSection (): AppleTransitionSection {
    return {
      id: 'todd-solution',
      type: 'image',
      eyebrow: 'How TODD works',
      heading: 'One loop Eight modules Nothing falls between them',
      body: 'Something happens. TODD notices it. It figures out what should happen next and drafts the response. You approve. It executes. That loop — signal to action — repeats every day across your contacts, outreach, documents, tasks, and feedback.',
      imageUrl: this.storyImagePlaceholders.solution,
      imageAlt: 'TODD solution',
      mediaPosition: 'left',
      panelClass: 'todd-landing-story-panel todd-landing-story-panel--solution'
    };
  }


  private buildCoreProductSections (): AppleTransitionSection[] {
    return this.coreProductStories.map( ( product, index ) => ( {
      id: product.id,
      type: product.imageUrl ? 'mediaText' : 'text',
      eyebrow: product.eyebrow,
      heading: product.heading,
      body: product.body,
      imageUrl: product.imageUrl,
      imageAlt: product.imageAlt || product.heading,
      mediaPosition: index % 2 === 0 ? 'right' : 'left',
      actions: [
        { label: product.cta, route: product.route, variant: 'primary' }
      ]
    } ) );
  }

  private buildProofSection (): AppleTransitionSection {
    const proofShortId = 'Ek7Te_jVKYk';

    return {
      id: 'todd-proof',
      type: 'video',
      eyebrow: 'Proof',
      heading: 'Nothing falls through Not because you remembered Because the system carries it',
      body: 'Eight modules. One loop. Every signal connected to an action, every action connected to an outcome.',
      embedUrl: `https://www.youtube.com/embed/${proofShortId}?playsinline=1&rel=0&modestbranding=1`,
      embedTitle: 'TODD proof short',
      mediaAspectRatio: '9 / 16',
      mediaPosition: 'left',
      panelClass: 'todd-landing-story-panel todd-landing-story-panel--credibility'
    };
  }

  private buildClosingSection (): AppleTransitionSection {
    return {
      id: 'todd-closing',
      type: 'cta',
      eyebrow: 'Next step',
      heading: this.selectedAd?.finalAppeal || this.offer?.title || 'Ready to see what TODD can move?',
      body: this.selectedAd?.finalAppealSub || this.offer?.description || 'Ask TODD a question, book time, or start with the operating model that best fits the pressure you are under.',
      actions: [
        { label: 'Start Now', actionId: 'start_now', variant: 'primary' },
        { label: 'Book a Meeting', actionId: 'book_meeting', variant: 'secondary' }
      ],
      panelClass: 'apple-story__panel--closing'
    };
  }




  ngOnDestroy (): void {
    window.removeEventListener( 'beforeunload', this.beforeUnloadHandler );
    document.removeEventListener( 'mouseout', this.handleExitIntent );
    if ( this.getUserSubscription )
      this.getUserSubscription.unsubscribe();
    if ( this.sendSubscription )
      this.sendSubscription.unsubscribe();
    if ( this.adSubscription )
      this.adSubscription.unsubscribe();
    if ( this.openAISubscription )
      this.openAISubscription.unsubscribe();
    if ( this.checkEmailSubscription )
      this.checkEmailSubscription.unsubscribe();

    const timeOnAdMs = performance.now() - this.adStartTime;
    this.logAdEngagement( 'view', '', timeOnAdMs );

    if ( isPlatformBrowser( this.platformId ) ) {
      if ( this.scrollHandler ) {
        window.removeEventListener( 'scroll', this.scrollHandler );
      }
      window.removeEventListener( 'pagehide', this.pageHideHandler );
    }
    if ( this.thirtySecondTimer !== null ) {
      clearTimeout( this.thirtySecondTimer );
    }
    this.fireInsightExitEvent();
  }

  beforeUnloadHandler = () => {
    const duration = performance.now() - this.adStartTime;
    this.logAdEngagement( 'view', '', duration );
    this.fireInsightExitEvent();
  };

  setUser () {
    try {
      this.getUserSubscription = this.authService.getUser().subscribe( ( user ) => {
        this.isLoggedIn = !!( user && user.uid );
        this.adCalculator();
        this.rebuildLandingSections();
      } );
    } catch ( error ) {
      this.logger.error( "User Check Error", this.isLoggedIn );
    }
  }

  adCalculator () {
    this.dataService.getKnownTenantDocuments( 'AD_ENGAGEMENTS', environment.taliferroTenantId )
      .then( ( records: any[] ) => {
        const counts: { [key: string]: number; } = {};
        records.forEach( r => {
          if ( r.adKey ) {
            counts[r.adKey] = ( counts[r.adKey] || 0 ) + 1;
          }
        } );
        this.adStats = counts;
        this.logger.log( "Ad Engagement Stats:", this.adStats );
      } )
      .catch( err => {
        this.logger.error( "Failed to fetch ad stats", err );
      } );
  }

  determineContentToDisplay () {
    try {
      const requestedAudience = this.visitContext.audience;
      const resolvedAudienceKey = this.resolveAudienceAdKey( requestedAudience );
      this.isBMS = resolvedAudienceKey.toLowerCase() === 'bms';

      this.logger.info( "Audience is:", requestedAudience );

      const ad = resolvedAudienceKey ? ads[resolvedAudienceKey] : this.getWeightedAd();

      this.logger.info( "Ad is:", ad );

      const useAltHeading = Math.random() > 0.5; // 50/50 test

      const baseAd = {
        heading: useAltHeading ? ad.headingB : ad.headingA,
        subheading: ad.subheading,
        bullet1: ad.bullet1,
        bullet2: ad.bullet2,
        finalAppeal: ad.finalAppeal,
        finalAppealSub: ad.finalAppealSub,
        image1: ad.image1,
        heading2: ad.heading2,
        subHeading2: ad.subHeading2,
        image2: ad.image2,
        heading3: ad.heading3,
        subHeading3: ad.subHeading3,
        image3: ad.image3,
        heading4: ad.heading4,
        subHeading4: ad.subHeading4,
        image4: ad.image4,
        heading5: ad.heading5,
        subHeading5: ad.subHeading5,
        image5: ad.image5,
        heading6: ad.heading6,
        subHeading6: ad.subHeading6,
        image6: ad.image6
      };
      this.selectedAd = applyVisitContextToAd( baseAd, this.visitContext );
      this.rebuildLandingSections();
    } catch ( error ) {
      this.logger.error( "Error Determining Content to Display" );
    }
  }

  private safeLogEvent ( eventName: string, params?: Record<string, unknown> ): void {
    try {
      runInInjectionContext( this.injector, () => {
        logEvent( this.analytics, eventName, params );
      } );
    } catch {
      // Analytics unavailable — safe to swallow
    }
  }

  private logAdEngagement ( eventType: 'click' | 'view', linkClicked?: string, durationMs?: number ): void {
    try {
      if ( !this.selectedAd ) return;

      const adKey = Object.keys( ads ).find( key => {
        const ad = ads[key];
        return ad.headingA === this.selectedAd?.heading || ad.headingB === this.selectedAd?.heading;
      } );

      if ( !adKey ) return;

      const variant = this.selectedAd?.heading === ads[adKey]?.headingA ? 'A' : 'B';

      const payload: any = {
        adKey,
        variant,
        page: 'landing-page4',
        audience: adKey,
        eventType,
        timestamp: Date.now(),
        userId: this.currenUserEmail ?? 'anonymous',
        ip: this.userMeta?.ipAddress,
        link: linkClicked ?? '',
        durationMs: durationMs ?? null,
        device: window.innerWidth < 768 ? 'mobile' : 'desktop',
        source: this.visitContext?.sourceLabel || 'Direct',
        campaign: this.visitContext?.campaign || '',
        interestArea: this.visitContext?.interestArea || 'general',
        outcome: null
      };

      if ( eventType === 'view' && durationMs !== undefined ) {
        payload.durationMs = durationMs;
      }

      this.logger.log( "Logging ad engagement:", payload );

      this.dataService.addKnownTenantDocument( 'AD_ENGAGEMENTS', payload, 'landing-page', environment.taliferroTenantId )
        .then( () => this.logger.info( "Engagement Logged" ) );

    } catch ( error ) {
      this.logger.error( "Error Logging Engagement", error );
    }
  }

  checkContactPassed ( ref: any ) {
    try {
      const safeRef = decodeURIComponent( ref );
      let padded = safeRef;
      while ( padded.length % 4 !== 0 ) padded += '=';
      const contactId = atob( padded );
      this.logger.log( `Decoded contactId: ${contactId}` );

      this.dataService.getKnownTenantDocument( "CONTACTS", contactId, this.resolveJourneyTenantId() ).then( contact => {
        this.logger.log( "Contact Returned", contact );
        if ( contact ) {
          this.logger.info( "Personalized contact loaded" );
          this.contact = contact;
          this.applyPersonalizedExperience( contact );
          this.rebuildLandingSections();
        }
      } );

    } catch ( error ) {
      this.logger.error( 'Failed to decode or fetch contact:', error );
    }
  }

  checkEmailSent ( emailId: string ) {
    try {
      const journeyTenantId = this.resolveJourneyTenantId();
      this.dataService.getKnownTenantDocument( "EMAILS", emailId, journeyTenantId ).then( ( email ) => {
        this.logger.log( "Email", email );
        if ( email ) {
          const sentTo = email.to;
          this.currenUserEmail = sentTo;
          this.dataService.getKnownTenantContactByEmail( sentTo, journeyTenantId ).then( ( contact ) => {
            this.logger.log( "Contact", contact );
            if ( contact ) {
              this.contact = contact;
              this.applyPersonalizedExperience( contact, email );
              this.rebuildLandingSections();
            }
          } );
        }

      } );
    } catch ( error ) {
      this.logger.error( "Error Checking Email Sent to user" );
    }

  }

  applyPersonalizedExperience ( contact: any, email?: Email ): void {
    try {
      let userPrompt;
      if ( email && email.html ) {
        userPrompt = `
        Subject: ${email.subject}
        Body: ${email.html.replace( /<[^>]+>/g, '' )} 
      `;
      }
      const location = contact.addresses?.map( ( addr: { streetAddress: any; city: any; state: any; zip: any; } ) =>
        `${addr.streetAddress}, ${addr.city}, ${addr.state} ${addr.zip}`
      ).join( ' | ' );

      const businessLocation = contact.company.addresses?.map( ( addr: { streetAddress: any; city: any; state: any; zip: any; } ) =>
        `${addr.streetAddress}, ${addr.city}, ${addr.state} ${addr.zip}`
      ).join( ' | ' );

      const notes = contact.notes?.map( ( note: { text: any; } ) => note.text ).join( ' | ' );

      const contactSummary = `
      First Name: ${contact.firstName}
      Last Name: ${contact.lastName}
      Company: ${contact.company?.name || 'N/A'}
      Public Info: ${contact.company?.publicInfo || 'N/A'}
      Capabilities: ${Array.isArray( contact.company?.capabilities )
          ? contact.company.capabilities.join( ', ' )
          : contact.company?.capabilities || 'N/A'
        }
      Title: ${contact.profession || 'N/A'}
      Personal Location(s): ${location || 'N/A'}
      Business Location(s): ${businessLocation || 'N/A'}
      Notes: ${notes || 'N/A'}
      `.trim();

      let fullPrompt = '';

      if ( userPrompt ) {
        fullPrompt += `The following email was sent to the user: 
      ${userPrompt}`;
      }

      fullPrompt += ` Context: The user is on the landing page deciding whether to purchase TODD. They clicked a link from the email to get here and are now weighing their options.
      Visitor source: ${this.visitContext.sourceLabel}
      Visitor channel: ${this.visitContext.channel}
      Interest area: ${this.visitContext.interestLabel}

      Create a personalized compelling message using your best powers of persuasion.

      Skip the small talk. Speak directly. Since this is a landing page, DO NOT mention their name, we don't want to sound creepy.

      No “hello,” no signoff. Make it scannable and persuasive, like a calm push from a smart friend. Encourage them to book a demo if they're not ready to buy.

      The following is a little about the person viewing the page for context: 
      ${contactSummary}
      `.trim();

      // Add JSON instruction to fullPrompt
      fullPrompt += `
      Return only a JSON object in this structure:
      {
        "headingA": "...",
        "headingB": "...",
        "subheading": "...",
        "bullet1": "...",
        "bullet2": "...",
        "audienceDescription": "...",
        "finalAppeal": "...",
        "finalAppealSub": "...",
        "heading2": "...",
        "subHeading2": "...",
        "heading3": "...",
        "subHeading3": "...",
        "heading4": "...",
        "subHeading4": "...",
        "heading5": "...",
        "subHeading5": "...",
        "heading6": "...",
        "subHeading6": "...",
        "image1": "...",
        "image2": "...",
        "image3": "...",
        "image4": "...",
        "image5": "...",
        "image6": "...",
        "emotionalAppeal": "..."
      }

      Guidelines:
      - bullet1 and bullet2 should be short, standalone benefits. No colons. No long sentences.
      - Avoid verbs like “Enjoy” or “Experience.” Just state the benefit.
      - Never use “site” as a verb.
      - Use a persuasive tone—calm, direct, and modern. No hype.
      - finalAppeal should be a single strong CTA (e.g., “Book a demo,” “Try TODD today”).
      - finalAppealSub is the emotional backup. Think relief, clarity, time saved.
      - Each heading/subheading pair (1 through 6) should stack like a narrative—build tension, then shift toward relief.
      - Assume everything will be scanned, not read. Make it punchy.
      - emotionalAppeal is a short HTML story that appears when users try to leave. Speak to fear of dropping the ball, lost deals, or burnout. Avoid cliches.
      - All text will be used in a UI—not a paragraph. No intros or wrap-up needed.
      
      `;

      this.openAISubscription = this.openAIService
        .getAssistance( fullPrompt, 'general', 'homePage', null )
        .subscribe( {
          next: ( res: any ) => {
            this.logger.log( "Personal Message", res );
            let raw = res?.response || res;

            if ( typeof raw === 'string' && raw.trim().startsWith( 'html' ) ) {
              raw = raw.trim().replace( /^html\s*/i, '' );
            }

            try {
              const adJson = typeof raw === 'string' ? JSON.parse( raw ) : raw;
              this.showAd = false;
              setTimeout( () => {
                this.selectedAd = applyVisitContextToAd( {
                  heading: adJson.headingA || '',
                  subheading: adJson.subheading || '',
                  bullet1: adJson.bullet1 || '',
                  bullet2: adJson.bullet2 || '',
                  finalAppeal: adJson.finalAppeal || '',
                  finalAppealSub: adJson.finalAppealSub || '',
                  image1: adJson.image1 || '',
                  heading2: adJson.heading2 || '',
                  subHeading2: adJson.subHeading2 || '',
                  image2: adJson.image2 || '',
                  heading3: adJson.heading3 || '',
                  subHeading3: adJson.subHeading3 || '',
                  image3: adJson.image3 || '',
                  heading4: adJson.heading4 || '',
                  subHeading4: adJson.subHeading4 || '',
                  image4: adJson.image4 || '',
                  heading5: adJson.heading5 || '',
                  subHeading5: adJson.subHeading5 || '',
                  image5: adJson.image5 || '',
                  heading6: adJson.heading6 || '',
                  subHeading6: adJson.subHeading6 || '',
                  image6: adJson.image6 || ''
                }, this.visitContext );
                this.showAd = true;
                this.rebuildLandingSections();
                this.cd.detectChanges();
                window.scrollTo( 0, 0 );

              }, 300 ); // match your fade time
              this.logger.info( "Personalized ad applied:", this.selectedAd );
            } catch ( parseErr ) {
              this.logger.error( "Failed to parse OpenAI JSON response:", parseErr );
              this.aiResponse = raw; // fallback to raw HTML if parsing fails
            }

            this.isLoading = false;
            this.cd.detectChanges();
          },
          error: ( err ) => {
            this.logger.error( 'OpenAI response error:', err );
          }
        } );
    } catch ( error ) {
      this.logger.error( "Error generating personalized message" );
    }
  }

  getRandomAd () {
    const keys = Object.keys( ads );
    const randomKey = keys[Math.floor( Math.random() * keys.length )];
    return ads[randomKey];
  }

  getWeightedAd () {
    const entries = Object.entries( this.adStats );
    if ( entries.length === 0 ) return this.getRandomAd();

    const weightedList: string[] = [];

    entries.forEach( ( [key, count] ) => {
      const weight = Math.min( count, 10 ); // cap weight
      for ( let i = 0; i < weight; i++ ) {
        weightedList.push( key );
      }
    } );

    const randomKey = weightedList[Math.floor( Math.random() * weightedList.length )];
    return ads[randomKey] || this.getRandomAd();
  }

  askInitialQuestion ( question: string ) {
    try {
      this.assistantBoxRef.assistantPrompt = question;
      if ( this.assistantBoxRef.inputRef?.nativeElement ) {
        this.assistantBoxRef.inputRef.nativeElement.value = question;
      }
      this.assistantBoxRef.incrementQuestionCount();

      this.assistantBoxRef.askAssistant();
    } catch ( error ) {
      this.logger.info( "Error Asking Initial Question" );
    }


  }

  startAgain ( prompt: string ): void {
    this.assistantBoxRef.resetQuestionCout();
    this.askAssistant( prompt );
  }


  askAssistant ( prompt: string ) {
    this.safeLogEvent( 'ask_assistant', { prompt } );

    this.assistantBoxRef.assistantPrompt = prompt;
    this.assistantBoxRef.incrementQuestionCount();
    this.assistantBoxRef.askAssistant();
    window.scrollTo( 0, 0 );
  }

  onAccordiooClick ( accordionItem: string ) {
    this.safeLogEvent( 'accordion', { accordionItem } );

  }

  buttonClick () {
    this.markClicked();
    this.soundService.playSound( "click" );
  }

  // ─── Insight experiment ───────────────────────────────────────────────────

  private initInsightExperiment (): void {
    if ( !isPlatformBrowser( this.platformId ) ) return;

    const VARIANT_KEY = 'todd_insight_variant';
    const SESSION_KEY = 'todd_insight_session_id';

    try {
      const stored = sessionStorage.getItem( VARIANT_KEY );
      this.insightVariantKey = ( stored === '0' || stored === '1' )
        ? Number( stored )
        : Math.floor( Math.random() * 2 );
      sessionStorage.setItem( VARIANT_KEY, String( this.insightVariantKey ) );
    } catch {
      this.insightVariantKey = Math.floor( Math.random() * 2 );
    }
    this.insight = this.insights[this.insightVariantKey];
    this.rebuildLandingSections();

    try {
      let sid = sessionStorage.getItem( SESSION_KEY );
      if ( !sid ) {
        sid = `is_${Date.now()}_${Math.random().toString( 36 ).slice( 2, 9 )}`;
        sessionStorage.setItem( SESSION_KEY, sid );
      }
      this.sessionId = sid;
    } catch {
      this.sessionId = `is_${Date.now()}_fallback`;
    }

    this.experimentStartedAt = Date.now();
    this.logInsightEvent( 'insight_experiment_viewed' );

    this.scrollHandler = () => {
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      if ( total > 0 ) {
        const depth = Math.round( ( scrolled / total ) * 100 );
        if ( depth > this.maxScrollDepth ) {
          this.maxScrollDepth = depth;
          if ( this.maxScrollDepth >= 50 ) this.markEngaged();
        }
      }
    };
    window.addEventListener( 'scroll', this.scrollHandler, { passive: true } );
    window.addEventListener( 'pagehide', this.pageHideHandler );

    this.thirtySecondTimer = setTimeout( () => this.markEngaged(), 30_000 );
  }

  private markEngaged (): void {
    if ( this.experimentEngaged ) return;
    this.experimentEngaged = true;
    this.logInsightEvent( 'insight_experiment_engaged' );
  }

  private markClicked (): void {
    if ( !this.experimentClicked ) {
      this.experimentClicked = true;
      this.logInsightEvent( 'insight_experiment_clicked' );
    }
    this.markEngaged();
  }

  private fireInsightExitEvent (): void {
    if ( this.insightExitFired || !isPlatformBrowser( this.platformId ) ) return;
    this.insightExitFired = true;

    const snap = this.route.snapshot;
    const utmContext = {
      utm_source: snap.queryParamMap.get( 'utm_source' ) || '',
      utm_medium: snap.queryParamMap.get( 'utm_medium' ) || '',
      utm_campaign: snap.queryParamMap.get( 'utm_campaign' ) || '',
      utm_content: snap.queryParamMap.get( 'utm_content' ) || '',
      utm_term: snap.queryParamMap.get( 'utm_term' ) || '',
      ad: snap.queryParamMap.get( 'ad' ) || '',
      audience: snap.queryParamMap.get( 'audience' ) || ''
    };

    const timeOnPageMs = Date.now() - this.experimentStartedAt;
    const payload: any = {
      eventType: 'insight_experiment_exit',
      insight: this.insight,
      insightVariantKey: this.insightVariantKey,
      sessionId: this.sessionId,
      timeOnPageMs,
      maxScrollDepth: this.maxScrollDepth,
      clicked: this.experimentClicked,
      engaged: this.experimentEngaged,
      hardBounce: timeOnPageMs < 10_000 && !this.experimentEngaged,
      softBounce: timeOnPageMs < 30_000 && !this.experimentEngaged,
      pageUrl: window.location.href,
      referrer: document.referrer,
      startedAt: this.experimentStartedAt,
      timestamp: Date.now(),
      source: this.visitContext?.sourceLabel || '',
      campaign: this.visitContext?.campaign || '',
      selectedAdHeading: this.selectedAd?.heading || '',
      device: window.innerWidth < 768 ? 'mobile' : 'desktop',
      ...utmContext
    };

    this.safeLogEvent( 'insight_experiment_exit', {
      insightVariantKey: this.insightVariantKey,
      timeOnPageMs,
      hardBounce: payload.hardBounce,
      softBounce: payload.softBounce
    } );

    this.dataService.addKnownTenantDocument(
      'AD_ENGAGEMENTS', payload, 'landing-page4', environment.taliferroTenantId
    ).catch( () => { } );
  }

  private logInsightEvent ( eventName: string ): void {
    if ( !this.sessionId ) return;
    try {
      const snap = this.route.snapshot;
      const isBrowser = isPlatformBrowser( this.platformId );
      const payload: any = {
        eventType: eventName,
        insight: this.insight,
        insightVariantKey: this.insightVariantKey,
        sessionId: this.sessionId,
        pageUrl: isBrowser ? window.location.href : '',
        referrer: isBrowser ? document.referrer : '',
        startedAt: this.experimentStartedAt,
        timestamp: Date.now(),
        utm_source: snap.queryParamMap.get( 'utm_source' ) || '',
        utm_medium: snap.queryParamMap.get( 'utm_medium' ) || '',
        utm_campaign: snap.queryParamMap.get( 'utm_campaign' ) || '',
        utm_content: snap.queryParamMap.get( 'utm_content' ) || '',
        utm_term: snap.queryParamMap.get( 'utm_term' ) || '',
        ad: snap.queryParamMap.get( 'ad' ) || '',
        audience: snap.queryParamMap.get( 'audience' ) || '',
        source: this.visitContext?.sourceLabel || '',
        campaign: this.visitContext?.campaign || '',
        selectedAdHeading: this.selectedAd?.heading || '',
        device: isBrowser ? ( window.innerWidth < 768 ? 'mobile' : 'desktop' ) : ''
      };

      this.safeLogEvent( eventName, {
        insight: this.insight,
        insightVariantKey: this.insightVariantKey,
        sessionId: this.sessionId
      } );

      this.dataService.addKnownTenantDocument(
        'AD_ENGAGEMENTS', payload, 'landing-page4', environment.taliferroTenantId
      ).then( () => this.logger.info( `Insight event: ${eventName}` ) )
        .catch( err => this.logger.error( `logInsightEvent failed: ${eventName}`, err ) );
    } catch ( error ) {
      this.logger.error( 'logInsightEvent error', error );
    }
  }


  onLinkClick ( linkName: string, href: string, newTab: boolean = false ) {
    try {
      this.isLoading = true;
      this.safeLogEvent( `link_click_${linkName}`, { href } );

      if ( newTab ) {
        this.logAdEngagement( 'click', linkName );
        window.open( href, '_blank' );
        this.isLoading = false;
      } else {
        this.logAdEngagement( 'view', linkName, performance.now() - this.adStartTime );
        setTimeout( () => {
          window.location.href = href;
        }, 100 );
      }
    } catch ( error ) {
      this.logger.error( "Error Logging Event" );
    }
  }


  scrollToPricing () {
    const el = document.getElementById( 'pricing' );
    if ( el ) {
      el.scrollIntoView( { behavior: 'smooth', block: 'start' } );
    }
  }

  onSubmit () {
    try {
      const recaptchaResponse = ( window as any ).grecaptcha.getResponse();

      if ( recaptchaResponse.length === 0 ) {
        this.notificationService.show( "Error", "Please complete the reCAPTCHA verification.", "error" );
        return;
      }

      if ( this.contactForm.invalid ) {
        this.notificationService.show( "Error", "Please fill out all required fields correctly.", "error" );
        return;
      }

      const contactData = this.contactForm.value;
      this.contact.firstName = contactData.firstName;
      this.contact.lastName = contactData.lastName;
      this.contact.email = contactData.email;
      this.contact.status = "Lead Generation";
      this.contact.category = "TODD";
      this.contact.acquisitionSource = `${this.visitContext?.sourceLabel || 'Direct'} landing`;
      this.contact.company = { name: contactData.companyName };
      this.contact.notes = this.contact.notes || [];
      this.contact.phoneNumbers = [{ phoneNumberType: 'work', phoneNumber: contactData.phoneNumber }];
      this.contact.emailAddresses = [{ emailAddress: contactData.email, emailAddressType: 'work', blocked: false }];

      const tenantId = environment.taliferroTenantId;
      const user = 'TaliferroTechTODDPage';

      const proceedWithEmail = ( knownContact: boolean ) => {
        const userName = `${this.contact.firstName} ${this.contact.lastName}`;
        const company = this.contact.company?.name || '';
        const prompt = knownContact
          ? `Write a short friendly email in HTML as if you're following up with a familiar contact named ${userName} from ${company}. They just submitted a form to reconnect. Make it feel like a smart friend replying back...  --- Important: Use the following real details in the email:
            - Name: Ty Showers
            - Position: Partner
            - Company: Taliferro Tech

            Do not use placeholders like [Your Name] or [Your Company]. Write as if the message is ready to send as-is.
            Return only valid HTML—no intro, no commentary, and do NOT begin with the word "html" or any labels.`
          : `Write a short persuasive HTML email to someone named ${userName} from ${company} who just submitted a contact form but we don't know yet... --- Important: Use the following real details in the email:
            - Name: Ty Showers
            - Position: Partner
            - Company: Taliferro Tech

            Do not use placeholders like [Your Name] or [Your Company]. Write as if the message is ready to send as-is.
            Return only valid HTML—no intro, no commentary, and do NOT begin with the word "html" or any labels.`;

        this.openAIService.getAssistance( prompt, 'general', 'homePage', null ).subscribe( {
          next: ( res: any ) => {
            const body = typeof res?.response === 'string' ? res.response : res;
            const html = body.replace( /^html\s*/i, '' ).trim();

            const email: Email = {
              to: this.contact.email,
              cc: 'support@taliferro.tech',
              subject: knownContact ? 'Great to hear from you again' : 'Thanks for reaching out!',
              text: html.replace( /<[^>]+>/g, '' ),
              html,
              textAsHtml: html,
              contactName: this.contact.firstName,
              from: 'ty.showers@taliferro.tech'
            };

            if ( this.shouldSendEmail() ) {
              this.emailService.sendEmail( email, tenantId, 'TODD' ).subscribe( () => {
                localStorage.setItem( 'toddEmailSentAt', Date.now().toString() );
              } );
            }
          },
          error: ( err ) => this.logger.error( "OpenAI email generation failed:", err )
        } );

        this.notificationService.show( "Success", `Thank you, we'll be in touch.`, 'success' );
        this.contactForm.reset();
        ( window as any ).grecaptcha.reset();
        this.showForm = false;
        this.showExitIntentModal = false;
      };

      if ( this.contact?.id ) {
        proceedWithEmail( true );
      } else {
        this.dataService.checkIfExistsUsingKnownTenant( contactData.email, tenantId ).then( existingRef => {
          if ( existingRef ) {
            proceedWithEmail( true );
          } else {
            this.dataService.addKnownTenantDocument( 'CONTACTS', this.contact, user, tenantId ).then( () => {
              proceedWithEmail( false );
            } ).catch( error => {
              this.logger.error( "Error adding document:", error );
              this.notificationService.show( "Error", `Error adding document: ${error}`, 'error' );
            } );
          }
        } );
      }
    } catch ( error ) {
      this.logger.error( "Error processing form:", error );
    }
  }


  navigate ( route: string ): void {
    const [path, fragment] = route.split( '#' );
    this.router.navigate( [path], { fragment } );

  }

  onAssistantRoute ( event: { path: string, queryParams?: any, fragment?: string; } ) {
    this.router.navigate( [event.path], {
      queryParams: event.queryParams,
      fragment: event.fragment
    } );
  }

  handleAssistantAction ( { action, param }: { action: string, param: any; } ) {
    return;
  }

  handleRevenueLoss ( lossData: any ) {
    try {
      this.logger.info( "Revenue Loss Data", lossData );
      this.sendEmailNotification( lossData );

      this.showForm = true;

      setTimeout( () => {
        this.recaptchaVerifier = new RecaptchaVerifier( this.authService.auth, 'recaptcha-container', {
          'size': 'normal',
          'callback': ( response: string ) => {
            this.recaptchaVerified = true;
            this.notificationService.show( "Success", "Verification Success", "success" );
            this.logger.info( "reCAPTCHA verified:", response );
          },
          'expired-callback': () => {
            this.notificationService.show( "Error", "reCAPTCHA error", "error" );
            this.logger.error( "reCAPTCHA error - expired-callback" );
          }
        } );

        this.recaptchaVerifier.render().catch( error => {
          this.logger.error( "reCAPTCHA render error:", error );
          this.notificationService.show( "Error", "reCAPTCHA render error:" + error, "error" );
        } );

      }, 1000 );


      setTimeout( () => {
        const formElement = document.querySelector( '.contact-form-box' );
        if ( formElement ) {
          formElement.scrollIntoView( { behavior: 'smooth', block: 'start' } );
        }
      }, 300 );
    } catch ( error ) {

    }


  }

  private sendEmailNotification ( event: string ) {
    try {
      const formattedEvent = this.formatEvent( event );

      let email: Email = {
        to: 'ty.showers@gmail.com',
        cc: 'support@taliferro.tech',
        bcc: '',
        subject: 'Home Page Activity',
        text: formattedEvent,
        html: `<pre>${formattedEvent}</pre>`,
        textAsHtml: formattedEvent,
        contactName: 'Ty',
        from: 'ty.showers@taliferro.tech',
      };

      if ( this.shouldSendEmail() ) {
        this.sendSubscription = this.emailService.sendEmail( email, environment.taliferroTenantId, 'TODD' ).subscribe( response => {
          this.logger.info( "Send Response:", response );
          localStorage.setItem( 'toddEmailSentAt', Date.now().toString() );
        } );
      }
    } catch ( error ) {
      this.logger.error( "Error sending email" );
    }
  }

  private shouldSendEmail (): boolean {
    const sentAt = localStorage.getItem( 'toddEmailSentAt' );
    if ( !sentAt ) return true;
    const lastSent = parseInt( sentAt, 10 );
    const hoursSince = ( Date.now() - lastSent ) / ( 1000 * 60 * 60 );
    return hoursSince > 48;
  }

  private formatEvent ( event: any ): string {
    if ( !event ) return 'No event data.';

    if ( typeof event === 'string' ) {
      return event;
    }

    try {
      return JSON.stringify( event, null, 2 ); // Pretty-print if it's an object
    } catch ( err ) {
      return String( event );
    }
  }

  handleExitIntent = ( e: MouseEvent ) => {
    try {
      if (
        ( e.relatedTarget === null || ( e as any ).toElement === null ) &&
        e.clientY <= 0 &&
        !this.showExitIntentModal &&
        !this.exitIntentDismissed &&
        !this.isLoggedIn
      ) {
        this.showExitIntentModal = true;
        this.exitAppeal = this.exitIntentContent.body;
        this.logAdEngagement( 'click', 'exit_intent_shown' );
        this.cd.detectChanges();
        this.showForm = false;
        if ( this.shouldSendEmail() && this.contact && this.contact.email ) {
          const prompt = `
          Write a short HTML email (under 120 words) that speaks to someone who visited our website about TODD but is leaving without taking action. 
          Make it deep and human—skip the typical sales pitch. 
          Focus on a lesser-known benefit like reduced decision fatigue, cognitive offloading, or the emotional relief of not dropping the ball. 
          Avoid cliches. 
          Make them feel seen, not sold.
          Return only the HTML, no intro or explanation.  --- Important: Use the following real details in the email:
          - Name: Ty Showers
          - Position: Partner
          - Company: Taliferro Tech

          Do not use placeholders like [Your Name] or [Your Company]. Write as if the message is ready to send as-is.
          Return only valid HTML—no intro, no commentary, and do NOT begin with the word "html" or any labels.
          For context, we are sending the email to this contact: ${JSON.stringify( this.contact )}
          `;

          this.openAIService.getAssistance( prompt, 'general', 'homePage', null ).subscribe( {
            next: ( res: any ) => {
              const html = typeof res?.response === 'string' ? res.response.trim() : '';
              const email: Email = {
                to: this.contact.email, // fallback if we don't have their email
                cc: 'support@taliferro.tech',
                subject: 'A quiet nudge before you go',
                html,
                text: html.replace( /<[^>]+>/g, '' ),
                textAsHtml: html,
                contactName: this.contact.firstName || '',
                from: 'ty.showers@taliferro.tech'
              };

              this.emailService.sendEmail( email, environment.taliferroTenantId, 'TODD' ).subscribe( () => {
                localStorage.setItem( 'toddEmailSentAt', Date.now().toString() );
              } );
            },
            error: ( err ) => this.logger.error( "OpenAI exit email generation failed", err )
          } );
        }
      }
    } catch ( error ) {

    }
  };

  toggleFormPopup ( show: boolean ) {
    try {
      this.showExitIntentModal = show || this.showExitIntentModal;
      this.showForm = show;
      this.recaptchaVerified = false;
      if ( !show ) {
        this.exitAppeal = null;
      }

      if ( show ) {
        try {
          // If a verifier already exists, clear it so we can re-render safely.
          if ( this.recaptchaVerifier ) {
            ( this.recaptchaVerifier as any ).clear?.();
            this.recaptchaVerifier = undefined as any;
          }
          const container = document.getElementById( 'recaptcha-container' );
          if ( container ) container.innerHTML = '';
        } catch ( e ) {
          // no-op
        }
        setTimeout( () => {
          this.recaptchaVerifier = new RecaptchaVerifier( this.authService.auth, 'recaptcha-container', {
            'size': 'normal',
            'callback': ( response: string ) => {
              this.recaptchaVerified = true;
              this.notificationService.show( "Success", "Verification Success", "success" );
              this.logger.info( "reCAPTCHA verified:", response );
            },
            'expired-callback': () => {
              this.recaptchaVerified = false;
              this.notificationService.show( "Error", "reCAPTCHA expired, please try again.", "error" );
            }
          } );

          this.recaptchaVerifier.render().catch( error => {
            this.logger.error( "reCAPTCHA render error:", error );
            this.notificationService.show( "Error", "reCAPTCHA render error:" + error, "error" );
          } );
        }, 350 ); // wait for DOM to update
      } else {
        // Closing: clean up verifier + widget so reopening works.
        try {
          if ( this.recaptchaVerifier ) {
            ( this.recaptchaVerifier as any ).clear?.();
            this.recaptchaVerifier = undefined as any;
          }
          const container = document.getElementById( 'recaptcha-container' );
          if ( container ) container.innerHTML = '';
          if ( ( window as any ).grecaptcha?.reset ) {
            ( window as any ).grecaptcha.reset();
          }
        } catch ( e ) {
          // no-op
        }
      }
    } catch ( error ) {
      this.logger.warn( "Pop Form not stable", error );
    }
  }

  dismissExitIntentModal (): void {
    this.showExitIntentModal = false;
    this.showForm = false;
    this.exitIntentDismissed = true;
    this.exitAppeal = null;
  }

  openExitIntentForm (): void {
    this.toggleFormPopup( true );
  }

  bookExitIntentMeeting (): void {
    this.buttonClick();
    this.logAdEngagement( 'click', 'exit_intent_book_meeting' );
    window.open( 'https://calendar.app.google/Z4zHCJ8Xq3EuwTPd9', '_blank', 'noopener,noreferrer' );
  }

  get showJourneyBanner (): boolean {
    return this.visitContext.personalizationMode !== 'default';
  }

  get journeyPromptLabel (): string {
    switch ( this.visitContext.source ) {
      case 'linkedin':
        return 'Show me the operating model';
      case 'google':
      case 'bing':
      case 'search':
        return 'Explain the scam';
      case 'instagram':
      case 'threads':
        return 'Show me the short version';
      case 'email':
        return 'Continue the conversation';
      default:
        return this.visitContext.interestArea !== 'general'
          ? `Show me ${this.visitContext.interestLabel}`
          : 'Show me the fit';
    }
  }

  private resolveVisitContext (): LandingPage4VisitContext {
    return resolveLandingPage4VisitContext( {
      source: this.route.snapshot.queryParamMap.get( 'source' ),
      utm_source: this.route.snapshot.queryParamMap.get( 'utm_source' ),
      channel: this.route.snapshot.queryParamMap.get( 'channel' ),
      utm_medium: this.route.snapshot.queryParamMap.get( 'utm_medium' ),
      campaign: this.route.snapshot.queryParamMap.get( 'campaign' ),
      utm_campaign: this.route.snapshot.queryParamMap.get( 'utm_campaign' ),
      audience: this.route.snapshot.queryParamMap.get( 'audience' ),
      ref: this.route.snapshot.queryParamMap.get( 'ref' ),
      destination: this.route.snapshot.queryParamMap.get( 'destination' ),
      emailId: this.route.snapshot.queryParamMap.get( 'emailId' ),
      tenantId: this.route.snapshot.queryParamMap.get( 'tenantId' )
    }, document.referrer || '' );
  }

  private resolveJourneyTenantId (): string {
    return this.visitContext?.tenantId || environment.taliferroTenantId;
  }

  private resolveAudienceAdKey ( requestedAudience: string ): string {
    const normalizedAudience = String( requestedAudience || '' ).trim().toLowerCase();
    if ( !normalizedAudience ) {
      return '';
    }

    return Object.keys( ads ).find( key => key.toLowerCase() === normalizedAudience ) || '';
  }


}
