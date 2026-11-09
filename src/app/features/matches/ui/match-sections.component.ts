import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ScoringRule } from '../../../core/models/api.models';
import { MatchCardComponent } from '../../../shared/components/match-card/match-card.component';
import { MatchEntry, groupMatches, toCardData } from '../match-utils';

/** Live / Scheduled / Finished sections of match cards. Empty sections are omitted. */
@Component({
  selector: 'st-match-sections',
  imports: [MatchCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (section of sections(); track section.key) {
      <section class="section" [attr.aria-label]="section.title">
        <h2 class="head">
          {{ section.title }}
          <span class="count badge" [class.badge--live]="section.key === 'live'">{{ section.entries.length }}</span>
        </h2>
        <div class="grid">
          @for (entry of section.entries; track entry.tournamentId + '-' + entry.match.id) {
            <div class="item">
              @if (showTournament() && entry.tournamentName) {
                <span class="eyebrow tname truncate">{{ entry.tournamentName }}</span>
              }
              <st-match-card [match]="card(entry)" />
            </div>
          }
        </div>
      </section>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    .item {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }
    .tname {
      padding: 0 2px;
    }
  `,
})
export class MatchSectionsComponent {
  readonly entries = input.required<readonly MatchEntry[]>();
  readonly showTournament = input(false);
  readonly showTeamNames = input(true);
  readonly rules = input<readonly ScoringRule[]>([]);

  protected readonly sections = computed(() => {
    const groups = groupMatches(this.entries());
    return [
      { key: 'live', title: 'Live now', entries: groups.live },
      { key: 'scheduled', title: 'Upcoming', entries: groups.scheduled },
      { key: 'finished', title: 'Results', entries: groups.finished },
    ].filter((s) => s.entries.length > 0);
  });

  protected card(entry: MatchEntry) {
    return toCardData(entry, this.showTeamNames(), this.rules());
  }
}
