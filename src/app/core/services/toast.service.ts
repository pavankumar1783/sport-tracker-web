import { Injectable, signal } from '@angular/core';
import { ApiError } from '../models/api-error';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const DURATION_MS: Record<ToastKind, number> = { success: 3500, info: 4000, error: 6500 };

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  readonly toasts = signal<Toast[]>([]);

  success(message: string): void {
    this.push('success', message);
  }

  info(message: string): void {
    this.push('info', message);
  }

  error(message: string): void {
    this.push('error', message);
  }

  /** Shows an API failure with the backend's own explanation. */
  fromError(error: unknown, fallback = 'Something went wrong.'): void {
    const apiError = ApiError.from(error);
    this.push('error', apiError.userMessage || fallback);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private push(kind: ToastKind, message: string): void {
    const id = this.nextId++;
    this.toasts.update((list) => [...list.slice(-3), { id, kind, message }]);
    setTimeout(() => this.dismiss(id), DURATION_MS[kind]);
  }
}
