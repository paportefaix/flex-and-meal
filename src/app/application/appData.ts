import type { Measurement } from '../body/domain/measurement';
import type { WeightEntry } from '../body/domain/weight';
import { SEED_FOODS, type Food } from '../nutrition/domain/food';
import type { LogItem, MealTemplate } from '../nutrition/domain/meal';
import { DEFAULT_KCAL_GOAL, type Settings } from '../settings/domain/settings';
import { uid } from '../shared/kernel/id';
import type { StrengthSession, Workout } from '../training/domain/session';

/** Agrégat racine : l'ensemble des données de l'utilisateur, tel que sauvegardé et exporté. */
export interface AppData {
  version: 1;
  foods: Food[];
  templates: MealTemplate[];
  log: LogItem[];
  workouts: Workout[];
  strength: StrengthSession[];
  weights: WeightEntry[];
  measurements: Measurement[];
  settings: Settings;
}

export const COLLECTIONS = ['foods', 'templates', 'log', 'workouts', 'strength', 'weights', 'measurements'] as const;

export const initialData = (): AppData => ({
  version: 1,
  foods: SEED_FOODS.map((f) => ({ ...f, id: uid() })),
  templates: [],
  log: [],
  workouts: [],
  strength: [],
  weights: [],
  measurements: [],
  settings: { kcalGoal: DEFAULT_KCAL_GOAL },
});

/** Lit une sauvegarde ou un export JSON. Les collections absentes (fichier antérieur à la musculation, par exemple) ou invalides sont remises à vide. */
export function parseData(raw: string): AppData {
  const parsed = JSON.parse(raw);
  if (parsed?.version !== 1) throw new Error('Format de données inconnu');
  const data: AppData = { ...initialData(), ...parsed };
  for (const c of COLLECTIONS) if (!Array.isArray(data[c])) (data as unknown as Record<string, unknown>)[c] = [];
  return data;
}
