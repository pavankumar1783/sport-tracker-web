import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../config/api.config';
import {
  CreateMatchRequest,
  CreateMatchResult,
  GameSummary,
  MatchDetails,
  MatchListItem,
  MatchOutcome,
  RecordGameScoreRequest,
  RecordGameScoreResult,
  StartMatchResult,
} from '../../models/api.models';
import {
  ResultEnvelope,
  WireOf,
  mapCreateMatch,
  mapGameSummary,
  mapMatchDetails,
  mapMatchListItem,
  mapOutcome,
  mapScoreResult,
  mapStartMatch,
  unwrap,
} from './mappers';

@Injectable({ providedIn: 'root' })
export class MatchesApi {
  private readonly http = inject(HttpClient);
  private readonly root = inject(API_BASE_URL);

  private url(tournamentId: number, path = ''): string {
    return `${this.root}/tournaments/${tournamentId}/matches${path}`;
  }

  /** GET /api/tournaments/{id}/matches */
  list(tournamentId: number): Observable<MatchListItem[]> {
    return this.http
      .get<WireOf<typeof mapMatchListItem>[]>(this.url(tournamentId))
      .pipe(map((items) => items.map(mapMatchListItem)));
  }

  /** GET /api/tournaments/{id}/matches/{matchId} */
  get(tournamentId: number, matchId: number): Observable<MatchDetails> {
    return this.http
      .get<WireOf<typeof mapMatchDetails>>(this.url(tournamentId, `/${matchId}`))
      .pipe(map(mapMatchDetails));
  }

  /** POST /api/tournaments/{id}/matches (Result envelope) */
  create(tournamentId: number, request: CreateMatchRequest): Observable<CreateMatchResult> {
    return this.http
      .post<ResultEnvelope<WireOf<typeof mapCreateMatch>>>(this.url(tournamentId), request)
      .pipe(unwrap(), map(mapCreateMatch));
  }

  /** POST /api/tournaments/{id}/matches/{matchId}/start (Result envelope) */
  start(tournamentId: number, matchId: number): Observable<StartMatchResult> {
    return this.http
      .post<ResultEnvelope<WireOf<typeof mapStartMatch>>>(this.url(tournamentId, `/${matchId}/start`), {})
      .pipe(unwrap(), map(mapStartMatch));
  }

  /** POST /api/tournaments/{id}/matches/{matchId}/games (Result envelope) */
  createGame(tournamentId: number, matchId: number): Observable<GameSummary> {
    return this.http
      .post<ResultEnvelope<WireOf<typeof mapGameSummary>>>(this.url(tournamentId, `/${matchId}/games`), {})
      .pipe(unwrap(), map(mapGameSummary));
  }

  /** POST /api/tournaments/{id}/matches/{matchId}/games/{gameId}/start (Result envelope) */
  startGame(tournamentId: number, matchId: number, gameId: number): Observable<GameSummary> {
    return this.http
      .post<ResultEnvelope<WireOf<typeof mapGameSummary>>>(
        this.url(tournamentId, `/${matchId}/games/${gameId}/start`),
        {},
      )
      .pipe(unwrap(), map(mapGameSummary));
  }

  /** POST /api/tournaments/{id}/matches/{matchId}/games/{gameId}/score (Result envelope). Final score of one game. */
  recordScore(
    tournamentId: number,
    matchId: number,
    gameId: number,
    request: RecordGameScoreRequest,
  ): Observable<RecordGameScoreResult> {
    return this.http
      .post<ResultEnvelope<WireOf<typeof mapScoreResult>>>(
        this.url(tournamentId, `/${matchId}/games/${gameId}/score`),
        request,
      )
      .pipe(unwrap(), map(mapScoreResult));
  }

  /** POST /api/tournaments/{id}/matches/{matchId}/walkover */
  walkover(tournamentId: number, matchId: number, winnerSideNumber: 1 | 2): Observable<MatchOutcome> {
    return this.http
      .post<WireOf<typeof mapOutcome>>(this.url(tournamentId, `/${matchId}/walkover`), { winnerSideNumber })
      .pipe(map(mapOutcome));
  }

  /** POST /api/tournaments/{id}/matches/{matchId}/cancel */
  cancel(tournamentId: number, matchId: number): Observable<MatchOutcome> {
    return this.http
      .post<WireOf<typeof mapOutcome>>(this.url(tournamentId, `/${matchId}/cancel`), {})
      .pipe(map(mapOutcome));
  }
}
