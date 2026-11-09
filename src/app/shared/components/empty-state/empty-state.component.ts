import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icons';

/** Friendly placeholder for lists with no data. Project a call-to-action button if there is one. */
@Component({
  selector: 'st-empty-state',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty">
      <span class="art"><st-icon [name]="icon()" /></span>
      <h3>{{ title() }}</h3>
      @if (message(); as text) {
        <p class="muted">{{ text }}</p>
      }
      <div class="cta"><ng-content /></div>
    </div>
  `,
  styles: `
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 8px;
      padding: 36px 20px;
    }
    .art {
      display: grid;
      place-items: center;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--c-primary-soft);
      color: var(--c-primary);
      margin-bottom: 4px;
      --icon-size: 26px;
    }
    p {
      max-width: 38ch;
      font-size: 0.875rem;
    }
    .cta {
      margin-top: 8px;
    }
    .cta:empty {
      display: none;
    }
  `,
})
export class EmptyStateComponent {
  readonly icon = input<IconName>('trophy');
  readonly title = input.required<string>();
  readonly message = input<string>();
}
