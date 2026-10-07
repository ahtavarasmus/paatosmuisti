import { useState } from 'react';
import { series } from '../data.ts';
import { decisionState, drift, judgedAt, revisedBy, standsUntil } from '../evaluate.ts';
import type { AssumptionState, DecisionState } from '../evaluate.ts';
import { LEVEL_LABEL, READING_LABEL, driftText, fiDate, fiDay, limitText, localToday, valueText } from '../format.ts';
import type { Decision, Finding, Instrument, Ledger } from '../model.ts';
import { href } from '../router.ts';
import { addFinding, judgeFinding } from '../store.ts';
import { causes } from '../text.ts';
import { Sparkline } from './Sparkline.tsx';
import { StatusIcon } from './StatusIcon.tsx';

/** One numeric instrument: where it stood at the decision, where it stands now, and the limit. */
function SeriesRow({ inst, anchor, asOf }: { inst: Instrument; anchor: string; asOf: string }) {
  const points = series[inst.id]?.points ?? [];
  const moved = drift(inst, points, anchor, asOf);
  return (
    <div className="inst">
      <div className="inst-head">
        <StatusIcon level={moved?.level ?? 'unmeasured'} />
        <span className="inst-title">{inst.title}</span>
        <span className="inst-level">{moved ? READING_LABEL[moved.level] : 'Ei tietoa'}</span>
      </div>
      {moved && (
        <div className="inst-body">
          <Sparkline inst={inst} points={points} anchor={anchor} asOf={asOf} />
          <div className="inst-numbers">
            <div className="inst-thennow">
              <span>{valueText(inst, moved.base.value)}</span>
              <span className="inst-arrow">→</span>
              <strong>{valueText(inst, moved.now.value)}</strong>
              <span className="inst-change">{driftText(inst, moved.change)}</span>
            </div>
            <div className="inst-foot">
              Päätöshetkellä {fiDay(anchor)}, nyt tieto {fiDay(moved.now.date)} asti · varoitusraja {limitText(inst, inst.warn)}, raja{' '}
              {limitText(inst, inst.breach)} ·{' '}
              <a href={inst.source.url} target="_blank" rel="noreferrer">
                {inst.source.name}
              </a>
            </div>
          </div>
        </div>
      )}
      <details className="inst-more">
        <summary>Mitä tämä mittaa ja mitä ei</summary>
        <p>{inst.measures}</p>
        <p>
          <em>Rajat:</em> {inst.why}
        </p>
        <p>
          <em>Ei näe:</em> {inst.blindSpot}
        </p>
      </details>
    </div>
  );
}

