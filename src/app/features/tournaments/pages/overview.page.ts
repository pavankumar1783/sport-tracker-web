import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardMatch, TournamentDashboard } from '../../../core/models/api.models';
import { humanizeEnum } from '../../../core/models/enums';
import { TournamentsApi } from '../../../core/services/api/tournaments.api';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { AsyncState } from '../../../core/state/async-state';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { MatchCardComponent, MatchCardData } from '../../../shared/components/match-card/match-card.component';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { StatTileComponent } from '../../../shared/components/stat-tile/stat-tile.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { TournamentContext, TournamentLifecycle } from '../tournament-context.service';
import {
  LIFECYCLE_STEPS,
  LifecycleAction,
  nextLifecycleAction,
  stepState,
} from '../tournament-logic';

const CONFIRMATIONS: Partial<Record<LifecycleAction['kind'], { title: string; message: string; label: string }>> = {
  start: {
    title: 'Start this tournament?',
    message: 'Registration closes and matches can be created and scored. Teams can no longer be added.',
    label: 'Start tournament',
  },
  complete: {
    title: 'Complete this tournament?',
    message: 'All stages are marked completed and the final standings are locked. This cannot be undone.',
    label: 'Complete tournament',
  },
};

const SUCCESS_MESSAGES: Record<LifecycleAction['kind'], string> = {
  openRegistration: 'Registration is open. Teams can now be added.',
  start: 'Tournament started. You can create and score matches.',
  complete: 'Tournament completed.',
};

