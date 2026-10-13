export interface Settings {
  kcalGoal: number;
  heightCm?: number;
  targetWeight?: number;
  /** Objectifs de macronutriments, en grammes par jour. */
  proteinGoal?: number;
  carbsGoal?: number;
  fatGoal?: number;
}

export const DEFAULT_KCAL_GOAL = 2000;

/** Objectifs de macros proposés : 1,8 g de protéines par kg, 28 % de lipides, le reste en glucides. */
export function suggestMacroGoals(settings: Settings, weightKg: number) {
  const protein = Math.round(1.8 * weightKg);
  const fat = Math.round((settings.kcalGoal * 0.28) / 9);
  const carbs = Math.max(0, Math.round((settings.kcalGoal - protein * 4 - fat * 9) / 4));
  return { protein, carbs, fat };
}
