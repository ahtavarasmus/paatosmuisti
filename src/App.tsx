import { useEffect, useMemo, useState } from 'react';
import { TimeSlider } from './components/TimeSlider.tsx';
import { DecisionPane } from './components/DecisionPane.tsx';
import { DecisionCards } from './components/DecisionCards.tsx';
import { NewDecision } from './components/NewDecision.tsx';
import { fetchedAt, series } from './data.ts';
import { decisionState, events, inPlay, standsUntil } from './evaluate.ts';
import { fiDate, localToday } from './format.ts';
import { href, useRoute } from './router.ts';
import { clearAdditions, hasAdditions, merge, useAdditions } from './store.ts';
import { headline } from './text.ts';

/** Open on the decision the next planned one builds on: that is what the next meeting is about. */
function defaultSelection(ledger: ReturnType<typeof merge>): string {
  const planned = ledger.decisions.find((d) => d.planned);
  return planned?.buildsOn?.[0]?.decision ?? ledger.decisions.at(-1)!.id;
}

export function App() {
  const today = useMemo(localToday, []);
  const route = useRoute();
  const additions = useAdditions();
  const ledger = useMemo(() => merge(additions), [additions]);
  const [asOf, setAsOf] = useState(today);
  const feed = useMemo(() => events(ledger, series, today), [ledger, today]);
  const fetched = new Date(fetchedAt);

  // A click picks a decision; the day picks which version of it is shown: the one in force then.
  const picked = ledger.decisions.find((d) => d.id === (route.name === 'decision' ? route.id : defaultSelection(ledger))) ?? ledger.decisions[0];
  const versions = ledger.decisions.filter((d) => d.thread === picked.thread).sort((a, b) => a.date.localeCompare(b.date));
  const shown =
    picked.planned && inPlay(picked, ledger, asOf) ? picked : (versions.filter((v) => !v.planned && v.date <= asOf).at(-1) ?? versions[0]);
  const standing = ledger.decisions.filter((d) => !d.planned && d.date <= asOf && standsUntil(d, ledger, asOf) === asOf);

  // Only switching between the page and the form scrolls to the top; picking a decision or a day leaves the page where it is.
  const view = route.name === 'new' ? 'form' : 'page';
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  return (
    <div className="page">
      <header className="masthead">
        <a className="masthead-name" href={href({ name: 'home' })}>
          Päätösmuisti
        </a>
        <a className={`tab-add${route.name === 'new' ? ' is-on' : ''}`} href={href({ name: 'new' })}>
          + Lisää päätös
        </a>
        <div className="masthead-meta">
          {ledger.company}, julkinen aineisto
          <span>
            Tiedot haettu {fiDate(fetchedAt.slice(0, 10))} klo {fetched.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </header>

      {route.name === 'new' ? (
        <NewDecision ledger={ledger} />
      ) : (
        <>
          <TimeSlider from={ledger.timeline.from} today={today} asOf={asOf} setAsOf={setAsOf} versions={versions} shown={shown} marks={feed} />
          <h1 className="headline">{headline(standing.map((d) => decisionState(d, ledger, series, asOf).level))}</h1>
          <div className="workspace">
            <DecisionCards ledger={ledger} asOf={asOf} today={today} selectedId={shown.id} />
            <DecisionPane ledger={ledger} today={today} asOf={asOf} id={shown.id} />
          </div>
        </>
      )}

      <footer className="method">
        <h2>Näin tämä toimii</h2>
        <ol>
          <li>
            Päätös kirjataan yhdessä oletustensa kanssa: minkä pitää olla totta, että se on yhä hyvä päätös. Jokaiselle
            oletukselle valitaan instrumentit: avoin tietolähde, jota luetaan automaattisesti, tai uutisvahti, jossa agentti
            hakee päivittäin ristiriitaisia uutisia ja ihminen tarkistaa löydökset.
          </li>
          <li>
            Instrumentin lukemaa verrataan tasoon, jolla se oli päätöstä tehtäessä. Kun yksi instrumentti ylittää rajansa,
            oletus on paineessa. Kun kaksi toisistaan riippumatonta ylittää, oletus ei enää pidä. Päätös on yhtä vahva kuin
            heikoin oletus sen itsensä tai sen pohjana olevien päätösten alla.
          </li>
          <li>
            Päivän liukusäädin näyttää, mitä kunakin päivänä tiedettiin: mukaan lasketaan vain siihen mennessä julkaistu tieto.
            Rajat on johdettu kunkin instrumentin tavanomaisesta vaihtelusta vertailujaksolla 6/2024-2/2026. Oikeassa
            käytössä hallitus kirjaa rajan itse päätöstä tehdessään, ja tilan muutoksesta lähtee viesti.
          </li>
        </ol>
        <p>
          Haastattelutehtävän demo. Aineisto on Kemiran julkisia tiedotteita ja avoimia tietolähteitä, eikä Kemira ole
          osallistunut tämän tekemiseen. Oletusten sanamuodot ovat tiivistelmiä: alkuperäiset löytyvät kunkin päätöksen
          lähteistä.
          {hasAdditions(additions) && (
            <>
              {' '}
              <button className="link" onClick={() => confirm('Poistetaanko tässä selaimessa lisätyt päätökset ja löydökset?') && clearAdditions()}>
                Tyhjennä tässä selaimessa lisätyt
              </button>
              .
            </>
          )}
        </p>
      </footer>
    </div>
  );
}
