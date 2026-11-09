import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../config/api.config';
import {
  CompleteTournamentResult,
  ConfigureMatchSettingsRequest,
  ConfigureTournamentRequest,
  ConfigureTournamentResult,
  CreateTournamentRequest,
  MatchSettings,
  RegisterTeamRequest,
  RegisterTeamResult,
  Tournament,
  TournamentDashboard,
  TournamentListItem,
  TournamentMvp,
  TournamentStages,
  TournamentStandings,
  TournamentSummary,
  UpdateTournamentTeamRequest,
  UpdateTournamentTeamResult,
} from '../../models/api.models';
import {
  ResultEnvelope,
  WireOf,
  mapCompleteTournament,
  mapDashboard,
  mapRegisterTeam,
  mapStages,
  mapTournament,
  mapTournamentListItem,
  mapTournamentSummary,
  unwrap,
} from './mappers';

type WireSummary = WireOf<typeof mapTournamentSummary>;

@Injectable({ providedIn: 'root' })
export class TournamentsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/tournaments`;

  /**
   * GET /api/tournaments: every tournament, newest first, with its team count. With `mine` (needs
   * a signed-in user, else 401 `Auth.Required`) only tournaments the user organizes or plays in,
   * each with `myRoles`.
   */
  list(mine = false): Observable<TournamentListItem[]> {
    const params = mine ? new HttpParams().set('mine', 'true') : undefined;
    return this.http
      .get<{ tournaments: WireOf<typeof mapTournamentListItem>[] }>(this.baseUrl, { params })
      .pipe(map((r) => r.tournaments.map(mapTournamentListItem)));
  }

  /** PUT /api/tournaments/{id}/teams/{tournamentTeamId}: renames a team for this tournament (organizer only). */
  updateTeam(
    id: number,
    tournamentTeamId: number,
    request: UpdateTournamentTeamRequest,
  ): Observable<UpdateTournamentTeamResult> {
    return this.http.put<UpdateTournamentTeamResult>(`${this.baseUrl}/${id}/teams/${tournamentTeamId}`, request);
  }

  /** GET /api/tournaments/{id}: details with teams and rosters. */
  get(id: number): Observable<Tournament> {
    return this.http.get<WireOf<typeof mapTournament>>(`${this.baseUrl}/${id}`).pipe(map(mapTournament));
  }

  /** POST /api/tournaments */
  create(request: CreateTournamentRequest): Observable<TournamentSummary> {
    return this.http.post<WireSummary>(this.baseUrl, request).pipe(map(mapTournamentSummary));
  }

  /** POST /api/tournaments/{id}/registration/open. The backend answers with a value-less `Result` (no payload). */
  openRegistration(id: number): Observable<void> {
    return this.http
      .post<Omit<ResultEnvelope<never>, 'value'>>(`${this.baseUrl}/${id}/registration/open`, {})
      .pipe(map(() => undefined));
  }

  /** POST /api/tournaments/{id}/teams */
  registerTeam(id: number, request: RegisterTeamRequest): Observable<RegisterTeamResult> {
    return this.http
      .post<WireOf<typeof mapRegisterTeam>>(`${this.baseUrl}/${id}/teams`, request)
      .pipe(map(mapRegisterTeam));
  }

  /** POST /api/tournaments/{id}/configure: creates the stages for the chosen format. */
  configure(id: number, request: ConfigureTournamentRequest): Observable<ConfigureTournamentResult> {
    return this.http.post<ConfigureTournamentResult>(`${this.baseUrl}/${id}/configure`, request);
  }

  /** POST /api/tournaments/{id}/start (Result envelope) */
  start(id: number): Observable<TournamentSummary> {
    return this.http
      .post<ResultEnvelope<WireSummary>>(`${this.baseUrl}/${id}/start`, {})
      .pipe(unwrap(), map(mapTournamentSummary));
  }

  /** POST /api/tournaments/{id}/complete */
  complete(id: number): Observable<CompleteTournamentResult> {
    return this.http
      .post<WireOf<typeof mapCompleteTournament>>(`${this.baseUrl}/${id}/complete`, {})
      .pipe(map(mapCompleteTournament));
  }

  /** GET /api/tournaments/{id}/stages */
  getStages(id: number): Observable<TournamentStages> {
    return this.http.get<WireOf<typeof mapStages>>(`${this.baseUrl}/${id}/stages`).pipe(map(mapStages));
  }

  /** GET /api/tournaments/{id}/dashboard */
  getDashboard(id: number): Observable<TournamentDashboard> {
    return this.http.get<WireOf<typeof mapDashboard>>(`${this.baseUrl}/${id}/dashboard`).pipe(map(mapDashboard));
  }

  /** GET /api/tournaments/{id}/standings */
  getStandings(id: number): Observable<TournamentStandings> {
    return this.http.get<TournamentStandings>(`${this.baseUrl}/${id}/standings`);
  }

  /** GET /api/tournaments/{id}/mvp */
  getMvp(id: number): Observable<TournamentMvp> {
    return this.http.get<TournamentMvp>(`${this.baseUrl}/${id}/mvp`);
  }

  /** GET /api/tournaments/{id}/match-settings */
  getMatchSettings(id: number): Observable<MatchSettings> {
    return this.http.get<MatchSettings>(`${this.baseUrl}/${id}/match-settings`);
  }

  /** PUT /api/tournaments/{id}/match-settings */
  configureMatchSettings(id: number, request: ConfigureMatchSettingsRequest): Observable<void> {
    return this.http.put<unknown>(`${this.baseUrl}/${id}/match-settings`, request).pipe(map(() => undefined));
  }
}
