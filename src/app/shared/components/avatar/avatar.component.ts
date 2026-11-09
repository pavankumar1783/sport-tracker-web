import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const HUES = [222, 262, 190, 150, 24, 340, 40, 280];

/** Initials on a colour derived from the name, so the same person always looks the same. */
@Component({
  selector: 'st-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="avatar" [style.background]="background()" [style.color]="foreground()" [style.--size]="size() + 'px'" aria-hidden="true">{{ initials() }}</span>`,
  styles: `
    :host {
      display: inline-flex;
    }
    .avatar {
      display: grid;
      place-items: center;
      width: var(--size, 36px);
      height: var(--size, 36px);
      border-radius: 50%;
      font-size: calc(var(--size, 36px) * 0.38);
      font-weight: 700;
      letter-spacing: 0.02em;
      flex: none;
    }
  `,
})
export class AvatarComponent {
  readonly name = input.required<string>();
  readonly size = input(36);

  protected readonly initials = computed(() => initialsOf(this.name()));
  private readonly hue = computed(() => HUES[hash(this.name()) % HUES.length]);
  protected readonly background = computed(() => `hsl(${this.hue()} 80% 92%)`);
  protected readonly foreground = computed(() => `hsl(${this.hue()} 60% 32%)`);
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0][1] ?? '');
  return (first + last).toUpperCase();
}

function hash(value: string): number {
  let result = 0;
  for (const char of value) {
    result = (result * 31 + char.charCodeAt(0)) >>> 0;
  }
  return result;
}
