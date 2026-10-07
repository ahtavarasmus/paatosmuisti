// What this browser adds on top of the seed register: new decisions with their assumptions
// and instruments, and findings filed or judged on news watches. In the demo it lives in
// localStorage; in production this is the server's job.

import { useSyncExternalStore } from 'react';
import { ledger as seed } from './data.ts';
import type { Assumption, Decision, Finding, Instrument, Ledger } from './model.ts';

const KEY = 'paatosmuisti.v1';

export interface Additions {
  threads: { id: string; title: string }[];
  decisions: Decision[];
  assumptions: Assumption[];
  instruments: Instrument[];
  /** Findings filed here, by instrument id. */
  findings: Record<string, Finding[]>;
  /** Judgements on findings that came with the seed data, by finding id. */
  judgements: Record<string, Finding['state']>;
}

const EMPTY: Additions = { threads: [], decisions: [], assumptions: [], instruments: [], findings: {}, judgements: {} };

function load(): Additions {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Additions>) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

let current = load();
const listeners = new Set<() => void>();

function save(next: Additions): void {
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // A private window or blocked storage: the change still shows until the page is reloaded.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAdditions(): Additions {
  return useSyncExternalStore(subscribe, () => current);
}

export function hasAdditions(additions: Additions): boolean {
  return additions.decisions.length > 0 || Object.keys(additions.findings).length > 0 || Object.keys(additions.judgements).length > 0;
}

/** The register as the page sees it: the seed data plus this browser's additions. */
export function merge(additions: Additions): Ledger {
  const instruments = [...seed.instruments, ...additions.instruments].map((inst) => {
    if (!inst.watch) return inst;
    const own = inst.watch.findings.map((f) => (additions.judgements[f.id] ? { ...f, state: additions.judgements[f.id] } : f));
    return { ...inst, watch: { ...inst.watch, findings: [...own, ...(additions.findings[inst.id] ?? [])] } };
  });
  return {
    ...seed,
    threads: [...seed.threads, ...additions.threads],
    decisions: [...seed.decisions, ...additions.decisions],
    assumptions: [...seed.assumptions, ...additions.assumptions],
    instruments,
  };
}

export function addDecision(input: {
  thread: { id: string; title: string };
  decision: Decision;
  assumptions: Assumption[];
  instruments: Instrument[];
}): void {
  save({
    ...current,
    threads: [...current.threads, input.thread],
    decisions: [...current.decisions, input.decision],
    assumptions: [...current.assumptions, ...input.assumptions],
    instruments: [...current.instruments, ...input.instruments],
  });
}

export function addFinding(instrumentId: string, finding: Finding): void {
  save({ ...current, findings: { ...current.findings, [instrumentId]: [...(current.findings[instrumentId] ?? []), finding] } });
}

export function judgeFinding(instrumentId: string, findingId: string, state: Finding['state']): void {
  const own = current.findings[instrumentId];
  if (own?.some((f) => f.id === findingId)) {
    save({ ...current, findings: { ...current.findings, [instrumentId]: own.map((f) => (f.id === findingId ? { ...f, state } : f)) } });
  } else {
    save({ ...current, judgements: { ...current.judgements, [findingId]: state } });
  }
}

export function clearAdditions(): void {
  save(EMPTY);
}
