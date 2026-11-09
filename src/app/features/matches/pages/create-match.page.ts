import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, map, startWith } from 'rxjs';
import { ApiError } from '../../../core/models/api-error';
import { Sport, Tournament, TournamentStage } from '../../../core/models/api.models';
import { MATCH_TYPES, MatchType, humanizeEnum } from '../../../core/models/enums';
import { MatchesApi } from '../../../core/services/api/matches.api';
import { SportsApi } from '../../../core/services/api/sports.api';
import { AuthService } from '../../../core/services/auth.service';
import { TournamentsApi } from '../../../core/services/api/tournaments.api';
import { TournamentDirectory } from '../../../core/services/tournament-directory.service';
import { ToastService } from '../../../core/services/toast.service';
import { AsyncState } from '../../../core/state/async-state';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { MatchDraft, buildCreateMatchRequest, draftProblems, inferredFormat } from '../create-match.logic';
import { SidePickerComponent } from '../ui/side-picker.component';

interface TournamentContext {
  tournament: Tournament;
  stages: TournamentStage[];
}

function toOptionalNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return value === null || value === undefined || value === '' || Number.isNaN(parsed) ? undefined : parsed;
}

@Component({
  selector: 'st-create-match-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    SidePickerComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    SkeletonComponent,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page--narrow">
      <st-page-header title="New match" subtitle="Pair two registered teams and choose who plays." backLink="/matches" backLabel="Matches" />

      @if (directory.loading() && !directory.loaded()) {
        <div class="card"><st-skeleton [rows]="4" /></div>
      } @else if (directory.error(); as error) {
        <st-error-state [error]="error" (retry)="directory.load(true)" />
      } @else if (activeTournaments().length === 0) {
        <div class="card">
          <st-empty-state icon="trophy" title="No active tournament of yours" message="Matches are created by a tournament's organizer while it is active. Start one of your tournaments, or create a new one.">
            <a class="btn" routerLink="/tournaments">Go to tournaments</a>
          </st-empty-state>
        </div>
      } @else {
        <form class="stack stack--lg" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          @if (requestedButInactive()) {
            <div class="notice notice--warning" role="status">
              <st-icon name="alert" />
              <div>That tournament is not active, or you do not organize it, so you cannot create matches in it. Pick one below.</div>
            </div>
          }

          <div class="card stack">
            <div class="field">
              <label class="field__label" for="m-tournament">Tournament</label>
              <select id="m-tournament" class="select" formControlName="tournament">
                <option [ngValue]="null">Choose a tournament</option>
                @for (t of activeTournaments(); track t.id) {
                  <option [ngValue]="t.id">{{ t.name }}</option>
                }
              </select>
            </div>

            @if (context.loading() && !context.data()) {
              <st-skeleton [rows]="3" />
            } @else if (context.error(); as error) {
              <st-error-state [error]="error" (retry)="selectTournament(tournamentValue())" />
            } @else if (context.data(); as ctx) {
              <div class="form-grid form-grid--2">
                <div class="field">
                  <label class="field__label" for="m-stage">Stage</label>
                  <select id="m-stage" class="select" formControlName="stage">
                    <option [ngValue]="null">Choose a stage</option>
                    @for (stage of ctx.stages; track stage.id) {
                      <option [ngValue]="stage.id" [disabled]="stage.status === 'Completed'">
                        {{ stage.name }}{{ stage.status === 'Completed' ? ' (completed)' : '' }}
                      </option>
                    }
                  </select>
                  @if (ctx.stages.length === 0) {
                    <span class="field__hint">This tournament has no stages yet. Configure it from the tournament page first.</span>
                  }
                </div>
                <div class="field">
                  <label class="field__label" for="m-type">Match type</label>
                  <select id="m-type" class="select" formControlName="matchType">
                    @for (type of matchTypes; track type) {
                      <option [ngValue]="type">{{ label(type) }}</option>
                    }
                  </select>
                </div>
                <div class="field">
                  <label class="field__label" for="m-name">Name <span class="muted">(optional)</span></label>
                  <input id="m-name" class="input" formControlName="name" maxlength="100" placeholder="e.g. Opening singles" />
                </div>
              </div>
            }
          </div>

          @if (context.data(); as ctx) {
            <div class="grid grid--2">
              <st-side-picker
                id="side1"
                title="Side 1"
                [teams]="ctx.tournament.teams"
                [teamControl]="form.controls.team1"
                [teamId]="values().team1Id"
                [otherTeamId]="values().team2Id"
                [(selected)]="players1"
              />
              <st-side-picker
                id="side2"
                title="Side 2"
                [teams]="ctx.tournament.teams"
                [teamControl]="form.controls.team2"
                [teamId]="values().team2Id"
                [otherTeamId]="values().team1Id"
                [(selected)]="players2"
              />
            </div>

            @if (formatLabel(); as format) {
              <p class="muted small"><st-icon name="info" /> {{ format }} — the format and scoring rule come from the tournament's match settings.</p>
            }

            <details class="card advanced">
              <summary>Advanced: override format or scoring rule</summary>
              <div class="form-grid form-grid--2 adv-body">
                <div class="field">
                  <label class="field__label" for="m-format">Format</label>
                  <select id="m-format" class="select" formControlName="sportFormatId">
                    <option [ngValue]="null">Automatic (from players per side)</option>
                    @for (f of formats(); track f.id) {
                      <option [ngValue]="f.id">{{ f.name }} ({{ f.participantsPerSide }} per side)</option>
                    }
                  </select>
                </div>
                <div class="field">
                  <label class="field__label" for="m-rule">Scoring rule</label>
                  <select id="m-rule" class="select" formControlName="scoringRuleId">
                    <option [ngValue]="null">Tournament setting / format default</option>
                    @for (r of rules(); track r.id) {
                      <option [ngValue]="r.id">{{ r.name }}</option>
                    }
                  </select>
                </div>
              </div>
            </details>

            <div class="field kickoff">
              <label class="field__label" for="m-kickoff">Kick-off <span class="muted">(optional)</span></label>
              <input id="m-kickoff" class="input" type="datetime-local" formControlName="scheduledAt" />
              <span class="field__hint">Your local time. Leave empty if the match has no set time.</span>
            </div>

            @if (showProblems() && problems().length > 0) {
              <div class="notice notice--warning" role="alert">
                <st-icon name="alert" />
                <ul class="problems">
                  @for (problem of problems(); track problem) {
                    <li>{{ problem }}</li>
                  }
                </ul>
              </div>
            }
            @if (submitError(); as message) {
              <div class="notice notice--danger" role="alert"><st-icon name="alert" /><div>{{ message }}</div></div>
            }

            <div class="form-actions">
              <a class="btn btn--secondary" routerLink="/matches">Cancel</a>
              <button type="submit" class="btn" [disabled]="saving()">
                <st-icon name="plus" />{{ saving() ? 'Creating…' : 'Create match' }}
              </button>
            </div>
          }
        </form>
      }
    </div>
  `,
  styles: `
    .advanced summary {
      cursor: pointer;
      font-weight: 600;
    }
    .adv-body {
      margin-top: 14px;
    }
    .problems {
      margin: 0;
      padding-left: 18px;
    }
    p st-icon {
      vertical-align: -4px;
      --icon-size: 16px;
    }
  `,
})
export class CreateMatchPage {
  protected readonly directory = inject(TournamentDirectory);
  private readonly auth = inject(AuthService);
  private readonly tournamentsApi = inject(TournamentsApi);
  private readonly matchesApi = inject(MatchesApi);
  private readonly sportsApi = inject(SportsApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Bound from `?tournamentId=`. */
  readonly tournamentId = input<number | undefined, unknown>(undefined, { transform: toOptionalNumber });

  protected readonly matchTypes = MATCH_TYPES;
  protected readonly context = new AsyncState<TournamentContext>();
  protected readonly sports = new AsyncState<Sport[]>();

  protected readonly form = new FormGroup({
    tournament: new FormControl<number | null>(null),
    stage: new FormControl<number | null>(null, Validators.required),
    matchType: new FormControl<MatchType>('Regular', { nonNullable: true }),
    name: new FormControl('', { nonNullable: true }),
    team1: new FormControl<number | null>(null, Validators.required),
    team2: new FormControl<number | null>(null, Validators.required),
    sportFormatId: new FormControl<number | null>(null),
    scoringRuleId: new FormControl<number | null>(null),
    scheduledAt: new FormControl('', { nonNullable: true }),
  });

  protected readonly players1 = signal<readonly number[]>([]);
  protected readonly players2 = signal<readonly number[]>([]);
  protected readonly saving = signal(false);
  protected readonly showProblems = signal(false);
  protected readonly submitError = signal<string | null>(null);

  protected readonly values = toSignal(
    this.form.valueChanges.pipe(
      startWith(null),
      map(() => {
        const v = this.form.getRawValue();
        return { ...v, team1Id: v.team1, team2Id: v.team2 };
      }),
    ),
    { requireSync: true },
  );

  /** Active tournaments the signed-in user may manage (their own, or any for a site admin). */
  protected readonly activeTournaments = computed(() =>
    this.directory.tournaments().filter((t) => t.status === 'Active' && this.auth.canManage(t.organizerUserId)),
  );
  protected readonly requestedButInactive = computed(() => {
    const id = this.tournamentId();
    return id !== undefined && this.directory.loaded() && !this.activeTournaments().some((t) => t.id === id);
  });

  private readonly sport = computed(() => {
    const sportId = this.context.data()?.tournament.sportId;
    return this.sports.data()?.find((s) => s.id === sportId);
  });
  protected readonly formats = computed(() => this.sport()?.formats ?? []);
  protected readonly rules = computed(() => this.sport()?.scoringRules ?? []);

  protected readonly draft = computed<MatchDraft>(() => {
    const v = this.values();
    return {
      stageId: v.stage,
      matchType: v.matchType,
      name: v.name,
      team1Id: v.team1,
      team2Id: v.team2,
      players1: this.players1(),
      players2: this.players2(),
      sportFormatId: v.sportFormatId,
      scoringRuleId: v.scoringRuleId,
      scheduledAt: v.scheduledAt,
    };
  });
  protected readonly problems = computed(() => draftProblems(this.draft()));
  protected readonly formatLabel = computed(() => {
    const count = this.players1().length;
    return this.values().sportFormatId === null && count === this.players2().length ? inferredFormat(count) : null;
  });

  constructor() {
    this.form.controls.tournament.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((id) => this.selectTournament(id));
    this.form.controls.team1.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.players1.set([]));
    this.form.controls.team2.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.players2.set([]));

    void this.directory.load().then(() => {
      const requested = this.tournamentId();
      if (requested !== undefined && this.activeTournaments().some((t) => t.id === requested)) {
        this.form.controls.tournament.setValue(requested);
      }
    });

    effect(() => {
      const ctx = this.context.data();
      untracked(() => {
        const open = ctx?.stages.filter((s) => s.status !== 'Completed') ?? [];
        this.form.controls.stage.setValue(open.length === 1 ? open[0].id : null);
      });
    });
  }

  protected tournamentValue(): number | null {
    return this.form.controls.tournament.value;
  }

  protected selectTournament(id: number | null): void {
    this.form.patchValue({ team1: null, team2: null, sportFormatId: null, scoringRuleId: null }, { emitEvent: false });
    this.players1.set([]);
    this.players2.set([]);
    this.submitError.set(null);
    this.showProblems.set(false);
    this.form.updateValueAndValidity();

    if (id === null) {
      this.context.data.set(null);
      return;
    }
    this.context.load(
      forkJoin({
        tournament: this.tournamentsApi.get(id),
        stages: this.tournamentsApi.getStages(id).pipe(map((s) => s.stages)),
      }),
      { keepData: false },
    );
    if (!this.sports.data()) {
      this.sports.load(this.sportsApi.getSports());
    }
  }

  protected label(type: string): string {
    return humanizeEnum(type);
  }

  protected submit(): void {
    const tournamentId = this.tournamentValue();
    this.showProblems.set(true);
    this.submitError.set(null);
    if (tournamentId === null || this.problems().length > 0 || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.matchesApi
      .create(tournamentId, buildCreateMatchRequest(this.draft()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (match) => {
          this.toast.success(`Match #${match.matchNumber} created.`);
          void this.router.navigate(['/matches', tournamentId, match.id]);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.submitError.set(ApiError.from(error).userMessage);
          this.toast.fromError(error, 'The match could not be created.');
        },
      });
  }
}
