import { ChangeDetectionStrategy, Component, computed, effect, inject, input, numberAttribute, untracked } from '@angular/core';
import { TournamentStandings } from '../../../core/models/api.models';
import { TournamentsApi } from '../../../core/services/api/tournaments.api';
import { AsyncState } from '../../../core/state/async-state';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { StandingsTableComponent } from '../ui/standings-table.component';

/** "Standings" tab of a tournament. */
@Component({
  selector: 'st-tournament-standings-page',
  imports: [StandingsTableComponent, EmptyStateComponent, ErrorStateComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (state.error(); as error) {
      <st-error-state [error]="error" (retry)="reload()" />
    } @else if (state.data(); as data) {
      @if (hasResults()) {
        <div class="card card--flush">
          <st-standings-table [standings]="data.standings" />
        </div>
      } @else {
        <div class="card">
          <st-empty-state
            icon="chart"
            title="No results yet"
            message="Standings appear once the first matches are completed."
          />
        </div>
      }
    } @else {
      <div class="card"><st-skeleton [rows]="6" height="24px" /></div>
    }
  `,
})
export class TournamentStandingsPage {
  readonly tournamentId = input.required({ transform: numberAttribute });

  private readonly api = inject(TournamentsApi);
  protected readonly state = new AsyncState<TournamentStandings>();
  protected readonly hasResults = computed(() => (this.state.data()?.standings ?? []).some((row) => row.played > 0));

  constructor() {
    effect(() => {
      const id = this.tournamentId();
      untracked(() => this.state.load(this.api.getStandings(id), { keepData: false }));
    });
  }

  protected reload(): void {
    this.state.load(this.api.getStandings(this.tournamentId()));
  }
}
