import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { CiqualFood, Food } from '../../../../app/nutrition/domain/food';
import { searchLocal } from '../../../../app/nutrition/infrastructure/localSearch';

const ref = (id: string, name: string, group = 'viandes'): CiqualFood => ({ id, name, group, unit: 'g', kcal: 100 });
const mine: Food[] = [
  { id: 'm2', name: 'Thon maison', unit: 'g', kcal: 120 },
  { id: 'm1', name: 'Épinards perso', unit: 'g', kcal: 25 },
];

beforeAll(async () => {
  // La table CIQUAL est importée au premier usage depuis ciqual.json : on simule ce fichier.
  const table = [
    ref('c1', 'Poisson, thon, cru'),
    ref('c2', 'Thon, au naturel'),
    ref('c3', 'Thon rouge, grillé'),
    ref('c4', 'Épinards, cuits', 'légumes'),
    ref('m2', 'Thon maison doublon'),
  ];
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => table }));
});

afterAll(() => vi.unstubAllGlobals());

describe('searchLocal', () => {
  it('renvoie une liste vide pour une recherche vide', async () => {
    expect(await searchLocal('   ', mine)).toEqual([]);
  });

  it('ignore accents et casse', async () => {
    const res = await searchLocal('EPINARDS', mine);
    expect(res.map((r) => r.food.id)).toEqual(['m1', 'c4']);
  });

  it('place les aliments perso avant CIQUAL et indique l’origine', async () => {
    const res = await searchLocal('thon', mine);
    expect(res[0]).toMatchObject({ origin: 'perso', food: { id: 'm2' } });
    expect(res.slice(1).every((r) => r.origin === 'ciqual')).toBe(true);
  });

  it('exige tous les mots de la recherche', async () => {
    const res = await searchLocal('thon rouge', mine);
    expect(res.map((r) => r.food.id)).toEqual(['c3']);
  });

  it('classe d’abord les noms commençant par le terme, puis les plus courts', async () => {
    const ids = (await searchLocal('thon', mine)).filter((r) => r.origin === 'ciqual').map((r) => r.food.id);
    expect(ids).toEqual(['c2', 'c3', 'c1']);
  });

  it('n’affiche pas un aliment CIQUAL déjà présent dans les aliments perso', async () => {
    const res = await searchLocal('thon', mine);
    expect(res.filter((r) => r.food.id === 'm2')).toHaveLength(1);
  });

  it('expose le groupe CIQUAL', async () => {
    const ciqual = (await searchLocal('epinards', [])).filter((r) => r.origin === 'ciqual');
    expect(ciqual[0].group).toBe('légumes');
  });

  it('respecte la limite', async () => {
    expect(await searchLocal('thon', mine, 2)).toHaveLength(2);
  });
});
