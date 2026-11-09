import { Observable, map } from 'rxjs';
import {
  CompleteTournamentResult,
  CreateMatchResult,
  DashboardMatch,
  Game,
  GameSummary,
  MatchDetails,
  MatchListItem,
  MatchOutcome,
  RecordGameScoreResult,
  RegisterTeamResult,
  StartMatchResult,
  Tournament,
  TournamentDashboard,
  TournamentListItem,
  TournamentStage,
  TournamentStages,
  TournamentSummary,
  TournamentTeam,
} from '../../models/api.models';
import {
  GAME_STATUSES,
  MATCH_STATUSES,
  MATCH_TYPES,
  STAGE_STATUSES,
  STAGE_TYPES,
  TOURNAMENT_STATUSES,
  TOURNAMENT_TEAM_STATUSES,
  WireEnum,
  parseEnum,
} from '../../models/enums';

/** `T` with the enum fields `K` as they arrive on the wire (number or name). */
type Wire<T, K extends keyof T> = Omit<T, K> & { [P in K]: WireEnum };

/** The raw (wire) input type of a mapper function. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WireOf<F extends (raw: any) => unknown> = Parameters<F>[0];

/** The `Result<T>` envelope some endpoints return instead of the bare value. */
export interface ResultEnvelope<T> {
  isSuccess: boolean;
  isFailure: boolean;
  errors: { code: string; message: string }[];
  value: T | null;
}

/** Unwraps a `Result<T>` envelope. Failures never reach here (the API answers 4xx with ProblemDetails). */
export function unwrap<T>() {
  return (source: Observable<ResultEnvelope<T>>): Observable<T> =>
    source.pipe(
      map((envelope) => {
        if (envelope.value === null || envelope.value === undefined) {
          throw new Error('The API returned an empty result.');
        }
        return envelope.value;
      }),
    );
}

type WireTournamentTeam = Wire<TournamentTeam, 'status'>;
type WireTournament = Omit<Wire<Tournament, 'status'>, 'teams'> & { teams: WireTournamentTeam[] };

export function mapTournamentTeam(raw: WireTournamentTeam): TournamentTeam {
  return { ...raw, status: parseEnum(TOURNAMENT_TEAM_STATUSES, raw.status) };
}

export function mapTournament(raw: WireTournament): Tournament {
  return {
    ...raw,
    status: parseEnum(TOURNAMENT_STATUSES, raw.status),
    teams: raw.teams.map(mapTournamentTeam),
  };
}

export function mapTournamentListItem(raw: Wire<TournamentListItem, 'status'>): TournamentListItem {
  return { ...raw, status: parseEnum(TOURNAMENT_STATUSES, raw.status) };
}

export function mapTournamentSummary(raw: Wire<TournamentSummary, 'status'>): TournamentSummary {
  return { ...raw, status: parseEnum(TOURNAMENT_STATUSES, raw.status) };
}

export function mapCompleteTournament(raw: Wire<CompleteTournamentResult, 'status'>): CompleteTournamentResult {
  return { ...raw, status: parseEnum(TOURNAMENT_STATUSES, raw.status) };
}

export function mapRegisterTeam(raw: Wire<RegisterTeamResult, 'status'>): RegisterTeamResult {
  return { ...raw, status: parseEnum(TOURNAMENT_TEAM_STATUSES, raw.status) };
}

export function mapStage(raw: Wire<TournamentStage, 'stageType' | 'status'>): TournamentStage {
  return {
    ...raw,
    stageType: parseEnum(STAGE_TYPES, raw.stageType),
    status: parseEnum(STAGE_STATUSES, raw.status),
  };
}

export function mapStages(
  raw: Omit<TournamentStages, 'stages'> & { stages: Wire<TournamentStage, 'stageType' | 'status'>[] },
): TournamentStages {
  return { ...raw, stages: raw.stages.map(mapStage) };
}

type WireDashboardMatch = Wire<DashboardMatch, 'matchType' | 'status'>;

function mapDashboardMatch(raw: WireDashboardMatch): DashboardMatch {
  return {
    ...raw,
    matchType: parseEnum(MATCH_TYPES, raw.matchType),
    status: parseEnum(MATCH_STATUSES, raw.status),
  };
}

export function mapDashboard(
  raw: Omit<Wire<TournamentDashboard, 'status'>, 'currentStage' | 'recentMatches'> & {
    currentStage: Wire<TournamentStage, 'stageType' | 'status'> | null;
    recentMatches: WireDashboardMatch[];
  },
): TournamentDashboard {
  return {
    ...raw,
    status: parseEnum(TOURNAMENT_STATUSES, raw.status),
    currentStage: raw.currentStage ? mapStage(raw.currentStage) : null,
    recentMatches: raw.recentMatches.map(mapDashboardMatch),
  };
}

export function mapMatchListItem(raw: Wire<MatchListItem, 'matchType' | 'status'>): MatchListItem {
  return {
    ...raw,
    matchType: parseEnum(MATCH_TYPES, raw.matchType),
    status: parseEnum(MATCH_STATUSES, raw.status),
  };
}

type WireGame = Wire<Game, 'status'>;

export function mapGame(raw: WireGame): Game {
  return { ...raw, status: parseEnum(GAME_STATUSES, raw.status) };
}

export function mapMatchDetails(
  raw: Omit<Wire<MatchDetails, 'matchType' | 'status'>, 'games'> & { games: WireGame[] },
): MatchDetails {
  return {
    ...raw,
    matchType: parseEnum(MATCH_TYPES, raw.matchType),
    status: parseEnum(MATCH_STATUSES, raw.status),
    games: raw.games.map(mapGame),
  };
}

export function mapCreateMatch(raw: Wire<CreateMatchResult, 'matchType' | 'status'>): CreateMatchResult {
  return {
    ...raw,
    matchType: parseEnum(MATCH_TYPES, raw.matchType),
    status: parseEnum(MATCH_STATUSES, raw.status),
  };
}

export function mapStartMatch(raw: Wire<StartMatchResult, 'status'>): StartMatchResult {
  return { ...raw, status: parseEnum(MATCH_STATUSES, raw.status) };
}

export function mapGameSummary(raw: Wire<GameSummary, 'status'>): GameSummary {
  return { ...raw, status: parseEnum(GAME_STATUSES, raw.status) };
}

export function mapScoreResult(
  raw: Wire<RecordGameScoreResult, 'gameStatus' | 'matchStatus'>,
): RecordGameScoreResult {
  return {
    ...raw,
    gameStatus: parseEnum(GAME_STATUSES, raw.gameStatus),
    matchStatus: parseEnum(MATCH_STATUSES, raw.matchStatus),
  };
}

/** Walkover and cancel results: `winnerSideId` is absent on cancel. */
export function mapOutcome(raw: Wire<Omit<MatchOutcome, 'winnerSideId'> & { winnerSideId?: number }, 'status'>): MatchOutcome {
  return {
    id: raw.id,
    tournamentId: raw.tournamentId,
    status: parseEnum(MATCH_STATUSES, raw.status),
    winnerSideId: raw.winnerSideId ?? null,
  };
}
