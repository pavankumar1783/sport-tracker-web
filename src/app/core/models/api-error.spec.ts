import { HttpErrorResponse } from '@angular/common/http';
import { ApiError } from './api-error';

function http(status: number, body: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body, statusText: 'Status text' });
}

describe('ApiError.from', () => {
  it('reads the backend ProblemDetails code and detail', () => {
    const error = ApiError.from(
      http(400, { status: 400, title: 'Unable to record game score', detail: 'Scores cannot be negative.', code: 'Game.InvalidScore' }),
    );
    expect(error.status).toBe(400);
    expect(error.code).toBe('Game.InvalidScore');
    expect(error.userMessage).toBe('Scores cannot be negative.');
  });

  it('keeps the extra errors array when several rules failed', () => {
    const error = ApiError.from(
      http(400, {
        detail: 'First',
        code: 'A.One',
        errors: [
          { code: 'A.One', message: 'First' },
          { code: 'A.Two', message: 'Second' },
        ],
      }),
    );
    expect(error.items.map((i) => i.code)).toEqual(['A.One', 'A.Two']);
  });

  it('flattens ASP.NET model-binding validation errors', () => {
    const error = ApiError.from(http(400, { title: 'One or more validation errors occurred.', errors: { name: ['Name is required.'] } }));
    expect(error.detail).toBe('Name is required.');
    expect(error.items).toEqual([{ code: 'name', message: 'Name is required.' }]);
  });

  it('flags 404 as not found', () => {
    expect(ApiError.from(http(404, { code: 'Tournament.NotFound', detail: 'Tournament 9 was not found.' })).isNotFound).toBe(true);
  });

  it('describes an unreachable server for status 0', () => {
    const error = ApiError.from(new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') }));
    expect(error.isNetwork).toBe(true);
    expect(error.userMessage).toMatch(/Cannot reach/);
  });

  it('explains 401 as a sign-in problem and 403 by whose tournament it is', () => {
    expect(ApiError.from(http(401, null)).userMessage).toMatch(/Sign in/);
    expect(ApiError.from(http(403, null)).userMessage).toBe('You do not have permission to do that.');
    expect(ApiError.from(http(403, { code: 'Tournament.Forbidden', detail: 'x' })).userMessage).toBe(
      "Only this tournament's organizer can do that.",
    );
  });

  it('wraps unknown errors and passes ApiError through', () => {
    const original = new ApiError(400, 'X.Y', 'detail');
    expect(ApiError.from(original)).toBe(original);
    expect(ApiError.from(new Error('boom')).detail).toBe('boom');
  });
});
