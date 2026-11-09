import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Team } from '../../../core/models/api.models';
import { TeamsApi } from '../../../core/services/api/teams.api';
import { AuthService } from '../../../core/services/auth.service';
import { deriveTeams, matchesQuery } from '../../../core/services/roster';
import { TournamentDirectory } from '../../../core/services/tournament-directory.service';
import { AsyncState } from '../../../core/state/async-state';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { TeamFormComponent } from '../ui/team-form.component';

@Component({
  selector: 'st-teams-list-page',
  imports: [
    RouterLink,
    AvatarComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    IconComponent,
    PageHeaderComponent,
    SkeletonComponent,
    TeamFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <st-page-header title="Teams" subtitle="Teams that have played or are registered. Organizers create their teams from a tournament's Teams tab.">
        @if (auth.isAdmin()) {
          <button type="button" class="btn" (click)="creating.set(!creating())">
            <st-icon [name]="creating() ? 'x' : 'plus'" />{{ creating() ? 'Close' : 'New team' }}
          </button>
        }
      </st-page-header>

      @if (creating()) {
        <st-team-form (saved)="onCreated($event)" (cancelled)="creating.set(false)" />
      }

      @if (pool.error(); as error) {
        <st-error-state [error]="error" (retry)="reload()" />
      } @else if (directory.error(); as error) {
        <st-error-state [error]="error" (retry)="directory.load(true)" />
      } @else if (!directory.loaded() || (pool.loading() && !pool.data())) {
        <div class="grid">
          @for (n of [1, 2, 3]; track n) {
            <div class="card"><st-skeleton [rows]="2" height="22px" /></div>
          }
        </div>
      } @else if (teams().length === 0) {
        <div class="card">
          <st-empty-state
            icon="users"
            title="No teams yet"
            [message]="auth.isAdmin() ? 'Create the first team, or register one inside a tournament.' : 'Teams appear here once a tournament organizer registers them.'"
          >
            <a class="btn btn--secondary" routerLink="/tournaments">Browse tournaments</a>
          </st-empty-state>
        </div>
      } @else {
        <div class="field search">
          <label class="field__label sr-only" for="team-search">Search teams</label>
          <input
            id="team-search"
            class="input"
            type="search"
            placeholder="Search by team name or code"
            [value]="query()"
            (input)="onSearch($event)"
          />
        </div>

        @if (filtered().length === 0) {
          <div class="card">
            <st-empty-state icon="search" title="No matching teams" message="Try a different name or code." />
          </div>
        } @else {
          <div class="grid">
            @for (team of filtered(); track team.teamId) {
              <a class="card card--link team" [routerLink]="['/teams', team.teamId]">
                <st-avatar [name]="team.name" [size]="44" />
                <div class="grow info">
                  <span class="name truncate">{{ team.name }}</span>
                  <span class="small muted">
                    {{ team.tournaments }} {{ team.tournaments === 1 ? 'tournament' : 'tournaments' }} ·
                    {{ team.playerCount }} {{ team.playerCount === 1 ? 'player' : 'players' }}
                  </span>
                </div>
                @if (!team.isActive) {
                  <span class="badge">Inactive</span>
                }
                @if (team.code) {
                  <span class="badge badge--primary">{{ team.code }}</span>
                }
              </a>
            }
          </div>
        }
      }
    </div>
  `,
  styles: `
    .search {
      max-width: 420px;
    }
    .team {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .info {
      display: flex;
      flex-direction: column;
    }
    .name {
      font-weight: 650;
      color: var(--c-text);
    }
  `,
})
export class TeamsListPage {
  protected readonly directory = inject(TournamentDirectory);
  protected readonly auth = inject(AuthService);
  private readonly teamsApi = inject(TeamsApi);

  protected readonly pool = new AsyncState<Team[]>();
  protected readonly query = signal('');
  protected readonly creating = signal(false);

  protected readonly teams = computed(() => {
    const derived = new Map(deriveTeams(this.directory.tournaments()).map((t) => [t.teamId, t]));
    return (this.pool.data() ?? [])
      .filter((team) => team.isActive || this.auth.isAdmin())
      .map((team) => ({
        teamId: team.id,
        name: team.name,
        code: team.code,
        isActive: team.isActive,
        tournaments: derived.get(team.id)?.appearances.length ?? 0,
        playerCount: derived.get(team.id)?.playerCount ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });
  protected readonly filtered = computed(() =>
    this.teams().filter((team) => matchesQuery(this.query(), team.name, team.code)),
  );

  constructor() {
    void this.directory.load();
    this.reload();
  }

  protected reload(): void {
    this.pool.load(this.teamsApi.list());
  }

  protected onCreated(team: Team): void {
    this.pool.data.update((list) => [...(list ?? []), team]);
    this.creating.set(false);
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }
}
