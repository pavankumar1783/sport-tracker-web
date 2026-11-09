import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Backend limit (CreateTournamentService): names are trimmed and at most 200 characters. */
export const TOURNAMENT_NAME_MAX = 200;

export function trimmedRequired(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  return typeof value === 'string' && value.trim().length > 0 ? null : { required: true };
}

/** End date must not be before the start date (both optional, `YYYY-MM-DD`). */
export function dateRange(startKey: string, endKey: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const start = group.get(startKey)?.value as string | null | undefined;
    const end = group.get(endKey)?.value as string | null | undefined;
    return start && end && end < start ? { dateRange: true } : null;
  };
}

/** Converts a date input value (`YYYY-MM-DD`) to the ISO date-time the API expects, or null when empty. */
export function toApiDate(value: string | null | undefined): string | null {
  return value ? `${value}T00:00:00` : null;
}
