import { HttpErrorResponse } from '@angular/common/http';

export interface ApiErrorItem {
  code: string;
  message: string;
}

/**
 * Normalised failure from the SportTracker API. The backend returns ProblemDetails with a `code`
 * extension (and an `errors` array when several rules failed); ASP.NET model binding failures
 * return a ValidationProblemDetails whose `errors` is a field -> messages map.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly detail: string,
    readonly items: ApiErrorItem[] = [],
  ) {
    super(detail);
    this.name = 'ApiError';
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNetwork(): boolean {
    return this.status === 0;
  }

  /** Message that is safe to show a person. */
  get userMessage(): string {
    if (this.isNetwork) {
      return 'Cannot reach the SportTracker API. Check that the backend is running.';
    }
    if (this.isUnauthorized) {
      return 'Sign in to continue. Your session may have expired.';
    }
    if (this.isForbidden) {
      return this.code === 'Tournament.Forbidden'
        ? "Only this tournament's organizer can do that."
        : 'You do not have permission to do that.';
    }
    return this.detail;
  }

  static from(error: unknown): ApiError {
    if (error instanceof ApiError) {
      return error;
    }
    if (error instanceof HttpErrorResponse) {
      return ApiError.fromHttp(error);
    }
    return new ApiError(-1, 'Client.Unexpected', error instanceof Error ? error.message : 'Something went wrong.');
  }

  private static fromHttp(response: HttpErrorResponse): ApiError {
    if (response.status === 0) {
      return new ApiError(0, 'Network.Unreachable', 'Cannot reach the SportTracker API.');
    }

    const body: unknown = response.error;
    if (typeof body !== 'object' || body === null) {
      return new ApiError(
        response.status,
        `Http.${response.status}`,
        response.statusText || 'The request failed.',
      );
    }

    const problem = body as Record<string, unknown>;
    const items = ApiError.readItems(problem['errors']);
    const detail =
      asString(problem['detail']) ?? items[0]?.message ?? asString(problem['title']) ?? 'The request failed.';
    const code = asString(problem['code']) ?? items[0]?.code ?? `Http.${response.status}`;

    return new ApiError(response.status, code, detail, items);
  }

  private static readItems(errors: unknown): ApiErrorItem[] {
    if (Array.isArray(errors)) {
      return errors.flatMap((entry): ApiErrorItem[] => {
        const item = entry as Record<string, unknown>;
        const code = asString(item['code']);
        const message = asString(item['message']);
        return code && message ? [{ code, message }] : [];
      });
    }
    if (typeof errors === 'object' && errors !== null) {
      return Object.entries(errors).flatMap(([field, messages]) =>
        Array.isArray(messages)
          ? messages.filter((m): m is string => typeof m === 'string').map((message) => ({ code: field, message }))
          : [],
      );
    }
    return [];
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
