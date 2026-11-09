import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlayersApi } from '../../../core/services/api/players.api';
import { AuthService } from '../../../core/services/auth.service';
import { PlayerEntry, deriveTeams, derivePlayers, matchesQuery } from '../../../core/services/roster';
import { TournamentDirectory } from '../../../core/services/tournament-directory.service';
import { AsyncState } from '../../../core/state/async-state';
import { Player } from '../../../core/models/api.models';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';

interface PlayerRow {
  playerId: number;
  name: string;
  isActive: boolean;
  teamIds: number[];
  teamNames: string;
  tournaments: number;
}

function toRow(playerId: number, name: string, isActive: boolean, roster?: PlayerEntry): PlayerRow {
  return {
    playerId,
    name,
    isActive,
    teamIds: roster?.teams.map((t) => t.teamId) ?? [],
    teamNames: roster?.teams.map((t) => t.teamName).join(', ') ?? '',
    tournaments: roster?.appearances.length ?? 0,
  };
}

@Component({
  selector: 'st-players-list-page',
  imports: [
    RouterLink,
    AvatarComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    IconComponent,
    PageHeaderComponent,
    SkeletonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <st-page-header
        title="Players"
        [subtitle]="auth.isSignedIn() ? 'Everyone who has signed up. Organizers build teams from this list.' : 'Everyone playing in a tournament.'"
      >
        @if (auth.isSignedIn()) {
          <a class="btn btn--secondary" routerLink="/profile"><st-icon name="edit" />My profile</a>
        }
      </st-page-header>

      @if (!auth.isSignedIn()) {
        <div class="notice">
          <st-icon name="info" />
          <span>
            Players join by creating an account. <a routerLink="/sign-in">Sign in or sign up</a> to see everyone who has
            registered and to be added to a team.
          </span>
        </div>
      }

      @if (pool.error(); as error) {
        <st-error-state [error]="error" (retry)="reload()" />
      } @else if (directory.error(); as error) {
        <st-error-state [error]="error" (retry)="directory.load(true)" />
      } @else if (!directory.loaded() || (auth.isSignedIn() && pool.loading() && !pool.data())) {
        <div class="card card--flush">
          <div class="card__body"><st-skeleton [rows]="5" height="36px" /></div>
        </div>
      } @else if (players().length === 0) {
        <div class="card">
          <st-empty-state
            icon="user"
            title="No players yet"
            message="Players appear here when they create an account, or once their team is registered in a tournament."
          >
            <a class="btn btn--secondary" routerLink="/tournaments">Browse tournaments</a>
          </st-empty-state>
        </div>
      } @else {
        <div class="filters">
          <div class="field grow">
            <label class="field__label sr-only" for="player-search">Search players</label>
            <input
              id="player-search"
              class="input"
              type="search"
              placeholder="Search by name"
              [value]="query()"
              (input)="onSearch($event)"
            />
          </div>
          <div class="field team-filter">
            <label class="field__label sr-only" for="team-filter">Filter by team</label>
            <select id="team-filter" class="select" (change)="onTeam($event)">
              <option value="" [selected]="teamFilter() === null">All teams</option>
              @for (team of teams(); track team.teamId) {
                <option [value]="team.teamId" [selected]="teamFilter() === team.teamId">{{ team.name }}</option>
              }
            </select>
          </div>
        </div>

        @if (filtered().length === 0) {
          <div class="card">
            <st-empty-state icon="search" title="No matching players" message="Try a different name or team." />
          </div>
        } @else {
          <div class="card card--flush">
            <ul class="list">
              @for (player of filtered(); track player.playerId) {
                <li>
                  <st-avatar [name]="player.name" [size]="40" />
                  <a class="grow link" [routerLink]="['/players', player.playerId]">
                    <span class="name truncate">{{ player.name }}</span>
                    <span class="small muted truncate">
                      {{ player.teamNames || 'Not on a team yet' }}
                      @if (player.tournaments > 0) {
                        · {{ player.tournaments }} {{ player.tournaments === 1 ? 'tournament' : 'tournaments' }}
                      }
                    </span>
                  </a>
                  @if (!player.isActive) {
                    <span class="badge">Inactive</span>
                  }
                  <st-icon name="chevron-right" />
                </li>
              }
            </ul>
          </div>
        }
      }
    </div>
  `,
  styles: `
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .team-filter {
      flex: 0 1 240px;
      min-width: 160px;
    }
    .link {
      display: flex;
      flex-direction: column;
      min-width: 0;
      color: inherit;
      text-decoration: none;
    }
    .name {
      font-weight: 650;
      color: var(--c-text);
    }
    li > st-icon {
      color: var(--c-muted);
    }
  `,
})
export class PlayersListPage {
  protected readonly directory = inject(TournamentDirectory);
  protected readonly auth = inject(AuthService);
  private readonly playersApi = inject(PlayersApi);

  /** All registered players. `GET /api/players` needs a signed-in user, so guests never load it. */
  protected readonly pool = new AsyncState<Player[]>();
  protected readonly query = signal('');
  protected readonly teamFilter = signal<number | null>(null);

  private readonly derived = computed(() => derivePlayers(this.directory.tournaments()));
  protected readonly teams = computed(() => deriveTeams(this.directory.tournaments()));

  /** Signed in: the whole pool (including people on no team yet). Guests: players on tournament rosters. */
  protected readonly players = computed(() => {
    const roster = new Map(this.derived().map((p) => [p.playerId, p]));
    const rows: PlayerRow[] = this.auth.isSignedIn()
      ? (this.pool.data() ?? []).map((p) => toRow(p.id, p.name, p.isActive, roster.get(p.id)))
      : this.derived().map((p) => toRow(p.playerId, p.name, true, p));
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  });

  protected readonly filtered = computed(() => {
    const team = this.teamFilter();
    return this.players().filter(
      (player) => (team === null || player.teamIds.includes(team)) && matchesQuery(this.query(), player.name),
    );
  });

  constructor() {
    void this.directory.load();
    effect(() => {
      if (this.auth.isSignedIn()) {
        untracked(() => this.reload());
      }
    });
  }

  protected reload(): void {
    this.pool.load(this.playersApi.search());
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected onTeam(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.teamFilter.set(value === '' ? null : Number(value));
  }
}
