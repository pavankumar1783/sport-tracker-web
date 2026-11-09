import { MatchListItem } from '../../core/models/api.models';
import { TournamentMatches } from '../../core/services/insights.models';
import { toCardData } from '../../core/services/match-history';
import { MatchCardData } from '../../shared/components/match-card/match-card.component';

export interface DashboardMatch {
  tournamentName: string;
  card: MatchCardData;
}

export interface DashboardMatches {
  live: DashboardMatch[];
  upcoming: DashboardMatch[];
  recent: DashboardMatch[];
}

const LIMIT = 6;

interface Flat {
  tournamentId: number;
  tournamentName: string;
  match: MatchListItem;
}

/** Splits matches from several tournaments into live, upcoming and recent-result lists. */
export function buildDashboardMatches(lists: readonly TournamentMatches[]): DashboardMatches {
  const all: Flat[] = lists.flatMap((list) =>
    list.matches.map((match) => ({ tournamentId: list.tournamentId, tournamentName: list.tournamentName, match })),
  );

  const live = all
    .filter((x) => x.match.status === 'InProgress')
    .sort((a, b) => (b.match.startedAt ?? '').localeCompare(a.match.startedAt ?? ''));

  const upcoming = all.filter((x) => x.match.status === 'Scheduled').sort(byScheduled);

  const recent = all
    .filter((x) => x.match.status === 'Completed' || x.match.status === 'Walkover')
    .sort(
      (a, b) =>
        (b.match.completedAt ?? '').localeCompare(a.match.completedAt ?? '') || b.match.id - a.match.id,
    );

  return {
    live: live.slice(0, LIMIT).map(toEntry),
    upcoming: upcoming.slice(0, LIMIT).map(toEntry),
    recent: recent.slice(0, LIMIT).map(toEntry),
  };
}

/** Earliest scheduled time first; matches without a time come last, in match order. */
function byScheduled(a: Flat, b: Flat): number {
  const left = a.match.scheduledAt;
  const right = b.match.scheduledAt;
  if (left && right) {
    return left.localeCompare(right) || a.match.matchNumber - b.match.matchNumber;
  }
  if (left) return -1;
  if (right) return 1;
  return b.tournamentId - a.tournamentId || a.match.matchNumber - b.match.matchNumber;
}

function toEntry(flat: Flat): DashboardMatch {
  return { tournamentName: flat.tournamentName, card: toCardData(flat.tournamentId, flat.match) };
}
