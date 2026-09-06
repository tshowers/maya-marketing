import { AfterViewInit, Component, ElementRef, EventEmitter, Inject, Input, OnChanges, OnDestroy, Output, PLATFORM_ID, SimpleChanges } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { ModuleInstallCtaComponent } from '../module-install-cta/module-install-cta.component';
import { ModuleInstallConfig } from '../../utils/module-install-config.util';

export type AppleTransitionSectionType = 'text' | 'cards' | 'image' | 'video' | 'mediaText' | 'html' | 'cta';
export type AppleTransitionMediaPosition = 'left' | 'right' | 'top' | 'background';
export type AppleTransitionActionVariant = 'primary' | 'secondary';

export interface AppleTransitionAction {
  label: string;
  route?: string;
  href?: string;
  variant?: AppleTransitionActionVariant;
  ariaLabel?: string;
  actionId?: string;
}

export interface AppleTransitionCard {
  eyebrow?: string;
  heading: string;
  body?: string;
  route?: string;
  href?: string;
  actionId?: string;
}

export interface AppleTransitionSection {
  id: string;
  type?: AppleTransitionSectionType;
  showInstallCta?: boolean;
  eyebrow?: string;
  heading?: string;
  body?: string;
  imageUrl?: string;
  imageAlt?: string;
  videoUrl?: string;
  videoPosterUrl?: string;
  embedUrl?: string;
  embedTitle?: string;
  mediaAspectRatio?: string;
  mediaPosition?: AppleTransitionMediaPosition;
  html?: string | SafeHtml;
  cards?: AppleTransitionCard[];
  actions?: AppleTransitionAction[];
  panelClass?: string;
}

type AppleTransitionRenderSection = AppleTransitionSection & {
  trustedEmbedUrl?: SafeResourceUrl | null;
};

