import { MvpItem, Tournament, TournamentPlayer } from '../models/api.models';
import { TournamentStatus, TournamentTeamStatus } from '../models/enums';

/*
 * Per-tournament participation (which tournaments a team or player appeared in, with what roster)
 * is derived from the rosters returned by GET /api/tournaments/{id}. `teamId` identifies a Team
 * across tournaments and `playerId` identifies a Player. The team and player pools themselves
 * (names, codes, active flags) come from /api/teams and /api/players; for guests, who cannot read
 * /api/players, the derived list is the only player list.
 */

export interface TeamAppearance {
  tournamentId: number;
  tournamentName: string;
  tournamentStatus: TournamentStatus;
  tournamentTeamId: number;
  seed: number | null;
  status: TournamentTeamStatus;
  players: TournamentPlayer[];
}

export interface TeamEntry {
  teamId: number;
  name: string;
  code: string | null;
  /** Most recent tournament first. */
  appearances: TeamAppearance[];
  playerCount: number;
}

export interface PlayerAppearance {
  tournamentId: number;
  tournamentName: string;
  tournamentTeamId: number;
  teamId: number;
  teamName: string;
  position: number;
}

export interface PlayerEntry {
  playerId: number;
  name: string;
  /** Most recent tournament first. */
  appearances: PlayerAppearance[];
  teams: { teamId: number; teamName: string }[];
}

export function deriveTeams(tournaments: readonly Tournament[]): TeamEntry[] {
  const byTeam = new Map<number, TeamEntry>();

  for (const tournament of [...tournaments].sort((a, b) => b.id - a.id)) {
    for (const team of tournament.teams) {
      let entry = byTeam.get(team.teamId);
      if (!entry) {
        // Newest tournament is visited first, so its name and code win.
        entry = { teamId: team.teamId, name: team.teamName, code: team.teamCode, appearances: [], playerCount: 0 };
        byTeam.set(team.teamId, entry);
      }
      entry.appearances.push({
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        tournamentStatus: tournament.status,
        tournamentTeamId: team.tournamentTeamId,
        seed: team.seed,
        status: team.status,
        players: [...team.players].sort((a, b) => a.position - b.position),
      });
    }
  }

  return [...byTeam.values()]
    .map((entry) => ({
      ...entry,
      playerCount: new Set(entry.appearances.flatMap((a) => a.players.map((p) => p.playerId))).size,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function derivePlayers(tournaments: readonly Tournament[]): PlayerEntry[] {
  const byPlayer = new Map<number, PlayerEntry>();

  for (const tournament of [...tournaments].sort((a, b) => b.id - a.id)) {
    for (const team of tournament.teams) {
      for (const player of team.players) {
        let entry = byPlayer.get(player.playerId);
        if (!entry) {
          entry = { playerId: player.playerId, name: player.name, appearances: [], teams: [] };
          byPlayer.set(player.playerId, entry);
        }
        entry.appearances.push({
          tournamentId: tournament.id,
          tournamentName: tournament.name,
          tournamentTeamId: team.tournamentTeamId,
          teamId: team.teamId,
          teamName: team.teamName,
          position: player.position,
        });
        if (!entry.teams.some((t) => t.teamId === team.teamId)) {
          entry.teams.push({ teamId: team.teamId, teamName: team.teamName });
        }
      }
    }
  }

  return [...byPlayer.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export interface PlayerTotals {
  played: number;
  won: number;
  lost: number;
  singlesWon: number;
  doublesWon: number;
  winRate: number | null;
}

/** Adds up a player's MVP rows from several tournaments. */
export function aggregateMvp(items: readonly MvpItem[]): PlayerTotals {
  const totals = items.reduce(
    (sum, item) => ({
      played: sum.played + item.played,
      won: sum.won + item.won,
      lost: sum.lost + item.lost,
      singlesWon: sum.singlesWon + item.singlesWon,
      doublesWon: sum.doublesWon + item.doublesWon,
    }),
    { played: 0, won: 0, lost: 0, singlesWon: 0, doublesWon: 0 },
  );
  return { ...totals, winRate: winRate(totals.won, totals.played) };
}

export function winRate(won: number, played: number): number | null {
  return played > 0 ? won / played : null;
}

export function formatWinRate(rate: number | null): string {
  return rate === null ? '–' : `${Math.round(rate * 100)}%`;
}

/** Case-insensitive "contains" across any number of fields; an empty query matches everything. */
export function matchesQuery(query: string, ...values: (string | null | undefined)[]): boolean {
  const needle = query.trim().toLowerCase();
  return needle === '' || values.some((value) => value?.toLowerCase().includes(needle));
}
