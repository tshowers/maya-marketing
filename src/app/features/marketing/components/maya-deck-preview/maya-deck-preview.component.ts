import { AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, NgZone, OnChanges, OnDestroy, Output, QueryList, SimpleChanges, ViewChild, ViewChildren } from '@angular/core';
import { NgStyle } from '@angular/common';
import { MayaDeck, MayaDeckTheme, MayaRenderedSlide } from '../../models/maya-deck.models';
import { MayaDeckCompositionService } from '../../services/maya-deck-composition.service';
import { MayaDeckPdfService } from '../../services/maya-deck-pdf.service';
import { MayaDeckThemeService } from '../../services/maya-deck-theme.service';
import { MayaDeckSlideComponent } from '../maya-deck-slide/maya-deck-slide.component';

/** Full-screen deck preview: the user reviews the real slides, adjusts look and accent, then downloads. */
@Component({
  selector: 'maya-deck-preview',
  standalone: true,
  imports: [NgStyle, MayaDeckSlideComponent],
  templateUrl: './maya-deck-preview.component.html',
  styleUrl: './maya-deck-preview.component.css'
})
export class MayaDeckPreviewComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input({ required: true }) deck!: MayaDeck;
  @Input() look: MayaDeckTheme = 'corporate';
  @Input() accent = '#ff8a24';
  @Input() logo?: string;
  @Input() uploadedImages: string[] = [];
  @Output() lookChange = new EventEmitter<MayaDeckTheme>();
  @Output() accentChange = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('deckRoot', { static: true }) private readonly deckRoot!: ElementRef<HTMLElement>;
  @ViewChildren(MayaDeckSlideComponent) private readonly slideRefs!: QueryList<MayaDeckSlideComponent>;

  slides: MayaRenderedSlide[] = [];
  tokens: Record<string, string> = {};
  scale = 0.5;
  exporting = false;
  progress = '';
  error = '';
  readonly overflowing = new Set<number>();
  private resizeObserver?: ResizeObserver;

  constructor(
    readonly theme: MayaDeckThemeService,
    private readonly composition: MayaDeckCompositionService,
    private readonly pdf: MayaDeckPdfService,
    private readonly zone: NgZone
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['deck'] || changes['uploadedImages']) {
      this.slides = this.composition.plan(this.deck, this.uploadedImages);
      this.overflowing.clear();
    }
    this.tokens = this.theme.tokens(this.look, this.accent);
  }

  ngAfterViewInit(): void {
    const root = this.deckRoot.nativeElement;
    // ResizeObserver is not zone-patched, so re-enter the zone to update the bound scale.
    this.resizeObserver = new ResizeObserver(([entry]) => this.zone.run(() => { this.scale = Math.min(entry.contentRect.width, 1200) / 1920; }));
    this.resizeObserver.observe(root);
  }

  ngOnDestroy(): void { this.resizeObserver?.disconnect(); }

  @HostListener('document:keydown.escape')
  close(): void { if (!this.exporting) this.closed.emit(); }

  setLook(look: MayaDeckTheme): void {
    if (look === this.look) return;
    this.look = look;
    this.tokens = this.theme.tokens(this.look, this.accent);
    this.lookChange.emit(look);
  }

  setAccent(accent: string): void {
    this.accent = accent;
    this.tokens = this.theme.tokens(this.look, this.accent);
    this.accentChange.emit(accent);
  }

  onOverflow(index: number, overflow: boolean): void {
    if (overflow) this.overflowing.add(index); else this.overflowing.delete(index);
  }

  async download(): Promise<void> {
    if (this.exporting) return;
    this.exporting = true;
    this.error = '';
    try {
      const slides = this.slideRefs.toArray();
      await Promise.all(slides.map(slide => slide.refit()));
      await this.pdf.download(slides.map(slide => slide.element), this.deckRoot.nativeElement, this.deck.metadata.title, (done, total) => {
        this.progress = done < total ? `Rendering slide ${done + 1} of ${total}…` : 'Saving PDF…';
      });
    } catch (error) {
      console.error('[Maya Deck] PDF export failed', error);
      this.error = 'Maya could not export this deck. Please try again.';
    } finally {
      this.exporting = false;
      this.progress = '';
    }
  }
}
