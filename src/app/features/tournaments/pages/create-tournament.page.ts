import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SportsApi } from '../../../core/services/api/sports.api';
import { TournamentsApi } from '../../../core/services/api/tournaments.api';
import { Sport } from '../../../core/models/api.models';
import { TournamentDirectory } from '../../../core/services/tournament-directory.service';
import { ToastService } from '../../../core/services/toast.service';
import { AsyncState } from '../../../core/state/async-state';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import {
  TOURNAMENT_NAME_MAX,
  dateRange,
  toApiDate,
  trimmedRequired,
} from '../tournament-form.validators';

@Component({
  selector: 'st-create-tournament-page',
  imports: [ReactiveFormsModule, PageHeaderComponent, ErrorStateComponent, SkeletonComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page--narrow">
      <st-page-header
        title="New tournament"
        subtitle="Start with the basics. You choose the format and register teams next."
        backLink="/tournaments"
        backLabel="Tournaments"
      />

      @if (sports.error(); as error) {
        <st-error-state [error]="error" (retry)="loadSports()" />
      } @else if (!sports.data()) {
        <div class="card"><st-skeleton [rows]="5" height="40px" /></div>
      } @else {
        <form class="card form-grid" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="field">
            <label class="field__label" for="sport">Sport</label>
            <select id="sport" class="select" formControlName="sportId">
              @for (sport of sports.data()!; track sport.id) {
                <option [ngValue]="sport.id">{{ sport.name }}</option>
              }
            </select>
          </div>

          <div class="field">
            <label class="field__label" for="name">Tournament name</label>
            <input
              id="name"
              class="input"
              type="text"
              formControlName="name"
              [attr.maxlength]="nameMax"
              autocomplete="off"
              placeholder="e.g. Summer Office League"
              [attr.aria-invalid]="form.controls.name.invalid && form.controls.name.touched"
            />
            @if (form.controls.name.touched && form.controls.name.errors) {
              <span class="field__error" role="alert">Enter a name (up to {{ nameMax }} characters).</span>
            }
          </div>

          <div class="field">
            <label class="field__label" for="roster">Players per team <span class="muted">(optional)</span></label>
            <input id="roster" class="input" type="number" inputmode="numeric" min="1" formControlName="rosterSize" />
            <span class="field__hint">When set, every registered team must have exactly this many players.</span>
            @if (form.controls.rosterSize.touched && form.controls.rosterSize.errors) {
              <span class="field__error" role="alert">Must be a whole number of at least 1.</span>
            }
          </div>

          <div class="form-grid form-grid--2">
            <div class="field">
              <label class="field__label" for="start">Start date <span class="muted">(optional)</span></label>
              <input id="start" class="input" type="date" formControlName="startDate" />
            </div>
            <div class="field">
              <label class="field__label" for="end">End date <span class="muted">(optional)</span></label>
              <input id="end" class="input" type="date" formControlName="endDate" />
            </div>
          </div>
          @if (form.errors?.['dateRange']) {
            <span class="field__error" role="alert">The end date cannot be before the start date.</span>
          }

          <div class="form-actions">
            <button type="button" class="btn btn--secondary" (click)="cancel()">Cancel</button>
            <button type="submit" class="btn" [disabled]="saving()">
              <st-icon name="check" />{{ saving() ? 'Creating…' : 'Create tournament' }}
            </button>
          </div>
        </form>
      }
    </div>
  `,
})
export class CreateTournamentPage {
  private readonly sportsApi = inject(SportsApi);
  private readonly tournamentsApi = inject(TournamentsApi);
  private readonly directory = inject(TournamentDirectory);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly sports = new AsyncState<Sport[]>();
  protected readonly saving = signal(false);
  protected readonly nameMax = TOURNAMENT_NAME_MAX;

  protected readonly form = new FormGroup(
    {
      sportId: new FormControl<number | null>(null, { validators: [Validators.required] }),
      name: new FormControl('', {
        nonNullable: true,
        validators: [trimmedRequired, Validators.maxLength(TOURNAMENT_NAME_MAX)],
      }),
      rosterSize: new FormControl<number | null>(null, [Validators.min(1), Validators.pattern(/^\d+$/)]),
      startDate: new FormControl<string | null>(null),
      endDate: new FormControl<string | null>(null),
    },
    { validators: [dateRange('startDate', 'endDate')] },
  );

  constructor() {
    this.loadSports();
    // Preselect the first sport once the catalogue arrives (it holds table tennis only today).
    effect(() => {
      const data = this.sports.data();
      if (data?.length && this.form.controls.sportId.value === null) {
        this.form.controls.sportId.setValue(data[0].id);
      }
    });
  }

  protected loadSports(): void {
    this.sports.load(this.sportsApi.getSports());
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) {
      return;
    }

    const value = this.form.getRawValue();
    this.saving.set(true);
    this.tournamentsApi
      .create({
        sportId: value.sportId!,
        name: value.name.trim(),
        rosterSize: value.rosterSize ? Number(value.rosterSize) : null,
        startDate: toApiDate(value.startDate),
        endDate: toApiDate(value.endDate),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => {
          this.toast.success(`“${created.name}” created. Choose a format next.`);
          void this.directory.load(true);
          void this.router.navigate(['/tournaments', created.id, 'stages']);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.toast.fromError(error, 'Could not create the tournament.');
        },
      });
  }

  protected cancel(): void {
    void this.router.navigateByUrl('/tournaments');
  }
}
