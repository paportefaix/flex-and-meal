import { describe, expect, it } from 'vitest';
import { initialData, parseData } from '../../../../app/application/appData';
import {
  isValidTarget,
  makeTarget,
  MAX_TARGET_REPS,
  MAX_TARGET_SETS,
  MAX_TARGET_WEIGHT,
  setTarget,
  type ExerciseTarget,
} from '../../../../app/training/domain/target';

const valid: ExerciseTarget = { id: 'Squat', sets: 3, minReps: 8, maxReps: 12, weight: 55 };

describe('isValidTarget', () => {
  it('accepte un objectif complet, avec ou sans poids', () => {
    expect(isValidTarget(valid)).toBe(true);
    expect(isValidTarget({ id: 'Squat', sets: 3, minReps: 8, maxReps: 12 })).toBe(true);
  });

  it('accepte un poids décimal', () => {
    expect(isValidTarget({ ...valid, weight: 57.5 })).toBe(true);
  });

  it('accepte des bornes égales et les valeurs limites', () => {
    expect(isValidTarget({ ...valid, minReps: 10, maxReps: 10 })).toBe(true);
    expect(isValidTarget({ ...valid, sets: 1, minReps: 1 })).toBe(true);
    expect(isValidTarget({ ...valid, sets: MAX_TARGET_SETS, maxReps: MAX_TARGET_REPS, weight: MAX_TARGET_WEIGHT })).toBe(true);
  });

  it('refuse null, un non-objet ou un nom vide ou non textuel', () => {
    for (const bad of [null, undefined, 'x', 12, [], { ...valid, id: '' }, { ...valid, id: 5 }]) expect(isValidTarget(bad)).toBe(false);
  });

  it('exige des entiers pour les séries et les répétitions', () => {
    expect(isValidTarget({ ...valid, sets: 2.5 })).toBe(false);
    expect(isValidTarget({ ...valid, minReps: 6.5 })).toBe(false);
    expect(isValidTarget({ ...valid, maxReps: 12.5 })).toBe(false);
    expect(isValidTarget({ ...valid, sets: '3' })).toBe(false);
    expect(isValidTarget({ ...valid, sets: NaN })).toBe(false);
  });

  it('refuse les bornes hors limites ou incohérentes', () => {
    expect(isValidTarget({ ...valid, sets: 0 })).toBe(false);
    expect(isValidTarget({ ...valid, sets: MAX_TARGET_SETS + 1 })).toBe(false);
    expect(isValidTarget({ ...valid, minReps: 0 })).toBe(false);
    expect(isValidTarget({ ...valid, minReps: 13 })).toBe(false);
    expect(isValidTarget({ ...valid, maxReps: MAX_TARGET_REPS + 1 })).toBe(false);
  });

  it('refuse un poids nul, négatif, trop grand ou non numérique', () => {
    for (const weight of [0, -5, MAX_TARGET_WEIGHT + 1, NaN, Infinity, '55']) expect(isValidTarget({ ...valid, weight })).toBe(false);
  });
});

