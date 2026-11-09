import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom, forkJoin } from 'rxjs';
import { ApiError } from '../models/api-error';
import { Tournament, TournamentRole } from '../models/api.models';
import { TournamentsApi } from './api/tournaments.api';
import { AuthService } from './auth.service';

/**
 * Session-wide cache of every tournament with its teams and rosters. `GET /api/tournaments`
 * returns the list (with team counts only); the rosters that the dashboard, matches, team and
 * player views need come from one `GET /api/tournaments/{id}` per tournament, fetched in parallel.
 * Call `load(true)` after anything that changes a tournament.
 */
@Injectable({ providedIn: 'root' })
export class TournamentDirectory {
  private readonly api = inject(TournamentsApi);
  private readonly auth = inject(AuthService);

  readonly tournaments = signal<Tournament[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly error = signal<ApiError | null>(null);

  /** The signed-in user's relationship to tournaments (`?mine=true`): tournament id to roles. Empty for guests. */
  readonly myRoles = signal<ReadonlyMap<number, readonly TournamentRole[]>>(new Map());

  private inFlight: Promise<void> | null = null;

  constructor() {
    // Follow sign-in and sign-out so "my tournaments" is always the current user's.
    effect(() => {
      const signedIn = this.auth.isSignedIn();
      untracked(() => (signedIn ? void this.refreshMine() : this.myRoles.set(new Map())));
    });
  }

  /** Reloads which tournaments the signed-in user organizes or plays in. A failure just leaves the list empty. */
  async refreshMine(): Promise<void> {
    if (!this.auth.isSignedIn()) {
      this.myRoles.set(new Map());
      return;
    }
    try {
      const mine = await firstValueFrom(this.api.list(true));
      this.myRoles.set(new Map(mine.map((t) => [t.id, t.myRoles])));
    } catch {
      this.myRoles.set(new Map());
    }
  }

  /** Loads once; pass `force` to reload (for example after creating a tournament). */
  load(force = false): Promise<void> {
    if (this.inFlight) {
      return this.inFlight;
    }
    if (this.loaded() && !force) {
      return Promise.resolve();
    }

    this.loading.set(true);
    this.error.set(null);
    this.inFlight = this.fetchAll()
      .then((tournaments) => {
        this.tournaments.set(tournaments);
        this.loaded.set(true);
        if (force) {
          void this.refreshMine();
        }
      })
      .catch((error: unknown) => this.error.set(ApiError.from(error)))
      .finally(() => {
        this.loading.set(false);
        this.inFlight = null;
      });
    return this.inFlight;
  }

  private async fetchAll(): Promise<Tournament[]> {
    const items = await firstValueFrom(this.api.list());
    if (items.length === 0) {
      return [];
    }
    const details = await firstValueFrom(forkJoin(items.map((item) => this.api.get(item.id))));
    return details.sort((a, b) => b.id - a.id);
  }
}
