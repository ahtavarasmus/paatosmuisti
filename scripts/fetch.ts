// Fetches every instrument's series from its public source and writes data/series/<id>.json.
// No API keys. Run: npm run fetch
//
// A source that fails keeps its previous file, so one outage never blanks the page.
// The script still exits non-zero so a scheduled run shows the failure.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type Point = [date: string, value: number];

interface SeriesFile {
  id: string;
  fetchedAt: string;
  requestUrl: string;
  points: Point[];
}

const SINCE = '2024-01-01';
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'series');

async function get(url: string, attempts = 3): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (res.ok) return res;
      lastError = new Error(`HTTP ${res.status} from ${url}`);
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
  }
  throw lastError;
}

function monthEnd(period: string): string {
  // "2026-06" -> "2026-06-30". A monthly value describes the whole month, so it is dated at its end.
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

function csvRows(text: string): Record<string, string>[] {
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const cols = head.split(',');
  return lines.map((line) => {
    const cells = line.split(',');
    return Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? '']));
  });
}

function addYears(date: string, years: number): string {
  return `${Number(date.slice(0, 4)) + years}${date.slice(4)}`;
}

/**
 * Ship traffic through a strait swings with the season (about 70 a day in winter, 100 in
 * summer), so a raw count cannot be compared across months. Each day is therefore expressed
 * as a percentage of the average for the same three weeks one year earlier.
 * From March 2027 the base year contains the 2026 closure and this needs a longer norm.
 */
function versusLastYear(daily: Point[]): Point[] {
  const byDate = new Map(daily);
  const out: Point[] = [];
  for (const [date, value] of daily) {
    const centre = new Date(`${addYears(date, -1)}T00:00:00Z`).getTime();
    let sum = 0;
    let n = 0;
    for (let offset = -10; offset <= 10; offset++) {
      const v = byDate.get(new Date(centre + offset * 86_400_000).toISOString().slice(0, 10));
      if (v !== undefined) {
        sum += v;
        n++;
      }
    }
    if (n >= 14 && sum > 0) out.push([date, Math.round((value / (sum / n)) * 1000) / 10]);
  }
  return out;
}

// IMF PortWatch: daily ship transits through a chokepoint, from satellite AIS tracking.
async function portWatchChokepoint(portid: string): Promise<{ url: string; points: Point[] }> {
  const rawSince = addYears(SINCE, -1); // one extra year, as the base for the comparison below
  const base =
    'https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query';
  const points: Point[] = [];
  const pageSize = 1000;
  let firstUrl = '';
  for (let offset = 0; ; offset += pageSize) {
    const params = new URLSearchParams({
      where: `portid='${portid}' AND date >= DATE '${rawSince}'`,
      outFields: 'date,n_total',
      orderByFields: 'date ASC',
      resultOffset: String(offset),
      resultRecordCount: String(pageSize),
      f: 'json',
    });
    const url = `${base}?${params}`;
    firstUrl ||= url;
    const body = (await (await get(url)).json()) as {
      features?: { attributes: { date: string | number; n_total: number } }[];
      exceededTransferLimit?: boolean;
      error?: { message: string };
    };
    if (body.error || !body.features) throw new Error(`PortWatch: ${body.error?.message ?? 'no features'}`);
    for (const f of body.features) {
      const d = f.attributes.date;
      const date = typeof d === 'number' ? new Date(d).toISOString().slice(0, 10) : d.slice(0, 10);
      points.push([date, f.attributes.n_total]);
    }
    if (!body.exceededTransferLimit && body.features.length < pageSize) break;
  }
  return { url: firstUrl, points: versusLastYear(points).filter(([date]) => date >= SINCE) };
}

// FRED graph download: daily Brent spot price as published by the U.S. EIA.
async function fredDaily(seriesId: string): Promise<{ url: string; points: Point[] }> {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}&cosd=${SINCE}`;
  const rows = csvRows(await (await get(url)).text());
  const points: Point[] = [];
  for (const row of rows) {
    const value = Number(row[seriesId]);
    if (row[seriesId] !== '' && Number.isFinite(value)) points.push([row.observation_date, value]);
  }
  return { url, points };
}

// Eurostat dissemination API (JSON-stat). The query must select exactly one series.
async function eurostatMonthly(dataset: string, filters: Record<string, string>): Promise<{ url: string; points: Point[] }> {
  const params = new URLSearchParams({ format: 'JSON', ...filters, sinceTimePeriod: SINCE.slice(0, 7) });
  const url = `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/${dataset}?${params}`;
  const body = (await (await get(url)).json()) as {
    id: string[];
    size: number[];
    value: Record<string, number>;
    dimension: Record<string, { category: { index: Record<string, number> } }>;
  };
  const others = body.size.slice(0, -1).reduce((a, b) => a * b, 1);
  if (body.id.at(-1) !== 'time' || others !== 1) throw new Error(`Eurostat ${dataset}: expected one series over time`);
  const points: Point[] = [];
  for (const [period, index] of Object.entries(body.dimension.time.category.index)) {
    const value = body.value[String(index)];
    if (typeof value === 'number') points.push([monthEnd(period), value]);
  }
  points.sort((a, b) => a[0].localeCompare(b[0]));
  return { url, points };
}

// ECB Data Portal: daily euro reference rate.
async function ecbRate(currency: string): Promise<{ url: string; points: Point[] }> {
  const url = `https://data-api.ecb.europa.eu/service/data/EXR/D.${currency}.EUR.SP00.A?startPeriod=${SINCE}&format=csvdata&detail=dataonly`;
  const rows = csvRows(await (await get(url)).text());
  const points: Point[] = rows.map((r) => [r.TIME_PERIOD, Number(r.OBS_VALUE)] as Point).filter((p) => Number.isFinite(p[1]));
  return { url, points };
}

const SOURCES: Record<string, () => Promise<{ url: string; points: Point[] }>> = {
  hormuz: () => portWatchChokepoint('chokepoint6'),
  brent: () => fredDaily('DCOILBRENTEU'),
  'ppi-chemicals': () => eurostatMonthly('sts_inpp_m', { geo: 'EU27_2020', nace_r2: 'C20', unit: 'I21' }),
  'paper-production': () => eurostatMonthly('sts_inpr_m', { geo: 'EU27_2020', nace_r2: 'C17', unit: 'I21', s_adj: 'SCA' }),
  eurusd: () => ecbRate('USD'),
};

await mkdir(OUT_DIR, { recursive: true });
let failed = 0;
for (const [id, load] of Object.entries(SOURCES)) {
  try {
    const { url, points } = await load();
    if (points.length < 12) throw new Error(`only ${points.length} points`);
    const file: SeriesFile = { id, fetchedAt: new Date().toISOString(), requestUrl: url, points };
    await writeFile(join(OUT_DIR, `${id}.json`), JSON.stringify(file) + '\n');
    const [lastDate, lastValue] = points.at(-1)!;
    console.log(`ok    ${id.padEnd(17)} ${String(points.length).padStart(4)} points, latest ${lastDate} = ${lastValue}`);
  } catch (err) {
    failed++;
    console.error(`FAIL  ${id.padEnd(17)} ${err instanceof Error ? err.message : err} (previous file kept)`);
  }
}
process.exit(failed ? 1 : 0);
