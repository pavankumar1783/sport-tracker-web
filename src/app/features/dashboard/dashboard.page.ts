import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InsightsService } from '../../core/services/insights.service';
import { TournamentMatches } from '../../core/services/insights.models';
import { deriveTeams, derivePlayers } from '../../core/services/roster';
import { AuthService } from '../../core/services/auth.service';
import { TournamentDirectory } from '../../core/services/tournament-directory.service';
import { AsyncState } from '../../core/state/async-state';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../shared/components/error-state/error-state.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { MatchCardComponent } from '../../shared/components/match-card/match-card.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { StatTileComponent } from '../../shared/components/stat-tile/stat-tile.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { buildDashboardMatches } from './dashboard.model';

/** How many of the newest tournaments feed the match lists. */
const RECENT_TOURNAMENTS = 6;

@Component({
  selector: 'st-dashboard-page',
  imports: [
    DatePipe,
    RouterLink,
    EmptyStateComponent,
    ErrorStateComponent,
    IconComponent,
    MatchCardComponent,
    PageHeaderComponent,
    SkeletonComponent,
    StatTileComponent,
    StatusBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <st-page-header title="Dashboard" subtitle="Table tennis tournaments, live matches and results.">
        @if (auth.isSignedIn()) {
          <a class="btn" routerLink="/tournaments/new"><st-icon name="plus" />New tournament</a>
        }
      </st-page-header>

      @if (directory.error(); as error) {
        <st-error-state [error]="error" (retry)="directory.load(true)" />
      } @else if (!directory.loaded()) {
        <div class="grid grid--stats">
          @for (n of [1, 2, 3, 4]; track n) {
            <div class="card"><st-skeleton [rows]="2" height="22px" /></div>
          }
        </div>
        <div class="card"><st-skeleton [rows]="4" height="48px" /></div>
      } @else if (directory.tournaments().length === 0) {
        <div class="card">
          <st-empty-state
            icon="trophy"
            title="No tournaments yet"
            message="Tournaments, matches and results will show up here as soon as one is created."
          >
            @if (auth.isSignedIn()) {
              <a class="btn" routerLink="/tournaments/new"><st-icon name="plus" />Create the first tournament</a>
            } @else {
              <a class="btn btn--secondary" routerLink="/sign-in"><st-icon name="log-in" />Sign in to create one</a>
            }
          </st-empty-state>
        </div>
      } @else {
        <div class="grid grid--stats">
          <st-stat-tile
            label="Tournaments"
            [value]="directory.tournaments().length"
            [hint]="activeCount() + ' active'"
            icon="trophy"
          />
          <st-stat-tile label="Live matches" [value]="liveCount()" hint="Right now" icon="zap" />
          <st-stat-tile label="Teams" [value]="teamCount()" icon="users" />
          <st-stat-tile label="Players" [value]="playerCount()" icon="user" />
        </div>

        @if (matches.loading() && !matches.data()) {
          <div class="grid grid--2">
            @for (n of [1, 2]; track n) {
              <div class="card"><st-skeleton [rows]="3" height="40px" /></div>
            }
          </div>
        } @else {
          @if (hasFailures()) {
            <div class="notice notice--warning" role="status">
              <st-icon name="alert" />
              <span>Some tournaments could not be loaded, so the lists below may be incomplete.</span>
            </div>
          }

          @if (view().live.length > 0) {
            <section class="stack" aria-labelledby="live-title">
              <h2 id="live-title" class="live-title"><span class="dot dot--pulse"></span>Live now</h2>
              <div class="grid">
                @for (item of view().live; track item.card.id) {
                  <div class="entry">
                    <span class="eyebrow truncate">{{ item.tournamentName }}</span>
                    <st-match-card [match]="item.card" />
                  </div>
                }
              </div>
            </section>
          }

          <div class="grid grid--2">
            <section class="stack" aria-labelledby="upcoming-title">
              <h2 id="upcoming-title">Upcoming</h2>
              @for (item of view().upcoming; track item.card.id) {
                <div class="entry">
                  <span class="eyebrow truncate">{{ item.tournamentName }}</span>
                  <st-match-card [match]="item.card" />
                </div>
              } @empty {
                <div class="card">
                  <st-empty-state icon="calendar" title="Nothing scheduled" message="Matches waiting to be played appear here." />
                </div>
              }
            </section>

            <section class="stack" aria-labelledby="recent-title">
              <h2 id="recent-title">Recent results</h2>
              @for (item of view().recent; track item.card.id) {
                <div class="entry">
                  <span class="eyebrow truncate">{{ item.tournamentName }}</span>
                  <st-match-card [match]="item.card" />
                </div>
              } @empty {
                <div class="card">
                  <st-empty-state icon="medal" title="No results yet" message="Finished matches appear here." />
                </div>
              }
            </section>
          </div>
        }

        <section class="stack" aria-labelledby="tournaments-title">
          <div class="row row--between">
            <h2 id="tournaments-title">Tournaments</h2>
            <a class="btn btn--ghost btn--sm" routerLink="/tournaments">View all<st-icon name="chevron-right" /></a>
          </div>
          <div class="card card--flush">
            <ul class="list">
              @for (tournament of directory.tournaments().slice(0, 6); track tournament.id) {
                <li>
                  <span class="trophy"><st-icon name="trophy" /></span>
                  <a class="grow tlink" [routerLink]="['/tournaments', tournament.id]">
                    <span class="tname truncate">{{ tournament.name }}</span>
                    <span class="small muted truncate">
                      {{ tournament.teams.length }} teams
                      @if (tournament.startDate; as start) {
                        · {{ start | date: 'd MMM y' }}
                      }
                    </span>
                  </a>
                  <st-status-badge [status]="tournament.status" />
                </li>
              }
            </ul>
          </div>
        </section>

        <section class="stack" aria-labelledby="actions-title">
          <h2 id="actions-title">Quick actions</h2>
          <div class="grid actions">
            <a class="card card--link action" routerLink="/matches"><st-icon name="versus" />All matches</a>
            <a class="card card--link action" routerLink="/statistics"><st-icon name="chart" />Statistics</a>
            <a class="card card--link action" routerLink="/teams"><st-icon name="users" />Teams</a>
            <a class="card card--link action" routerLink="/players"><st-icon name="user" />Players</a>
          </div>
        </section>
      }
    </div>
  `,
  styles: `
    .entry {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }
    .live-title {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--c-accent);
    }
    .trophy {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: var(--c-primary-soft);
      color: var(--c-primary);
      flex: none;
    }
    .tlink {
      display: flex;
      flex-direction: column;
      color: inherit;
      text-decoration: none;
      min-width: 0;
    }
    .tname {
      font-weight: 650;
    }
    .actions {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .action {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 600;
      color: var(--c-text);
    }
    .action st-icon {
      color: var(--c-primary);
    }
    @media (min-width: 760px) {
      .actions {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
    }
  `,
})
export class DashboardPage {
  protected readonly directory = inject(TournamentDirectory);
  protected readonly auth = inject(AuthService);
  private readonly insights = inject(InsightsService);

  protected readonly matches = new AsyncState<TournamentMatches[]>();

  protected readonly view = computed(() => buildDashboardMatches(this.matches.data() ?? []));
  protected readonly liveCount = computed(() => this.view().live.length);
  protected readonly activeCount = computed(
    () => this.directory.tournaments().filter((t) => t.status === 'Active').length,
  );
  protected readonly teamCount = computed(() => deriveTeams(this.directory.tournaments()).length);
  protected readonly playerCount = computed(() => derivePlayers(this.directory.tournaments()).length);
  protected readonly hasFailures = computed(() => (this.matches.data() ?? []).some((list) => list.failed));

  constructor() {
    void this.directory.load();

    effect(() => {
      if (!this.directory.loaded()) return;
      const refs = this.directory
        .tournaments()
        .slice(0, RECENT_TOURNAMENTS)
        .map((t) => ({ id: t.id, name: t.name }));
      untracked(() => this.matches.load(this.insights.matchLists(refs)));
    });
  }
}
