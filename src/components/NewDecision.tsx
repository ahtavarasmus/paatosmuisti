import { useState } from 'react';
import { fiDate, localToday } from '../format.ts';
import type { Assumption, Decision, Instrument, Ledger } from '../model.ts';
import { go, href } from '../router.ts';
import { addDecision } from '../store.ts';

type Pick = { kind: 'series'; id: string } | { kind: 'watch'; query: string };

interface Draft {
  text: string;
  picks: Pick[];
}

/** The way in: what was decided, what has to stay true, and how each of those would be seen. */
export function NewDecision({ ledger }: { ledger: Ledger }) {
  const today = localToday();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today);
  const [summary, setSummary] = useState('');
  const [buildsOn, setBuildsOn] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([{ text: '', picks: [] }]);
  const [error, setError] = useState('');

  const sources = ledger.instruments.filter((i) => !i.watch);
  const parents = ledger.decisions.filter((d) => !d.planned).sort((a, b) => b.date.localeCompare(a.date));

  const update = (i: number, patch: Partial<Draft>) => setDrafts(drafts.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const addPick = (i: number, pick: Pick) => update(i, { picks: [...drafts[i].picks, pick] });
  const removePick = (i: number, k: number) => update(i, { picks: drafts[i].picks.filter((_, j) => j !== k) });

  function save() {
    const filled = drafts.filter((d) => d.text.trim());
    if (!title.trim()) return setError('Anna päätökselle otsikko.');
    if (!date) return setError('Anna päivämäärä.');
    if (filled.length === 0) return setError('Kirjaa ainakin yksi oletus: minkä pitää olla totta, että tämä on hyvä päätös?');

    const stamp = Date.now();
    const id = `local-${stamp}`;
    const assumptions: Assumption[] = [];
    const instruments: Instrument[] = [];
    filled.forEach((d, i) => {
      const ids: string[] = [];
      d.picks.forEach((p, k) => {
        if (p.kind === 'series') {
          if (!ids.includes(p.id)) ids.push(p.id);
          return;
        }
        const watchId = `${id}-watch-${i}-${k}`;
        ids.push(watchId);
        instruments.push({
          id: watchId,
          title: `Uutisvahti: ${p.query.length > 60 ? `${p.query.slice(0, 57)}...` : p.query}`,
          measures: 'Agentti hakee päivittäin uutisia, jotka olisivat ristiriidassa oletuksen kanssa, ja jättää löydökset ihmisen tarkistettaviksi.',
          watch: { query: p.query, findings: [] },
          unit: 'löydöstä',
          decimals: 0,
          unitShort: '',
          source: { name: 'Verkkohaku (agentti)', url: '' },
          cadence: 'daily',
          smoothDays: 1,
          lagDays: 0,
          mode: 'points',
          badDirection: 'up',
          warn: 1,
          breach: 1,
          why: 'Tarkistamaton löydös on varoitus, vahvistettu löydös rajan ylitys.',
          blindSpot: 'Löytää vain sen, mistä on uutisoitu. Väärä löydös maksaa yhden ihmisen tarkistuksen.',
        });
      });
      assumptions.push({
        id: `${id}-a${i}`,
        title: d.text.trim().length > 48 ? `${d.text.trim().slice(0, 45)}...` : d.text.trim(),
        claim: d.text.trim(),
        instruments: ids,
        gap: ids.length === 0 ? 'Ei vielä instrumentteja.' : undefined,
      });
    });

    const decision: Decision = {
      id,
      date,
      thread: id,
      title: title.trim(),
      short: title.trim().length > 18 ? `${title.trim().slice(0, 16)}...` : title.trim(),
      summary: summary.trim() || title.trim(),
      by: 'Kirjattu demossa',
      buildsOn: buildsOn ? [{ decision: buildsOn, why: 'Kirjaajan merkitsemä.' }] : undefined,
      restsOn: assumptions.map((a) => ({ assumption: a.id, wording: a.claim })),
      sources: [],
    };
    addDecision({ thread: { id, title: decision.title }, decision, assumptions, instruments });
    go({ name: 'decision', id });
  }

  return (
    <>
      <nav className="crumbs">
        <a href={href({ name: 'home' })}>Päätökset</a>
      </nav>
      <section className="verdict">
        <p className="eyebrow">Uusi päätös</p>
        <h1>Mitä päätettiin, ja minkä pitää olla totta?</h1>
        <p className="verdict-meta">
          Demossa kirjaus jää tähän selaimeen. Instrumentit alkavat mitata päätöspäivästä, myös takautuvasti, jos päivä on menneisyydessä.
        </p>
      </section>

      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label>
          <span>Otsikko</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Esimerkiksi: Investointi Kotkan tehtaaseen, 130 M€" />
        </label>
        <div className="form-row">
          <label>
            <span>Päivämäärä</span>
            <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="grow">
            <span>Nojaa aiempaan päätökseen</span>
            <select value={buildsOn} onChange={(e) => setBuildsOn(e.target.value)}>
              <option value="">Ei mihinkään</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {fiDate(p.date)} {p.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          <span>Mitä päätettiin</span>
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} placeholder="Päätös omin sanoin, lukijana hallituksen jäsen." />
        </label>

        <h2>Oletukset</h2>
        <p className="muted">Minkä pitää olla totta, että tämä on yhä hyvä päätös? Yksi lause kutakin.</p>
        {drafts.map((d, i) => (
          <div className="draft" key={i}>
            <label>
              <span>Oletus {i + 1}</span>
              <input
                value={d.text}
                onChange={(e) => update(i, { text: e.target.value })}
                placeholder="Esimerkiksi: Raaka-aineiden hinnat pysyvät nykytasolla."
              />
            </label>
            <div className="picks">
              <span className="picks-label">Mistä sen näkee</span>
              {d.picks.map((p, k) => (
                <span className="pick" key={k}>
                  {p.kind === 'series' ? ledger.instruments.find((x) => x.id === p.id)?.title : `Uutisvahti: ${p.query}`}
                  <button type="button" aria-label="Poista" onClick={() => removePick(i, k)}>
                    ×
                  </button>
                </span>
              ))}
              <AddSeries sources={sources} onAdd={(id) => addPick(i, { kind: 'series', id })} />
              <AddWatch onAdd={(query) => addPick(i, { kind: 'watch', query })} />
              <span className="pick-soon" title="Tuotannossa agentti etsii avoimen rajapinnan kuvauksesi perusteella, hakee koesarjan ja ehdottaa rajat sen historiasta.">
                Uusi tietolähde kuvauksen perusteella: agentti, ei demossa
              </span>
            </div>
          </div>
        ))}
        <button type="button" className="ghost" onClick={() => setDrafts([...drafts, { text: '', picks: [] }])}>
          + Lisää oletus
        </button>

        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="submit" className="primary">
            Tallenna päätös
          </button>
          <a href={href({ name: 'home' })}>Peru</a>
        </div>
      </form>
    </>
  );
}

