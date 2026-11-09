import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../icon/icon.component';

/** Title block for a page. Project action buttons into the default slot. */
@Component({
  selector: 'st-page-header',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      <div class="titles">
        @if (backLink(); as link) {
          <a class="back" [routerLink]="link"><st-icon name="arrow-left" />{{ backLabel() }}</a>
        }
        @if (eyebrow(); as text) {
          <span class="eyebrow">{{ text }}</span>
        }
        <h1>{{ title() }}</h1>
        @if (subtitle(); as text) {
          <p class="muted">{{ text }}</p>
        }
      </div>
      <div class="actions"><ng-content /></div>
    </div>
  `,
  styles: `
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: 12px 16px;
    }
    .titles {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    h1 {
      overflow-wrap: anywhere;
    }
    .back {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--c-muted);
      margin-bottom: 4px;
      --icon-size: 16px;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .actions:empty {
      display: none;
    }
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly eyebrow = input<string>();
  readonly backLink = input<string | readonly unknown[]>();
  readonly backLabel = input('Back');
}
