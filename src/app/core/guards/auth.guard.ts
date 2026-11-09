import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Pages that need a signed-in user (creating a tournament, scoring, settings). Guests are sent to
 * sign in and returned afterwards. Whether the user may change a particular tournament is decided
 * by the page (and, finally, the API: 403 `Tournament.Forbidden`).
 */
export const authGuard: CanActivateFn = (_route, state) => {
  if (inject(AuthService).isSignedIn()) {
    return true;
  }
  return inject(Router).createUrlTree(['/sign-in'], { queryParams: { returnUrl: state.url } });
};
