import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'st-not-found-page',
  imports: [EmptyStateComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page--narrow">
      <div class="card">
        <st-empty-state
          icon="search"
          title="Page not found"
          message="That page does not exist or has moved."
        >
          <a class="btn" routerLink="/dashboard">Back to dashboard</a>
        </st-empty-state>
      </div>
    </div>
  `,
})
export class NotFoundPage {}
