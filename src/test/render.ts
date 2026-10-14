import { Injector, type ComponentRef, type Provider, type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter, type Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { initialData, type AppData } from '../app/application/appData';
import { BackupService } from '../app/infrastructure/backup.service';
import { loadFromDb, saveDiff } from '../app/infrastructure/db';
import { addDays, todayISO } from '../app/shared/kernel/dates';
import type { StrengthSession } from '../app/training/domain/session';
import { provideFrDateAdapter } from '../app/ui/shared/fr-date-adapter';
import { SAVE_DIFF, Store } from '../app/ui/state/store';

/** Données de test : l'état initial (aliments de départ inclus) surchargé par `overrides`. */
export const makeData = (overrides: Partial<AppData> = {}): AppData => ({ ...initialData(), ...overrides });

/** Remplace le contenu de la base locale (fake-indexeddb) par `data`, comme si l'app avait déjà été utilisée. */
export async function seed(data: AppData) {
  await saveDiff(await loadFromDb(), data);
}

/** Crée un Store chargé depuis la base locale simulée. */
export async function loadStore(data: AppData = makeData(), providers: Provider[] = []): Promise<Store> {
  await seed(data);
  const store = Injector.create({ providers: [Store, BackupService, { provide: SAVE_DIFF, useValue: saveDiff }, ...providers] }).get(Store);
  await store.init();
  return store;
}

export interface RenderOptions {
  data?: AppData;
  /** URL initiale (ex. '/journal?date=2024-01-01'). */
  route?: string;
  /** Si fourni, le composant est créé directement avec ces entrées (pas de routage). */
  inputs?: Record<string, unknown>;
  /** Si fourni, `ui` est la coquille de l'application qui contient le `<router-outlet>`. */
  routes?: Routes;
  providers?: Provider[];
  /** Fournisseurs supplémentaires pour le Store (ex. `SAVE_DIFF` simulé). */
  storeProviders?: Provider[];
}

export interface Rendered<T> {
  fixture: ComponentFixture<T>;
  component: T;
  store: Store;
  /** Attend la fin de la détection de changements et des tâches asynchrones en cours. */
  settle: () => Promise<void>;
}

/**
 * Affiche `ui` avec un vrai Store (base IndexedDB simulée) et un routeur.
 * Les requêtes se font avec `screen` (@testing-library/dom).
 */
export async function renderWithStore<T>(
  ui: Type<T>,
  { data = makeData(), route = '/', inputs, routes, providers = [], storeProviders = [] }: RenderOptions = {},
): Promise<Rendered<T>> {
  const store = await loadStore(data, storeProviders);
  TestBed.configureTestingModule({
    providers: [
      { provide: Store, useValue: store },
      provideFrDateAdapter(),
      provideRouter(routes ?? [{ path: '**', component: ui }]),
      ...providers,
    ],
  });
  let fixture: ComponentFixture<T>;
  if (inputs || routes) {
    fixture = TestBed.createComponent(ui);
    for (const [k, v] of Object.entries(inputs ?? {})) (fixture.componentRef as ComponentRef<T>).setInput(k, v);
    if (routes) await TestBed.inject(Router).navigateByUrl(route);
  } else {
    const harness = await RouterTestingHarness.create(route);
    fixture = harness.fixture as unknown as ComponentFixture<T>;
  }
  const settle = async () => {
    await fixture.whenStable();
  };
  await settle();
  return { fixture, component: fixture.componentInstance, store, settle };
}

/** Séance de musculation il y a `daysAgo` jours : développé couché + squat. */
export const makeSession = (daysAgo: number, weight = 60, title = 'Push'): StrengthSession => ({
  id: `s-${daysAgo}-${title}`,
  date: addDays(todayISO(), -daysAgo),
  title,
  minutes: 60,
  exercises: [
    { name: 'Bench Press (Barbell)', sets: [{ type: 'normal', weight, reps: 8 }, { type: 'normal', weight, reps: 6 }] },
    { name: 'Squat (Barbell)', sets: [{ type: 'normal', weight: weight + 20, reps: 5 }] },
  ],
});

/** Plusieurs séances étalées dans le temps, pour que tendances et records existent. */
export const makeSessions = (): StrengthSession[] => [60, 45, 30, 20, 10, 3].map((d, i) => makeSession(d, 50 + i * 2.5));
