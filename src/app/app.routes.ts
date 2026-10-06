import { Routes } from '@angular/router';
import { marketingRoutes } from './features/marketing/marketing.routes';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/sign-in/sign-in.component').then((m) => m.SignInComponent),
  },
  {
    path: 'auth/callback',
    loadComponent: () => import('./features/auth/auth-callback/auth-callback.component').then((m) => m.AuthCallbackComponent),
  },
  {
    path: 'mobile-handoff',
    loadComponent: () => import('./features/auth/mobile-handoff/mobile-handoff.component').then((m) => m.MobileHandoffComponent),
  },
  {
    // Sign-in wizard (web twin of maya-ios's MayaOnboardingView): "Already
    // use a TODD app? Sign in", else name, role, company, goals, then sign
    // in. /login stays a direct handoff for returning users.
    path: 'get-started',
    loadComponent: () => import('./features/get-started/get-started.component').then((m) => m.GetStartedComponent),
  },
  {
    // Maya's work: give her a job, approve what's waiting, follow progress
    // (MAYA-ORCHESTRATION-DESIGN.md, gap 6).
    path: 'work',
    loadComponent: () => import('./features/work/work.component').then((m) => m.WorkComponent),
  },
  {
    // In-app profile (shared fields/API with the iOS apps' TODDProfileKit).
    path: 'profile',
    loadComponent: () => import('./features/profile/profile.component').then((m) => m.ProfileComponent),
  },
  {
    // "Browse free, create with the app" (Ty, 2026-09-28) - shared wording
    // in @taliferro/ui/platform/get-the-app.model.ts.
    path: 'pricing',
    data: { product: 'maya' },
    loadComponent: () => import('./features/get-the-app/get-the-app.component').then((m) => m.GetTheAppComponent),
  },
  {
    path: 'help',
    loadComponent: () => import('./features/help/help.component').then((m) => m.HelpComponent),
  },
  {
    path: 'about',
    loadComponent: () => import('./features/about/about.component').then((m) => m.AboutComponent),
  },
  ...marketingRoutes,
  {
    path: '**',
    loadComponent: () =>
      import( './features/not-found/not-found.component' ).then( ( m ) => m.NotFoundComponent ),
  },
];
