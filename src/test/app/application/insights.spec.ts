import { describe, expect, it } from 'vitest';
import type { LogItem } from '../../../app/nutrition/domain/meal';
import { addDays } from '../../../app/shared/kernel/dates';
import type { AppData } from '../../../app/application/appData';
import { dayTotals } from '../../../app/application/dailySummary';
import { computeInsights, dayStatus, HEATMAP_WEEKS } from '../../../app/application/insights';

const TODAY = '2025-06-11'; // mercredi

const entry = (date: string, kcal: number, protein = 0): LogItem => ({
  id: `${date}-${kcal}-${protein}`,
  date,
  meal: 'lunch',
  name: 'x',
  quantity: 1,
  unit: 'unité',
  kcal,
  protein,
  carbs: 0,
  fat: 0,
});

const dataWith = (log: LogItem[], over: Partial<AppData> = {}): AppData => ({
  version: 1,
  foods: [],
  templates: [],
  log,
  workouts: [],
  strength: [],
  weights: [],
  measurements: [],
  targets: [],
  settings: { kcalGoal: 2000 },
  ...over,
});

describe('dayStatus', () => {
  const status = (kcal: number, goal = 2000) => {
    const data = dataWith([entry('2025-06-10', kcal)]);
    return dayStatus({ date: '2025-06-10', ...dayTotals(data, '2025-06-10') }, goal);
  };

  it('vaut none sans aliment saisi', () => {
    const d = { date: '2025-06-10', ...dayTotals(dataWith([]), '2025-06-10') };
    expect(dayStatus(d, 2000)).toBe('none');
  });

  it('applique la bande ±10 % avec bornes incluses', () => {
    expect(status(1799)).toBe('under');
    expect(status(1800)).toBe('on');
    expect(status(2200)).toBe('on');
    expect(status(2201)).toBe('over');
  });

  it('compte le sport dans le bilan net', () => {
    const data = dataWith([entry('2025-06-10', 2600)], {
      workouts: [{ id: 'w', date: '2025-06-10', activity: 'x', duration: 60, kcal: 600 }],
    });
    expect(dayStatus({ date: '2025-06-10', ...dayTotals(data, '2025-06-10') }, 2000)).toBe('on');
  });
});

