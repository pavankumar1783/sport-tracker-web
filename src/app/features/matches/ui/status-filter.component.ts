import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { MatchEntry, MatchGroup, groupOf } from '../match-utils';

export type StatusFilter = 'all' | MatchGroup;

export function applyStatusFilter(entries: readonly MatchEntry[], filter: StatusFilter): MatchEntry[] {
  return filter === 'all' ? [...entries] : entries.filter((e) => groupOf(e.match.status) === filter);
}

@Component({
  selector: 'st-status-filter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="segmented" role="group" aria-label="Filter by status">
      @for (option of options; track option.value) {
        <button type="button" [attr.aria-pressed]="value() === option.value" (click)="value.set(option.value)">
          {{ option.label }}
        </button>
      }
    </div>
  `,
  styles: `
    .segmented {
      max-width: 100%;
      overflow-x: auto;
    }
    .segmented button {
      flex: none;
    }
  `,
})
export class StatusFilterComponent {
  readonly value = model<StatusFilter>('all');

  protected readonly options: readonly { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'live', label: 'Live' },
    { value: 'scheduled', label: 'Upcoming' },
    { value: 'finished', label: 'Results' },
  ];
}
