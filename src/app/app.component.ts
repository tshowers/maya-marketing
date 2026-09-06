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
      <a routerLink="/" routerLinkActive="maya-shared-bottom-nav__active" [routerLinkActiveOptions]="{ exact: true }"><i class="fa-solid fa-house" aria-hidden="true"></i><span>Home</span></a>
      <a routerLink="/marketing-employee" routerLinkActive="maya-shared-bottom-nav__active"><i class="fa-solid fa-chart-line" aria-hidden="true"></i><span>Status</span></a>
      <a routerLink="/marketing-employee/plan" routerLinkActive="maya-shared-bottom-nav__active"><i class="fa-regular fa-clipboard" aria-hidden="true"></i><span>Plan</span></a>
      <ng-container *ngIf="isLoggedIn$ | async; else signInLink">
        <button type="button" class="maya-shared-session-action" (click)="signOut()"><i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i><span class="maya-shared-session-label"><span class="maya-shared-session-dot maya-shared-session-dot--in"></span>Sign Out</span></button>
      </ng-container>
      <ng-template #signInLink><a routerLink="/login" class="maya-shared-session-action"><i class="fa-solid fa-right-to-bracket" aria-hidden="true"></i><span class="maya-shared-session-label"><span class="maya-shared-session-dot maya-shared-session-dot--out"></span>Sign In</span></a></ng-template>
      <button type="button" [class.maya-shared-bottom-nav__active]="showMore" (click)="showMore = !showMore"><span class="maya-shared-bottom-nav__dots">•••</span><span>More</span></button>
    </nav>
    <section class="maya-shared-more" *ngIf="showMore" aria-label="Maya app links">
      <div class="maya-shared-more__header"><strong>All apps</strong><button type="button" aria-label="Close app links" (click)="showMore = false">×</button></div>
      <a *ngFor="let link of moreLinks" [href]="link.url" target="_blank" rel="noopener" (click)="showMore = false">{{ link.label }}</a>
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
    { label: 'TODD Home', url: 'https://todd.taliferro.tech' },
    { label: 'Find', url: 'https://find.taliferro.tech' },
    { label: 'Email Signature', url: 'https://signature.taliferro.tech' },
    { label: 'SayIt', url: 'https://sayit.taliferro.tech' },
    { label: 'Ask TODD', url: 'https://todd.taliferro.tech/ask-todd' },
    { label: 'Lead Vault', url: 'https://lead-vault-taliferro.tech' },
    { label: 'Music', url: 'https://music.taliferro.com' },
    { label: 'Pulse', url: 'https://pulse.taliferro.tech' },
    { label: 'Network', url: 'https://network.taliferro.tech' },
    { label: 'Outreach', url: 'https://outreach.taliferro.tech' },
    { label: 'Moves', url: 'https://moves.taliferro.tech' },
    { label: 'Social', url: 'https://social.taliferro.tech' },
    { label: 'Docs', url: 'https://docs.taliferro.tech' }
  ];
}
