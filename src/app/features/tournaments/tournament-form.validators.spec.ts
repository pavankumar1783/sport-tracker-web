import { FormControl, FormGroup } from '@angular/forms';
import { dateRange, toApiDate, trimmedRequired } from './tournament-form.validators';

describe('trimmedRequired', () => {
  it('rejects empty and whitespace-only values', () => {
    expect(trimmedRequired(new FormControl(''))).toEqual({ required: true });
    expect(trimmedRequired(new FormControl('   '))).toEqual({ required: true });
    expect(trimmedRequired(new FormControl(null))).toEqual({ required: true });
  });

  it('accepts text', () => {
    expect(trimmedRequired(new FormControl(' Cup '))).toBeNull();
  });
});

describe('dateRange', () => {
  const group = (start: string | null, end: string | null) =>
    new FormGroup({ start: new FormControl(start), end: new FormControl(end) }, { validators: [dateRange('start', 'end')] });

  it('flags an end date before the start date', () => {
    expect(group('2026-05-10', '2026-05-09').errors).toEqual({ dateRange: true });
  });

  it('allows equal dates, later end dates and missing dates', () => {
    expect(group('2026-05-10', '2026-05-10').errors).toBeNull();
    expect(group('2026-05-10', '2026-06-01').errors).toBeNull();
    expect(group(null, '2026-06-01').errors).toBeNull();
    expect(group('2026-05-10', null).errors).toBeNull();
  });
});

describe('toApiDate', () => {
  it('turns a date input value into an ISO date-time', () => {
    expect(toApiDate('2026-05-10')).toBe('2026-05-10T00:00:00');
  });

  it('maps empty values to null', () => {
    expect(toApiDate('')).toBeNull();
    expect(toApiDate(null)).toBeNull();
  });
});
