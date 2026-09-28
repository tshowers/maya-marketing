import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, firstValueFrom, take } from 'rxjs';
import { MayaAuthService } from '../../../services/maya-auth.service';

/**
 * Lands here when a native TODD app (via TODDAuthKit's WebHandoff) hands
 * off to a page on this app, already signed in - the "Real Token Handoff"
 * feature. Unlike AuthCallbackComponent (which completes this app's own
 * hosted-login redirect and checks a pre-stashed `state` value as a CSRF
 * guard against a forged callback), a native app opens this URL directly
 * with no prior visit to this origin, so there's no pending entry to check
 * the token against - the short-lived, single-exchange custom token itself
 * is the credential, minted server-side
 * (`POST /api/mobile/auth/web-handoff-token`, `mobileAuthRoutes.js` in the
 * main taliferrotech repo) only for an already-authenticated native-app
 * caller. Mirrors web-products/outreach's, docs' and network's own
 * mobile-handoff.component.ts. Without this route, an unmatched
 * `/mobile-handoff` request fell through to this app's `**` catch-all and
 * silently redirected to `/` without ever signing in.
 */
@Component({
  selector: 'app-mobile-handoff',
  standalone: true,
  imports: [CommonModule],
  template: `<main class="maya-auth-card"><p *ngIf="!errorMessage">Signing you in…</p><p *ngIf="errorMessage">{{ errorMessage }}</p></main>`,
  styles: [`:host{display:block;min-height:70vh}.maya-auth-card{width:min(380px,calc(100% - 32px));margin:12vh auto;padding:32px;border:1px solid #d9dee7;border-radius:18px;background:#fff;text-align:center;color:#101828}`]
})
export class MobileHandoffComponent implements OnInit {
  errorMessage = '';
  constructor(private readonly route: ActivatedRoute, private readonly router: Router, private readonly auth: MayaAuthService) {}

  async ngOnInit(): Promise<void> {
    const token = this.route.snapshot.queryParamMap.get('token');
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/';

    if (!token) {
      this.errorMessage = 'This sign-in link is missing a token.';
      return;
    }

    try {
      await this.auth.signInWithCustomToken(token);
      // signInWithCustomToken's promise resolves before Firebase's own
      // onAuthStateChanged listener fires - navigating immediately after
      // the promise risks the next route's component mounting before
      // getUser() reflects the sign-in. Waiting for the real emission
      // here closes that race.
      await firstValueFrom(this.auth.getUser().pipe(filter((user) => !!user), take(1)));
      await this.router.navigateByUrl(returnUrl);
    } catch (error: any) {
      this.errorMessage = 'This sign-in link has expired. Please open the app again.';
    }
  }
}
