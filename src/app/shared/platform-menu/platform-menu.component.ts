import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges } from '@angular/core';
import { RouterLink } from '@angular/router';
import packageJson from '../../../../package.json';

import { getPlatformMenuItems, PlatformMenuItem } from '@taliferro/ui/platform/account-menu.model';

interface ProductLink {
  label: string;
  url: string;
  icon: string;
  description: string;
}

/**
 * Top-right hamburger that slides a panel down over the page - the pattern
 * from Moves' marketing nav, carried into the signed-in shell and restyled
 * to Maya's own --todd-* tokens. Replaces the old bottom-nav "More" button;
 * the account/platform items below are the piece that button never had.
 */
@Component( {
  selector: 'app-platform-menu',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './platform-menu.component.html',
  styleUrl: './platform-menu.component.css',
} )
export class PlatformMenuComponent implements OnChanges {
  @Input() isAdmin = false;
  @Input() isLoggedIn = false;

  isOpen = false;
  readonly appVersion = String(packageJson.version || '').trim();

  readonly productLinks: ProductLink[] = [
    { label: 'Ask TODD', url: 'https://ask.taliferro.tech', icon: 'assets/find/entities/todd/logo-bw-icon.png', description: 'Turn uncertainty into the next move.' },
    { label: 'Network', url: 'https://network.taliferro.tech', icon: 'assets/find/entities/network/logo-bw-icon.png', description: 'Know who matters before the moment passes.' },
    { label: 'Outreach', url: 'https://outreach.taliferro.tech', icon: 'assets/find/entities/outreach/logo-bw-icon.png', description: 'Keep the work moving.' },
    { label: 'Docs', url: 'https://docs.taliferro.tech', icon: 'assets/find/entities/docs/logo-bw-icon.png', description: 'Give your best thinking somewhere to live.' },
    { label: 'Moves', url: 'https://moves.taliferro.tech', icon: 'assets/find/entities/moves/logo-bw-icon.png', description: 'Make progress visible and actionable.' },
    { label: 'Pulse', url: 'https://pulse.taliferro.tech', icon: 'assets/find/entities/pulse/logo-bw-icon.png', description: 'Hear what people are really saying.' },
    { label: 'Social', url: 'https://social.taliferro.tech', icon: 'assets/find/entities/social/logo-bw-icon.png', description: 'Stay visible without living online.' },
    { label: 'Lead Vault', url: 'https://lead-vault.taliferro.tech', icon: 'assets/find/entities/lead-vault/logo-bw-icon.png', description: 'Find the people behind the opportunity.' },
    { label: 'SayIt', url: 'https://sayit.taliferro.tech', icon: 'assets/find/entities/sayit/logo-bw-icon.png', description: 'Make your message worth sharing.' },
    { label: 'Find', url: 'https://find.taliferro.tech', icon: 'assets/find/entities/find/logo-bw-icon.png', description: 'Get to the answer faster.' },
    { label: 'Email Signature', url: 'https://signature.taliferro.tech', icon: 'assets/find/entities/email-signature-builder/logo-bw-icon.png', description: 'Make every email carry your brand.' },
    { label: 'Image Creator', url: 'https://images.taliferro.tech', icon: 'assets/find/entities/image-creator/logo-bw-icon.svg', description: 'Turn an idea into an image.' },
    { label: 'Email Creator', url: 'https://emails.taliferro.tech', icon: 'assets/find/entities/email-creator/logo-bw-icon.svg', description: 'Design an email that looks the part.' },
    { label: 'Music', url: 'https://music.taliferro.com', icon: 'assets/find/entities/music/logo-bw-icon.png', description: 'Let the soundtrack keep moving.' },
  ];

  accountItems: PlatformMenuItem[] = [];

  constructor () {
    this.recompute();
  }

  ngOnChanges (): void {
    this.recompute();
  }

  private recompute (): void {
    // Profile is in-app (/profile), shown as its own routerLink in the
    // template - not TODD's page.
    this.accountItems = getPlatformMenuItems().filter( ( item ) =>
      item.id !== 'platform-profile' && item.label !== 'Billing' && ( !item.adminOnly || this.isAdmin ) );
  }

  trackByLabel ( _index: number, item: { label: string } ): string {
    return item.label;
  }

  toggle (): void {
    this.isOpen = !this.isOpen;
  }

  close (): void {
    this.isOpen = false;
  }
}
