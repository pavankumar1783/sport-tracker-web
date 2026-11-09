import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { MatchDetails, TournamentMvp, TournamentStandings } from '../models/api.models';
import { MatchesApi } from './api/matches.api';
import { TournamentsApi } from './api/tournaments.api';
import { MatchRef, TournamentMatches, TournamentRef } from './insights.models';

/**
 * Cross-tournament reads. The API only answers per tournament (backend gap G8), so these fan out
 * in parallel and tolerate individual failures: a failed request yields `null` / `failed: true`
 * instead of failing the whole view. Results line up with the input order.
 */
@Injectable({ providedIn: 'root' })
export class InsightsService {
  private readonly tournaments = inject(TournamentsApi);
  private readonly matches = inject(MatchesApi);

  matchLists(refs: readonly TournamentRef[]): Observable<TournamentMatches[]> {
    return this.fanOut(refs, (ref) =>
      this.matches.list(ref.id).pipe(
        map((matches): TournamentMatches => ({ tournamentId: ref.id, tournamentName: ref.name, matches, failed: false })),
        catchError(() =>
          of<TournamentMatches>({ tournamentId: ref.id, tournamentName: ref.name, matches: [], failed: true }),
        ),
      ),
    );
  }

  standings(ids: readonly number[]): Observable<(TournamentStandings | null)[]> {
    return this.fanOut(ids, (id) => this.tolerant(this.tournaments.getStandings(id)));
  }

  mvp(ids: readonly number[]): Observable<(TournamentMvp | null)[]> {
    return this.fanOut(ids, (id) => this.tolerant(this.tournaments.getMvp(id)));
  }

  matchDetails(refs: readonly MatchRef[]): Observable<(MatchDetails | null)[]> {
    return this.fanOut(refs, (ref) => this.tolerant(this.matches.get(ref.tournamentId, ref.matchId)));
  }

  private tolerant<T>(source: Observable<T>): Observable<T | null> {
    return source.pipe(catchError(() => of(null)));
  }

  private fanOut<I, T>(items: readonly I[], request: (item: I) => Observable<T>): Observable<T[]> {
    // forkJoin([]) completes without emitting, so an empty input is answered directly.
    return items.length === 0 ? of([]) : forkJoin(items.map(request));
  }
}
