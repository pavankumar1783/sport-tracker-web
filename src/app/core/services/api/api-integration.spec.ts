import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { authInterceptor } from '../../interceptors/auth.interceptor';
import { errorInterceptor } from '../../interceptors/error.interceptor';
import { ApiError } from '../../models/api-error';
import { AuthService } from '../auth.service';
import { MatchesApi } from './matches.api';
import { SportsApi } from './sports.api';
import { TournamentsApi } from './tournaments.api';

function jwt(payload: Record<string, unknown>): string {
  const part = (v: unknown) => btoa(JSON.stringify(v)).replace(/=+$/, '');
  return `${part({ alg: 'none' })}.${part(payload)}.sig`;
}

describe('API services against the real backend contract', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('GET /api/tournaments/{id} normalises string statuses and keeps rosters', () => {
    let result: unknown;
    TestBed.inject(TournamentsApi)
      .get(3)
      .subscribe((t) => (result = t));

    http.expectOne('/api/tournaments/3').flush({
      id: 3,
      sportId: 1,
      sportName: 'Table Tennis',
      name: 'Spring Open',
      status: 'Registration',
      rosterSize: 4,
      startDate: null,
      endDate: null,
      createdAt: '2026-11-01T10:00:00',
      organizerUserId: 7,
      teams: [
        {
          tournamentTeamId: 7,
          teamId: 2,
          teamName: 'Spin Doctors',
          teamCode: 'SPD',
          seed: null,
          status: 'Registered',
          players: [{ playerId: 11, name: 'Ana', position: 1, joinedAt: '2026-11-01T10:00:00' }],
        },
      ],
    });

    expect(result).toMatchObject({
      status: 'Registration',
      organizerUserId: 7,
      teams: [{ status: 'Registered', players: [{ name: 'Ana' }] }],
    });
  });

  it('unwraps the Result envelope and maps numeric enums (open registration, create match)', () => {
    const tournaments = TestBed.inject(TournamentsApi);
    const matches = TestBed.inject(MatchesApi);
    const seen: unknown[] = [];

    tournaments.start(3).subscribe((r) => seen.push(r));
    http
      .expectOne({ method: 'POST', url: '/api/tournaments/3/start' })
      .flush({ isSuccess: true, isFailure: false, errors: [], value: { id: 3, name: 'Spring Open', status: 2 } });

    // The registration/open endpoint returns a value-less Result: success must not be treated as empty.
    let opened = false;
    tournaments.openRegistration(3).subscribe(() => (opened = true));
    http
      .expectOne({ method: 'POST', url: '/api/tournaments/3/registration/open' })
      .flush({ isSuccess: true, isFailure: false, errors: [] });
    expect(opened).toBe(true);

    matches
      .create(3, {
        tournamentStageId: 5,
        sportFormatId: null,
        scoringRuleId: null,
        matchType: 'Regular',
        name: null,
        side1: { tournamentTeamId: 7, playerIds: [11] },
        side2: { tournamentTeamId: 8, playerIds: [12] },
      })
      .subscribe((r) => seen.push(r));
    const create = http.expectOne({ method: 'POST', url: '/api/tournaments/3/matches' });
    expect(create.request.body.side1).toEqual({ tournamentTeamId: 7, playerIds: [11] });
    create.flush({
      isSuccess: true,
      isFailure: false,
      errors: [],
      value: { id: 40, tournamentId: 3, tournamentStageId: 5, sportFormatId: 1, scoringRuleId: 2, matchNumber: 1, name: null, matchType: 0, status: 0, sides: [] },
    });

    expect(seen[0]).toMatchObject({ id: 3, status: 'Active' });
    expect(seen[1]).toMatchObject({ id: 40, matchType: 'Regular', status: 'Scheduled' });
  });

  it('POST score sends the final scores and maps the outcome', () => {
    let outcome: unknown;
    TestBed.inject(MatchesApi)
      .recordScore(3, 40, 90, { side1Score: 11, side2Score: 7 })
      .subscribe((r) => (outcome = r));

    const request = http.expectOne({ method: 'POST', url: '/api/tournaments/3/matches/40/games/90/score' });
    expect(request.request.body).toEqual({ side1Score: 11, side2Score: 7 });
    request.flush({
      isSuccess: true,
      isFailure: false,
      errors: [],
      value: { gameId: 90, matchId: 40, gameNumber: 1, side1Score: 11, side2Score: 7, gameStatus: 2, gameWinnerSideId: 500, matchStatus: 1, matchWinnerSideId: null },
    });

    expect(outcome).toMatchObject({ gameStatus: 'Completed', matchStatus: 'InProgress', gameWinnerSideId: 500 });
  });

  it('walkover and cancel results map the status; cancel has no winner', () => {
    const matches = TestBed.inject(MatchesApi);
    const seen: unknown[] = [];
    matches.walkover(3, 40, 2).subscribe((r) => seen.push(r));
    const walkover = http.expectOne('/api/tournaments/3/matches/40/walkover');
    expect(walkover.request.body).toEqual({ winnerSideNumber: 2 });
    walkover.flush({ id: 40, tournamentId: 3, status: 4, winnerSideId: 501, completedAt: '2026-11-03T10:00:00' });

    matches.cancel(3, 41).subscribe((r) => seen.push(r));
    http.expectOne('/api/tournaments/3/matches/41/cancel').flush({ id: 41, tournamentId: 3, status: 3 });

    expect(seen).toEqual([
      { id: 40, tournamentId: 3, status: 'Walkover', winnerSideId: 501 },
      { id: 41, tournamentId: 3, status: 'Cancelled', winnerSideId: null },
    ]);
  });

  it('turns ProblemDetails into ApiError with the backend code', () => {
    let error: unknown;
    TestBed.inject(TournamentsApi)
      .get(999)
      .subscribe({ error: (e) => (error = e) });

    http.expectOne('/api/tournaments/999').flush(
      { status: 404, title: 'Unable to get tournament', detail: 'Tournament 999 was not found.', code: 'Tournament.NotFound' },
      { status: 404, statusText: 'Not Found' },
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, code: 'Tournament.NotFound', isNotFound: true });
  });

  it('sends the bearer token to the API only, and drops it on 401', () => {
    const auth = TestBed.inject(AuthService);
    auth.startSession(jwt({ sub: '7', name: 'Asha', role: 'User', exp: Math.floor(Date.now() / 1000) + 600 }));

    TestBed.inject(SportsApi).getSports().subscribe();
    const authorised = http.expectOne('/api/sports');
    expect(authorised.request.headers.get('Authorization')).toMatch(/^Bearer /);
    authorised.flush({ sports: [] });

    TestBed.inject(TournamentsApi)
      .start(1)
      .subscribe({ error: () => undefined });
    http.expectOne('/api/tournaments/1/start').flush({ title: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.isSignedIn()).toBe(false);
  });
});
