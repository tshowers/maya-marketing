import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class MayaReportImageService {
  private readonly coverImages = [
    'assets/maya/report/cover-01.webp',
    'assets/maya/report/cover-02.webp',
    'assets/maya/report/cover-03.webp',
    'assets/maya/report/cover-04.webp'
  ];

  private readonly accentImages = [
    'assets/maya/report/accent-01.webp',
    'assets/maya/report/accent-02.webp',
    'assets/maya/report/accent-03.webp',
    'assets/maya/report/accent-04.webp'
  ];

  selectCover(seed = ''): string | undefined {
    return this.pick(this.coverImages, seed);
  }

  selectAccent(seed = ''): string | undefined {
    return this.pick(this.accentImages, seed);
  }

  private pick(images: string[], seed: string): string | undefined {
    if (!images.length) return undefined;
    const numericSeed = Array.from(String(seed || 'maya')).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return images[numericSeed % images.length];
  }
}
