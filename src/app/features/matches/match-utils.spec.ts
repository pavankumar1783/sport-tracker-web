import { MatchListItem } from '../../core/models/api.models';
import { MatchEntry, asUtc, groupMatches, groupOf, scoreOf, sidePlayersLabel, toCardData, withDetails } from './match-utils';

function entry(id: number, status: MatchListItem['status'], extra: Partial<MatchListItem> = {}, tournamentId = 1): MatchEntry {
  return {
    tournamentId,
    tournamentName: 'Open',
    match: {
      id,
      matchNumber: id,
      name: null,
      matchType: 'Regular',
      status,
      winnerSideId: null,
      scheduledAt: null,
      startedAt: null,
      completedAt: null,
      sides: [],
      ...extra,
    },
  };
}

describe('asUtc', () => {
  it('adds a Z to zone-less timestamps', () => expect(asUtc('2026-11-03T10:00:00')).toBe('2026-11-03T10:00:00Z'));
  it('keeps timestamps that already have a zone', () => {
    expect(asUtc('2026-11-03T10:00:00Z')).toBe('2026-11-03T10:00:00Z');
    expect(asUtc('2026-11-03T10:00:00+02:00')).toBe('2026-11-03T10:00:00+02:00');
  });
  it('passes null through', () => expect(asUtc(null)).toBeNull());
});

describe('groupOf', () => {
  it('maps every status', () => {
    expect(groupOf('InProgress')).toBe('live');
    expect(groupOf('Scheduled')).toBe('scheduled');
    expect(groupOf('Completed')).toBe('finished');
    expect(groupOf('Walkover')).toBe('finished');
    expect(groupOf('Cancelled')).toBe('finished');
  });
});

describe('groupMatches', () => {
  it('splits by group and orders them', () => {
    const groups = groupMatches([
      entry(3, 'Completed', { completedAt: '2026-11-03T09:00:00' }),
      entry(1, 'Completed', { completedAt: '2026-11-03T11:00:00' }),
      entry(5, 'Scheduled', { scheduledAt: '2026-11-04T10:00:00' }),
      entry(4, 'Scheduled'),
      entry(2, 'InProgress'),
    ]);
    expect(groups.live.map((e) => e.match.id)).toEqual([2]);
    expect(groups.scheduled.map((e) => e.match.id)).toEqual([5, 4]);
    expect(groups.finished.map((e) => e.match.id)).toEqual([1, 3]);
  });
});

describe('toCardData', () => {
  it('adds the tournament id and a UTC schedule', () => {
    const data = toCardData(entry(7, 'Scheduled', { scheduledAt: '2026-11-04T10:00:00' }, 9));
    expect(data.tournamentId).toBe(9);
    expect(data.id).toBe(7);
    expect(data.scheduledAt).toBe('2026-11-04T10:00:00Z');
  });

  it('shows "player (team)" per side when players are present, else the team name', () => {
    const data = toCardData(
      entry(1, 'Scheduled', {
        sides: [
          { sideId: 1, sideNumber: 1, tournamentTeamId: 1, teamName: 'Panthers', players: [{ playerId: 1, playerName: 'Pavan', position: 1 }] },
          { sideId: 2, sideNumber: 2, tournamentTeamId: 2, teamName: 'Table Smashers' },
        ],
      }),
    );
    expect(data.sides[0].displayName).toBe('Pavan (Panthers)');
    expect(data.sides[1].displayName).toBeUndefined();
  });

  it('omits the team name when asked', () => {
    const data = toCardData(
      entry(1, 'Scheduled', {
        sides: [{ sideId: 1, sideNumber: 1, tournamentTeamId: 1, teamName: 'Panthers', players: [{ playerId: 1, playerName: 'Pavan', position: 1 }] }],
      }),
      false,
    );
    expect(data.sides[0].displayName).toBe('Pavan');
  });
});

describe('withDetails', () => {
  it('copies the players playing each side from the match details', () => {
    const match = entry(1, 'Scheduled', {
      sides: [
        { sideId: 1, sideNumber: 1, tournamentTeamId: 1, teamName: 'Panthers' },
        { sideId: 2, sideNumber: 2, tournamentTeamId: 2, teamName: 'Table Smashers' },
      ],
    }).match;
    const result = withDetails(match, {
      sportFormatName: 'Doubles',
      scoringRuleId: 5,
      sides: [
        { id: 1, sideNumber: 1, tournamentTeamId: 1, teamName: 'Panthers', players: [{ playerId: 8, playerName: 'abhiram', position: 1 }, { playerId: 4, playerName: 'ajay', position: 2 }] },
        { id: 2, sideNumber: 2, tournamentTeamId: 2, teamName: 'Table Smashers', players: [{ playerId: 3, playerName: 'vishnu', position: 1 }] },
      ],
    });
    expect(toCardData({ tournamentId: 1, tournamentName: null, match: result }).sides.map((s) => s.displayName)).toEqual([
      'abhiram / ajay (Panthers)',
      'vishnu (Table Smashers)',
    ]);
    expect(
      toCardData({ tournamentId: 1, tournamentName: null, match: result }, true, [
        { id: 5, name: 'Standard', gamesToWin: 2, pointsToWin: 11, winBy: 2, maximumPoints: null },
      ]).formatLabel,
    ).toBe('Doubles · Best of 3 to 11, win by 2');
  });
});

describe('side helpers', () => {
  it('joins doubles partners in position order', () => {
    const label = sidePlayersLabel({
      teamName: 'Falcons',
      players: [
        { playerId: 2, playerName: 'Bo Chen', position: 2 },
        { playerId: 1, playerName: 'Ana Silva', position: 1 },
      ],
    });
    expect(label).toBe('Ana Silva / Bo Chen');
  });

  it('falls back to the team name with no players', () => {
    expect(sidePlayersLabel({ teamName: 'Falcons', players: [] })).toBe('Falcons');
  });

  it('reads a side score from a game', () => {
    const game = { scores: [{ sideId: 10, score: 11 }, { sideId: 11, score: 7 }] };
    expect(scoreOf(game, 11)).toBe(7);
    expect(scoreOf(game, 99)).toBeNull();
  });
});
