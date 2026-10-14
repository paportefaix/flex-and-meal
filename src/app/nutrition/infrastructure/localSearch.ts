import { allCiqual } from '../../infrastructure/db';
import { normalize } from '../../shared/kernel/text';
import type { CiqualFood, Food } from '../domain/food';

export interface LocalResult {
  food: Food;
  origin: 'perso' | 'ciqual';
  group?: string;
}

let index: { food: CiqualFood; key: string }[] | null = null;

/** Recherche dans « Mes aliments » puis dans la table CIQUAL importée en local. */
export async function searchLocal(query: string, mine: Food[], limit = 40): Promise<LocalResult[]> {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  index ??= (await allCiqual()).map((food) => ({ food, key: normalize(food.name) }));

  const match = (key: string) => words.every((w) => key.includes(w));
  // Les noms CIQUAL commencent par le terme principal ("Thon, cru") : on remonte ceux qui commencent par la recherche, puis les plus courts.
  const rank = (key: string) => (key.startsWith(words[0]) ? 0 : 1);

  const own = mine.filter((f) => match(normalize(f.name))).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const ids = new Set(mine.map((f) => f.id));
  const ref = index
    .filter((e) => !ids.has(e.food.id) && match(e.key))
    .sort((a, b) => rank(a.key) - rank(b.key) || a.key.length - b.key.length)
    .map((e) => e.food);

  return [
    ...own.map((food): LocalResult => ({ food, origin: 'perso' })),
    ...ref.map((food): LocalResult => ({ food, origin: 'ciqual', group: food.group })),
  ].slice(0, limit);
}
