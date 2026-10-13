import type { Food } from '../domain/food';

// Proxifié par Vite (voir vite.config.ts) pour contourner l'absence de CORS.
const ENDPOINT = '/off-search';

interface Hit {
  code: string;
  product_name?: string;
  brands?: string[] | string;
  nutriments?: Record<string, number | undefined>;
  nova_group?: number;
  ingredients_n?: number;
  categories_tags?: string[];
}

/** Degré de transformation estimé d'un produit. */
export type Level = 'raw' | 'processed' | 'ultra' | 'unknown';

export interface OffResult {
  food: Food;
  brand?: string;
  level: Level;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

// Catégories qui signalent un plat préparé ou un produit industriel.
const READY_MADE = /^en:(meals|sandwiches|pizzas|snacks|biscuits|cakes|sodas|confectioneries|desserts|cereal-bars|appetizers|prepared-)/;

function classify(h: Hit, brand?: string): Level {
  if (h.nova_group === 1) return 'raw';
  if (h.nova_group === 4) return 'ultra';
  if (h.nova_group === 2 || h.nova_group === 3) return 'processed';
  if (h.categories_tags?.some((c) => READY_MADE.test(c))) return 'ultra';
  if (h.ingredients_n !== undefined) return h.ingredients_n <= 1 ? 'raw' : 'processed';
  return brand ? 'processed' : 'unknown';
}

const ORDER: Record<Level, number> = { raw: 0, processed: 1, unknown: 2, ultra: 3 };

/** Recherche sur Open Food Facts (API publique, gratuite, sans clé). Valeurs pour 100 g. Trié du plus brut au plus transformé. */
export async function searchOpenFoodFacts(query: string, signal?: AbortSignal): Promise<OffResult[]> {
  const url = `${ENDPOINT}?${new URLSearchParams({
    q: query,
    page_size: '30',
    fields: 'code,product_name,brands,nutriments,nova_group,ingredients_n,categories_tags',
  })}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Open Food Facts : erreur ${res.status}`);
  const json = (await res.json()) as { hits?: Hit[] };

  const results = (json.hits ?? []).flatMap((h): OffResult[] => {
    const n = h.nutriments ?? {};
    const kcal = n['energy-kcal_100g'];
    const name = h.product_name?.trim();
    if (!name || typeof kcal !== 'number') return [];
    const brand = (Array.isArray(h.brands) ? h.brands[0] : h.brands?.split(',')[0])?.trim() || undefined;
    return [
      {
        food: {
          id: `off-${h.code}`,
          name,
          unit: 'g',
          kcal: r1(kcal),
          protein: n.proteins_100g === undefined ? undefined : r1(n.proteins_100g),
          carbs: n.carbohydrates_100g === undefined ? undefined : r1(n.carbohydrates_100g),
          fat: n.fat_100g === undefined ? undefined : r1(n.fat_100g),
        },
        brand,
        level: classify(h, brand),
      },
    ];
  });
  // Tri stable : la pertinence d'origine est conservée à l'intérieur d'un même niveau.
  return results.sort((a, b) => ORDER[a.level] - ORDER[b.level]);
}

/** Aliment à enregistrer dans la base perso : la marque est ajoutée au nom pour distinguer les produits. */
export const offToFood = ({ food, brand }: OffResult): Food =>
  brand && !food.name.toLowerCase().includes(brand.toLowerCase()) ? { ...food, name: `${food.name} (${brand})` } : food;
