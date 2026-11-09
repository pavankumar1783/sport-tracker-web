import { aggregateMvp, derivePlayers, deriveTeams, formatWinRate, matchesQuery, winRate } from './roster';
import { mvp, player, team, tournament } from './testing/fixtures';

describe('roster derivation', () => {
  const older = tournament(1, 'Spring Open', [
    team(10, 100, 'Aces', [player(1, 'Ana'), player(2, 'Ben', 2)]),
    team(11, 101, 'Smashers', [player(3, 'Cleo')]),
  ]);
  const newer = tournament(2, 'Autumn Cup', [team(20, 100, 'Aces FC', [player(1, 'Ana'), player(4, 'Dev', 2)])]);

  it('groups the same team across tournaments and prefers the newest name', () => {
    const teams = deriveTeams([older, newer]);

    expect(teams.map((t) => t.name)).toEqual(['Aces FC', 'Smashers']);
    const aces = teams[0];
    expect(aces.appearances.map((a) => a.tournamentId)).toEqual([2, 1]);
    expect(aces.playerCount).toBe(3);
  });

  it('groups a player across tournaments and lists distinct teams', () => {
    const players = derivePlayers([older, newer]);
    const ana = players.find((p) => p.playerId === 1)!;

    expect(players.map((p) => p.name)).toEqual(['Ana', 'Ben', 'Cleo', 'Dev']);
    expect(ana.appearances).toHaveLength(2);
    expect(ana.teams).toEqual([{ teamId: 100, teamName: 'Aces FC' }]);
  });

  it('returns nothing for no tournaments', () => {
    expect(deriveTeams([])).toEqual([]);
    expect(derivePlayers([])).toEqual([]);
  });
});

describe('player totals', () => {
  it('adds MVP rows across tournaments', () => {
    const totals = aggregateMvp([
      mvp({ playerId: 1, playerName: 'Ana', played: 4, won: 3, lost: 1, singlesWon: 2, doublesWon: 1 }),
      mvp({ playerId: 1, playerName: 'Ana', played: 2, won: 1, lost: 1, singlesWon: 1, doublesWon: 0 }),
    ]);

    expect(totals).toEqual({ played: 6, won: 4, lost: 2, singlesWon: 3, doublesWon: 1, winRate: 4 / 6 });
  });

  it('has no win rate before a match is played', () => {
    expect(winRate(0, 0)).toBeNull();
    expect(formatWinRate(null)).toBe('–');
    expect(formatWinRate(2 / 3)).toBe('67%');
  });
});

describe('matchesQuery', () => {
  it('matches case-insensitively on any field and treats blank as everything', () => {
    expect(matchesQuery('', 'x')).toBe(true);
    expect(matchesQuery('  ace', 'Aces', null)).toBe(true);
    expect(matchesQuery('zzz', 'Aces', null)).toBe(false);
  });
});
