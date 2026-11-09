import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../config/api.config';
import { Sport } from '../../models/api.models';

@Injectable({ providedIn: 'root' })
export class SportsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** GET /api/sports */
  getSports(): Observable<Sport[]> {
    return this.http.get<{ sports: Sport[] }>(`${this.baseUrl}/sports`).pipe(map((r) => r.sports));
  }
}
