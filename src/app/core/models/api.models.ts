import {
  GameStatus,
  MatchStatus,
  MatchType,
  StageStatus,
  StageType,
  TournamentFormat,
  TournamentStatus,
  TournamentTeamStatus,
} from './enums';

/* Application-facing models. They mirror the backend result records field for field; the only
   change is that enum fields are always the string name (see core/services/api/mappers.ts). */

// ---- Sports catalogue (GET /api/sports) ----

export interface ScoringRule {
  id: number;
  name: string;
  gamesToWin: number;
  pointsToWin: number;
  winBy: number;
  maximumPoints: number | null;
}

export interface SportFormat {
  id: number;
  name: string;
  code: string;
  participantsPerSide: number;
  defaultScoringRuleId: number | null;
}

export interface Sport {
  id: number;
  name: string;
  code: string;
  formats: SportFormat[];
  scoringRules: ScoringRule[];
}

// ---- Tournaments ----

/** A rostered player. The API no longer returns emails in public responses. */
export interface TournamentPlayer {
  playerId: number;
  name: string;
  position: number;
  joinedAt: string;
}

export interface TournamentTeam {
  tournamentTeamId: number;
  teamId: number;
  teamName: string;
  teamCode: string | null;
  seed: number | null;
  status: TournamentTeamStatus;
  players: TournamentPlayer[];
}

/** GET /api/tournaments/{id} */
export interface Tournament {
  id: number;
  sportId: number;
  sportName: string;
  name: string;
  status: TournamentStatus;
  rosterSize: number | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  /** User id of the tournament's organizer; null for tournaments created before accounts existed (only site admins manage those). */
  organizerUserId: number | null;
  teams: TournamentTeam[];
}

/** How the signed-in user relates to a tournament (`GET /api/tournaments?mine=true`). */
export type TournamentRole = 'Organizer' | 'Player';

/** Item of GET /api/tournaments (newest first). */
export interface TournamentListItem {
  id: number;
  sportId: number;
  sportName: string;
  name: string;
  status: TournamentStatus;
  rosterSize: number | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  organizerUserId: number | null;
  teamCount: number;
  /** Empty unless the list was requested with `mine=true`. */
  myRoles: TournamentRole[];
}

// ---- Sign-in (email one-time code) ----

