import { MATCH_STATUSES, TOURNAMENT_STATUSES, humanizeEnum, parseEnum } from './enums';

describe('parseEnum', () => {
  it('maps the numeric wire value to the enum name', () => {
    expect(parseEnum(TOURNAMENT_STATUSES, 0)).toBe('Draft');
    expect(parseEnum(TOURNAMENT_STATUSES, 2)).toBe('Active');
    expect(parseEnum(MATCH_STATUSES, 4)).toBe('Walkover');
  });

  it('accepts the name when the DTO carries a string', () => {
    expect(parseEnum(TOURNAMENT_STATUSES, 'Registration')).toBe('Registration');
  });

  it('rejects values the backend does not define', () => {
    expect(() => parseEnum(TOURNAMENT_STATUSES, 9)).toThrow(/Unexpected enum value/);
    expect(() => parseEnum(TOURNAMENT_STATUSES, 'Paused')).toThrow(/Unexpected enum value/);
  });
});

describe('humanizeEnum', () => {
  it('splits PascalCase into a readable label', () => {
    expect(humanizeEnum('InProgress')).toBe('In progress');
    expect(humanizeEnum('GroupsWithKnockout')).toBe('Groups with knockout');
    expect(humanizeEnum('Draft')).toBe('Draft');
  });
});
