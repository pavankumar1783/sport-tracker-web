import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const SCORING_ROUTES: Routes = [
  {
    path: ':tournamentId/:matchId',
    title: 'Live scoring',
    canActivate: [authGuard],
    loadComponent: () => import('./live-scoring.page').then((m) => m.LiveScoringPage),
  },
];
