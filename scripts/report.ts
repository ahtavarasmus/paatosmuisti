// Prints the same state the page shows, as plain text. Run: npm run report [-- YYYY-MM-DD]
// Useful for checking a date by hand and as a log line in a scheduled run.

import { readFile } from 'node:fs/promises';
import { decisionState, inPlay, levelSpans, standsUntil } from '../src/evaluate.ts';
import type { Ledger, SeriesFile, SeriesMap } from '../src/model.ts';

const root = new URL('../data/', import.meta.url);
const ledger = JSON.parse(await readFile(new URL('ledger.json', root), 'utf8')) as Ledger;
const series: SeriesMap = {};
for (const inst of ledger.instruments) {
  if (inst.watch) continue; // a news watch has findings in the ledger, not a fetched series
  series[inst.id] = JSON.parse(await readFile(new URL(`series/${inst.id}.json`, root), 'utf8')) as SeriesFile;
}

const asOf = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const LABEL = { ok: 'holds', warn: 'under pressure', breach: 'does not hold', unmeasured: 'not measured' };

console.log(`State as of ${asOf}\n`);
for (const decision of ledger.decisions) {
  if (!inPlay(decision, ledger, asOf)) continue;
  const state = decisionState(decision, ledger, series, asOf);
  console.log(`${decision.date}  ${decision.title}  [${LABEL[state.level]}]`);
  for (const { state: a } of state.own) {
    console.log(`    ${a.assumption.title}: ${LABEL[a.level]}`);
    for (const { instrument, drift } of a.readings) {
      if (!drift) continue;
      const sign = drift.change >= 0 ? '+' : '';
      const unit = instrument.mode === 'percent' ? ' %' : ' points';
      console.log(
        `        ${instrument.id.padEnd(17)} ${drift.base.value.toFixed(1)} -> ${drift.now.value.toFixed(1)}  ` +
          `(${sign}${drift.change.toFixed(1)}${unit}, ${LABEL[drift.level]}, data to ${drift.now.date})`,
      );
    }
  }
  for (const inherited of state.inherited) {
    const revised = inherited.revisedBy ? `, revised ${inherited.revisedBy.date}` : '';
    console.log(`    builds on ${inherited.state.decision.date} ${inherited.state.decision.title}: ${LABEL[inherited.state.level]}${revised}`);
  }
  if (!decision.planned) {
    const until = standsUntil(decision, ledger, asOf);
    const spans = levelSpans(decision, ledger, series, decision.date, until);
    console.log(`    over time: ${spans.map((s) => `${s.from} ${LABEL[s.level]}`).join('  |  ')}  (until ${until})`);
  }
  console.log();
}
