import { describe, expect, it } from 'vitest';
import type { StrengthSession, StrengthSet } from '../../../../app/training/domain/session';
import { exerciseTrends, isHardSet, muscleSummary, sessionDensity, sessionHeatmap, weekStreaks, weeklyMuscleLoad } from '../../../../app/training/domain/strengthAnalysis';

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
const BENCH = 'Bench Press (Barbell)';

describe('exerciseTrends', () => {
  it('mesure la variation à 4 et 12 semaines par rapport à la séance connue à l’époque', () => {
    const list = [
      session('2026-07-15', [[SQUAT, [set(100, 1)]]]), // il y a 13 semaines
      session('2026-09-10', [[SQUAT, [set(100, 1)]]]), // il y a ~5 semaines
      session('2026-10-13', [[SQUAT, [set(110, 1)]]]),
    ];
    const [t] = exerciseTrends(list, TODAY);
    expect(t).toMatchObject({ name: SQUAT, unit: 'kg', current: 110, best: 110, sessions: 3, status: 'up' });
    expect(t.delta4).toBeCloseTo(10);
    expect(t.delta12).toBeCloseTo(10);
  });

  it('renvoie null sans historique assez ancien', () => {
    const [t] = exerciseTrends([session('2026-10-06', [[SQUAT, [set(100, 1)]]]), session('2026-10-13', [[SQUAT, [set(110, 1)]]])], TODAY);
    expect(t.delta4).toBeNull();
    expect(t.delta12).toBeNull();
    expect(t.status).toBe('new');
  });

  it('détecte un plateau : plusieurs séances sans battre le meilleur résultat, depuis au moins 3 semaines', () => {
    const list = [
      session('2026-08-20', [[BENCH, [set(80, 5)]]]),
      session('2026-09-03', [[BENCH, [set(85, 5)]]]),
      session('2026-09-10', [[BENCH, [set(80, 5)]]]),
      session('2026-09-17', [[BENCH, [set(80, 5)]]]),
      session('2026-09-24', [[BENCH, [set(80, 5)]]]),
      session('2026-10-08', [[BENCH, [set(85, 5)]]]),
    ];
    const [t] = exerciseTrends(list, TODAY);
    expect(t.status).toBe('up'); // le meilleur est égalé le 8 octobre : pas de plateau
    const stalled = exerciseTrends([...list.slice(0, 5), session('2026-10-08', [[BENCH, [set(80, 5)]]])], TODAY)[0];
    expect(stalled).toMatchObject({ sinceBest: 4, bestDate: '2026-09-03', status: 'plateau' });
  });

  it('signale une baisse', () => {
    const list = [
      session('2026-09-01', [[SQUAT, [set(100, 5)]]]),
      session('2026-09-08', [[SQUAT, [set(100, 5)]]]),
      session('2026-09-15', [[SQUAT, [set(100, 5)]]]),
      session('2026-10-13', [[SQUAT, [set(90, 5)]]]),
    ];
    expect(exerciseTrends(list, TODAY)[0]).toMatchObject({ status: 'down' });
  });

  it('marque inactif un exercice non refait depuis plus de 5 semaines', () => {
    expect(exerciseTrends([session('2026-08-01', [[SQUAT, [set(100, 5)]]])], TODAY)[0]).toMatchObject({ status: 'inactive', delta4: null });
  });

  it('suit les répétitions pour un exercice au poids du corps et ignore les échauffements', () => {
    const warm = set(20, 10, { type: 'warmup' });
    const [t] = exerciseTrends([session('2026-10-13', [['Pull Up', [warm, set(0, 8), set(0, 10)]]])], TODAY);
    expect(t).toMatchObject({ unit: 'reps', current: 10 });
  });
});

describe('charge par muscle', () => {
  const list = [
    session('2026-10-05', [[BENCH, [set(60, 8, { rpe: 8 }), set(60, 8, { rpe: 7 })]], ['Curl biceps', [set(15, 10)]]]),
    session('2026-10-13', [[BENCH, [set(60, 8, { type: 'failure' }), set(20, 10, { type: 'warmup' })]], [SQUAT, [set(100, 5, { rpe: 9 })]]]),
    session('2026-10-14', [[BENCH, [set(50, 10)]]]),
  ];

  it('range séries et tonnage par groupe et par semaine', () => {
    const w = weeklyMuscleLoad(list, TODAY, 2);
    expect(w.map((x) => x.week)).toEqual(['2026-10-05', '2026-10-12']);
    expect(w[0].sets.Pectoraux).toBe(2);
    expect(w[0].sets.Biceps).toBe(1);
    expect(w[1].sets).toMatchObject({ Pectoraux: 2, Jambes: 1 });
    expect(w[1].volume.Jambes).toBe(500);
    expect(w[1]).toMatchObject({ totalSets: 3, hardSets: 2, ratedSets: 2 });
  });

  it('compte séries dures et fréquence (jours distincts par semaine)', () => {
    expect(isHardSet(set(1, 1, { rpe: 7.5 }))).toBe(false);
    expect(isHardSet(set(1, 1, { rpe: 8 }))).toBe(true);
    const rows = muscleSummary(list, 2);
    const chest = rows.find((r) => r.group === 'Pectoraux')!;
    expect(chest).toMatchObject({ sets: 4, hardSets: 2, days: 3 });
    expect(chest.setsPerWeek).toBe(2);
    expect(chest.perWeek).toBe(1.5);
    expect(rows.map((r) => r.group)).not.toContain('Dos');
  });
});

describe('régularité', () => {
  const at = (date: string) => session(date, [[SQUAT, [set(50, 5)]]]);

  it('la série en cours ne casse pas tant que la semaine courante n’est pas finie', () => {
    // semaines du 28/09, 05/10 : séances ; 12/10 (semaine en cours) : aucune pour l'instant.
    expect(weekStreaks([at('2026-09-29'), at('2026-10-06')], TODAY)).toEqual({ current: 2, best: 2 });
    expect(weekStreaks([at('2026-09-29'), at('2026-10-06'), at('2026-10-13')], TODAY)).toEqual({ current: 3, best: 3 });
  });

  it('retombe à zéro après une semaine complète sans séance et garde le record', () => {
    const list = [at('2026-08-04'), at('2026-08-11'), at('2026-08-18'), at('2026-10-06')];
    expect(weekStreaks(list, TODAY)).toEqual({ current: 1, best: 3 });
    expect(weekStreaks([at('2026-08-04')], TODAY)).toEqual({ current: 0, best: 1 });
    expect(weekStreaks([], TODAY)).toEqual({ current: 0, best: 0 });
  });

  it('heatmap : une colonne par semaine, 7 jours, futur marqué', () => {
    const h = sessionHeatmap([at('2026-10-13'), at('2026-10-13'), at('2026-10-05')], TODAY, 2);
    expect(h).toHaveLength(2);
    expect(h[1].map((c) => c.date)[0]).toBe('2026-10-12');
    expect(h[1][1]).toMatchObject({ date: '2026-10-13', count: 2, future: false });
    expect(h[1][3]).toMatchObject({ date: '2026-10-15', future: true });
    expect(h[0][0]).toMatchObject({ date: '2026-10-05', count: 1 });
  });

  it('densité : kg par minute, séances sans durée ignorées', () => {
    const d = sessionDensity([session('2026-10-13', [[SQUAT, [set(100, 10)]]], 50), session('2026-10-12', [[SQUAT, [set(100, 10)]]])]);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ minutes: 50, volume: 1000, density: 20 });
  });
});
