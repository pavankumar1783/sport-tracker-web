import {
  MatchDetails,
  MatchListItem,
  MvpItem,
  StandingItem,
  Tournament,
  TournamentPlayer,
  TournamentTeam,
} from '../../models/api.models';

/** Builders for tests only; not imported by application code. */

export function player(playerId: number, name: string, position = 1): TournamentPlayer {
  return { playerId, name, position, joinedAt: '2026-01-01T00:00:00' };
}

export function team(
  tournamentTeamId: number,
  teamId: number,
  teamName: string,
  players: TournamentPlayer[],
): TournamentTeam {
  return { tournamentTeamId, teamId, teamName, teamCode: null, seed: null, status: 'Registered', players };
}

export function tournament(id: number, name: string, teams: TournamentTeam[]): Tournament {
  return {
    id,
    sportId: 1,
    sportName: 'Table Tennis',
    name,
    status: 'Active',
    rosterSize: null,
    startDate: null,
    endDate: null,
    createdAt: '2026-01-01T00:00:00',
    organizerUserId: 1,
    teams,
  };
}

export function matchItem(overrides: Partial<MatchListItem> & Pick<MatchListItem, 'id'>): MatchListItem {
  return {
    matchNumber: overrides.id,
    name: null,
    matchType: 'Regular',
    status: 'Scheduled',
    winnerSideId: null,
    scheduledAt: null,
    startedAt: null,
    completedAt: null,
    sides: [
      { sideId: overrides.id * 10 + 1, sideNumber: 1, tournamentTeamId: 1, teamName: 'Aces' },
      { sideId: overrides.id * 10 + 2, sideNumber: 2, tournamentTeamId: 2, teamName: 'Smashers' },
    ],
    ...overrides,
  };
}

export function standing(overrides: Partial<StandingItem> & Pick<StandingItem, 'position' | 'teamName'>): StandingItem {
  return {
    tournamentTeamId: overrides.position,
    teamId: overrides.position,
    played: 0,
    won: 0,
    lost: 0,
    matchPoints: 0,
    gamesWon: 0,
    gamesLost: 0,
    gameDifference: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    pointDifference: 0,
    ...overrides,
  };
}

export function mvp(overrides: Partial<MvpItem> & Pick<MvpItem, 'playerId' | 'playerName'>): MvpItem {
  return {
    position: 1,
    tournamentTeamId: 1,
    teamName: 'Aces',
    played: 0,
    won: 0,
    lost: 0,
    singlesWon: 0,
    doublesWon: 0,
    ...overrides,
  };
}

/** A completed best-of-3 won 2-1 by side 1 (side ids 101 and 102); player 7 on side 1, player 8 on side 2. */
export function finishedMatch(overrides: Partial<MatchDetails> = {}): MatchDetails {
  return {
    id: 5,
    tournamentId: 1,
    sportFormatId: 1,
    sportFormatName: 'Singles',
    scoringRuleId: 2,
    matchNumber: 3,
    name: null,
    matchType: 'Regular',
    status: 'Completed',
    winnerSideId: 101,
    scheduledAt: null,
    startedAt: '2026-02-01T10:00:00',
    completedAt: '2026-02-01T10:30:00',
    sides: [
      { id: 101, sideNumber: 1, tournamentTeamId: 1, teamName: 'Aces', players: [{ playerId: 7, playerName: 'Ana', position: 1 }] },
      { id: 102, sideNumber: 2, tournamentTeamId: 2, teamName: 'Smashers', players: [{ playerId: 8, playerName: 'Ben', position: 1 }] },
    ],
    games: [
      { id: 1, gameNumber: 2, status: 'Completed', winnerSideId: 102, startedAt: null, completedAt: null, scores: [{ sideId: 101, score: 8 }, { sideId: 102, score: 11 }] },
      { id: 0, gameNumber: 1, status: 'Completed', winnerSideId: 101, startedAt: null, completedAt: null, scores: [{ sideId: 101, score: 11 }, { sideId: 102, score: 6 }] },
      { id: 2, gameNumber: 3, status: 'Completed', winnerSideId: 101, startedAt: null, completedAt: null, scores: [{ sideId: 101, score: 12 }, { sideId: 102, score: 10 }] },
    ],
    ...overrides,
  };
}
