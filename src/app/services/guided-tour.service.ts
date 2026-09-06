import { Injectable } from '@angular/core';
import { Params, Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { LoggerService } from './logger.service';

interface TourStep {
  route?: string;
  queryParams?: Params;
  title: string;
  instruction: string;
  summary?: string;
  expression?: 'neutral' | 'excited' | 'curious' | 'confused' | 'serious';
  image?: string;
  caption?: string;
  targetSelector?: string;
}

@Injectable( {
  providedIn: 'root'
} )
export class GuidedTourService {


  private currentTourSteps: TourStep[] = [];

  overlayImage$ = new BehaviorSubject<string | null>( null );

  private matchMakerSteps: TourStep[] = [
    {
      route: '',
      title: "Welcome to the Match Maker Tour",
      instruction: `
    <p class="text-left mb-3">
      Match Maker is TODD's AI-powered engine for connecting the right people, companies, or resources — based on logic you define.
    </p>
    <p class="text-left">
      You decide what kind of match you want to make:
    </p>
    <ul class="text-left">
      <li>Match <strong>prime contractors</strong> with certified subcontractors</li>
      <li>Match <strong>investors</strong> with qualified companies</li>
      <li>Match <strong>local stores</strong> with high-demand products</li>
      <li>Match <strong>partners</strong> with relevant grantees</li>
      <li>Match <strong>mentors</strong> to mentees</li>
      <li>Match <strong>buyers</strong> with suppliers</li>
    </ul>
  `,
      summary: `Next: Customization.`,
      expression: 'excited'
    },
    {
      route: '',
      title: "Fully Customizable",
      instruction: `
    <p class="text-left mt-3">
      Match Maker is fully configurable — but the magic is in how TODD evaluates each match, scores them, and explains <strong>why</strong> it made those choices.
    </p>
    <p class="text-left">
      Whether you're running a business center, managing funding pipelines, or coordinating outreach, Match Maker helps you move faster — with clarity.
    </p>
  `,
      summary: `Next: A real-world example of Match Maker in action.`,
      expression: 'excited'
    },
    {
      route: '/match-maker',
      queryParams: { step: '1' },
      title: 'An example walkthrough: How would an Investor Use TODD?',
      instruction: `
      <p class="mb-3">An investor uses TODD to find diverse, early-stage companies aligned with their investment objective.</p>
        `,
      summary: `<p class="text-left"><strong>Step 1: Identify the Interested Party</strong>
        </p>`
    },
    {
      route: '/match-maker',
      queryParams: { step: '2' },
      title: 'Step 2',
      instruction: `<p class="text-left"><strong>Step 2: Set Geographic Focus</strong></p>`,
      summary: ``
    },
    {
      route: '/match-maker',
      queryParams: { step: '3' },
      title: 'Step3',
      instruction: `
        <p class="text-left"><strong>Step 3: Define Investment Criteria</strong></p>`,
      summary: ``
    },
    {
      route: '/match-maker',
      queryParams: { step: '4' },
      title: 'Step 4',
      instruction: `
        <p class="text-left"><strong>Step 4: Get Scored Matches with Justification</strong>
        </p>
        `,
      summary: `<p class="text-left"><strong>Step 5: Take Action Immediately</strong>
        </p><p class="text-left">The Investor finds the ones that actually align with their investment goals. Fast. Accurate. Scored.</p>`
    },
  ];


  private useCaseSteps: TourStep[] = [
    {
      route: '',
      title: 'Why TODD Exists',
      instruction: `
        <p class="text-left">Most tools store data. TODD creates momentum.</p>
        <p class="text-left">Before stacks and reports, work is messy — scattered contacts, half-started deals, missed follow-ups. TODD is a Momentum System built for that stage. Not to record it. To move it.</p>
      `,
      summary: 'Tired of staring at stale lists?',
      image: '/assets/images/orm.png'
    },
    {
      route: '',
      title: 'Not CRM. Not Outreach. A Momentum System.',
      instruction: `
        <p class="text-left">CRMs take notes. Outreach tools blast messages.</p>
        <p class="text-left">TODD is a Momentum System — it acts across apps to draft, nudge, validate, and route work so you keep moving.</p>
      `,
      summary: 'Why juggle five tools to start one conversation?',
      image: '/assets/images/reseller-telecom.webp'
    },
    {
      route: '',
      title: 'What TODD Actually Does',
      instruction: `
      <p class="text-left">Outreach shouldn’t feel like juggling knives. TODD handles the prep and the next moves so you handle the conversation.</p>
        <ul class="text-left">
          <li>Enriches and reconfigures contact & company data</li>
          <li>Validates emails and flags risk before you send</li>
          <li>Drafts proposals and documents from RFPs</li>
          <li>Creates <strong>Moves</strong> (tasks) tied to outcomes</li>
          <li>Captures knowledge and links it to people and work</li>
          <li>Equity-aware matching and selection defaults</li>
        </ul>
      `,
      summary: "It's not just contact management. It's a Momentum System.",
      image: "/assets/images/settings.webp"
    },
    {
      route: '',
      title: 'TODD in Plain English',
      instruction: `
        <p class="text-left">CRMs assume you’ve already got clean leads. A Momentum System assumes you’re still hunting, cleaning, validating, matching, and following up — and it does that work with you.</p>
      `,
      summary: 'Most people start with a CRM. You actually start earlier.',
      image: "/assets/images/todd-screenshot1.webp"
    },
    {
      title: 'Matchmaking Primes with Subs for State Contracts',
      instruction: `
      <p>A Business Center uses TODD to match large prime contractors with qualified DBE/MBE subs based on project needs, location, and certification — helping meet equity goals for public sector contracts.</p>
      <ul>
        <li><strong>Step 1:</strong> Enter the prime's name and website</li>
        <li><strong>Step 2:</strong> Drop a pin near the project location</li>
        <li><strong>Step 3:</strong> Choose match filters like certification, capability, and region</li>
        <li><strong>Step 4:</strong> TODD returns a scored list of potential subs with justification</li>
        <li><strong>Step 5:</strong> Export the list or begin outreach for Meet the Primes</li>
      </ul>
    `,
      summary: "Because equity goals don’t fulfill themselves. TODD finds certified subs that actually fit.",
      image: "/assets/images/contact-profile.webp"

    },
    {
      title: 'Prepping for Outreach Without the Headache',
      instruction: `
      <p>A business wants to email 200 leads, but their contact data is a mess.</p>
      <p><strong>What TODD Does:</strong></p>
      <ul>
        <li>Auto-detects and merges duplicates</li>
        <li>Fills in missing info from public sources</li>
        <li>Validates email addresses</li>
        <li>Generates email drafts with segmented messaging</li>
        <li>Preps the campaign list in under an hour</li>
      </ul>
    `,
      summary: "You shouldn’t need an ops team to send 200 emails. TODD makes messy lists usable and campaigns feel effortless.",
      image: "/assets/images/contacts-in-california.webp"

    },
    {
      title: 'Following Up Without Losing Momentum',
      instruction: `
      <p>A small team is managing dozens of conversations and losing track of follow-ups.</p>
      <p><strong>What TODD Does:</strong></p>
      <ul>
        <li>Watches email replies and contact activity</li>
        <li>Creates tasks when conversations stall</li>
        <li>Surfaces neglected high-value contacts</li>
        <li>Builds a daily follow-up list automatically</li>
      </ul>
    `,
      summary: "Missed follow-ups = missed deals. TODD watches the gaps so nothing promising falls through.",
      image: "/assets/images/compose-email.webp"


    },
    {
      title: 'Turning Notes Into Next Steps',
      instruction: `
      <p>A founder captures meeting notes but forgets to turn them into tasks.</p>
      <p><strong>What TODD Does:</strong></p>
      <ul>
        <li>Analyzes notes in real time</li>
        <li>Tags the type of meeting (e.g. update, issue, opportunity)</li>
        <li>Suggests tasks with deadlines</li>
        <li>Links tasks to the right contacts or projects</li>
      </ul>
    `,
      summary: "Forget one action item, and the whole meeting was a waste. TODD turns scribbles into next steps—automatically.",
      image: "/assets/images/tasks.webp"

    },
    {
      title: 'Cleaning Up a Legacy Contact List',
      instruction: `
      <p>An org uploads contacts from spreadsheets and old CRMs—it's chaos.</p>
      <p><strong>What TODD Does:</strong></p>
      <ul>
        <li>Standardizes and reconfigures fields</li>
        <li>Fills in missing info using enrichment</li>
        <li>Tags contacts by engagement level</li>
        <li>Flags outdated or unreachable records</li>
      </ul>
    `,
      summary: "Outdated CRMs and CSVs aren’t leads. TODD turns contact chaos into qualified targets.",
      image: "/assets/images/contact-list.webp"

    },
    {
      title: 'Finding the Right Person to Talk To',
      instruction: `
      <p>A team wants to reach out to a company but doesn't know who to start with.</p>
      <p><strong>What TODD Does:</strong></p>
      <ul>
        <li>Uses Match Maker to find decision-makers</li>
        <li>Surfaces shared affiliations and warm leads</li>
        <li>Suggests what to say and when to say it</li>
      </ul>
    `,
      summary: "One name. That’s all you need to get in. TODD tells you who’s behind the curtain.",
      image: "/assets/images/pipeline.webp"

    },
    {
      title: 'Running a Campaign Without Burning Out',
      instruction: `
      <p>A solo operator needs to run a full email campaign and handle replies.</p>
      <p><strong>What TODD Does:</strong></p>
      <ul>
        <li>Writes campaign emails by tone and intent</li>
        <li>Queues messages and shows real-time open stats</li>
        <li>Suggests smart replies for interested leads</li>
        <li>Schedules follow-ups at the right time</li>
      </ul>
    `,
      summary: "You shouldn’t burn out trying to sound strategic. TODD drafts, times, and tracks the entire thing—so you can focus on the wins.",
      image: "/assets/images/todd-on-laptop.webp"

    }
  ];



  private default: TourStep[] = [
    {
      route: '/contact-import',
      title: "Start with Your Contacts",
      instruction: `
<h2 class="text-left">Step 1: Load Your People</h2>
<p class="text-left">TODD needs to know who you're working with. Import a spreadsheet or pull from a CRM if you have one.</p>
<p class="text-left">TODD will clean, merge, and prep the list automatically <b>after import</b>.</p>
`,
      summary: "Next: Control what TODD focuses on",
    },
    {
      route: '/settings',
      title: "Focus on What Matters",
      instruction: `
<h2 class="text-left">Step 2: Trim the Fat</h2>
<p class="text-left">Only turn on the features you need. Outreach, tasks, surveys, messaging—you pick.</p>
<p class="text-left">TODD adapts to your workflow, not the other way around.</p>
`,
      summary: "Next: Let TODD learn your goals",
    },
    {
      route: '/update-profile',
      title: "Tell TODD Who You Are",
      instruction: `
<h2 class="text-left">Step 3: Set Your Profile</h2>
<p class="text-left">What do you offer? Who are you trying to reach?</p>
<p class="text-left">This is how TODD tailors outreach, filters contacts, and scores your pipeline.</p>
`,
      summary: "Next: Unlock messaging tools",
    },
    {
      route: '/compose-email',
      title: "Connect Your Email",
      instruction: `
<h2 class="text-left">Step 4: Connect Securely</h2>
<p class="text-left">We approve the address you’ll use for outreach to protect your domain and deliverability.</p>
<p class="text-left">Email <a href="mailto:support@taliferro.tech">support@taliferro.tech</a> with the sender address you’d like to use.</p>
`,
      summary: "Once approved, you’re ready to message",
    },
    {
      route: '/',
      title: "Ask for Anything",
      instruction: `
<h2 class="text-left">Step 5: Talk to TODD</h2>
<p class="text-left">Type things like:</p>
<ul>
  <li class="text-left"><i>"Find subs with DBE certification in Washington"</i></li>
  <li class="text-left"><i>"Email everyone I met this week"</i></li>
  <li class="text-left"><i>"Which contacts need a follow-up?"</i></li>
</ul>
<p class="text-left">TODD understands, filters, and acts—no clicking around.</p>
`,
      summary: "Next: Create surveys, tasks, and more",
    },
    {
      route: '/tasks',
      title: "Collect, Track, Deliver",
      instruction: `
<h2 class="text-left">Step 6: Run Your Ops</h2>
<p class="text-left">Use TODD to:</p>
<ul>
  <li class="text-left">Create surveys to gather intel or feedback</li>
  <li class="text-left">Assign tasks to follow up or deliver work</li>
  <li class="text-left">Generate proposals and documents automatically</li>
</ul>
<p class="text-left">Everything’s linked to the right contact. Nothing gets lost.</p>
`,
      summary: "Next: Wrap up or go deeper",
    },
    {
      route: '/help',
      title: "You’re Good to Go",
      instruction: `
<h2 class="text-left">TODD’s Set Up and Running</h2>
<p class="text-left">You’ve told TODD who you are, what you want, and who you’re working with.</p>
<p class="text-left">From here, you can:</p>
<ul class="text-left">
  <li class="text-left">Send targeted messages</li>
  <li class="text-left">Draft proposals and track deliverables</li>
  <li class="text-left">Create Moves (tasks) and follow-up sequences</li>
  <li class="text-left">Use MatchMaker for partners, subs, or buyers</li>
  <li class="text-left">Ask TODD to handle the grunt work</li>
</ul>
<p class="text-left">Need help? <a href="https://calendly.com/ty-showers/30min" target="_blank">Book a live walkthrough</a></p>
`,
      summary: "TODD works. You just point it.",
    },



  ];

  private currentStepIndex = 0;
  private tourActive = false;

  constructor ( private router: Router, private logger: LoggerService ) { }

  setTour ( tourName: 'default' | 'conversational' | 'matchmaker' | 'usecase' ): void {
    switch ( tourName ) {
      case 'matchmaker':
        this.currentTourSteps = this.matchMakerSteps;
        break;
      case 'usecase':
        this.currentTourSteps = this.useCaseSteps;
        break;
      default:
        this.currentTourSteps = this.default;
        break;
    }
  }

  getAllSteps (): TourStep[] {
    return this.currentTourSteps;
  }


  startTour (): void {
    this.tourActive = true;
    this.currentStepIndex = 0;
    this.overlayImage$.next( this.currentTourSteps[this.currentStepIndex]?.image || null );
    this.navigateToCurrentStep();
  }

  endTour (): void {
    this.resetTourState();
    this.router.navigate( ['guided-tour'] );
  }

  clearTour (): void {
    this.resetTourState();
  }

  private resetTourState (): void {
    this.tourActive = false;
    this.currentStepIndex = 0;
    this.overlayImage$.next( null );
  }

  nextStep (): void {
    this.logger.info( "Current Step Index", this.currentStepIndex, "Current Tour Steps", this.currentTourSteps.length - 1 );

    if ( this.currentStepIndex < this.currentTourSteps.length - 1 ) {
      this.currentStepIndex++;
      this.logger.info( "GO TO NEXT STEP", this.currentStepIndex );
      this.overlayImage$.next( this.currentTourSteps[this.currentStepIndex]?.image || null );
      this.navigateToCurrentStep();
    }
  }

  isInTour (): boolean {
    return this.tourActive;
  }


  getOverlayImageStream (): Observable<string | null> {
    return this.overlayImage$.asObservable();
  }

  getCurrentInstruction (): string {
    return this.currentTourSteps[this.currentStepIndex]?.instruction || '';
  }

  isCurrentRoute ( route: string ): boolean {
    return this.currentTourSteps[this.currentStepIndex]?.route === route;
  }

  private navigateToCurrentStep (): void {

    const step = this.currentTourSteps[this.currentStepIndex];
    this.logger.info( "NAVIGATE TO CURRENT STEP", step.route );
    if ( step?.route ) {
      this.router.navigate( [step.route], { queryParams: step.queryParams || {} } );
    }
  }

  getCurrentStepIndex (): number {
    return this.currentStepIndex;
  }

  getCurrentStep (): TourStep | undefined {
    return this.currentTourSteps[this.currentStepIndex];
  }

  peekNextStep (): TourStep | undefined {
    const nextIndex = this.currentStepIndex + 1;
    return nextIndex < this.currentTourSteps.length ? this.currentTourSteps[nextIndex] : undefined;
  }

  getCurrentStepSelector (): string | undefined {
    return this.currentTourSteps[this.currentStepIndex]?.targetSelector;
  }

  previousStep (): void {
    if ( this.currentStepIndex > 0 ) {
      this.currentStepIndex--;
      this.overlayImage$.next( this.currentTourSteps[this.currentStepIndex]?.image || null );
      this.navigateToCurrentStep();
    }
  }

}
