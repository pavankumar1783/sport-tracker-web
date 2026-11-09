import { Player, Team, Tournament, TournamentTeam } from '../../core/models/api.models';
import { TournamentStatus } from '../../core/models/enums';
import {
  availablePlayers,
  canConfigureFormat,
  canEditMatchSettings,
  canRegisterTeams,
  filterTournaments,
  nextLifecycleAction,
  playerPool,
  stepState,
  teamPool,
} from './tournament-logic';

function team(id: number, name: string, playerIds: number[]): TournamentTeam {
  return {
    tournamentTeamId: id * 10,
    teamId: id,
    teamName: name,
    teamCode: null,
    seed: null,
    status: 'Registered',
    players: playerIds.map((playerId, index) => ({
      playerId,
      name: `Player ${playerId}`,
      position: index + 1,
      joinedAt: '2026-01-01T00:00:00',
    })),
  };
}

function tournament(id: number, name: string, status: TournamentStatus, teams: TournamentTeam[] = []): Tournament {
  return {
    id,
    sportId: 1,
    sportName: 'Table Tennis',
    name,
    status,
    rosterSize: null,
    startDate: null,
    endDate: null,
    createdAt: '2026-01-01T00:00:00',
    organizerUserId: 1,
    teams,
  };
}

describe('nextLifecycleAction', () => {
  it('offers to open registration only once stages exist', () => {
    expect(nextLifecycleAction('Draft', { stageCount: 0, teamCount: 0 })?.blockedReason).toContain('format');
    expect(nextLifecycleAction('Draft', { stageCount: 1, teamCount: 0 })).toMatchObject({
      kind: 'openRegistration',
      blockedReason: null,
    });
  });

  it('needs two teams to start', () => {
    expect(nextLifecycleAction('Registration', { stageCount: 1, teamCount: 1 })?.blockedReason).toBeTruthy();
    expect(nextLifecycleAction('Registration', { stageCount: 1, teamCount: 2 })).toMatchObject({
      kind: 'start',
      blockedReason: null,
    });
  });

  it('completes an active tournament and offers nothing afterwards', () => {
    expect(nextLifecycleAction('Active', { stageCount: 1, teamCount: 4 })?.kind).toBe('complete');
    expect(nextLifecycleAction('Completed', { stageCount: 1, teamCount: 4 })).toBeNull();
    expect(nextLifecycleAction('Cancelled', { stageCount: 1, teamCount: 4 })).toBeNull();
  });
});

describe('stepState', () => {
  it('marks earlier steps done, the current step, and later steps upcoming', () => {
    expect(stepState('Registration', 'Draft')).toBe('done');
    expect(stepState('Registration', 'Registration')).toBe('current');
    expect(stepState('Registration', 'Active')).toBe('upcoming');
  });

  it('treats a cancelled tournament as having no progress', () => {
    expect(stepState('Cancelled', 'Draft')).toBe('upcoming');
  });
});

describe('status rules', () => {
  it('only allows format changes on an unconfigured draft', () => {
    expect(canConfigureFormat('Draft', 0)).toBe(true);
    expect(canConfigureFormat('Draft', 1)).toBe(false);
    expect(canConfigureFormat('Registration', 0)).toBe(false);
  });

  it('only registers teams during registration', () => {
    expect(canRegisterTeams('Registration')).toBe(true);
    expect(canRegisterTeams('Active')).toBe(false);
  });

  it('locks match settings once a tournament has ended', () => {
    expect(canEditMatchSettings('Active')).toBe(true);
    expect(canEditMatchSettings('Completed')).toBe(false);
    expect(canEditMatchSettings('Cancelled')).toBe(false);
  });
});

describe('filterTournaments', () => {
  const list = [
    tournament(1, 'Spring Cup', 'Active'),
    tournament(2, 'Autumn League', 'Completed'),
    tournament(3, 'Spring Doubles', 'Draft'),
  ];

  it('filters by status', () => {
    expect(filterTournaments(list, '', 'Completed').map((t) => t.id)).toEqual([2]);
    expect(filterTournaments(list, '', 'All')).toHaveLength(3);
  });

  it('searches names and sport case-insensitively', () => {
    expect(filterTournaments(list, '  spring ', 'All').map((t) => t.id)).toEqual([1, 3]);
    expect(filterTournaments(list, 'TABLE', 'All')).toHaveLength(3);
  });

  it('combines search and status', () => {
    expect(filterTournaments(list, 'spring', 'Draft').map((t) => t.id)).toEqual([3]);
  });

  it("keeps only the user's own tournaments when given their ids", () => {
    expect(filterTournaments(list, '', 'All', new Set([1, 3])).map((t) => t.id)).toEqual([1, 3]);
    expect(filterTournaments(list, '', 'All', new Set<number>())).toEqual([]);
    expect(filterTournaments(list, 'spring', 'All', new Set([1, 2])).map((t) => t.id)).toEqual([1]);
  });
});

describe('roster pools', () => {
  const current = tournament(2, 'Current', 'Registration', [team(1, 'Aces', [1, 2])]);
  const created = '2026-01-01T00:00:00';
  const players: Player[] = [
    { id: 3, name: 'Cara', isActive: true },
    { id: 1, name: 'Ana', isActive: true },
    { id: 2, name: 'Ben', isActive: true },
    { id: 4, name: 'Retired Rick', isActive: false },
  ];
  const teams: Team[] = [
    { id: 1, name: 'Aces', code: null, isActive: true, createdAt: created },
    { id: 2, name: 'Smashers', code: 'SM', isActive: true, createdAt: created },
    { id: 3, name: 'Old Guard', code: null, isActive: false, createdAt: created },
  ];

  it('lists active players sorted by name and drops retired ones', () => {
    expect(playerPool(players).map((p) => p.playerId)).toEqual([1, 2, 3]);
  });

  it('offers only active teams not yet in the current tournament', () => {
    expect(teamPool(teams, current).map((t) => t.teamId)).toEqual([2]);
    expect(teamPool(teams, null).map((t) => t.teamId)).toEqual([1, 2]);
  });

  it('hides players already registered in the current tournament', () => {
    const pool = playerPool(players);
    expect(availablePlayers(pool, current).map((p) => p.playerId)).toEqual([3]);
    expect(availablePlayers(pool, null)).toHaveLength(3);
  });
});
