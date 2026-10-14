import { describe, expect, it } from 'vitest';
import type { StrengthSession } from '../../../app/training/domain/session';
import { parseData, type AppData } from '../../../app/application/appData';

const session: StrengthSession = {
  id: 'hevy:2026-10-13 18:30|Push',
  date: '2026-10-13',
  title: 'Push',
  minutes: 65,
  exercises: [{ name: 'Bench Press (Barbell)', sets: [{ type: 'normal', weight: 60, reps: 8, rpe: 8 }, { type: 'warmup', weight: 20, reps: 10 }] }],
};

describe('export / import JSON', () => {
  it('conserve les séances de musculation (exactement ce que produit « Exporter » et la sauvegarde automatique)', () => {
    const data: AppData = { ...parseData(JSON.stringify({ version: 1 })), strength: [session], settings: { kcalGoal: 2200 } };
    const restored = parseData(JSON.stringify(data, null, 2));
    expect(restored.strength).toEqual([session]);
    expect(restored.settings.kcalGoal).toBe(2200);
  });

  it('lit un ancien fichier sans musculation et remet à vide une collection invalide', () => {
    expect(parseData(JSON.stringify({ version: 1, log: [], settings: { kcalGoal: 1800 } })).strength).toEqual([]);
    expect(parseData(JSON.stringify({ version: 1, strength: null, workouts: 'x' })).strength).toEqual([]);
    expect(parseData(JSON.stringify({ version: 1, workouts: 'x' })).workouts).toEqual([]);
  });

  it('refuse un format inconnu', () => {
    expect(() => parseData(JSON.stringify({ version: 2 }))).toThrow();
  });
});
