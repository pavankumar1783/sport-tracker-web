import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, defer, forkJoin, from, map, of, switchMap } from 'rxjs';
import { MatchesApi } from '../../../core/services/api/matches.api';
import { AuthService } from '../../../core/services/auth.service';
import { TournamentDirectory } from '../../../core/services/tournament-directory.service';
import { AsyncState } from '../../../core/state/async-state';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { MatchEntry } from '../match-utils';
import { MatchSectionsComponent } from '../ui/match-sections.component';
import { StatusFilter, StatusFilterComponent, applyStatusFilter } from '../ui/status-filter.component';

/** The API has no cross-tournament match query (gap G8), so this reads the newest tournaments one by one. */
const MAX_TOURNAMENTS = 10;

@Component({
  selector: 'st-match-list-page',
  imports: [
    RouterLink,
    PageHeaderComponent,
    MatchSectionsComponent,
    StatusFilterComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    SkeletonComponent,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <st-page-header title="Matches" subtitle="Live games, upcoming fixtures and results across your latest tournaments.">
        @if (auth.isSignedIn()) {
          <a class="btn" routerLink="/matches/new"><st-icon name="plus" />New match</a>
        }
      </st-page-header>

      <div class="row">
        <st-status-filter [(value)]="statusFilter" />
        <div class="field filter">
          <label class="sr-only" for="tournament-filter">Tournament</label>
          <select id="tournament-filter" class="select" [value]="tournamentFilter()" (change)="onTournament($event)">
            <option value="all">All tournaments</option>
            @for (t of tournaments(); track t.id) {
              <option [value]="t.id" [selected]="tournamentFilter() === t.id">{{ t.name }}</option>
            }
          </select>
        </div>
      </div>

      @if (state.error(); as error) {
        <st-error-state [error]="error" (retry)="reload(true)" />
      } @else if (state.data(); as all) {
        @if (all.length === 0) {
          <div class="card">
            <st-empty-state icon="versus" title="No matches yet" message="Matches appear here once an organizer creates them in an active tournament." />
          </div>
        } @else if (visible().length === 0) {
          <div class="card"><st-empty-state icon="search" title="Nothing matches these filters" message="Try another status or tournament." /></div>
        } @else {
          <st-match-sections [entries]="visible()" [showTournament]="tournamentFilter() === 'all'" />
        }
      } @else {
        <div class="grid">
          @for (n of [1, 2, 3, 4]; track n) {
            <div class="card"><st-skeleton [rows]="3" /></div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .filter {
      flex: 1 1 200px;
      max-width: 320px;
    }
  `,
})
export class MatchListPage {
  protected readonly auth = inject(AuthService);
  private readonly directory = inject(TournamentDirectory);
  private readonly matchesApi = inject(MatchesApi);

  protected readonly state = new AsyncState<MatchEntry[]>();
  protected readonly statusFilter = signal<StatusFilter>('all');
  protected readonly tournamentFilter = signal<number | 'all'>('all');

  protected readonly tournaments = computed(() => this.directory.tournaments().slice(0, MAX_TOURNAMENTS));
  protected readonly visible = computed(() => {
    const tournamentId = this.tournamentFilter();
    const entries = (this.state.data() ?? []).filter((e) => tournamentId === 'all' || e.tournamentId === tournamentId);
    return applyStatusFilter(entries, this.statusFilter());
  });

  constructor() {
    this.reload(false);
  }

  protected reload(force: boolean): void {
    this.state.load(
      defer(() => from(this.directory.load(force))).pipe(
        switchMap(() => {
          const failure = this.directory.error();
          if (failure) {
            throw failure;
          }
          const tournaments = this.tournaments();
          if (tournaments.length === 0) {
            return of<MatchEntry[]>([]);
          }
          return forkJoin(
            tournaments.map((t) =>
              this.matchesApi.list(t.id).pipe(
                map((matches) => matches.map((match): MatchEntry => ({ tournamentId: t.id, tournamentName: t.name, match }))),
                catchError(() => of<MatchEntry[]>([])),
              ),
            ),
          ).pipe(map((lists) => lists.flat()));
        }),
      ),
      { keepData: false },
    );
  }

  protected onTournament(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.tournamentFilter.set(value === 'all' ? 'all' : Number(value));
  }
}
