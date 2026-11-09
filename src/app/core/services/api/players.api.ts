import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../config/api.config';
import { MyProfile, Player } from '../../models/api.models';

/**
 * Players are registered users: every account has exactly one player, created at registration.
 * Everything here needs a signed-in user. There is no endpoint to create or edit other players.
 */
@Injectable({ providedIn: 'root' })
export class PlayersApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/players`;

  /** GET /api/players?search=: players by name (part of the name, any case); no emails. */
  search(term?: string): Observable<Player[]> {
    let params = new HttpParams();
    if (term?.trim()) {
      params = params.set('search', term.trim());
    }
    return this.http.get<{ players: Player[] }>(this.baseUrl, { params }).pipe(map((r) => r.players));
  }

  /** GET /api/players/{id} */
  get(id: number): Observable<Player> {
    return this.http.get<Player>(`${this.baseUrl}/${id}`);
  }

  /** GET /api/players/me: the signed-in user's account and player (the only place an email is returned). */
  me(): Observable<MyProfile> {
    return this.http.get<MyProfile>(`${this.baseUrl}/me`);
  }

  /** PUT /api/players/me: renames the user and their player together. The email cannot be changed. */
  updateMe(name: string): Observable<MyProfile> {
    return this.http.put<MyProfile>(`${this.baseUrl}/me`, { name });
  }
}
