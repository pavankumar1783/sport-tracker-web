import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { ConfirmService } from '../../../core/services/confirm.service';

/** Renders `ConfirmService` requests in a native modal `<dialog>` (focus trap and Esc come from the browser). */
@Component({
  selector: 'st-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dialog class="dialog" aria-labelledby="confirm-title" (cancel)="$event.preventDefault(); service.settle(false)">
      @if (service.pending(); as request) {
        <h2 id="confirm-title">{{ request.title }}</h2>
        <p class="muted">{{ request.message }}</p>
        <div class="actions">
          <button type="button" class="btn btn--secondary" (click)="service.settle(false)">
            {{ request.cancelLabel ?? 'Cancel' }}
          </button>
          <button type="button" class="btn" [class.btn--danger]="request.danger" (click)="service.settle(true)">
            {{ request.confirmLabel ?? 'Confirm' }}
          </button>
        </div>
      }
    </dialog>
  `,
  styles: `
    .dialog {
      width: min(92vw, 420px);
      padding: 20px;
      border: 1px solid var(--c-border);
      border-radius: var(--radius-lg);
      background: var(--c-surface);
      color: var(--c-text);
      box-shadow: var(--shadow-lg);
    }
    .dialog::backdrop {
      background: rgb(8 12 24 / 0.55);
    }
    p {
      margin: 8px 0 20px;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
  `,
})
export class ConfirmDialogComponent {
  protected readonly service = inject(ConfirmService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const element = this.dialog().nativeElement;
      const open = this.service.pending() !== null;
      if (open && !element.open) {
        element.showModal();
      } else if (!open && element.open) {
        element.close();
      }
    });
  }
}
