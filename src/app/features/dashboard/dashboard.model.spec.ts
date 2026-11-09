import { TournamentMatches } from '../../core/services/insights.models';
import { matchItem } from '../../core/services/testing/fixtures';
import { buildDashboardMatches } from './dashboard.model';

describe('buildDashboardMatches', () => {
  const lists: TournamentMatches[] = [
    {
      tournamentId: 2,
      tournamentName: 'Autumn Cup',
      failed: false,
      matches: [
        matchItem({ id: 20, status: 'InProgress', startedAt: '2026-03-01T10:00:00' }),
        matchItem({ id: 21, status: 'Scheduled', scheduledAt: '2026-03-05T10:00:00' }),
        matchItem({ id: 22, status: 'Scheduled' }),
      ],
    },
    {
      tournamentId: 1,
      tournamentName: 'Spring Open',
      failed: false,
      matches: [
        matchItem({ id: 10, status: 'Completed', completedAt: '2026-02-01T10:00:00' }),
        matchItem({ id: 11, status: 'Walkover', completedAt: '2026-02-09T10:00:00' }),
        matchItem({ id: 12, status: 'Scheduled', scheduledAt: '2026-03-02T10:00:00' }),
        matchItem({ id: 13, status: 'Cancelled' }),
      ],
    },
  ];

  it('splits matches into live, upcoming and recent', () => {
    const view = buildDashboardMatches(lists);

    expect(view.live.map((m) => m.card.id)).toEqual([20]);
    expect(view.live[0].tournamentName).toBe('Autumn Cup');
    expect(view.live[0].card.tournamentId).toBe(2);
    expect(view.recent.map((m) => m.card.id)).toEqual([11, 10]);
  });

  it('orders upcoming by time with unscheduled matches last, and ignores cancelled', () => {
    const view = buildDashboardMatches(lists);

    expect(view.upcoming.map((m) => m.card.id)).toEqual([12, 21, 22]);
  });

  it('caps each list', () => {
    const many: TournamentMatches[] = [
      {
        tournamentId: 1,
        tournamentName: 'T',
        failed: false,
        matches: Array.from({ length: 10 }, (_, i) => matchItem({ id: i + 1, status: 'Scheduled' })),
      },
    ];

    expect(buildDashboardMatches(many).upcoming).toHaveLength(6);
  });
});
