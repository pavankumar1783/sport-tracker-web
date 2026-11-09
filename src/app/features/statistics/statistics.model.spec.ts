import { mvp, standing } from '../../core/services/testing/fixtures';
import { percentOf, splitWins, summarizeStandings, topPerformers } from './statistics.model';

describe('statistics model', () => {
  it('sums games and points from standings', () => {
    const summary = summarizeStandings([
      standing({ position: 1, teamName: 'A', gamesWon: 4, pointsFor: 80 }),
      standing({ position: 2, teamName: 'B', gamesWon: 1, pointsFor: 55 }),
    ]);

    expect(summary).toEqual({ games: 5, points: 135 });
  });

  it('counts a doubles win once even though both partners are credited', () => {
    const split = splitWins([
      mvp({ playerId: 1, playerName: 'A', singlesWon: 2, doublesWon: 1 }),
      mvp({ playerId: 2, playerName: 'B', singlesWon: 1, doublesWon: 1 }),
    ]);

    expect(split).toEqual({ singles: 3, doubles: 1, total: 4 });
  });

  it('computes shares without dividing by zero', () => {
    expect(percentOf(1, 4)).toBe(25);
    expect(percentOf(0, 0)).toBe(0);
  });

  it('keeps the API order and skips players with no matches', () => {
    const top = topPerformers(
      [
        mvp({ playerId: 1, playerName: 'A', position: 1, played: 3 }),
        mvp({ playerId: 2, playerName: 'B', position: 2, played: 0 }),
        mvp({ playerId: 3, playerName: 'C', position: 3, played: 2 }),
      ],
      3,
    );

    expect(top.map((p) => p.playerId)).toEqual([1, 3]);
  });
});
