import type { Food } from './food';

export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export type MacroKey = 'protein' | 'carbs' | 'fat';

export const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export function portionNutrients(food: Food, quantity: number): Nutrients {
  const f = food.unit === 'unité' ? quantity : quantity / 100;
  return {
    kcal: food.kcal * f,
    protein: (food.protein ?? 0) * f,
    carbs: (food.carbs ?? 0) * f,
    fat: (food.fat ?? 0) * f,
  };
}

export const sumNutrients = (items: Nutrients[]): Nutrients =>
  items.reduce(
    (a, b) => ({ kcal: a.kcal + b.kcal, protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fat: a.fat + b.fat }),
    ZERO,
  );

export const MACROS: { key: MacroKey; label: string; goalKey: 'proteinGoal' | 'carbsGoal' | 'fatGoal'; kcalPerG: number; color: string }[] = [
  { key: 'protein', label: 'Protéines', goalKey: 'proteinGoal', kcalPerG: 4, color: '#4f7cff' },
  { key: 'carbs', label: 'Glucides', goalKey: 'carbsGoal', kcalPerG: 4, color: '#f59e0b' },
  { key: 'fat', label: 'Lipides', goalKey: 'fatGoal', kcalPerG: 9, color: '#a855f7' },
];

/** Répartition des calories entre macros (en %), sur la base 4/4/9 kcal par gramme. */
export function macroSplit(n: Nutrients): Record<MacroKey, number> | null {
  const total = MACROS.reduce((s, m) => s + n[m.key] * m.kcalPerG, 0);
  if (total <= 0) return null;
  const pct = (k: MacroKey) => (n[k] * MACROS.find((m) => m.key === k)!.kcalPerG * 100) / total;
  return { protein: pct('protein'), carbs: pct('carbs'), fat: pct('fat') };
}
