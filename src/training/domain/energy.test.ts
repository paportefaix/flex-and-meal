import { describe, expect, it } from 'vitest';
import { cardioKcal, strengthKcal } from './energy';

describe('calories brûlées : musculation et cardio', () => {
  const session = { id: 's', date: '2025-06-10', title: 'Haut du corps', minutes: 60, exercises: [{ name: 'Squat', sets: [{ type: 'normal' as const, weight: 80, reps: 5 }] }] };

  it('estime la musculation avec MET × poids × durée', () => {
    expect(strengthKcal(session, 75)).toBe(300);
  });

  it('sans durée enregistrée, estime 2,5 min par série', () => {
    expect(strengthKcal({ ...session, minutes: undefined }, 60)).toBeCloseTo(4 * 60 * (2.5 / 60));
  });

  it('cardioKcal estime les activités connues, pas les autres', () => {
    expect(cardioKcal('course à pied', 30, 70)).toBe(Math.round((9.8 * 70 * 30) / 60));
    expect(cardioKcal('Pétanque', 30, 70)).toBeNull();
  });
});
