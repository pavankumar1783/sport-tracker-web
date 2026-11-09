import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';

/**
 * Route map (each feature owns its own `*.routes.ts`):
 *   /dashboard
 *   /tournaments, /tournaments/new, /tournaments/:tournamentId/{teams|stages|matches|standings|mvp|settings}
 *   /matches, /matches/new, /matches/:tournamentId/:matchId
 *   /scoring/:tournamentId/:matchId
 *   /teams, /teams/:teamId   /players, /players/:playerId   /statistics
 *   /sign-in (email code)   /profile (signed in)
 */
export const routes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Dashboard',
        loadChildren: () => import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
      {
        path: 'tournaments',
        loadChildren: () => import('./features/tournaments/tournaments.routes').then((m) => m.TOURNAMENT_ROUTES),
      },
      {
        path: 'matches',
        loadChildren: () => import('./features/matches/matches.routes').then((m) => m.MATCH_ROUTES),
      },
      {
        path: 'scoring',
        loadChildren: () => import('./features/scoring/scoring.routes').then((m) => m.SCORING_ROUTES),
      },
      {
        path: 'teams',
        loadChildren: () => import('./features/teams/teams.routes').then((m) => m.TEAM_ROUTES),
      },
      {
        path: 'players',
        loadChildren: () => import('./features/players/players.routes').then((m) => m.PLAYER_ROUTES),
      },
      {
        path: 'statistics',
        title: 'Statistics',
        loadChildren: () => import('./features/statistics/statistics.routes').then((m) => m.STATISTICS_ROUTES),
      },
      {
        path: 'profile',
        title: 'My profile',
        canActivate: [authGuard],
        loadComponent: () => import('./features/profile/profile.page').then((m) => m.ProfilePage),
      },
      {
        path: 'sign-in',
        title: 'Organizer sign in',
        loadComponent: () => import('./features/auth/sign-in.page').then((m) => m.SignInPage),
      },
      {
        path: '**',
        title: 'Page not found',
        loadComponent: () => import('./features/not-found/not-found.page').then((m) => m.NotFoundPage),
      },
    ],
  },
];
