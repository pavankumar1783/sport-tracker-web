import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiError } from '../../core/models/api-error';
import { MyProfile } from '../../core/models/api.models';
import { PlayersApi } from '../../core/services/api/players.api';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { TournamentDirectory } from '../../core/services/tournament-directory.service';
import { AsyncState } from '../../core/state/async-state';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../shared/components/error-state/error-state.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';

const NAME_MAX = 150;

@Component({
  selector: 'st-profile-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AvatarComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    IconComponent,
    PageHeaderComponent,
    SkeletonComponent,
    StatusBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page--narrow">
      <st-page-header title="My profile" subtitle="Your account is also your player: it is what organizers put on rosters." />

      @if (profile.error(); as error) {
        <st-error-state [error]="error" (retry)="load()" />
      } @else if (profile.data(); as me) {
        <form class="card stack" (submit)="$event.preventDefault(); save()" novalidate aria-label="Edit profile">
          <div class="row">
            <st-avatar [name]="me.name" [size]="56" />
            <div class="grow">
              <h2 class="truncate">{{ me.name }}</h2>
              <p class="muted small truncate">{{ me.email }}</p>
            </div>
            @if (me.isOrganizer) {
              <span class="badge badge--primary">Admin</span>
            }
          </div>

          <div class="field">
            <label class="field__label" for="profile-name">Name</label>
            <input
              id="profile-name"
              class="input"
              type="text"
              autocomplete="name"
              [attr.maxlength]="nameMax"
              [formControl]="name"
            />
            <span class="field__hint">Shown on rosters, scoreboards and leaderboards. Your email is your sign-in and cannot be changed.</span>
            @if (name.touched && name.invalid) {
              <span class="field__error" role="alert">Enter your name (up to {{ nameMax }} characters).</span>
            }
            @if (error(); as message) {
              <span class="field__error" role="alert">{{ message }}</span>
            }
          </div>

          <div class="form-actions">
            <button type="submit" class="btn" [disabled]="saving() || name.pristine">
              <st-icon name="check" />{{ saving() ? 'Saving…' : 'Save name' }}
            </button>
          </div>
        </form>

        <section class="card card--flush" aria-label="My tournaments">
          <div class="card__header">
            <h2>My tournaments</h2>
            <a class="btn btn--sm" routerLink="/tournaments/new"><st-icon name="plus" />New</a>
          </div>
          @if (!directory.loaded()) {
            <div class="card__body"><st-skeleton [rows]="3" height="24px" /></div>
          } @else if (mine().length === 0) {
            <st-empty-state
              icon="trophy"
              title="No tournaments yet"
              message="Create a tournament to organize it, or ask an organizer to add you to a team."
            />
          } @else {
            <ul class="list">
              @for (item of mine(); track item.tournament.id) {
                <li>
                  <a class="grow truncate" [routerLink]="['/tournaments', item.tournament.id]">{{ item.tournament.name }}</a>
                  @for (role of item.roles; track role) {
                    <span class="badge" [class.badge--primary]="role === 'Organizer'">{{ role }}</span>
                  }
                  <st-status-badge [status]="item.tournament.status" />
                </li>
              }
            </ul>
          }
        </section>

        <div class="row">
          <button type="button" class="btn btn--secondary" (click)="signOut()"><st-icon name="log-out" />Sign out</button>
        </div>
      } @else {
        <div class="card"><st-skeleton [rows]="4" height="26px" /></div>
      }
    </div>
  `,
})
export class ProfilePage {
  private readonly api = inject(PlayersApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly directory = inject(TournamentDirectory);

  protected readonly nameMax = NAME_MAX;
  protected readonly profile = new AsyncState<MyProfile>();
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly name = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(NAME_MAX), (c) => (String(c.value).trim() ? null : { required: true })],
  });

  protected readonly mine = computed(() => {
    const roles = this.directory.myRoles();
    return this.directory
      .tournaments()
      .filter((t) => roles.has(t.id))
      .map((tournament) => ({ tournament, roles: roles.get(tournament.id) ?? [] }));
  });

  constructor() {
    void this.directory.load();
    this.load();

    // Fill the form when the profile arrives, without clobbering an edit in progress.
    effect(() => {
      const me = this.profile.data();
      untracked(() => {
        if (me && this.name.pristine) {
          this.name.setValue(me.name);
          this.name.markAsPristine();
        }
      });
    });
  }

  protected load(): void {
    this.profile.load(this.api.me());
  }

  protected save(): void {
    this.name.markAsTouched();
    if (this.name.invalid || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.api
      .updateMe(this.name.value.trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (me) => {
          this.saving.set(false);
          this.profile.data.set(me);
          this.name.setValue(me.name);
          this.name.markAsPristine();
          this.auth.setDisplayName(me.name);
          this.toast.success('Name updated.');
          void this.directory.load(true);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(ApiError.from(error).userMessage);
        },
      });
  }

  protected signOut(): void {
    this.auth.signOut();
    this.toast.info('Signed out.');
    void this.router.navigateByUrl('/dashboard');
  }
}
