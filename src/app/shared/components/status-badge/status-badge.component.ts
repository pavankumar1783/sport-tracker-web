import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { humanizeEnum } from '../../../core/models/enums';

type Tone = 'neutral' | 'info' | 'live' | 'success' | 'warning' | 'danger';

const TONES: Record<string, Tone> = {
  Draft: 'neutral',
  Scheduled: 'neutral',
  NotStarted: 'neutral',
  Withdrawn: 'neutral',
  Registration: 'info',
  Registered: 'info',
  Active: 'live',
  InProgress: 'live',
  Completed: 'success',
  Walkover: 'warning',
  Cancelled: 'danger',
  Eliminated: 'danger',
};

/** One badge for every backend status enum (tournament, match, game, stage, team). */
@Component({
  selector: 'st-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [class]="'badge--' + tone()">
    @if (tone() === 'live') {
      <span class="dot dot--pulse"></span>
    }
    {{ label() }}
  </span>`,
  styles: `
    :host {
      display: inline-flex;
    }
    .badge--neutral {
      background: var(--c-surface-2);
    }
  `,
})
export class StatusBadgeComponent {
  readonly status = input.required<string>();
  protected readonly tone = computed<Tone>(() => TONES[this.status()] ?? 'neutral');
  protected readonly label = computed(() => humanizeEnum(this.status()));
}
