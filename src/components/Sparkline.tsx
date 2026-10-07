import { addDays, knownReading } from '../evaluate.ts';
import type { Instrument, Point } from '../model.ts';
import { plotted } from '../series.ts';

/** A small line from a month before the decision to the chosen date, with the two readings that matter marked. */
export function Sparkline({ inst, points, anchor, asOf }: { inst: Instrument; points: Point[]; anchor: string; asOf: string }) {
  const W = 180;
  const H = 44;
  const from = addDays(anchor, -30);
  const line = plotted(inst, points, from, asOf);
  const base = knownReading(inst, points, anchor);
  const now = knownReading(inst, points, asOf);
  if (line.length < 2 || !base || !now) return <svg className="spark" width={W} height={H} aria-hidden="true" />;

  const values = [...line.map(([, v]) => v), base.value, now.value];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const t0 = Date.parse(from);
  const t1 = Date.parse(asOf);
  const x = (d: string) => ((Date.parse(d) - t0) / (t1 - t0 || 1)) * (W - 12) + 6;
  const y = (v: number) => 6 + (1 - (v - lo) / span) * (H - 12);
  const path = line.map(([d, v], i) => `${i ? 'L' : 'M'}${x(d).toFixed(1)},${y(v).toFixed(1)}`).join('');

  return (
    <svg className="spark" width={W} height={H} aria-hidden="true">
      <line className="spark-base" x1={x(anchor)} x2={W - 6} y1={y(base.value)} y2={y(base.value)} />
      <line className="spark-anchor" x1={x(anchor)} x2={x(anchor)} y1={4} y2={H - 4} />
      <path className="spark-line" d={path} />
      <circle className="spark-dot" cx={x(base.date)} cy={y(base.value)} r={3.5} />
      <circle className="spark-dot is-now" cx={x(now.date)} cy={y(now.value)} r={4} />
    </svg>
  );
}
