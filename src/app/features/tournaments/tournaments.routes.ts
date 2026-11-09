import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const TOURNAMENT_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Tournaments',
    loadComponent: () => import('./pages/tournaments-list.page').then((m) => m.TournamentsListPage),
  },
  {
    path: 'new',
    title: 'New tournament',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/create-tournament.page').then((m) => m.CreateTournamentPage),
  },
  {
    path: ':tournamentId',
    loadComponent: () => import('./pages/tournament-shell.page').then((m) => m.TournamentShellPage),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Tournament overview',
        loadComponent: () => import('./pages/overview.page').then((m) => m.OverviewPage),
      },
      {
        path: 'teams',
        title: 'Tournament teams',
        loadComponent: () => import('./pages/teams.page').then((m) => m.TeamsPage),
      },
      {
        path: 'stages',
        title: 'Tournament stages',
        loadComponent: () => import('./pages/stages.page').then((m) => m.StagesPage),
      },
      {
        path: 'matches',
        title: 'Tournament matches',
        loadComponent: () =>
          import('../matches/pages/tournament-matches.page').then((m) => m.TournamentMatchesPage),
      },
      {
        path: 'standings',
        title: 'Tournament standings',
        loadComponent: () =>
          import('../standings/pages/tournament-standings.page').then((m) => m.TournamentStandingsPage),
      },
      {
        path: 'mvp',
        title: 'Top players',
        loadComponent: () => import('../standings/pages/tournament-mvp.page').then((m) => m.TournamentMvpPage),
      },
      {
        path: 'settings',
        title: 'Tournament settings',
        canActivate: [authGuard],
        loadComponent: () => import('./pages/settings.page').then((m) => m.SettingsPage),
      },
    ],
  },
];
