import { ChangeDetectionStrategy, Component, computed, effect, inject, input, numberAttribute, untracked } from '@angular/core';
import { TournamentMvp } from '../../../core/models/api.models';
import { TournamentsApi } from '../../../core/services/api/tournaments.api';
import { AsyncState } from '../../../core/state/async-state';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { MvpTableComponent } from '../ui/mvp-table.component';

/** "Top players" tab of a tournament. */
@Component({
  selector: 'st-tournament-mvp-page',
  imports: [MvpTableComponent, EmptyStateComponent, ErrorStateComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (state.error(); as error) {
      <st-error-state [error]="error" (retry)="reload()" />
    } @else if (state.data(); as data) {
      @if (hasResults()) {
        <div class="card card--flush">
          <st-mvp-table [players]="data.players" />
          <p class="rule small muted">
            Players are ranked by completed match wins, singles and doubles together (a doubles win counts for both
            partners), then fewer losses. Walkovers count for the team, not the player.
          </p>
        </div>
      } @else {
        <div class="card">
          <st-empty-state
            icon="medal"
            title="No player results yet"
            message="The leaderboard fills in as matches are completed."
          />
        </div>
      }
    } @else {
      <div class="card"><st-skeleton [rows]="6" height="24px" /></div>
    }
  `,
  styles: `
    .rule {
      padding: 10px 16px 14px;
    }
  `,
})
export class TournamentMvpPage {
  readonly tournamentId = input.required({ transform: numberAttribute });

  private readonly api = inject(TournamentsApi);
  protected readonly state = new AsyncState<TournamentMvp>();
  protected readonly hasResults = computed(() => (this.state.data()?.players ?? []).some((p) => p.played > 0));

  constructor() {
    effect(() => {
      const id = this.tournamentId();
      untracked(() => this.state.load(this.api.getMvp(id), { keepData: false }));
    });
  }

  protected reload(): void {
    this.state.load(this.api.getMvp(this.tournamentId()));
  }
}
