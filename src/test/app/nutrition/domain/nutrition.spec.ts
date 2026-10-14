import { describe, expect, it } from 'vitest';
import { suggestMacroGoals } from '../../../../app/settings/domain/settings';
import type { Food } from '../../../../app/nutrition/domain/food';
import { macroSplit, portionNutrients, sumNutrients } from '../../../../app/nutrition/domain/nutrients';

describe('nutrition', () => {
  const rice: Food = { id: 'r', name: 'Riz', unit: 'g', kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 };
  const egg: Food = { id: 'e', name: 'Œuf', unit: 'unité', kcal: 70, protein: 6 };

  it('portionNutrients ramène les valeurs pour 100 g à la quantité', () => {
    const n = portionNutrients(rice, 200);
    expect(n.kcal).toBeCloseTo(260);
    expect(n.protein).toBeCloseTo(5.4);
    expect(n.carbs).toBeCloseTo(56);
  });

  it('portionNutrients multiplie par la quantité pour une unité et traite les macros absentes comme 0', () => {
    expect(portionNutrients(egg, 3)).toEqual({ kcal: 210, protein: 18, carbs: 0, fat: 0 });
  });

  it('sumNutrients additionne et vaut zéro sur une liste vide', () => {
    expect(sumNutrients([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
    expect(
      sumNutrients([
        { kcal: 1, protein: 2, carbs: 3, fat: 4 },
        { kcal: 10, protein: 20, carbs: 30, fat: 40 },
      ]),
    ).toEqual({ kcal: 11, protein: 22, carbs: 33, fat: 44 });
  });

  it('macroSplit répartit sur la base 4/4/9 et vaut null sans calories', () => {
    expect(macroSplit({ kcal: 0, protein: 0, carbs: 0, fat: 0 })).toBeNull();
    const s = macroSplit({ kcal: 0, protein: 25, carbs: 25, fat: 0 })!;
    expect(s.protein).toBeCloseTo(50);
    expect(s.carbs).toBeCloseTo(50);
    expect(s.fat).toBe(0);
    const total = macroSplit({ kcal: 0, protein: 30, carbs: 50, fat: 20 })!;
    expect(total.protein + total.carbs + total.fat).toBeCloseTo(100);
  });

  it('suggestMacroGoals : 1,8 g/kg de protéines, 28 % de lipides, reste en glucides', () => {
    expect(suggestMacroGoals({ kcalGoal: 2000 }, 70)).toEqual({ protein: 126, fat: 62, carbs: 235 });
  });

  it('suggestMacroGoals ne renvoie jamais de glucides négatifs', () => {
    expect(suggestMacroGoals({ kcalGoal: 500 }, 120).carbs).toBe(0);
  });
});

