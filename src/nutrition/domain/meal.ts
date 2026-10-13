import type { Unit } from './food';
import type { Nutrients } from './nutrients';

export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';

export const MEALS: { key: MealType; label: string }[] = [
  { key: 'breakfast', label: 'Petit-déjeuner' },
  { key: 'lunch', label: 'Déjeuner' },
  { key: 'snack', label: 'Collation' },
  { key: 'dinner', label: 'Dîner' },
];

export interface Portion {
  foodId: string;
  quantity: number;
}

export interface MealTemplate {
  id: string;
  name: string;
  items: Portion[];
}

/** Aliment consommé. Les valeurs nutritionnelles sont figées au moment de la saisie. */
export interface LogItem extends Nutrients {
  id: string;
  date: string;
  meal: MealType;
  foodId?: string;
  name: string;
  quantity: number;
  unit: Unit;
}
