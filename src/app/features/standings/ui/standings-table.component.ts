import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StandingItem } from '../../../core/models/api.models';

export function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

/**
 * Team standings exactly as the API ranks them (2 match points per win, then game difference,
 * then point difference). A table from 640px, stacked cards on phones. Never re-sorts.
 */
@Component({
  selector: 'st-standings-table',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="table-wrap wide">
      <table class="table">
        <caption class="sr-only">Team standings</caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Team</th>
            <th scope="col" class="right" title="Matches played">P</th>
            <th scope="col" class="right" title="Matches won">W</th>
            <th scope="col" class="right" title="Matches lost">L</th>
            <th scope="col" class="right" title="Match points">Pts</th>
            <th scope="col" class="right" title="Games won">GW</th>
            <th scope="col" class="right" title="Games lost">GL</th>
            <th scope="col" class="right" title="Game difference">GD</th>
            <th scope="col" class="right" title="Points for">PF</th>
            <th scope="col" class="right" title="Points against">PA</th>
            <th scope="col" class="right" title="Point difference">PD</th>
          </tr>
        </thead>
        <tbody>
          @for (row of standings(); track row.tournamentTeamId) {
            <tr [class.me]="row.tournamentTeamId === highlightTeamId()" [class.podium]="row.position <= 3">
              <td><span class="pos" [class.pos--first]="row.position === 1">{{ row.position }}</span></td>
              <td class="strong"><a [routerLink]="['/teams', row.teamId]">{{ row.teamName }}</a></td>
              <td class="right">{{ row.played }}</td>
              <td class="right">{{ row.won }}</td>
              <td class="right">{{ row.lost }}</td>
              <td class="right strong">{{ row.matchPoints }}</td>
              <td class="right">{{ row.gamesWon }}</td>
              <td class="right">{{ row.gamesLost }}</td>
              <td class="right">{{ signed(row.gameDifference) }}</td>
              <td class="right">{{ row.pointsFor }}</td>
              <td class="right">{{ row.pointsAgainst }}</td>
              <td class="right">{{ signed(row.pointDifference) }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    <ol class="cards list">
      @for (row of standings(); track row.tournamentTeamId) {
        <li [class.me]="row.tournamentTeamId === highlightTeamId()">
          <span class="pos" [class.pos--first]="row.position === 1">{{ row.position }}</span>
          <div class="grow body">
            <div class="row row--between row--nowrap">
              <a class="name truncate" [routerLink]="['/teams', row.teamId]">{{ row.teamName }}</a>
              <span class="pts num"><b>{{ row.matchPoints }}</b> pts</span>
            </div>
            <div class="small muted">
              Played {{ row.played }} · Won {{ row.won }} · Lost {{ row.lost }}
            </div>
            <div class="small muted">
              Games {{ row.gamesWon }}–{{ row.gamesLost }} ({{ signed(row.gameDifference) }}) · Points
              {{ row.pointsFor }}–{{ row.pointsAgainst }} ({{ signed(row.pointDifference) }})
            </div>
          </div>
        </li>
      }
    </ol>

    <p class="rule small muted">
      Ranked by match points (2 for a win), then game difference, then point difference.
    </p>
  `,
  styles: `
    :host {
      display: block;
    }
    .wide {
      display: none;
    }
    .cards {
      display: block;
    }
    .cards li {
      align-items: flex-start;
    }
    .body {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .name {
      font-weight: 650;
      color: var(--c-text);
    }
    .pts b {
      font-size: 1.0625rem;
    }
    .pos {
      display: inline-grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--c-surface-2);
      border: 1px solid var(--c-border);
      font-weight: 700;
      font-size: 0.8125rem;
      flex: none;
    }
    .pos--first {
      background: var(--c-accent);
      border-color: transparent;
      color: #fff;
    }
    tr.podium td {
      background: color-mix(in srgb, var(--c-primary-soft) 45%, transparent);
    }
    tr.me td,
    li.me {
      box-shadow: inset 3px 0 0 var(--c-primary);
      background: var(--c-primary-soft);
    }
    td a {
      color: var(--c-text);
    }
    .rule {
      padding: 10px 16px 14px;
    }
    @media (min-width: 640px) {
      .wide {
        display: block;
      }
      .cards {
        display: none;
      }
    }
  `,
})
export class StandingsTableComponent {
  readonly standings = input.required<readonly StandingItem[]>();
  /** `tournamentTeamId` of a row to highlight (for example the team being viewed). */
  readonly highlightTeamId = input<number | null>(null);

  protected readonly signed = signed;
}
