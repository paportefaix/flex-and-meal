import Dexie, { type EntityTable } from 'dexie';
import type { AppData } from '../application/appData';
import type { Measurement } from '../body/domain/measurement';
import type { WeightEntry } from '../body/domain/weight';
import type { CiqualFood, Food } from '../nutrition/domain/food';
import type { LogItem, MealTemplate } from '../nutrition/domain/meal';
import type { Settings } from '../settings/domain/settings';
import type { StrengthSession, Workout } from '../training/domain/session';

// Base locale IndexedDB (via Dexie) : une table par collection, les réglages dans `meta`.

interface Meta {
  key: 'settings';
  value: Settings;
}

class AppDb extends Dexie {
  foods!: EntityTable<Food, 'id'>;
  templates!: EntityTable<MealTemplate, 'id'>;
  log!: EntityTable<LogItem, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  strength!: EntityTable<StrengthSession, 'id'>;
  weights!: EntityTable<WeightEntry, 'id'>;
  measurements!: EntityTable<Measurement, 'id'>;
  meta!: EntityTable<Meta, 'key'>;
  ciqual!: EntityTable<CiqualFood, 'id'>;

  constructor() {
    super('flex-and-meal');
    this.version(1).stores({
      foods: 'id',
      templates: 'id',
      log: 'id, date',
      workouts: 'id, date',
      weights: 'id, date',
      measurements: 'id, date',
      meta: 'key',
    });
    // Table de référence CIQUAL (hors sauvegarde JSON : elle est rechargée depuis public/ciqual.json).
    this.version(2).stores({ ciqual: 'id' });
    this.version(3).stores({ strength: 'id, date' });
  }
}

const db = new AppDb();

const COLLECTIONS = ['foods', 'templates', 'log', 'workouts', 'strength', 'weights', 'measurements'] as const;

/** Charge toutes les données, ou `null` si la base est encore vide. */
export async function loadFromDb(): Promise<AppData | null> {
  const settings = await db.meta.get('settings');
  if (!settings) return null;
  const [foods, templates, log, workouts, strength, weights, measurements] = await Promise.all(COLLECTIONS.map((c) => db[c].toArray()));
  return {
    version: 1,
    foods: foods as Food[],
    templates: templates as MealTemplate[],
    log: log as LogItem[],
    workouts: workouts as Workout[],
    strength: strength as StrengthSession[],
    weights: weights as WeightEntry[],
    measurements: measurements as Measurement[],
    settings: settings.value,
  };
}

/** Écrit uniquement ce qui a changé entre `prev` et `next` (comparaison par référence, par id). */
export async function saveDiff(prev: AppData | null, next: AppData): Promise<void> {
  await db.transaction('rw', [db.foods, db.templates, db.log, db.workouts, db.strength, db.weights, db.measurements, db.meta], async () => {
    for (const c of COLLECTIONS) {
      const before = (prev?.[c] ?? []) as { id: string }[];
      const after = next[c] as { id: string }[];
      if (before === after) continue;
      const old = new Map(before.map((x) => [x.id, x]));
      const kept = new Set<string>();
      const puts = after.filter((x) => {
        kept.add(x.id);
        return old.get(x.id) !== x;
      });
      const removed = before.filter((x) => !kept.has(x.id)).map((x) => x.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const table = db[c] as any;
      if (removed.length) await table.bulkDelete(removed);
      if (puts.length) await table.bulkPut(puts);
    }
    if (prev?.settings !== next.settings) await db.meta.put({ key: 'settings', value: next.settings });
  });
}

let ciqualReady: Promise<void> | null = null;

/** Importe la table CIQUAL (public/ciqual.json) dans IndexedDB au premier usage. */
export function ensureCiqual(): Promise<void> {
  ciqualReady ??= (async () => {
    if ((await db.ciqual.count()) > 0) return;
    const res = await fetch(`ciqual.json`);
    if (!res.ok) throw new Error(`CIQUAL : erreur ${res.status}`);
    await db.ciqual.bulkPut((await res.json()) as CiqualFood[]);
  })().catch((e) => {
    ciqualReady = null;
    throw e;
  });
  return ciqualReady;
}

export async function allCiqual(): Promise<CiqualFood[]> {
  await ensureCiqual();
  return db.ciqual.toArray();
}
