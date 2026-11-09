import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../config/api.config';
import { SaveTeamRequest, Team, UpdateTeamRequest } from '../../models/api.models';

/** The reusable team pool. Reads are public; create and update need the Organizer role. There is no delete: set `isActive` to false. */
@Injectable({ providedIn: 'root' })
export class TeamsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/teams`;

  /** GET /api/teams */
  list(): Observable<Team[]> {
    return this.http.get<{ teams: Team[] }>(this.baseUrl).pipe(map((r) => r.teams));
  }

  /** GET /api/teams/{id} */
  get(id: number): Observable<Team> {
    return this.http.get<Team>(`${this.baseUrl}/${id}`);
  }

  /** POST /api/teams. Duplicate names are refused (`Team.DuplicateName`). */
  create(request: SaveTeamRequest): Observable<Team> {
    return this.http.post<Team>(this.baseUrl, request);
  }

  /** PUT /api/teams/{id}: replaces name, code and the active flag. */
  update(id: number, request: UpdateTeamRequest): Observable<Team> {
    return this.http.put<Team>(`${this.baseUrl}/${id}`, request);
  }
}
