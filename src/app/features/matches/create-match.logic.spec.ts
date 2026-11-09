import {
  MatchDraft,
  buildCreateMatchRequest,
  draftProblems,
  inferredFormat,
  localDateTimeToUtcIso,
} from './create-match.logic';

const valid: MatchDraft = {
  stageId: 4,
  matchType: 'Regular',
  name: '  Opening singles ',
  team1Id: 10,
  team2Id: 11,
  players1: [1],
  players2: [2],
  sportFormatId: null,
  scoringRuleId: null,
};

describe('inferredFormat', () => {
  it('maps players per side to singles / doubles', () => {
    expect(inferredFormat(1)).toBe('Singles');
    expect(inferredFormat(2)).toBe('Doubles');
    expect(inferredFormat(3)).toBeNull();
    expect(inferredFormat(0)).toBeNull();
  });
});

describe('draftProblems', () => {
  it('accepts a complete singles draft', () => expect(draftProblems(valid)).toEqual([]));

  it('accepts a complete doubles draft', () => {
    expect(draftProblems({ ...valid, players1: [1, 3], players2: [2, 4] })).toEqual([]);
  });

  it('asks for a stage and teams', () => {
    const problems = draftProblems({ ...valid, stageId: null, team1Id: null });
    expect(problems).toContain('Choose a stage.');
    expect(problems).toContain('Choose a team for each side.');
  });

  it('rejects a team against itself', () => {
    expect(draftProblems({ ...valid, team2Id: 10 })).toContain('A team cannot play against itself.');
  });

  it('rejects unequal or unsupported player counts', () => {
    expect(draftProblems({ ...valid, players2: [2, 3] })).toContain('Both sides need the same number of players.');
    expect(draftProblems({ ...valid, players1: [1, 2, 3], players2: [4, 5, 6] })).toContain(
      'Pick 1 player per side for singles or 2 for doubles.',
    );
  });

  it('allows other player counts when a format is chosen explicitly', () => {
    expect(draftProblems({ ...valid, players1: [1, 2, 3], players2: [4, 5, 6], sportFormatId: 9 })).toEqual([]);
  });

  it('rejects a player on both sides', () => {
    expect(draftProblems({ ...valid, players2: [1] })).toContain('A player cannot be on both sides.');
  });
});

describe('buildCreateMatchRequest', () => {
  it('builds the API request and trims the name', () => {
    expect(buildCreateMatchRequest(valid)).toEqual({
      tournamentStageId: 4,
      sportFormatId: null,
      scoringRuleId: null,
      matchType: 'Regular',
      name: 'Opening singles',
      side1: { tournamentTeamId: 10, playerIds: [1] },
      side2: { tournamentTeamId: 11, playerIds: [2] },
      scheduledAt: null,
    });
  });

  it('sends the kick-off as a UTC instant of the entered local time', () => {
    const request = buildCreateMatchRequest({ ...valid, scheduledAt: '2026-11-05T18:30' });
    expect(request.scheduledAt).toBe(new Date(2026, 10, 5, 18, 30).toISOString());
  });

  it('treats an empty or invalid kick-off as unscheduled', () => {
    expect(localDateTimeToUtcIso('')).toBeNull();
    expect(localDateTimeToUtcIso(undefined)).toBeNull();
    expect(localDateTimeToUtcIso('not a date')).toBeNull();
  });

  it('sends a null name when blank and keeps explicit overrides', () => {
    const request = buildCreateMatchRequest({ ...valid, name: '  ', sportFormatId: 2, scoringRuleId: 7 });
    expect(request.name).toBeNull();
    expect(request.sportFormatId).toBe(2);
    expect(request.scoringRuleId).toBe(7);
  });

  it('refuses an incomplete draft', () => {
    expect(() => buildCreateMatchRequest({ ...valid, team1Id: null })).toThrow();
  });
});
