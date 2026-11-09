import { MatchListItem } from '../models/api.models';

export interface TournamentRef {
  id: number;
  name: string;
}

/** One tournament's match list; `failed` is set when that single request errored (others still load). */
export interface TournamentMatches {
  tournamentId: number;
  tournamentName: string;
  matches: MatchListItem[];
  failed: boolean;
}

export interface MatchRef {
  tournamentId: number;
  matchId: number;
}