function AddSeries({ sources, onAdd }: { sources: Instrument[]; onAdd: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className="ghost small" onClick={() => setOpen(true)}>
        + Yhdistä tietolähde
      </button>
    );
  return (
    <select
      autoFocus
      defaultValue=""
      onChange={(e) => {
        if (e.target.value) onAdd(e.target.value);
        setOpen(false);
      }}
      onBlur={() => setOpen(false)}
    >
      <option value="">Valitse lähde</option>
      {sources.map((s) => (
        <option key={s.id} value={s.id}>
          {s.title} ({s.source.name})
        </option>
      ))}
    </select>
  );
}

function AddWatch({ onAdd }: { onAdd: (query: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  if (!open)
    return (
      <button type="button" className="ghost small" onClick={() => setOpen(true)}>
        + Lisää uutisvahti
      </button>
    );
  return (
    <span className="watch-form">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Mitä uutisista pitäisi etsiä? Esim. tuotantokatkot Kemiran tehtailla"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (query.trim()) onAdd(query.trim());
            setQuery('');
            setOpen(false);
          }
        }}
      />
      <button
        type="button"
        className="small"
        onClick={() => {
          if (query.trim()) onAdd(query.trim());
          setQuery('');
          setOpen(false);
        }}
      >
        Lisää
      </button>
    </span>
  );
}
