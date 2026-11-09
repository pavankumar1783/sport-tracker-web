import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { errorInterceptor } from '../../interceptors/error.interceptor';
import { AuthApi } from './auth.api';
import { MatchesApi } from './matches.api';
import { PlayersApi } from './players.api';
import { TeamsApi } from './teams.api';
import { TournamentsApi } from './tournaments.api';

describe('pool and list endpoints', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const listItem = {
    id: 4,
    sportId: 1,
    sportName: 'Table Tennis',
    name: 'Spring Open',
    status: 'Active',
    rosterSize: 2,
    startDate: null,
    endDate: null,
    createdAt: '2026-11-01T10:00:00',
    organizerUserId: 7,
    teamCount: 6,
    myRoles: [] as string[],
  };

  it('GET /api/tournaments maps the list, its string status and the organizer', () => {
    let result: unknown;
    TestBed.inject(TournamentsApi)
      .list()
      .subscribe((r) => (result = r));

    http.expectOne({ method: 'GET', url: '/api/tournaments' }).flush({ tournaments: [listItem] });

    expect(result).toMatchObject([{ id: 4, status: 'Active', teamCount: 6, organizerUserId: 7, myRoles: [] }]);
  });

  it('list(mine) asks for ?mine=true and keeps the roles', () => {
    let result: unknown;
    TestBed.inject(TournamentsApi)
      .list(true)
      .subscribe((r) => (result = r));

    const request = http.expectOne((r) => r.url === '/api/tournaments' && r.params.get('mine') === 'true');
    request.flush({ tournaments: [{ ...listItem, myRoles: ['Organizer', 'Player'] }] });

    expect(result).toMatchObject([{ id: 4, myRoles: ['Organizer', 'Player'] }]);
  });

  it('updateTeam renames a team for one tournament', () => {
    let result: unknown;
    TestBed.inject(TournamentsApi)
      .updateTeam(4, 12, { name: 'Red Dragons', code: null })
      .subscribe((r) => (result = r));

    const request = http.expectOne({ method: 'PUT', url: '/api/tournaments/4/teams/12' });
    expect(request.request.body).toEqual({ name: 'Red Dragons', code: null });
    request.flush({ tournamentTeamId: 12, teamId: 30, name: 'Red Dragons', code: null });

    expect(result).toMatchObject({ tournamentTeamId: 12, name: 'Red Dragons' });
  });

  it('players: search sends the term; me and updateMe use the profile endpoint', () => {
    const api = TestBed.inject(PlayersApi);
    const seen: unknown[] = [];

    api.search('  chi ').subscribe((r) => seen.push(r));
    const search = http.expectOne((r) => r.url === '/api/players' && r.params.get('search') === 'chi');
    search.flush({ players: [{ id: 3, name: 'Chitra', isActive: true }] });

    api.search().subscribe((r) => seen.push(r));
    const all = http.expectOne((r) => r.url === '/api/players');
    expect(all.request.params.has('search')).toBe(false);
    all.flush({ players: [] });

    api.updateMe('Asha R.').subscribe((r) => seen.push(r));
    const rename = http.expectOne({ method: 'PUT', url: '/api/players/me' });
    expect(rename.request.body).toEqual({ name: 'Asha R.' });
    rename.flush({ userId: 1, playerId: 5, name: 'Asha R.', email: 'asha@example.test', isOrganizer: false });

    expect(seen).toEqual([
      [{ id: 3, name: 'Chitra', isActive: true }],
      [],
      { userId: 1, playerId: 5, name: 'Asha R.', email: 'asha@example.test', isOrganizer: false },
    ]);
  });

  it('auth: request and verify send the documented bodies', () => {
    const api = TestBed.inject(AuthApi);
    const seen: unknown[] = [];

    api.requestOtp('asha@example.test').subscribe((r) => seen.push(r));
    const request = http.expectOne({ method: 'POST', url: '/api/auth/otp/request' });
    expect(request.request.body).toEqual({ email: 'asha@example.test' });
    request.flush({ expiresInSeconds: 300, resendAfterSeconds: 60 });

    api.verifyOtp({ email: 'asha@example.test', code: '123456', name: 'Asha' }).subscribe((r) => seen.push(r));
    const verify = http.expectOne({ method: 'POST', url: '/api/auth/otp/verify' });
    expect(verify.request.body).toEqual({ email: 'asha@example.test', code: '123456', name: 'Asha' });
    verify.flush({
      accessToken: 'jwt',
      expiresAt: '2026-11-05T00:00:00Z',
      user: { id: 7, name: 'Asha', email: 'asha@example.test', isOrganizer: false, isNewUser: true },
    });

    expect(seen).toMatchObject([{ expiresInSeconds: 300 }, { accessToken: 'jwt', user: { id: 7, isNewUser: true } }]);
  });

  it('surfaces User.NameRequired as an ApiError the sign-in page can react to', () => {
    let error: unknown;
    TestBed.inject(AuthApi)
      .verifyOtp({ email: 'new@example.test', code: '123456' })
      .subscribe({ error: (e) => (error = e) });

    http.expectOne('/api/auth/otp/verify').flush(
      { status: 400, title: 'Unable to sign in', detail: 'Tell us your name to finish creating your account.', code: 'User.NameRequired' },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(error).toMatchObject({ status: 400, code: 'User.NameRequired' });
  });

  it('maps a 403 Tournament.Forbidden to a clear message', () => {
    let error: unknown;
    TestBed.inject(TournamentsApi)
      .start(4)
      .subscribe({ error: (e) => (error = e) });

    http.expectOne('/api/tournaments/4/start').flush(
      { status: 403, title: 'Forbidden', detail: 'Only the organizer may do this.', code: 'Tournament.Forbidden' },
      { status: 403, statusText: 'Forbidden' },
    );

    expect(error).toMatchObject({ isForbidden: true, userMessage: "Only this tournament's organizer can do that." });
  });

  it('teams: list unwraps the collection; update replaces name, code and the active flag', () => {
    const api = TestBed.inject(TeamsApi);
    let teams: unknown;

    api.list().subscribe((r) => (teams = r));
    http
      .expectOne({ method: 'GET', url: '/api/teams' })
      .flush({ teams: [{ id: 2, name: 'Spin Doctors', code: 'SPD', isActive: true, createdAt: '2026-11-01T10:00:00' }] });
    expect(teams).toMatchObject([{ id: 2, name: 'Spin Doctors' }]);

    api.update(2, { name: 'Spin Doctors', code: null, isActive: false }).subscribe();
    const update = http.expectOne({ method: 'PUT', url: '/api/teams/2' });
    expect(update.request.body).toEqual({ name: 'Spin Doctors', code: null, isActive: false });
    update.flush({ id: 2, name: 'Spin Doctors', code: null, isActive: false, createdAt: '2026-11-01T10:00:00' });
  });

  it('surfaces duplicate-name errors from the backend with their code', () => {
    let error: unknown;
    TestBed.inject(TeamsApi)
      .create({ name: 'Aces', code: null })
      .subscribe({ error: (e) => (error = e) });

    http.expectOne('/api/teams').flush(
      { status: 400, title: 'Unable to create team', detail: 'A team named "Aces" already exists.', code: 'Team.DuplicateName' },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(error).toMatchObject({ code: 'Team.DuplicateName', message: 'A team named "Aces" already exists.' });
  });

  it('match details include the scoring rule and create sends scheduledAt', () => {
    const matches = TestBed.inject(MatchesApi);
    let details: unknown;

    matches.get(1, 5).subscribe((r) => (details = r));
    http.expectOne('/api/tournaments/1/matches/5').flush({
      id: 5,
      tournamentId: 1,
      sportFormatId: 1,
      sportFormatName: 'Singles',
      scoringRuleId: 2,
      matchNumber: 1,
      name: null,
      matchType: 0,
      status: 1,
      winnerSideId: null,
      scheduledAt: '2026-11-05T17:30:00',
      startedAt: null,
      completedAt: null,
      sides: [],
      games: [],
    });
    expect(details).toMatchObject({ scoringRuleId: 2, status: 'InProgress', scheduledAt: '2026-11-05T17:30:00' });

    matches
      .create(1, {
        tournamentStageId: 3,
        sportFormatId: null,
        scoringRuleId: null,
        matchType: 'Regular',
        name: null,
        side1: { tournamentTeamId: 1, playerIds: [1] },
        side2: { tournamentTeamId: 2, playerIds: [2] },
        scheduledAt: '2026-11-05T17:30:00.000Z',
      })
      .subscribe();
    const create = http.expectOne({ method: 'POST', url: '/api/tournaments/1/matches' });
    expect(create.request.body.scheduledAt).toBe('2026-11-05T17:30:00.000Z');
    create.flush({
      isSuccess: true,
      isFailure: false,
      errors: [],
      value: { id: 6, tournamentId: 1, tournamentStageId: 3, sportFormatId: 1, scoringRuleId: 2, matchNumber: 2, name: null, matchType: 0, status: 0, sides: [], scheduledAt: '2026-11-05T17:30:00' },
    });
  });
});
