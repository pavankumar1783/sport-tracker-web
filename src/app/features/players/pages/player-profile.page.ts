import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  numberAttribute,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Observable, map, of, switchMap } from 'rxjs';
import { MvpItem, Player, TournamentMvp } from '../../../core/models/api.models';
import { PlayersApi } from '../../../core/services/api/players.api';
import { AuthService } from '../../../core/services/auth.service';
import { InsightsService } from '../../../core/services/insights.service';
import {
  HistoryCandidate,
  HistoryEntry,
  buildHistoryEntry,
  selectHistoryCandidates,
} from '../../../core/services/match-history';
import { PlayerEntry, aggregateMvp, derivePlayers, formatWinRate, winRate } from '../../../core/services/roster';
import { TournamentDirectory } from '../../../core/services/tournament-directory.service';
import { AsyncState } from '../../../core/state/async-state';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { StatTileComponent } from '../../../shared/components/stat-tile/stat-tile.component';

type Section = 'overview' | 'history';

/** Match details fetched per "load" click. */
const HISTORY_BATCH = 10;

@Component({
  selector: 'st-player-profile-page',
  imports: [
    DatePipe,
    RouterLink,
    AvatarComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    IconComponent,
    PageHeaderComponent,
    SkeletonComponent,
    StatTileComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      @if (directory.error(); as error) {
        <st-error-state [error]="error" (retry)="directory.load(true)" />
      } @else if (!directory.loaded()) {
        <div class="card"><st-skeleton [rows]="5" height="26px" /></div>
      } @else if (player(); as p) {
        <div class="hero">
          <st-avatar [name]="p.name" [size]="64" />
          <st-page-header
            [title]="p.name"
            eyebrow="Player"
            [subtitle]="subtitle()"
            backLink="/players"
            backLabel="All players"
          >
            @if (poolPlayer.data()?.isActive === false) {
              <span class="badge">Inactive</span>
            }
          </st-page-header>
        </div>


        <div class="grid grid--stats">
          <st-stat-tile label="Matches played" [value]="totals().played" icon="versus" />
          <st-stat-tile label="Won" [value]="totals().won" icon="check" />
          <st-stat-tile label="Lost" [value]="totals().lost" icon="x" />
          <st-stat-tile label="Win rate" [value]="rate()" icon="chart" />
        </div>

        <div class="segmented" role="group" aria-label="Player sections">
          <button type="button" [attr.aria-pressed]="section() === 'overview'" (click)="section.set('overview')">
            Performance
          </button>
          <button type="button" [attr.aria-pressed]="section() === 'history'" (click)="section.set('history')">
            Match history
          </button>
        </div>

        @if (section() === 'overview') {
          @if (mvp.error(); as error) {
            <st-error-state [error]="error" (retry)="loadMvp()" />
          } @else {
            <div class="card card--flush">
              <div class="card__header">
                <h2>By tournament</h2>
                <span class="small muted">Singles won {{ totals().singlesWon }} · Doubles won {{ totals().doublesWon }}</span>
              </div>
              <ul class="list">
                @for (record of records(); track record.appearance.tournamentId) {
                  <li>
                    <div class="grow info">
                      <a class="tname truncate" [routerLink]="['/tournaments', record.appearance.tournamentId]">
                        {{ record.appearance.tournamentName }}
                      </a>
                      <a class="small muted truncate" [routerLink]="['/teams', record.appearance.teamId]">
                        {{ record.appearance.teamName }}
                      </a>
                    </div>
                    @if (mvp.loading() && !mvp.data()) {
                      <span class="small muted">Loading…</span>
                    } @else if (record.item; as item) {
                      <span class="num record">
                        <b>{{ item.won }}</b>–{{ item.lost }}
                        <span class="small muted">of {{ item.played }}</span>
                      </span>
                    } @else {
                      <span class="small muted">No matches yet</span>
                    }
                  </li>
                }
              </ul>
            </div>
          }
        } @else {
          <div class="stack">
            @for (entry of history(); track entry.tournamentId + '-' + entry.matchId) {
              <a class="card card--link entry" [routerLink]="['/matches', entry.tournamentId, entry.matchId]">
                <div class="row row--between row--nowrap">
                  <span class="eyebrow truncate">{{ entry.tournamentName }} · #{{ entry.matchNumber }} {{ entry.title }}</span>
                  <span class="badge" [class.badge--success]="entry.outcome === 'Won'" [class.badge--danger]="entry.outcome === 'Lost'">
                    {{ entry.outcome }}{{ entry.walkover ? ' (walkover)' : '' }}
                  </span>
                </div>
                <div class="vs">
                  <span class="truncate">
                    {{ entry.partners.length ? 'With ' + entry.partners.join(', ') + ' · ' : '' }}vs
                    <b>{{ entry.opponentTeam }}</b>
                    @if (entry.opponents.length) {
                      <span class="muted">({{ entry.opponents.join(' & ') }})</span>
                    }
                  </span>
                </div>
                <div class="row">
                  @for (game of entry.games; track $index) {
                    <span class="game num" [class.game--won]="game.own > game.opponent">{{ game.own }}–{{ game.opponent }}</span>
                  } @empty {
                    <span class="small muted">No game scores</span>
                  }
                  @if (entry.when; as when) {
                    <span class="small muted when">{{ when | date: 'd MMM y' }}</span>
                  }
                </div>
              </a>
            } @empty {
              @if (!historyLoading() && !historyStarted()) {
                <div class="card">
                  <st-empty-state
                    icon="versus"
                    title="Match history"
                    message="Loads the latest finished matches this player took part in, with game scores."
                  >
                    <button type="button" class="btn" (click)="loadHistory()">Load match history</button>
                  </st-empty-state>
                </div>
              } @else if (!historyLoading() && !historyFailed()) {
                <div class="card">
                  <st-empty-state icon="versus" title="No finished matches" message="This player has no completed matches yet." />
                </div>
              }
            }

            @if (historyLoading()) {
              <div class="card"><st-skeleton [rows]="2" height="44px" /></div>
            }
            @if (historyFailed()) {
              <div class="notice notice--danger" role="alert">
                <st-icon name="alert" /><span>Some match details could not be loaded.</span>
              </div>
            }
            @if (historyStarted() && !historyLoading()) {
              <div class="row row--between">
                <span class="small muted">
                  Checked {{ cursor() }} of {{ candidates()?.length ?? 0 }} matches played by this player's teams.
                </span>
                @if (hasMore()) {
                  <button type="button" class="btn btn--secondary btn--sm" (click)="loadHistory()">Load more</button>
                }
              </div>
            }
          </div>
        }
      } @else {
        <div class="card">
          <st-empty-state icon="user" title="Player not found" message="There is no player with this id.">
            <a class="btn btn--secondary" routerLink="/players">All players</a>
          </st-empty-state>
        </div>
      }
    </div>
  `,
  styles: `
    .hero {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .hero st-page-header {
      flex: 1;
      min-width: 0;
    }
    .info {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .tname {
      font-weight: 650;
      color: var(--c-text);
    }
    .record b {
      font-size: 1.125rem;
    }
    .entry {
      display: flex;
      flex-direction: column;
      gap: 8px;
      color: inherit;
    }
    .vs {
      min-width: 0;
    }
    .game {
      padding: 2px 8px;
      border-radius: 6px;
      border: 1px solid var(--c-border);
      font-size: 0.8125rem;
      font-weight: 600;
    }
    .game--won {
      background: var(--c-success-soft);
      border-color: transparent;
      color: var(--c-success);
    }
    .when {
      margin-left: auto;
    }
  `,
})
export class PlayerProfilePage {
  readonly playerId = input.required({ transform: numberAttribute });

  protected readonly directory = inject(TournamentDirectory);
  protected readonly auth = inject(AuthService);
  private readonly playersApi = inject(PlayersApi);
  private readonly insights = inject(InsightsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly section = signal<Section>('overview');
  protected readonly mvp = new AsyncState<(TournamentMvp | null)[]>();

  protected readonly candidates = signal<HistoryCandidate[] | null>(null);
  protected readonly cursor = signal(0);
  protected readonly history = signal<HistoryEntry[]>([]);
  protected readonly historyLoading = signal(false);
  protected readonly historyFailed = signal(false);
  protected readonly historyStarted = computed(() => this.candidates() !== null);
  protected readonly hasMore = computed(() => this.cursor() < (this.candidates()?.length ?? 0));

  /** Pool record; `GET /api/players/{id}` needs a signed-in user, so guests only get the roster view. */
  protected readonly poolPlayer = new AsyncState<Player>();

  /** The roster view of the player, or for a signed-in user a registered player who is on no roster yet. */
  protected readonly player = computed<PlayerEntry | undefined>(() => {
    const id = this.playerId();
    const derived = derivePlayers(this.directory.tournaments()).find((p) => p.playerId === id);
    const pool = this.poolPlayer.data();
    if (derived) {
      return pool ? { ...derived, name: pool.name } : derived;
    }
    return pool ? { playerId: id, name: pool.name, appearances: [], teams: [] } : undefined;
  });

  protected readonly records = computed(() => {
    const loaded = this.mvp.data();
    return (this.player()?.appearances ?? []).map((appearance, index): { appearance: typeof appearance; item: MvpItem | null } => ({
      appearance,
      item: loaded?.[index]?.players.find((p) => p.playerId === this.playerId()) ?? null,
    }));
  });

  protected readonly totals = computed(() =>
    aggregateMvp(this.records().flatMap((r) => (r.item ? [r.item] : []))),
  );
  protected readonly rate = computed(() => formatWinRate(winRate(this.totals().won, this.totals().played)));
  protected readonly subtitle = computed(() => {
    const player = this.player();
    if (!player) return '';
    const teams = player.teams.map((t) => t.teamName).join(', ');
    return teams || 'Not on a team yet';
  });

  constructor() {
    void this.directory.load();

    effect(() => {
      const id = this.playerId();
      if (this.auth.isSignedIn()) {
        untracked(() => this.poolPlayer.load(this.playersApi.get(id), { keepData: false }));
      }
    });

    effect(() => {
      if (this.player()) {
        untracked(() => this.loadMvp());
      }
    });
  }


  protected loadMvp(): void {
    const appearances = this.player()?.appearances ?? [];
    if (appearances.length === 0) {
      this.mvp.data.set([]);
      return;
    }
    this.mvp.load(this.insights.mvp(appearances.map((a) => a.tournamentId)));
  }

  protected loadHistory(): void {
    const player = this.player();
    if (!player || this.historyLoading()) return;

    this.historyLoading.set(true);
    this.historyFailed.set(false);

    const teams = player.appearances.map((a) => ({ tournamentId: a.tournamentId, tournamentTeamId: a.tournamentTeamId }));
    const existing = this.candidates();
    const candidates$: Observable<HistoryCandidate[]> = existing
      ? of(existing)
      : this.insights
          .matchLists(player.appearances.map((a) => ({ id: a.tournamentId, name: a.tournamentName })))
          .pipe(map((lists) => selectHistoryCandidates(lists, teams)));

    candidates$
      .pipe(
        switchMap((all) => {
          const start = this.cursor();
          const batch = all.slice(start, start + HISTORY_BATCH);
          return this.insights.matchDetails(batch).pipe(map((details) => ({ all, batch, details })));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ all, batch, details }) => {
          const entries = details.flatMap((detail, index) => {
            const entry = detail ? buildHistoryEntry(player.playerId, batch[index].tournamentName, detail) : null;
            return entry ? [entry] : [];
          });
          this.candidates.set(all);
          this.cursor.update((c) => c + batch.length);
          this.history.update((current) => [...current, ...entries]);
          this.historyFailed.set(details.some((d) => d === null));
          this.historyLoading.set(false);
        },
        error: () => {
          this.historyFailed.set(true);
          this.historyLoading.set(false);
        },
      });
  }
}
