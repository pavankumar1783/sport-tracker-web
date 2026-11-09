import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ICONS, IconDef, IconName } from './icons';

@Component({
  selector: 'st-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      @for (d of def().paths ?? []; track $index) {
        <path [attr.d]="d" />
      }
      @for (c of def().circles ?? []; track $index) {
        <circle [attr.cx]="c[0]" [attr.cy]="c[1]" [attr.r]="c[2]" />
      }
      @for (r of def().rects ?? []; track $index) {
        <rect [attr.x]="r[0]" [attr.y]="r[1]" [attr.width]="r[2]" [attr.height]="r[3]" [attr.rx]="r[4]" />
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      width: var(--icon-size, 20px);
      height: var(--icon-size, 20px);
      flex: none;
    }
    svg {
      width: 100%;
      height: 100%;
    }
  `,
})
export class IconComponent {
  readonly name = input.required<IconName>();
  protected readonly def = computed<IconDef>(() => ICONS[this.name()]);
}
