import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Team } from '../../../core/models/api.models';
import { TeamsApi } from '../../../core/services/api/teams.api';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';

export const TEAM_NAME_MAX = 150;
export const TEAM_CODE_MAX = 50;

/** Create (no `team` input) or edit a team from the reusable pool. The backend enforces unique names. */
@Component({
  selector: 'st-team-form',
  imports: [ReactiveFormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="card stack" [formGroup]="form" (ngSubmit)="submit()" novalidate [attr.aria-label]="team() ? 'Edit team' : 'New team'">
      <h2>{{ team() ? 'Edit team' : 'New team' }}</h2>
      <div class="form-grid form-grid--2">
        <div class="field">
          <label class="field__label" for="tf-name">Name</label>
          <input id="tf-name" class="input" type="text" formControlName="name" [attr.maxlength]="nameMax" autocomplete="off" />
          @if (form.controls.name.touched && form.controls.name.invalid) {
            <span class="field__error" role="alert">Enter a team name (up to {{ nameMax }} characters).</span>
          }
        </div>
        <div class="field">
          <label class="field__label" for="tf-code">Code <span class="muted">(optional)</span></label>
          <input id="tf-code" class="input" type="text" formControlName="code" [attr.maxlength]="codeMax" autocomplete="off" />
        </div>
      </div>
      @if (team()) {
        <label class="check">
          <input type="checkbox" formControlName="isActive" />
          <span>Active <span class="muted small">(inactive teams are hidden from guests and cannot be registered)</span></span>
        </label>
      }
      @if (error(); as message) {
        <div class="notice notice--danger" role="alert"><st-icon name="alert" /><span>{{ message }}</span></div>
      }
      <div class="form-actions">
        <button type="button" class="btn btn--secondary" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="btn" [disabled]="saving()">
          <st-icon name="check" />{{ saving() ? 'Saving…' : 'Save team' }}
        </button>
      </div>
    </form>
  `,
  styles: `
    .check {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-weight: 600;
    }
    .check input {
      margin-top: 4px;
      width: 18px;
      height: 18px;
    }
  `,
})
export class TeamFormComponent {
  private readonly api = inject(TeamsApi);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly team = input<Team>();
  readonly saved = output<Team>();
  readonly cancelled = output<void>();

  protected readonly nameMax = TEAM_NAME_MAX;
  protected readonly codeMax = TEAM_CODE_MAX;
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(TEAM_NAME_MAX), (c) => (String(c.value).trim() ? null : { required: true })],
    }),
    code: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(TEAM_CODE_MAX)] }),
    isActive: new FormControl(true, { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      const team = this.team();
      if (team) {
        untracked(() => this.form.setValue({ name: team.name, code: team.code ?? '', isActive: team.isActive }));
      }
    });
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) {
      return;
    }
    const { name, code, isActive } = this.form.getRawValue();
    const body = { name: name.trim(), code: code.trim() || null };
    const existing = this.team();

    this.saving.set(true);
    this.error.set(null);
    const request = existing ? this.api.update(existing.id, { ...body, isActive }) : this.api.create(body);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (team) => {
        this.saving.set(false);
        this.toast.success(existing ? `${team.name} updated.` : `${team.name} created.`);
        this.saved.emit(team);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(error instanceof Error ? error.message : 'Could not save the team.');
      },
    });
  }
}
