import { Injectable } from '@angular/core';
import { MayaDeckImage } from '../models/maya-deck.models';

/**
 * Stock art Maya can place in a deck. Every entry here uses transparency and was made to blend
 * into a solid backdrop, so it records which backdrop it belongs on and whether it may be cropped.
 * Add new image-creator output here with honest tags; tags drive matching against slide copy.
 */
export const MAYA_STOCK_IMAGES: ReadonlyArray<MayaDeckImage & { id: string }> = [
  { id: 'cover-01', src: 'assets/stock-images/cover-01.webp', backdrop: 'dark', fit: 'cover', position: '72% 50%', tags: ['global', 'world', 'scale', 'technology', 'network', 'vision', 'future', 'market', 'international', 'data'] },
  { id: 'cover-02', src: 'assets/stock-images/cover-02.webp', backdrop: 'light', fit: 'contain', tags: ['vision', 'leadership', 'journey', 'strategy', 'architecture', 'ambition', 'path', 'transformation'] },
  { id: 'cover-03', src: 'assets/stock-images/cover-03.webp', backdrop: 'light', fit: 'contain', position: '100% 50%', tags: ['growth', 'sustainability', 'fresh', 'natural', 'health', 'renewal', 'green'] },
  { id: 'cover-04', src: 'assets/stock-images/cover-04.webp', backdrop: 'light', fit: 'cover', position: '50% 45%', tags: ['business', 'city', 'enterprise', 'corporate', 'growth', 'finance', 'investment', 'market'] },
  { id: 'cover-05', src: 'assets/stock-images/cover-05.webp', backdrop: 'light', fit: 'cover', position: '60% 50%', tags: ['vision', 'ambition', 'leadership', 'challenge', 'strategy', 'goal', 'summit', 'opportunity'] },
  { id: 'cover-06', src: 'assets/stock-images/cover-06.webp', backdrop: 'light', fit: 'contain', tags: ['business', 'team', 'office', 'operations', 'meeting', 'executive', 'workplace', 'company'] },
  { id: 'accent-01', src: 'assets/stock-images/accent-01.webp', backdrop: 'light', fit: 'contain', tags: ['wellness', 'calm', 'balance', 'spa', 'care', 'relax'] },
  { id: 'accent-02', src: 'assets/stock-images/accent-02.webp', backdrop: 'light', fit: 'contain', tags: ['wellness', 'balance', 'calm', 'flow', 'harmony', 'stability'] },
  { id: 'accent-03', src: 'assets/stock-images/accent-03.webp', backdrop: 'light', fit: 'contain', tags: ['journey', 'roadmap', 'path', 'road', 'next', 'forward', 'direction', 'plan'] },
  { id: 'accent-04', src: 'assets/stock-images/accent-04.webp', backdrop: 'light', fit: 'contain', tags: ['wellness', 'balance', 'calm', 'beauty', 'harmony'] }
];

export type MayaImageNeed = 'hero' | 'feature' | 'ambient';

/** Picks images for slides without repeats, preferring the user's own material over stock. */
@Injectable({ providedIn: 'root' })
export class MayaDeckImagesService {
  createPicker(uploads: string[]): (need: MayaImageNeed, text: string, requested?: string) => MayaDeckImage | undefined {
    const used = new Set<string>();
    const figures: MayaDeckImage[] = uploads.filter(Boolean).map(src => ({ src, backdrop: 'light', fit: 'contain', figure: true }));

    return (need, text, requested) => {
      const explicit = requested ? this.resolve(requested) : undefined;
      if (explicit && !used.has(explicit.src)) { used.add(explicit.src); return explicit; }

      // Uploaded material can be screenshots or charts, so it only goes where a framed image makes sense.
      if (need === 'feature') {
        const figure = figures.find(item => !used.has(item.src));
        if (figure) { used.add(figure.src); return figure; }
      }

      const words = String(text || '').toLowerCase();
      const candidates = MAYA_STOCK_IMAGES
        .filter(image => !used.has(image.src))
        .filter(image => need !== 'ambient' || image.backdrop === 'dark')
        .map(image => ({ image, score: (image.tags || []).filter(tag => words.includes(tag)).length }))
        // Ambient and feature art must relate to the slide; a cover can always take the best available art.
        .filter(candidate => need === 'hero' || candidate.score > 0)
        .sort((a, b) => b.score - a.score);
      const pick = candidates[0]?.image;
      if (pick) used.add(pick.src);
      return pick;
    };
  }

  /** Maps an image reference from Maya's backend to catalogue metadata, or treats it as a user figure. */
  private resolve(src: string): MayaDeckImage {
    const id = src.split('/').pop()?.replace(/\.(png|webp|jpe?g)$/i, '');
    const stock = MAYA_STOCK_IMAGES.find(image => image.id === id);
    return stock || { src, backdrop: 'light', fit: 'contain', figure: true };
  }
}
