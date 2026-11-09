import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const MATCH_ROUTES: Routes = [
  {
    path: '',
    title: 'Matches',
    loadComponent: () => import('./pages/match-list.page').then((m) => m.MatchListPage),
  },
  {
    path: 'new',
    title: 'New match',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/create-match.page').then((m) => m.CreateMatchPage),
  },
  {
    path: ':tournamentId/:matchId',
    title: 'Match scorecard',
    loadComponent: () => import('./pages/match-detail.page').then((m) => m.MatchDetailPage),
  },
];