export interface RequestOtpResult {
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

export interface VerifyOtpRequest {
  email: string;
  code: string;
  /** Required the first time an email signs in (registration). */
  name?: string;
}

export interface SignedInUser {
  id: number;
  name: string;
  email: string;
  /** Site-wide admin: may manage every tournament. */
  isOrganizer: boolean;
  isNewUser: boolean;
}

export interface VerifyOtpResult {
  accessToken: string;
  expiresAt: string;
  user: SignedInUser;
}

// ---- Players (registered users) and the team pool ----

/** `GET /api/players` (any signed-in user): no email. Every registered user has one player. */
export interface Player {
  id: number;
  name: string;
  isActive: boolean;
}

/** `GET /api/players/me`: the only response that carries an email. */
export interface MyProfile {
  userId: number;
  playerId: number;
  name: string;
  email: string;
  isOrganizer: boolean;
}

export interface UpdateTournamentTeamRequest {
  name: string;
  code: string | null;
}

export interface UpdateTournamentTeamResult {
  tournamentTeamId: number;
  teamId: number;
  name: string;
  code: string | null;
}

export interface Team {
  id: number;
  name: string;
  code: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface SaveTeamRequest {
  name: string;
  code: string | null;
}

export interface UpdateTeamRequest extends SaveTeamRequest {
  isActive: boolean;
}

export interface CreateTournamentRequest {
  sportId: number;
  name: string;
  rosterSize: number | null;
  startDate: string | null;
  endDate: string | null;
}

export interface TournamentSummary {
  id: number;
  name: string;
  status: TournamentStatus;
}

export interface RegisterTeamPlayerRequest {
  playerId: number;
  position: number;
}

export interface RegisterTeamRequest {
  teamId: number | null;
  teamName: string | null;
  teamCode: string | null;
  players: RegisterTeamPlayerRequest[];
}

export interface RegisterTeamResult {
  tournamentTeamId: number;
  tournamentId: number;
  teamId: number;
  teamName: string;
  status: TournamentTeamStatus;
  players: { playerId: number; playerName: string; position: number }[];
}

export interface ConfigureTournamentRequest {
  format: TournamentFormat;
  sportFormatId: number;
  groupCount: number | null;
  qualifiersPerGroup: number | null;
}

export interface ConfiguredStage {
  stageId: number;
  name: string;
  stageType: string;
  sequence: number;
}

export interface ConfigureTournamentResult {
  tournamentId: number;
  format: string;
  stages: ConfiguredStage[];
}

export interface TournamentStage {
  id: number;
  name: string;
  stageType: StageType;
  sequence: number;
  status: StageStatus;
}

export interface TournamentStages {
  tournamentId: number;
  tournamentName: string;
  stages: TournamentStage[];
}

export interface DashboardMatchSide {
  sideNumber: number;
  tournamentTeamId: number;
  teamName: string;
}

export interface DashboardMatch {
  id: number;
  matchNumber: number;
  name: string | null;
  matchType: MatchType;
  status: MatchStatus;
  winnerSideId: number | null;
  sides: DashboardMatchSide[];
}

export interface TournamentDashboard {
  tournamentId: number;
  tournamentName: string;
  status: TournamentStatus;
  rosterSize: number | null;
  startDate: string | null;
  endDate: string | null;
  teamCount: number;
  stageCount: number;
  matchCount: number;
  completedMatchCount: number;
  inProgressMatchCount: number;
  scheduledMatchCount: number;
  currentStage: TournamentStage | null;
  recentMatches: DashboardMatch[];
}

// ---- Match settings ----

export type MatchSettingSource = 'Tournament' | 'FormatDefault' | 'None';

export interface MatchSetting {
  sportFormatId: number;
  formatName: string;
  participantsPerSide: number;
  source: MatchSettingSource;
  scoringRuleId: number | null;
  scoringRuleName: string | null;
  gamesToWin: number | null;
  pointsToWin: number | null;
  winBy: number | null;
}

export interface MatchSettings {
  tournamentId: number;
  formats: MatchSetting[];
}

export interface ConfigureMatchSettingsRequest {
  settings: { sportFormatId: number; scoringRuleId: number }[];
}

// ---- Matches ----

export interface MatchSideSummary {
  sideId: number;
  sideNumber: number;
  tournamentTeamId: number;
  teamName: string;
  /** Not sent by the API yet; when present the matches page shows player names instead of the team name. */
  players?: MatchPlayer[];
}

/** Item of GET /api/tournaments/{id}/matches */
export interface MatchListItem {
  id: number;
  matchNumber: number;
  name: string | null;
  matchType: MatchType;
  status: MatchStatus;
  winnerSideId: number | null;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  sides: MatchSideSummary[];
  /** Not in the list response; filled in from the match details by the tournament matches page. */
  sportFormatName?: string;
  scoringRuleId?: number;
}

export interface MatchPlayer {
  playerId: number;
  playerName: string;
  position: number;
}

export interface MatchSide {
  id: number;
  sideNumber: number;
  tournamentTeamId: number;
  teamName: string;
  players: MatchPlayer[];
}

export interface GameScore {
  sideId: number;
  score: number;
}

export interface Game {
  id: number;
  gameNumber: number;
  status: GameStatus;
  winnerSideId: number | null;
  startedAt: string | null;
  completedAt: string | null;
  scores: GameScore[];
}

/** GET /api/tournaments/{id}/matches/{matchId} */
export interface MatchDetails {
  id: number;
  tournamentId: number;
  sportFormatId: number;
  sportFormatName: string;
  /** The rule this match is actually played under (use it to look the rule up in the sports catalogue). */
  scoringRuleId: number;
  matchNumber: number;
  name: string | null;
  matchType: MatchType;
  status: MatchStatus;
  winnerSideId: number | null;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  sides: MatchSide[];
  games: Game[];
}

export interface CreateMatchSideRequest {
  tournamentTeamId: number;
  playerIds: number[];
}

export interface CreateMatchRequest {
  tournamentStageId: number;
  sportFormatId: number | null;
  scoringRuleId: number | null;
  matchType: MatchType;
  name: string | null;
  side1: CreateMatchSideRequest;
  side2: CreateMatchSideRequest;
  /** Optional kick-off time, sent as an ISO string; the backend stores it as UTC. */
  scheduledAt?: string | null;
}

export interface CreateMatchResult {
  id: number;
  tournamentId: number;
  tournamentStageId: number | null;
  sportFormatId: number;
  scoringRuleId: number;
  matchNumber: number;
  name: string | null;
  matchType: MatchType;
  status: MatchStatus;
  scheduledAt: string | null;
}

export interface StartMatchResult {
  id: number;
  tournamentId: number;
  matchNumber: number;
  status: MatchStatus;
  startedAt: string | null;
}

export interface GameSummary {
  id: number;
  matchId: number;
  gameNumber: number;
  status: GameStatus;
  startedAt: string | null;
}

export interface RecordGameScoreRequest {
  side1Score: number;
  side2Score: number;
}

export interface RecordGameScoreResult {
  gameId: number;
  matchId: number;
  gameNumber: number;
  side1Score: number;
  side2Score: number;
  gameStatus: GameStatus;
  gameWinnerSideId: number | null;
  matchStatus: MatchStatus;
  matchWinnerSideId: number | null;
}

export interface MatchOutcome {
  id: number;
  tournamentId: number;
  status: MatchStatus;
  winnerSideId: number | null;
}

// ---- Standings and leaderboards ----

export interface StandingItem {
  position: number;
  tournamentTeamId: number;
  teamId: number;
  teamName: string;
  played: number;
  won: number;
  lost: number;
  matchPoints: number;
  gamesWon: number;
  gamesLost: number;
  gameDifference: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifference: number;
}

export interface TournamentStandings {
  tournamentId: number;
  tournamentName: string;
  standings: StandingItem[];
}

export interface MvpItem {
  position: number;
  playerId: number;
  playerName: string;
  tournamentTeamId: number;
  teamName: string;
  played: number;
  won: number;
  lost: number;
  singlesWon: number;
  doublesWon: number;
}

export interface TournamentMvp {
  tournamentId: number;
  tournamentName: string;
  players: MvpItem[];
}

export interface CompleteTournamentResult {
  id: number;
  name: string;
  status: TournamentStatus;
  endDate: string | null;
}
