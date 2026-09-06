import { Routes } from '@angular/router';
import { marketingRoutes } from './features/marketing/marketing.routes';

export const routes: Routes = [
  ...marketingRoutes,
  { path: '**', redirectTo: '' }
];
