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
  ...marketingRoutes,
  { path: '**', redirectTo: '' }
];
