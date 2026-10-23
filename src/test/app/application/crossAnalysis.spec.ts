import { describe, expect, it } from 'vitest';
import type { StrengthSession, StrengthSet } from '../../../app/training/domain/session';
import type { AppData } from '../../../app/application/appData';
import { correlation, crossSummary, crossWeekly, forceVerdict } from '../../../app/application/crossAnalysis';

const TODAY = '2026-10-14'; // mercredi, semaine du lundi 2026-10-12

const set = (weight: number, reps: number, extra: Partial<StrengthSet> = {}): StrengthSet => ({ type: 'normal', weight, reps, ...extra });
const session = (date: string, exercises: [string, StrengthSet[]][], minutes?: number): StrengthSession => ({
  id: `${date}-${exercises.map((e) => e[0]).join('+')}`,
  date,
  title: 'T',
  minutes,
  exercises: exercises.map(([name, sets]) => ({ name, sets })),
});

const SQUAT = 'Squat (Barbell)';

describe('croisements', () => {
  const data = (over: Partial<AppData>): AppData => ({
    version: 1,
    foods: [],
    templates: [],
    log: [],
    workouts: [],
    strength: [],
    weights: [],
    measurements: [],
    targets: [],
    settings: { kcalGoal: 2000 },
    ...over,
  });
  const item = (date: string, kcal: number, protein: number) => ({ id: `${date}-${kcal}`, date, kcal, protein, carbs: 0, fat: 0 }) as AppData['log'][number];

  it('relie le 1RM, le poids de corps, la taille et la nutrition par semaine', () => {
    const d = data({
      strength: [session('2026-10-05', [[SQUAT, [set(100, 1)]]]), session('2026-10-13', [[SQUAT, [set(105, 1)]]])],
      weights: [{ id: 'a', date: '2026-10-01', weight: 80 }, { id: 'b', date: '2026-10-12', weight: 75 }],
      measurements: [{ id: 'm', date: '2026-10-06', values: { waist: 90 } }],
      log: [item('2026-10-12', 2000, 100), item('2026-10-13', 2200, 120), item('2026-10-14', 1800, 110), item('2026-10-05', 3000, 50)],
    });
    const [w1, w2] = crossWeekly(d, TODAY, 2, SQUAT);
    expect(w1).toMatchObject({ week: '2026-10-05', e1rm: 100, bodyWeight: 80, waist: 90, kcal: null, protein: null, volume: 100 });
    expect(w1.relative).toBeCloseTo(1.25);
    expect(w2).toMatchObject({ week: '2026-10-12', e1rm: 105, bodyWeight: 75, waist: null, kcal: 2000, protein: 110, volume: 105 });
    expect(w2.relative).toBeCloseTo(1.4);

    const s = crossSummary([w1, w2]);
    expect(s.e1rmPct).toBeCloseTo(5);
    expect(s.relativePct).toBeCloseTo(12);
    expect(s.bodyWeightPct).toBeCloseTo(-6.25);
  });

  it('sans pesée, le poids de corps et la force relative restent vides', () => {
    const d = data({ strength: [session('2026-10-13', [[SQUAT, [set(105, 1)]]])] });
    expect(crossWeekly(d, TODAY, 1, SQUAT)[0]).toMatchObject({ e1rm: 105, bodyWeight: null, relative: null });
  });

  it('correlation de Pearson', () => {
    expect(correlation([[1, 2], [2, 4], [3, 6], [4, 8], [5, 10], [6, 12]])).toBeCloseTo(1);
    expect(correlation([[1, 12], [2, 10], [3, 8], [4, 6], [5, 4], [6, 2]])).toBeCloseTo(-1);
    expect(correlation([[1, 2], [2, 4]])).toBeNull();
    expect(correlation([[1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6]])).toBeNull();
  });

  it('forceVerdict distingue perte de force et perte de poids', () => {
    const base = { e1rmPct: 0, relativePct: 0, bodyWeightPct: 0, waistDelta: null };
    expect(forceVerdict({ ...base, e1rmPct: -3, relativePct: 1, bodyWeightPct: -4 })).toMatch(/force relative tient/);
    expect(forceVerdict({ ...base, e1rmPct: 4, relativePct: 8, bodyWeightPct: -4 })).toMatch(/plus fort/);
    expect(forceVerdict({ ...base, e1rmPct: 3, relativePct: -3, bodyWeightPct: 6 })).toMatch(/moins vite que le poids/);
    expect(forceVerdict({ ...base, e1rmPct: 0.5, relativePct: 0.2, bodyWeightPct: 0 })).toMatch(/stable/);
    expect(forceVerdict({ ...base, e1rmPct: null, relativePct: null })).toBeNull();
  });
});

