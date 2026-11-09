import { ChangeDetectionStrategy, Component, computed, effect, inject, input, numberAttribute, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StandingItem, Team, TournamentStandings } from '../../../core/models/api.models';
import { TeamsApi } from '../../../core/services/api/teams.api';
import { AuthService } from '../../../core/services/auth.service';
import { InsightsService } from '../../../core/services/insights.service';
import { TournamentMatches } from '../../../core/services/insights.models';
import { sortForDisplay, teamMatches } from '../../../core/services/match-history';
import { TeamEntry, deriveTeams } from '../../../core/services/roster';
import { TournamentDirectory } from '../../../core/services/tournament-directory.service';
import { AsyncState } from '../../../core/state/async-state';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { MatchCardComponent } from '../../../shared/components/match-card/match-card.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { StatTileComponent } from '../../../shared/components/stat-tile/stat-tile.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { TeamFormComponent } from '../ui/team-form.component';

type Section = 'overview' | 'matches';

@Component({
  selector: 'st-team-detail-page',
  imports: [
    RouterLink,
    AvatarComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    IconComponent,
    MatchCardComponent,
    PageHeaderComponent,
    SkeletonComponent,
    StatTileComponent,
    StatusBadgeComponent,
    TeamFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      @if (directory.error(); as error) {
        <st-error-state [error]="error" (retry)="directory.load(true)" />
      } @else if (!directory.loaded() || (poolTeam.loading() && !poolTeam.data())) {
        <div class="card"><st-skeleton [rows]="5" height="26px" /></div>
      } @else if (team(); as t) {
        <st-page-header
          [title]="t.name"
          eyebrow="Team"
          [subtitle]="t.code ? 'Code ' + t.code : undefined"
          backLink="/teams"
          backLabel="All teams"
        >
          @if (poolTeam.data()?.isActive === false) {
            <span class="badge">Inactive</span>
          }
          @if (auth.isAdmin() && poolTeam.data()) {
            <button type="button" class="btn btn--secondary" (click)="editing.set(!editing())">
              <st-icon name="edit" />{{ editing() ? 'Close' : 'Edit team' }}
            </button>
          }
        </st-page-header>

        @if (editing()) {
          <st-team-form [team]="poolTeam.data() ?? undefined" (saved)="onSaved($event)" (cancelled)="editing.set(false)" />
        }

        <div class="grid grid--stats">
          <st-stat-tile label="Tournaments" [value]="t.appearances.length" icon="trophy" />
          <st-stat-tile label="Players" [value]="t.playerCount" icon="user" />
          <st-stat-tile label="Matches won" [value]="totals().won" icon="check" />
          <st-stat-tile label="Matches lost" [value]="totals().lost" icon="x" />
        </div>

        <div class="segmented" role="group" aria-label="Team sections">
          <button type="button" [attr.aria-pressed]="section() === 'overview'" (click)="section.set('overview')">
            Tournaments and roster
          </button>
          <button type="button" [attr.aria-pressed]="section() === 'matches'" (click)="section.set('matches')">
            Matches
          </button>
        </div>

        @if (section() === 'overview') {
          <div class="stack stack--lg">
            @if (records().length === 0) {
              <div class="card">
                <st-empty-state
                  icon="trophy"
                  title="Not in a tournament yet"
                  message="This team is in the pool but has not been registered in a tournament."
                />
              </div>
            }
            @for (record of records(); track record.appearance.tournamentId) {
              <section class="card card--flush" [attr.aria-label]="record.appearance.tournamentName">
                <div class="card__header">
                  <div class="head">
                    <a class="tname truncate" [routerLink]="['/tournaments', record.appearance.tournamentId]">
                      {{ record.appearance.tournamentName }}
                    </a>
                    <span class="small muted">
                      @if (standings.loading() && !standings.data()) {
                        Loading record…
                      } @else if (record.standing; as s) {
                        Position {{ s.position }} of {{ record.teamCount }} · Played {{ s.played }} · Won {{ s.won }} ·
                        Lost {{ s.lost }} · {{ s.matchPoints }} pts
                      } @else {
                        No record available
                      }
                    </span>
                  </div>
                  <st-status-badge [status]="record.appearance.tournamentStatus" />
                </div>
                <ul class="list">
                  @for (player of record.appearance.players; track player.playerId) {
                    <li>
                      <st-avatar [name]="player.name" [size]="32" />
                      <a class="grow truncate" [routerLink]="['/players', player.playerId]">{{ player.name }}</a>
                      <span class="small muted">Position {{ player.position }}</span>
                    </li>
                  } @empty {
                    <li class="muted small">No players registered.</li>
                  }
                </ul>
              </section>
            }
          </div>
        } @else {
          @if (matchLists.loading() && !matchLists.data()) {
            <div class="card"><st-skeleton [rows]="3" height="48px" /></div>
          } @else if (matchLists.error(); as error) {
            <st-error-state [error]="error" (retry)="reload(t.appearances)" />
          } @else if (matches().length === 0) {
            <div class="card">
              <st-empty-state icon="versus" title="No matches yet" message="Matches played by this team will appear here." />
            </div>
          } @else {
            <div class="grid">
              @for (match of matches(); track match.tournamentId + '-' + match.id) {
                <st-match-card [match]="match" />
              }
            </div>
          }
        }
      } @else {
        <div class="card">
          <st-empty-state icon="users" title="Team not found" message="There is no team with this id.">
            <a class="btn btn--secondary" routerLink="/teams">All teams</a>
          </st-empty-state>
        </div>
      }
    </div>
  `,
  styles: `
    .head {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .tname {
      font-weight: 700;
      color: var(--c-text);
    }
    .list a {
      color: var(--c-text);
      font-weight: 550;
    }
  `,
})
export class TeamDetailPage {
  readonly teamId = input.required({ transform: numberAttribute });

  protected readonly directory = inject(TournamentDirectory);
  protected readonly auth = inject(AuthService);
  private readonly insights = inject(InsightsService);
  private readonly teamsApi = inject(TeamsApi);

  protected readonly section = signal<Section>('overview');
  protected readonly editing = signal(false);
  protected readonly standings = new AsyncState<(TournamentStandings | null)[]>();
  protected readonly matchLists = new AsyncState<TournamentMatches[]>();
  protected readonly poolTeam = new AsyncState<Team>();

  /** The pool team (name, code, active) merged with its tournament appearances; absent only if neither knows the id. */
  protected readonly team = computed<TeamEntry | undefined>(() => {
    const derived = deriveTeams(this.directory.tournaments()).find((t) => t.teamId === this.teamId());
    const pool = this.poolTeam.data();
    if (!derived && !pool) return undefined;
    return {
      teamId: this.teamId(),
      name: pool?.name ?? derived?.name ?? '',
      code: pool ? pool.code : (derived?.code ?? null),
      appearances: derived?.appearances ?? [],
      playerCount: derived?.playerCount ?? 0,
    };
  });

  protected readonly records = computed(() => {
    const team = this.team();
    const loaded = this.standings.data();
    return (team?.appearances ?? []).map((appearance, index) => {
      const table = loaded?.[index] ?? null;
      const standing: StandingItem | null =
        table?.standings.find((row) => row.tournamentTeamId === appearance.tournamentTeamId) ?? null;
      return { appearance, standing, teamCount: table?.standings.length ?? 0 };
    });
  });

  protected readonly totals = computed(() =>
    this.records().reduce(
      (sum, r) => ({ won: sum.won + (r.standing?.won ?? 0), lost: sum.lost + (r.standing?.lost ?? 0) }),
      { won: 0, lost: 0 },
    ),
  );

  protected readonly matches = computed(() => {
    const team = this.team();
    if (!team) return [];
    const refs = team.appearances.map((a) => ({ tournamentId: a.tournamentId, tournamentTeamId: a.tournamentTeamId }));
    return sortForDisplay(teamMatches(this.matchLists.data() ?? [], refs));
  });

  constructor() {
    void this.directory.load();

    effect(() => {
      const id = this.teamId();
      untracked(() => this.poolTeam.load(this.teamsApi.get(id), { keepData: false }));
    });

    effect(() => {
      const team = this.team();
      if (team) {
        untracked(() => this.reload(team.appearances));
      }
    });
  }

  protected onSaved(team: Team): void {
    this.poolTeam.data.set(team);
    this.editing.set(false);
    void this.directory.load(true);
  }

  protected reload(appearances: readonly { tournamentId: number; tournamentName: string }[]): void {
    this.standings.load(this.insights.standings(appearances.map((a) => a.tournamentId)));
    this.matchLists.load(
      this.insights.matchLists(appearances.map((a) => ({ id: a.tournamentId, name: a.tournamentName }))),
    );
  }
}
