import { workSets } from './strength';
import type { StrengthSession, StrengthSet } from './session';
import { exerciseTrends } from './strengthAnalysis';
import type { ExerciseTarget } from './target';

// Conseils de progression de charge par exercice (double progression), déduits de la dernière séance et de la tendance.
// Sans objectif annoté pour l'exercice (séries et fourchette de répétitions), on suppose 8 à 12 répétitions, valeurs usuelles en hypertrophie.

/** Au-dessus de ce nombre de répétitions sur chaque série, on augmente la charge. */
export const REP_CEILING = 12;
/** Séries notées RPE 7 ou moins : il restait au moins 3 répétitions en réserve. */
export const EASY_RPE = 7;
/** Répétitions minimales pour juger qu'une série facile justifie d'augmenter la charge. */
export const EASY_MIN_REPS = 8;
/** Part de la charge conservée pendant une semaine de décharge. */
export const DELOAD_RATIO = 0.9;

export type AdviceKind = 'increase' | 'sets' | 'reps' | 'hold' | 'deload';

export interface ProgressionAdvice {
  name: string;
  kind: AdviceKind;
  /** Charge de travail de la dernière séance (kg). */
  weight: number;
  /** Charge conseillée pour la prochaine séance (kg). */
  nextWeight: number;
  /** Répétitions à viser par série. */
  targetReps: number;
  /** Objectif annoté pour cet exercice, s'il existe. */
  target?: ExerciseTarget;
  message: string;
}

/** Pas de charge usuel : 2,5 kg (barre, machine) ; 1 kg pour les petites charges. */
export const loadStep = (weight: number) => (weight >= 20 ? 2.5 : 1);

const roundTo = (value: number, step: number) => Math.round(value / step) * step;
const kg = (n: number) => `${String(n).replace('.', ',')} kg`;

/** Ordre d'affichage des conseils : les plus actionnables d'abord. */
export const ORDER: Record<AdviceKind, number> = { increase: 0, sets: 1, reps: 2, hold: 3, deload: 4 };

/** Séries à la charge maximale de la dernière séance de l'exercice (hors échauffement). */
function lastTopSets(sessions: StrengthSession[], name: string): { weight: number; sets: StrengthSet[] } | null {
  const last = [...sessions]
    .filter((s) => s.exercises.some((e) => e.name === name && workSets(e).length))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .pop();
  if (!last) return null;
  const sets = last.exercises.filter((e) => e.name === name).flatMap(workSets);
  const weight = Math.max(...sets.map((s) => s.weight));
  return weight > 0 ? { weight, sets: sets.filter((s) => s.weight === weight) } : null;
}

/** Que faire à la prochaine séance, exercice par exercice. Seuls les exercices lestés, actifs et assez documentés sont conseillés. */
export function progressionAdvice(sessions: StrengthSession[], today: string, targets: ExerciseTarget[] = []): ProgressionAdvice[] {
  const out: ProgressionAdvice[] = [];
  for (const t of exerciseTrends(sessions, today)) {
    if (t.unit !== 'kg' || t.status === 'inactive' || t.status === 'new') continue;
    const top = lastTopSets(sessions, t.name);
    if (!top) continue;

    const { weight, sets } = top;
    const target = targets.find((x) => x.id === t.name);
    const ceiling = target?.maxReps ?? REP_CEILING;
    const floor = target?.minReps ?? EASY_MIN_REPS;
    const missing = target ? Math.max(0, target.sets - sets.length) : 0;
    const minReps = Math.min(...sets.map((s) => s.reps));
    const easy = sets.every((s) => s.rpe !== undefined && s.rpe <= EASY_RPE);
    const step = loadStep(weight);
    const base = { name: t.name, weight, target };
    const missingNote = missing ? ` Il te manque ${missing} série${missing > 1 ? 's' : ''} sur les ${target!.sets} visées.` : '';

    if (t.status === 'plateau') {
      const lighter = roundTo(weight * DELOAD_RATIO, step);
      out.push({
        ...base,
        kind: 'deload',
        nextWeight: lighter,
        targetReps: ceiling,
        message: `Plateau depuis ${t.sinceBest} séances : une semaine de décharge à ${kg(lighter)} pour ${ceiling} répétitions, puis remonte progressivement. Varier l'exercice ou la fourchette de répétitions peut aussi relancer la progression.`,
      });
    } else if (t.status === 'down') {
      out.push({
        ...base,
        kind: 'hold',
        nextWeight: weight,
        targetReps: minReps + 1,
        message: `Performance en baisse : garde ${kg(weight)} et cherche à retrouver tes répétitions avant d'augmenter. Vérifie sommeil, apport calorique et récupération.`,
      });
    } else if (minReps >= ceiling || (easy && minReps >= floor)) {
      const next = weight + step;
      const reason = minReps >= ceiling ? `Tu as fait ${minReps} répétitions ou plus sur chaque série à ${kg(weight)}` : `Séries jugées faciles (RPE ${EASY_RPE} ou moins) à ${kg(weight)}`;
      if (missing) {
        out.push({
          ...base,
          kind: 'sets',
          nextWeight: weight,
          targetReps: minReps,
          message: `${reason}, mais avec ${sets.length} série${sets.length > 1 ? 's' : ''} sur ${target!.sets} visées : complète d'abord tes séries, puis augmente la charge.`,
        });
      } else {
        out.push({ ...base, kind: 'increase', nextWeight: next, targetReps: floor, message: `${reason} : passe à ${kg(next)} et vise ${floor} répétitions.` });
      }
    } else {
      const below = target && minReps < floor ? ` Tu es sous le bas de ta fourchette (${floor} à ${ceiling}) : si cela dure, allège un peu.` : '';
      out.push({
        ...base,
        kind: 'reps',
        nextWeight: weight,
        targetReps: minReps + 1,
        message: `Garde ${kg(weight)} et vise ${minReps + 1} répétitions sur chaque série. Dès ${ceiling} répétitions partout, augmente la charge.${below}${missingNote}`,
      });
    }
  }
  return out.sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || a.name.localeCompare(b.name));
}
