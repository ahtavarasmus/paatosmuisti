// Measures how much each instrument normally drifts, so thresholds are read off data
// instead of guessed. Run: npm run calibrate
//
// For every day in a calm reference period it asks: how far had the instrument moved,
// in its bad direction, over the 90 days before? 90 days is the gap between two
// quarterly reports, which is how often the outlook is reconsidered.

import { readFile } from 'node:fs/promises';
import { addDays, drift, knownReading } from '../src/evaluate.ts';
import type { Ledger, SeriesFile } from '../src/model.ts';

const REFERENCE_FROM = '2024-06-01';
const REFERENCE_TO = '2026-02-11'; // the day before the first 2026 decisions
const HORIZON_DAYS = 90;

const root = new URL('../data/', import.meta.url);
const ledger = JSON.parse(await readFile(new URL('ledger.json', root), 'utf8')) as Ledger;

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

console.log(`Reference period ${REFERENCE_FROM} to ${REFERENCE_TO}, drift over ${HORIZON_DAYS} days, bad direction positive\n`);
for (const inst of ledger.instruments) {
  if (inst.watch) continue; // a news watch has no series to calibrate
  const file = JSON.parse(await readFile(new URL(`series/${inst.id}.json`, root), 'utf8')) as SeriesFile;

  // Thresholds do not matter here: only the size of the drift is read.
  const probe = { ...inst, warn: Infinity, breach: Infinity };
  const drifts: number[] = [];
  for (let day = REFERENCE_FROM; day <= REFERENCE_TO; day = addDays(day, 1)) {
    const d = drift(probe, file.points, addDays(day, -HORIZON_DAYS), day);
    if (!d) continue;
    drifts.push(inst.badDirection === 'up' ? d.change : inst.badDirection === 'down' ? -d.change : Math.abs(d.change));
  }
  drifts.sort((a, b) => a - b);
  const unit = inst.mode === 'percent' ? '%' : ' points';
  const row = [50, 90, 95, 99].map((p) => `p${p} ${percentile(drifts, p).toFixed(1)}`).join('   ');
  console.log(`${inst.id.padEnd(17)} ${row}   max ${drifts.at(-1)!.toFixed(1)}${unit}   (n=${drifts.length})`);
  const latest = knownReading(inst, file.points, new Date().toISOString().slice(0, 10));
  console.log(`${''.padEnd(17)} latest known reading ${latest?.value.toFixed(2)} on ${latest?.date}; now set to warn ${inst.warn}, breach ${inst.breach}\n`);
}
