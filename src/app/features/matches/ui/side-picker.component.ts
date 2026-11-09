import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TournamentTeam } from '../../../core/models/api.models';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';

/** One side of a new match: pick a registered team, then the players who will play. */
@Component({
  selector: 'st-side-picker',
  imports: [ReactiveFormsModule, AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset class="card stack side">
      <legend class="eyebrow">{{ title() }}</legend>

      <div class="field">
        <label class="field__label" [for]="id() + '-team'">Team</label>
        <select class="select" [id]="id() + '-team'" [formControl]="teamControl()">
          <option [ngValue]="null">Choose a team</option>
          @for (team of teams(); track team.tournamentTeamId) {
            <option
              [ngValue]="team.tournamentTeamId"
              [disabled]="team.tournamentTeamId === otherTeamId() || team.status === 'Withdrawn'"
            >
              {{ team.teamName }}{{ team.status === 'Withdrawn' ? ' (withdrawn)' : '' }}
            </option>
          }
        </select>
      </div>

      @if (teamId() !== null) {
        <div class="field">
          <span class="field__label" [id]="id() + '-players'">Players</span>
          @if (roster().length === 0) {
            <span class="field__hint">This team has no registered players.</span>
          } @else {
            <div class="roster" role="group" [attr.aria-labelledby]="id() + '-players'">
              @for (player of roster(); track player.playerId) {
                <label class="player" [class.on]="isSelected(player.playerId)">
                  <input
                    type="checkbox"
                    class="sr-only"
                    [checked]="isSelected(player.playerId)"
                    (change)="toggle(player.playerId)"
                  />
                  <st-avatar [name]="player.name" [size]="32" />
                  <span class="truncate">{{ player.name }}</span>
                </label>
              }
            </div>
            <span class="field__hint">Pick 1 player for singles or 2 for doubles.</span>
          }
        </div>
      }
    </fieldset>
  `,
  styles: `
    .side {
      border: 1px solid var(--c-border);
      min-width: 0;
    }
    legend {
      padding: 0 6px;
    }
    .roster {
      display: grid;
      gap: 8px;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
    }
    .player {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 48px;
      padding: 6px 10px;
      border: 1px solid var(--c-border-strong);
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-weight: 500;
    }
    .player.on {
      border-color: var(--c-primary);
      background: var(--c-primary-soft);
      box-shadow: inset 0 0 0 1px var(--c-primary);
    }
    .player:has(input:focus-visible) {
      box-shadow: var(--focus-ring);
    }
  `,
})
export class SidePickerComponent {
  readonly id = input.required<string>();
  readonly title = input.required<string>();
  readonly teams = input.required<readonly TournamentTeam[]>();
  readonly teamControl = input.required<FormControl<number | null>>();
  readonly teamId = input.required<number | null>();
  readonly otherTeamId = input<number | null>(null);
  readonly selected = model<readonly number[]>([]);

  protected readonly roster = computed(
    () => this.teams().find((t) => t.tournamentTeamId === this.teamId())?.players ?? [],
  );

  protected isSelected(playerId: number): boolean {
    return this.selected().includes(playerId);
  }

  protected toggle(playerId: number): void {
    this.selected.update((list) => (list.includes(playerId) ? list.filter((id) => id !== playerId) : [...list, playerId]));
  }
}
