import { Routes } from '@angular/router';

import { environment } from '../../../environments/environment';

export const marketingRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import( './pages/marketing-director-session/marketing-director-session.component' ).then(
        ( m ) => m.MarketingDirectorSessionComponent
      ),
    title: environment.COMPANY_NAME + ' - Marketing Director Session'
  },
  {
    path: 'marketing-director',
    redirectTo: '',
    pathMatch: 'full'
  },
  {
    path: 'marketing-director/session',
    redirectTo: '',
    pathMatch: 'full'
  },
  {
    path: 'marketing-employee',
    loadComponent: () =>
      import( './pages/marketing-employee-home/marketing-employee-home.component' ).then(
        ( m ) => m.MarketingEmployeeHomeComponent
      ),
    data: {
      pageVideo: 'global'
    },
    title: environment.COMPANY_NAME + ' - Marketing Employee'
  },
  {
    path: 'marketing-employee/plan',
    loadComponent: () =>
      import( './pages/marketing-plan-board/marketing-plan-board.component' ).then(
        ( m ) => m.MarketingPlanBoardComponent
      ),
    title: environment.COMPANY_NAME + ' - Marketing Plan'
  }
];
