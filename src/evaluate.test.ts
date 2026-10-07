import { describe, expect, it } from 'vitest';
import { addDays, assumptionState, decisionState, drift, events, knownReading, levelSpans, linksOf, revisedBy, standsUntil } from './evaluate.ts';
import type { Instrument, Ledger, Point, SeriesMap } from './model.ts';

function instrument(over: Partial<Instrument> & { id: string }): Instrument {
  return {
    title: over.id,
    measures: '',
    unit: '',
    decimals: 0,
    unitShort: '',
    source: { name: '', url: '' },
    cadence: 'daily',
    smoothDays: 1,
    lagDays: 0,
    mode: 'percent',
    badDirection: 'up',
    warn: 10,
    breach: 20,
    why: '',
    blindSpot: '',
    ...over,
  };
}

/** One value per day from `start`. */
function daily(start: string, values: number[]): Point[] {
  return values.map((v, i) => [addDays(start, i), v]);
}

function seriesOf(map: Record<string, Point[]>): SeriesMap {
  return Object.fromEntries(Object.entries(map).map(([id, points]) => [id, { id, fetchedAt: '', requestUrl: '', points }]));
}

describe('knownReading', () => {
  const points = daily('2026-01-01', [10, 20, 30, 40, 50]);

  it('leaves out observations that were not yet published', () => {
    const inst = instrument({ id: 'a', lagDays: 2 });
    // On 5 Jan, with a two-day lag, the newest published observation is 3 Jan.
    expect(knownReading(inst, points, '2026-01-05')).toEqual({ date: '2026-01-03', value: 30 });
    expect(knownReading(inst, points, '2026-01-02')).toBeNull();
  });

  it('averages the trailing window of a daily series', () => {
    const inst = instrument({ id: 'a', smoothDays: 3 });
    expect(knownReading(inst, points, '2026-01-05')).toEqual({ date: '2026-01-05', value: 40 });
  });

  it('does not smooth a monthly series', () => {
    const monthly: Point[] = [
      ['2026-01-31', 100],
      ['2026-02-28', 110],
    ];
    const inst = instrument({ id: 'a', cadence: 'monthly', smoothDays: 7, lagDays: 38 });
    expect(knownReading(inst, monthly, '2026-04-06')).toEqual({ date: '2026-01-31', value: 100 });
    expect(knownReading(inst, monthly, '2026-04-07')).toEqual({ date: '2026-02-28', value: 110 });
  });
});

describe('drift', () => {
  it('measures percent change from the decision date and grades it', () => {
    const inst = instrument({ id: 'a' });
    const points = daily('2026-01-01', [100, 105, 112, 125]);
    expect(drift(inst, points, '2026-01-01', '2026-01-02')?.level).toBe('ok');
    expect(drift(inst, points, '2026-01-01', '2026-01-03')?.level).toBe('warn');
    expect(drift(inst, points, '2026-01-01', '2026-01-04')).toMatchObject({ change: 25, level: 'breach' });
  });

  it('treats a rise as harmless when down is the bad direction', () => {
    const inst = instrument({ id: 'a', badDirection: 'down' });
    const points = daily('2026-01-01', [100, 150, 75]);
    expect(drift(inst, points, '2026-01-01', '2026-01-02')?.level).toBe('ok');
    expect(drift(inst, points, '2026-01-01', '2026-01-03')?.level).toBe('breach');
  });

  it('counts either direction when the assumption is "stays steady"', () => {
    const inst = instrument({ id: 'a', badDirection: 'both' });
    const points = daily('2026-01-01', [100, 88, 112]);
    expect(drift(inst, points, '2026-01-01', '2026-01-02')?.level).toBe('warn');
    expect(drift(inst, points, '2026-01-01', '2026-01-03')?.level).toBe('warn');
  });

  it('uses the plain difference for an index that can fall to zero', () => {
    const inst = instrument({ id: 'a', mode: 'points', badDirection: 'down', warn: 30, breach: 60 });
    const points = daily('2026-01-01', [3, 2]);
    // From 3 to 2 is a third in relative terms but only one point: not a signal.
    expect(drift(inst, points, '2026-01-01', '2026-01-02')).toMatchObject({ change: -1, level: 'ok' });
  });
});

const ledger: Ledger = {
  company: 'Test',
  timeline: { from: '2026-01-01', to: '2026-02-01' },
  threads: [],
  instruments: [instrument({ id: 'i1' }), instrument({ id: 'i2' }), instrument({ id: 'i3' })],
  assumptions: [
    { id: 'three', title: 'three', claim: '', instruments: ['i1', 'i2', 'i3'] },
    { id: 'one', title: 'one', claim: '', instruments: ['i1'] },
    { id: 'none', title: 'none', claim: '', instruments: [] },
  ],
  decisions: [
    { id: 'first', date: '2026-01-01', thread: 't', title: '', short: '', summary: '', by: '', restsOn: [{ assumption: 'three', wording: '' }], sources: [] },
    {
      id: 'child',
      date: '2026-01-01',
      thread: 'c',
      title: '',
      short: '',
      summary: '',
      by: '',
      restsOn: [],
      buildsOn: [{ decision: 'first', why: '' }],
      closed: { date: '2026-01-06', note: '' },
      sources: [],
    },
    { id: 'second', date: '2026-01-04', thread: 't', revises: 'first', title: '', short: '', summary: '', by: '', restsOn: [{ assumption: 'three', wording: '' }], sources: [] },
    { id: 'blind', date: '2026-01-01', thread: 'b', title: '', short: '', summary: '', by: '', restsOn: [{ assumption: 'none', wording: '' }], sources: [] },
  ],
};

