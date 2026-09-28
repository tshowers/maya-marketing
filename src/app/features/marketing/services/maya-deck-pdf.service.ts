import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';

/**
 * Exports rendered 1920×1080 slide elements to a 16:9 PDF. Each slide is captured by the browser's
 * own renderer (html-to-image), so fonts, gradients and image crops match the preview exactly.
 */
@Injectable({ providedIn: 'root' })
export class MayaDeckPdfService {
  private readonly width = 1920;
  private readonly height = 1080;

  async download(slides: HTMLElement[], fontScope: HTMLElement, title: string, onProgress?: (done: number, total: number) => void): Promise<void> {
    const { toJpeg, getFontEmbedCSS } = await import('html-to-image');
    // Resolve the @font-face rules once for the whole deck instead of once per slide.
    const fontEmbedCSS = await getFontEmbedCSS(fontScope);
    const pdf = new jsPDF({ unit: 'pt', format: [this.width / 2, this.height / 2], orientation: 'landscape', compress: true });

    for (const [index, slide] of slides.entries()) {
      onProgress?.(index, slides.length);
      const image = await toJpeg(slide, {
        width: this.width,
        height: this.height,
        pixelRatio: 1.25,
        quality: 0.9,
        fontEmbedCSS,
        backgroundColor: getComputedStyle(slide).backgroundColor || '#ffffff'
      });
      if (index > 0) pdf.addPage([this.width / 2, this.height / 2], 'landscape');
      pdf.addImage(image, 'JPEG', 0, 0, this.width / 2, this.height / 2);
    }
    onProgress?.(slides.length, slides.length);
    pdf.save(`${this.slug(title)}.pdf`);
  }

  private slug(value: string): string {
    return String(value || 'maya-presentation').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'maya-presentation';
  }
}
