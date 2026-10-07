# Päätösmuisti - spec

Working spec for the demo. Re-read after a break; update when a decision changes.

## What this is

An interview assignment for a forward deployed engineer role: "first day at the customer".
The imagined customer is the chair of Kemira's board. Deliverables: a working demo, access to
its materials (this repo), and a 20-minute walkthrough. No slides. About five hours of build.

Required element: pick a decision or strategic choice the board has made, name one assumption
it rests on, and build at least three independent instruments, wired to real data sources,
that measure whether the assumption still holds.

## The problem chosen

The chair's complaint that nobody remembers on what grounds earlier decisions were made, and
that finding out takes a week. The demo keeps a register of decisions with the assumptions
they rest on, and keeps measuring whether those assumptions are still true.

Not chosen: summarising the 200-page board pack. It is the obvious pick, and real board packs
are not public, so it could not be shown honestly.

## Decisions by the owner (2026-10-04)

1. Standalone app in its own repo. Not built on antimeme.
2. Flagship assumption: the cost assumption behind Kemira's 2026 outlook. Numeric, keyless,
   fast-moving sources first. Fuzzy sources (news, regulation texts) are not needed in the
   first draft.
3. Scope matters more than the clock. Timeline and the decision-assumption graph come first.

## Model

- A **decision** rests on **assumptions**, in the wording used at that decision.
- An **assumption** is measured by **instruments**. Assumptions are shared between decisions.
- An **instrument** produces **readings** from a live public source.
- A decision can **build on** an earlier decision, and can **revise** an earlier version of
  itself. Versions of one decision share a thread and one row on the timeline.

Rules (all in `src/evaluate.ts`, tested in `src/evaluate.test.ts`):

- An instrument is judged by its drift since the date of the decision that stated the
  assumption, never by its absolute level.
- Only readings already published on the chosen date count. Each instrument has a
  publication lag, so replaying a past date never sees the future.
- One instrument past its limit: the assumption is under pressure. Two: it no longer holds.
  A single instrument can never break an assumption alone.
- A decision is as healthy as the weakest assumption under it, or under anything it builds on.

Limits come from data, not taste: `npm run calibrate` measures each instrument's 90-day drift
in a calm reference period (June 2024 to 11 February 2026). The warning limit is the 95th
percentile rounded up to a clean number, the breach limit is twice that.

## Data

`data/ledger.json` is curated by hand: decisions, assumptions, instrument definitions.
`data/series/*.json` is written by `npm run fetch` from these sources, none of which need a key:

| Instrument | Source | Cadence | Lag used |
|---|---|---|---|
| Ship traffic through Hormuz | IMF PortWatch (ArcGIS feature service) | daily | 9 days |
| Brent crude price | U.S. EIA series via the FRED graph download | daily | 7 days |
| EU chemical producer prices | Eurostat `sts_inpp_m`, NACE C20 | monthly | 38 days |
| EU paper production | Eurostat `sts_inpr_m`, NACE C17 | monthly | 47 days |
| EUR/USD | ECB reference rate | daily | 1 day |

Ship traffic swings with the season, so it is stored as a percentage of the same three weeks
one year earlier. From March 2027 that base year contains the 2026 closure and needs a longer norm.

## Decisions by the owner (2026-10-07)

- The first page was too complex (three visual languages at once, no way in). Rebuilt twice the
  same day; the owner's final design: one page with a full-width date slider on top, the
  decisions on the left as one card each with the decision's own version timeline inside (each
  version with its state and the day it turned; the version in force on the slider's date is
  marked), and on the right that version as a tree: the decision on top, lines down to its
  assumptions, instruments under those. The flat event list confused the owner (versions, separate
  decisions and state changes looked alike), so it went. The slider briefly stepped over versions
  only; the owner then asked for the day-level slider back, with the pane showing the version in
  force on that day and the readings moving as you drag. The slider is pinned to the top of the
  window, cannot pass today, and carries the selected decision's versions and completion as
  labels. Card order is fixed by today's state; the decision box keeps the tallest version's
  height; picking a decision or a day never scrolls the page. The separate timeline view is gone.
  "Lisää päätös" is its own view.
- No LLM is wired. The agent is described where it would act: the news watch and the search for
  a new data source from a description.
- Two kinds of instrument: a numeric series read from an open API, and a news watch, where an
  agent would search daily for news contradicting the assumption and a person confirms or
  dismisses each finding. An unconfirmed finding is a warning, a confirmed one a breach.
  Wrong findings cost one human check, so this is a fitting use of an LLM.
- Presentation is 2026-10-08; the link goes out 2026-10-07.

## Built so far

- Fetch script, evaluation logic with tests (20), calibration script, text report.
- Views: the page (slider, headline, Tapahtumat list, decision tree with then → now rows,
  sparklines, news-watch findings with confirm/dismiss and manual filing) and Lisää päätös (form;
  connects existing sources or adds a news watch; the agent-found source is described, disabled).
- Additions made in the browser live in localStorage (`src/store.ts`), merged over the seed
  register at render time.
- README for the reviewers, GitHub Pages workflow with a daily fetch (not yet run).

## Next

1. Publish: public repo, Pages, link into the README.
2. If time: an email or Teams message on a status change; a server for the additions.

## Left out on purpose

- Running the agent (no LLM key), extracting decisions from documents, summarising board
  material, chat, logins, dark mode, a server for user additions.

## To check before presenting

- Kemira's wording was read through a summarising fetch. Re-read the original releases and
  correct the paraphrases in `data/ledger.json`.
- The "builds on" links (buyback on the outlook, acquisition on the targets) are our reading,
  not Kemira's statement. They are labelled as such in the ledger.
- The outlook is attributed to the company. Only the targets and the buyback releases name
  the board.
- Publication lags are estimates on the cautious side.
- The limits were derived after the events they flag. The method is data-driven, but in real
  use the board would set a limit when it makes the decision.

## Run

```bash
npm install
npm run fetch        # pull the live series
npm run dev          # the page
npm test             # evaluation rules
npm run calibrate    # where the limits come from
npm run report -- 2026-03-20   # the state on any date, as text
```
