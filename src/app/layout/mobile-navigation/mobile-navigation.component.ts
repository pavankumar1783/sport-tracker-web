import { ChangeDetectionStrategy, Component, ElementRef, inject, viewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { MORE_MOBILE_ITEMS, PRIMARY_MOBILE_ITEMS } from '../nav-items';

@Component({
  selector: 'st-mobile-navigation',
  imports: [RouterLink, RouterLinkActive, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="bar" aria-label="Main">
      @for (item of primary; track item.link) {
        <a class="item" [routerLink]="item.link" routerLinkActive="active" ariaCurrentWhenActive="page">
          <st-icon [name]="item.icon" />
          <span>{{ item.label }}</span>
        </a>
      }
      <button type="button" class="item" aria-haspopup="dialog" (click)="open()">
        <st-icon name="more" />
        <span>More</span>
      </button>
    </nav>

    <dialog #sheet class="sheet" aria-label="More" (click)="onBackdrop($event)">
      <div class="sheet-body">
        <div class="grab"></div>
        @for (item of more; track item.link) {
          <a class="row-link" [routerLink]="item.link" (click)="close()">
            <st-icon [name]="item.icon" />{{ item.label }}
          </a>
        }
        @if (auth.isSignedIn()) {
          <a class="row-link" routerLink="/profile" (click)="close()"><st-icon name="user" />My profile</a>
          <a class="row-link" routerLink="/tournaments/new" (click)="close()"><st-icon name="plus" />New tournament</a>
          <button type="button" class="row-link" (click)="signOut()">
            <st-icon name="log-out" />Sign out ({{ auth.displayName() }})
          </button>
        } @else {
          <a class="row-link" routerLink="/sign-in" (click)="close()"><st-icon name="log-in" />Sign in</a>
        }
      </div>
    </dialog>
  `,
  styles: `
    .bar {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      height: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom));
      padding-bottom: env(safe-area-inset-bottom);
      background: var(--c-surface);
      border-top: 1px solid var(--c-border);
    }
    .item {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      border: 0;
      background: transparent;
      color: var(--c-muted);
      font-size: 0.6875rem;
      font-weight: 600;
      text-decoration: none;
    }
    .item:hover {
      text-decoration: none;
    }
    .item.active {
      color: var(--c-primary);
    }
    .sheet {
      margin: auto 0 0;
      width: 100%;
      max-width: none;
      padding: 0;
      border: 0;
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      background: var(--c-surface);
      color: var(--c-text);
    }
    .sheet::backdrop {
      background: rgb(8 12 24 / 0.5);
    }
    .sheet-body {
      display: flex;
      flex-direction: column;
      padding: 8px 8px calc(16px + env(safe-area-inset-bottom));
    }
    .grab {
      width: 40px;
      height: 4px;
      border-radius: 2px;
      background: var(--c-border-strong);
      margin: 4px auto 8px;
    }
    .row-link {
      display: flex;
      align-items: center;
      gap: 14px;
      min-height: 52px;
      padding: 0 14px;
      border: 0;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--c-text);
      font-weight: 600;
      text-align: left;
      text-decoration: none;
    }
    .row-link:hover {
      background: var(--c-surface-2);
      text-decoration: none;
    }
  `,
})
export class MobileNavigationComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly sheet = viewChild.required<ElementRef<HTMLDialogElement>>('sheet');

  protected readonly primary = PRIMARY_MOBILE_ITEMS;
  protected readonly more = MORE_MOBILE_ITEMS;

  protected open(): void {
    this.sheet().nativeElement.showModal();
  }

  protected close(): void {
    this.sheet().nativeElement.close();
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.sheet().nativeElement) {
      this.close();
    }
  }

  protected signOut(): void {
    this.auth.signOut();
    this.close();
    this.toast.info('Signed out.');
    void this.router.navigateByUrl('/dashboard');
  }
}
