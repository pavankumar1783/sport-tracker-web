import { DestroyRef, inject, signal } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { ApiError } from '../models/api-error';

/**
 * Signal-based holder for one HTTP-backed value: `data`, `loading`, `error`.
 * Starting a new `load` cancels the previous request. Create it in an injection context.
 */
export class AsyncState<T> {
  readonly data = signal<T | null>(null);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);

  private subscription?: Subscription;

  constructor(destroyRef = inject(DestroyRef)) {
    destroyRef.onDestroy(() => this.subscription?.unsubscribe());
  }

  /** Loads from `source`. By default the previous data stays visible while reloading. */
  load(source: Observable<T>, options: { keepData?: boolean } = {}): void {
    this.subscription?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    if (options.keepData === false) {
      this.data.set(null);
    }

    this.subscription = source.subscribe({
      next: (value) => {
        this.data.set(value);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(ApiError.from(error));
        this.loading.set(false);
      },
    });
  }
}
