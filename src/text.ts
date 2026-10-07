// Sentences the page writes from the evaluation, in one place.

import type { DecisionState, Event } from './evaluate.ts';
import { LEVEL_LABEL, capitalize, countWord, driftText, fiDate } from './format.ts';
import type { Level } from './model.ts';

/** Why a decision is not in the clear, one line per cause. */
export function causes(state: DecisionState): string[] {
  const out: string[] = [];
  for (const { state: a } of state.own) {
    if (a.level !== 'warn' && a.level !== 'breach') continue;
    const moved = a.readings.filter((r) => r.drift && r.drift.level !== 'ok');
    const facts = moved
      .map((r) =>
        r.instrument.watch
          ? `${r.instrument.title}: ${r.drift!.now.value} ${r.drift!.now.value === 1 ? 'löydös' : 'löydöstä'}`
          : `${r.instrument.title} ${driftText(r.instrument, r.drift!.change)}`,
      )
      .join(', ');
    out.push(`${a.assumption.title}: ${facts} päätöksen jälkeen. ${moved.length}/${a.readings.length} instrumentista yli rajan.`);
  }
  for (const inherited of state.inherited) {
    if (inherited.state.level !== 'warn' && inherited.state.level !== 'breach') continue;
    const parent = inherited.state.decision;
    out.push(`Nojaa päätökseen ${fiDate(parent.date)} ${parent.title}, jonka oletus ${LEVEL_LABEL[inherited.state.level].toLowerCase()}.`);
  }
  return out;
}

/** One line for a list row. */
export function reason(state: DecisionState): string {
  if (state.level === 'warn' || state.level === 'breach') return causes(state)[0] ?? LEVEL_LABEL[state.level];
  if (state.level === 'unmeasured') return 'Oletuksia ei mitata vielä.';
  const n = state.own.reduce((sum, o) => sum + o.state.readings.filter((r) => r.drift).length, 0);
  return n > 0 ? `Oletukset pitävät: ${n} instrumenttia rajoissa.` : 'Oletukset pitävät.';
}

/** The opening sentence for a set of standing decisions. */
export function headline(levels: Level[]): string {
  const broken = levels.filter((l) => l === 'breach').length;
  const pressed = levels.filter((l) => l === 'warn').length;
  const many = (n: number) => (n === 1 ? 'Yksi voimassa oleva päätös nojaa' : `${capitalize(countWord(n))} voimassa olevaa päätöstä nojaa`);
  if (broken) return `${many(broken)} oletukseen, joka ei enää pidä.`;
  if (pressed) return `${many(pressed)} oletukseen, joka on paineessa.`;
  return 'Voimassa olevien päätösten mitatut oletukset pitävät.';
}

export function eventText(event: Event): string {
  switch (event.kind) {
    case 'decided':
      return `Päätös: ${event.decision.title}`;
    case 'closed':
      return `Toteutettu: ${event.decision.title}`;
    case 'ahead':
      return `Tulossa: ${event.decision.title}`;
    default:
      return `${event.decision.title}: ${LEVEL_LABEL[event.level].toLowerCase()}`;
  }
}
