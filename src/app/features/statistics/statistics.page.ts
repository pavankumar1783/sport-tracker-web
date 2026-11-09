import { ChangeDetectionStrategy, Component, computed, effect, inject, input, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TournamentDashboard, TournamentMvp, TournamentStandings } from '../../core/models/api.models';
import { TournamentsApi } from '../../core/services/api/tournaments.api';
import { TournamentDirectory } from '../../core/services/tournament-directory.service';
import { AsyncState } from '../../core/state/async-state';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../shared/components/error-state/error-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { StatTileComponent } from '../../shared/components/stat-tile/stat-tile.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { MvpTableComponent } from '../standings/ui/mvp-table.component';
import { StandingsTableComponent } from '../standings/ui/standings-table.component';
import { percentOf, splitWins, summarizeStandings, topPerformers } from './statistics.model';

@Component({
  selector: 'st-statistics-page',
  imports: [
    RouterLink,
    AvatarComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    MvpTableComponent,
    PageHeaderComponent,
    SkeletonComponent,
    StandingsTableComponent,
    StatTileComponent,
    StatusBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <st-page-header title="Statistics" subtitle="Standings, leaderboards and totals for a tournament." />

      @if (directory.error(); as error) {
        <st-error-state [error]="error" (retry)="directory.load(true)" />
      } @else if (!directory.loaded()) {
        <div class="card"><st-skeleton [rows]="4" height="28px" /></div>
      } @else if (directory.tournaments().length === 0) {
        <div class="card">
          <st-empty-state icon="chart" title="No statistics yet" message="Statistics appear once a tournament has been played.">
            <a class="btn btn--secondary" routerLink="/tournaments">Browse tournaments</a>
          </st-empty-state>
        </div>
      } @else {
        <div class="row picker">
          <div class="field grow">
            <label class="field__label" for="tournament">Tournament</label>
            <select id="tournament" class="select" (change)="select($event)">
              @for (tournament of directory.tournaments(); track tournament.id) {
                <option [value]="tournament.id" [selected]="tournament.id === selectedId()">{{ tournament.name }}</option>
              }
            </select>
          </div>
          @if (dashboard.data(); as d) {
            <st-status-badge [status]="d.status" />
          }
        </div>

        @if (standings.error() || mvp.error()) {
          <st-error-state [error]="(standings.error() ?? mvp.error())!" (retry)="load()" />
        } @else if (!standings.data() || !mvp.data()) {
          <div class="grid grid--stats">
            @for (n of [1, 2, 3, 4]; track n) {
              <div class="card"><st-skeleton [rows]="2" height="22px" /></div>
            }
          </div>
          <div class="card"><st-skeleton [rows]="5" height="26px" /></div>
        } @else {
          <div class="grid grid--stats">
            <st-stat-tile
              label="Matches played"
              [value]="dashboard.data()?.completedMatchCount ?? '–'"
              [hint]="'of ' + (dashboard.data()?.matchCount ?? '–')"
              icon="versus"
            />
            <st-stat-tile label="Games played" [value]="summary().games" icon="list" />
            <st-stat-tile label="Points scored" [value]="summary().points" icon="chart" />
            <st-stat-tile label="Teams" [value]="standings.data()!.standings.length" icon="users" />
          </div>

          @if (summary().games === 0) {
            <div class="card">
              <st-empty-state
                icon="medal"
                title="Nothing played yet"
                message="Leaderboards and totals fill in as soon as matches are completed in this tournament."
              />
            </div>
          } @else {
            @if (top().length > 0) {
              <section class="stack" aria-labelledby="top-title">
                <h2 id="top-title">Top performers</h2>
                <div class="grid">
                  @for (player of top(); track player.playerId) {
                    <a class="card card--link top" [routerLink]="['/players', player.playerId]">
                      <span class="rank">{{ player.position }}</span>
                      <st-avatar [name]="player.playerName" [size]="44" />
                      <div class="grow info">
                        <span class="name truncate">{{ player.playerName }}</span>
                        <span class="small muted truncate">{{ player.teamName }}</span>
                      </div>
                      <span class="num record"><b>{{ player.won }}</b>–{{ player.lost }}</span>
                    </a>
                  }
                </div>
              </section>
            }

            <section class="card stack" aria-labelledby="split-title">
              <h2 id="split-title">Singles and doubles</h2>
              <div class="bar" role="img" [attr.aria-label]="'Singles ' + split().singles + ' wins, doubles ' + split().doubles + ' wins'">
                <span class="bar__singles" [style.width.%]="singlesShare()"></span>
              </div>
              <div class="row row--between small">
                <span><span class="key key--singles"></span>Singles matches won: <b>{{ split().singles }}</b></span>
                <span><span class="key key--doubles"></span>Doubles matches won: <b>{{ split().doubles }}</b></span>
              </div>
            </section>

            <section class="stack" aria-labelledby="teams-title">
              <h2 id="teams-title">Team standings</h2>
              <div class="card card--flush"><st-standings-table [standings]="standings.data()!.standings" /></div>
            </section>

            <section class="stack" aria-labelledby="players-title">
              <h2 id="players-title">Player leaderboard</h2>
              <div class="card card--flush"><st-mvp-table [players]="mvp.data()!.players" /></div>
            </section>
          }
        }
      }
    </div>
  `,
  styles: `
    .picker {
      align-items: flex-end;
      max-width: 520px;
    }
    .top {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .rank {
      display: grid;
      place-items: center;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: var(--c-accent-soft);
      color: var(--c-accent);
      font-weight: 700;
      font-size: 0.8125rem;
      flex: none;
    }
    .info {
      display: flex;
      flex-direction: column;
    }
    .name {
      font-weight: 650;
      color: var(--c-text);
    }
    .record b {
      font-size: 1.25rem;
    }
    .bar {
      height: 12px;
      border-radius: 999px;
      overflow: hidden;
      background: var(--c-accent);
    }
    .bar__singles {
      display: block;
      height: 100%;
      background: var(--c-primary);
    }
    .key {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 6px;
    }
    .key--singles {
      background: var(--c-primary);
    }
    .key--doubles {
      background: var(--c-accent);
    }
  `,
})
export class StatisticsPage {
  /** Bound from the `?tournamentId=` query parameter. */
  readonly tournamentId = input<string>();

  protected readonly directory = inject(TournamentDirectory);
  private readonly api = inject(TournamentsApi);
  private readonly router = inject(Router);

  protected readonly standings = new AsyncState<TournamentStandings>();
  protected readonly mvp = new AsyncState<TournamentMvp>();
  protected readonly dashboard = new AsyncState<TournamentDashboard>();

  protected readonly selectedId = computed(() => {
    const tournaments = this.directory.tournaments();
    const wanted = Number(this.tournamentId());
    return tournaments.some((t) => t.id === wanted) ? wanted : (tournaments[0]?.id ?? null);
  });

  protected readonly summary = computed(() => summarizeStandings(this.standings.data()?.standings ?? []));
  protected readonly split = computed(() => splitWins(this.mvp.data()?.players ?? []));
  protected readonly singlesShare = computed(() => percentOf(this.split().singles, this.split().total));
  protected readonly top = computed(() => topPerformers(this.mvp.data()?.players ?? []));

  constructor() {
    void this.directory.load();

    effect(() => {
      if (this.selectedId() !== null) {
        untracked(() => this.load());
      }
    });
  }

  protected load(): void {
    const id = this.selectedId();
    if (id === null) return;
    this.standings.load(this.api.getStandings(id), { keepData: false });
    this.mvp.load(this.api.getMvp(id), { keepData: false });
    this.dashboard.load(this.api.getDashboard(id), { keepData: false });
  }

  protected select(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    void this.router.navigate([], {
      queryParams: { tournamentId: value },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
