import { describe, expect, it } from 'vitest';
import type { StrengthSession } from '../../../../app/training/domain/session';
import { estimate1RM, exerciseHistory, muscleOf, records, repZones, sessionVolume, weeklyVolume } from '../../../../app/training/domain/strength';

const session = (date: string, sets: [number, number][], type: 'normal' | 'warmup' = 'normal'): StrengthSession => ({
  id: date,
  date,
  title: 'T',
  exercises: [{ name: 'Squat (Barbell)', sets: sets.map(([weight, reps]) => ({ type, weight, reps })) }],
});

describe('indicateurs', () => {
  it('estimate1RM suit Epley et ignore le poids du corps', () => {
    expect(estimate1RM(100, 1)).toBe(100);
    expect(estimate1RM(100, 3)).toBeCloseTo(110);
    expect(estimate1RM(0, 10)).toBe(0);
  });

  it('le volume exclut les échauffements', () => {
    const s = session('2026-10-13', [[60, 10], [100, 5]]);
    s.exercises.push({ name: 'Squat (Barbell)', sets: [{ type: 'warmup', weight: 20, reps: 10 }] });
    expect(sessionVolume(s)).toBe(1100);
  });

  it('weeklyVolume range les séances par semaine et inclut les semaines vides', () => {
    // 2026-10-13 est un mardi : semaine du lundi 2026-10-12.
    const w = weeklyVolume([session('2026-10-13', [[50, 10]]), session('2026-10-18', [[50, 10]]), session('2026-10-05', [[10, 10]])], '2026-10-14', 3);
    expect(w.map((x) => x.week)).toEqual(['2026-09-28', '2026-10-05', '2026-10-12']);
    expect(w.map((x) => x.volume)).toEqual([0, 100, 1000]);
    expect(w.map((x) => x.sessions)).toEqual([0, 1, 2]);
  });

  it('exerciseHistory et records donnent le meilleur 1RM estimé', () => {
    const list = [session('2026-10-01', [[100, 5]]), session('2026-10-08', [[110, 3], [90, 8]])];
    const h = exerciseHistory(list, 'Squat (Barbell)');
    expect(h.map((p) => p.maxWeight)).toEqual([100, 110]);
    const r = records(list)[0];
    expect(r.maxWeight).toBe(110);
    expect(r.best1RMDate).toBe('2026-10-08');
    expect(r.sets).toBe(3);
  });

  it('muscleOf reconnaît des noms français et anglais', () => {
    expect(muscleOf('Bench Press (Barbell)')).toBe('Pectoraux');
    expect(muscleOf('Développé couché')).toBe('Pectoraux');
    expect(muscleOf('Leg Curl')).toBe('Jambes');
    expect(muscleOf('Curl biceps')).toBe('Biceps');
    expect(muscleOf('Tirage horizontal')).toBe('Dos');
    expect(muscleOf('Élévations latérales')).toBe('Épaules');
    expect(muscleOf('Truc inconnu')).toBe('Autre');
  });

  it('repZones classe les séries par plage de répétitions', () => {
    expect(repZones([session('2026-10-01', [[100, 3], [80, 10], [50, 15], [60, 12]])])).toEqual({ strength: 1, hypertrophy: 2, endurance: 1 });
  });
});

