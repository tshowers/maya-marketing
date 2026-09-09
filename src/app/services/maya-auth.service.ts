import { Injectable } from '@angular/core';
import { getAuth, onAuthStateChanged, signInWithCustomToken, signOut, User } from 'firebase/auth';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MayaAuthService {
  private readonly pendingLoginStorageKey = 'maya_hosted_login_pending';

  getUser(): Observable<User | null> {
    return new Observable((subscriber) => onAuthStateChanged(getAuth(), (user) => subscriber.next(user)));
  }

  signIn(returnUrl = '/'): void {
    const state = crypto.randomUUID();
    sessionStorage.setItem(this.pendingLoginStorageKey, JSON.stringify({ state, returnUrl }));
    const client = location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? 'maya-web-local' : 'maya-web';
    window.location.href = `https://todd.taliferro.tech/login?client=${client}&state=${encodeURIComponent(state)}`;
  }

  consumePendingLogin(state: string | null): { returnUrl?: string } | null {
    const raw = sessionStorage.getItem(this.pendingLoginStorageKey);
    sessionStorage.removeItem(this.pendingLoginStorageKey);
    if (!raw || !state) return null;
    try {
      const pending = JSON.parse(raw) as { state: string; returnUrl?: string };
      return pending.state === state ? { returnUrl: pending.returnUrl } : null;
    } catch {
      return null;
    }
  }

  signInWithCustomToken(token: string): Promise<User> {
    return signInWithCustomToken(getAuth(), token).then((result) => result.user);
  }

  signOut(): Promise<void> {
    return signOut(getAuth());
  }
}
