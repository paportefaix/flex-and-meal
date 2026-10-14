import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { initialData, parseData, type AppData } from '../../application/appData';
import { BackupService } from '../../infrastructure/backup.service';
import { loadFromDb, saveDiff } from '../../infrastructure/db';

const STORAGE_KEY = 'flex-and-meal:v1';

/** Anciennes données (localStorage) à migrer vers la base locale, si présentes. */
function loadLegacy(): AppData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? parseData(raw) : null;
  } catch (e) {
    console.error('Lecture des anciennes données impossible', e);
    return null;
  }
}

async function load(): Promise<{ data: AppData; fromDb: boolean }> {
  try {
    const stored = await loadFromDb();
    if (stored) return { data: parseData(JSON.stringify(stored)), fromDb: true };
  } catch (e) {
    console.error('Lecture de la base locale impossible', e);
  }
  return { data: loadLegacy() ?? initialData(), fromDb: false };
}

type Updater = (d: AppData) => AppData;

/** Écriture des différences dans la base locale (remplaçable dans les tests). */
export const SAVE_DIFF = new InjectionToken<typeof saveDiff>('SAVE_DIFF', { factory: () => saveDiff });

/** État de l'application (agrégat `AppData`) persisté dans IndexedDB par différences. */
@Injectable({ providedIn: 'root' })
export class Store {
  readonly backup = inject(BackupService);
  private readonly saveDiff = inject(SAVE_DIFF);
  readonly data = signal<AppData>(initialData());
  /** Vrai si la dernière écriture dans la base locale a échoué. */
  readonly saveError = signal(false);

  private persisted: AppData = this.data();
  private queue: Promise<void> = Promise.resolve();

  /** Chargement initial (appelé avant l'affichage de l'app). */
  async init() {
    const { data, fromDb } = await load();
    if (!fromDb) {
      // Première ouverture (ou migration depuis localStorage) : on remplit la base avant d'afficher l'app.
      try {
        await this.saveDiff(null, data);
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        console.error('Écriture initiale dans la base locale impossible', e);
      }
    }
    this.persisted = data;
    this.data.set(data);
    // Demande au navigateur de ne pas purger le stockage local.
    navigator.storage?.persist?.().catch(() => {});
  }

  update(fn: Updater) {
    this.commit(fn(this.data()));
  }

  replace(d: AppData) {
    this.commit(d);
  }

  reset() {
    this.commit(initialData());
  }

  /** Résolu quand toutes les écritures en attente sont terminées. */
  whenSaved(): Promise<void> {
    return this.queue;
  }

  private commit(next: AppData) {
    const prev = this.persisted;
    this.data.set(next);
    this.backup.notify(next);
    if (prev === next) return;
    this.persisted = next;
    // Écritures sérialisées pour préserver l'ordre ; seules les différences sont écrites.
    this.queue = this.queue
      .then(() => this.saveDiff(prev, next))
      .then(() => this.saveError.set(false))
      .catch((e) => {
        console.error('Enregistrement dans la base locale impossible', e);
        this.saveError.set(true);
      });
  }
}
