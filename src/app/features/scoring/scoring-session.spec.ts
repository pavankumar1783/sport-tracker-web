import { MatchSettings, Sport } from '../../core/models/api.models';
import {
  EMPTY_SESSION,
  GameSession,
  RuleHint,
  addPoint,
  bestOf,
  canSave,
  gamePointSide,
  gameWinner,
  gamesWon,
  loadSession,
  parseSession,
  resolveRuleHint,
  saveSession,
  serializeSession,
  sessionKey,
  undoPoint,
} from './scoring-session';

const to11: RuleHint = { gamesToWin: 2, pointsToWin: 11, winBy: 2, maximumPoints: null, source: 'Tournament setting' };
const capped: RuleHint = { ...to11, maximumPoints: 15 };
const single21: RuleHint = { gamesToWin: 1, pointsToWin: 21, winBy: 2, maximumPoints: null, source: 'Format default' };

function score(side1: number, side2: number): GameSession {
  return { side1, side2, history: [] };
}

function play(points: ('a' | 'b')[]): GameSession {
  return points.reduce((s, p) => addPoint(s, p === 'a' ? 1 : 2), EMPTY_SESSION);
}

describe('addPoint / undoPoint', () => {
  it('counts points per side and remembers order', () => {
    const s = play(['a', 'a', 'b']);
    expect(s).toEqual({ side1: 2, side2: 1, history: [1, 1, 2] });
  });

  it('does not mutate the previous session', () => {
    const before = addPoint(EMPTY_SESSION, 1);
    addPoint(before, 2);
    expect(before).toEqual({ side1: 1, side2: 0, history: [1] });
  });

  it('undo removes the last point of whichever side scored it', () => {
    const s = undoPoint(play(['a', 'b', 'b']));
    expect(s).toEqual({ side1: 1, side2: 1, history: [1, 2] });
  });

  it('undo can walk all the way back and then does nothing', () => {
    let s = play(['a', 'b']);
    s = undoPoint(undoPoint(s));
    expect(s).toEqual(EMPTY_SESSION);
    expect(undoPoint(s)).toBe(s);
  });
});

describe('gameWinner (table tennis, 11 points, win by 2)', () => {
  it('11-0 is a win for side 1', () => expect(gameWinner(score(11, 0), to11)).toBe(1));
  it('9-11 is a win for side 2', () => expect(gameWinner(score(9, 11), to11)).toBe(2));
  it('11-10 is not over', () => expect(gameWinner(score(11, 10), to11)).toBeNull());
  it('10-10 is not over', () => expect(gameWinner(score(10, 10), to11)).toBeNull());
  it('deuce finishes at 12-10', () => expect(gameWinner(score(12, 10), to11)).toBe(1));
  it('deuce finishes at 10-12', () => expect(gameWinner(score(10, 12), to11)).toBe(2));
  it('12-11 is not over', () => expect(gameWinner(score(12, 11), to11)).toBeNull());
  it('12-9 can never happen in play', () => expect(gameWinner(score(12, 9), to11)).toBeNull());
  it('a single game to 21 ends at 21-19', () => expect(gameWinner(score(21, 19), single21)).toBe(1));
  it('22-19 can never happen in play', () => expect(gameWinner(score(22, 19), single21)).toBeNull());
  it('20-20 is not over', () => expect(gameWinner(score(20, 20), single21)).toBeNull());

  it('respects a maximum points cap', () => {
    expect(gameWinner(score(15, 13), capped)).toBe(1);
    expect(gameWinner(score(16, 14), capped)).toBeNull();
  });
});

describe('gamePointSide', () => {
  it('is null at the start', () => expect(gamePointSide(EMPTY_SESSION, to11)).toBeNull());
  it('flags the side one point from winning', () => {
    expect(gamePointSide(score(10, 4), to11)).toBe(1);
    expect(gamePointSide(score(6, 10), to11)).toBe(2);
  });
  it('is null at 10-10 and flags the leader after 11-10', () => {
    expect(gamePointSide(score(10, 10), to11)).toBeNull();
    expect(gamePointSide(score(11, 10), to11)).toBe(1);
  });
  it('is null once the game is won', () => expect(gamePointSide(score(11, 4), to11)).toBeNull());
  it('works through a long deuce', () => {
    expect(gamePointSide(score(14, 13), to11)).toBe(1);
    expect(gamePointSide(score(14, 14), to11)).toBeNull();
  });
  it('a capped game is on game point when one more point still wins by two', () => {
    expect(gamePointSide(score(14, 13), capped)).toBe(1);
  });
});

