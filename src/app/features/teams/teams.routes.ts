import { Routes } from '@angular/router';

export const TEAM_ROUTES: Routes = [
  {
    path: '',
    title: 'Teams',
    loadComponent: () => import('./pages/teams-list.page').then((m) => m.TeamsListPage),
  },
  {
    path: ':teamId',
    title: 'Team',
    loadComponent: () => import('./pages/team-detail.page').then((m) => m.TeamDetailPage),
  },
];
