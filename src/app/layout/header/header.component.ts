import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'st-header',
  imports: [RouterLink, IconComponent, AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="brand" routerLink="/dashboard" aria-label="SportTracker home">
      <span class="mark"><st-icon name="racket" /></span>
      <span class="word">Sport<b>Tracker</b></span>
    </a>
    <span class="spacer"></span>
    @if (auth.isSignedIn()) {
      <a class="btn btn--sm new" routerLink="/tournaments/new"><st-icon name="plus" /><span>New tournament</span></a>
      <a class="who" routerLink="/profile" aria-label="My profile">
        <st-avatar [name]="auth.displayName()" [size]="32" />
        <span class="who-text">
          <span class="who-name truncate">{{ auth.displayName() }}</span>
          @if (auth.isAdmin()) {
            <span class="badge badge--primary">Admin</span>
          }
        </span>
      </a>
      <button type="button" class="btn btn--secondary btn--sm btn--icon" aria-label="Sign out" (click)="signOut()">
        <st-icon name="log-out" />
      </button>
    } @else {
      <span class="viewer muted small">Viewing as guest</span>
      <a class="btn btn--sm" routerLink="/sign-in"><st-icon name="log-in" />Sign in</a>
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 12px;
      height: var(--header-height);
      padding: 0 16px;
      background: color-mix(in srgb, var(--c-surface) 92%, transparent);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--c-border);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--c-text);
      text-decoration: none;
    }
    .mark {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 9px;
      background: var(--c-accent);
      color: #fff;
      --icon-size: 20px;
    }
    .word {
      font-size: 1.0625rem;
      letter-spacing: -0.02em;
    }
    .word b {
      font-weight: 800;
    }
    .spacer {
      flex: 1;
    }
    .who {
      display: none;
      align-items: center;
      gap: 10px;
      color: inherit;
      text-decoration: none;
    }
    .who-text {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      max-width: 140px;
      line-height: 1.2;
    }
    .who-name {
      font-size: 0.8125rem;
      font-weight: 600;
      max-width: 100%;
    }
    .viewer {
      display: none;
    }
    .new span {
      display: none;
    }
    @media (min-width: 900px) {
      :host {
        padding: 0 32px;
      }
      .brand {
        display: none;
      }
      .who,
      .viewer {
        display: flex;
      }
      .new span {
        display: inline;
      }
    }
  `,
})
export class HeaderComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected signOut(): void {
    this.auth.signOut();
    this.toast.info('Signed out.');
    void this.router.navigateByUrl('/dashboard');
  }
}
