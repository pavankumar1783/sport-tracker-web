import { MvpItem, StandingItem } from '../../core/models/api.models';

export interface StandingsSummary {
  games: number;
  points: number;
}

/**
 * Totals derived from the standings the API ranked. Each game is won by one team, so the sum of
 * games won is the number of games played (walkovers carry no game stats).
 */
export function summarizeStandings(standings: readonly StandingItem[]): StandingsSummary {
  return {
    games: standings.reduce((sum, row) => sum + row.gamesWon, 0),
    points: standings.reduce((sum, row) => sum + row.pointsFor, 0),
  };
}

export interface MatchTypeSplit {
  singles: number;
  doubles: number;
  total: number;
}

/**
 * Singles and doubles matches won across the leaderboard. A doubles win is credited to both
 * partners, so the doubles total is halved to count matches rather than players.
 */
export function splitWins(players: readonly MvpItem[]): MatchTypeSplit {
  const singles = players.reduce((sum, p) => sum + p.singlesWon, 0);
  const doubles = Math.round(players.reduce((sum, p) => sum + p.doublesWon, 0) / 2);
  return { singles, doubles, total: singles + doubles };
}

/** Share of `part` in `total` as a whole percentage (0 when there is nothing). */
export function percentOf(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/** Players with at least one match, in the API's order. */
export function topPerformers(players: readonly MvpItem[], count = 3): MvpItem[] {
  return players.filter((p) => p.played > 0).slice(0, count);
}
