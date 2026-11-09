import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiError } from '../../core/models/api-error';
import { AuthApi } from '../../core/services/api/auth.api';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

/** Loose on purpose, like the API: one "@" with something on each side and no spaces. The emailed code is the real proof. */
export function looseEmail(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value.trim();
  const at = value.indexOf('@');
  const ok = at > 0 && at === value.lastIndexOf('@') && at < value.length - 1 && !/\s/.test(value);
  return ok ? null : { email: true };
}

const CODE_LENGTH = 6;
const NAME_MAX = 150;

@Component({
  selector: 'st-sign-in-page',
  imports: [ReactiveFormsModule, RouterLink, IconComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page--narrow">
      @if (auth.isSignedIn()) {
        <st-page-header title="You are signed in" />
        <div class="card stack">
          <div class="row">
            <span class="badge badge--success"><st-icon name="check" />Signed in</span>
            <strong>{{ auth.displayName() }}</strong>
            @if (auth.isAdmin()) {
              <span class="badge badge--primary">Admin</span>
            }
          </div>
          <div class="row">
            <a class="btn" routerLink="/tournaments/new"><st-icon name="plus" />New tournament</a>
            <a class="btn btn--secondary" routerLink="/profile">My profile</a>
            <button type="button" class="btn btn--ghost" (click)="signOut()">Sign out</button>
          </div>
        </div>
      } @else {
        <st-page-header
          title="Sign in or create an account"
          subtitle="Enter your email and we will send you a 6-digit code. No password needed. A new email creates your account."
        />

        @if (step() === 'email') {
          <form class="card stack" (submit)="$event.preventDefault(); requestCode()" novalidate aria-label="Sign in with email">
            <div class="field">
              <label class="field__label" for="email">Email</label>
              <input
                id="email"
                class="input"
                type="email"
                inputmode="email"
                autocomplete="email"
                placeholder="you@example.com"
                [formControl]="email"
              />
              @if (email.touched && email.invalid) {
                <span class="field__error" role="alert">Enter a valid email address.</span>
              }
            </div>
            @if (message(); as text) {
              <div class="notice notice--danger" role="alert"><st-icon name="alert" /><span>{{ text }}</span></div>
            }
            <button type="submit" class="btn btn--lg" [disabled]="busy()">
              <st-icon name="log-in" />{{ busy() ? 'Sending code…' : 'Email me a code' }}
            </button>
          </form>
        } @else {
          <form class="card stack" (submit)="$event.preventDefault(); verify()" novalidate aria-label="Enter your code">
            <p class="muted">
              We sent a code to <strong>{{ email.value.trim().toLowerCase() }}</strong>. It is valid for
              {{ expiresInMinutes() }} minutes.
            </p>

            <div class="field">
              <label class="field__label" for="code">6-digit code</label>
              <input
                #codeInput
                id="code"
                class="input code"
                type="text"
                inputmode="numeric"
                autocomplete="one-time-code"
                [attr.maxlength]="codeLength"
                placeholder="000000"
                [formControl]="code"
                (input)="onCodeInput()"
              />
            </div>

            @if (needsName()) {
              <div class="field">
                <label class="field__label" for="name">Your name</label>
                <input
                  #nameInput
                  id="name"
                  class="input"
                  type="text"
                  autocomplete="name"
                  [attr.maxlength]="nameMax"
                  placeholder="How should we show you to others?"
                  [formControl]="name"
                />
                <span class="field__hint">This looks like your first time here. Your name is shown on rosters and results.</span>
                @if (name.touched && name.invalid) {
                  <span class="field__error" role="alert">Enter your name.</span>
                }
              </div>
            }

            @if (message(); as text) {
              <div class="notice notice--danger" role="alert"><st-icon name="alert" /><span>{{ text }}</span></div>
            }

            <button type="submit" class="btn btn--lg" [disabled]="busy()">
              <st-icon name="check" />{{ busy() ? 'Checking…' : needsName() ? 'Create account' : 'Sign in' }}
            </button>

            <div class="row row--between">
              <button type="button" class="btn btn--ghost btn--sm" (click)="changeEmail()">Use a different email</button>
              <button type="button" class="btn btn--ghost btn--sm" [disabled]="busy() || secondsLeft() > 0" (click)="resend()">
                {{ secondsLeft() > 0 ? 'Resend code in ' + secondsLeft() + 's' : 'Resend code' }}
              </button>
            </div>
          </form>
        }
      }
    </div>
  `,
  styles: `
    .code {
      font-size: 1.5rem;
      letter-spacing: 0.4em;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class SignInPage {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(AuthApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  /** Bound from the `?returnUrl=` query parameter set by the auth guard. */
  readonly returnUrl = input<string>();

  private readonly codeInput = viewChild<ElementRef<HTMLInputElement>>('codeInput');
  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');

  protected readonly codeLength = CODE_LENGTH;
  protected readonly nameMax = NAME_MAX;

  protected readonly step = signal<'email' | 'code'>('email');
  protected readonly busy = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly needsName = signal(false);
  protected readonly secondsLeft = signal(0);
  protected readonly expiresInMinutes = signal(5);

  protected readonly email = new FormControl('', { nonNullable: true, validators: [Validators.required, looseEmail] });
  protected readonly code = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  protected readonly name = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(NAME_MAX), (c) => (String(c.value).trim() ? null : { required: true })],
  });

  private timer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    this.destroyRef.onDestroy(() => this.stopCountdown());
  }

  protected requestCode(): void {
    this.email.markAsTouched();
    if (this.email.invalid || this.busy()) {
      return;
    }

    this.busy.set(true);
    this.message.set(null);
    this.api
      .requestOtp(this.email.value.trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.busy.set(false);
          this.expiresInMinutes.set(Math.max(1, Math.round(result.expiresInSeconds / 60)));
          this.startCountdown(result.resendAfterSeconds);
          this.code.reset('');
          this.needsName.set(false);
          this.step.set('code');
          queueMicrotask(() => this.codeInput()?.nativeElement.focus());
        },
        error: (error: unknown) => this.fail(error),
      });
  }

  protected resend(): void {
    this.requestCode();
    this.toast.info('A new code is on its way.');
  }

  /** Submits as soon as the sixth digit lands (the common case on phones with SMS/email autofill). */
  protected onCodeInput(): void {
    const digits = this.code.value.replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (digits !== this.code.value) {
      this.code.setValue(digits, { emitEvent: false });
    }
    if (digits.length === CODE_LENGTH && !this.needsName()) {
      this.verify();
    }
  }

  protected verify(): void {
    if (this.busy()) {
      return;
    }
    if (this.code.value.length !== CODE_LENGTH) {
      this.message.set(`Enter the ${CODE_LENGTH}-digit code from the email.`);
      return;
    }
    if (this.needsName()) {
      this.name.markAsTouched();
      if (this.name.invalid) {
        return;
      }
    }

    this.busy.set(true);
    this.message.set(null);
    this.api
      .verifyOtp({
        email: this.email.value.trim(),
        code: this.code.value,
        name: this.needsName() ? this.name.value.trim() : undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          const problem = this.auth.startSession(result.accessToken);
          this.busy.set(false);
          if (problem) {
            this.message.set(problem);
            return;
          }
          this.stopCountdown();
          this.toast.success(
            result.user.isNewUser ? `Welcome, ${result.user.name}! Your account is ready.` : `Welcome back, ${result.user.name}.`,
          );
          void this.router.navigateByUrl(this.safeReturnUrl());
        },
        error: (error: unknown) => {
          if (ApiError.from(error).code === 'User.NameRequired') {
            // The code is still valid: ask for the name and let the person submit again.
            this.busy.set(false);
            this.needsName.set(true);
            queueMicrotask(() => this.nameInput()?.nativeElement.focus());
            return;
          }
          this.fail(error);
        },
      });
  }

  protected changeEmail(): void {
    this.stopCountdown();
    this.message.set(null);
    this.needsName.set(false);
    this.step.set('email');
  }

  protected signOut(): void {
    this.auth.signOut();
    this.toast.info('Signed out.');
  }

  private fail(error: unknown): void {
    this.busy.set(false);
    this.message.set(ApiError.from(error).userMessage);
  }

  private startCountdown(seconds: number): void {
    this.stopCountdown();
    this.secondsLeft.set(seconds);
    this.timer = setInterval(() => {
      this.secondsLeft.update((s) => Math.max(0, s - 1));
      if (this.secondsLeft() === 0) {
        this.stopCountdown();
      }
    }, 1000);
  }

  private stopCountdown(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private safeReturnUrl(): string {
    const url = this.returnUrl();
    return url?.startsWith('/') && !url.startsWith('//') ? url : '/dashboard';
  }
}
