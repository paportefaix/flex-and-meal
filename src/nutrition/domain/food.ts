export type Unit = 'g' | 'ml' | 'unité';

export const UNITS: Unit[] = ['g', 'ml', 'unité'];
export const unitBasis = (u: Unit) => (u === 'unité' ? 'par unité' : `pour 100 ${u}`);

/** Valeurs nutritionnelles pour 100 g / 100 ml, ou pour 1 unité. */
export interface Food {
  id: string;
  name: string;
  unit: Unit;
  kcal: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

/** Aliment de la table de référence CIQUAL (ANSES), pour 100 g. */
export interface CiqualFood extends Food {
  group: string;
}

// Valeurs approximatives (table Ciqual) pour démarrer ; modifiables dans « Aliments ».
export const SEED_FOODS: Omit<Food, 'id'>[] = [
  { name: 'Blanc de poulet cuit', unit: 'g', kcal: 121, protein: 26, carbs: 0, fat: 1.8 },
  { name: 'Riz blanc cuit', unit: 'g', kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  { name: 'Pâtes cuites', unit: 'g', kcal: 157, protein: 5.5, carbs: 31, fat: 0.9 },
  { name: 'Pain complet', unit: 'g', kcal: 243, protein: 9, carbs: 41, fat: 3 },
  { name: "Flocons d'avoine", unit: 'g', kcal: 372, protein: 13, carbs: 59, fat: 7 },
  { name: 'Œuf', unit: 'unité', kcal: 75, protein: 6.5, carbs: 0.4, fat: 5.2 },
  { name: 'Banane', unit: 'unité', kcal: 105, protein: 1.3, carbs: 27, fat: 0.4 },
  { name: 'Pomme', unit: 'unité', kcal: 80, protein: 0.4, carbs: 19, fat: 0.3 },
  { name: 'Yaourt nature', unit: 'unité', kcal: 60, protein: 5, carbs: 6, fat: 1.5 },
  { name: 'Lait demi-écrémé', unit: 'ml', kcal: 46, protein: 3.3, carbs: 4.8, fat: 1.6 },
  { name: "Huile d'olive", unit: 'ml', kcal: 824, protein: 0, carbs: 0, fat: 91.6 },
  { name: 'Brocoli cuit', unit: 'g', kcal: 35, protein: 2.4, carbs: 4, fat: 0.4 },
  { name: 'Saumon cuit', unit: 'g', kcal: 206, protein: 22, carbs: 0, fat: 13 },
  { name: 'Fromage blanc 0%', unit: 'g', kcal: 47, protein: 7.5, carbs: 4, fat: 0.1 },
  { name: 'Amandes', unit: 'g', kcal: 634, protein: 25, carbs: 8.8, fat: 53 },
];
