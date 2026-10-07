// Pure evaluation: given the ledger, the fetched series and a date, say what holds.
// Nothing here reads the clock or the network, so any past date can be replayed.

import type { Assumption, Decision, Instrument, Ledger, Level, Point, SeriesMap, Watch } from './model.ts';

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export interface Reading {
  /** Date of the newest observation included. */
  date: string;
  value: number;
}

/** Index of the first point dated after `date`. */
function upperBound(points: Point[], date: string): number {
  let lo = 0;
  let hi = points.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid][0] <= date) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * The value a reader could have known on `asOf`: observations published later are left out,
 * so a replay never sees the future.
 */
export function knownReading(inst: Instrument, points: Point[], asOf: string): Reading | null {
  const last = upperBound(points, addDays(asOf, -inst.lagDays)) - 1;
  if (last < 0) return null;
  const [date, value] = points[last];
  if (inst.cadence === 'monthly' || inst.smoothDays <= 1) return { date, value };
  const from = addDays(date, -(inst.smoothDays - 1));
  let sum = 0;
  let n = 0;
  for (let i = last; i >= 0 && points[i][0] >= from; i--) {
    sum += points[i][1];
    n++;
  }
  return { date, value: sum / n };
}

export interface Drift {
  base: Reading;
  now: Reading;
  /** Percent or points, by the instrument's mode. Signed: positive means the value rose. */
  change: number;
  level: Level;
}

/** How far an instrument has moved since a decision was made, judged against its thresholds. */
export function drift(inst: Instrument, points: Point[], anchor: string, asOf: string): Drift | null {
  if (inst.watch) return watchDrift(inst.watch, anchor, asOf);
  const base = knownReading(inst, points, anchor);
  const now = knownReading(inst, points, asOf);
  if (!base || !now) return null;
  const change = inst.mode === 'percent' ? (now.value / base.value - 1) * 100 : now.value - base.value;
  const bad = inst.badDirection === 'up' ? change : inst.badDirection === 'down' ? -change : Math.abs(change);
  const level: Level = bad >= inst.breach ? 'breach' : bad >= inst.warn ? 'warn' : 'ok';
  return { base, now, change, level };
}

/**
 * A news watch is read by its findings since the decision: an open finding is a warning
 * until a person looks at it, a confirmed one counts as a breach, a dismissed one as nothing.
 * The value is the number of findings that still stand.
 */
function watchDrift(watch: Watch, anchor: string, asOf: string): Drift | null {
  const standing = watch.findings
    .filter((f) => f.date > anchor && f.date <= asOf && f.state !== 'dismissed')
    .sort((a, b) => a.date.localeCompare(b.date));
  const hasRun = watch.lastRun !== undefined && watch.lastRun <= asOf;
  if (!hasRun && standing.length === 0) return null;
  const level: Level = standing.some((f) => f.state === 'confirmed') ? 'breach' : standing.length > 0 ? 'warn' : 'ok';
  return { base: { date: anchor, value: 0 }, now: { date: standing.at(-1)?.date ?? asOf, value: standing.length }, change: standing.length, level };
}

const RANK: Record<Level, number> = { unmeasured: 0, ok: 1, warn: 2, breach: 3 };

export function worst(levels: Level[]): Level {
  return levels.reduce<Level>((a, b) => (RANK[b] > RANK[a] ? b : a), 'unmeasured');
}

export interface AssumptionState {
  assumption: Assumption;
  level: Level;
  readings: { instrument: Instrument; drift: Drift | null }[];
  breaches: number;
  warns: number;
}

/**
 * One instrument past its threshold puts an assumption under pressure. It takes two that
 * agree to call it broken: that is what the independent instruments are for.
 */
export function assumptionState(
  assumption: Assumption,
  ledger: Ledger,
  series: SeriesMap,
  anchor: string,
  asOf: string,
): AssumptionState {
  const readings = assumption.instruments.map((id) => {
    const instrument = ledger.instruments.find((i) => i.id === id)!;
    return { instrument, drift: drift(instrument, series[id]?.points ?? [], anchor, asOf) };
  });
  const measured = readings.filter((r) => r.drift);
  const breaches = measured.filter((r) => r.drift!.level === 'breach').length;
  const warns = measured.filter((r) => r.drift!.level === 'warn').length;
  const level: Level =
    measured.length === 0 ? 'unmeasured' : breaches >= 2 ? 'breach' : breaches === 1 || warns > 0 ? 'warn' : 'ok';
  return { assumption, level, readings, breaches, warns };
}

export interface DecisionState {
  decision: Decision;
  level: Level;
  own: { wording: string; state: AssumptionState }[];
  /** What it inherits from decisions it builds on, each judged from its own date. */
  inherited: { why: string; state: DecisionState; revisedBy: Decision | null }[];
}

export function byId<T extends { id: string }>(items: T[], id: string): T {
  const found = items.find((item) => item.id === id);
  if (!found) throw new Error(`Unknown id: ${id}`);
  return found;
}

