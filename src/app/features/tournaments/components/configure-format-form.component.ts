import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SportFormat, Tournament } from '../../../core/models/api.models';
import { TOURNAMENT_FORMATS, TournamentFormat } from '../../../core/models/enums';
import { TournamentsApi } from '../../../core/services/api/tournaments.api';
import { ToastService } from '../../../core/services/toast.service';
import { TournamentDirectory } from '../../../core/services/tournament-directory.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';

const FORMAT_OPTIONS: Record<TournamentFormat, { label: string; hint: string }> = {
  RoundRobin: { label: 'Round robin', hint: 'One stage where teams play each other. Matches are created by hand.' },
  GroupsWithKnockout: {
    label: 'Groups, then knockout',
    hint: 'A group stage followed by a knockout stage. Needs a group count and qualifiers per group.',
  },
  Knockout: { label: 'Knockout', hint: 'One knockout stage.' },
  Custom: { label: 'Custom', hint: 'A single free-form stage for any set of matches.' },
};

@Component({
  selector: 'st-configure-format-form',
  imports: [ReactiveFormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="card stack" [formGroup]="form" (ngSubmit)="submit()" novalidate aria-label="Choose tournament format">
      <div>
        <h2>Choose a format</h2>
        <p class="muted small">This creates the tournament's stages and can only be done once, while it is a draft.</p>
      </div>

      <div class="form-grid form-grid--2">
        <div class="field">
          <label class="field__label" for="format">Format</label>
          <select id="format" class="select" formControlName="format">
            @for (option of formats; track option) {
              <option [ngValue]="option">{{ options[option].label }}</option>
            }
          </select>
          <span class="field__hint">{{ options[form.controls.format.value].hint }}</span>
        </div>

        <div class="field">
          <label class="field__label" for="sport-format">Match type</label>
          <select id="sport-format" class="select" formControlName="sportFormatId">
            <option [ngValue]="null" disabled>Choose singles or doubles</option>
            @for (format of sportFormats(); track format.id) {
              <option [ngValue]="format.id">{{ format.name }}</option>
            }
          </select>
          @if (form.controls.sportFormatId.touched && form.controls.sportFormatId.invalid) {
            <span class="field__error" role="alert">Choose a match type.</span>
          }
        </div>
      </div>

      @if (isGroups()) {
        <div class="form-grid form-grid--2">
          <div class="field">
            <label class="field__label" for="groups">Number of groups</label>
            <input id="groups" class="input" type="number" inputmode="numeric" min="2" formControlName="groupCount" />
            @if (form.controls.groupCount.touched && form.controls.groupCount.invalid) {
              <span class="field__error" role="alert">At least two groups are required.</span>
            }
          </div>
          <div class="field">
            <label class="field__label" for="qualifiers">Qualifiers per group</label>
            <input id="qualifiers" class="input" type="number" inputmode="numeric" min="1" formControlName="qualifiers" />
            @if (form.controls.qualifiers.touched && form.controls.qualifiers.invalid) {
              <span class="field__error" role="alert">At least one qualifier per group is required.</span>
            }
          </div>
        </div>
      }

      @if (form.controls.format.value === 'Knockout' || isGroups()) {
        <div class="notice notice--warning">
          <st-icon name="alert" />
          <span>
            The backend only creates the stage records for knockouts. Brackets and winner advancement are not generated
            yet, so knockout matches are created by hand.
          </span>
        </div>
      }

      <div class="form-actions">
        <button type="submit" class="btn" [disabled]="saving()">
          <st-icon name="check" />{{ saving() ? 'Saving…' : 'Create stages' }}
        </button>
      </div>
    </form>
  `,
})
export class ConfigureFormatFormComponent {
  private readonly api = inject(TournamentsApi);
  private readonly directory = inject(TournamentDirectory);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly tournament = input.required<Tournament>();
  readonly sportFormats = input.required<readonly SportFormat[]>();
  readonly configured = output<void>();

  protected readonly formats = TOURNAMENT_FORMATS;
  protected readonly options = FORMAT_OPTIONS;
  protected readonly saving = signal(false);
  protected readonly isGroups = signal(false);

  protected readonly form = new FormGroup({
    format: new FormControl<TournamentFormat>('RoundRobin', { nonNullable: true }),
    sportFormatId: new FormControl<number | null>(null, [Validators.required]),
    groupCount: new FormControl<number | null>(null),
    qualifiers: new FormControl<number | null>(null),
  });

  constructor() {
    this.form.controls.format.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((format) => {
      const groups = format === 'GroupsWithKnockout';
      this.isGroups.set(groups);
      const { groupCount, qualifiers } = this.form.controls;
      groupCount.setValidators(groups ? [Validators.required, Validators.min(2)] : []);
      qualifiers.setValidators(groups ? [Validators.required, Validators.min(1)] : []);
      if (!groups) {
        groupCount.reset(null);
        qualifiers.reset(null);
      }
      groupCount.updateValueAndValidity();
      qualifiers.updateValueAndValidity();
    });
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) {
      return;
    }
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .configure(this.tournament().id, {
        format: value.format,
        sportFormatId: value.sportFormatId!,
        groupCount: value.format === 'GroupsWithKnockout' ? Number(value.groupCount) : null,
        qualifiersPerGroup: value.format === 'GroupsWithKnockout' ? Number(value.qualifiers) : null,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.saving.set(false);
          this.toast.success(`${result.stages.length === 1 ? '1 stage' : result.stages.length + ' stages'} created.`);
          void this.directory.load(true);
          this.configured.emit();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.toast.fromError(error, 'Could not configure the tournament.');
        },
      });
  }
}
