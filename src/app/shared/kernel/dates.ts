// Dates au format ISO local YYYY-MM-DD, sans fuseau horaire.

const pad = (n: number) => String(n).padStart(2, '0');
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const todayISO = () => toISO(new Date());
export const addDays = (s: string, n: number) => {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
};
/** Lundi de la semaine contenant la date. */
export const startOfWeek = (s: string) => addDays(s, -((parseISO(s).getDay() + 6) % 7));
export const weekDays = (start: string) => Array.from({ length: 7 }, (_, i) => addDays(start, i));

export const fmtDate = (s: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }) =>
  parseISO(s).toLocaleDateString('fr-FR', opts);
export const fmtShort = (s: string) => parseISO(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
export const fmtDay = (s: string) => parseISO(s).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' });

export const byDate = <T extends { date: string }>(a: T, b: T) => a.date.localeCompare(b.date);
