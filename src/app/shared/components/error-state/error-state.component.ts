import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiError } from '../../../core/models/api-error';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { IconComponent } from '../icon/icon.component';

/** Shown when a load fails: explains the problem and offers retry (or sign-in for 401/403). */
@Component({
  selector: 'st-error-state',
  imports: [EmptyStateComponent, IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <st-empty-state [icon]="needsSignIn() ? 'lock' : 'alert'" [title]="title()" [message]="error().userMessage">
        @if (needsSignIn()) {
          <a class="btn" routerLink="/sign-in"><st-icon name="log-in" />Sign in</a>
        } @else {
          <button type="button" class="btn btn--secondary" (click)="retry.emit()">
            <st-icon name="refresh" />Try again
          </button>
        }
      </st-empty-state>
    </div>
  `,
})
export class ErrorStateComponent {
  readonly error = input.required<ApiError>();
  readonly retry = output<void>();

  protected readonly needsSignIn = computed(() => this.error().isUnauthorized || this.error().isForbidden);
  protected readonly title = computed(() => {
    const error = this.error();
    if (error.isNotFound) return 'Not found';
    if (error.isNetwork) return 'Cannot reach the server';
    if (this.needsSignIn()) return 'Sign in required';
    return 'Something went wrong';
  });
}
