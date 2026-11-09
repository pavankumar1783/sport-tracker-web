/**
 * Backend enums, in the exact declaration order of SportTracker.Domain/Enums/Enums.cs.
 * The API serialises enums as numbers (their index here) but some DTOs carry the name as a
 * string, so every wire value goes through `parseEnum`.
 */
export const TOURNAMENT_STATUSES = ['Draft', 'Registration', 'Active', 'Completed', 'Cancelled'] as const;
export const TOURNAMENT_TEAM_STATUSES = ['Registered', 'Active', 'Eliminated', 'Withdrawn'] as const;
export const STAGE_TYPES = ['Custom', 'RoundRobin', 'Groups', 'Knockout'] as const;
export const MATCH_TYPES = [
  'Regular',
  'Playoff',
  'QuarterFinal',
  'SemiFinal',
  'Final',
  'ThirdPlace',
  'Custom',
] as const;
export const MATCH_STATUSES = ['Scheduled', 'InProgress', 'Completed', 'Cancelled', 'Walkover'] as const;
export const GAME_STATUSES = ['NotStarted', 'InProgress', 'Completed'] as const;
export const STAGE_STATUSES = ['NotStarted', 'InProgress', 'Completed'] as const;
export const TOURNAMENT_FORMATS = ['Custom', 'RoundRobin', 'Knockout', 'GroupsWithKnockout'] as const;

export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];
export type TournamentTeamStatus = (typeof TOURNAMENT_TEAM_STATUSES)[number];
export type StageType = (typeof STAGE_TYPES)[number];
export type MatchType = (typeof MATCH_TYPES)[number];
export type MatchStatus = (typeof MATCH_STATUSES)[number];
export type GameStatus = (typeof GAME_STATUSES)[number];
export type StageStatus = (typeof STAGE_STATUSES)[number];
export type TournamentFormat = (typeof TOURNAMENT_FORMATS)[number];

export type WireEnum = number | string;

export function parseEnum<const T extends readonly string[]>(names: T, value: WireEnum): T[number] {
  if (typeof value === 'number') {
    const name = names[value];
    if (name !== undefined) {
      return name;
    }
  } else if ((names as readonly string[]).includes(value)) {
    return value as T[number];
  }
  throw new Error(`Unexpected enum value "${value}" (expected one of ${names.join(', ')})`);
}

export function enumIndex<const T extends readonly string[]>(names: T, value: T[number]): number {
  return names.indexOf(value);
}

/** "InProgress" -> "In progress" */
export function humanizeEnum(value: string): string {
  const spaced = value.replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}
