import { addDays, daysBetween } from '../evaluate.ts';
import type { Event } from '../evaluate.ts';
import { fiDate, fiDay } from '../format.ts';
import type { Decision } from '../model.ts';
import { StatusIcon } from './StatusIcon.tsx';

export interface Stop {
  id: string;
  date: string;
  label: string;
  planned?: boolean;
  current?: boolean;
}

/** The points on a decision's life worth labelling: each version, and the day it was carried out. */
export function stopsFor(versions: Decision[], shownId: string): Stop[] {
  return versions
    .flatMap((v) => [
      { id: v.id, date: v.date, label: v.short, planned: v.planned, current: v.id === shownId },
      ...(v.closed ? [{ id: `${v.id}-closed`, date: v.closed.date, label: 'toteutettu' }] : []),
    ])
    .sort((a, b) => a.date.localeCompare(b.date));
}

const THUMB = 18; // px, matches the range input's thumb in styles.css

/**
 * The one control on the page: a day. Everything is shown with what was known on that day, and
 * the pane shows the version of the chosen decision that was in force then. The versions sit on
 * the track as labels; the thumb moves freely between them and cannot pass today.
 */
export function TimeSlider({
  from,
  today,
  asOf,
  setAsOf,
  versions,
  shown,
  marks,
}: {
  from: string;
  today: string;
  asOf: string;
  setAsOf: (date: string) => void;
  versions: Decision[];
  shown: Decision;
  marks: Event[];
}) {
  const stops = stopsFor(versions, shown.id);
  const end = stops.reduce((latest, s) => (s.date > latest ? s.date : latest), today);
  const total = Math.max(1, daysBetween(from, end));
  const todayValue = daysBetween(from, today);
  const at = (date: string) => `calc(${THUMB / 2}px + ${Math.min(Math.max(daysBetween(from, date) / total, 0), 1)} * (100% - ${THUMB}px))`;
  const changes = marks.filter((m) => m.kind === 'changed' && m.date <= today && versions.some((v) => v.id === m.decision.id));
  const shownText = shown.date > asOf ? `Versio ${fiDate(shown.date)} ei ollut vielä voimassa.` : `Näkyvissä versio ${fiDay(shown.date)} ${shown.short}.`;

  return (
    <section className="asof">
      <div className="asof-head">
        <span className="eyebrow">Tilanne</span>
        <strong>{fiDate(asOf)}</strong>
        <span className="asof-hint">
          {shownText} {asOf === today ? 'Vedä taaksepäin nähdäksesi, mitä silloin tiedettiin.' : ''}
        </span>
        {asOf !== today && (
          <button className="small" onClick={() => setAsOf(today)}>
            Tänään
          </button>
        )}
      </div>
      <div className="asof-track">
        <div className="asof-marks" aria-hidden="true">
          {changes.map((m, i) => (
            <span key={`${m.decision.id}-${m.date}-${i}`} className="asof-mark" style={{ left: at(m.date) }} title={`${fiDate(m.date)} ${m.decision.title}`}>
              <StatusIcon level={m.level} size={11} />
            </span>
          ))}
        </div>
        <input
          type="range"
          min={0}
          max={total}
          value={daysBetween(from, asOf)}
          onChange={(e) => setAsOf(addDays(from, Math.min(Number(e.target.value), todayValue)))}
          aria-label="Tilannepäivä"
          aria-valuetext={fiDate(asOf)}
        />
        {end > today && <div className="asof-ahead" style={{ left: at(today) }} aria-hidden="true" />}
        <div className="asof-stops" aria-hidden="true">
          {stops.map((s) => (
            <span key={s.id} className={`asof-stop${s.current ? ' is-current' : ''}${s.date > today ? ' is-ahead' : ''}`} style={{ left: at(s.date) }}>
              {s.planned && <StatusIcon level="planned" size={11} />}
              {fiDay(s.date)} <i className="asof-stop-label">{s.label}</i>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
