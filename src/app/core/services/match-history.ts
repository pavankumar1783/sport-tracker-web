import { MatchListItem, MatchDetails } from '../models/api.models';
import { MatchStatus, humanizeEnum } from '../models/enums';
import type { MatchCardData } from '../../shared/components/match-card/match-card.component';
import { TournamentMatches } from './insights.models';

export interface TeamRef {
  tournamentId: number;
  tournamentTeamId: number;
}

export interface HistoryCandidate {
  tournamentId: number;
  tournamentName: string;
  matchId: number;
}

export interface HistoryGame {
  own: number;
  opponent: number;
}

export interface HistoryEntry {
  tournamentId: number;
  tournamentName: string;
  matchId: number;
  matchNumber: number;
  title: string;
  status: MatchStatus;
  outcome: 'Won' | 'Lost';
  walkover: boolean;
  teamName: string;
  partners: string[];
  opponentTeam: string;
  opponents: string[];
  games: HistoryGame[];
  gamesWon: number;
  gamesLost: number;
  when: string | null;
}

export function toCardData(tournamentId: number, item: MatchListItem): MatchCardData {
  return { ...item, tournamentId };
}

const DISPLAY_ORDER: Record<MatchStatus, number> = {
  InProgress: 0,
  Scheduled: 1,
  Completed: 2,
  Walkover: 2,
  Cancelled: 3,
};

/** Live first, then scheduled, then finished (newest first), cancelled last. */
export function sortForDisplay<T extends { status: MatchStatus; matchNumber: number }>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) => DISPLAY_ORDER[a.status] - DISPLAY_ORDER[b.status] || b.matchNumber - a.matchNumber,
  );
}

/** Matches that involve one of the given tournament teams, as card data. */
export function teamMatches(lists: readonly TournamentMatches[], teams: readonly TeamRef[]): MatchCardData[] {
  return lists.flatMap((list) =>
    list.matches
      .filter((match) =>
        match.sides.some((side) =>
          teams.some((team) => team.tournamentId === list.tournamentId && team.tournamentTeamId === side.tournamentTeamId),
        ),
      )
      .map((match) => toCardData(list.tournamentId, match)),
  );
}

/**
 * Finished matches played by the given tournament teams, newest first. A player's team plays
 * matches the player may not be in, so these are only candidates: `buildHistoryEntry` decides.
 */
export function selectHistoryCandidates(
  lists: readonly TournamentMatches[],
  teams: readonly TeamRef[],
): HistoryCandidate[] {
  const candidates = lists.flatMap((list) =>
    list.matches
      .filter(
        (match) =>
          (match.status === 'Completed' || match.status === 'Walkover') &&
          match.sides.some((side) =>
            teams.some(
              (team) => team.tournamentId === list.tournamentId && team.tournamentTeamId === side.tournamentTeamId,
            ),
          ),
      )
      .map((match) => ({
        tournamentId: list.tournamentId,
        tournamentName: list.tournamentName,
        matchId: match.id,
        sortKey: match.completedAt ?? match.startedAt ?? '',
      })),
  );

  return candidates
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey) || b.matchId - a.matchId)
    .map(({ tournamentId, tournamentName, matchId }) => ({ tournamentId, tournamentName, matchId }));
}

/** The match from one player's point of view, or null if they did not play or there is no winner. */
export function buildHistoryEntry(
  playerId: number,
  tournamentName: string,
  match: MatchDetails,
): HistoryEntry | null {
  const own = match.sides.find((side) => side.players.some((p) => p.playerId === playerId));
  const opponent = match.sides.find((side) => side !== own);
  if (!own || !opponent || match.winnerSideId === null) {
    return null;
  }

  const games = [...match.games]
    .filter((game) => game.status === 'Completed')
    .sort((a, b) => a.gameNumber - b.gameNumber)
    .flatMap((game): HistoryGame[] => {
      const ownScore = game.scores.find((s) => s.sideId === own.id);
      const opponentScore = game.scores.find((s) => s.sideId === opponent.id);
      return ownScore && opponentScore ? [{ own: ownScore.score, opponent: opponentScore.score }] : [];
    });

  return {
    tournamentId: match.tournamentId,
    tournamentName,
    matchId: match.id,
    matchNumber: match.matchNumber,
    title: match.name ?? humanizeEnum(match.matchType),
    status: match.status,
    outcome: match.winnerSideId === own.id ? 'Won' : 'Lost',
    walkover: match.status === 'Walkover',
    teamName: own.teamName,
    partners: own.players.filter((p) => p.playerId !== playerId).map((p) => p.playerName),
    opponentTeam: opponent.teamName,
    opponents: opponent.players.map((p) => p.playerName),
    games,
    gamesWon: games.filter((g) => g.own > g.opponent).length,
    gamesLost: games.filter((g) => g.own < g.opponent).length,
    when: match.completedAt ?? match.startedAt ?? match.scheduledAt,
  };
}
