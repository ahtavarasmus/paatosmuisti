import { addDays, daysBetween } from './evaluate.ts';
import type { Instrument, Point } from './model.ts';

/** The line a chart draws: the same trailing mean the evaluation uses, at each observation. */
export function plotted(inst: Instrument, points: Point[], from: string, to: string): Point[] {
  if (inst.cadence === 'monthly' || inst.smoothDays <= 1) return points.filter(([d]) => d >= from && d <= to);
  const out: Point[] = [];
  let start = 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    sum += points[i][1];
    const windowFrom = addDays(points[i][0], -(inst.smoothDays - 1));
    while (points[start][0] < windowFrom) sum -= points[start++][1];
    if (points[i][0] >= from && points[i][0] <= to) out.push([points[i][0], sum / (i - start + 1)]);
  }
  return out;
}

/** The plotted value at a date, or null when the series has no observation near it. */
export function valueAt(inst: Instrument, line: Point[], date: string): number | null {
  let found: Point | null = null;
  for (const point of line) {
    if (point[0] > date) break;
    found = point;
  }
  if (!found || daysBetween(found[0], date) > (inst.cadence === 'monthly' ? 31 : 7)) return null;
  return found[1];
}
