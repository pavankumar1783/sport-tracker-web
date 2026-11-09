import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { NAV_ITEMS } from '../nav-items';

@Component({
  selector: 'st-sidebar',
  imports: [RouterLink, RouterLinkActive, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="brand" routerLink="/dashboard" aria-label="SportTracker home">
      <span class="mark"><st-icon name="racket" /></span>
      <span class="word">Sport<b>Tracker</b></span>
    </a>
    <nav aria-label="Main">
      @for (item of items; track item.link) {
        <a class="link" [routerLink]="item.link" routerLinkActive="active" ariaCurrentWhenActive="page">
          <st-icon [name]="item.icon" />
          {{ item.label }}
        </a>
      }
    </nav>
    <p class="foot">Table tennis</p>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 24px;
      height: 100%;
      padding: 20px 14px;
      background: var(--c-nav);
      color: var(--c-nav-text);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 8px;
      color: #fff;
      text-decoration: none;
    }
    .mark {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: var(--c-accent);
      color: #fff;
      --icon-size: 22px;
    }
    .word {
      font-size: 1.125rem;
      font-weight: 500;
      letter-spacing: -0.02em;
    }
    .word b {
      font-weight: 800;
    }
    nav {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .link {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: var(--radius-sm);
      color: var(--c-nav-text);
      font-weight: 600;
      font-size: 0.9375rem;
      text-decoration: none;
      transition: background 0.15s, color 0.15s;
    }
    .link:hover {
      background: rgb(255 255 255 / 0.06);
      color: #fff;
      text-decoration: none;
    }
    .link.active {
      background: var(--c-nav-active-bg);
      color: var(--c-nav-active);
    }
    .link.active st-icon {
      color: var(--c-accent);
    }
    .foot {
      margin-top: auto;
      padding: 0 12px;
      font-size: 0.75rem;
      opacity: 0.6;
    }
  `,
})
export class SidebarComponent {
  protected readonly items = NAV_ITEMS;
}
