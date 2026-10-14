import { addDays, startOfWeek } from '../../shared/kernel/dates';
import { MUSCLE_GROUPS, muscleOf, estimate1RM, sessionVolume, setVolume, workSets, type MuscleGroup } from './strength';
import type { StrengthSession, StrengthSet } from './session';

// Analyses de la musculation : tendances par exercice, charge par muscle, régularité et croisements avec le reste de l'app.
// Tout est calculé à partir des séances (`data.strength`), des pesées, des mensurations et du journal : rien de dérivé n'est stocké,
// donc rien de plus à sauvegarder ni à exporter.

export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

const weekIndex = (date: string, first: string) => Math.round((Date.parse(startOfWeek(date)) - Date.parse(first)) / (7 * 86400000));

// --- 1. Tendance par exercice ---

export type TrendStatus = 'up' | 'flat' | 'down' | 'plateau' | 'new' | 'inactive';

export interface TrendPoint {
  date: string;
  value: number;
}

export interface ExerciseTrend {
  name: string;
  /** « kg » : 1RM estimé ; « reps » : exercice au poids du corps, on suit le meilleur nombre de répétitions. */
  unit: 'kg' | 'reps';
  points: TrendPoint[];
  current: number;
  best: number;
  bestDate: string;
  lastDate: string;
  sessions: number;
  /** Variation (en %) par rapport à la séance connue il y a 4 / 12 semaines, ou null si on n'a pas assez d'historique. */
  delta4: number | null;
  delta12: number | null;
  /** Séances réalisées depuis le meilleur résultat. */
  sinceBest: number;
  daysSinceBest: number;
  status: TrendStatus;
}

/** Variation (en %) sous laquelle un exercice est considéré stable. */
export const TREND_PCT = 1.5;
export const MIN_TREND_SESSIONS = 3;
export const PLATEAU_SESSIONS = 4;
export const PLATEAU_DAYS = 21;
/** Un exercice non refait depuis plus de 5 semaines est considéré inactif. */
export const ACTIVE_DAYS = 35;

export const pctChange = (from: number, to: number) => ((to - from) / from) * 100;

/** Tendance de chaque exercice : meilleur 1RM estimé (ou répétitions) par séance, variations à 4 et 12 semaines, plateau. */
export function exerciseTrends(sessions: StrengthSession[], today: string): ExerciseTrend[] {
  const ordered = [...sessions].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const byName = new Map<string, { id: string; date: string; sets: StrengthSet[] }[]>();
  for (const s of ordered) {
    for (const e of s.exercises) {
      const sets = workSets(e);
      if (!sets.length) continue;
      const list = byName.get(e.name) ?? [];
      const last = list[list.length - 1];
      if (last?.id === s.id) last.sets.push(...sets);
      else list.push({ id: s.id, date: s.date, sets: [...sets] });
      byName.set(e.name, list);
    }
  }

  const out: ExerciseTrend[] = [];
  for (const [name, entries] of byName) {
    const weighted = entries.some((x) => x.sets.some((y) => y.weight > 0));
    const points: TrendPoint[] = entries
      .map((x) => ({
        date: x.date,
        value: weighted ? Math.max(...x.sets.map((y) => estimate1RM(y.weight, y.reps))) : Math.max(...x.sets.map((y) => y.reps)),
      }))
      .filter((p) => p.value > 0);
    if (!points.length) continue;

    const latest = points[points.length - 1];
    const best = Math.max(...points.map((p) => p.value));
    const bestIndex = points.map((p) => p.value).lastIndexOf(best);
    const active = daysBetween(latest.date, today) <= ACTIVE_DAYS;
    const before = points.slice(0, -1);
    const delta = (weeks: number) => {
      const cutoff = addDays(today, -7 * weeks);
      const base = [...before].reverse().find((p) => p.date <= cutoff);
      return active && base && base.value > 0 ? pctChange(base.value, latest.value) : null;
    };
    const delta4 = delta(4);
    const delta12 = delta(12);
    const sinceBest = points.length - 1 - bestIndex;
    const daysSinceBest = daysBetween(points[bestIndex].date, today);
    const main = delta4 ?? delta12;

    let status: TrendStatus;
    if (!active) status = 'inactive';
    else if (points.length < MIN_TREND_SESSIONS) status = 'new';
    else if (main !== null && main <= -TREND_PCT) status = 'down';
    else if (sinceBest >= PLATEAU_SESSIONS && daysSinceBest >= PLATEAU_DAYS) status = 'plateau';
    else if (main !== null && main >= TREND_PCT) status = 'up';
    else status = 'flat';

    out.push({
      name,
      unit: weighted ? 'kg' : 'reps',
      points,
      current: latest.value,
      best,
      bestDate: points[bestIndex].date,
      lastDate: latest.date,
      sessions: points.length,
      delta4,
      delta12,
      sinceBest,
      daysSinceBest,
      status,
    });
  }
  return out.sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));
}

// --- 3. Charge par muscle ---

/** Série « dure » : menée à l'échec ou notée RPE 8 et plus (il restait au plus 2 répétitions en réserve). */
export const isHardSet = (s: StrengthSet) => s.type === 'failure' || (s.rpe ?? 0) >= 8;
/** Série dont l'intensité est connue (RPE saisi ou échec). */
export const isRatedSet = (s: StrengthSet) => s.type === 'failure' || s.rpe !== undefined;

