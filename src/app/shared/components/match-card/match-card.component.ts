import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatchStatus, MatchType, humanizeEnum } from '../../../core/models/enums';
import { IconComponent } from '../icon/icon.component';
import { StatusBadgeComponent } from '../status-badge/status-badge.component';

export interface MatchCardSide {
  /** Present on match lists; absent on dashboard items, which therefore cannot show a winner. */
  sideId?: number;
  sideNumber: number;
  teamName: string;
  /** Shown instead of the team name when set (e.g. "Ana Silva / Bo Chen"). */
  displayName?: string;
}

export interface MatchCardData {
  tournamentId: number;
  id: number;
  matchNumber: number;
  name: string | null;
  matchType: MatchType;
  status: MatchStatus;
  winnerSideId: number | null;
  scheduledAt?: string | null;
  sides: readonly MatchCardSide[];
  /** Format and scoring rule, e.g. "Doubles · Best of 3 to 11, win by 2". */
  formatLabel?: string;
}

/** Compact match summary used on the dashboard, tournament pages, team and player pages. */
@Component({
  selector: 'st-match-card',
  imports: [RouterLink, DatePipe, StatusBadgeComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="card card--link match" [routerLink]="['/matches', match().tournamentId, match().id]">
      <div class="meta">
        <span class="eyebrow">#{{ match().matchNumber }} · {{ title() }}</span>
        <st-status-badge [status]="match().status" />
      </div>
      <div class="teams">
        @for (side of sides(); track side.sideNumber) {
          <div class="team" [class.winner]="isWinner(side.sideId)">
            <span class="name truncate">{{ side.displayName ?? side.teamName }}</span>
            @if (isWinner(side.sideId)) {
              <st-icon name="check" />
            }
          </div>
        }
      </div>
      @if (match().formatLabel; as format) {
        <span class="muted small">{{ format }}</span>
      }
      @if (match().scheduledAt; as when) {
        <span class="when muted small"><st-icon name="calendar" />{{ when | date: 'EEE d MMM, HH:mm' }}</span>
      }
      @if (match().status === 'InProgress') {
        <span class="live-cta"><st-icon name="zap" />Live now</span>
      }
    </a>
  `,
  styles: `
    .match {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .teams {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .team {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-weight: 500;
      --icon-size: 16px;
    }
    .team.winner {
      font-weight: 700;
      color: var(--c-success);
    }
    .when {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      --icon-size: 14px;
    }
    .live-cta {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--c-accent);
      font-size: 0.8125rem;
      font-weight: 700;
      --icon-size: 14px;
    }
  `,
})
export class MatchCardComponent {
  readonly match = input.required<MatchCardData>();

  protected readonly sides = computed(() => [...this.match().sides].sort((a, b) => a.sideNumber - b.sideNumber));
  protected readonly title = computed(() => this.match().name ?? humanizeEnum(this.match().matchType));

  protected isWinner(sideId: number | undefined): boolean {
    const winner = this.match().winnerSideId;
    return sideId !== undefined && winner !== null && sideId === winner;
  }
}
