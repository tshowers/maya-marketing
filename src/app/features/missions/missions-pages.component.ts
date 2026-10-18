import { Component, Directive, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { PlanReplyComponent } from '../../shared/missions/plan-reply.component';

/**
 * Missions from Maya (design_handoff_todd_missions 1e): work that needs more
 * than marketing gets a plan with an owner on every step - Maya's, TODD's and
 * yours. A started Mission lives in Moves. Shared taliferro-ui/missions screens.
 */
@Directive()
abstract class SignedInPage implements OnInit {
  protected readonly auth = inject( AuthService );
  readonly signedIn = signal<boolean | null>( null );
  readonly viewerId = signal( '' );

  ngOnInit (): void {
    this.auth.isLoggedIn().subscribe( ( yes ) => {
      this.signedIn.set( yes );
      if ( yes ) this.viewerId.set( this.auth.getCurrentUserIdSync() || '' );
    } );
  }
}

const STYLES = `
  :host { display: block; min-height: 100vh; background: var(--bg); color: var(--text); font-family: var(--font); }
  .page { max-width: 1100px; margin: 0 auto; padding: 28px 36px 64px; display: flex; flex-direction: column; gap: 20px; }
  .wide { max-width: 1280px; }
  .top { display: flex; align-items: center; gap: 14px; font-size: 14px; font-weight: 700; }
  .top a { color: var(--text); text-decoration: none; }
  .spacer { flex: 1; }
  h1 { margin: 0; font-size: 34px; font-weight: 700; letter-spacing: -0.04em; }
  .signin { background: var(--surface); border-radius: 24px; padding: 24px; display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
  .btn { height: 44px; padding: 0 22px; border-radius: 999px; background: var(--blue); color: #fff; font-weight: 700; display: inline-flex; align-items: center; text-decoration: none; }
  @media (max-width: 640px) { .page { padding: 20px 16px 48px; } }
`;

const SIGN_IN = `<div class="signin" data-cy="missions-signin"><b>Sign in to work with Maya.</b><a class="btn" routerLink="/login">Sign in</a></div>`;

@Component( {
  selector: 'app-maya-missions-page',
  standalone: true,
  imports: [PlanReplyComponent, RouterLink],
  template: `
    <div class="page">
      <nav class="top"><a routerLink="/work">Maya’s work</a><span class="spacer"></span><a href="https://ask.taliferro.tech/playbooks" data-cy="to-playbooks">Playbooks</a></nav>
      <h1>Plan it with Maya</h1>
      @if (signedIn() === false) { ${SIGN_IN} }
      @if (signedIn()) {
        <tm-plan-reply [request]="q()" origin="maya" agent="maya" [viewerId]="viewerId()" detailBase="https://moves.taliferro.tech/missions/" />
      }
    </div>
  `,
  styles: [STYLES],
} )
export class MayaMissionsPageComponent extends SignedInPage {
  private readonly route = inject( ActivatedRoute );
  readonly q = toSignal( this.route.queryParamMap.pipe( map( ( p ) => p.get( 'q' ) || '' ) ), { initialValue: '' } );
}

