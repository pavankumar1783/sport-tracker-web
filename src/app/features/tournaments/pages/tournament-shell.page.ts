import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, numberAttribute } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { TabItem, TabNavComponent } from '../../../shared/components/tab-nav/tab-nav.component';
import { TournamentContext } from '../tournament-context.service';

/** Header + section tabs for one tournament; the tab pages render in the outlet and read data from `TournamentContext`. */
@Component({
  selector: 'st-tournament-shell-page',
  imports: [
    RouterOutlet,
    DatePipe,
    IconComponent,
    PageHeaderComponent,
    StatusBadgeComponent,
    TabNavComponent,
    ErrorStateComponent,
    SkeletonComponent,
  ],
  providers: [TournamentContext],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      @if (context.state.error(); as error) {
        <st-page-header title="Tournament" backLink="/tournaments" backLabel="Tournaments" />
        <st-error-state [error]="error" (retry)="context.reload()" />
      } @else {
        @if (context.state.data(); as tournament) {
          <st-page-header
            [title]="tournament.name"
            [eyebrow]="tournament.sportName"
            backLink="/tournaments"
            backLabel="Tournaments"
          >
            <st-status-badge [status]="tournament.status" />
          </st-page-header>
          <div class="facts muted small">
            <span><st-icon name="users" />{{ tournament.teams.length }} {{ tournament.teams.length === 1 ? 'team' : 'teams' }}</span>
            @if (tournament.rosterSize) {
              <span><st-icon name="user" />{{ tournament.rosterSize }} per team</span>
            }
            @if (tournament.startDate) {
              <span
                ><st-icon name="calendar" />{{ tournament.startDate | date: 'd MMM y'
                }}{{ tournament.endDate ? ' – ' + (tournament.endDate | date: 'd MMM y') : '' }}</span
              >
            }
          </div>
        } @else {
          <st-page-header title="Loading tournament…" backLink="/tournaments" backLabel="Tournaments" />
          <st-skeleton [rows]="1" height="16px" />
        }
        <st-tab-nav [tabs]="tabs()" label="Tournament sections" />
        <router-outlet />
      }
    </div>
  `,
  styles: `
    .facts {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 16px;
      margin-top: -8px;
    }
    .facts span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      --icon-size: 14px;
    }
  `,
})
export class TournamentShellPage {
  protected readonly context = inject(TournamentContext);

  readonly tournamentId = input.required({ transform: numberAttribute });

  protected readonly tabs = computed<TabItem[]>(() => {
    const tabs: TabItem[] = [
      { label: 'Overview', link: '.', exact: true },
      { label: 'Teams', link: 'teams' },
      { label: 'Stages', link: 'stages' },
      { label: 'Matches', link: 'matches' },
      { label: 'Standings', link: 'standings' },
      { label: 'Top players', link: 'mvp' },
    ];
    if (this.context.canManage()) {
      tabs.push({ label: 'Settings', link: 'settings' });
    }
    return tabs;
  });

  constructor() {
    effect(() => this.context.setId(this.tournamentId()));
  }
}
