import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { InsightsService } from './insights.service';

describe('InsightsService', () => {
  let service: InsightsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(InsightsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const wireMatch = {
    id: 1,
    matchNumber: 1,
    name: null,
    matchType: 0,
    status: 1,
    winnerSideId: null,
    scheduledAt: null,
    startedAt: null,
    completedAt: null,
    sides: [],
  };

  it('loads match lists in parallel, normalises enums and tolerates one failure', async () => {
    const result = firstValueFrom(
      service.matchLists([
        { id: 1, name: 'Spring Open' },
        { id: 2, name: 'Autumn Cup' },
      ]),
    );

    http.expectOne('/api/tournaments/1/matches').flush([wireMatch]);
    http.expectOne('/api/tournaments/2/matches').flush({ title: 'boom' }, { status: 500, statusText: 'Server Error' });

    const lists = await result;
    expect(lists[0]).toMatchObject({ tournamentId: 1, failed: false });
    expect(lists[0].matches[0]).toMatchObject({ matchType: 'Regular', status: 'InProgress' });
    expect(lists[1]).toMatchObject({ tournamentId: 2, failed: true, matches: [] });
  });

  it('answers an empty request without calling the API', async () => {
    expect(await firstValueFrom(service.matchLists([]))).toEqual([]);
    expect(await firstValueFrom(service.standings([]))).toEqual([]);
  });

  it('returns null for a standings request that fails, keeping order', async () => {
    const result = firstValueFrom(service.standings([1, 2]));

    http.expectOne('/api/tournaments/1/standings').flush({ title: 'missing' }, { status: 404, statusText: 'Not Found' });
    http.expectOne('/api/tournaments/2/standings').flush({ tournamentId: 2, tournamentName: 'B', standings: [] });

    const [first, second] = await result;
    expect(first).toBeNull();
    expect(second?.tournamentId).toBe(2);
  });
});
