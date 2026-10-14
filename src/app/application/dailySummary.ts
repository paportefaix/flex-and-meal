import { DEFAULT_WEIGHT_KG, weightOn } from '../body/domain/weight';
import { sumNutrients } from '../nutrition/domain/nutrients';
import { strengthKcal, strengthMinutes } from '../training/domain/energy';
import type { AppData } from './appData';

/** Bilan d'une journée : calories consommées (nutrition) moins calories dépensées (cardio + musculation). */
export function dayTotals(data: AppData, date: string) {
  const items = data.log.filter((i) => i.date === date);
  const workouts = data.workouts.filter((w) => w.date === date);
  const strength = data.strength.filter((s) => s.date === date);
  const intake = sumNutrients(items);
  const weight = strength.length ? weightOn(data.weights, date) : DEFAULT_WEIGHT_KG;
  const strengthBurned = strength.reduce((s, x) => s + strengthKcal(x, weight), 0);
  const burned = workouts.reduce((s, w) => s + w.kcal, 0) + strengthBurned;
  const minutes = workouts.reduce((s, w) => s + w.duration, 0) + strength.reduce((s, x) => s + strengthMinutes(x), 0);
  return {
    items,
    workouts,
    strength,
    strengthBurned,
    /** Nombre total de séances du jour (saisies à la main + musculation importée). */
    sessions: workouts.length + strength.length,
    intake,
    burned,
    minutes,
    net: intake.kcal - burned,
    hasEntries: items.length > 0,
  };
}
