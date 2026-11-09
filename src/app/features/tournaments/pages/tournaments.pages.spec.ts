import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import { CreateTournamentPage } from './create-tournament.page';
import { TournamentsListPage } from './tournaments-list.page';

function configure(): HttpTestingController {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: '**', children: [] }]),
      provideHttpClient(withInterceptors([errorInterceptor])),
      provideHttpClientTesting(),
    ],
  });
  return TestBed.inject(HttpTestingController);
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve));

function tournamentJson(id: number, name: string, status: string) {
  return {
    id,
    sportId: 1,
    sportName: 'Table Tennis',
    name,
    status,
    rosterSize: null,
    startDate: '2026-05-01T00:00:00',
    endDate: null,
    createdAt: '2026-04-01T00:00:00',
    teams: [],
  };
}

function listJson(...items: { id: number; name: string; status: string }[]) {
  return {
    tournaments: items.map((t) => ({ ...tournamentJson(t.id, t.name, t.status), teamCount: 0, teams: undefined })),
  };
}

describe('TournamentsListPage', () => {
  it('loads the tournament list and each tournament, then lists them with their status', async () => {
    const http = configure();
    const fixture = TestBed.createComponent(TournamentsListPage);
    fixture.detectChanges();

    const list = http.expectOne('/api/tournaments');
    expect(list.request.method).toBe('GET');
    list.flush(
      listJson({ id: 2, name: 'Autumn League', status: 'Completed' }, { id: 1, name: 'Spring Cup', status: 'Active' }),
    );
    await tick();
    http.expectOne('/api/tournaments/2').flush(tournamentJson(2, 'Autumn League', 'Completed'));
    http.expectOne('/api/tournaments/1').flush(tournamentJson(1, 'Spring Cup', 'Active'));
    await tick();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const names = [...element.querySelectorAll('.tournament .name')].map((n) => n.textContent?.trim());
    expect(names).toEqual(['Autumn League', 'Spring Cup']);
    expect(element.textContent).toContain('Active');
    expect(element.textContent).toContain('Completed');
    http.verify();
  });

  it('shows an empty state when there are no tournaments', async () => {
    const http = configure();
    const fixture = TestBed.createComponent(TournamentsListPage);
    fixture.detectChanges();

    http.expectOne('/api/tournaments').flush({ tournaments: [] });
    await tick();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No tournaments yet');
    http.verify();
  });
});

describe('CreateTournamentPage', () => {
  it('does not call the API while the name is missing', async () => {
    const http = configure();
    const fixture = TestBed.createComponent(CreateTournamentPage);
    fixture.detectChanges();
    http
      .expectOne('/api/sports')
      .flush({ sports: [{ id: 1, name: 'Table Tennis', code: 'TT', formats: [], scoringRules: [] }] });
    fixture.detectChanges();

    (fixture.nativeElement as HTMLFormElement).querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    http.expectNone('/api/tournaments');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Enter a name');
    http.verify();
  });

  it('creates a tournament with the entered values', async () => {
    const http = configure();
    const fixture = TestBed.createComponent(CreateTournamentPage);
    fixture.detectChanges();
    http
      .expectOne('/api/sports')
      .flush({ sports: [{ id: 1, name: 'Table Tennis', code: 'TT', formats: [], scoringRules: [] }] });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const name = element.querySelector<HTMLInputElement>('#name')!;
    name.value = '  Winter Open ';
    name.dispatchEvent(new Event('input'));
    const roster = element.querySelector<HTMLInputElement>('#roster')!;
    roster.value = '3';
    roster.dispatchEvent(new Event('input'));
    element.querySelector('form')!.dispatchEvent(new Event('submit'));

    const request = http.expectOne('/api/tournaments');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      sportId: 1,
      name: 'Winter Open',
      rosterSize: 3,
      startDate: null,
      endDate: null,
    });
    request.flush({ id: 7, name: 'Winter Open', status: 'Draft' });
    await tick();

    // Creating a tournament refreshes the directory.
    http.expectOne('/api/tournaments').flush({ tournaments: [] });
    await tick();
    http.verify();
  });
});