describe('makeTarget', () => {
  it('construit un objectif sans poids à partir de saisies texte', () => {
    expect(makeTarget('Squat', '4', '6', '8')).toEqual({ id: 'Squat', sets: 4, minReps: 6, maxReps: 8 });
  });

  it('ajoute le poids lorsqu’il est renseigné, point ou virgule', () => {
    expect(makeTarget('Squat', '1', '10', '12', '55')).toEqual({ id: 'Squat', sets: 1, minReps: 10, maxReps: 12, weight: 55 });
    expect(makeTarget('Squat', '3', '8', '10', '57.5')?.weight).toBe(57.5);
    expect(makeTarget('Squat', '3', '8', '10', '57,5')?.weight).toBe(57.5);
  });

  it('ignore un poids vide', () => {
    for (const weight of ['', '  ', undefined, null]) expect(makeTarget('Squat', '3', '8', '10', weight)).toEqual({ id: 'Squat', sets: 3, minReps: 8, maxReps: 10 });
  });

  it('accepte aussi des nombres déjà convertis', () => {
    expect(makeTarget('Squat', 3, 8, 10, 60)).toEqual({ id: 'Squat', sets: 3, minReps: 8, maxReps: 10, weight: 60 });
  });

  it('refuse les saisies incomplètes', () => {
    expect(makeTarget('Squat', '', '6', '8')).toBeNull();
    expect(makeTarget('Squat', '3', '', '8')).toBeNull();
    expect(makeTarget('Squat', '3', '6', '')).toBeNull();
    expect(makeTarget('Squat', '', '', '', '55')).toBeNull();
  });

  it('refuse les séries et répétitions non entières ou non numériques', () => {
    expect(makeTarget('Squat', '2.5', '6', '8')).toBeNull();
    expect(makeTarget('Squat', '3', '6.5', '8')).toBeNull();
    expect(makeTarget('Squat', 'abc', '6', '8')).toBeNull();
  });

  it('refuse les valeurs incohérentes ou hors limites', () => {
    expect(makeTarget('Squat', '3', '10', '8')).toBeNull();
    expect(makeTarget('Squat', '3', '0', '8')).toBeNull();
    expect(makeTarget('Squat', '99', '6', '8')).toBeNull();
    expect(makeTarget('Squat', '3', '6', '8', '0')).toBeNull();
    expect(makeTarget('Squat', '3', '6', '8', '-5')).toBeNull();
    expect(makeTarget('Squat', '3', '6', '8', 'abc')).toBeNull();
  });
});

describe('setTarget', () => {
  it('ajoute un objectif', () => {
    expect(setTarget([], 'A', makeTarget('A', '3', '8', '12'))).toEqual([{ id: 'A', sets: 3, minReps: 8, maxReps: 12 }]);
  });

  it('remplace l’objectif existant sans toucher aux autres', () => {
    const list = setTarget(setTarget([], 'A', makeTarget('A', '3', '8', '12')), 'B', makeTarget('B', '4', '5', '5'));
    const next = setTarget(list, 'A', makeTarget('A', '5', '3', '5', '80'));
    expect(next).toHaveLength(2);
    expect(next).toContainEqual({ id: 'A', sets: 5, minReps: 3, maxReps: 5, weight: 80 });
    expect(next).toContainEqual({ id: 'B', sets: 4, minReps: 5, maxReps: 5 });
  });

  it('supprime l’objectif avec null', () => {
    const list = setTarget(setTarget([], 'A', makeTarget('A', '3', '8', '12')), 'B', makeTarget('B', '4', '5', '5'));
    expect(setTarget(list, 'A', null).map((t) => t.id)).toEqual(['B']);
  });

  it('ne modifie pas la liste d’origine', () => {
    const list = [valid];
    setTarget(list, 'Squat', null);
    expect(list).toEqual([valid]);
  });
});

describe('parseData et objectifs', () => {
  it('accepte un export antérieur sans objectifs', () => {
    const { targets: _omit, ...old } = initialData();
    expect(parseData(JSON.stringify(old)).targets).toEqual([]);
  });

  it('conserve les anciens objectifs sans poids et les nouveaux avec poids', () => {
    const raw = JSON.stringify({ ...initialData(), targets: [{ id: 'A', sets: 3, minReps: 8, maxReps: 12 }, valid] });
    expect(parseData(raw).targets).toEqual([{ id: 'A', sets: 3, minReps: 8, maxReps: 12 }, valid]);
  });

  it('écarte les objectifs invalides', () => {
    const raw = JSON.stringify({
      ...initialData(),
      targets: [{ id: 'A', sets: 3, minReps: 8, maxReps: 12 }, { id: 'B', sets: 3, minReps: 12, maxReps: 8 }, { id: 'C', sets: 2.5, minReps: 8, maxReps: 12 }, 'x'],
    });
    expect(parseData(raw).targets.map((t) => t.id)).toEqual(['A']);
  });
});
