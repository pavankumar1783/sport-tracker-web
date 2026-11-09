import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface TabItem {
  label: string;
  /** Router link relative to the current route (or absolute). */
  link: string | readonly unknown[];
  /** Match the link exactly (use for the first/overview tab). */
  exact?: boolean;
}

/** Horizontally scrollable route tabs (tournament sections, player profile sections, ...). */
@Component({
  selector: 'st-tab-nav',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="tabs" [attr.aria-label]="label()">
      @for (tab of tabs(); track tab.label) {
        <a
          class="tab"
          [routerLink]="tab.link"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: tab.exact ?? false }"
          ariaCurrentWhenActive="page"
          >{{ tab.label }}</a
        >
      }
    </nav>
  `,
  styles: `
    .tabs {
      display: flex;
      gap: 4px;
      overflow-x: auto;
      border-bottom: 1px solid var(--c-border);
      scrollbar-width: none;
      margin: 0 -16px;
      padding: 0 16px;
    }
    .tabs::-webkit-scrollbar {
      display: none;
    }
    .tab {
      flex: none;
      padding: 12px 14px;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--c-muted);
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      text-decoration: none;
    }
    .tab:hover {
      color: var(--c-text);
      text-decoration: none;
    }
    .tab.active {
      color: var(--c-primary);
      border-bottom-color: var(--c-primary);
    }
    @media (min-width: 900px) {
      .tabs {
        margin: 0;
        padding: 0;
      }
    }
  `,
})
export class TabNavComponent {
  readonly tabs = input.required<readonly TabItem[]>();
  readonly label = input('Sections');
}
