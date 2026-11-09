import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, numberAttribute, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Observable, catchError, of, switchMap } from 'rxjs';
import { ApiError } from '../../core/models/api-error';
import { MatchDetails, MatchSettings, RecordGameScoreResult, Sport, Tournament } from '../../core/models/api.models';
import { MatchesApi } from '../../core/services/api/matches.api';
import { SportsApi } from '../../core/services/api/sports.api';
import { TournamentsApi } from '../../core/services/api/tournaments.api';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { AsyncState } from '../../core/state/async-state';
import { ErrorStateComponent } from '../../shared/components/error-state/error-state.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { scoreOf, sidePlayersLabel } from '../matches/match-utils';
import {
  EMPTY_SESSION,
  GameSession,
  SideNumber,
  addPoint,
  bestOf,
  canSave,
  clearSession,
  gamePointSide,
  gameWinner,
  gamesWon,
  loadSession,
  resolveRuleHint,
  saveSession,
  sessionKey,
  undoPoint,
} from './scoring-session';

interface PadSide {
  sideNumber: SideNumber;
  team: string;
  players: string;
  score: number;
}

@Component({
  selector: 'st-live-scoring-page',
  imports: [RouterLink, StatusBadgeComponent, ErrorStateComponent, SkeletonComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="scoring">
      @if (match.error(); as error) {
        <st-error-state [error]="error" (retry)="reload()" />
      } @else if (match.data(); as m) {
        <header class="top">
          <a class="back" [routerLink]="['/matches', m.tournamentId, m.id]" aria-label="Back to scorecard">
            <st-icon name="arrow-left" />
          </a>
          <div class="grow">
            <span class="eyebrow">Live scoring · Match #{{ m.matchNumber }}</span>
            <h1 class="truncate">{{ m.name ?? m.sportFormatName }}</h1>
          </div>
          <st-status-badge [status]="m.status" />
        </header>

        <section class="progress card" aria-label="Match progress">
          <div class="tally" [attr.aria-label]="'Games won: ' + left()?.team + ' ' + wonFor(left()) + ', ' + right()?.team + ' ' + wonFor(right())">
            <span class="t-team truncate">{{ left()?.team }}</span>
            <span class="t-num num">{{ wonFor(left()) }}</span>
            <span class="t-sep">games</span>
            <span class="t-num num">{{ wonFor(right()) }}</span>
            <span class="t-team t-team--r truncate">{{ right()?.team }}</span>
          </div>
          <span class="muted small">
            @if (bestOfCount(); as n) {
              Best of {{ n }} · first to {{ rule()?.gamesToWin }}
            } @else {
              Best-of info unavailable
            }
            @if (activeGame(); as g) {
              · Game {{ g.gameNumber }}
            }
          </span>
        </section>

        @if (!tournamentReady()) {
          <div class="card"><st-skeleton [rows]="2" /></div>
        } @else if (!canManage() && !matchOver()) {
          <div class="notice notice--warning" role="status">
            <st-icon name="lock" />
            <div>Only this tournament's organizer can score matches. You can follow the result on the match page.</div>
          </div>
        } @else if (tournament.data()?.status !== 'Active' && !matchOver()) {
          <div class="notice notice--warning" role="status">
            <st-icon name="lock" />
            <div>This tournament is not active, so scores cannot be recorded.</div>
          </div>
        }

        @if (lastResult(); as r) {
          @if (!matchOver()) {
            <div class="notice notice--success" role="status">
              <st-icon name="check" />
              <div>Game {{ r.gameNumber }} saved: {{ r.side1Score }}–{{ r.side2Score }}. {{ winnerName(r.gameWinnerSideId) }} won the game.</div>
            </div>
          }
        }

        @if (matchOver()) {
          <section class="card over stack" aria-label="Final result">
            @if (m.status === 'Completed') {
              <span class="badge badge--success"><st-icon name="trophy" />Match complete</span>
              <h2>{{ winnerName(m.winnerSideId) }} won {{ wonFor(winnerPad()) }}–{{ wonFor(loserPad()) }}</h2>
            } @else if (m.status === 'Walkover') {
              <span class="badge badge--warning"><st-icon name="flag" />Walkover</span>
              <h2>{{ winnerName(m.winnerSideId) }} awarded the match</h2>
            } @else {
              <span class="badge badge--danger"><st-icon name="x" />Cancelled</span>
              <h2>This match was cancelled</h2>
            }
            @if (gameLines().length > 0) {
              <div class="chips">
                @for (line of gameLines(); track line) {
                  <span class="badge">{{ line }}</span>
                }
              </div>
            }
            <a class="btn btn--block" [routerLink]="['/matches', m.tournamentId, m.id]"><st-icon name="list" />View scorecard</a>
          </section>
        } @else if (m.status === 'Scheduled') {
          <section class="card stack start" aria-label="Start match">
            <p>This match has not started. Starting it opens game 1 for scoring.</p>
            <button type="button" class="btn btn--accent btn--lg btn--block" [disabled]="!canScoreBase() || busy()" (click)="startMatch()">
              <st-icon name="play" />Start match
            </button>
          </section>
        } @else if (activeGame()) {
          <section aria-label="Score pad" class="stack--lg stack">
            <div class="pad" role="group" aria-label="Tap a side to give it a point">
              @for (side of display(); track side.sideNumber) {
                <button
                  type="button"
                  class="tap"
                  [class.tap--gp]="gamePoint() === side.sideNumber"
                  [disabled]="!canScoreBase() || busy()"
                  [attr.aria-label]="'Add a point for ' + side.team + '. Current score ' + side.score"
                  (click)="point(side.sideNumber)"
                >
                  <span class="who truncate">{{ side.team }}</span>
                  <span class="names">{{ side.players }}</span>
                  <span class="pts num">{{ side.score }}</span>
                  @if (gamePoint() === side.sideNumber) {
                    <span class="badge badge--live">Game point</span>
                  } @else {
                    <span class="plus" aria-hidden="true">+1</span>
                  }
                </button>
              }
            </div>
            <p class="sr-only" aria-live="polite">{{ announcement() }}</p>

            <div class="controls">
              <button type="button" class="btn btn--secondary" [disabled]="session().history.length === 0 || busy()" (click)="undo()">
                <st-icon name="undo" />Undo
              </button>
              <button type="button" class="btn btn--secondary" (click)="swapped.set(!swapped())" [attr.aria-pressed]="swapped()">
                <st-icon name="refresh" />Swap sides
              </button>
              <button type="button" class="btn btn--ghost" [disabled]="session().history.length === 0 || busy()" (click)="reset()">
                Reset game
              </button>
            </div>

            @if (looksFinished()) {
              <div class="notice notice--success" role="status">
                <st-icon name="check" /><div>Game complete under this match's rule. Save it to record the result.</div>
              </div>
            }
            @if (saveError(); as message) {
              <div class="notice notice--danger" role="alert"><st-icon name="alert" /><div>{{ message }}</div></div>
            }

            <button type="button" class="btn btn--lg btn--block" [class.btn--accent]="looksFinished()" [disabled]="!saveReady() || busy()" (click)="save()">
              <st-icon name="check" />{{ busy() ? 'Saving…' : 'Save game ' + activeGame()?.gameNumber }}
            </button>
          </section>
        } @else {
          <section class="card stack start" aria-label="Next game">
            <p>{{ nextGameHint() }}</p>
            <button type="button" class="btn btn--accent btn--lg btn--block" [disabled]="!canScoreBase() || busy()" (click)="startNextGame()">
              <st-icon name="play" />Start game {{ nextGameNumber() }}
            </button>
            @if (saveError(); as message) {
              <div class="notice notice--danger" role="alert"><st-icon name="alert" /><div>{{ message }}</div></div>
            }
          </section>
        }

        <p class="foot muted small">
          @if (rule(); as r) {
            Hints use the {{ r.source.toLowerCase() }} (first to {{ r.pointsToWin }}, win by {{ r.winBy }}{{ r.maximumPoints ? ', max ' + r.maximumPoints : '' }}).
          } @else {
            Rule hints are unavailable.
          }
          The server checks every saved score. The API records a game's final score, so points are kept on this device until you save.
        </p>
      } @else {
        <div class="card"><st-skeleton [rows]="6" height="24px" /></div>
      }
    </div>
  `,
  styles: `
    .scoring {
      width: 100%;
      max-width: 880px;
      margin: 0 auto;
      padding: 12px 12px 28px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .top {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .top h1 {
      font-size: 1.125rem;
    }
    .back {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--c-border-strong);
      background: var(--c-surface);
      color: var(--c-text);
    }
    .progress {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 12px;
    }
    .tally {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto auto minmax(0, 1fr);
      align-items: baseline;
      gap: 10px;
      width: 100%;
    }
    .t-team {
      font-weight: 600;
      font-size: 0.875rem;
    }
    .t-team--r {
      text-align: right;
    }
    .t-num {
      font-size: 1.75rem;
      font-weight: 800;
      line-height: 1;
    }
    .t-sep {
      font-size: 0.6875rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--c-muted);
    }
    .notice--success {
      background: var(--c-success-soft);
      color: var(--c-success);
    }
    .pad {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .tap {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
      min-height: 250px;
      padding: 16px 10px 14px;
      border-radius: var(--radius-lg);
      border: 2px solid var(--c-border-strong);
      background: var(--c-surface);
      color: var(--c-text);
      box-shadow: var(--shadow);
      touch-action: manipulation;
      user-select: none;
      -webkit-user-select: none;
      transition: transform 0.08s, border-color 0.15s, background 0.15s;
    }
    .tap:active:not(:disabled) {
      transform: scale(0.98);
      background: var(--c-primary-soft);
    }
    .tap:disabled {
      opacity: 0.6;
    }
    .tap--gp {
      border-color: var(--c-accent);
    }
    .who {
      max-width: 100%;
      font-weight: 700;
      font-size: 1rem;
    }
    .names {
      max-width: 100%;
      font-size: 0.8125rem;
      color: var(--c-muted);
      text-align: center;
      overflow-wrap: anywhere;
    }
    .pts {
      font-size: clamp(4.5rem, 24vw, 8rem);
      font-weight: 800;
      line-height: 1;
      letter-spacing: -0.04em;
    }
    .plus {
      font-size: 0.8125rem;
      font-weight: 700;
      color: var(--c-primary);
    }
    .controls {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
    }
    .controls .btn {
      min-height: 48px;
      padding: 0 8px;
    }
    .start p,
    .over h2 {
      text-align: center;
    }
    .over {
      align-items: center;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      justify-content: center;
    }
    .foot {
      text-align: center;
    }
    @media (min-width: 700px) {
      .scoring {
        padding-top: 24px;
      }
      .tap {
        min-height: 320px;
      }
    }
    @media (max-height: 520px) and (orientation: landscape) {
      .tap {
        min-height: 150px;
      }
      .pts {
        font-size: 4rem;
      }
    }
  `,
})
export class LiveScoringPage {
  private readonly matchesApi = inject(MatchesApi);
  private readonly tournamentsApi = inject(TournamentsApi);
  private readonly sportsApi = inject(SportsApi);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly destroyRef = inject(DestroyRef);

  readonly tournamentId = input.required({ transform: numberAttribute });
  readonly matchId = input.required({ transform: numberAttribute });

  protected readonly match = new AsyncState<MatchDetails>();
  protected readonly tournament = new AsyncState<Tournament>();
  private readonly settings = new AsyncState<MatchSettings | null>();
  private readonly sports = new AsyncState<Sport[] | null>();

  protected readonly session = signal<GameSession>(EMPTY_SESSION);
  protected readonly swapped = signal(false);
  protected readonly busy = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly lastResult = signal<RecordGameScoreResult | null>(null);

  protected readonly sides = computed(() => [...(this.match.data()?.sides ?? [])].sort((a, b) => a.sideNumber - b.sideNumber));
  protected readonly activeGame = computed(() => this.match.data()?.games.find((g) => g.status === 'InProgress'));
  private readonly activeGameId = computed(() => this.activeGame()?.id ?? null);
  private readonly pendingGame = computed(() => this.match.data()?.games.find((g) => g.status === 'NotStarted'));

  protected readonly rule = computed(() => {
    const m = this.match.data();
    return m ? resolveRuleHint(m, this.settings.data(), this.sports.data()) : null;
  });
  protected readonly bestOfCount = computed(() => {
    const rule = this.rule();
    return rule ? bestOf(rule) : null;
  });

  protected readonly matchOver = computed(() => {
    const status = this.match.data()?.status;
    return status === 'Completed' || status === 'Walkover' || status === 'Cancelled';
  });
  protected readonly tournamentReady = computed(() => this.tournament.data() !== null || this.tournament.error() !== null);
  /** Scoring controls work only in an active tournament; the backend enforces the same. */
  protected readonly canManage = computed(() => this.auth.canManage(this.tournament.data()?.organizerUserId));

  protected readonly canScoreBase = computed(
    () => this.canManage() && this.tournament.data()?.status === 'Active' && this.match.data()?.status === 'InProgress',
  );

  private readonly won = computed(() => {
    const [s1, s2] = this.sides();
    return gamesWon(this.match.data()?.games ?? [], s1?.id ?? -1, s2?.id ?? -2);
  });

  private readonly pads = computed<PadSide[]>(() => {
    const s = this.session();
    return this.sides().map((side) => ({
      sideNumber: side.sideNumber === 1 ? 1 : 2,
      team: side.teamName,
      players: sidePlayersLabel(side),
      score: side.sideNumber === 1 ? s.side1 : s.side2,
    }));
  });
  /** Pads in on-screen order. Swapping is visual only; taps always use the pad's own side number. */
  protected readonly display = computed(() => (this.swapped() ? [...this.pads()].reverse() : this.pads()));
  protected readonly left = computed<PadSide | undefined>(() => this.display()[0]);
  protected readonly right = computed<PadSide | undefined>(() => this.display()[1]);

  protected readonly gamePoint = computed(() => {
    const rule = this.rule();
    return rule ? gamePointSide(this.session(), rule) : null;
  });
  protected readonly looksFinished = computed(() => {
    const rule = this.rule();
    return rule !== null && canSave(this.session()) && gameWinner(this.session(), rule) !== null;
  });
  protected readonly saveReady = computed(() => this.canScoreBase() && canSave(this.session()));

  protected readonly announcement = computed(() => {
    const [a, b] = this.display();
    return a && b ? `${a.team} ${a.score}, ${b.team} ${b.score}` : '';
  });
  protected readonly nextGameNumber = computed(() => this.pendingGame()?.gameNumber ?? (this.match.data()?.games.length ?? 0) + 1);
  protected readonly nextGameHint = computed(() => {
    const games = this.match.data()?.games ?? [];
    return games.length === 0 ? 'The match is in progress. Start the first game to begin scoring.' : 'Ready for the next game.';
  });

  protected readonly winnerPad = computed(() => this.padForSideId(this.match.data()?.winnerSideId ?? null));
  protected readonly loserPad = computed(() => {
    const winner = this.winnerPad();
    return this.pads().find((p) => p !== winner);
  });
  protected readonly gameLines = computed(() => {
    const [s1, s2] = this.sides();
    return (this.match.data()?.games ?? [])
      .filter((g) => g.status === 'Completed')
      .map((g) => `G${g.gameNumber} ${scoreOf(g, s1?.id ?? -1) ?? '–'}–${scoreOf(g, s2?.id ?? -2) ?? '–'}`);
  });

  constructor() {
    effect(() => {
      this.tournamentId();
      this.matchId();
      untracked(() => {
        this.reload();
        this.tournament.load(this.tournamentsApi.get(this.tournamentId()));
        this.settings.load(this.tournamentsApi.getMatchSettings(this.tournamentId()).pipe(catchError(() => of(null))));
        this.sports.load(this.sportsApi.getSports().pipe(catchError(() => of(null))));
      });
    });

    effect(() => {
      const gameId = this.activeGameId();
      untracked(() => {
        this.session.set(gameId === null ? EMPTY_SESSION : loadSession(this.keyFor(gameId)));
        this.saveError.set(null);
      });
    });
  }

  protected reload(): void {
    this.match.load(this.matchesApi.get(this.tournamentId(), this.matchId()));
  }

  protected wonFor(pad: PadSide | undefined): number {
    if (!pad) return 0;
    return pad.sideNumber === 1 ? this.won().side1 : this.won().side2;
  }

  protected winnerName(sideId: number | null): string {
    return this.sides().find((s) => s.id === sideId)?.teamName ?? 'Nobody';
  }

  private padForSideId(sideId: number | null): PadSide | undefined {
    const side = this.sides().find((s) => s.id === sideId);
    return side ? this.pads().find((p) => p.sideNumber === side.sideNumber) : undefined;
  }

  private keyFor(gameId: number): string {
    return sessionKey(this.tournamentId(), this.matchId(), gameId);
  }

  // ---- scoring actions ----

  protected point(side: SideNumber): void {
    if (!this.canScoreBase() || this.busy()) return;
    this.apply(addPoint(this.session(), side));
    if (typeof navigator !== 'undefined') {
      navigator.vibrate?.(10);
    }
  }

  protected undo(): void {
    this.apply(undoPoint(this.session()));
  }

  protected async reset(): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Reset this game?',
      message: 'The points counted so far in this game will be cleared. Nothing has been saved yet.',
      confirmLabel: 'Reset game',
      danger: true,
    });
    if (ok) {
      this.apply(EMPTY_SESSION);
    }
  }

  private apply(next: GameSession): void {
    this.session.set(next);
    const gameId = this.activeGameId();
    if (gameId !== null) {
      saveSession(this.keyFor(gameId), next);
    }
    this.saveError.set(null);
  }

  protected async save(): Promise<void> {
    const game = this.activeGame();
    const current = this.session();
    const rule = this.rule();
    if (!game || this.busy() || !canSave(current)) return;

    if (rule && gameWinner(current, rule) === null) {
      const ok = await this.confirmService.confirm({
        title: 'Save an unfinished score?',
        message: `${current.side1}–${current.side2} is not a finished game under the ${rule.source.toLowerCase()} (first to ${rule.pointsToWin}, win by ${rule.winBy}). The server will reject it if it does not fit the match's rule. Save anyway?`,
        confirmLabel: 'Save anyway',
      });
      if (!ok) return;
    }

    this.busy.set(true);
    this.saveError.set(null);
    this.matchesApi
      .recordScore(this.tournamentId(), this.matchId(), game.id, { side1Score: current.side1, side2Score: current.side2 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          clearSession(this.keyFor(game.id));
          this.busy.set(false);
          this.session.set(EMPTY_SESSION);
          this.lastResult.set(result);
          this.toast.success(result.matchStatus === 'Completed' ? 'Final game saved. Match complete.' : `Game ${result.gameNumber} saved.`);
          this.reload();
        },
        error: (error: unknown) => {
          this.busy.set(false);
          const apiError = ApiError.from(error);
          this.saveError.set(apiError.userMessage);
          this.toast.fromError(error, 'The score could not be saved.');
        },
      });
  }

  // ---- match flow ----

  protected startMatch(): void {
    this.run(this.matchesApi.start(this.tournamentId(), this.matchId()), 'Match started.');
  }

  protected startNextGame(): void {
    const t = this.tournamentId();
    const m = this.matchId();
    const pending = this.pendingGame();
    const request = pending
      ? this.matchesApi.startGame(t, m, pending.id)
      : this.matchesApi.createGame(t, m).pipe(switchMap((game) => this.matchesApi.startGame(t, m, game.id)));
    this.lastResult.set(null);
    this.run(request, 'Game started.');
  }

  private run(request: Observable<unknown>, success: string): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.saveError.set(null);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.success(success);
        this.reload();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.saveError.set(ApiError.from(error).userMessage);
        this.toast.fromError(error);
      },
    });
  }
}
