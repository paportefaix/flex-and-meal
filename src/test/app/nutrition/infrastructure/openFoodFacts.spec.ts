import { afterEach, describe, expect, it, vi } from 'vitest';
import { offToFood, searchOpenFoodFacts } from '../../../../app/nutrition/infrastructure/openFoodFacts';

const mockFetch = (body: unknown, ok = true, status = 200) => {
  const fn = vi.fn().mockResolvedValue({ ok, status, json: async () => body });
  vi.stubGlobal('fetch', fn);
  return fn;
};
const hit = (over: Record<string, unknown> = {}) => ({
  code: '123',
  product_name: 'Yaourt',
  nutriments: { 'energy-kcal_100g': 59.46, proteins_100g: 3.99, carbohydrates_100g: 4.04, fat_100g: 3.04 },
  ...over,
});

afterEach(() => vi.unstubAllGlobals());

describe('searchOpenFoodFacts', () => {
  it('interroge le proxy avec la recherche', async () => {
    const fetchFn = mockFetch({ hits: [] });
    await searchOpenFoodFacts('yaourt nature');
    const url = String(fetchFn.mock.calls[0][0]);
    expect(url.startsWith('/off-search?')).toBe(true);
    expect(new URL(url, 'http://x').searchParams.get('q')).toBe('yaourt nature');
  });

  it('convertit un produit (valeurs arrondies à 0,1)', async () => {
    mockFetch({ hits: [hit({ brands: ['Danone', 'Autre'] })] });
    const [r] = await searchOpenFoodFacts('yaourt');
    expect(r.food).toEqual({ id: 'off-123', name: 'Yaourt', unit: 'g', kcal: 59.5, protein: 4, carbs: 4, fat: 3 });
    expect(r.brand).toBe('Danone');
  });

  it('accepte une marque sous forme de texte séparé par des virgules', async () => {
    mockFetch({ hits: [hit({ brands: 'Marque A, Marque B' })] });
    expect((await searchOpenFoodFacts('x'))[0].brand).toBe('Marque A');
  });

  it('ignore les produits sans nom ou sans calories', async () => {
    mockFetch({ hits: [hit({ product_name: '  ' }), hit({ nutriments: {} }), hit({ code: '9' })] });
    const res = await searchOpenFoodFacts('x');
    expect(res.map((r) => r.food.id)).toEqual(['off-9']);
  });

  it('laisse les macros indéfinies quand elles manquent', async () => {
    mockFetch({ hits: [hit({ nutriments: { 'energy-kcal_100g': 10 } })] });
    const [r] = await searchOpenFoodFacts('x');
    expect(r.food.protein).toBeUndefined();
    expect(r.food.carbs).toBeUndefined();
    expect(r.food.fat).toBeUndefined();
  });

  it('gère une réponse sans hits', async () => {
    mockFetch({});
    expect(await searchOpenFoodFacts('x')).toEqual([]);
  });

  it('lève une erreur si la requête échoue', async () => {
    mockFetch({}, false, 500);
    await expect(searchOpenFoodFacts('x')).rejects.toThrow('erreur 500');
  });

  it('estime le degré de transformation', async () => {
    mockFetch({
      hits: [
        hit({ code: 'a', nova_group: 1 }),
        hit({ code: 'b', nova_group: 4 }),
        hit({ code: 'c', nova_group: 2 }),
        hit({ code: 'd', categories_tags: ['en:sodas'] }),
        hit({ code: 'e', ingredients_n: 1 }),
        hit({ code: 'f', ingredients_n: 5 }),
        hit({ code: 'g', brands: 'Marque' }),
        hit({ code: 'h' }),
      ],
    });
    const levels = Object.fromEntries((await searchOpenFoodFacts('x')).map((r) => [r.food.id, r.level]));
    expect(levels).toEqual({
      'off-a': 'raw',
      'off-b': 'ultra',
      'off-c': 'processed',
      'off-d': 'ultra',
      'off-e': 'raw',
      'off-f': 'processed',
      'off-g': 'processed',
      'off-h': 'unknown',
    });
  });

  it('trie du plus brut au plus transformé en gardant l’ordre d’origine à égalité', async () => {
    mockFetch({
      hits: [
        hit({ code: 'u', nova_group: 4 }),
        hit({ code: 'p1', nova_group: 3 }),
        hit({ code: 'r', nova_group: 1 }),
        hit({ code: 'p2', nova_group: 3 }),
      ],
    });
    expect((await searchOpenFoodFacts('x')).map((r) => r.food.id)).toEqual(['off-r', 'off-p1', 'off-p2', 'off-u']);
  });
});

describe('offToFood', () => {
  const food = { id: 'off-1', name: 'Yaourt', unit: 'g' as const, kcal: 60 };

  it('ajoute la marque au nom', () => {
    expect(offToFood({ food, brand: 'Danone', level: 'processed' }).name).toBe('Yaourt (Danone)');
  });

  it('n’ajoute pas la marque déjà présente dans le nom', () => {
    expect(offToFood({ food: { ...food, name: 'Yaourt Danone' }, brand: 'danone', level: 'processed' }).name).toBe('Yaourt Danone');
  });

  it('laisse l’aliment intact sans marque', () => {
    expect(offToFood({ food, level: 'raw' })).toBe(food);
  });
});
