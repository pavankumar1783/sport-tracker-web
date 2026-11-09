import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, of, startWith, switchMap, tap } from 'rxjs';
import { ApiError } from '../../../core/models/api-error';
import { Player, RegisterTeamRequest, Team, Tournament } from '../../../core/models/api.models';
import { PlayersApi } from '../../../core/services/api/players.api';
import { TeamsApi } from '../../../core/services/api/teams.api';
import { TournamentsApi } from '../../../core/services/api/tournaments.api';
import { ToastService } from '../../../core/services/toast.service';
import { TournamentDirectory } from '../../../core/services/tournament-directory.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { availablePlayers, playerPool, teamPool } from '../tournament-logic';
import { trimmedRequired } from '../tournament-form.validators';

interface SelectedPlayer {
  playerId: number;
  name: string;
}

/** How many matches to show under the search box; typing narrows the rest. */
const MAX_RESULTS = 8;

@Component({
  selector: 'st-register-team-form',
  imports: [ReactiveFormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="card stack" (submit)="$event.preventDefault(); submit()" novalidate aria-label="Register a team">
      <div class="row row--between">
        <h2>Register a team</h2>
        <button type="button" class="btn btn--ghost btn--sm btn--icon" aria-label="Close form" (click)="closed.emit()">
          <st-icon name="x" />
        </button>
      </div>

      <div class="segmented" role="group" aria-label="Team source">
        <button type="button" [attr.aria-pressed]="mode() === 'new'" (click)="mode.set('new')">New team</button>
        <button
          type="button"
          [attr.aria-pressed]="mode() === 'existing'"
          [disabled]="teams().length === 0"
          (click)="mode.set('existing')"
        >
          Existing team
        </button>
      </div>

      @if (mode() === 'new') {
        <div class="form-grid form-grid--2">
          <div class="field">
            <label class="field__label" for="team-name">Team name</label>
            <input id="team-name" class="input" type="text" maxlength="150" autocomplete="off" [formControl]="teamName" />
            @if (teamName.touched && teamName.invalid) {
              <span class="field__error" role="alert">Enter a team name.</span>
            }
          </div>
          <div class="field">
            <label class="field__label" for="team-code">Code <span class="muted">(optional)</span></label>
            <input id="team-code" class="input" type="text" maxlength="50" autocomplete="off" [formControl]="teamCode" />
          </div>
        </div>
      } @else {
        <div class="field">
          <label class="field__label" for="existing-team">Team</label>
          <select id="existing-team" class="select" [formControl]="existingTeamId">
            <option [ngValue]="null" disabled>Choose a team</option>
            @for (team of teams(); track team.teamId) {
              <option [ngValue]="team.teamId">{{ team.name }}{{ team.code ? ' (' + team.code + ')' : '' }}</option>
            }
          </select>
        </div>
      }

      <fieldset class="stack roster">
        <legend class="field__label">
          Roster
          <span class="muted">
            ({{ selected().length }}{{ tournament().rosterSize ? ' of ' + tournament().rosterSize : '' }})
          </span>
        </legend>

        @if (selected().length === 0) {
          <p class="muted small">No players added yet. Order matters: the first player is position 1.</p>
        } @else {
          <ol class="chosen">
            @for (player of selected(); track player.playerId; let i = $index) {
              <li>
                <span class="pos">{{ i + 1 }}</span>
                <span class="grow truncate">{{ player.name }}</span>
                <button
                  type="button"
                  class="btn btn--ghost btn--sm btn--icon"
                  [attr.aria-label]="'Remove ' + player.name"
                  (click)="remove(player.playerId)"
                >
                  <st-icon name="x" />
                </button>
              </li>
            }
          </ol>
        }

        <div class="field">
          <label class="field__label" for="player-search">Add a player</label>
          <input
            id="player-search"
            class="input"
            type="search"
            autocomplete="off"
            placeholder="Search players by name"
            [formControl]="query"
          />
          <ul class="results" aria-label="Matching players" [attr.aria-busy]="searching()">
            @for (player of visible(); track player.playerId) {
              <li>
                <button type="button" class="pick" (click)="add(player)">
                  <span class="grow truncate">{{ player.name }}</span>
                  <st-icon name="plus" />
                </button>
              </li>
            } @empty {
              <li class="muted small empty">
                {{ searching() ? 'Searching…' : 'No available players match.' }}
              </li>
            }
          </ul>
          @if (poolError(); as message) {
            <span class="field__error" role="alert">{{ message }}</span>
          } @else {
            <span class="field__hint">
              Players are people who have signed up. If someone is missing, ask them to create an account first.
            </span>
          }
        </div>
      </fieldset>

      <div class="form-actions">
        <button type="button" class="btn btn--secondary" (click)="closed.emit()">Cancel</button>
        <button type="submit" class="btn" [disabled]="saving() || !rosterOk()">
          <st-icon name="check" />{{ saving() ? 'Registering…' : 'Register team' }}
        </button>
      </div>
    </form>
  `,
  styles: `
    .roster {
      border: 0;
      padding: 0;
      margin: 0;
      min-width: 0;
    }
    .chosen,
    .results {
      list-style: none;
      margin: 0;
      padding: 0;
      border: 1px solid var(--c-border);
      border-radius: var(--radius-sm);
    }
    .results {
      max-height: 240px;
      overflow-y: auto;
    }
    .chosen li {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 6px 6px 12px;
      border-bottom: 1px solid var(--c-border);
    }
    .chosen li:last-child,
    .results li:last-child {
      border-bottom: 0;
    }
    .results li {
      border-bottom: 1px solid var(--c-border);
    }
    .empty {
      padding: 12px;
    }
    .pick {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      min-height: 44px;
      padding: 0 12px;
      border: 0;
      background: transparent;
      text-align: left;
      color: var(--c-text);
      font-weight: 550;
    }
    .pick:hover {
      background: var(--c-surface-2);
    }
    .pos {
      display: grid;
      place-items: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--c-primary-soft);
      color: var(--c-primary);
      font-size: 0.75rem;
      font-weight: 700;
    }
  `,
})
export class RegisterTeamFormComponent {
  private readonly api = inject(TournamentsApi);
  private readonly teamsApi = inject(TeamsApi);
  private readonly playersApi = inject(PlayersApi);
  private readonly directory = inject(TournamentDirectory);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly tournament = input.required<Tournament>();
  readonly registered = output<void>();
  readonly closed = output<void>();

  protected readonly mode = signal<'new' | 'existing'>('new');
  protected readonly selected = signal<SelectedPlayer[]>([]);
  protected readonly saving = signal(false);

  protected readonly teamName = new FormControl('', { nonNullable: true, validators: [trimmedRequired] });
  protected readonly teamCode = new FormControl('', { nonNullable: true });
  protected readonly existingTeamId = new FormControl<number | null>(null);
  protected readonly query = new FormControl('', { nonNullable: true });

  protected readonly searching = signal(true);
  protected readonly poolError = signal<string | null>(null);
  private readonly results = signal<Player[]>([]);
  private readonly allTeams = signal<Team[]>([]);

  protected readonly teams = computed(() => teamPool(this.allTeams(), this.tournament()));
  protected readonly pool = computed(() => {
    const chosen = new Set(this.selected().map((p) => p.playerId));
    return availablePlayers(playerPool(this.results()), this.tournament()).filter((p) => !chosen.has(p.playerId));
  });
  protected readonly visible = computed(() => this.pool().slice(0, MAX_RESULTS));

  protected readonly rosterOk = computed(() => {
    const size = this.tournament().rosterSize;
    const count = this.selected().length;
    return size ? count === size : count > 0;
  });

  constructor() {
    this.teamsApi
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (teams) => {
          this.allTeams.set(teams);
          if (teamPool(teams, this.tournament()).length > 0) {
            this.mode.set('existing');
          }
        },
        error: () => undefined, // The team pool is optional: a new team can still be created.
      });

    // Search as the organizer types. Any signed-in user may call this endpoint; it returns names only.
    this.query.valueChanges
      .pipe(
        startWith(this.query.value),
        debounceTime(250),
        distinctUntilChanged(),
        tap(() => this.searching.set(true)),
        switchMap((term) =>
          this.playersApi.search(term).pipe(
            catchError((error: unknown) => {
              this.poolError.set(ApiError.from(error).userMessage);
              return of<Player[]>([]);
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((players) => {
        this.poolError.update((current) => (players.length > 0 ? null : current));
        this.results.set(players);
        this.searching.set(false);
      });
  }

  protected add(player: { playerId: number; name: string }): void {
    this.selected.update((list) => [...list, { playerId: player.playerId, name: player.name }]);
  }

  protected remove(playerId: number): void {
    this.selected.update((list) => list.filter((p) => p.playerId !== playerId));
  }

  protected submit(): void {
    const existing = this.mode() === 'existing';
    if (existing ? this.existingTeamId.value === null : this.teamName.invalid) {
      this.teamName.markAsTouched();
      this.toast.error(existing ? 'Choose a team first.' : 'Enter a team name first.');
      return;
    }
    if (!this.rosterOk() || this.saving()) {
      return;
    }

    const request: RegisterTeamRequest = {
      teamId: existing ? this.existingTeamId.value : null,
      teamName: existing ? null : this.teamName.value.trim(),
      teamCode: existing ? null : this.teamCode.value.trim() || null,
      players: this.selected().map((player, index) => ({ playerId: player.playerId, position: index + 1 })),
    };

    this.saving.set(true);
    this.api
      .registerTeam(this.tournament().id, request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.saving.set(false);
          this.toast.success(`${result.teamName} registered with ${result.players.length} players.`);
          void this.directory.load(true);
          this.registered.emit();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.toast.fromError(error, 'Could not register the team.');
        },
      });
  }
}
