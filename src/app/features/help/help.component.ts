import { CommonModule } from '@angular/common';
import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { SeoService } from '../../shared/seo.service';
import { MayaAuthService } from '../../services/maya-auth.service';
import { GettingStarted, GettingStartedService, GettingStartedStep } from '../../services/getting-started.service';

interface HelpStep {
  number: string;
  title: string;
  copy: string;
  details: string[];
}

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './help.component.html',
  styleUrl: './help.component.css',
})
export class HelpComponent implements OnInit {
  /** Signed-in only: the Getting Started checklist, checked off from real data. */
  progress: GettingStarted | null = null;
  showAfterSignIn = true;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor(
    private readonly title: Title,
    private readonly meta: Meta,
    private readonly seo: SeoService,
    private readonly authService: MayaAuthService,
    readonly gettingStarted: GettingStartedService,
  ) {}

  ngOnInit(): void {
    // Help is prerendered for SEO - progress needs the signed-in browser.
    if (this.isBrowser) {
      this.showAfterSignIn = this.gettingStarted.showAfterSignIn;
      this.authService.getUser().subscribe((user) => {
        if (!user) {
          this.progress = null;
          return;
        }
        this.gettingStarted.load().then((progress) => (this.progress = progress)).catch(() => (this.progress = null));
      });
    }
    const pageTitle = 'Help — Maya, Marketing Director';
    const description = 'How to work with Maya: start a session, give direction on message clarity and campaigns, then check Status and Plan to see what she executed.';
    this.title.setTitle(pageTitle);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: pageTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:url', content: 'https://maya.taliferro.tech/help' });
    this.meta.updateTag({ name: 'twitter:title', content: pageTitle });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.seo.setCanonical('https://maya.taliferro.tech/help');
  }

  readonly steps: HelpStep[] = [
    {
      number: '01',
      title: 'Sign in',
      copy: 'Maya needs a signed-in TODD session to track your work and execute on your behalf.',
      details: [],
    },
    {
      number: '02',
      title: 'Start a session',
      copy: 'Talk to Maya the way you would a real Marketing Director — describe the problem, share what you\'ve tried, and ask directly.',
      details: [
        'Maya gives candid feedback on message clarity, campaigns, and audience focus.',
        'Expect pushback if something isn\'t clear yet — that\'s the point.',
      ],
    },
    {
      number: '03',
      title: 'Let Maya execute',
      copy: 'Once direction is set, Maya turns it into actual work instead of leaving you with just a recommendation.',
      details: [],
    },
    {
      number: '04',
      title: 'Check Status',
      copy: 'The Status page is Maya\'s own scorecard: what she finished today, what\'s still open, and what she couldn\'t do.',
      details: [
        'Each item links back to the real record it affected, so you can verify or act on it directly.',
      ],
    },
    {
      number: '05',
      title: 'Review the Plan',
      copy: 'The Plan page shows what\'s queued up next, separate from what\'s already been executed.',
      details: [],
    },
  ];

  toggleShowAfterSignIn(value: boolean): void {
    this.showAfterSignIn = value;
    this.gettingStarted.showAfterSignIn = value;
  }

  trackStep(_index: number, step: GettingStartedStep): string {
    return step.id;
  }

  isExternal(step: GettingStartedStep): boolean {
    return this.gettingStarted.routeFor(step).startsWith('http');
  }
}
