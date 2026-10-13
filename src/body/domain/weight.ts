import { byDate } from '../../shared/kernel/dates';

export interface WeightEntry {
  id: string;
  date: string;
  weight: number;
}

export const DEFAULT_WEIGHT_KG = 70;

/** Dernier poids connu à la date donnée (à défaut, la première pesée, puis une valeur par défaut). */
export function weightOn(weights: WeightEntry[], date: string): number {
  const sorted = [...weights].sort(byDate);
  const before = sorted.filter((w) => w.date <= date);
  return (before[before.length - 1] ?? sorted[0])?.weight ?? DEFAULT_WEIGHT_KG;
}
