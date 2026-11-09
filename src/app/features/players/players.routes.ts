import { Routes } from '@angular/router';

export const PLAYER_ROUTES: Routes = [
  {
    path: '',
    title: 'Players',
    loadComponent: () => import('./pages/players-list.page').then((m) => m.PlayersListPage),
  },
  {
    path: ':playerId',
    title: 'Player',
    loadComponent: () => import('./pages/player-profile.page').then((m) => m.PlayerProfilePage),
  },
];
