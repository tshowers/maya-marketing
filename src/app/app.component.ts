import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'maya-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, AsyncPipe],
  template: `
    <div class="maya-session-indicator" [class.maya-session-indicator--logged-out]="!(isLoggedIn$ | async)" [attr.title]="(isLoggedIn$ | async) ? 'Logged in' : 'Not logged in'" [attr.aria-label]="(isLoggedIn$ | async) ? 'Logged in' : 'Not logged in'"><span></span></div>
    <router-outlet />
    <nav class="maya-shared-bottom-nav" aria-label="Maya navigation">
      <a href="https://todd.taliferro.tech"><i class="fa-solid fa-house" aria-hidden="true"></i><span>Home</span></a>
      <a [routerLink]="(isLoggedIn$ | async) ? '/marketing-employee' : null" routerLinkActive="maya-shared-bottom-nav__active" [class.maya-shared-bottom-nav__requires-auth]="!(isLoggedIn$ | async)" [attr.aria-disabled]="!(isLoggedIn$ | async)" [attr.title]="(isLoggedIn$ | async) ? 'View Status' : 'Sign in to view Status'"><i class="fa-solid fa-chart-line" aria-hidden="true"></i><span>Status</span></a>
      <a [routerLink]="(isLoggedIn$ | async) ? '/marketing-employee/plan' : null" routerLinkActive="maya-shared-bottom-nav__active" [class.maya-shared-bottom-nav__requires-auth]="!(isLoggedIn$ | async)" [attr.aria-disabled]="!(isLoggedIn$ | async)" [attr.title]="(isLoggedIn$ | async) ? 'View Plan' : 'Sign in to view Plan'"><i class="fa-regular fa-clipboard" aria-hidden="true"></i><span>Plan</span></a>
      <ng-container *ngIf="isLoggedIn$ | async; else signInLink">
        <button type="button" class="maya-shared-session-action" (click)="signOut()"><i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i><span class="maya-shared-session-label"><span class="maya-shared-session-dot maya-shared-session-dot--in"></span>Sign Out</span></button>
      </ng-container>
      <ng-template #signInLink><a routerLink="/login" class="maya-shared-session-action"><i class="fa-solid fa-right-to-bracket" aria-hidden="true"></i><span class="maya-shared-session-label"><span class="maya-shared-session-dot maya-shared-session-dot--out"></span>Sign In</span></a></ng-template>
      <button type="button" [class.maya-shared-bottom-nav__active]="showMore" (click)="showMore = !showMore"><span class="maya-shared-bottom-nav__dots">•••</span><span>More</span></button>
    </nav>
    <section class="maya-shared-more" *ngIf="showMore" aria-label="Maya app links">
      <div class="maya-shared-more__header"><strong>All apps</strong><button type="button" aria-label="Close app links" (click)="showMore = false">×</button></div>
      <a *ngFor="let link of moreLinks" class="maya-shared-more__link" [href]="link.url" target="_blank" rel="noopener" [attr.aria-label]="link.label" [attr.title]="link.label" (click)="showMore = false"><i *ngIf="link.icon === 'home'" class="fa-solid fa-house maya-shared-more__home-icon" aria-hidden="true"></i><img *ngIf="link.icon !== 'home'" class="maya-shared-more__icon" [class.maya-shared-more__icon--todd]="link.label === 'TODD'" [class.maya-shared-more__icon--ios]="link.icon.includes('logo-ios-icon')" [src]="link.icon" alt="" aria-hidden="true"><span class="maya-shared-more__label">{{ link.label }}</span></a>
    </section>
  `,
  styleUrl: './app.component.css'
})
export class AppComponent {
  private readonly authService = inject( AuthService );
  private readonly router = inject( Router );
  readonly isLoggedIn$ = this.authService.getUser().pipe( map( user => !!user ) );
  showMore = false;

  signOut (): void {
    this.authService.logout().subscribe( {
      next: () => this.router.navigate( ['/login'] ),
      error: () => this.router.navigate( ['/login'] )
    } );
  }
  readonly moreLinks = [
    { label: 'Home', url: 'https://todd.taliferro.tech', icon: 'home' },
    { label: 'Find', url: 'https://find.taliferro.tech', icon: 'assets/find/entities/find/logo-ios-icon.png' },
    { label: 'Email Signature', url: 'https://signature.taliferro.tech', icon: 'assets/find/entities/email-signature-builder/logo-ios-icon.png' },
    { label: 'SayIt', url: 'https://sayit.taliferro.tech', icon: 'assets/find/entities/sayit/logo-ios-icon.png' },
    { label: 'TODD', url: 'https://todd.taliferro.tech/ask-todd', icon: 'assets/find/entities/todd/logo-ios-icon.png' },
    { label: 'Lead Vault', url: 'https://lead-vault-taliferro.tech', icon: 'assets/find/entities/lead-vault/logo.png' },
    { label: 'Music', url: 'https://music.taliferro.com', icon: 'assets/find/entities/music/logo-ios-icon.png' },
    { label: 'Pulse', url: 'https://pulse.taliferro.tech', icon: 'assets/find/entities/pulse/logo.png' },
    { label: 'Network', url: 'https://network.taliferro.tech', icon: 'assets/find/entities/network/logo.png' },
    { label: 'Outreach', url: 'https://outreach.taliferro.tech', icon: 'assets/find/entities/outreach/logo.png' },
    { label: 'Moves', url: 'https://moves.taliferro.tech', icon: 'assets/find/entities/moves/logo.png' },
    { label: 'Social', url: 'https://social.taliferro.tech', icon: 'assets/find/entities/social/logo.png' },
    { label: 'Docs', url: 'https://docs.taliferro.tech', icon: 'assets/find/entities/docs/logo.png' }
  ];
}
