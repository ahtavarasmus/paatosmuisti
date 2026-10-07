import type { Instrument, Level } from './model.ts';

const MONTHS = ['tammi', 'helmi', 'maalis', 'huhti', 'touko', 'kesä', 'heinä', 'elo', 'syys', 'loka', 'marras', 'joulu'];

/** 2026-07-17 -> 17.7.2026 */
export function fiDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d}.${m}.${y}`;
}

/** 2026-07-17 -> 17.7. */
export function fiDay(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d}.${m}.`;
}

export function monthName(iso: string): string {
  return MONTHS[Number(iso.slice(5, 7)) - 1];
}

export function fiNumber(value: number, decimals: number): string {
  return value.toLocaleString('fi-FI', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function signed(value: number, decimals = 0): string {
  const body = fiNumber(Math.abs(value), decimals);
  if (Number(body.replace(',', '.').replace(/\s/g, '')) === 0) return '±0';
  return `${value < 0 ? '−' : '+'}${body}`;
}

export function valueText(inst: Instrument, value: number): string {
  return `${fiNumber(value, inst.decimals)}${inst.unitShort ? ` ${inst.unitShort}` : ''}`;
}

/** A change since the decision: percent, or percentage points for an index that is itself a percentage. */
export function driftText(inst: Instrument, change: number): string {
  return `${signed(change)} ${inst.mode === 'percent' ? '%' : '%-yks.'}`;
}

/** The thresholds in the same terms as driftText. */
export function limitText(inst: Instrument, limit: number): string {
  const sign = inst.badDirection === 'up' ? '+' : inst.badDirection === 'down' ? '−' : '±';
  return `${sign}${fiNumber(limit, 0)} ${inst.mode === 'percent' ? '%' : '%-yks.'}`;
}

/** How an assumption or a decision stands. */
export const LEVEL_LABEL: Record<Level, string> = {
  ok: 'Pitää',
  warn: 'Paineessa',
  breach: 'Ei pidä',
  unmeasured: 'Ei mitata',
};

/** How a single instrument stands against its limits. */
export const READING_LABEL: Record<Level, string> = {
  ok: 'Rajoissa',
  warn: 'Yli varoitusrajan',
  breach: 'Yli rajan',
  unmeasured: 'Ei tietoa',
};

const NOMINATIVE = ['nolla', 'yksi', 'kaksi', 'kolme', 'neljä', 'viisi', 'kuusi', 'seitsemän', 'kahdeksan', 'yhdeksän', 'kymmenen'];
const GENITIVE = ['nollan', 'yhden', 'kahden', 'kolmen', 'neljän', 'viiden', 'kuuden', 'seitsemän', 'kahdeksan', 'yhdeksän', 'kymmenen'];

export function countWord(n: number, form: 'nominative' | 'genitive' = 'nominative'): string {
  return (form === 'nominative' ? NOMINATIVE : GENITIVE)[n] ?? String(n);
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Today's date in the reader's own time zone. */
export function localToday(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
