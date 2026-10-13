import { addDays, startOfWeek } from '../../shared/kernel/dates';
import { normalize } from '../../shared/kernel/text';
import type { StrengthExercise, StrengthSession, StrengthSet } from './session';

// Musculation : indicateurs (volume, 1RM estimé, records, répartition).

/** Séries de travail : les échauffements et les séries vides ne comptent pas. */
export const workSets = (e: StrengthExercise) => e.sets.filter((s) => s.type !== 'warmup' && (s.reps > 0 || (s.seconds ?? 0) > 0));

export const setVolume = (s: StrengthSet) => s.weight * s.reps;

/** 1RM estimé (formule d'Epley). Sans charge ajoutée (poids du corps), vaut 0. */
export const estimate1RM = (weight: number, reps: number) => (weight <= 0 || reps <= 0 ? 0 : reps === 1 ? weight : weight * (1 + reps / 30));

export const sessionVolume = (s: StrengthSession) => s.exercises.reduce((v, e) => v + workSets(e).reduce((a, x) => a + setVolume(x), 0), 0);
export const sessionSets = (s: StrengthSession) => s.exercises.reduce((n, e) => n + workSets(e).length, 0);
export const sessionReps = (s: StrengthSession) => s.exercises.reduce((n, e) => n + workSets(e).reduce((a, x) => a + x.reps, 0), 0);

export interface WeekVolume {
  week: string;
  volume: number;
  sessions: number;
  sets: number;
}

/** Volume par semaine (lundi → dimanche) sur les `weeks` dernières semaines, semaines vides incluses. */
export function weeklyVolume(sessions: StrengthSession[], today: string, weeks: number): WeekVolume[] {
  const first = addDays(startOfWeek(today), -7 * (weeks - 1));
  const out: WeekVolume[] = Array.from({ length: weeks }, (_, i) => ({ week: addDays(first, 7 * i), volume: 0, sessions: 0, sets: 0 }));
  for (const s of sessions) {
    const i = Math.round((Date.parse(startOfWeek(s.date)) - Date.parse(first)) / (7 * 86400000));
    if (i < 0 || i >= weeks) continue;
    out[i].volume += sessionVolume(s);
    out[i].sets += sessionSets(s);
    out[i].sessions++;
  }
  return out;
}

export interface ExercisePoint {
  date: string;
  e1rm: number;
  maxWeight: number;
  volume: number;
}

/** Évolution d'un exercice, une valeur par séance (meilleur 1RM estimé, charge max, volume). */
export function exerciseHistory(sessions: StrengthSession[], name: string): ExercisePoint[] {
  const points: ExercisePoint[] = [];
  for (const s of sessions) {
    const sets = s.exercises.filter((e) => e.name === name).flatMap(workSets);
    if (!sets.length) continue;
    points.push({
      date: s.date,
      e1rm: Math.max(...sets.map((x) => estimate1RM(x.weight, x.reps))),
      maxWeight: Math.max(...sets.map((x) => x.weight)),
      volume: sets.reduce((v, x) => v + setVolume(x), 0),
    });
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

/** Exercices triés par nombre de séries de travail décroissant. */
export function exerciseNames(sessions: StrengthSession[]): string[] {
  const count = new Map<string, number>();
  for (const s of sessions) for (const e of s.exercises) count.set(e.name, (count.get(e.name) ?? 0) + workSets(e).length);
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([n]) => n);
}

export interface ExerciseRecord {
  name: string;
  maxWeight: number;
  best1RM: number;
  /** Date du record de 1RM estimé. */
  best1RMDate: string;
  bestSet: number;
  sets: number;
  lastDate: string;
}

export function records(sessions: StrengthSession[]): ExerciseRecord[] {
  const map = new Map<string, ExerciseRecord>();
  for (const s of sessions) {
    for (const e of s.exercises) {
      for (const x of workSets(e)) {
        const r = map.get(e.name) ?? { name: e.name, maxWeight: 0, best1RM: 0, best1RMDate: '', bestSet: 0, sets: 0, lastDate: '' };
        r.sets++;
        r.maxWeight = Math.max(r.maxWeight, x.weight);
        r.bestSet = Math.max(r.bestSet, setVolume(x));
        const est = estimate1RM(x.weight, x.reps);
        if (est > r.best1RM) {
          r.best1RM = est;
          r.best1RMDate = s.date;
        }
        if (s.date > r.lastDate) r.lastDate = s.date;
        map.set(e.name, r);
      }
    }
  }
  return [...map.values()].sort((a, b) => b.sets - a.sets || a.name.localeCompare(b.name));
}

// --- Groupes musculaires (déduits du nom de l'exercice, en français ou en anglais) ---

export const MUSCLE_GROUPS = ['Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps', 'Jambes', 'Abdos', 'Autre'] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

const MUSCLE_RULES: [MuscleGroup, RegExp][] = [
  ['Jambes', /squat|leg |leg$|presse|lunge|fente|calf|mollet|hip thrust|glute|ischio|quadri|souleve de terre roumain|romanian|hack/],
  ['Biceps', /curl|biceps/],
  ['Triceps', /triceps|pushdown|skull|\bdips?\b|barre au front|kickback/],
  ['Épaules', /shoulder|overhead|military|militaire|lateral raise|elevations? lat|epaule|arnold|oiseau|rear delt|face pull|upright/],
  ['Pectoraux', /bench|developpe (couche|incline)|chest|pec|\bfly\b|flyes|ecarte|push.?up|pompe|decline/],
  ['Dos', /row|pull|\blat\b|tirage|traction|rowing|deadlift|souleve|shrug|back ext|lombaire|pulldown/],
  ['Abdos', /crunch|plank|\babs?\b|gainage|ab wheel|sit.?up|releve de jambes|leg raise|abdo/],
];

export function muscleOf(exercise: string): MuscleGroup {
  const n = normalize(exercise);
  for (const [group, re] of MUSCLE_RULES) if (re.test(n)) return group;
  return 'Autre';
}

/** Nombre de séries de travail par groupe musculaire. */
export function setsByMuscle(sessions: StrengthSession[]): { group: MuscleGroup; sets: number }[] {
  const count = new Map<MuscleGroup, number>();
  for (const s of sessions) for (const e of s.exercises) count.set(muscleOf(e.name), (count.get(muscleOf(e.name)) ?? 0) + workSets(e).length);
  return MUSCLE_GROUPS.map((group) => ({ group, sets: count.get(group) ?? 0 }))
    .filter((x) => x.sets > 0)
    .sort((a, b) => b.sets - a.sets);
}

/** Part des séries de travail par plage de répétitions : force (1-5), hypertrophie (6-12), endurance (13+). */
export function repZones(sessions: StrengthSession[]) {
  const zones = { strength: 0, hypertrophy: 0, endurance: 0 };
  for (const s of sessions) {
    for (const e of s.exercises) {
      for (const x of workSets(e).filter((y) => y.reps > 0)) zones[x.reps <= 5 ? 'strength' : x.reps <= 12 ? 'hypertrophy' : 'endurance']++;
    }
  }
  return zones;
}
