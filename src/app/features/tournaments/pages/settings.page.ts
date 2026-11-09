import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { MatchSettings, ScoringRule, Sport } from '../../../core/models/api.models';
import { SportsApi } from '../../../core/services/api/sports.api';
import { TournamentsApi } from '../../../core/services/api/tournaments.api';
import { ToastService } from '../../../core/services/toast.service';
import { AsyncState } from '../../../core/state/async-state';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { TournamentContext } from '../tournament-context.service';
import { canEditMatchSettings } from '../tournament-logic';

const SOURCE_LABELS = {
  Tournament: 'Set for this tournament',
  FormatDefault: 'Format default',
  None: 'Not set',
} as const;

export function describeRule(rule: ScoringRule): string {
  const games = rule.gamesToWin === 1 ? 'Single game' : `Best of ${rule.gamesToWin * 2 - 1}`;
  const cap = rule.maximumPoints ? `, capped at ${rule.maximumPoints}` : '';
  return `${rule.name}: ${games} to ${rule.pointsToWin}, win by ${rule.winBy}${cap}`;
}

@Component({
  selector: 'st-tournament-settings-page',
  imports: [ErrorStateComponent, SkeletonComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (settings.error() || sports.error(); as error) {
      <st-error-state [error]="error" (retry)="load()" />
    } @else if (settings.data(); as data) {
      <form class="card stack" (submit)="$event.preventDefault(); save()" aria-label="Match settings">
        <div>
          <h2>Scoring rules per match type</h2>
          <p class="muted small">
            New matches use the rule chosen here for their type. A match can still be created with a different rule.
          </p>
        </div>

        @if (!editable()) {
          <div class="notice notice--warning">
            <st-icon name="lock" />
            @if (!context.canManage()) {
              Only this tournament's organizer can change its match settings.
            } @else {
              This tournament has ended, so its match settings can no longer change.
            }
          </div>
        }

        <div class="stack">
          @for (format of data.formats; track format.sportFormatId) {
            <div class="field">
              <label class="field__label" [for]="'rule-' + format.sportFormatId">
                {{ format.formatName }}
                <span class="muted">({{ format.participantsPerSide === 1 ? 'one player' : format.participantsPerSide + ' players' }} per side)</span>
              </label>
              <select
                class="select"
                [id]="'rule-' + format.sportFormatId"
                [disabled]="!editable()"
                (change)="choose(format.sportFormatId, $any($event.target).value)"
              >
                <option value="" [selected]="choices()[format.sportFormatId] === undefined" disabled>Choose a rule</option>
                @for (rule of rules(); track rule.id) {
                  <option [value]="rule.id" [selected]="choices()[format.sportFormatId] === rule.id">
                    {{ describe(rule) }}
                  </option>
                }
              </select>
              <span class="field__hint">{{ sourceLabel(format.source) }}</span>
            </div>
          }
        </div>

        @if (editable()) {
          <div class="form-actions">
            <button type="submit" class="btn" [disabled]="saving() || !dirty()">
              <st-icon name="check" />{{ saving() ? 'Saving…' : 'Save settings' }}
            </button>
          </div>
        }
      </form>
    } @else {
      <div class="card" aria-busy="true"><st-skeleton [rows]="4" height="40px" /></div>
    }
  `,
})
export class SettingsPage {
  private readonly api = inject(TournamentsApi);
  private readonly sportsApi = inject(SportsApi);
  protected readonly context = inject(TournamentContext);
  private readonly toast = inject(ToastService);

  protected readonly settings = new AsyncState<MatchSettings>();
  protected readonly sports = new AsyncState<Sport[]>();
  protected readonly saving = signal(false);
  /** The organizer's selection per sport format id (initialised from the saved settings). */
  protected readonly choices = signal<Record<number, number | undefined>>({});
  private readonly saved = signal<Record<number, number | undefined>>({});

  protected readonly editable = computed(() => {
    const tournament = this.context.state.data();
    return tournament ? this.context.canManage() && canEditMatchSettings(tournament.status) : false;
  });

  protected readonly rules = computed<ScoringRule[]>(() => {
    const sportId = this.context.state.data()?.sportId;
    return this.sports.data()?.find((sport) => sport.id === sportId)?.scoringRules ?? [];
  });

  protected readonly dirty = computed(() => {
    const now = this.choices();
    const before = this.saved();
    return Object.keys(now).some((key) => now[Number(key)] !== before[Number(key)]);
  });

  constructor() {
    this.sports.load(this.sportsApi.getSports());
    effect(() => {
      if (this.context.id() !== null) {
        untracked(() => this.load());
      }
    });
  }

  protected load(): void {
    const id = this.context.id();
    if (id === null) {
      return;
    }
    this.settings.load(this.api.getMatchSettings(id), { keepData: false });
    this.sports.load(this.sportsApi.getSports());
  }

  protected describe = describeRule;

  protected sourceLabel(source: keyof typeof SOURCE_LABELS): string {
    return SOURCE_LABELS[source];
  }

  protected choose(sportFormatId: number, value: string): void {
    this.choices.update((current) => ({ ...current, [sportFormatId]: value ? Number(value) : undefined }));
  }

  protected save(): void {
    const id = this.context.id();
    const choices = this.choices();
    const settings = Object.entries(choices)
      .filter((entry): entry is [string, number] => entry[1] !== undefined)
      .map(([sportFormatId, scoringRuleId]) => ({ sportFormatId: Number(sportFormatId), scoringRuleId }));

    if (id === null || settings.length === 0 || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.api.configureMatchSettings(id, { settings }).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Match settings saved.');
        this.load();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.toast.fromError(error, 'Could not save match settings.');
      },
    });
  }

  /** Seeds the selection from the loaded settings. */
  private readonly seed = effect(() => {
    const data = this.settings.data();
    if (!data) {
      return;
    }
    const initial: Record<number, number | undefined> = {};
    for (const format of data.formats) {
      initial[format.sportFormatId] = format.scoringRuleId ?? undefined;
    }
    untracked(() => {
      this.choices.set(initial);
      this.saved.set(initial);
    });
  });
}