// i1 breaches on day 2, i2 on day 3, i3 never moves.
const series = seriesOf({
  i1: daily('2026-01-01', [100, 130, 130, 130, 130, 130]),
  i2: daily('2026-01-01', [100, 100, 130, 130, 130, 130]),
  i3: daily('2026-01-01', [100, 100, 100, 100, 100, 100]),
});

describe('assumptionState', () => {
  const three = ledger.assumptions[0];

  it('needs two instruments to agree before an assumption counts as broken', () => {
    expect(assumptionState(three, ledger, series, '2026-01-01', '2026-01-01').level).toBe('ok');
    expect(assumptionState(three, ledger, series, '2026-01-01', '2026-01-02').level).toBe('warn');
    expect(assumptionState(three, ledger, series, '2026-01-01', '2026-01-03')).toMatchObject({ level: 'breach', breaches: 2 });
  });

  it('never calls a single-instrument assumption broken', () => {
    expect(assumptionState(ledger.assumptions[1], ledger, series, '2026-01-01', '2026-01-06').level).toBe('warn');
  });

  it('reports an assumption nobody measures as unmeasured', () => {
    expect(assumptionState(ledger.assumptions[2], ledger, series, '2026-01-01', '2026-01-06').level).toBe('unmeasured');
  });
});

describe('decisionState', () => {
  const [first, child, second, blind] = ledger.decisions;

  it('measures each decision from its own date', () => {
    // By 6 Jan the first version is broken, but nothing has moved since the second was made on 4 Jan.
    expect(decisionState(first, ledger, series, '2026-01-06').level).toBe('breach');
    expect(decisionState(second, ledger, series, '2026-01-06').level).toBe('ok');
  });

  it('passes the state of a decision on to whatever builds on it, even after it is revised', () => {
    const state = decisionState(child, ledger, series, '2026-01-06');
    expect(state.level).toBe('breach');
    expect(state.inherited[0].revisedBy?.id).toBe('second');
  });

  it('stays unmeasured when nothing under it is measured', () => {
    expect(decisionState(blind, ledger, series, '2026-01-06').level).toBe('unmeasured');
  });

  it('knows when a decision was replaced or closed', () => {
    expect(revisedBy(first, ledger, '2026-01-03')).toBeNull();
    expect(standsUntil(first, ledger, '2026-01-06')).toBe('2026-01-04');
    expect(standsUntil(child, ledger, '2026-01-10')).toBe('2026-01-06');
    expect(standsUntil(second, ledger, '2026-01-06')).toBe('2026-01-06');
  });

  it('merges the daily levels into spans', () => {
    expect(levelSpans(first, ledger, series, '2026-01-01', '2026-01-04')).toEqual([
      { from: '2026-01-01', to: '2026-01-01', level: 'ok' },
      { from: '2026-01-02', to: '2026-01-02', level: 'warn' },
      { from: '2026-01-03', to: '2026-01-04', level: 'breach' },
    ]);
  });

  it('lists inherited assumptions with the date they were stated', () => {
    expect(linksOf(child, ledger)).toMatchObject([{ assumption: { id: 'three' }, anchor: '2026-01-01', via: { id: 'first' } }]);
    expect(linksOf(second, ledger)).toMatchObject([{ anchor: '2026-01-04', via: null }]);
  });
});

describe('news watch', () => {
  const watch = (findings: Instrument['watch'] extends infer W ? (W extends { findings: infer F } ? F : never) : never, lastRun?: string) =>
    instrument({ id: 'w', watch: { query: '', findings, lastRun } });

  it('says nothing until it has run or someone has filed a finding', () => {
    expect(drift(watch([]), [], '2026-01-01', '2026-01-10')).toBeNull();
    expect(drift(watch([], '2026-01-05'), [], '2026-01-01', '2026-01-10')?.level).toBe('ok');
  });

  it('treats an open finding as a warning and a confirmed one as a breach, and forgets dismissed ones', () => {
    const open = [{ id: 'f1', date: '2026-01-03', title: '', state: 'open' as const }];
    expect(drift(watch(open), [], '2026-01-01', '2026-01-10')).toMatchObject({ level: 'warn', change: 1 });
    const confirmed = [{ ...open[0], state: 'confirmed' as const }];
    expect(drift(watch(confirmed), [], '2026-01-01', '2026-01-10')?.level).toBe('breach');
    const dismissed = [{ ...open[0], state: 'dismissed' as const }];
    expect(drift(watch(dismissed, '2026-01-05'), [], '2026-01-01', '2026-01-10')).toMatchObject({ level: 'ok', change: 0 });
  });

  it('only counts findings made after the decision and by the chosen date', () => {
    const findings = [
      { id: 'before', date: '2025-12-31', title: '', state: 'confirmed' as const },
      { id: 'later', date: '2026-01-20', title: '', state: 'confirmed' as const },
    ];
    expect(drift(watch(findings, '2026-01-02'), [], '2026-01-01', '2026-01-10')?.level).toBe('ok');
  });
});

describe('events', () => {
  it('lists decisions, level changes and closings, newest first', () => {
    const list = events(ledger, series, '2026-01-06');
    expect(list.map((e) => `${e.date} ${e.decision.id} ${e.kind} ${e.level}`)).toEqual([
      '2026-01-06 child closed breach',
      '2026-01-04 second decided ok',
      '2026-01-03 first changed breach',
      '2026-01-03 child changed breach',
      '2026-01-02 first changed warn',
      '2026-01-02 child changed warn',
      '2026-01-01 first decided ok',
      '2026-01-01 child decided ok',
      '2026-01-01 blind decided unmeasured',
    ]);
  });
});

