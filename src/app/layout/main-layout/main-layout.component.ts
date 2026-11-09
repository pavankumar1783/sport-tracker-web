import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { ToastHostComponent } from '../../shared/components/toast-host/toast-host.component';
import { HeaderComponent } from '../header/header.component';
import { MobileNavigationComponent } from '../mobile-navigation/mobile-navigation.component';
import { SidebarComponent } from '../sidebar/sidebar.component';

/** Responsive shell: sidebar + header on desktop, header + bottom navigation on phones. */
@Component({
  selector: 'st-main-layout',
  imports: [
    RouterOutlet,
    SidebarComponent,
    HeaderComponent,
    MobileNavigationComponent,
    ToastHostComponent,
    ConfirmDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="skip" href="#content">Skip to content</a>
    <st-sidebar class="sidebar" />
    <div class="column">
      <st-header class="header" />
      <main id="content" class="content" tabindex="-1"><router-outlet /></main>
      <st-mobile-navigation class="bottom" />
    </div>
    <st-toast-host />
    <st-confirm-dialog />
  `,
  styles: `
    :host {
      display: block;
      min-height: 100dvh;
    }
    .skip {
      position: absolute;
      left: 8px;
      top: -48px;
      z-index: 2000;
      padding: 8px 12px;
      border-radius: var(--radius-sm);
      background: var(--c-primary);
      color: var(--c-on-primary);
    }
    .skip:focus {
      top: 8px;
    }
    .sidebar {
      display: none;
    }
    .column {
      display: flex;
      flex-direction: column;
      min-height: 100dvh;
    }
    .header {
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .content {
      flex: 1;
      outline: none;
      padding-bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom));
    }
    .bottom {
      position: fixed;
      inset: auto 0 0 0;
      z-index: 60;
    }
    @media (min-width: 900px) {
      .sidebar {
        display: block;
        position: fixed;
        inset: 0 auto 0 0;
        width: var(--sidebar-width);
        z-index: 70;
      }
      .column {
        margin-left: var(--sidebar-width);
      }
      .content {
        padding-bottom: 0;
      }
      .bottom {
        display: none;
      }
    }
  `,
})
export class MainLayoutComponent {}
