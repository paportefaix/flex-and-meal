import { describe, expect, it } from 'vitest';
import type { AppData } from './appData';
import { dayTotals } from './dailySummary';

const emptyData = (over: Partial<AppData> = {}): AppData => ({
  version: 1,
  foods: [],
  templates: [],
  log: [],
  workouts: [],
  strength: [],
  weights: [],
  measurements: [],
  settings: { kcalGoal: 2000 },
  ...over,
});

describe('dayTotals', () => {
  it('agrège consommation, sport et bilan net du jour demandé uniquement', () => {
    const data = emptyData({
      log: [
        { id: '1', date: '2025-06-10', meal: 'lunch', name: 'A', quantity: 1, unit: 'unité', kcal: 500, protein: 20, carbs: 50, fat: 10 },
        { id: '2', date: '2025-06-10', meal: 'dinner', name: 'B', quantity: 1, unit: 'unité', kcal: 700, protein: 30, carbs: 60, fat: 20 },
        { id: '3', date: '2025-06-11', meal: 'dinner', name: 'C', quantity: 1, unit: 'unité', kcal: 999, protein: 0, carbs: 0, fat: 0 },
      ],
      workouts: [
        { id: 'w1', date: '2025-06-10', activity: 'Course', duration: 30, kcal: 300 },
        { id: 'w2', date: '2025-06-11', activity: 'Vélo', duration: 60, kcal: 500 },
      ],
    });
    const t = dayTotals(data, '2025-06-10');
    expect(t.intake.kcal).toBe(1200);
    expect(t.intake.protein).toBe(50);
    expect(t.burned).toBe(300);
    expect(t.minutes).toBe(30);
    expect(t.net).toBe(900);
    expect(t.hasEntries).toBe(true);
  });

  it('hasEntries est faux sans aliment, même avec du sport', () => {
    const data = emptyData({ workouts: [{ id: 'w', date: '2025-06-10', activity: 'x', duration: 10, kcal: 100 }] });
    const t = dayTotals(data, '2025-06-10');
    expect(t.hasEntries).toBe(false);
    expect(t.net).toBe(-100);
  });

  it('ajoute la musculation aux calories brûlées, au temps et au nombre de séances', () => {
    const session = { id: 's', date: '2025-06-10', title: 'Haut du corps', minutes: 60, exercises: [{ name: 'Squat', sets: [{ type: 'normal' as const, weight: 80, reps: 5 }] }] };
    const data = emptyData({
      strength: [session],
      weights: [{ id: 'a', date: '2025-06-01', weight: 75 }],
      workouts: [{ id: 'w', date: '2025-06-10', activity: 'Course', duration: 30, kcal: 300 }],
    });
    const t = dayTotals(data, '2025-06-10');
    expect(t.burned).toBe(600);
    expect(t.minutes).toBe(90);
    expect(t.sessions).toBe(2);
    expect(dayTotals(data, '2025-06-11').burned).toBe(0);
  });
});
