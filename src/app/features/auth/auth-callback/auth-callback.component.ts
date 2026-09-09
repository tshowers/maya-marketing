import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MayaAuthService } from '../../../services/maya-auth.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [CommonModule],
  template: `<main class="maya-auth-card"><p *ngIf="!errorMessage">Signing you in…</p><p *ngIf="errorMessage">{{ errorMessage }}</p></main>`,
  styles: [`:host{display:block;min-height:70vh}.maya-auth-card{width:min(380px,calc(100% - 32px));margin:12vh auto;padding:32px;border:1px solid #d9dee7;border-radius:18px;background:#fff;text-align:center;color:#101828}`]
})
export class AuthCallbackComponent implements OnInit {
  errorMessage = '';
  constructor(private readonly route: ActivatedRoute, private readonly router: Router, private readonly auth: MayaAuthService) {}
  async ngOnInit(): Promise<void> {
    const token = this.route.snapshot.queryParamMap.get('token');
    const state = this.route.snapshot.queryParamMap.get('state');
    const pending = this.auth.consumePendingLogin(state);
    if (!token || !pending) { this.errorMessage = 'This sign-in session is invalid or expired. Please try again.'; return; }
    try { await this.auth.signInWithCustomToken(token); await this.router.navigateByUrl(pending.returnUrl || '/'); }
    catch (error: any) { this.errorMessage = error?.message || 'Sign-in failed. Please try again.'; }
  }
}
