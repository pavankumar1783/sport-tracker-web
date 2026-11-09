import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'st-toast-host',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="host" aria-live="polite" aria-atomic="false">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="toast" [class]="'toast toast--' + toast.kind" [attr.role]="toast.kind === 'error' ? 'alert' : 'status'">
          <st-icon [name]="toast.kind === 'success' ? 'check' : toast.kind === 'error' ? 'alert' : 'info'" />
          <span class="msg">{{ toast.message }}</span>
          <button type="button" class="close" aria-label="Dismiss" (click)="toasts.dismiss(toast.id)">
            <st-icon name="x" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .host {
      position: fixed;
      z-index: 1000;
      left: 12px;
      right: 12px;
      bottom: calc(var(--bottom-nav-height) + 12px + env(safe-area-inset-bottom));
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
      align-items: center;
    }
    .toast {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 10px;
      width: min(100%, 440px);
      padding: 12px 12px 12px 14px;
      border-radius: var(--radius);
      background: var(--c-nav);
      color: #fff;
      box-shadow: var(--shadow-lg);
      font-size: 0.875rem;
      animation: rise 0.2s ease-out;
      --icon-size: 18px;
    }
    .toast--success st-icon:first-child {
      color: #4be0a8;
    }
    .toast--error st-icon:first-child {
      color: #ff8f86;
    }
    .toast--info st-icon:first-child {
      color: #8fb4ff;
    }
    .msg {
      flex: 1;
      overflow-wrap: anywhere;
    }
    .close {
      border: 0;
      background: transparent;
      color: #aab6cf;
      padding: 4px;
      display: grid;
      --icon-size: 16px;
    }
    @keyframes rise {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
    }
    @media (min-width: 900px) {
      .host {
        bottom: 24px;
        left: auto;
        right: 24px;
        align-items: flex-end;
      }
    }
  `,
})
export class ToastHostComponent {
  protected readonly toasts = inject(ToastService);
}
