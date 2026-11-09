import { buildHistoryEntry, selectHistoryCandidates, sortForDisplay, teamMatches } from './match-history';
import { finishedMatch, matchItem } from './testing/fixtures';
import { TournamentMatches } from './insights.models';

describe('buildHistoryEntry', () => {
  it('shows the match from the winner\'s side with games in order', () => {
    const entry = buildHistoryEntry(7, 'Spring Open', finishedMatch())!;

    expect(entry.outcome).toBe('Won');
    expect(entry.opponentTeam).toBe('Smashers');
    expect(entry.opponents).toEqual(['Ben']);
    expect(entry.games).toEqual([
      { own: 11, opponent: 6 },
      { own: 8, opponent: 11 },
      { own: 12, opponent: 10 },
    ]);
    expect(entry.gamesWon).toBe(2);
    expect(entry.gamesLost).toBe(1);
  });

  it('flips scores and outcome for the other side', () => {
    const entry = buildHistoryEntry(8, 'Spring Open', finishedMatch())!;

    expect(entry.outcome).toBe('Lost');
    expect(entry.games[0]).toEqual({ own: 6, opponent: 11 });
  });

  it('marks a walkover', () => {
    const entry = buildHistoryEntry(7, 'Spring Open', finishedMatch({ status: 'Walkover', games: [] }))!;

    expect(entry.walkover).toBe(true);
    expect(entry.games).toEqual([]);
  });

  it('skips matches the player was not in, or that have no winner', () => {
    expect(buildHistoryEntry(99, 'Spring Open', finishedMatch())).toBeNull();
    expect(buildHistoryEntry(7, 'Spring Open', finishedMatch({ winnerSideId: null }))).toBeNull();
  });
});

describe('selectHistoryCandidates', () => {
  const lists: TournamentMatches[] = [
    {
      tournamentId: 1,
      tournamentName: 'Spring Open',
      failed: false,
      matches: [
        matchItem({ id: 1, status: 'Completed', completedAt: '2026-02-01T10:00:00' }),
        matchItem({ id: 2, status: 'Completed', completedAt: '2026-02-03T10:00:00' }),
        matchItem({ id: 3, status: 'Scheduled' }),
        matchItem({ id: 4, status: 'Walkover', completedAt: '2026-02-02T10:00:00' }),
        matchItem({ id: 5, status: 'Cancelled' }),
        matchItem({
          id: 6,
          status: 'Completed',
          completedAt: '2026-02-04T10:00:00',
          sides: [
            { sideId: 61, sideNumber: 1, tournamentTeamId: 8, teamName: 'Other' },
            { sideId: 62, sideNumber: 2, tournamentTeamId: 9, teamName: 'Another' },
          ],
        }),
      ],
    },
  ];

  it('keeps only finished matches of the given teams, newest first', () => {
    const result = selectHistoryCandidates(lists, [{ tournamentId: 1, tournamentTeamId: 1 }]);

    expect(result.map((c) => c.matchId)).toEqual([2, 4, 1]);
  });
});

describe('team matches', () => {
  it('filters by tournament team and orders live first', () => {
    const lists: TournamentMatches[] = [
      {
        tournamentId: 1,
        tournamentName: 'Spring Open',
        failed: false,
        matches: [
          matchItem({ id: 1, status: 'Completed' }),
          matchItem({ id: 2, status: 'InProgress' }),
          matchItem({ id: 3, status: 'Scheduled' }),
        ],
      },
    ];

    const cards = sortForDisplay(teamMatches(lists, [{ tournamentId: 1, tournamentTeamId: 2 }]));

    expect(cards.map((c) => c.id)).toEqual([2, 3, 1]);
    expect(cards[0].tournamentId).toBe(1);
    expect(teamMatches(lists, [{ tournamentId: 1, tournamentTeamId: 99 }])).toEqual([]);
  });
});
