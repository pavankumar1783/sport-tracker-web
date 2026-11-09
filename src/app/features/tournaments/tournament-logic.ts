import { Player, Team, Tournament } from '../../core/models/api.models';
import { TOURNAMENT_STATUSES, TournamentStatus } from '../../core/models/enums';

/** Pure rules shared by the tournament pages. The backend remains the authority; these only decide what to offer. */

export const LIFECYCLE_STEPS = ['Draft', 'Registration', 'Active', 'Completed'] as const satisfies readonly TournamentStatus[];

export type StepState = 'done' | 'current' | 'upcoming';

export function stepState(status: TournamentStatus, step: (typeof LIFECYCLE_STEPS)[number]): StepState {
  const current = LIFECYCLE_STEPS.indexOf(status as (typeof LIFECYCLE_STEPS)[number]);
  const index = LIFECYCLE_STEPS.indexOf(step);
  if (current === -1) {
    return 'upcoming';
  }
  return index < current ? 'done' : index === current ? 'current' : 'upcoming';
}

export type LifecycleActionKind = 'openRegistration' | 'start' | 'complete';

export interface LifecycleAction {
  kind: LifecycleActionKind;
  label: string;
  /** Why the action cannot be taken yet (the backend would refuse it). */
  blockedReason: string | null;
}

export interface LifecycleContext {
  stageCount: number;
  teamCount: number;
}

/** The single next lifecycle step available for a status (Draft -> Registration -> Active -> Completed). */
export function nextLifecycleAction(status: TournamentStatus, context: LifecycleContext): LifecycleAction | null {
  switch (status) {
    case 'Draft':
      return {
        kind: 'openRegistration',
        label: 'Open registration',
        blockedReason: context.stageCount === 0 ? 'Choose a format on the Stages tab before opening registration.' : null,
      };
    case 'Registration':
      return {
        kind: 'start',
        label: 'Start tournament',
        blockedReason: context.teamCount < 2 ? 'At least two teams must be registered to start.' : null,
      };
    case 'Active':
      return {
        kind: 'complete',
        label: 'Complete tournament',
        blockedReason: null,
      };
    default:
      return null;
  }
}

export const canConfigureFormat = (status: TournamentStatus, stageCount: number): boolean =>
  status === 'Draft' && stageCount === 0;

export const canRegisterTeams = (status: TournamentStatus): boolean => status === 'Registration';

export const canEditMatchSettings = (status: TournamentStatus): boolean =>
  status !== 'Completed' && status !== 'Cancelled';

export type StatusFilter = 'All' | TournamentStatus;
export const STATUS_FILTERS: readonly StatusFilter[] = ['All', ...TOURNAMENT_STATUSES];

/** `onlyIds`: when given, keep just those tournaments (the signed-in user's own). */
export function filterTournaments(
  tournaments: readonly Tournament[],
  search: string,
  status: StatusFilter,
  onlyIds: ReadonlySet<number> | null = null,
): Tournament[] {
  const needle = search.trim().toLowerCase();
  return tournaments.filter(
    (t) =>
      (onlyIds === null || onlyIds.has(t.id)) &&
      (status === 'All' || t.status === status) &&
      (needle === '' || t.name.toLowerCase().includes(needle) || t.sportName.toLowerCase().includes(needle)),
  );
}

export interface PoolPlayer {
  playerId: number;
  name: string;
}

/** Active players from `GET /api/players` (inactive players cannot join new rosters), sorted by name. */
export function playerPool(players: readonly Player[]): PoolPlayer[] {
  return players
    .filter((p) => p.isActive)
    .map((p) => ({ playerId: p.id, name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface PoolTeam {
  teamId: number;
  name: string;
  code: string | null;
}

/** Active teams from `GET /api/teams`, excluding those already registered in `current`. */
export function teamPool(teams: readonly Team[], current: Tournament | null): PoolTeam[] {
  const taken = new Set(current?.teams.map((t) => t.teamId) ?? []);
  return teams
    .filter((t) => t.isActive && !taken.has(t.id))
    .map((t) => ({ teamId: t.id, name: t.name, code: t.code }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Players already on a team in `tournament` cannot join another team there (Player.AlreadyInTeam). */
export function availablePlayers(pool: readonly PoolPlayer[], tournament: Tournament | null): PoolPlayer[] {
  const taken = new Set(tournament?.teams.flatMap((t) => t.players.map((p) => p.playerId)) ?? []);
  return pool.filter((p) => !taken.has(p.playerId));
}
