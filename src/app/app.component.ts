import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { environment } from '../environments/environment';
import { AuthService } from './services/auth.service';
import { NotificationComponent } from './shared/page/notification/notification.component';
import { PlatformMenuComponent } from './shared/platform-menu/platform-menu.component';
import { MayaChatStateService } from './services/maya-chat-state.service';
import { WriteAccessPromptComponent } from './shared/write-access/write-access-prompt.component';
import { AppUpdateService } from './services/app-update.service';

@Component({
  selector: 'maya-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, AsyncPipe, NotificationComponent, PlatformMenuComponent, WriteAccessPromptComponent],
  template: `
    <!-- Maya header (design 11a/11b). Help and About draw their own. -->
    <header class="maya-head" *ngIf="showHeader">
      <a class="maya-head__brand" routerLink="/">
        <span class="maya-head__avatar"><img class="brand-mark--light" src="assets/brand/products/svg/light/03-marketing-assistant.svg" alt="" /><img class="brand-mark--dark" src="assets/brand/products/svg/dark/03-marketing-assistant.svg" alt="" /></span>
        <span class="maya-head__title">16Ahead <span>Marketing Assistant</span></span>
      </a>
      <nav class="maya-head__actions" aria-label="Marketing Assistant">
        <button type="button" class="maya-pill" *ngIf="isChatHome && chat.hasConversation" (click)="chat.newChat()" title="New chat">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg><span>New chat</span>
        </button>
        <button type="button" class="maya-pill" *ngIf="isChatHome && chat.hasHistory" (click)="chat.openHistory()" title="Past conversations">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg><span>History</span>
        </button>
        <a class="maya-pill" routerLink="/marketing-employee" routerLinkActive="is-on" [routerLinkActiveOptions]="{ exact: true }" title="Status">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3"/></svg><span>Status</span>
        </a>
        <a class="maya-pill" routerLink="/marketing-employee/plan" routerLinkActive="is-on" title="Plan">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M16 13H8M16 17H8"/></svg><span>Plan</span>
        </a>
        <app-platform-menu [isAdmin]="(isAdmin$ | async) ?? false" [isLoggedIn]="(isLoggedIn$ | async) ?? false" [userName]="(userName$ | async) ?? ''" [userEmail]="(userEmail$ | async) ?? ''" (signOut)="signOut()" />
      </nav>
    </header>
    <app-notification />
    <router-outlet />
    <app-write-access-prompt />
  `,
  styleUrl: './app.component.css'
})
export class AppComponent {
  private readonly authService = inject( AuthService );
  private readonly router = inject( Router );
  readonly chat = inject( MayaChatStateService );
  readonly isLoggedIn$ = this.authService.getUser().pipe( map( user => !!user ) );
  readonly isAdmin$ = this.authService.getUser().pipe( map( user => user?.uid === environment.taliferroTenantId ) );
  readonly userName$ = this.authService.getUser().pipe( map( user => user?.displayName || '' ) );
  readonly userEmail$ = this.authService.getUser().pipe( map( user => user?.email || '' ) );

  constructor () {
    inject( AppUpdateService ).start();
  }

  private get path (): string {
    return this.router.url.split( '?' )[0].split( '#' )[0];
  }

  get isChatHome (): boolean {
    return this.path === '/';
  }

  /** Help and About use the shared template, which has its own header. */
  get showHeader (): boolean {
    return this.path !== '/help' && this.path !== '/about';
  }

  signOut (): void {
    this.authService.logout().subscribe( {
      next: () => this.router.navigate( ['/'] ),
      error: () => this.router.navigate( ['/'] )
    } );
  }
}
