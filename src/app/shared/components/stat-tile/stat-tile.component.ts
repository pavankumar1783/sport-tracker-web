import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icons';

@Component({
  selector: 'st-stat-tile',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card tile">
      @if (icon(); as name) {
        <span class="icon"><st-icon [name]="name" /></span>
      }
      <div class="text">
        <span class="value num">{{ value() }}</span>
        <span class="label">{{ label() }}</span>
        @if (hint(); as text) {
          <span class="hint">{{ text }}</span>
        }
      </div>
    </div>
  `,
  styles: `
    .tile {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px;
      height: 100%;
    }
    .icon {
      display: grid;
      place-items: center;
      flex: none;
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: var(--c-primary-soft);
      color: var(--c-primary);
    }
    .text {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .value {
      font-size: 1.5rem;
      font-weight: 750;
      line-height: 1.1;
      letter-spacing: -0.02em;
    }
    .label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--c-muted);
    }
    .hint {
      font-size: 0.6875rem;
      color: var(--c-muted);
    }
  `,
})
export class StatTileComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly hint = input<string>();
  readonly icon = input<IconName>();
}
