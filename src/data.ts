import ledgerJson from '../data/ledger.json';
import type { Ledger, SeriesFile, SeriesMap } from './model.ts';

/** The curated register: decisions, assumptions and instrument definitions. */
export const ledger = ledgerJson as unknown as Ledger;

const files = import.meta.glob<SeriesFile>('../data/series/*.json', { eager: true, import: 'default' });

/** The fetched readings, one file per instrument (see scripts/fetch.ts). */
export const series: SeriesMap = Object.fromEntries(Object.values(files).map((file) => [file.id, file]));

/** When the stalest series was fetched. */
export const fetchedAt = Object.values(series)
  .map((s) => s.fetchedAt)
  .sort()[0];