describe('canSave and bestOf', () => {
  it('needs different scores', () => {
    expect(canSave(score(5, 5))).toBe(false);
    expect(canSave(score(0, 0))).toBe(false);
    expect(canSave(score(6, 5))).toBe(true);
  });

  it('computes best-of from games to win', () => {
    expect(bestOf({ gamesToWin: 1 })).toBe(1);
    expect(bestOf({ gamesToWin: 2 })).toBe(3);
    expect(bestOf({ gamesToWin: 3 })).toBe(5);
    expect(bestOf({ gamesToWin: 4 })).toBe(7);
  });
});

describe('gamesWon', () => {
  it('tallies only completed games by winner side id', () => {
    const games = [
      { status: 'Completed' as const, winnerSideId: 10 },
      { status: 'Completed' as const, winnerSideId: 11 },
      { status: 'Completed' as const, winnerSideId: 10 },
      { status: 'InProgress' as const, winnerSideId: null },
    ];
    expect(gamesWon(games, 10, 11)).toEqual({ side1: 2, side2: 1 });
  });
});

describe('persistence', () => {
  it('round-trips the point history', () => {
    const s = play(['a', 'b', 'b', 'a', 'a']);
    expect(parseSession(serializeSession(s))).toEqual(s);
  });

  it('rejects corrupt data', () => {
    expect(parseSession('not json')).toBeNull();
    expect(parseSession('{"h":"123"}')).toBeNull();
    expect(parseSession('{"h":5}')).toBeNull();
    expect(parseSession(null)).toBeNull();
  });

  it('saves, loads and clears through a storage object', () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    };
    const key = sessionKey(1, 2, 3);
    expect(key).toBe('sporttracker.scoring.1.2.3');

    saveSession(key, play(['a', 'a']), storage);
    expect(loadSession(key, storage)).toEqual({ side1: 2, side2: 0, history: [1, 1] });

    saveSession(key, EMPTY_SESSION, storage);
    expect(data.has(key)).toBe(false);
    expect(loadSession(key, storage)).toEqual(EMPTY_SESSION);
  });

  it('survives a storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    expect(() => saveSession('k', play(['a']), broken)).not.toThrow();
    expect(loadSession('k', broken)).toEqual(EMPTY_SESSION);
  });
});

describe('resolveRuleHint', () => {
  const settings: MatchSettings = {
    tournamentId: 1,
    formats: [
      {
        sportFormatId: 1,
        formatName: 'Singles',
        participantsPerSide: 1,
        source: 'Tournament',
        scoringRuleId: 7,
        scoringRuleName: 'Best of 3 to 11',
        gamesToWin: 2,
        pointsToWin: 11,
        winBy: 2,
      },
      {
        sportFormatId: 2,
        formatName: 'Doubles',
        participantsPerSide: 2,
        source: 'None',
        scoringRuleId: null,
        scoringRuleName: null,
        gamesToWin: null,
        pointsToWin: null,
        winBy: null,
      },
    ],
  };
  const sports: Sport[] = [
    {
      id: 1,
      name: 'Table tennis',
      code: 'TT',
      formats: [],
      scoringRules: [{ id: 7, name: 'Best of 3 to 11', gamesToWin: 2, pointsToWin: 11, winBy: 2, maximumPoints: 15 }],
    },
  ];

  const match = (scoringRuleId: number, sportFormatId = 1) => ({ scoringRuleId, sportFormatId });

  it("uses the match's own scoring rule from the catalogue first", () => {
    const override: Sport[] = [
      {
        ...sports[0],
        scoringRules: [
          ...sports[0].scoringRules,
          { id: 9, name: 'Single game to 21', gamesToWin: 1, pointsToWin: 21, winBy: 2, maximumPoints: null },
        ],
      },
    ];
    expect(resolveRuleHint(match(9), settings, override)).toEqual({
      gamesToWin: 1,
      pointsToWin: 21,
      winBy: 2,
      maximumPoints: null,
      source: 'match rule',
    });
  });

  it('falls back to the tournament setting when the rule id is not in the catalogue', () => {
    expect(resolveRuleHint(match(404), settings, sports)).toEqual({
      gamesToWin: 2,
      pointsToWin: 11,
      winBy: 2,
      maximumPoints: 15,
      source: 'Tournament setting',
    });
  });

  it('is null when nothing identifies a rule', () => {
    expect(resolveRuleHint(match(404, 2), settings, sports)).toBeNull();
    expect(resolveRuleHint(match(404, 99), settings, sports)).toBeNull();
    expect(resolveRuleHint(match(404), null, null)).toBeNull();
  });

  it('still returns the tournament hint when the catalogue is unavailable', () => {
    expect(resolveRuleHint(match(404), settings, null)?.maximumPoints).toBeNull();
  });
});
