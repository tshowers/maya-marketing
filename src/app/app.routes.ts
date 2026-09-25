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
    path: 'help',
    loadComponent: () => import('./features/help/help.component').then((m) => m.HelpComponent),
  },
  {
    path: 'about',
    loadComponent: () => import('./features/about/about.component').then((m) => m.AboutComponent),
  },
  ...marketingRoutes,
  { path: '**', redirectTo: '' }
];
