import { Injectable } from '@angular/core';
import { MayaDeckTheme } from '../models/maya-deck.models';

type Rgb = [number, number, number];

/**
 * Derives a deck's whole design system (palette + type) from a single brand accent.
 * Every text/background pairing is contrast-checked, so any accent the user picks stays legible.
 */
@Injectable({ providedIn: 'root' })
export class MayaDeckThemeService {
  readonly accentPresets = ['#ff8a24', '#2563eb', '#0f9d76', '#7c3aed', '#e11d48', '#0e7490'];

  tokens(look: MayaDeckTheme, accentHex: string): Record<string, string> {
    const accent = this.parse(accentHex) || this.parse('#ff8a24')!;
    const [h, s] = this.toHsl(accent);
    const minimal = look === 'minimal';

    // Warm accents on a warm-tinted dark read as muddy brown, so they get a cool navy-charcoal ink instead.
    const cool = h >= 150 / 360 && h <= 300 / 360;
    const inkHue = cool ? h : 222 / 360;
    const inkSat = minimal ? 0.1 : cool ? Math.min(s, 0.55) : 0.42;
    const ink = this.fromHsl(inkHue, inkSat, minimal ? .085 : .13);
    const inkSoft = this.fromHsl(inkHue, inkSat * 0.8, minimal ? .15 : .2);
    const paper: Rgb = minimal ? this.fromHsl(h, Math.min(s, .2), .965) : [255, 255, 255];
    const tint = this.fromHsl(h, Math.min(s, .55), minimal ? .92 : .955);
    const white: Rgb = [255, 255, 255];

    return {
      '--d-accent': this.hex(accent),
      '--d-accent-on-light': this.hex(this.ensureContrast(accent, paper, 3, -1)),
      '--d-accent-on-dark': this.hex(this.ensureContrast(accent, ink, 3.2, 1)),
      '--d-on-accent': this.contrast(accent, white) >= 3 ? '#ffffff' : this.hex(ink),
      '--d-ink': this.hex(ink),
      '--d-ink-soft': this.hex(inkSoft),
      '--d-paper': this.hex(paper),
      '--d-tint': this.hex(tint),
      '--d-text': this.hex(ink),
      '--d-muted': this.hex(this.fromHsl(inkHue, Math.min(inkSat, .16), .38)),
      '--d-muted-on-dark': this.hex(this.fromHsl(inkHue, Math.min(inkSat, .2), .78)),
      '--d-line': this.hex(this.fromHsl(inkHue, Math.min(inkSat, .2), .87)),
      '--d-line-on-dark': this.hex(this.fromHsl(inkHue, Math.min(inkSat, .3), .28)),
      '--d-display': minimal ? "'Fraunces Variable', Georgia, serif" : "'Manrope Variable', 'Inter Variable', system-ui, sans-serif",
      '--d-body': "'Inter Variable', system-ui, sans-serif",
      '--d-display-weight': minimal ? '440' : '800',
      '--d-display-tracking': minimal ? '-0.02em' : '-0.035em'
    };
  }

  private ensureContrast(color: Rgb, background: Rgb, target: number, direction: 1 | -1): Rgb {
    const [h, s, l] = this.toHsl(color);
    let lightness = l;
    let candidate = color;
    while (this.contrast(candidate, background) < target && lightness > 0.02 && lightness < 0.98) {
      lightness += direction * 0.02;
      candidate = this.fromHsl(h, s, lightness);
    }
    return candidate;
  }

  private contrast(a: Rgb, b: Rgb): number {
    const [la, lb] = [this.luminance(a), this.luminance(b)];
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  private luminance(rgb: Rgb): number {
    const [r, g, b] = rgb.map(value => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  private parse(hex: string): Rgb | undefined {
    const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!match) return undefined;
    const value = match[1].length === 3 ? match[1].split('').map(char => char + char).join('') : match[1];
    return [0, 2, 4].map(offset => parseInt(value.slice(offset, offset + 2), 16)) as Rgb;
  }

  private hex(rgb: Rgb): string {
    return '#' + rgb.map(value => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0')).join('');
  }

  private toHsl([r, g, b]: Rgb): [number, number, number] {
    const [rn, gn, bn] = [r / 255, g / 255, b / 255];
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const h = max === rn ? ((gn - bn) / d + (gn < bn ? 6 : 0)) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
    return [h / 6, s, l];
  }

  private fromHsl(h: number, s: number, l: number): Rgb {
    if (s === 0) return [l * 255, l * 255, l * 255];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const channel = (t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return [channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255];
  }
}