@Component( {
  selector: 'app-apple-transition',
  imports: [CommonModule, RouterLink, ModuleInstallCtaComponent],
  templateUrl: './apple-transition.component.html',
  styleUrl: './apple-transition.component.css'
} )
export class AppleTransitionComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() isLoggedIn: boolean = false;
  private gsapContext?: gsap.Context;
  private storyTimeline?: gsap.core.Timeline;
  private storyTrigger?: ScrollTrigger;
  private viewReady = false;
  private isRebuilding = false;
  showScrollIndicator = false;
  private currentVisibleSectionIndex = 0;
  private readonly handleWindowScroll = (): void => {
    if ( !isPlatformBrowser( this.platformId ) ) {
      return;
    }

    const viewportWidth = window.visualViewport?.width || window.innerWidth;
    const isMobile = viewportWidth <= this.mobileBreakpoint
      || window.matchMedia( `(max-width: ${this.mobileBreakpoint}px)` ).matches
      || this.disablePinnedDesktop;

    if ( !isMobile && this.storyTrigger ) {
      this.updateScrollIndicatorVisibility();
      return;
    }

    this.syncScrollIndicatorToCurrentSection();
  };

  private resetStoryDomState (): void {
    if ( !isPlatformBrowser( this.platformId ) ) {
      return;
    }

    const host = this.hostRef.nativeElement;
    const story = host.querySelector<HTMLElement>( '[data-apple-story]' );
    const panels = gsap.utils.toArray<HTMLElement>( '[data-apple-panel]', host );
    const inners = gsap.utils.toArray<HTMLElement>( '.apple-story__inner', host );

    if ( story ) {
      story.style.removeProperty( 'height' );
      story.style.removeProperty( 'min-height' );
      story.style.removeProperty( 'overflow' );
      story.style.removeProperty( 'position' );
      story.classList.remove( 'apple-story--ready' );
    }

    panels.forEach( panel => panel.classList.add( 'is-visible' ) );

    gsap.set( panels, {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      clearProps: 'transform,filter,zIndex,pointerEvents,opacity,visibility'
    } );

    gsap.set( inners, {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      clearProps: 'transform,filter,opacity,visibility'
    } );
  }

  private readonly handlePageShow = ( event: PageTransitionEvent ): void => {
    if ( !isPlatformBrowser( this.platformId ) ) {
      return;
    }

    if ( !event.persisted && document.visibilityState !== 'visible' ) {
      return;
    }

    requestAnimationFrame( () => {
      this.rebuildPinnedStory();
    } );
  };

  private viewportRebuildTimer?: number;
  private readonly scheduleViewportRebuild = (): void => {
    if ( !this.viewReady || !isPlatformBrowser( this.platformId ) ) {
      return;
    }

    window.clearTimeout( this.viewportRebuildTimer );
    this.viewportRebuildTimer = window.setTimeout( () => {
      this.rebuildPinnedStory();
    }, 150 );
  };

  readonly defaultSections: AppleTransitionSection[] = [
    {
      id: 'intro',
      type: 'text',
      eyebrow: 'Outreach',
      heading: 'Start conversations that move work forward.',
      body: 'Maya drafts thoughtful, individual emails and follows up on your behalf. Watch engagement and see what is landing before the work stalls.',
      actions: [
        { label: 'Compose Email', route: '/compose-email', variant: 'primary' },
        { label: 'Open Signal Engine', route: '/signal-engine', variant: 'secondary' }
      ],
      panelClass: 'apple-story__panel--intro'
    },
    {
      id: 'setup',
      type: 'cards',
      eyebrow: 'Setup',
      heading: 'Here’s how to set up Outreach.',
      body: 'Start with identity, then let Maya start drafting personalized outreach to your contacts.',
      cards: [
        { eyebrow: '01', heading: 'Complete your email signature', body: 'Set up sender identity so every email looks professional and trustworthy.' },
        { eyebrow: '02', heading: 'Import your contacts', body: 'Give Maya an audience to draft thoughtful outreach for.' },
        { eyebrow: '03', heading: 'Review Maya\'s drafts', body: 'Approve, edit, or reject what Maya prepares in Signal Engine.' },
        { eyebrow: '04', heading: 'Wait for provisioning', body: 'Build drafts while your sending domain gets approved.' }
      ]
    },
    {
      id: 'workspace',
      type: 'cards',
      eyebrow: 'Workspace',
      heading: 'Explore the Outreach workspace.',
      body: 'Everything connects back to action: compose, drafts, engagement, performance, Signal Engine, and Momentum.',
      cards: [
        { heading: 'Compose', body: 'Write a focused outreach email or follow-up.', route: '/compose-email' },
        { heading: 'Catalyst', body: 'Review signals and find the next useful outreach move.', route: '/email-processor' },
        { heading: 'Signal Engine', body: 'See what Maya drafted, what is queued to send, and what already went out.', route: '/signal-engine' }
      ]
    },
    {
      id: 'first-win',
      type: 'cta',
      eyebrow: 'First win',
      heading: 'Let Maya draft the first email.',
      body: 'Import a few contacts and Maya starts drafting thoughtful, individual outreach automatically - no campaign to build first.',
      actions: [
        { label: 'Import Contacts', route: '/contact-import', variant: 'primary' }
      ],
      panelClass: 'apple-story__panel--focus'
    },
    {
      id: 'use-cases',
      type: 'cards',
      eyebrow: 'Use cases',
      heading: 'What you can do.',
      cards: [
        { eyebrow: 'Write', heading: 'Compose quickly', body: 'Create emails fast so follow-up and proposal motion do not sit in your head.' },
        { eyebrow: 'Draft', heading: 'Let Maya draft', body: 'Maya prepares individual, thoughtful outreach and follow-up automatically.' },
        { eyebrow: 'Measure', heading: 'Read the signal', body: 'Use opens, clicks, and silence to decide what should happen next.' }
      ]
    },
    {
      id: 'momentum',
      type: 'cta',
      eyebrow: 'Momentum',
      heading: 'Let the system keep pressure.',
      body: 'Outbox and Signal Engine keep the thread moving until the relationship converts, stalls, or needs a human touch.',
      actions: [
        { label: 'Open Daily Momentum', route: '/daily-momentum', variant: 'primary' }
      ],
      panelClass: 'apple-story__panel--closing'
    }
  ];

  private _sections: AppleTransitionSection[] = this.defaultSections;
  private renderSections: AppleTransitionRenderSection[] = this.toRenderSections( this.defaultSections );

  @Input()
  set sections ( value: AppleTransitionSection[] | null | undefined ) {
    this._sections = value?.length ? value : this.defaultSections;
    this.renderSections = this.toRenderSections( this._sections );
    this.updateScrollIndicatorVisibility();

    if ( this.viewReady && isPlatformBrowser( this.platformId ) ) {
      requestAnimationFrame( () => this.rebuildPinnedStory() );
    }
  }

  get sections (): AppleTransitionRenderSection[] {
    return this.renderSections;
  }

  @Input() ariaLabel: string | null = null;
  @Input() disablePinnedDesktop = false;
  @Input() mobileBreakpoint = 1200;
  @Input() installConfig: ModuleInstallConfig | null = null;

  @Output() storyAction = new EventEmitter<string>();
  @Output() sectionChange = new EventEmitter<string>();



  constructor (
    private readonly hostRef: ElementRef<HTMLElement>,
    private readonly sanitizer: DomSanitizer,
    @Inject( PLATFORM_ID ) private readonly platformId: object
  ) {
    this.resetScrollIndicator();
  }

  private toRenderSections ( sections: AppleTransitionSection[] ): AppleTransitionRenderSection[] {
    return sections.map( section => ( {
      ...section,
      trustedEmbedUrl: section.embedUrl
        ? this.sanitizer.bypassSecurityTrustResourceUrl( section.embedUrl )
        : null
    } ) );
  }

  ngAfterViewInit (): void {
    if ( !isPlatformBrowser( this.platformId ) ) {
      return;
    }

    gsap.registerPlugin( ScrollTrigger );
    this.viewReady = true;
    this.resetStoryDomState();
    window.addEventListener( 'scroll', this.handleWindowScroll, { passive: true } );
    window.addEventListener( 'resize', this.scheduleViewportRebuild, { passive: true } );
    window.addEventListener( 'pageshow', this.handlePageShow );
    window.addEventListener( 'orientationchange', this.scheduleViewportRebuild, { passive: true } );
    requestAnimationFrame( () => {
      this.rebuildPinnedStory();
    } );
  }

  ngOnChanges ( changes: SimpleChanges ): void {
    if ( !this.viewReady || !isPlatformBrowser( this.platformId ) ) {
      return;
    }

    if ( changes['disablePinnedDesktop'] || changes['mobileBreakpoint'] ) {
      requestAnimationFrame( () => this.rebuildPinnedStory() );
    }
  }

  ngOnDestroy (): void {
    window.clearTimeout( this.viewportRebuildTimer );

    if ( isPlatformBrowser( this.platformId ) ) {
      window.removeEventListener( 'scroll', this.handleWindowScroll );
      window.removeEventListener( 'resize', this.scheduleViewportRebuild );
      window.removeEventListener( 'pageshow', this.handlePageShow );
      window.removeEventListener( 'orientationchange', this.scheduleViewportRebuild );
    }

    this.teardownPinnedStory();
  }

  private rebuildPinnedStory (): void {
    if ( this.isRebuilding || !isPlatformBrowser( this.platformId ) ) {
      return;
    }

    this.isRebuilding = true;
    this.teardownPinnedStory();
    this.resetStoryDomState();
    this.resetScrollIndicator();
    this.setupPinnedStory();
    requestAnimationFrame( () => {
      ScrollTrigger.refresh( true );
      ScrollTrigger.update();
      this.isRebuilding = false;
    } );
  }

  private teardownPinnedStory (): void {
    const host = this.hostRef.nativeElement;
    const story = host.querySelector<HTMLElement>( '[data-apple-story]' );
    const panels = gsap.utils.toArray<HTMLElement>( '[data-apple-panel]', host );
    const inners = gsap.utils.toArray<HTMLElement>( '.apple-story__inner', host );

    this.storyTrigger?.kill();
    this.storyTrigger = undefined;
    this.storyTimeline?.kill();
    this.storyTimeline = undefined;
    this.gsapContext?.revert();
    this.gsapContext = undefined;

    if ( story ) {
      story.classList.remove( 'apple-story--ready' );
    }

    panels.forEach( panel => panel.classList.remove( 'is-visible' ) );

    gsap.set( panels, {
      clearProps: 'all'
    } );

    gsap.set( inners, {
      clearProps: 'all'
    } );
  }

  private setupPinnedStory (): void {



    const host = this.hostRef.nativeElement;
    const story = host.querySelector<HTMLElement>( '[data-apple-story]' );
    const panels = gsap.utils.toArray<HTMLElement>( '[data-apple-panel]', host );
    const inners = gsap.utils.toArray<HTMLElement>( '.apple-story__inner', host );

    if ( !story || panels.length === 0 || inners.length === 0 ) {
      this.showScrollIndicator = false;
      return;
    }

    this.currentVisibleSectionIndex = 0;
    panels[0]?.classList.add( 'is-visible' );

    const prefersReducedMotion = window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
    const viewportWidth = window.visualViewport?.width || window.innerWidth;
    const isMobile = viewportWidth <= this.mobileBreakpoint || window.matchMedia( `(max-width: ${this.mobileBreakpoint}px)` ).matches;

    story.classList.toggle( 'apple-story--mobile', isMobile || this.disablePinnedDesktop );

    if ( isMobile || this.disablePinnedDesktop ) {
      this.setupMobileStaticLayout( story, panels, inners );
      story.classList.add( 'apple-story--ready' );
      this.syncScrollIndicatorToCurrentSection();
      return;
    }


    this.gsapContext = gsap.context( () => {
      if ( prefersReducedMotion ) {
        panels.forEach( panel => panel.classList.add( 'is-visible' ) );
        gsap.set( panels, {
          autoAlpha: 1,
          clearProps: 'transform,filter,zIndex,pointerEvents'
        } );
        gsap.set( inners, {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          filter: 'blur(0px)'
        } );
        story.classList.add( 'apple-story--ready' );
        return;
      }

      panels.forEach( ( panel, index ) => {
        panel.classList.toggle( 'is-visible', index === 0 );
      } );

      gsap.set( panels, {
        autoAlpha: 0,
        zIndex: 1,
        pointerEvents: 'none'
      } );

      gsap.set( panels[0], {
        autoAlpha: 1,
        zIndex: 20,
        pointerEvents: 'auto'
      } );

      gsap.set( inners, {
        autoAlpha: 0,
        y: 96,
        scale: 0.96,
        filter: 'blur(14px)'
      } );

      gsap.set( inners[0], {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        filter: 'blur(0px)'
      } );

      story.classList.add( 'apple-story--ready' );

      const transitionCount = Math.max( panels.length - 1, 1 );
      const transitionLength = 1.8;
      const getViewportHeight = (): number =>
        window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 800;

      const getScrollDistance = (): number =>
        Math.max( transitionCount * getViewportHeight(), panels.length * 520 );

      const timeline = gsap.timeline( {
        defaults: { ease: 'none' },
        paused: true
      } );
      this.storyTimeline = timeline;
      this.storyTrigger = ScrollTrigger.create( {
        trigger: story,
        start: 'top top',
        end: () => `+=${getScrollDistance()}`,
        scrub: true,
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        animation: timeline,
        onUpdate: self => {
          const activeIndex = Math.min(
            panels.length - 1,
            Math.max( 0, Math.floor( self.progress * panels.length ) )
          );
          if ( activeIndex !== this.currentVisibleSectionIndex ) {
            this.currentVisibleSectionIndex = activeIndex;
            this.updateScrollIndicatorVisibility();
            this.sectionChange.emit( this._sections[activeIndex]?.id ?? '' );
          }

          panels.forEach( ( panel, index ) => {
            const isActive = index === activeIndex;
            panel.classList.toggle( 'is-visible', isActive );
            panel.style.pointerEvents = isActive ? 'auto' : 'none';
          } );
        }
      } );
      for ( let index = 0; index < panels.length - 1; index++ ) {
        const currentPanel = panels[index];
        const nextPanel = panels[index + 1];
        const currentInner = inners[index];
        const nextInner = inners[index + 1];
        const at = index * transitionLength;

        timeline.set( currentPanel, {
          autoAlpha: 1,
          zIndex: 20,
          pointerEvents: 'auto'
        }, at );

        timeline.set( nextPanel, {
          autoAlpha: 1,
          zIndex: 30,
          pointerEvents: 'auto'
        }, at );

        timeline.fromTo( nextInner,
          {
            autoAlpha: 0,
            y: 96,
            scale: 0.96,
            filter: 'blur(14px)'
          },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            filter: 'blur(0px)',
            duration: 1.15
          },
          at + 0.14
        );

        timeline.to( currentInner, {
          autoAlpha: 0,
          y: -96,
          scale: 0.96,
          filter: 'blur(14px)',
          duration: 1.15
        }, at + 0.14 );

        timeline.set( currentPanel, {
          autoAlpha: 0,
          zIndex: 1,
          pointerEvents: 'none'
        }, at + 0.92 );

        timeline.set( nextPanel, {
          zIndex: 20,
          pointerEvents: 'auto'
        }, at + 0.93 );
      }

    }, host );

    this.updateScrollIndicatorVisibility();
  }

  private setupMobileStaticLayout (
    story: HTMLElement,
    panels: HTMLElement[],
    inners: HTMLElement[]
  ): void {
    this.storyTrigger?.kill();
    this.storyTrigger = undefined;
    this.storyTimeline?.kill();
    this.storyTimeline = undefined;

    story.classList.remove( 'apple-story--ready' );
    panels.forEach( panel => panel.classList.add( 'is-visible' ) );

    gsap.set( story, {
      clearProps: 'all'
    } );

    gsap.set( panels, {
      clearProps: 'all'
    } );

    gsap.set( inners, {
      clearProps: 'all'
    } );

    gsap.set( story, {
      position: 'relative',
      height: 'auto',
      minHeight: 'auto',
      overflow: 'visible',
      clearProps: 'transform'
    } );

    gsap.set( panels, {
      position: 'relative',
      inset: 'auto',
      autoAlpha: 1,
      minHeight: 'auto',
      pointerEvents: 'auto',
      clearProps: 'transform,filter,zIndex'
    } );

    gsap.set( inners, {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      filter: 'blur(0px)',
      clearProps: 'transform'
    } );
  }

  onScrollIndicatorClick (): void {
    if ( !isPlatformBrowser( this.platformId ) ) {
      return;
    }

    const host = this.hostRef.nativeElement;
    const story = host.querySelector<HTMLElement>( '[data-apple-story]' );
    const panels = gsap.utils.toArray<HTMLElement>( '[data-apple-panel]', host );

    if ( !story || panels.length < 2 ) {
      return;
    }

    const nextIndex = Math.min( this.currentVisibleSectionIndex + 1, panels.length - 1 );
    if ( nextIndex <= this.currentVisibleSectionIndex ) {
      return;
    }

    const viewportWidth = window.visualViewport?.width || window.innerWidth;
    const isMobile = viewportWidth <= this.mobileBreakpoint
      || window.matchMedia( `(max-width: ${this.mobileBreakpoint}px)` ).matches
      || this.disablePinnedDesktop;

    if ( isMobile || !this.storyTrigger ) {
      const nextPanel = panels[nextIndex];
      const targetTop = window.scrollY + nextPanel.getBoundingClientRect().top - 24;
      window.scrollTo( {
        top: Math.max( 0, targetTop ),
        behavior: 'smooth'
      } );
      return;
    }

    const start = typeof this.storyTrigger.start === 'number'
      ? this.storyTrigger.start
      : ( story.getBoundingClientRect().top + window.scrollY );
    const end = typeof this.storyTrigger.end === 'number'
      ? this.storyTrigger.end
      : start + ( window.visualViewport?.height || window.innerHeight || 0 );
    const panelProgress = panels.length > 1 ? ( nextIndex / ( panels.length - 1 ) ) : 1;
    const targetTop = start + ( ( end - start ) * panelProgress );

    window.scrollTo( {
      top: Math.max( 0, targetTop ),
      behavior: 'smooth'
    } );
  }

  private updateScrollIndicatorVisibility (): void {
    this.showScrollIndicator = this.renderSections.length > 1
      && this.currentVisibleSectionIndex < this.renderSections.length - 1;
  }

  private resetScrollIndicator (): void {
    this.currentVisibleSectionIndex = 0;
    this.updateScrollIndicatorVisibility();
  }

  private syncScrollIndicatorToCurrentSection (): void {
    const host = this.hostRef.nativeElement;
    const panels = gsap.utils.toArray<HTMLElement>( '[data-apple-panel]', host );

    if ( !panels.length ) {
      this.showScrollIndicator = false;
      return;
    }

    const viewportHeight = window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 0;
    const probeLine = viewportHeight * 0.45;
    let activeIndex = 0;

    panels.forEach( ( panel, index ) => {
      const rect = panel.getBoundingClientRect();
      if ( rect.top <= probeLine ) {
        activeIndex = index;
      }
    } );

    const next = Math.min( activeIndex, panels.length - 1 );
    if ( next !== this.currentVisibleSectionIndex ) {
      this.currentVisibleSectionIndex = next;
      this.sectionChange.emit( this._sections[next]?.id ?? '' );
    }
    this.updateScrollIndicatorVisibility();
  }

  trackBySectionId ( index: number, section: AppleTransitionSection ): string {
    return section.id || String( index );
  }

  trackByCardHeading ( index: number, card: AppleTransitionCard ): string {
    return card.heading || String( index );
  }

  trackByActionLabel ( index: number, action: AppleTransitionAction ): string {
    return action.label || String( index );
  }

  get isBrowser (): boolean {
    return isPlatformBrowser( this.platformId );
  }

  handleAction ( actionId?: string, event?: Event ): void {
    if ( !actionId ) return;

    event?.preventDefault();
    this.storyAction.emit( actionId );
  }

  jumpToSection ( id: string ): void {
    if ( !isPlatformBrowser( this.platformId ) ) return;

    const host = this.hostRef.nativeElement;
    const panels = gsap.utils.toArray<HTMLElement>( '[data-apple-panel]', host );
    const story = host.querySelector<HTMLElement>( '[data-apple-story]' );

    const index = this._sections.findIndex( s => s.id === id );
    if ( index < 0 || index >= panels.length ) return;

    const viewportWidth = window.visualViewport?.width || window.innerWidth;
    const isMobile = viewportWidth <= this.mobileBreakpoint
      || window.matchMedia( `(max-width: ${this.mobileBreakpoint}px)` ).matches
      || this.disablePinnedDesktop;

    if ( isMobile || !this.storyTrigger ) {
      const panel = panels[index];
      const targetTop = window.scrollY + panel.getBoundingClientRect().top - 24;
      window.scrollTo( { top: Math.max( 0, targetTop ), behavior: 'smooth' } );
      return;
    }

    const start = typeof this.storyTrigger.start === 'number'
      ? this.storyTrigger.start
      : ( story!.getBoundingClientRect().top + window.scrollY );
    const end = typeof this.storyTrigger.end === 'number'
      ? this.storyTrigger.end
      : start + ( window.visualViewport?.height || window.innerHeight || 0 );

    const panelProgress = panels.length > 1 ? ( index / ( panels.length - 1 ) ) : 1;
    const targetTop = Math.max( 0, start + ( ( end - start ) * panelProgress ) );
    // Use two-argument form — guaranteed to fire a scroll event GSAP's scrub can observe.
    // Then force ScrollTrigger to re-read scroll position in the same frame.
    window.scrollTo( 0, targetTop );
    ScrollTrigger.update();
  }

}
