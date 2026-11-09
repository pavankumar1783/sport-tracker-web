import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, numberAttribute, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { MatchDetails, MatchSide, Tournament } from '../../../core/models/api.models';
import { humanizeEnum } from '../../../core/models/enums';
import { MatchesApi } from '../../../core/services/api/matches.api';
import { TournamentsApi } from '../../../core/services/api/tournaments.api';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { AsyncState } from '../../../core/state/async-state';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { asUtc, scoreOf } from '../match-utils';
import { gamesWon } from '../../scoring/scoring-session';

@Component({
  selector: 'st-match-detail-page',
  imports: [
    DatePipe,
    RouterLink,
    PageHeaderComponent,
    StatusBadgeComponent,
    AvatarComponent,
    ErrorStateComponent,
    SkeletonComponent,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      @if (match.error(); as error) {
        <st-page-header title="Match" [backLink]="['/tournaments', tournamentId()]" backLabel="Tournament" />
        <st-error-state [error]="error" (retry)="reload()" />
      } @else if (match.data(); as m) {
        <st-page-header
          [title]="title()"
          [eyebrow]="'Match #' + m.matchNumber + ' · ' + m.sportFormatName"
          [backLink]="['/tournaments', m.tournamentId, 'matches']"
          backLabel="Tournament matches"
        >
          <st-status-badge [status]="m.status" />
        </st-page-header>

        <section class="card result" [attr.aria-label]="'Result'">
          <div class="side" [class.winner]="m.winnerSideId === side1()?.id">
            <span class="team truncate">{{ side1()?.teamName }}</span>
            <span class="players">{{ players(side1()) }}</span>
            @if (m.winnerSideId === side1()?.id) {
              <span class="badge badge--success"><st-icon name="trophy" />Winner</span>
            }
          </div>
          <div class="tally" aria-label="Games won">
            @if (m.status === 'Walkover') {
              <span class="wo">W/O</span>
            } @else if (m.status === 'Cancelled') {
              <span class="wo">—</span>
            } @else {
              <span class="num">{{ won().side1 }}</span><span class="sep">–</span><span class="num">{{ won().side2 }}</span>
            }
          </div>
          <div class="side side--right" [class.winner]="m.winnerSideId === side2()?.id">
            <span class="team truncate">{{ side2()?.teamName }}</span>
            <span class="players">{{ players(side2()) }}</span>
            @if (m.winnerSideId === side2()?.id) {
              <span class="badge badge--success"><st-icon name="trophy" />Winner</span>
            }
          </div>
        </section>

        @if (m.status === 'Walkover') {
          <div class="notice notice--warning"><st-icon name="flag" /><div>Walkover: the match was awarded without being played.</div></div>
        } @else if (m.status === 'Cancelled') {
          <div class="notice notice--danger"><st-icon name="x" /><div>This match was cancelled and has no result.</div></div>
        }

        @if (canAct()) {
          @if (m.status === 'Scheduled' || m.status === 'InProgress') {
            <section class="card stack" aria-label="Organizer actions">
              <span class="eyebrow">Organizer actions</span>
              <div class="row">
                @if (m.status === 'Scheduled') {
                  <button type="button" class="btn" [disabled]="busy()" (click)="startMatch()">
                    <st-icon name="play" />Start match
                  </button>
                }
                @if (m.status === 'InProgress') {
                  <a class="btn btn--accent" [routerLink]="['/scoring', m.tournamentId, m.id]"><st-icon name="zap" />Open live scoring</a>
                }
                <button type="button" class="btn btn--secondary" [disabled]="busy()" (click)="walkoverOpen.set(!walkoverOpen())" [attr.aria-expanded]="walkoverOpen()">
                  <st-icon name="flag" />Walkover
                </button>
                <button type="button" class="btn btn--secondary" [disabled]="busy()" (click)="cancelMatch()">
                  <st-icon name="x" />Cancel match
                </button>
              </div>
              @if (walkoverOpen()) {
                <div class="stack wo-panel">
                  <span class="small muted">Award the match to one side without playing it:</span>
                  <div class="row">
                    @for (side of sides(); track side.id) {
                      <button type="button" class="btn btn--sm btn--secondary" [disabled]="busy()" (click)="walkover(side)">
                        Award to {{ side.teamName }}
                      </button>
                    }
                  </div>
                </div>
              }
            </section>
          }
        } @else if (canManage() && tournament.data() && tournament.data()?.status !== 'Active' && (m.status === 'Scheduled' || m.status === 'InProgress')) {
          <div class="notice"><st-icon name="info" /><div>This tournament is {{ statusText() }}, so the match cannot be changed.</div></div>
        }

        <section class="card card--flush" aria-label="Scorecard">
          <div class="card__header"><h2>Scorecard</h2></div>
          @if (m.games.length === 0) {
            <p class="muted empty">No games have been played yet.</p>
          } @else {
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th scope="col">Game</th>
                    <th scope="col" class="right">{{ side1()?.teamName }}</th>
                    <th scope="col" class="right">{{ side2()?.teamName }}</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  @for (game of m.games; track game.id) {
                    <tr>
                      <th scope="row" class="strong">{{ game.gameNumber }}</th>
                      <td class="right num" [class.win]="game.winnerSideId === side1()?.id">{{ score(game, side1()) }}</td>
                      <td class="right num" [class.win]="game.winnerSideId === side2()?.id">{{ score(game, side2()) }}</td>
                      <td><st-status-badge [status]="game.status" /></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>

        <div class="grid grid--2">
          @for (side of sides(); track side.id) {
            <section class="card stack" [attr.aria-label]="side.teamName + ' players'">
              <span class="eyebrow">Side {{ side.sideNumber }}</span>
              <h3>{{ side.teamName }}</h3>
              <ul class="list roster">
                @for (p of side.players; track p.playerId) {
                  <li>
                    <st-avatar [name]="p.playerName" [size]="32" />
                    <span class="grow truncate">{{ p.playerName }}</span>
                  </li>
                }
              </ul>
            </section>
          }
        </div>

        <section class="card">
          <dl class="times">
            @if (m.scheduledAt) {
              <div><dt>Scheduled</dt><dd>{{ utc(m.scheduledAt) | date: 'd MMM y, HH:mm' }}</dd></div>
            }
            <div><dt>Started</dt><dd>{{ m.startedAt ? (utc(m.startedAt) | date: 'd MMM y, HH:mm') : 'Not started' }}</dd></div>
            <div><dt>Finished</dt><dd>{{ m.completedAt ? (utc(m.completedAt) | date: 'd MMM y, HH:mm') : '—' }}</dd></div>
            <div><dt>Type</dt><dd>{{ typeText() }}</dd></div>
          </dl>
        </section>
      } @else {
        <st-page-header title="Match" />
        <div class="card"><st-skeleton [rows]="5" height="22px" /></div>
      }
    </div>
  `,
  styles: `
    .result {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 12px;
      padding: 20px 16px;
    }
    .side {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
      min-width: 0;
    }
    .side--right {
      align-items: flex-end;
      text-align: right;
    }
    .team {
      font-size: 1.0625rem;
      font-weight: 700;
      max-width: 100%;
    }
    .players {
      font-size: 0.8125rem;
      color: var(--c-muted);
      overflow-wrap: anywhere;
    }
    .winner .team {
      color: var(--c-success);
    }
    .tally {
      display: flex;
      align-items: baseline;
      gap: 8px;
      font-size: 2.25rem;
      font-weight: 800;
      letter-spacing: -0.03em;
    }
    .sep,
    .wo {
      color: var(--c-muted);
      font-weight: 600;
    }
    .wo {
      font-size: 1.25rem;
    }
    .empty {
      padding: 20px 16px;
    }
    td.win {
      font-weight: 800;
      color: var(--c-success);
    }
    .roster {
      margin: 0 -16px -16px;
    }
    .times {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 14px;
      margin: 0;
    }
    dt {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--c-muted);
    }
    dd {
      margin: 2px 0 0;
      font-weight: 600;
    }
    @media (max-width: 520px) {
      .result {
        grid-template-columns: 1fr;
        text-align: center;
      }
      .side,
      .side--right {
        align-items: center;
        text-align: center;
      }
      .tally {
        justify-content: center;
        order: -1;
      }
    }
  `,
})
export class MatchDetailPage {
  protected readonly auth = inject(AuthService);
  private readonly matchesApi = inject(MatchesApi);
  private readonly tournamentsApi = inject(TournamentsApi);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly destroyRef = inject(DestroyRef);

  readonly tournamentId = input.required({ transform: numberAttribute });
  readonly matchId = input.required({ transform: numberAttribute });

  protected readonly match = new AsyncState<MatchDetails>();
  protected readonly tournament = new AsyncState<Tournament>();
  protected readonly busy = signal(false);
  protected readonly walkoverOpen = signal(false);

  protected readonly sides = computed(() => [...(this.match.data()?.sides ?? [])].sort((a, b) => a.sideNumber - b.sideNumber));
  protected readonly side1 = computed<MatchSide | undefined>(() => this.sides()[0]);
  protected readonly side2 = computed<MatchSide | undefined>(() => this.sides()[1]);
  protected readonly title = computed(() => {
    const m = this.match.data();
    if (!m) return 'Match';
    return m.name ?? `${this.side1()?.teamName ?? 'Side 1'} vs ${this.side2()?.teamName ?? 'Side 2'}`;
  });
  protected readonly won = computed(() => gamesWon(this.match.data()?.games ?? [], this.side1()?.id ?? -1, this.side2()?.id ?? -2));
  protected readonly canManage = computed(() => this.auth.canManage(this.tournament.data()?.organizerUserId));
  protected readonly canAct = computed(() => this.canManage() && this.tournament.data()?.status === 'Active');
  protected readonly statusText = computed(() => humanizeEnum(this.tournament.data()?.status ?? '').toLowerCase());
  protected readonly typeText = computed(() => humanizeEnum(this.match.data()?.matchType ?? ''));

  constructor() {
    effect(() => {
      this.tournamentId();
      this.matchId();
      untracked(() => this.reload());
    });
  }

  protected reload(): void {
    this.match.load(this.matchesApi.get(this.tournamentId(), this.matchId()));
    this.tournament.load(this.tournamentsApi.get(this.tournamentId()));
  }

  protected utc = asUtc;

  protected players(side: MatchSide | undefined): string {
    return side ? side.players.map((p) => p.playerName).join(' / ') : '';
  }

  protected score(game: MatchDetails['games'][number], side: MatchSide | undefined): string {
    const value = side ? scoreOf(game, side.id) : null;
    return value === null ? '–' : String(value);
  }

  protected startMatch(): void {
    this.run(this.matchesApi.start(this.tournamentId(), this.matchId()), 'Match started.');
  }

  protected async cancelMatch(): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Cancel this match?',
      message: 'A cancelled match has no result and is ignored by standings and leaderboards. This cannot be undone.',
      confirmLabel: 'Cancel match',
      cancelLabel: 'Keep match',
      danger: true,
    });
    if (ok) {
      this.run(this.matchesApi.cancel(this.tournamentId(), this.matchId()), 'Match cancelled.');
    }
  }

  protected async walkover(side: MatchSide): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: `Award the match to ${side.teamName}?`,
      message: 'A walkover counts as a match win for the team in the standings (not on the player leaderboard). This cannot be undone.',
      confirmLabel: 'Award walkover',
      danger: true,
    });
    if (ok) {
      this.run(
        this.matchesApi.walkover(this.tournamentId(), this.matchId(), side.sideNumber === 1 ? 1 : 2),
        `Walkover awarded to ${side.teamName}.`,
      );
    }
  }

  private run(request: Observable<unknown>, success: string): void {
    if (this.busy()) return;
    this.busy.set(true);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy.set(false);
        this.walkoverOpen.set(false);
        this.toast.success(success);
        this.reload();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.toast.fromError(error);
      },
    });
  }
}
