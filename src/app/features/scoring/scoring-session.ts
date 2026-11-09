import { Game, MatchSettings, Sport } from '../../core/models/api.models';

/**
 * Pure live-scoring logic. The backend records one FINAL score per game, so the running point
 * count lives in the browser. Everything here that mirrors the scoring rule is a HINT for the
 * scorer (game point, "looks complete"); the backend remains the authority when the score is saved.
 */

export type SideNumber = 1 | 2;

export interface RuleHint {
  gamesToWin: number;
  pointsToWin: number;
  winBy: number;
  maximumPoints: number | null;
  /** Where the rule came from, shown to the scorer ("match rule", "Tournament setting", "Format default"). */
  source: string;
}

/** Points for the game being scored, plus the order they were scored in (for undo). */
export interface GameSession {
  side1: number;
  side2: number;
  history: readonly SideNumber[];
}

export const EMPTY_SESSION: GameSession = { side1: 0, side2: 0, history: [] };

export function addPoint(session: GameSession, side: SideNumber): GameSession {
  return {
    side1: session.side1 + (side === 1 ? 1 : 0),
    side2: session.side2 + (side === 2 ? 1 : 0),
    history: [...session.history, side],
  };
}

export function undoPoint(session: GameSession): GameSession {
  const last = session.history[session.history.length - 1];
  if (last === undefined) {
    return session;
  }
  return {
    side1: session.side1 - (last === 1 ? 1 : 0),
    side2: session.side2 - (last === 2 ? 1 : 0),
    history: session.history.slice(0, -1),
  };
}

/**
 * Which side has won the game under `rule`, or null. Same shape as the backend check: the target
 * is reached, the lead is at least `winBy`, the maximum is not exceeded, and past the target the
 * lead is exactly `winBy` (12-10, 21-19; a 12-9 can never happen in play).
 */
export function gameWinner(session: Pick<GameSession, 'side1' | 'side2'>, rule: RuleHint): SideNumber | null {
  const { side1, side2 } = session;
  const high = Math.max(side1, side2);
  const low = Math.min(side1, side2);

  if (rule.pointsToWin <= 0 || rule.winBy <= 0 || high < rule.pointsToWin) return null;
  if (rule.maximumPoints !== null && high > rule.maximumPoints) return null;
  if (high - low < rule.winBy) return null;
  if (high > rule.pointsToWin && high - low !== rule.winBy) return null;

  return side1 > side2 ? 1 : 2;
}

/** The side that would win the game with the next point, or null when nobody is on game point. */
export function gamePointSide(session: GameSession, rule: RuleHint): SideNumber | null {
  if (gameWinner(session, rule) !== null) {
    return null;
  }
  for (const side of [1, 2] as const) {
    if (gameWinner(addPoint(session, side), rule) === side) {
      return side;
    }
  }
  return null;
}

/** Saving needs two different scores; whether it is a legal final score is the backend's call. */
export function canSave(session: GameSession): boolean {
  return session.side1 !== session.side2;
}

export function bestOf(rule: Pick<RuleHint, 'gamesToWin'>): number {
  return 2 * rule.gamesToWin - 1;
}

export function gamesWon(
  games: readonly Pick<Game, 'status' | 'winnerSideId'>[],
  side1Id: number,
  side2Id: number,
): { side1: number; side2: number } {
  let side1 = 0;
  let side2 = 0;
  for (const game of games) {
    if (game.status !== 'Completed') continue;
    if (game.winnerSideId === side1Id) side1++;
    else if (game.winnerSideId === side2Id) side2++;
  }
  return { side1, side2 };
}

/**
 * The scoring rule of a match: its own `scoringRuleId` looked up in the sports catalogue. Only
 * if that id is not in the catalogue does it fall back to the tournament's match setting for
 * the match's format (with `maximumPoints` filled in from the catalogue).
 */
export function resolveRuleHint(
  match: { scoringRuleId: number; sportFormatId: number },
  settings: MatchSettings | null,
  sports: readonly Sport[] | null,
): RuleHint | null {
  const own = sports?.flatMap((s) => s.scoringRules).find((r) => r.id === match.scoringRuleId);
  if (own) {
    return {
      gamesToWin: own.gamesToWin,
      pointsToWin: own.pointsToWin,
      winBy: own.winBy,
      maximumPoints: own.maximumPoints,
      source: 'match rule',
    };
  }
  return resolveTournamentDefault(settings, sports, match.sportFormatId);
}

function resolveTournamentDefault(
  settings: MatchSettings | null,
  sports: readonly Sport[] | null,
  sportFormatId: number,
): RuleHint | null {
  const setting = settings?.formats.find((f) => f.sportFormatId === sportFormatId);
  if (
    !setting ||
    setting.scoringRuleId === null ||
    setting.gamesToWin === null ||
    setting.pointsToWin === null ||
    setting.winBy === null
  ) {
    return null;
  }

  const rule = sports?.flatMap((s) => s.scoringRules).find((r) => r.id === setting.scoringRuleId);
  return {
    gamesToWin: setting.gamesToWin,
    pointsToWin: setting.pointsToWin,
    winBy: setting.winBy,
    maximumPoints: rule?.maximumPoints ?? null,
    source: setting.source === 'Tournament' ? 'Tournament setting' : 'Format default',
  };
}

// ---- Persistence (survives reloads and dropped connections mid-game) ----

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function sessionKey(tournamentId: number, matchId: number, gameId: number): string {
  return `sporttracker.scoring.${tournamentId}.${matchId}.${gameId}`;
}

export function serializeSession(session: GameSession): string {
  return JSON.stringify({ h: session.history.join('') });
}

/** Rebuilds a session from stored text. The point history is the source of truth; bad data yields null. */
export function parseSession(text: string | null): GameSession | null {
  if (!text) return null;
  try {
    const data: unknown = JSON.parse(text);
    const history = (data as { h?: unknown }).h;
    if (typeof history !== 'string' || !/^[12]*$/.test(history)) return null;
    return [...history].reduce<GameSession>((s, ch) => addPoint(s, ch === '1' ? 1 : 2), EMPTY_SESSION);
  } catch {
    return null;
  }
}

export function loadSession(key: string, storage: StorageLike | null = defaultStorage()): GameSession {
  try {
    return parseSession(storage?.getItem(key) ?? null) ?? EMPTY_SESSION;
  } catch {
    return EMPTY_SESSION;
  }
}

export function saveSession(key: string, session: GameSession, storage: StorageLike | null = defaultStorage()): void {
  try {
    if (session.history.length === 0) {
      storage?.removeItem(key);
    } else {
      storage?.setItem(key, serializeSession(session));
    }
  } catch {
    // Storage can be unavailable or full; scoring keeps working in memory.
  }
}

export function clearSession(key: string, storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.removeItem(key);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