type ByMuscle = Record<MuscleGroup, number>;
const emptyByMuscle = (): ByMuscle => Object.fromEntries(MUSCLE_GROUPS.map((g) => [g, 0])) as ByMuscle;

export interface MuscleWeek {
  week: string;
  sets: ByMuscle;
  volume: ByMuscle;
  totalSets: number;
  hardSets: number;
  ratedSets: number;
}

/** Séries et tonnage par groupe musculaire et par semaine (lundi → dimanche), semaines vides incluses. */
export function weeklyMuscleLoad(sessions: StrengthSession[], today: string, weeks: number): MuscleWeek[] {
  const first = addDays(startOfWeek(today), -7 * (weeks - 1));
  const out: MuscleWeek[] = Array.from({ length: weeks }, (_, i) => ({
    week: addDays(first, 7 * i),
    sets: emptyByMuscle(),
    volume: emptyByMuscle(),
    totalSets: 0,
    hardSets: 0,
    ratedSets: 0,
  }));
  for (const s of sessions) {
    const w = out[weekIndex(s.date, first)];
    if (!w) continue;
    for (const e of s.exercises) {
      const group = muscleOf(e.name);
      for (const x of workSets(e)) {
        w.sets[group]++;
        w.volume[group] += setVolume(x);
        w.totalSets++;
        if (isHardSet(x)) w.hardSets++;
        if (isRatedSet(x)) w.ratedSets++;
      }
    }
  }
  return out;
}

export interface MuscleRow {
  group: MuscleGroup;
  sets: number;
  hardSets: number;
  /** Jours distincts où le groupe a été travaillé. */
  days: number;
  setsPerWeek: number;
  hardPerWeek: number;
  /** Fréquence : jours d'entraînement du groupe par semaine. */
  perWeek: number;
}

/** Séries, séries dures et fréquence par groupe musculaire sur une période de `weeks` semaines (`sessions` = séances de la période). */
export function muscleSummary(sessions: StrengthSession[], weeks: number): MuscleRow[] {
  const sets = emptyByMuscle();
  const hard = emptyByMuscle();
  const days = new Map<MuscleGroup, Set<string>>();
  for (const s of sessions) {
    for (const e of s.exercises) {
      const group = muscleOf(e.name);
      const work = workSets(e);
      if (!work.length) continue;
      sets[group] += work.length;
      hard[group] += work.filter(isHardSet).length;
      days.set(group, (days.get(group) ?? new Set()).add(s.date));
    }
  }
  return MUSCLE_GROUPS.filter((g) => sets[g] > 0)
    .map((group) => ({
      group,
      sets: sets[group],
      hardSets: hard[group],
      days: days.get(group)?.size ?? 0,
      setsPerWeek: sets[group] / weeks,
      hardPerWeek: hard[group] / weeks,
      perWeek: (days.get(group)?.size ?? 0) / weeks,
    }))
    .sort((a, b) => b.sets - a.sets);
}

// --- 4. Régularité ---

/** Semaines consécutives (lundi → dimanche) avec au moins une séance : en cours (la semaine courante ne casse pas la série) et record. */
export function weekStreaks(sessions: StrengthSession[], today: string): { current: number; best: number } {
  const active = new Set(sessions.filter((s) => s.date <= today).map((s) => startOfWeek(s.date)));
  if (!active.size) return { current: 0, best: 0 };
  const thisWeek = startOfWeek(today);
  let current = 0;
  for (let w = active.has(thisWeek) ? thisWeek : addDays(thisWeek, -7); active.has(w); w = addDays(w, -7)) current++;
  let best = 0;
  let run = 0;
  const ordered = [...active].sort();
  for (let i = 0; i < ordered.length; i++) {
    run = i > 0 && daysBetween(ordered[i - 1], ordered[i]) === 7 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return { current, best };
}

export interface HeatCell {
  date: string;
  count: number;
  future: boolean;
}

/** Calendrier des `weeks` dernières semaines (une colonne par semaine, lundi → dimanche) avec le nombre de séances par jour. */
export function sessionHeatmap(sessions: StrengthSession[], today: string, weeks: number): HeatCell[][] {
  const counts = new Map<string, number>();
  for (const s of sessions) counts.set(s.date, (counts.get(s.date) ?? 0) + 1);
  const first = addDays(startOfWeek(today), -7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(first, 7 * w + d);
      return { date, count: counts.get(date) ?? 0, future: date > today };
    }),
  );
}

export interface SessionDensity {
  date: string;
  title: string;
  minutes: number;
  volume: number;
  /** kg soulevés par minute. */
  density: number;
}

/** Durée et densité (kg / min) de chaque séance dont la durée est connue. */
export function sessionDensity(sessions: StrengthSession[]): SessionDensity[] {
  return [...sessions]
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .filter((s) => (s.minutes ?? 0) > 0 && sessionVolume(s) > 0)
    .map((s) => ({ date: s.date, title: s.title, minutes: s.minutes!, volume: sessionVolume(s), density: sessionVolume(s) / s.minutes! }));
}
