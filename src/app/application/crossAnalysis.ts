import { weightOn } from '../body/domain/weight';
import { addDays, startOfWeek } from '../shared/kernel/dates';
import { exerciseHistory, sessionVolume } from '../training/domain/strength';
import { pctChange } from '../training/domain/strengthAnalysis';
import type { AppData } from './appData';
import { dayTotals } from './dailySummary';

// Croisements entre la musculation, le poids, la nutrition et les mensurations (aucune donnée dérivée n'est stockée).

export interface CrossWeek {
  week: string;
  /** Meilleur 1RM estimé de l'exercice choisi cette semaine. */
  e1rm: number | null;
  /** Dernier poids de corps connu à la fin de la semaine (null sans aucune pesée). */
  bodyWeight: number | null;
  /** 1RM estimé ÷ poids de corps. */
  relative: number | null;
  /** Tour de taille mesuré cette semaine, en cm. */
  waist: number | null;
  /** Moyennes quotidiennes de la semaine, si au moins MIN_LOGGED_DAYS jours sont renseignés dans le journal. */
  kcal: number | null;
  protein: number | null;
  volume: number;
}

export const MIN_LOGGED_DAYS = 3;

export function crossWeekly(data: AppData, today: string, weeks: number, exercise: string): CrossWeek[] {
  const first = addDays(startOfWeek(today), -7 * (weeks - 1));
  const history = exerciseHistory(data.strength, exercise);
  return Array.from({ length: weeks }, (_, i) => {
    const week = addDays(first, 7 * i);
    const end = addDays(week, 6);
    const days = Array.from({ length: 7 }, (_, k) => addDays(week, k)).filter((d) => d <= today);

    const points = history.filter((p) => p.date >= week && p.date <= end && p.e1rm > 0);
    const e1rm = points.length ? Math.max(...points.map((p) => p.e1rm)) : null;
    const bodyWeight = data.weights.length ? weightOn(data.weights, days[days.length - 1]) : null;

    const waists = data.measurements.filter((m) => m.date >= week && m.date <= end && m.values.waist !== undefined).map((m) => m.values.waist!);
    const logged = days.map((d) => dayTotals(data, d)).filter((t) => t.hasEntries);
    const avg = (f: (n: (typeof logged)[number]['intake']) => number) =>
      logged.length >= MIN_LOGGED_DAYS ? logged.reduce((s, t) => s + f(t.intake), 0) / logged.length : null;

    return {
      week,
      e1rm,
      bodyWeight,
      relative: e1rm !== null && bodyWeight ? e1rm / bodyWeight : null,
      waist: waists.length ? waists.reduce((a, b) => a + b, 0) / waists.length : null,
      kcal: avg((n) => n.kcal),
      protein: avg((n) => n.protein),
      volume: data.strength.filter((s) => s.date >= week && s.date <= end).reduce((v, s) => v + sessionVolume(s), 0),
    };
  });
}

/** Coefficient de corrélation de Pearson, ou null s'il y a moins de 6 points ou aucune variation. */
export function correlation(pairs: [number, number][]): number | null {
  const n = pairs.length;
  if (n < 6) return null;
  const mx = pairs.reduce((s, p) => s + p[0], 0) / n;
  const my = pairs.reduce((s, p) => s + p[1], 0) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const [x, y] of pairs) {
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
    sxy += (x - mx) * (y - my);
  }
  return sxx === 0 || syy === 0 ? null : sxy / Math.sqrt(sxx * syy);
}

export function describeCorrelation(r: number): string {
  const a = Math.abs(r);
  const strength = a >= 0.6 ? 'nette' : a >= 0.3 ? 'modérée' : 'faible';
  return `${strength}${a >= 0.3 ? (r > 0 ? ', dans le même sens' : ', en sens inverse') : ''}`;
}

const firstLast = <T>(rows: CrossWeek[], f: (w: CrossWeek) => T | null): [T, T] | null => {
  const values = rows.map(f).filter((v): v is T => v !== null);
  return values.length >= 2 ? [values[0], values[values.length - 1]] : null;
};

export interface CrossSummary {
  /** Variations (%) entre la première et la dernière valeur connue de la période. */
  e1rmPct: number | null;
  relativePct: number | null;
  bodyWeightPct: number | null;
  /** Variation du tour de taille, en cm. */
  waistDelta: number | null;
}

export function crossSummary(rows: CrossWeek[]): CrossSummary {
  const pct = (f: (w: CrossWeek) => number | null) => {
    const v = firstLast(rows, f);
    return v && v[0] > 0 ? pctChange(v[0], v[1]) : null;
  };
  const waist = firstLast(rows, (w) => w.waist);
  return {
    e1rmPct: pct((w) => w.e1rm),
    relativePct: pct((w) => w.relative),
    bodyWeightPct: pct((w) => w.bodyWeight),
    waistDelta: waist ? waist[1] - waist[0] : null,
  };
}

/** Lecture en une phrase de l'évolution de la force absolue et relative au poids de corps. */
export function forceVerdict({ e1rmPct, relativePct, bodyWeightPct }: CrossSummary): string | null {
  if (e1rmPct === null || relativePct === null) return null;
  const weight = bodyWeightPct === null ? '' : ` (poids ${signedPct(bodyWeightPct)})`;
  if (e1rmPct <= -2 && relativePct > -2) return `Le 1RM baisse (${signedPct(e1rmPct)}) mais la force relative tient${weight} : la baisse suit surtout celle du poids.`;
  if (relativePct >= 2) return `Tu es plus fort relativement à ton poids (${signedPct(relativePct)})${weight}.`;
  if (relativePct <= -2) {
    return e1rmPct >= 2
      ? `Le 1RM monte (${signedPct(e1rmPct)}) moins vite que le poids${weight} : la force relative recule (${signedPct(relativePct)}).`
      : `La force relative recule (${signedPct(relativePct)})${weight}.`;
  }
  return `Force relative stable (${signedPct(relativePct)})${weight}.`;
}

const signedPct = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n * 10) / 10} %`.replace('.', ',');
