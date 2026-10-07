// The whole domain: a decision rests on assumptions, an assumption is measured by
// instruments, an instrument produces readings. A decision can build on an earlier one.

export type Point = [date: string, value: number];

export interface SeriesFile {
  id: string;
  fetchedAt: string;
  requestUrl: string;
  points: Point[];
}

export type SeriesMap = Record<string, SeriesFile>;

/** ok = holds, warn = under pressure, breach = no longer holds, unmeasured = nothing measures it. */
export type Level = 'ok' | 'warn' | 'breach' | 'unmeasured';

export interface Source {
  title: string;
  url: string;
  published?: string;
}

export interface Decision {
  id: string;
  date: string;
  /** Revisions of the same decision share a thread and are drawn on one row. */
  thread: string;
  title: string;
  /** A few words for the marker on the timeline. */
  short: string;
  summary: string;
  /** Who decided, as the source states it. */
  by: string;
  /** The earlier version this one replaces. */
  revises?: string;
  /** Earlier decisions this one takes as given. `why` says whether the link is stated or our reading. */
  buildsOn?: { decision: string; why: string }[];
  /** Each assumption in the wording used at this decision (paraphrased, see sources). */
  restsOn: { assumption: string; wording: string }[];
  closed?: { date: string; note: string };
  /** A decision point that is still ahead. */
  planned?: boolean;
  sources: Source[];
}

export interface Assumption {
  id: string;
  title: string;
  /** What has to stay true. */
  claim: string;
  instruments: string[];
  /** Why nothing measures it yet, or what public data cannot see. */
  gap?: string;
}

/** Something an agent (or a person) found that may contradict an assumption. A person decides. */
export interface Finding {
  id: string;
  date: string;
  title: string;
  url?: string;
  note?: string;
  state: 'open' | 'confirmed' | 'dismissed';
}

/**
 * A news watch: an agent searches daily for news that would contradict the assumption and
 * files findings for a person to confirm or dismiss. Until it has run at least once, or a
 * person has filed a finding, it says nothing.
 */
export interface Watch {
  query: string;
  findings: Finding[];
  lastRun?: string;
}

export interface Instrument {
  id: string;
  title: string;
  measures: string;
  /** Present for a news watch; absent for a numeric series. */
  watch?: Watch;
  unit: string;
  /** How a value is printed: decimals and a short unit. */
  decimals: number;
  unitShort: string;
  source: { name: string; url: string };
  cadence: 'daily' | 'monthly';
  /** Trailing mean over this many days (daily series only). */
  smoothDays: number;
  /** Days from an observation to its publication. Approximate and on the cautious side. */
  lagDays: number;
  /**
   * percent: drift is the relative change since the decision.
   * points: drift is the plain difference, for series that are already an index and can fall to zero.
   */
  mode: 'percent' | 'points';
  /** Which direction of drift weakens the assumption. */
  badDirection: 'up' | 'down' | 'both';
  warn: number;
  breach: number;
  /** Where the thresholds come from. */
  why: string;
  /** What this instrument cannot see. */
  blindSpot: string;
}

export interface Ledger {
  company: string;
  /** The period the timeline shows. */
  timeline: { from: string; to: string };
  threads: { id: string; title: string }[];
  decisions: Decision[];
  assumptions: Assumption[];
  instruments: Instrument[];
}
