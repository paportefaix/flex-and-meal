import { describe, expect, it } from 'vitest';
import type { StrengthSession, StrengthSet } from '../../../../app/training/domain/session';
import { loadStep, progressionAdvice } from '../../../../app/training/domain/strengthProgression';
import { addDays, todayISO } from '../../../../app/shared/kernel/dates';

const TODAY = todayISO();
const BENCH = 'Bench Press (Barbell)';

const set = (weight: number, reps: number, extra: Partial<StrengthSet> = {}): StrengthSet => ({ type: 'normal', weight, reps, ...extra });
/** Une séance par semaine, la plus récente d'abord dans `weeks` (en semaines avant aujourd'hui). */
const history = (...perSession: StrengthSet[][]): StrengthSession[] =>
  perSession.map((sets, i) => {
    const date = addDays(TODAY, -7 * (perSession.length - 1 - i));
    return { id: `s${i}`, date, title: 'T', exercises: [{ name: BENCH, sets }] };
  });

describe('progressionAdvice', () => {
  it('conseille d’augmenter la charge quand toutes les séries atteignent 12 répétitions', () => {
    const [a] = progressionAdvice(history([set(60, 10)], [set(60, 11)], [set(60, 12), set(60, 12), set(60, 13)]), TODAY);
    expect(a).toMatchObject({ name: BENCH, kind: 'increase', weight: 60, nextWeight: 62.5, targetReps: 8 });
  });

  it('conseille de gagner une répétition tant que le plafond n’est pas atteint', () => {
    const [a] = progressionAdvice(history([set(60, 8)], [set(60, 9)], [set(60, 10), set(60, 9)]), TODAY);
    expect(a).toMatchObject({ kind: 'reps', nextWeight: 60, targetReps: 10 });
  });

  it('augmente la charge quand les séries sont notées faciles', () => {
    const easy = (reps: number) => set(60, reps, { rpe: 7 });
    const [a] = progressionAdvice(history([easy(9)], [easy(9)], [easy(9), easy(9)]), TODAY);
    expect(a.kind).toBe('increase');
  });

  it('ignore les échauffements et les séries plus légères', () => {
    const last = [set(20, 15, { type: 'warmup' }), set(60, 12), set(60, 12), set(50, 6, { type: 'dropset' })];
    const [a] = progressionAdvice(history([set(60, 10)], [set(60, 11)], last), TODAY);
    expect(a).toMatchObject({ kind: 'increase', weight: 60 });
  });

  it('propose une décharge en cas de plateau', () => {
    const flat = (w: number) => [set(w, 8)];
    const [a] = progressionAdvice(history(flat(80), flat(75), flat(75), flat(75), flat(75), flat(75), flat(75)), TODAY);
    expect(a).toMatchObject({ kind: 'deload', nextWeight: 67.5 });
  });

  it('conseille de consolider quand la performance baisse', () => {
    const [a] = progressionAdvice(history([set(100, 5)], [set(100, 5)], [set(100, 5)], [set(100, 5)], [set(100, 5)], [set(80, 5)]), TODAY);
    expect(a).toMatchObject({ kind: 'hold', nextWeight: 80 });
  });

  it('n’aconseille ni les exercices récents, ni inactifs, ni au poids du corps', () => {
    expect(progressionAdvice(history([set(60, 12)], [set(60, 12)]), TODAY)).toEqual([]);
    const old = history([set(60, 12)], [set(60, 12)], [set(60, 12)]).map((s) => ({ ...s, date: addDays(s.date, -90) }));
    expect(progressionAdvice(old, TODAY)).toEqual([]);
    expect(progressionAdvice(history([set(0, 12)], [set(0, 12)], [set(0, 12)]), TODAY)).toEqual([]);
  });

  it('trie les augmentations de charge en premier', () => {
    const sessions = history([set(60, 12)], [set(60, 12)], [set(60, 12)]);
    const other = sessions.map((s) => ({ ...s, id: `o${s.id}`, exercises: [{ name: 'Curl', sets: [set(20, 8)] }] }));
    expect(progressionAdvice([...other, ...sessions], TODAY).map((a) => a.kind)).toEqual(['increase', 'reps']);
  });

  it('utilise un pas de 2,5 kg, ou 1 kg pour les petites charges', () => {
    expect(loadStep(60)).toBe(2.5);
    expect(loadStep(10)).toBe(1);
  });
});

describe('progressionAdvice avec un objectif annoté', () => {
  const target = (sets: number, minReps: number, maxReps: number) => [{ id: BENCH, sets, minReps, maxReps }];

  it('utilise le haut de la fourchette comme plafond et le bas comme point de départ', () => {
    const sessions = history([set(60, 5)], [set(60, 6)], [set(60, 6), set(60, 6), set(60, 6)]);
    const [a] = progressionAdvice(sessions, TODAY, target(3, 4, 6));
    expect(a).toMatchObject({ kind: 'increase', nextWeight: 62.5, targetReps: 4 });
    expect(progressionAdvice(sessions, TODAY)[0].kind).toBe('reps'); // sans objectif, plafond de 12
  });

  it('demande de compléter les séries avant d’augmenter la charge', () => {
    const sessions = history([set(60, 11)], [set(60, 12)], [set(60, 12), set(60, 12)]);
    const [a] = progressionAdvice(sessions, TODAY, target(4, 8, 12));
    expect(a).toMatchObject({ kind: 'sets', nextWeight: 60 });
    expect(a.message).toContain('2 séries sur 4');
  });

  it('signale les séries manquantes et une performance sous la fourchette', () => {
    const sessions = history([set(60, 5)], [set(60, 5)], [set(60, 5), set(60, 5)]);
    const [a] = progressionAdvice(sessions, TODAY, target(3, 8, 12));
    expect(a.kind).toBe('reps');
    expect(a.message).toContain('sous le bas de ta fourchette');
    expect(a.message).toContain('manque 1 série');
  });
});
