import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { humanizeEnum } from '../../../core/models/enums';
import { AuthService } from '../../../core/services/auth.service';
import { TournamentDirectory } from '../../../core/services/tournament-directory.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { STATUS_FILTERS, StatusFilter, filterTournaments } from '../tournament-logic';

@Component({
  selector: 'st-tournaments-list-page',
  imports: [
    DatePipe,
    RouterLink,
    IconComponent,
    PageHeaderComponent,
    StatusBadgeComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    SkeletonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <st-page-header title="Tournaments" subtitle="Every tournament, newest first.">
        <button type="button" class="btn btn--secondary" [disabled]="directory.loading()" (click)="refresh()">
          <st-icon name="refresh" />Refresh
        </button>
        @if (auth.isSignedIn()) {
          <a class="btn" routerLink="/tournaments/new"><st-icon name="plus" />New tournament</a>
        }
      </st-page-header>

      @if (auth.isSignedIn()) {
        <div class="segmented" role="group" aria-label="Which tournaments">
          <button type="button" [attr.aria-pressed]="!onlyMine()" (click)="onlyMine.set(false)">All tournaments</button>
          <button type="button" [attr.aria-pressed]="onlyMine()" (click)="onlyMine.set(true)">My tournaments</button>
        </div>
      }

      <div class="toolbar">
        <div class="search">
          <label class="sr-only" for="tournament-search">Search tournaments</label>
          <st-icon name="search" />
          <input
            id="tournament-search"
            class="input"
            type="search"
            placeholder="Search by name or sport"
            [value]="search()"
            (input)="search.set($any($event.target).value)"
          />
        </div>
        <div class="chips" role="group" aria-label="Filter by status">
          @for (option of filters; track option) {
            <button
              type="button"
              class="chip"
              [attr.aria-pressed]="status() === option"
              (click)="status.set(option)"
            >
              {{ label(option) }}
            </button>
          }
        </div>
      </div>

      @if (directory.error(); as error) {
        <st-error-state [error]="error" (retry)="refresh()" />
      } @else if (!directory.loaded()) {
        <div class="grid" aria-busy="true">
          @for (n of [1, 2, 3]; track n) {
            <div class="card"><st-skeleton [rows]="3" /></div>
          }
        </div>
      } @else if (filtered().length === 0) {
        <div class="card">
          @if (directory.tournaments().length === 0) {
            <st-empty-state
              icon="trophy"
              title="No tournaments yet"
              message="Create the first tournament, register teams, and start scoring matches."
            >
              @if (auth.isSignedIn()) {
                <a class="btn" routerLink="/tournaments/new"><st-icon name="plus" />Create tournament</a>
              } @else {
                <a class="btn btn--secondary" routerLink="/sign-in"><st-icon name="log-in" />Sign in to create one</a>
              }
            </st-empty-state>
          } @else if (onlyMine() && mineCount() === 0) {
            <st-empty-state
              icon="trophy"
              title="You are not in any tournament yet"
              message="Create a tournament to organize it, or ask an organizer to add you to a team."
            >
              <a class="btn" routerLink="/tournaments/new"><st-icon name="plus" />Create tournament</a>
            </st-empty-state>
          } @else {
            <st-empty-state icon="search" title="No matching tournaments" message="Try a different search or status." />
          }
        </div>
      } @else {
        <div class="grid">
          @for (tournament of filtered(); track tournament.id) {
            <a class="card card--link tournament" [routerLink]="['/tournaments', tournament.id]">
              <div class="top">
                <span class="eyebrow">{{ tournament.sportName }}</span>
                <span class="row row--nowrap">
                  @for (role of rolesOf(tournament.id); track role) {
                    <span class="badge" [class.badge--primary]="role === 'Organizer'">{{ role }}</span>
                  }
                  <st-status-badge [status]="tournament.status" />
                </span>
              </div>
              <h2 class="name">{{ tournament.name }}</h2>
              <div class="facts muted small">
                <span><st-icon name="users" />{{ tournament.teams.length }} {{ tournament.teams.length === 1 ? 'team' : 'teams' }}</span>
                @if (tournament.startDate) {
                  <span
                    ><st-icon name="calendar" />{{ tournament.startDate | date: 'd MMM y'
                    }}{{ tournament.endDate ? ' – ' + (tournament.endDate | date: 'd MMM y') : '' }}</span
                  >
                }
              </div>
            </a>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .toolbar {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .search {
      position: relative;
      --icon-size: 18px;
    }
    .search st-icon {
      position: absolute;
      left: 12px;
      top: 13px;
      color: var(--c-muted);
      pointer-events: none;
    }
    .search .input {
      padding-left: 38px;
    }
    .chips {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      scrollbar-width: none;
      padding-bottom: 2px;
    }
    .chip {
      flex: none;
      min-height: 34px;
      padding: 0 14px;
      border-radius: 999px;
      border: 1px solid var(--c-border-strong);
      background: var(--c-surface);
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--c-muted);
    }
    .chip[aria-pressed='true'] {
      background: var(--c-primary);
      border-color: var(--c-primary);
      color: var(--c-on-primary);
    }
    .tournament {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .name {
      overflow-wrap: anywhere;
    }
    .facts {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 16px;
    }
    .facts span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      --icon-size: 14px;
    }
    @media (min-width: 760px) {
      .toolbar {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
      }
      .search {
        width: 320px;
      }
    }
  `,
})
export class TournamentsListPage {
  protected readonly auth = inject(AuthService);
  protected readonly directory = inject(TournamentDirectory);

  protected readonly filters = STATUS_FILTERS;
  protected readonly search = signal('');
  protected readonly status = signal<StatusFilter>('All');

  protected readonly onlyMine = signal(false);

  private readonly mineIds = computed(() =>
    this.auth.isSignedIn() && this.onlyMine() ? new Set(this.directory.myRoles().keys()) : null,
  );
  protected readonly mineCount = computed(() => this.directory.myRoles().size);

  protected readonly filtered = computed(() =>
    filterTournaments(this.directory.tournaments(), this.search(), this.status(), this.mineIds()),
  );

  constructor() {
    void this.directory.load();
  }

  protected rolesOf(tournamentId: number): readonly string[] {
    return this.directory.myRoles().get(tournamentId) ?? [];
  }

  protected refresh(): void {
    void this.directory.load(true);
  }

  protected label(option: StatusFilter): string {
    return humanizeEnum(option);
  }
}
