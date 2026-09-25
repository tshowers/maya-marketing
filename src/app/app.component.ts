import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { environment } from '../environments/environment';
import { AuthService } from './services/auth.service';
import { CommandPaletteComponent } from './shared/page/command-palette/command-palette.component';
import { NotificationComponent } from './shared/page/notification/notification.component';
import { PlatformMenuComponent } from './shared/platform-menu/platform-menu.component';

@Component({
  selector: 'maya-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, AsyncPipe, CommandPaletteComponent, NotificationComponent, PlatformMenuComponent],
  template: `
    <div class="maya-session-indicator" [class.maya-session-indicator--logged-out]="!(isLoggedIn$ | async)" [attr.title]="(isLoggedIn$ | async) ? 'Logged in' : 'Not logged in'" [attr.aria-label]="(isLoggedIn$ | async) ? 'Logged in' : 'Not logged in'"><span></span></div>
    <app-platform-menu [isAdmin]="(isAdmin$ | async) ?? false" />
    <app-command-palette />
    <app-notification />
    <router-outlet />
    <nav class="maya-shared-bottom-nav" aria-label="Maya navigation">
      <a *ngIf="isChatHome; else internalHome" href="https://ask.taliferro.tech"><i class="fa-solid fa-house" aria-hidden="true"></i><span>Home</span></a>
      <ng-template #internalHome><a routerLink="/"><i class="fa-solid fa-house" aria-hidden="true"></i><span>Home</span></a></ng-template>
      <a routerLink="/marketing-employee" routerLinkActive="maya-shared-bottom-nav__active" [routerLinkActiveOptions]="{ exact: true }" title="View Status"><i class="fa-solid fa-chart-line" aria-hidden="true"></i><span>Status</span></a>
      <a routerLink="/marketing-employee/plan" routerLinkActive="maya-shared-bottom-nav__active" [routerLinkActiveOptions]="{ exact: true }" title="View Plan"><i class="fa-regular fa-clipboard" aria-hidden="true"></i><span>Plan</span></a>
      <a routerLink="/help" routerLinkActive="maya-shared-bottom-nav__active" [routerLinkActiveOptions]="{ exact: true }" title="Help"><i class="fa-regular fa-circle-question" aria-hidden="true"></i><span>Help</span></a>
      <a routerLink="/about" routerLinkActive="maya-shared-bottom-nav__active" [routerLinkActiveOptions]="{ exact: true }" title="About"><i class="fa-regular fa-circle-info" aria-hidden="true"></i><span>About</span></a>
      <ng-container *ngIf="isLoggedIn$ | async; else signInLink">
        <button type="button" class="maya-shared-session-action" (click)="signOut()"><i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i><span class="maya-shared-session-label"><span class="maya-shared-session-dot maya-shared-session-dot--in"></span>Sign Out</span></button>
      </ng-container>
      <ng-template #signInLink><a routerLink="/login" class="maya-shared-session-action"><i class="fa-solid fa-right-to-bracket" aria-hidden="true"></i><span class="maya-shared-session-label"><span class="maya-shared-session-dot maya-shared-session-dot--out"></span>Sign In</span></a></ng-template>
    </nav>
  `,
  styleUrl: './app.component.css'
})
export class AppComponent {
  private readonly authService = inject( AuthService );
  private readonly router = inject( Router );
  readonly isLoggedIn$ = this.authService.getUser().pipe( map( user => !!user ) );
  readonly isAdmin$ = this.authService.getUser().pipe( map( user => user?.uid === environment.taliferroTenantId ) );

  get isChatHome (): boolean {
    return this.router.url.split( '?' )[0].split( '#' )[0] === '/';
  }

  signOut (): void {
    this.authService.logout().subscribe( {
      next: () => this.router.navigate( ['/login'] ),
      error: () => this.router.navigate( ['/login'] )
    } );
  }
}
