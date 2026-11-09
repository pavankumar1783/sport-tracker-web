import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TournamentTeam } from '../../../core/models/api.models';
import { TournamentsApi } from '../../../core/services/api/tournaments.api';
import { ToastService } from '../../../core/services/toast.service';
import { TournamentDirectory } from '../../../core/services/tournament-directory.service';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { RegisterTeamFormComponent } from '../components/register-team-form.component';
import { TournamentContext } from '../tournament-context.service';
import { canRegisterTeams } from '../tournament-logic';
import { trimmedRequired } from '../tournament-form.validators';

@Component({
  selector: 'st-tournament-teams-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AvatarComponent,
    EmptyStateComponent,
    IconComponent,
    SkeletonComponent,
    StatusBadgeComponent,
    RegisterTeamFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (context.state.data(); as tournament) {
      <div class="stack stack--lg">
        @if (context.canManage()) {
          @if (canRegister(tournament.status)) {
            @if (showForm()) {
              <st-register-team-form
                [tournament]="tournament"
                (registered)="onRegistered()"
                (closed)="showForm.set(false)"
              />
            } @else {
              <div class="row row--between">
                <p class="muted small grow">
                  Registration is open{{ tournament.rosterSize ? ': each team needs exactly ' + tournament.rosterSize + ' players' : '' }}.
                </p>
                <button type="button" class="btn" (click)="showForm.set(true)"><st-icon name="plus" />Register team</button>
              </div>
            }
          } @else {
            <div class="notice">
              <st-icon name="info" />
              <span>
                Teams can only be registered while the tournament is open for registration (currently
                {{ tournament.status }}). Open registration from the Overview tab once a format is chosen.
              </span>
            </div>
          }
        }

        @if (tournament.teams.length === 0) {
          <div class="card">
            <st-empty-state
              icon="users"
              title="No teams registered"
              message="Teams and their players will appear here once the organizer registers them."
            />
          </div>
        } @else {
          <div class="grid">
            @for (team of tournament.teams; track team.tournamentTeamId) {
              <article class="card stack" [attr.aria-label]="team.teamName">
                @if (editingId() === team.tournamentTeamId) {
                  <form class="stack" (submit)="$event.preventDefault(); saveRename(team)" novalidate [attr.aria-label]="'Rename ' + team.teamName">
                    <div class="field">
                      <label class="field__label" [for]="'rename-' + team.tournamentTeamId">Team name</label>
                      <input [id]="'rename-' + team.tournamentTeamId" class="input" type="text" maxlength="150" [formControl]="newName" />
                      @if (newName.touched && newName.invalid) {
                        <span class="field__error" role="alert">Enter a team name.</span>
                      }
                    </div>
                    <div class="field">
                      <label class="field__label" [for]="'code-' + team.tournamentTeamId">Code <span class="muted">(optional)</span></label>
                      <input [id]="'code-' + team.tournamentTeamId" class="input" type="text" maxlength="50" [formControl]="newCode" />
                    </div>
                    @if (renameError(); as message) {
                      <span class="field__error" role="alert">{{ message }}</span>
                    }
                    <div class="form-actions">
                      <button type="button" class="btn btn--secondary btn--sm" (click)="editingId.set(null)">Cancel</button>
                      <button type="submit" class="btn btn--sm" [disabled]="saving()">
                        <st-icon name="check" />{{ saving() ? 'Saving…' : 'Save' }}
                      </button>
                    </div>
                  </form>
                } @else {
                  <div class="row row--between row--nowrap">
                    <div class="row row--nowrap grow">
                      <st-avatar [name]="team.teamName" [size]="40" />
                      <div class="grow">
                        <h3 class="truncate">{{ team.teamName }}</h3>
                        <p class="muted small">
                          {{ team.teamCode ?? 'No code' }}{{ team.seed ? ' · Seed ' + team.seed : '' }}
                        </p>
                      </div>
                    </div>
                    <st-status-badge [status]="team.status" />
                  </div>
                  @if (canRename(tournament.status)) {
                    <div>
                      <button type="button" class="btn btn--ghost btn--sm" (click)="startRename(team)">
                        <st-icon name="edit" />Rename team
                      </button>
                    </div>
                  }
                }
                <ul class="roster">
                  @for (player of team.players; track player.playerId) {
                    <li>
                      <span class="pos">{{ player.position }}</span>
                      <a class="grow truncate who" [routerLink]="['/players', player.playerId]">{{ player.name }}</a>
                    </li>
                  }
                </ul>
              </article>
            }
          </div>
        }
      </div>
    } @else {
      <div class="card" aria-busy="true"><st-skeleton [rows]="4" height="22px" /></div>
    }
  `,
  styles: `
    .roster {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .roster li {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .who {
      display: block;
      color: var(--c-text);
      font-weight: 550;
    }
    .pos {
      display: grid;
      place-items: center;
      flex: none;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--c-surface-2);
      border: 1px solid var(--c-border);
      font-size: 0.75rem;
      font-weight: 700;
    }
  `,
})
export class TeamsPage {
  protected readonly context = inject(TournamentContext);
  private readonly api = inject(TournamentsApi);
  private readonly directory = inject(TournamentDirectory);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly showForm = signal(false);
  protected readonly editingId = signal<number | null>(null);
  protected readonly saving = signal(false);
  protected readonly renameError = signal<string | null>(null);
  protected readonly canRegister = canRegisterTeams;

  protected readonly newName = new FormControl('', { nonNullable: true, validators: [trimmedRequired] });
  protected readonly newCode = new FormControl('', { nonNullable: true });

  /** The organizer may rename a team until the tournament is over (the API refuses afterwards). */
  protected canRename(status: string): boolean {
    return this.context.canManage() && status !== 'Completed' && status !== 'Cancelled';
  }

  protected onRegistered(): void {
    this.showForm.set(false);
    this.context.reload();
  }

  protected startRename(team: TournamentTeam): void {
    this.newName.setValue(team.teamName);
    this.newCode.setValue(team.teamCode ?? '');
    this.newName.markAsUntouched();
    this.renameError.set(null);
    this.editingId.set(team.tournamentTeamId);
  }

  protected saveRename(team: TournamentTeam): void {
    this.newName.markAsTouched();
    const tournamentId = this.context.id();
    if (this.newName.invalid || this.saving() || tournamentId === null) {
      return;
    }

    this.saving.set(true);
    this.renameError.set(null);
    this.api
      .updateTeam(tournamentId, team.tournamentTeamId, {
        name: this.newName.value.trim(),
        code: this.newCode.value.trim() || null,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.saving.set(false);
          this.editingId.set(null);
          this.toast.success(`Team renamed to ${result.name}.`);
          this.context.reload();
          void this.directory.load(true);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.renameError.set(error instanceof Error ? error.message : 'Could not rename the team.');
        },
      });
  }
}