@Component({
  selector: 'st-tournament-overview-page',
  imports: [
    RouterLink,
    IconComponent,
    StatTileComponent,
    StatusBadgeComponent,
    MatchCardComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    SkeletonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (dashboard.error(); as error) {
      <st-error-state [error]="error" (retry)="load()" />
    } @else if (dashboard.data(); as data) {
      <div class="stack--lg stack">
        <section class="card stack" aria-label="Tournament progress">
          <ol class="steps">
            @for (step of steps; track step) {
              <li class="step" [attr.data-state]="stepStateOf(data, step)" [attr.aria-current]="stepStateOf(data, step) === 'current' ? 'step' : null">
                <span class="bullet">
                  @if (stepStateOf(data, step) === 'done') {
                    <st-icon name="check" />
                  }
                </span>
                <span class="step-label">{{ label(step) }}</span>
              </li>
            }
          </ol>

          @if (data.status === 'Cancelled') {
            <div class="notice notice--danger"><st-icon name="alert" />This tournament was cancelled.</div>
          }

          @if (action(data); as next) {
            @if (context.canManage()) {
              <div class="row row--between next">
                <div class="grow">
                  <strong>Next step: {{ next.label }}</strong>
                  @if (next.blockedReason; as reason) {
                    <p class="muted small">{{ reason }}</p>
                  }
                </div>
                <button
                  type="button"
                  class="btn"
                  [class.btn--accent]="next.kind === 'complete'"
                  [disabled]="next.blockedReason !== null || busy()"
                  (click)="run(next)"
                >
                  <st-icon [name]="next.kind === 'complete' ? 'flag' : 'play'" />
                  {{ busy() ? 'Working…' : next.label }}
                </button>
              </div>
            } @else {
              <p class="muted small">Only the tournament's organizer can move it to the next stage.</p>
            }
          }
        </section>

        <section class="grid grid--stats" aria-label="Summary">
          <st-stat-tile label="Teams" [value]="data.teamCount" icon="users" />
          <st-stat-tile label="Matches" [value]="data.matchCount" icon="versus" />
          <st-stat-tile label="Completed" [value]="data.completedMatchCount" icon="check" />
          <st-stat-tile label="In progress" [value]="data.inProgressMatchCount" icon="zap" />
        </section>
        @if (data.scheduledMatchCount > 0) {
          <p class="muted small">
            {{ data.scheduledMatchCount }} {{ data.scheduledMatchCount === 1 ? 'match is' : 'matches are' }} still scheduled.
            Play, walk over or cancel them before completing the tournament.
          </p>
        }

        <div class="grid grid--2">
          <section class="card stack" aria-label="Current stage">
            <h2>Current stage</h2>
            @if (data.currentStage; as stage) {
              <div class="row row--between">
                <div>
                  <strong>{{ stage.name }}</strong>
                  <p class="muted small">{{ stageType(stage.stageType) }} · stage {{ stage.sequence }}</p>
                </div>
                <st-status-badge [status]="stage.status" />
              </div>
            } @else {
              <p class="muted">No stage is in progress.</p>
            }
            <a class="btn btn--secondary btn--sm" [routerLink]="['/tournaments', data.tournamentId, 'stages']">All stages</a>
          </section>

          <section class="stack" aria-label="Recent matches">
            <div class="row row--between">
              <h2>Recent matches</h2>
              <a class="small" [routerLink]="['/tournaments', data.tournamentId, 'matches']">View all</a>
            </div>
            @if (matchCards().length === 0) {
              <div class="card">
                <st-empty-state icon="versus" title="No matches yet" message="Matches appear here once an organizer creates them." />
              </div>
            } @else {
              <div class="stack">
                @for (match of matchCards(); track match.id) {
                  <st-match-card [match]="match" />
                }
              </div>
            }
          </section>
        </div>
      </div>
    } @else {
      <div class="stack" aria-busy="true">
        <div class="card"><st-skeleton [rows]="3" height="24px" /></div>
        <div class="grid grid--stats">
          @for (n of [1, 2, 3, 4]; track n) {
            <div class="card"><st-skeleton [rows]="2" /></div>
          }
        </div>
      </div>
    }
  `,
  styles: `
    .steps {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .step {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      text-align: center;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--c-muted);
    }
    .step::before {
      content: '';
      position: absolute;
      top: 11px;
      right: 50%;
      width: 100%;
      height: 2px;
      background: var(--c-border-strong);
    }
    .step:first-child::before {
      display: none;
    }
    .bullet {
      position: relative;
      z-index: 1;
      display: grid;
      place-items: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--c-surface);
      border: 2px solid var(--c-border-strong);
      color: #fff;
      --icon-size: 14px;
    }
    .step[data-state='done'] {
      color: var(--c-text);
    }
    .step[data-state='done']::before,
    .step[data-state='current']::before {
      background: var(--c-primary);
    }
    .step[data-state='done'] .bullet {
      background: var(--c-primary);
      border-color: var(--c-primary);
    }
    .step[data-state='current'] {
      color: var(--c-primary);
    }
    .step[data-state='current'] .bullet {
      border-color: var(--c-primary);
      box-shadow: 0 0 0 4px var(--c-primary-soft);
    }
    .next {
      padding-top: 12px;
      border-top: 1px solid var(--c-border);
    }
    .next .btn {
      flex: none;
    }
  `,
})
export class OverviewPage {
  private readonly api = inject(TournamentsApi);
  protected readonly context = inject(TournamentContext);
  private readonly lifecycle = inject(TournamentLifecycle);
  private readonly confirmService = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly dashboard = new AsyncState<TournamentDashboard>();
  protected readonly busy = signal(false);
  protected readonly steps = LIFECYCLE_STEPS;

  protected readonly matchCards = computed<MatchCardData[]>(() => {
    const data = this.dashboard.data();
    return data ? data.recentMatches.map((match) => toCardData(data.tournamentId, match)) : [];
  });

  constructor() {
    effect(() => {
      const id = this.context.id();
      if (id !== null) {
        untracked(() => this.load(true));
      }
    });
  }

  protected load(reset = false): void {
    const id = this.context.id();
    if (id !== null) {
      this.dashboard.load(this.api.getDashboard(id), { keepData: !reset });
    }
  }

  protected action(data: TournamentDashboard): LifecycleAction | null {
    return nextLifecycleAction(data.status, { stageCount: data.stageCount, teamCount: data.teamCount });
  }

  protected stepStateOf = (data: TournamentDashboard, step: (typeof LIFECYCLE_STEPS)[number]) =>
    stepState(data.status, step);

  protected label(value: string): string {
    return humanizeEnum(value);
  }

  protected stageType(value: string): string {
    return humanizeEnum(value);
  }

  protected async run(action: LifecycleAction): Promise<void> {
    const id = this.context.id();
    if (id === null || this.busy()) {
      return;
    }

    const confirmation = CONFIRMATIONS[action.kind];
    if (confirmation) {
      const confirmed = await this.confirmService.confirm({
        title: confirmation.title,
        message: confirmation.message,
        confirmLabel: confirmation.label,
        danger: action.kind === 'complete',
      });
      if (!confirmed) {
        return;
      }
    }

    this.busy.set(true);
    this.lifecycle.run(action.kind, id).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.success(SUCCESS_MESSAGES[action.kind]);
        this.load();
        this.context.reload();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.toast.fromError(error, 'That change could not be made.');
      },
    });
  }
}

function toCardData(tournamentId: number, match: DashboardMatch): MatchCardData {
  return {
    tournamentId,
    id: match.id,
    matchNumber: match.matchNumber,
    name: match.name,
    matchType: match.matchType,
    status: match.status,
    winnerSideId: match.winnerSideId,
    sides: match.sides.map((side) => ({ sideNumber: side.sideNumber, teamName: side.teamName })),
  };
}
