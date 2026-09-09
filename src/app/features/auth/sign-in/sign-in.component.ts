import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MayaAuthService } from '../../../services/maya-auth.service';

@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [CommonModule],
  template: `<main class="maya-auth-card"><h1>Sign in to Maya</h1><p>Maya uses your shared TODD account.</p><button type="button" (click)="signIn()" [disabled]="isSigningIn">{{ isSigningIn ? 'Redirecting…' : 'Sign in with TODD' }}</button></main>`,
  styles: [`:host{display:block;min-height:70vh}.maya-auth-card{width:min(380px,calc(100% - 32px));margin:12vh auto;padding:32px;border:1px solid #d9dee7;border-radius:18px;background:#fff;box-shadow:0 20px 55px #0b12201a;text-align:center;color:#101828}.maya-auth-card button{width:100%;padding:12px 16px;border:0;border-radius:10px;background:#111827;color:#fff;font-weight:700;cursor:pointer}.maya-auth-card button:disabled{opacity:.6}`]
})
export class SignInComponent implements OnInit {
  isSigningIn = false;
  private returnUrl = '/';
  constructor(private readonly route: ActivatedRoute, private readonly auth: MayaAuthService) {}
  ngOnInit(): void { this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/'; }
  signIn(): void { this.isSigningIn = true; this.auth.signIn(this.returnUrl); }
}
