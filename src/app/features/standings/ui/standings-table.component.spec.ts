import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { standing } from '../../../core/services/testing/fixtures';
import { StandingsTableComponent, signed } from './standings-table.component';

describe('StandingsTableComponent', () => {
  function render(highlight: number | null = null) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(StandingsTableComponent);
    fixture.componentRef.setInput('standings', [
      standing({ position: 1, teamName: 'Aces', played: 2, won: 2, matchPoints: 4, gameDifference: 3, pointDifference: -2 }),
      standing({ position: 2, teamName: 'Smashers', played: 2, lost: 2 }),
    ]);
    fixture.componentRef.setInput('highlightTeamId', highlight);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders rows in the order given, without re-sorting', () => {
    const rows = [...render().querySelectorAll('tbody tr')].map((tr) => tr.textContent);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('Aces');
    expect(rows[1]).toContain('Smashers');
  });

  it('shows signed differences and explains the ranking', () => {
    const element = render();

    expect(element.textContent).toContain('+3');
    expect(element.textContent).toContain('-2');
    expect(element.textContent).toContain('2 for a win');
  });

  it('highlights the requested team', () => {
    expect(render(2).querySelectorAll('tr.me')).toHaveLength(1);
  });

  it('formats differences', () => {
    expect(signed(4)).toBe('+4');
    expect(signed(0)).toBe('0');
    expect(signed(-1)).toBe('-1');
  });
});
