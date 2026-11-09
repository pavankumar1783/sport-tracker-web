import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { MatchDetailPage } from './match-detail.page';

function base64Url(value: object): string {
  return btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/** An API-issued token: numeric sub (user id), name and role "User". */
function userToken(id: number): string {
  return `${base64Url({ alg: 'none' })}.${base64Url({ sub: String(id), name: 'Olive', role: 'User' })}.sig`;
}

const side = (id: number, sideNumber: number, team: string, player: string) => ({
  id,
  sideNumber,
  tournamentTeamId: 100 + sideNumber,
  teamName: team,
  players: [{ playerId: id, playerName: player, position: 1 }],
});

function matchBody(status: number) {
  return {
    id: 5,
    tournamentId: 1,
    sportFormatId: 1,
    sportFormatName: 'Singles',
    matchNumber: 1,
    name: null,
    matchType: 0,
    status,
    winnerSideId: null,
    scheduledAt: null,
    startedAt: null,
    completedAt: null,
    sides: [side(10, 1, 'Falcons', 'Ana Silva'), side(11, 2, 'Hawks', 'Bo Chen')],
    games: [],
  };
}

const tournamentBody = {
  id: 1,
  sportId: 1,
  sportName: 'Table tennis',
  name: 'Open',
  status: 'Active',
  rosterSize: null,
  startDate: null,
  endDate: null,
  createdAt: '2026-11-01T10:00:00',
  organizerUserId: 7,
  teams: [],
};

describe('MatchDetailPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [MatchDetailPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function render() {
    const fixture = TestBed.createComponent(MatchDetailPage);
    fixture.componentRef.setInput('tournamentId', '1');
    fixture.componentRef.setInput('matchId', '5');
    fixture.detectChanges();
    return fixture;
  }

  it('shows organizer actions to the tournament organizer for a scheduled match and starts it', () => {
    expect(TestBed.inject(AuthService).startSession(userToken(7))).toBeNull();
    const fixture = render();

    http.expectOne('/api/tournaments/1/matches/5').flush(matchBody(0));
    http.expectOne('/api/tournaments/1').flush(tournamentBody);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Falcons');
    expect(el.textContent).toContain('Hawks');
    const start = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Start match'));
    expect(start).toBeTruthy();

    start!.click();
    const startReq = http.expectOne('/api/tournaments/1/matches/5/start');
    expect(startReq.request.method).toBe('POST');
    startReq.flush({
      isSuccess: true,
      isFailure: false,
      errors: [],
      value: { id: 5, tournamentId: 1, matchNumber: 1, status: 1, startedAt: '2026-11-03T12:00:00' },
    });

    // The page reloads the match after the action.
    http.expectOne('/api/tournaments/1/matches/5').flush(matchBody(1));
    http.expectOne('/api/tournaments/1').flush(tournamentBody);
    fixture.detectChanges();

    expect(el.textContent).toContain('Open live scoring');
  });

  it('offers no organizer actions to a guest', () => {
    const fixture = render();
    http.expectOne('/api/tournaments/1/matches/5').flush(matchBody(0));
    http.expectOne('/api/tournaments/1').flush(tournamentBody);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Start match');
  });
});

describe('MatchDetailPage permissions', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [MatchDetailPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('offers no actions to a signed-in user who is not this tournament’s organizer', () => {
    expect(TestBed.inject(AuthService).startSession(userToken(8))).toBeNull();
    const fixture = TestBed.createComponent(MatchDetailPage);
    fixture.componentRef.setInput('tournamentId', '1');
    fixture.componentRef.setInput('matchId', '5');
    fixture.detectChanges();

    http.expectOne('/api/tournaments/1/matches/5').flush(matchBody(0));
    http.expectOne('/api/tournaments/1').flush(tournamentBody);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Falcons');
    expect(text).not.toContain('Start match');
  });
});