/** The version that had replaced this decision by `asOf`, if any. */
export function revisedBy(decision: Decision, ledger: Ledger, asOf: string): Decision | null {
  return ledger.decisions.find((d) => d.revises === decision.id && !d.planned && d.date <= asOf) ?? null;
}

/**
 * A decision is as healthy as the weakest assumption under it, or under anything it builds on.
 * Assumptions are measured from the date of the decision that stated them.
 */
export function decisionState(decision: Decision, ledger: Ledger, series: SeriesMap, asOf: string): DecisionState {
  const own = decision.restsOn.map(({ assumption, wording }) => ({
    wording,
    state: assumptionState(byId(ledger.assumptions, assumption), ledger, series, decision.date, asOf),
  }));
  const inherited = (decision.buildsOn ?? []).map(({ decision: id, why }) => {
    const parent = byId(ledger.decisions, id);
    return { why, state: decisionState(parent, ledger, series, asOf), revisedBy: revisedBy(parent, ledger, asOf) };
  });
  const level = worst([...own.map((o) => o.state.level), ...inherited.map((i) => i.state.level)]);
  return { decision, level, own, inherited };
}

export interface Span {
  from: string;
  to: string;
  level: Level;
}

/** A decision's level day by day between two dates, merged into spans of equal level. */
export function levelSpans(decision: Decision, ledger: Ledger, series: SeriesMap, from: string, to: string): Span[] {
  const spans: Span[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const level = decisionState(decision, ledger, series, day).level;
    const current = spans.at(-1);
    if (current && current.level === level) current.to = day;
    else spans.push({ from: day, to: day, level });
  }
  return spans;
}

/** The date until which a decision stands: its closing, its replacement, or still open. */
export function standsUntil(decision: Decision, ledger: Ledger, asOf: string): string {
  const replaced = revisedBy(decision, ledger, asOf)?.date;
  const closed = decision.closed && decision.closed.date <= asOf ? decision.closed.date : undefined;
  return [replaced, closed, asOf].filter((d): d is string => Boolean(d)).sort()[0];
}

export interface Link {
  assumption: Assumption;
  wording: string;
  /** The date the assumption was stated, which is where its instruments are measured from. */
  anchor: string;
  /** The earlier decision this link is inherited from, or null when the decision states it itself. */
  via: Decision | null;
}

/** Every assumption under a decision: its own first, then those of the decisions it builds on. */
export function linksOf(decision: Decision, ledger: Ledger): Link[] {
  const own: Link[] = decision.restsOn.map(({ assumption, wording }) => ({
    assumption: byId(ledger.assumptions, assumption),
    wording,
    anchor: decision.date,
    via: null,
  }));
  const inherited = (decision.buildsOn ?? []).flatMap(({ decision: id }) => {
    const parent = byId(ledger.decisions, id);
    return linksOf(parent, ledger).map((link) => ({ ...link, via: link.via ?? parent }));
  });
  return [...own, ...inherited];
}

/**
 * Whether there is anything to say about a decision on `asOf`: it had been made by then,
 * or it is a planned one whose basis had been.
 */
export function inPlay(decision: Decision, ledger: Ledger, asOf: string): boolean {
  if (!decision.planned) return decision.date <= asOf;
  return (decision.buildsOn ?? []).every((b) => byId(ledger.decisions, b.decision).date <= asOf);
}

export interface Event {
  date: string;
  decision: Decision;
  kind: 'decided' | 'changed' | 'closed' | 'ahead';
  level: Level;
}

/**
 * What happened, newest first: decisions made, closed or ahead, and every day a decision's
 * level changed. This is the inbox a board member would read.
 */
export function events(ledger: Ledger, series: SeriesMap, today: string): Event[] {
  const out: Event[] = [];
  for (const d of ledger.decisions) {
    if (d.planned) {
      out.push({ date: d.date, decision: d, kind: 'ahead', level: decisionState(d, ledger, series, today).level });
      continue;
    }
    if (d.date > today) continue;
    const spans = levelSpans(d, ledger, series, d.date, standsUntil(d, ledger, today));
    out.push({ date: d.date, decision: d, kind: 'decided', level: spans[0]?.level ?? 'unmeasured' });
    for (const span of spans.slice(1)) out.push({ date: span.from, decision: d, kind: 'changed', level: span.level });
    if (d.closed && d.closed.date <= today) out.push({ date: d.closed.date, decision: d, kind: 'closed', level: spans.at(-1)!.level });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * The day a version is judged at: the day before it was replaced, the day it was carried out,
 * or today while it still stands. A planned decision is judged today, on its basis.
 */
export function judgedAt(decision: Decision, ledger: Ledger, today: string): string {
  if (decision.planned) return today;
  const replaced = revisedBy(decision, ledger, today);
  return replaced ? addDays(replaced.date, -1) : standsUntil(decision, ledger, today);
}
