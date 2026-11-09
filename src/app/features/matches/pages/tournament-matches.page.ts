import { ChangeDetectionStrategy, Component, computed, effect, inject, input, numberAttribute, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { MatchListItem, Sport, Tournament } from '../../../core/models/api.models';
import { MatchesApi } from '../../../core/services/api/matches.api';
import { SportsApi } from '../../../core/services/api/sports.api';
import { TournamentsApi } from '../../../core/services/api/tournaments.api';
import { AuthService } from '../../../core/services/auth.service';
import { AsyncState } from '../../../core/state/async-state';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { MatchEntry, withDetails } from '../match-utils';
import { MatchSectionsComponent } from '../ui/match-sections.component';
import { StatusFilter, StatusFilterComponent, applyStatusFilter } from '../ui/status-filter.component';

/** "Matches" tab of a tournament. */
@Component({
  selector: 'st-tournament-matches-page',
  imports: [
    RouterLink,
    MatchSectionsComponent,
    StatusFilterComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    SkeletonComponent,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack--lg stack">
      <div class="row row--between">
        <st-status-filter [(value)]="filter" />
        <label class="check">
          <input type="checkbox" [checked]="showTeamNames()" (change)="showTeamNames.set(!showTeamNames())" />
          <span>Show team names</span>
        </label>
        @if (canCreate()) {
          <a class="btn btn--sm" routerLink="/matches/new" [queryParams]="{ tournamentId: tournamentId() }">
            <st-icon name="plus" />New match
          </a>
        }
      </div>

      @if (matches.error(); as error) {
        <st-error-state [error]="error" (retry)="reload()" />
      } @else if (matches.data(); as all) {
        @if (all.length === 0) {
          <div class="card">
            <st-empty-state icon="versus" title="No matches yet" [message]="emptyMessage()">
              @if (canCreate()) {
                <a class="btn" routerLink="/matches/new" [queryParams]="{ tournamentId: tournamentId() }">Create the first match</a>
              }
            </st-empty-state>
          </div>
        } @else if (visible().length === 0) {
          <div class="card"><st-empty-state icon="search" title="Nothing in this view" message="Try a different status filter." /></div>
        } @else {
          <st-match-sections [entries]="visible()" [showTeamNames]="showTeamNames()" [rules]="rules()" />
        }
      } @else {
        <div class="grid">
          @for (n of [1, 2, 3]; track n) {
            <div class="card"><st-skeleton [rows]="3" /></div>
          }
        </div>
      }
    </div>
  `,
})
export class TournamentMatchesPage {
  private readonly matchesApi = inject(MatchesApi);
  private readonly tournamentsApi = inject(TournamentsApi);
  private readonly sportsApi = inject(SportsApi);
  private readonly auth = inject(AuthService);

  readonly tournamentId = input.required({ transform: numberAttribute });

  protected readonly matches = new AsyncState<MatchListItem[]>();
  protected readonly tournament = new AsyncState<Tournament>();
  protected readonly sports = new AsyncState<Sport[]>();
  protected readonly filter = signal<StatusFilter>('all');

  protected readonly showTeamNames = signal(true);
  protected readonly entries = computed<MatchEntry[]>(() =>
    (this.matches.data() ?? []).map((match) => ({
      tournamentId: this.tournamentId(),
      tournamentName: null,
      match,
    })),
  );
  protected readonly rules = computed(
    () => this.sports.data()?.find((sport) => sport.id === this.tournament.data()?.sportId)?.scoringRules ?? [],
  );
  protected readonly visible = computed(() => applyStatusFilter(this.entries(), this.filter()));
  protected readonly canCreate = computed(
    () => this.auth.canManage(this.tournament.data()?.organizerUserId) && this.tournament.data()?.status === 'Active',
  );
  protected readonly emptyMessage = computed(() =>
    this.tournament.data()?.status === 'Active'
      ? 'Matches are created by hand once the tournament is active.'
      : 'Matches can be created once the tournament has started.',
  );

  constructor() {
    effect(() => {
      this.tournamentId();
      untracked(() => this.reload());
    });
  }

  protected reload(): void {
    const id = this.tournamentId();
    // The list omits players, so each match's details are fetched to show who is playing; a failed detail keeps the team name.
    const withPlayers$ = this.matchesApi.list(id).pipe(
      switchMap((list) =>
        list.length === 0
          ? of(list)
          : forkJoin(
              list.map((match) =>
                this.matchesApi.get(id, match.id).pipe(
                  map((details) => withDetails(match, details)),
                  catchError(() => of(match)),
                ),
              ),
            ),
      ),
    );
    this.matches.load(withPlayers$, { keepData: false });
    this.tournament.load(this.tournamentsApi.get(id));
    this.sports.load(this.sportsApi.getSports());
  }
}
