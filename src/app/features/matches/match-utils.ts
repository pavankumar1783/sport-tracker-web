import { Game, MatchDetails, MatchListItem, MatchSide, ScoringRule } from '../../core/models/api.models';
import { MatchStatus } from '../../core/models/enums';
import { MatchCardData } from '../../shared/components/match-card/match-card.component';

/**
 * The API sends UTC timestamps without a zone suffix, which browsers would read as local time.
 * Marks them as UTC so DatePipe converts to the viewer's zone.
 */
export function asUtc(value: string | null): string | null {
  if (!value) return null;
  return /(Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`;
}

export type MatchGroup = 'live' | 'scheduled' | 'finished';

export function groupOf(status: MatchStatus): MatchGroup {
  switch (status) {
    case 'InProgress':
      return 'live';
    case 'Scheduled':
      return 'scheduled';
    default:
      return 'finished';
  }
}

/** A match together with the tournament it belongs to (match lists do not carry that). */
export interface MatchEntry {
  tournamentId: number;
  tournamentName: string | null;
  match: MatchListItem;
}

export interface MatchGroups {
  live: MatchEntry[];
  scheduled: MatchEntry[];
  finished: MatchEntry[];
}

/** Live and scheduled oldest first (play order); finished newest first. */
export function groupMatches(entries: readonly MatchEntry[]): MatchGroups {
  const groups: MatchGroups = { live: [], scheduled: [], finished: [] };
  for (const entry of entries) {
    groups[groupOf(entry.match.status)].push(entry);
  }
  const byNumber = (a: MatchEntry, b: MatchEntry) =>
    a.tournamentId - b.tournamentId || a.match.matchNumber - b.match.matchNumber;
  groups.live.sort(byNumber);
  const unscheduledLast = '9999';
  groups.scheduled.sort(
    (a, b) =>
      (a.match.scheduledAt ?? unscheduledLast).localeCompare(b.match.scheduledAt ?? unscheduledLast) ||
      byNumber(a, b),
  );
  groups.finished.sort(
    (a, b) => (b.match.completedAt ?? '').localeCompare(a.match.completedAt ?? '') || byNumber(b, a),
  );
  return groups;
}

/** Copies players, format and scoring rule from the match details onto the list item (the list omits them). */
export function withDetails(
  match: MatchListItem,
  details: Pick<MatchDetails, 'sides' | 'sportFormatName' | 'scoringRuleId'>,
): MatchListItem {
  return {
    ...match,
    sportFormatName: details.sportFormatName,
    scoringRuleId: details.scoringRuleId,
    sides: match.sides.map((side) => ({
      ...side,
      players: details.sides.find((d) => d.sideNumber === side.sideNumber)?.players ?? side.players,
    })),
  };
}

/** "Best of 3 to 11, win by 2, capped at 15" */
export function ruleSummary(rule: ScoringRule): string {
  const games = rule.gamesToWin === 1 ? 'Single game' : `Best of ${rule.gamesToWin * 2 - 1}`;
  const cap = rule.maximumPoints ? `, capped at ${rule.maximumPoints}` : '';
  return `${games} to ${rule.pointsToWin}, win by ${rule.winBy}${cap}`;
}

/** "Doubles · Best of 3 to 11, win by 2"; empty until the match details are known. */
export function formatLabel(match: MatchListItem, rules: readonly ScoringRule[]): string | undefined {
  if (!match.sportFormatName) return undefined;
  const rule = rules.find((r) => r.id === match.scoringRuleId);
  return rule ? `${match.sportFormatName} · ${ruleSummary(rule)}` : match.sportFormatName;
}

export function toCardData(entry: MatchEntry, showTeamNames = true, rules: readonly ScoringRule[] = []): MatchCardData {
  const { match, tournamentId } = entry;
  return {
    formatLabel: formatLabel(match, rules),
    tournamentId,
    id: match.id,
    matchNumber: match.matchNumber,
    name: match.name,
    matchType: match.matchType,
    status: match.status,
    winnerSideId: match.winnerSideId,
    scheduledAt: asUtc(match.scheduledAt),
    sides: match.sides.map((side) => ({
      ...side,
      displayName: side.players?.length
        ? sidePlayersLabel({ players: side.players, teamName: side.teamName }) + (showTeamNames ? ` (${side.teamName})` : '')
        : undefined,
    })),
  };
}

/** "Ana Silva / Bo Chen" for doubles, "Ana Silva" for singles; falls back to the team name. */
export function sidePlayersLabel(side: Pick<MatchSide, 'players' | 'teamName'>): string {
  const names = [...side.players].sort((a, b) => a.position - b.position).map((p) => p.playerName);
  return names.length > 0 ? names.join(' / ') : side.teamName;
}

export function scoreOf(game: Pick<Game, 'scores'>, sideId: number): number | null {
  return game.scores.find((s) => s.sideId === sideId)?.score ?? null;
}

export function isFinished(status: MatchStatus): boolean {
  return groupOf(status) === 'finished';
}
