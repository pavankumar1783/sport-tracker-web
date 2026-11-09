import { CreateMatchRequest } from '../../core/models/api.models';
import { MatchType } from '../../core/models/enums';

/**
 * UX-only checks for the create-match form. The backend owns the real rules
 * (Match.InvalidPlayerCount, Match.SameTeam, Match.PlayerNotInTeam, ...) and its message is shown
 * when it disagrees.
 */
export interface MatchDraft {
  stageId: number | null;
  matchType: MatchType;
  name: string;
  team1Id: number | null;
  team2Id: number | null;
  players1: readonly number[];
  players2: readonly number[];
  sportFormatId: number | null;
  scoringRuleId: number | null;
  /** Value of a `datetime-local` input (local wall-clock time, e.g. "2026-11-05T18:30"), or empty. */
  scheduledAt?: string;
}

/**
 * Converts a `datetime-local` value, which has no zone and means the person's local time, to a UTC
 * ISO string for the API. Empty or unparsable input yields null.
 */
export function localDateTimeToUtcIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** The format the backend infers when none is given: 1 player per side is singles, 2 is doubles. */
export function inferredFormat(playersPerSide: number): 'Singles' | 'Doubles' | null {
  if (playersPerSide === 1) return 'Singles';
  if (playersPerSide === 2) return 'Doubles';
  return null;
}

export function draftProblems(draft: MatchDraft): string[] {
  const problems: string[] = [];

  if (draft.stageId === null) problems.push('Choose a stage.');
  if (draft.team1Id === null || draft.team2Id === null) {
    problems.push('Choose a team for each side.');
  } else if (draft.team1Id === draft.team2Id) {
    problems.push('A team cannot play against itself.');
  }

  const count1 = draft.players1.length;
  const count2 = draft.players2.length;
  if (count1 === 0 || count2 === 0) {
    problems.push('Pick the players for each side.');
  } else if (count1 !== count2) {
    problems.push('Both sides need the same number of players.');
  } else if (draft.sportFormatId === null && inferredFormat(count1) === null) {
    problems.push('Pick 1 player per side for singles or 2 for doubles.');
  }

  if (draft.players1.some((id) => draft.players2.includes(id))) {
    problems.push('A player cannot be on both sides.');
  }
  return problems;
}

export function buildCreateMatchRequest(draft: MatchDraft): CreateMatchRequest {
  if (draftProblems(draft).length > 0 || draft.stageId === null || draft.team1Id === null || draft.team2Id === null) {
    throw new Error('The match draft is incomplete.');
  }
  const name = draft.name.trim();
  return {
    tournamentStageId: draft.stageId,
    sportFormatId: draft.sportFormatId,
    scoringRuleId: draft.scoringRuleId,
    matchType: draft.matchType,
    name: name.length > 0 ? name : null,
    side1: { tournamentTeamId: draft.team1Id, playerIds: [...draft.players1] },
    side2: { tournamentTeamId: draft.team2Id, playerIds: [...draft.players2] },
    scheduledAt: localDateTimeToUtcIso(draft.scheduledAt),
  };
}