/** A news watch: what the agent looks for, what it has found, and the person's verdict on each finding. */
function WatchRow({ inst, anchor, asOf }: { inst: Instrument; anchor: string; asOf: string }) {
  const watch = inst.watch!;
  const moved = drift(inst, [], anchor, asOf);
  const findings = watch.findings.filter((f) => f.date > anchor && f.date <= asOf).sort((a, b) => b.date.localeCompare(a.date));
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ date: localToday(), title: '', url: '' });

  return (
    <div className="inst">
      <div className="inst-head">
        <StatusIcon level={moved?.level ?? 'unmeasured'} />
        <span className="inst-title">{inst.title}</span>
        <span className="inst-level">{moved ? READING_LABEL[moved.level] : 'Ei vielä ajettu'}</span>
      </div>
      <p className="inst-query">
        <em>Agentti hakee päivittäin:</em> {watch.query}
      </p>
      <p className="inst-foot">
        {watch.lastRun
          ? `Viimeksi ajettu ${fiDate(watch.lastRun)}.`
          : 'Demossa agenttia ei ajeta: tuotannossa se tarvitsee kielimallin avaimen palvelimelle. Löydöksiä voi lisätä käsin.'}{' '}
        Löydös odottaa ihmisen tarkistusta ja on siihen asti varoitus. Vahvistettu löydös lasketaan rajan ylitykseksi, hylätty ei miksikään.
      </p>
      {findings.length > 0 && (
        <ul className="findings">
          {findings.map((f) => (
            <li key={f.id} className={`finding is-${f.state}`}>
              <span className="finding-date">{fiDate(f.date)}</span>
              <div className="finding-body">
                {f.url ? (
                  <a href={f.url} target="_blank" rel="noreferrer">
                    {f.title}
                  </a>
                ) : (
                  <span>{f.title}</span>
                )}
                {f.note && <span className="finding-note">{f.note}</span>}
              </div>
              <span className="finding-actions">
                {f.state === 'open' && (
                  <>
                    <button onClick={() => judgeFinding(inst.id, f.id, 'confirmed')}>Vahvista</button>
                    <button onClick={() => judgeFinding(inst.id, f.id, 'dismissed')}>Hylkää</button>
                  </>
                )}
                {f.state === 'confirmed' && (
                  <>
                    <strong>Vahvistettu</strong>
                    <button onClick={() => judgeFinding(inst.id, f.id, 'open')}>Peru</button>
                  </>
                )}
                {f.state === 'dismissed' && (
                  <>
                    <span>Hylätty</span>
                    <button onClick={() => judgeFinding(inst.id, f.id, 'open')}>Peru</button>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <form
          className="finding-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.title.trim()) return;
            const finding: Finding = {
              id: `f-${Date.now()}`,
              date: form.date,
              title: form.title.trim(),
              url: form.url.trim() || undefined,
              note: 'Käsin lisätty',
              state: 'open',
            };
            addFinding(inst.id, finding);
            setForm({ date: localToday(), title: '', url: '' });
            setAdding(false);
          }}
        >
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} aria-label="Päivä" />
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Mitä löytyi"
            aria-label="Otsikko"
            required
          />
          <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="Linkki (valinnainen)" aria-label="Linkki" />
          <button type="submit" className="primary">
            Lisää
          </button>
          <button type="button" onClick={() => setAdding(false)}>
            Peru
          </button>
        </form>
      ) : (
        <button className="ghost" onClick={() => setAdding(true)}>
          Lisää löydös käsin
        </button>
      )}
    </div>
  );
}


/** One assumption as a node, with its instruments as the nodes below it. */
function AssumptionNode({ wording, state, anchor, asOf, ledger }: { wording: string; state: AssumptionState; anchor: string; asOf: string; ledger: Ledger }) {
  const a = state.assumption;
  const over = state.breaches + state.warns;
  return (
    <div className="node node-assumption">
      <div className="node-head">
        <StatusIcon level={state.level} size={16} />
        <span className="node-title">{a.title}</span>
        <span className="node-level">{LEVEL_LABEL[state.level]}</span>
      </div>
      <p className="node-wording">{wording}</p>
      <p className="node-meta">
        Mitattu {fiDate(anchor)} alkaen.
        {state.readings.length > 1 && <> {over}/{state.readings.length} instrumentista yli rajan.</>}
        {a.instruments.length === 0 && <> Ei vielä instrumentteja. {a.gap}</>}
      </p>
      {a.instruments.length > 0 && (
        <div className="branch">
          {a.instruments.map((instId) => {
            const inst = ledger.instruments.find((i) => i.id === instId)!;
            return inst.watch ? <WatchRow key={instId} inst={inst} anchor={anchor} asOf={asOf} /> : <SeriesRow key={instId} inst={inst} anchor={anchor} asOf={asOf} />;
          })}
          {a.gap && <p className="node-gap">{a.gap}</p>}
        </div>
      )}
    </div>
  );
}

/** What a decision rests on, drawn downwards: its own assumptions, then the decisions it builds on with theirs. */
function Basis({ state, asOf, ledger, depth = 0 }: { state: DecisionState; asOf: string; ledger: Ledger; depth?: number }) {
  const d = state.decision;
  return (
    <div className="branch">
      {state.own.map(({ wording, state: a }) => (
        <AssumptionNode key={a.assumption.id} wording={wording} state={a} anchor={d.date} asOf={asOf} ledger={ledger} />
      ))}
      {state.inherited.map((inh) => (
        <div className="node node-parent" key={inh.state.decision.id}>
          <div className="node-head">
            <StatusIcon level={inh.state.level} size={16} />
            <span className="node-title">
              Nojaa päätökseen{' '}
              <a href={href({ name: 'decision', id: inh.state.decision.id })}>
                {fiDate(inh.state.decision.date)} {inh.state.decision.title}
              </a>
            </span>
            <span className="node-level">{LEVEL_LABEL[inh.state.level]}</span>
          </div>
          <p className="node-meta">
            {inh.why}
            {inh.revisedBy && <> Tätä päätöstä muutettiin {fiDay(inh.revisedBy.date)}.</>}
          </p>
          {depth < 2 && <Basis state={inh.state} asOf={asOf} ledger={ledger} depth={depth + 1} />}
        </div>
      ))}
      {state.own.length === 0 && state.inherited.length === 0 && <p className="node-gap">Tälle päätökselle ei ole kirjattu oletuksia.</p>}
    </div>
  );
}

interface Judged {
  decision: Decision;
  asOf: string;
  state: DecisionState | null;
  status: string;
}

/** A version as it stood on `asOf`, judged up to the day it stopped standing. */
function judge(d: Decision, ledger: Ledger, asOf: string): Judged {
  const made = !d.planned && d.date <= asOf;
  const basisKnown = (d.buildsOn ?? []).every((b) => ledger.decisions.find((x) => x.id === b.decision)!.date <= asOf);
  const until = made ? standsUntil(d, ledger, asOf) : asOf;
  const state = made || (d.planned && basisKnown) ? decisionState(d, ledger, series, until) : null;
  const replaced = made ? revisedBy(d, ledger, asOf) : null;
  const closed = made && d.closed && d.closed.date <= asOf;
  const status = d.planned
    ? `tulossa ${fiDate(d.date)}`
    : !made
      ? `ei vielä tehty, päätöspäivä ${fiDate(d.date)}`
      : replaced
        ? `korvattiin ${fiDay(replaced.date)}`
        : closed
          ? `toteutettu ${fiDay(d.closed!.date)}`
          : 'voimassa';
  return { decision: d, asOf: until, state, status };
}

/** The top box: the decision itself, as it stood on the day it is judged at. */
function DecisionNode({ judged, hidden }: { judged: Judged; hidden: boolean }) {
  const { decision: d, asOf, state, status } = judged;
  return (
    <div className={`node node-decision${hidden ? ' is-hidden' : ''}`} aria-hidden={hidden}>
      <p className="eyebrow">
        {state && (
          <>
            <StatusIcon level={state.level} size={13} /> {LEVEL_LABEL[state.level]} ·{' '}
          </>
        )}
        {d.by} · {status}
      </p>
      <h1>{d.title}</h1>
      {state && (state.level === 'warn' || state.level === 'breach') && (
        <ul className="node-causes">
          {causes(state).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <p className="node-summary">{d.summary}</p>
      {d.closed && d.closed.date <= asOf && <p className="node-summary">{d.closed.note}</p>}
      {d.sources.length > 0 && (
        <p className="node-links">
          {d.sources.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noreferrer" tabIndex={hidden ? -1 : undefined}>
              {s.title}
            </a>
          ))}
        </p>
      )}
    </div>
  );
}

/** The right-hand pane: one version of a decision on top, and everything it rests on below it. */
export function DecisionPane({ ledger, today, asOf, id }: { ledger: Ledger; today: string; asOf: string; id: string }) {
  const d = ledger.decisions.find((x) => x.id === id);
  if (!d) return <section className="pane"><p className="muted">Päätöstä ei löydy.</p></section>;
  const versions = ledger.decisions.filter((v) => v.thread === d.thread).sort((a, b) => a.date.localeCompare(b.date));
  // Every version's box is rendered so the box keeps the tallest one's height; only the shown one is judged on the chosen day.
  const judgedAll = versions.map((v) => (v.id === d.id ? judge(v, ledger, asOf) : judge(v, ledger, judgedAt(v, ledger, today))));
  const shown = judgedAll.find((j) => j.decision.id === d.id)!;

  return (
    <section className="pane">
      <div className="node-stack">
        {judgedAll.map((j) => (
          <DecisionNode key={j.decision.id} judged={j} hidden={j.decision.id !== d.id} />
        ))}
      </div>
      {shown.state ? <Basis state={shown.state} asOf={shown.asOf} ledger={ledger} /> : <p className="node-gap">Päätöstä ei ollut vielä tehty {fiDate(asOf)}.</p>}
    </section>
  );
}
