import { Injectable } from '@angular/core';
import { MayaDeck, MayaDeckImage, MayaDeckSlide, MayaRenderedSlide, MayaSlideItem } from '../models/maya-deck.models';
import { MayaDeckImagesService, MayaImageNeed } from './maya-deck-images.service';

/**
 * Turns Maya's content-first slides into renderable slides: a layout family, a tone and an image.
 * A composition only gets its layout when the slide carries the data that layout needs;
 * otherwise it degrades to a layout that fits what is actually there.
 */
@Injectable({ providedIn: 'root' })
export class MayaDeckCompositionService {
  constructor(private readonly images: MayaDeckImagesService) {}

  plan(deck: MayaDeck, uploads: string[] = []): MayaRenderedSlide[] {
    const pick = this.images.createPicker([...(deck.assets.uploadedImages || []), ...uploads]);
    const deckText = `${deck.metadata.title} ${deck.metadata.objective || ''}`;
    // Art on every slide reads as decoration; keep imagery to roughly half the deck.
    let budget = Math.ceil(deck.slides.length / 2);
    const take = (need: MayaImageNeed, slide: MayaDeckSlide): MayaDeckImage | undefined => {
      if (budget <= 0) return undefined;
      const image = pick(need, `${slide.headline} ${slide.takeaway} ${slide.purpose} ${slide.visualIntent || ''} ${deckText}`, slide.image);
      if (image) budget--;
      return image;
    };

    return deck.slides.map((raw, index): MayaRenderedSlide => {
      const slide = this.normalize(raw);
      const items: MayaSlideItem[] = slide.steps?.length ? slide.steps : (slide.bullets || []).map(title => ({ title }));
      const base = { index, slide, items };
      const richItems = items.length >= 2 && items.some(item => item.detail || item.date);
      const type = index === 0 ? 'hero' : slide.type;

      switch (type) {
        case 'hero': {
          const image = take('hero', slide);
          return { ...base, layout: 'cover', tone: image?.backdrop === 'light' ? 'light' : 'dark', image };
        }
        case 'closing':
          return { ...base, layout: 'closing', tone: 'dark', image: take('ambient', slide) };
        case 'bigStatement':
          return { ...base, layout: 'statement', tone: 'dark' };
        case 'problem':
          return { ...base, layout: items.length >= 2 ? 'bullets' : 'statement', tone: 'dark' };
        case 'opportunity':
        case 'imageStatement':
        case 'product': {
          const image = take('feature', slide);
          return image ? { ...base, layout: 'split', tone: 'light', image } : this.fallback(base);
        }
        case 'threeIdeas':
        case 'comparison':
          return richItems ? { ...base, layout: 'columns', tone: 'light' } : this.fallback(base);
        case 'process':
        case 'timeline':
        case 'roadmap':
        case 'recommendation':
          return richItems ? { ...base, layout: 'steps', tone: 'light' } : this.fallback(base);
        case 'metrics':
          return slide.metrics?.length ? { ...base, layout: 'metrics', tone: 'light' } : this.fallback(base);
        case 'chart':
          return (slide.chartData?.length || 0) >= 2 ? { ...base, layout: 'chart', tone: 'light' } : this.fallback(base);
        case 'quote':
          return slide.quote || slide.supportingText ? { ...base, layout: 'quote', tone: 'tint' } : this.fallback(base);
        default:
          return this.fallback(base);
      }
    });
  }

  normalize(slide: MayaDeckSlide): MayaDeckSlide {
    const copy = { ...slide };
    copy.headline = this.trim(copy.headline, 150);
    copy.supportingText = copy.supportingText ? this.trim(copy.supportingText, 280) : undefined;
    copy.bullets = copy.bullets?.map(item => this.trim(item, 125)).filter(Boolean).slice(0, 5);
    copy.steps = copy.steps?.map(step => ({ ...step, title: this.trim(step.title, 70), detail: step.detail ? this.trim(step.detail, 100) : undefined })).slice(0, 5);
    copy.metrics = copy.metrics?.slice(0, 4);
    copy.chartData = copy.chartData?.filter(point => Number.isFinite(point.value)).slice(0, 8);
    return copy;
  }

  private fallback(base: Pick<MayaRenderedSlide, 'index' | 'slide' | 'items'>): MayaRenderedSlide {
    if ((base.slide.metrics?.length || 0) >= 2) return { ...base, layout: 'metrics', tone: 'light' };
    if (base.items.length >= 2) return { ...base, layout: 'bullets', tone: 'light' };
    return { ...base, layout: 'statement', tone: 'light' };
  }

  private trim(value: string, max: number): string {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
  }
}
