import { series } from '../data.ts';
import { decisionState, levelSpans, standsUntil } from '../evaluate.ts';
import { LEVEL_LABEL, fiDate, fiDay } from '../format.ts';
import type { Decision, Ledger, Level } from '../model.ts';
import { href } from '../router.ts';
import { StatusIcon } from './StatusIcon.tsx';

const RANK: Record<Level, number> = { breach: 3, warn: 2, unmeasured: 1, ok: 0 };

interface VersionRow {
  version: Decision;
  level: Level | 'planned';
  note: string;
  future: boolean;
}

/** How one version stood on the chosen date, or on the day it stopped standing, and since when. */
function describe(version: Decision, ledger: Ledger, asOf: string): VersionRow {
  if (version.planned) return { version, level: 'planned', note: `tulossa`, future: version.date > asOf };
  if (version.date > asOf) return { version, level: 'planned', note: 'ei vielä', future: true };
  const until = standsUntil(version, ledger, asOf);
  const spans = levelSpans(version, ledger, series, version.date, until);
  const last = spans.at(-1)!;
  const label = LEVEL_LABEL[last.level].toLowerCase();
  const note = last.level === 'ok' || last.level === 'unmeasured' || last.from === version.date ? label : `${label} ${fiDay(last.from)} alkaen`;
  return { version, level: last.level, note, future: false };
}

/**
 * One card per decision, with the decision's own small timeline of versions inside it.
 * The version in force on the chosen date is marked; that is the one shown on the right.
 */
export function DecisionCards({ ledger, asOf, today, selectedId }: { ledger: Ledger; asOf: string; today: string; selectedId: string }) {
  const cards = ledger.threads
    .map((thread) => {
      const versions = ledger.decisions.filter((d) => d.thread === thread.id).sort((a, b) => a.date.localeCompare(b.date));
      const made = versions.filter((v) => !v.planned && v.date <= asOf);
      const inForce = made.at(-1) ?? null;
      const closed = inForce?.closed && inForce.closed.date <= asOf ? inForce.closed : null;
      const standing = inForce !== null && !closed;
      // The card's own state: the version in force, judged up to the day it stopped standing.
      const level: Level | 'planned' = inForce ? decisionState(inForce, ledger, series, standsUntil(inForce, ledger, asOf)).level : 'planned';
      const rows = versions.map((v) => describe(v, ledger, asOf));
      const selected = versions.some((v) => v.id === selectedId);
      // Opening another decision shows the version of it that stands today.
      const open = versions.filter((v) => !v.planned && v.date <= today).at(-1) ?? versions[0];
      // The order never moves: it is decided by how things stand today, not by the version being looked at.
      const todayStanding = standsUntil(open, ledger, today) === today && !open.planned && open.date <= today;
      const todayLevel = open.date <= today && !open.planned ? decisionState(open, ledger, series, standsUntil(open, ledger, today)).level : 'unmeasured';
      return { thread, versions, rows, inForce, closed, standing, level, selected, open, order: [todayStanding ? 0 : 1, -RANK[todayLevel], open.date] as const };
    })
    .sort((a, b) => a.order[0] - b.order[0] || a.order[1] - b.order[1] || b.order[2].localeCompare(a.order[2]));

  return (
    <section className="decisions">
      <h2>Päätökset</h2>
      {cards.map(({ thread, rows, inForce, closed, level, selected, open }) => {
        return (
          <article className={`dec${selected ? ' is-selected' : ''}${inForce ? '' : ' is-future'}`} key={thread.id}>
            <a className="dec-head" href={href({ name: 'decision', id: open.id })} aria-current={selected ? 'true' : undefined}>
              <StatusIcon level={level} size={17} />
              <span className="dec-title">{thread.title}</span>
              <span className="dec-level">
                {level === 'planned' ? 'ei vielä' : LEVEL_LABEL[level]}
                {closed && <span className="dec-closed">toteutettu {fiDay(closed.date)}</span>}
              </span>
            </a>
            <ol className="versions-list">
              {rows.map(({ version: v, level: rowLevel, note, future }) => {
                const current = v.id === selectedId;
                return (
                  <li key={v.id} className={`ver${current ? ' is-current' : ''}${future ? ' is-future' : ''}`}>
                    <a className="ver-row" href={href({ name: 'decision', id: v.id })} aria-current={current ? 'true' : undefined}>
                      <span className="ver-date">{fiDate(v.date)}</span>
                      <span className="ver-label">{v.short}</span>
                      <span className="ver-state">
                        <StatusIcon level={rowLevel} size={13} />
                        {note}
                      </span>
                    </a>
                  </li>
                );
              })}
              {inForce?.closed && (
                <li className={`ver is-closed${inForce.closed.date > asOf ? ' is-future' : ''}`}>
                  <span className="ver-row">
                    <span className="ver-date">{fiDate(inForce.closed.date)}</span>
                    <span className="ver-label">toteutettu</span>
                  </span>
                </li>
              )}
            </ol>
          </article>
        );
      })}
    </section>
  );
}
