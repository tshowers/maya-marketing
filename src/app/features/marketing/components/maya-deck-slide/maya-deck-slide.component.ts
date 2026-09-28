import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, OnChanges, Output, ViewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MayaDeck, MayaDeckTheme, MayaRenderedSlide, MayaSlideTone } from '../../models/maya-deck.models';

/**
 * Renders one slide on a fixed 1920×1080 canvas. The same element is shown (scaled) in the
 * preview and captured for export, so what the user sees is exactly what they download.
 */
@Component({
  selector: 'maya-deck-slide',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './maya-deck-slide.component.html',
  styleUrl: './maya-deck-slide.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MayaDeckSlideComponent implements OnChanges {
  @Input({ required: true }) view!: MayaRenderedSlide;
  @Input() meta?: MayaDeck['metadata'];
  @Input() logo?: string;
  @Input() look: MayaDeckTheme = 'corporate';
  /** Emits true when text still overflows its safe area at the smallest allowed type size. */
  @Output() overflowChange = new EventEmitter<boolean>();
  @ViewChild('frame', { static: true }) private readonly frameRef!: ElementRef<HTMLElement>;

  private static readonly minFit = 0.72;

  get element(): HTMLElement { return this.frameRef.nativeElement; }

  /** Minimal decks trade dark statement slides for negative space; covers and closings keep their weight. */
  get tone(): MayaSlideTone {
    const { layout, tone } = this.view;
    return this.look === 'minimal' && tone === 'dark' && (layout === 'statement' || layout === 'bullets') ? 'light' : tone;
  }

  get pageNumber(): string { return String(this.view.index + 1).padStart(2, '0'); }

  get organization(): string { return this.meta?.organization?.trim() || ''; }

  get eyebrow(): string | undefined {
    const role = this.view.slide.narrativeRole?.trim();
    return role && role.length <= 32 ? role : undefined;
  }

  get coverTitle(): string { return this.meta?.title?.trim() || this.view.slide.headline; }

  get coverSubtitle(): string | undefined {
    const { headline, supportingText } = this.view.slide;
    const subtitle = headline && headline !== this.coverTitle ? headline : supportingText || this.meta?.objective;
    return subtitle?.trim() || undefined;
  }

  /** Picks a starting type size from copy length; the fit pass handles anything that still overflows. */
  get headlineSize(): number {
    const length = (this.view.layout === 'cover' ? this.coverTitle : this.view.slide.headline).length;
    const scale: Record<string, number[]> = {
      cover: [124, 104, 88, 74],
      statement: [116, 96, 80, 66],
      closing: [116, 96, 80, 66],
      split: [72, 62, 54, 46],
      bullets: [72, 62, 54, 46],
      chart: [72, 62, 54, 46]
    };
    const sizes = scale[this.view.layout] || [76, 66, 58, 50];
    return length <= 40 ? sizes[0] : length <= 80 ? sizes[1] : length <= 120 ? sizes[2] : sizes[3];
  }

  get metricSize(): number { return [260, 168, 136, 112][(this.view.slide.metrics?.length || 1) - 1] || 112; }

  get quoteText(): string { return this.view.slide.quote || this.view.slide.supportingText || this.view.slide.headline; }

  get quoteSize(): number {
    const length = this.quoteText.length;
    return length <= 90 ? 72 : length <= 170 ? 58 : 48;
  }

  get chartMax(): number { return Math.max(...(this.view.slide.chartData || []).map(point => point.value), 1); }

  barWidth(value: number): number { return Math.max(2, Math.round((value / this.chartMax) * 100)); }

  formatValue(value: number): string { return value.toLocaleString(undefined, { maximumFractionDigits: 1 }); }

  ngOnChanges(): void {
    // Runs after the view has rendered the new inputs; the zone picks up the overflow emit.
    setTimeout(() => void this.refit());
  }

  /** Steps the whole slide's type scale down until every safe area fits its content. */
  async refit(): Promise<void> {
    const frame = this.element;
    frame.style.setProperty('--fit', '1');
    void frame.offsetHeight;
    await Promise.all(['800 64px "Manrope Variable"', '440 64px "Fraunces Variable"', '400 32px "Inter Variable"'].map(font => document.fonts.load(font).catch(() => [])));
    await document.fonts.ready;

    const bodies = Array.from(frame.querySelectorAll<HTMLElement>('.s-body'));
    const overflows = () => bodies.some(body => body.scrollHeight > body.clientHeight + 1 || body.scrollWidth > body.clientWidth + 1);
    let fit = 1;
    while (fit > MayaDeckSlideComponent.minFit && overflows()) {
      fit = Math.round((fit - 0.04) * 100) / 100;
      frame.style.setProperty('--fit', String(fit));
    }
    const overflow = overflows();
    frame.toggleAttribute('data-overflow', overflow);
    this.overflowChange.emit(overflow);
  }
}
