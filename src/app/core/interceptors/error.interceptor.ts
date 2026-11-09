import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ApiError } from '../models/api-error';
import { AuthService } from '../services/auth.service';

/** Converts every HTTP failure into an `ApiError`, and drops a token the API rejected. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }
      const apiError = ApiError.from(error);
      if (apiError.isUnauthorized && auth.getToken()) {
        auth.signOut();
      }
      return throwError(() => apiError);
    }),
  );
};