describe('computeInsights', () => {
  it('ne plante pas et ne produit aucun constat sans données', () => {
    const r = computeInsights(dataWith([]), TODAY);
    expect(r.streak).toBe(0);
    expect(r.loggedLast28).toBe(0);
    expect(r.split).toBeNull();
    expect(r.waist).toBeNull();
    expect(r.notes).toEqual([]);
    expect(r.avg28).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });

  describe('série (streak)', () => {
    it('compte depuis aujourd’hui quand il est renseigné', () => {
      const log = [TODAY, addDays(TODAY, -1), addDays(TODAY, -2)].map((d) => entry(d, 2000));
      expect(computeInsights(dataWith(log), TODAY).streak).toBe(3);
    });

    it('compte depuis hier quand aujourd’hui est vide', () => {
      const log = [addDays(TODAY, -1), addDays(TODAY, -2)].map((d) => entry(d, 2000));
      expect(computeInsights(dataWith(log), TODAY).streak).toBe(2);
    });

    it('s’arrête au premier trou', () => {
      const log = [TODAY, addDays(TODAY, -1), addDays(TODAY, -3)].map((d) => entry(d, 2000));
      expect(computeInsights(dataWith(log), TODAY).streak).toBe(2);
    });

    it('vaut 0 si ni aujourd’hui ni hier ne sont renseignés', () => {
      expect(computeInsights(dataWith([entry(addDays(TODAY, -2), 2000)]), TODAY).streak).toBe(0);
    });

    it('n’ajoute la note qu’à partir de 3 jours', () => {
      const two = [TODAY, addDays(TODAY, -1)].map((d) => entry(d, 2000));
      const three = [...two, entry(addDays(TODAY, -2), 2000)];
      expect(computeInsights(dataWith(two), TODAY).notes.some((n) => n.startsWith('Série'))).toBe(false);
      expect(computeInsights(dataWith(three), TODAY).notes.some((n) => n.startsWith('Série en cours : 3'))).toBe(true);
    });
  });

  it('compte les jours dans la cible sur 7 et 28 jours', () => {
    const log = [entry(TODAY, 2000), entry(addDays(TODAY, -1), 3000), entry(addDays(TODAY, -10), 2100)];
    const r = computeInsights(dataWith(log), TODAY);
    expect(r.loggedLast7).toBe(2);
    expect(r.loggedLast28).toBe(3);
    expect(r.onTarget7).toBe(1);
    expect(r.onTarget28).toBe(2);
  });

  it('exclut les entrées de plus de 28 jours et les jours futurs', () => {
    const log = [entry(addDays(TODAY, -28), 2000), entry(addDays(TODAY, 1), 2000)];
    expect(computeInsights(dataWith(log), TODAY).loggedLast28).toBe(0);
  });

  it('calcule la moyenne sur les jours renseignés seulement', () => {
    const log = [entry(TODAY, 1000, 50), entry(addDays(TODAY, -1), 3000, 150)];
    const r = computeInsights(dataWith(log), TODAY);
    expect(r.avg28.kcal).toBe(2000);
    expect(r.avg28.protein).toBe(100);
  });

  describe('protéines', () => {
    it('est null sans objectif de protéines', () => {
      const r = computeInsights(dataWith([entry(TODAY, 2000, 100)]), TODAY);
      expect(r.proteinHit7).toBeNull();
      expect(r.proteinHit28).toBeNull();
    });

    it('tolère 5 % sous l’objectif', () => {
      const settings = { kcalGoal: 2000, proteinGoal: 100 };
      const log = [entry(TODAY, 2000, 95), entry(addDays(TODAY, -1), 2000, 94)];
      expect(computeInsights(dataWith(log, { settings }), TODAY).proteinHit7).toBe(1);
    });
  });

  it('byWeekday : lundi en premier, moyenne et effectif par jour', () => {
    // 2025-06-09 est un lundi, 2025-06-02 aussi.
    const log = [entry('2025-06-09', 1800), entry('2025-06-02', 2200)];
    const r = computeInsights(dataWith(log), TODAY);
    expect(r.byWeekday.map((d) => d.label)[0]).toBe('Lundi');
    expect(r.byWeekday[0]).toEqual({ label: 'Lundi', kcal: 2000, count: 2 });
    expect(r.byWeekday[1]).toEqual({ label: 'Mardi', kcal: null, count: 0 });
  });

  describe('écart week-end / semaine', () => {
    // Week-ends : 7-8 juin et 31 mai-1er juin ; semaine : 9-11 juin.
    const log = [
      entry('2025-06-07', 2500),
      entry('2025-06-08', 2500),
      entry('2025-06-09', 2000),
      entry('2025-06-10', 2000),
    ];

    it('produit un constat quand l’écart dépasse 100 kcal', () => {
      const notes = computeInsights(dataWith(log), TODAY).notes;
      expect(notes).toContain('Le week-end, vous mangez en moyenne 500 kcal de plus qu\'en semaine.');
    });

    it('ignore l’écart avec moins de 2 jours de week-end', () => {
      const notes = computeInsights(dataWith([entry('2025-06-07', 3500), entry('2025-06-09', 2000)]), TODAY).notes;
      expect(notes.some((n) => n.startsWith('Le week-end'))).toBe(false);
    });
  });

  describe('calendrier (heatmap)', () => {
    const r = computeInsights(dataWith([entry(TODAY, 2000), entry('2025-06-09', 3000)]), TODAY);

    it('contient HEATMAP_WEEKS semaines de 7 jours, du lundi au dimanche', () => {
      expect(r.heatmap).toHaveLength(HEATMAP_WEEKS);
      expect(r.heatmap.every((w) => w.length === 7)).toBe(true);
      expect(r.heatmap[HEATMAP_WEEKS - 1][0].date).toBe('2025-06-09');
      expect(r.heatmap[0][0].date).toBe(addDays('2025-06-09', -(HEATMAP_WEEKS - 1) * 7));
    });

    it('marque les jours futurs sans statut', () => {
      const last = r.heatmap[HEATMAP_WEEKS - 1];
      expect(last[3]).toMatchObject({ date: '2025-06-12', future: true, status: 'none' });
    });

    it('attribue le statut du jour', () => {
      const last = r.heatmap[HEATMAP_WEEKS - 1];
      expect(last[0].status).toBe('over'); // lundi 3000
      expect(last[2].status).toBe('on'); // mercredi 2000
    });
  });

  describe('tour de taille', () => {
    const m = (date: string, waist?: number) => ({ id: date, date, values: waist ? { waist } : { chest: 100 } });

    it('ignore les mesures sans tour de taille', () => {
      expect(computeInsights(dataWith([], { measurements: [m('2025-06-01')] }), TODAY).waist).toBeNull();
    });

    it('prend la dernière mesure, l’évolution depuis la première et le rapport à la taille', () => {
      const data = dataWith([], {
        settings: { kcalGoal: 2000, heightCm: 180 },
        measurements: [m('2025-05-01', 90), m('2025-06-01', 85), m('2025-05-15', 88)],
      });
      const { waist, notes } = computeInsights(data, TODAY);
      expect(waist).toMatchObject({ value: 85, date: '2025-06-01', change: -5 });
      expect(waist!.ratio).toBeCloseTo(85 / 180);
      expect(notes).toContain('Tour de taille / taille : 0,47 (sous le repère de 0,5).');
    });

    it('change est null avec une seule mesure et ratio null sans taille', () => {
      const { waist } = computeInsights(dataWith([], { measurements: [m('2025-06-01', 85)] }), TODAY);
      expect(waist).toMatchObject({ change: null, ratio: null });
    });
  });
});
