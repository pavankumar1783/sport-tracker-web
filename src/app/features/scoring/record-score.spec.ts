import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RecordGameScoreResult } from '../../core/models/api.models';
import { MatchesApi } from '../../core/services/api/matches.api';

describe('MatchesApi.recordScore', () => {
  let http: HttpTestingController;
  let api: MatchesApi;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(MatchesApi);
  });

  afterEach(() => http.verify());

  it('posts the final score of one game and unwraps the Result envelope with numeric enums', () => {
    let result: RecordGameScoreResult | undefined;
    api.recordScore(1, 2, 3, { side1Score: 11, side2Score: 7 }).subscribe((r) => (result = r));

    const req = http.expectOne('/api/tournaments/1/matches/2/games/3/score');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ side1Score: 11, side2Score: 7 });

    req.flush({
      isSuccess: true,
      isFailure: false,
      errors: [],
      value: {
        gameId: 3,
        matchId: 2,
        gameNumber: 1,
        side1Score: 11,
        side2Score: 7,
        gameStatus: 2,
        gameWinnerSideId: 20,
        matchStatus: 1,
        matchWinnerSideId: null,
      },
    });

    expect(result).toEqual({
      gameId: 3,
      matchId: 2,
      gameNumber: 1,
      side1Score: 11,
      side2Score: 7,
      gameStatus: 'Completed',
      gameWinnerSideId: 20,
      matchStatus: 'InProgress',
      matchWinnerSideId: null,
    });
  });

  it('surfaces the backend error code from ProblemDetails on a rejected score', () => {
    // The error interceptor is not installed in this test, so the raw HttpErrorResponse arrives.
    let status = 0;
    let code = '';
    api.recordScore(1, 2, 3, { side1Score: 12, side2Score: 9 }).subscribe({
      error: (e: { status: number; error: { code: string } }) => {
        status = e.status;
        code = e.error.code;
      },
    });

    http.expectOne('/api/tournaments/1/matches/2/games/3/score').flush(
      { status: 400, title: 'Unable to record game score', detail: 'The supplied score does not satisfy the scoring rule.', code: 'Game.ScoreNotComplete' },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(status).toBe(400);
    expect(code).toBe('Game.ScoreNotComplete');
  });
});
