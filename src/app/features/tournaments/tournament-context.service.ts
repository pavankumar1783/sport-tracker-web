import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { Tournament } from '../../core/models/api.models';
import { TournamentsApi } from '../../core/services/api/tournaments.api';
import { AuthService } from '../../core/services/auth.service';
import { TournamentDirectory } from '../../core/services/tournament-directory.service';
import { AsyncState } from '../../core/state/async-state';
import { LifecycleActionKind } from './tournament-logic';

/** Provided by `TournamentShellPage`; tab pages read the current tournament from here. */
@Injectable()
export class TournamentContext {
  private readonly api = inject(TournamentsApi);
  private readonly auth = inject(AuthService);

  readonly id = signal<number | null>(null);
  readonly state = new AsyncState<Tournament>();

  /** The signed-in user is this tournament's organizer, or a site admin. Drives which actions are offered; the API still enforces it. */
  readonly canManage = computed(() => this.auth.canManage(this.state.data()?.organizerUserId));

  setId(id: number): void {
    if (this.id() === id) {
      return;
    }
    this.id.set(id);
    this.state.load(this.api.get(id), { keepData: false });
  }

  reload(): void {
    const id = this.id();
    if (id !== null) {
      this.state.load(this.api.get(id));
    }
  }
}

/** Runs lifecycle transitions and keeps the shared tournament list fresh. */
@Injectable({ providedIn: 'root' })
export class TournamentLifecycle {
  private readonly api = inject(TournamentsApi);
  private readonly directory = inject(TournamentDirectory);

  run(kind: LifecycleActionKind, id: number): Observable<void> {
    return this.call(kind, id).pipe(
      tap(() => void this.directory.load(true)),
      map(() => undefined),
    );
  }

  private call(kind: LifecycleActionKind, id: number): Observable<unknown> {
    switch (kind) {
      case 'openRegistration':
        return this.api.openRegistration(id);
      case 'start':
        return this.api.start(id);
      case 'complete':
        return this.api.complete(id);
    }
  }
}
