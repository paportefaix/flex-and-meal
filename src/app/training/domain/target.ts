// Objectif annoté par l'utilisateur pour un exercice : poids visé, nombre de séries et fourchette de répétitions.
// Stocké à part des séances (indexé par nom d'exercice) pour survivre aux réimports Hevy.

export interface ExerciseTarget {
  /** Nom de l'exercice tel qu'il apparaît dans les séances. */
  id: string;
  /** Nombre de séries (entier). */
  sets: number;
  /** Répétitions minimum de la fourchette (entier). */
  minReps: number;
  /** Répétitions maximum de la fourchette (entier). */
  maxReps: number;
  /** Charge visée en kg (décimal ; absente des objectifs antérieurs). */
  weight?: number;
}

export const MAX_TARGET_SETS = 20;
export const MAX_TARGET_REPS = 100;
export const MAX_TARGET_WEIGHT = 1000;

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export function isValidTarget(t: unknown): t is ExerciseTarget {
  const x = t as ExerciseTarget | null;
  return (
    !!x &&
    typeof x.id === 'string' &&
    x.id !== '' &&
    isInt(x.sets) &&
    isInt(x.minReps) &&
    isInt(x.maxReps) &&
    x.sets >= 1 &&
    x.sets <= MAX_TARGET_SETS &&
    x.minReps >= 1 &&
    x.minReps <= x.maxReps &&
    x.maxReps <= MAX_TARGET_REPS &&
    (x.weight === undefined || (isNum(x.weight) && x.weight > 0 && x.weight <= MAX_TARGET_WEIGHT))
  );
}

const isBlank = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/** Convertit une saisie texte en nombre (virgule décimale acceptée) ; les valeurs non textuelles passent telles quelles. */
const toNum = (v: unknown) => (typeof v === 'string' ? (v.trim() === '' ? v : Number(v.trim().replace(',', '.'))) : v);

/** Construit un objectif à partir de saisies brutes ; `null` si elles sont incomplètes ou incohérentes. Le poids est facultatif. */
export function makeTarget(name: string, sets: unknown, minReps: unknown, maxReps: unknown, weight?: unknown): ExerciseTarget | null {
  const base = { id: name, sets: toNum(sets), minReps: toNum(minReps), maxReps: toNum(maxReps) };
  const t = isBlank(weight) ? base : { ...base, weight: toNum(weight) };
  return isValidTarget(t) ? t : null;
}

/** Remplace l'objectif de l'exercice (ou l'ajoute) ; `null` le supprime. */
export function setTarget(targets: ExerciseTarget[], name: string, target: ExerciseTarget | null): ExerciseTarget[] {
  const rest = targets.filter((t) => t.id !== name);
  return target ? [...rest, target] : rest;
}
