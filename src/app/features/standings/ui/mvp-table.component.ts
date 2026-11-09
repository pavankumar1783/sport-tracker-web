import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MvpItem } from '../../../core/models/api.models';
import { formatWinRate, winRate } from '../../../core/services/roster';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';

/** Player leaderboard in the order the API returns it (wins, then fewer losses, then name). */
@Component({
  selector: 'st-mvp-table',
  imports: [RouterLink, AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="table-wrap wide">
      <table class="table">
        <caption class="sr-only">Player leaderboard</caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Player</th>
            <th scope="col">Team</th>
            <th scope="col" class="right" title="Matches played">P</th>
            <th scope="col" class="right" title="Matches won">W</th>
            <th scope="col" class="right" title="Matches lost">L</th>
            <th scope="col" class="right" title="Win rate">Win %</th>
            <th scope="col" class="right" title="Singles matches won">Singles W</th>
            <th scope="col" class="right" title="Doubles matches won">Doubles W</th>
          </tr>
        </thead>
        <tbody>
          @for (row of players(); track row.playerId) {
            <tr [class.me]="row.playerId === highlightPlayerId()" [class.podium]="row.position <= 3">
              <td><span class="pos" [class.pos--first]="row.position === 1">{{ row.position }}</span></td>
              <td class="strong">
                <a class="who" [routerLink]="['/players', row.playerId]">
                  <st-avatar [name]="row.playerName" [size]="28" />{{ row.playerName }}
                </a>
              </td>
              <td>{{ row.teamName }}</td>
              <td class="right">{{ row.played }}</td>
              <td class="right strong">{{ row.won }}</td>
              <td class="right">{{ row.lost }}</td>
              <td class="right">{{ rate(row) }}</td>
              <td class="right">{{ row.singlesWon }}</td>
              <td class="right">{{ row.doublesWon }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    <ol class="cards list">
      @for (row of players(); track row.playerId) {
        <li [class.me]="row.playerId === highlightPlayerId()">
          <span class="pos" [class.pos--first]="row.position === 1">{{ row.position }}</span>
          <st-avatar [name]="row.playerName" [size]="36" />
          <div class="grow body">
            <a class="name truncate" [routerLink]="['/players', row.playerId]">{{ row.playerName }}</a>
            <span class="small muted truncate">{{ row.teamName }}</span>
            <span class="small muted">
              Singles {{ row.singlesWon }} · Doubles {{ row.doublesWon }} · Win {{ rate(row) }}
            </span>
          </div>
          <span class="record num"><b>{{ row.won }}</b>–{{ row.lost }}</span>
        </li>
      }
    </ol>
  `,
  styles: `
    :host {
      display: block;
    }
    .wide {
      display: none;
    }
    .body {
      display: flex;
      flex-direction: column;
    }
    .name {
      font-weight: 650;
      color: var(--c-text);
    }
    .record b {
      font-size: 1.0625rem;
    }
    .who {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: var(--c-text);
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
export class MvpTableComponent {
  readonly players = input.required<readonly MvpItem[]>();
  readonly highlightPlayerId = input<number | null>(null);

  protected rate(row: MvpItem): string {
    return formatWinRate(winRate(row.won, row.played));
  }
}
