import { Injectable, computed, signal } from '@angular/core';
import type { AppData } from '../application/appData';

// Sauvegarde automatique dans un dossier choisi par l'utilisateur (File System Access API : Chrome / Edge).
// Le dossier peut être synchronisé (OneDrive, Dropbox…) pour retrouver les données sur un autre appareil.

type DirHandle = FileSystemDirectoryHandle & {
  queryPermission(o: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(o: { mode: 'readwrite' }): Promise<PermissionState>;
};

const FILE_NAME = 'flex-and-meal.json';
const DB_NAME = 'flex-and-meal-backup';
const STORE = 'handles';
const KEY = 'dir';
const DEBOUNCE_MS = 1500;

export const backupSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function writeBackup(dir: DirHandle, data: AppData) {
  const file = await dir.getFileHandle(FILE_NAME, { create: true });
  const w = await file.createWritable();
  await w.write(JSON.stringify(data, null, 2));
  await w.close();
}

@Injectable({ providedIn: 'root' })
export class BackupService {
  readonly supported = backupSupported;
  private readonly handle = signal<DirHandle | null>(null);
  private readonly active = signal(false);
  readonly error = signal(false);
  readonly lastBackup = signal<Date | null>(null);
  /** Dossier configuré (nom) ou null. */
  readonly folder = computed(() => this.handle()?.name ?? null);
  /** Le navigateur demande une confirmation de l'utilisateur pour réactiver l'accès au dossier. */
  readonly needsPermission = computed(() => !!this.handle() && !this.active());

  private latest: AppData | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    if (!this.supported) return;
    // Évite de perdre les dernières modifications quand l'onglet est masqué ou fermé.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush();
    });
    idb<DirHandle | undefined>('readonly', (s) => s.get(KEY))
      .then(async (h) => {
        if (!h) return;
        this.handle.set(h);
        this.active.set((await h.queryPermission({ mode: 'readwrite' })) === 'granted');
      })
      .catch(() => {});
  }

  /** À appeler à chaque changement des données : écriture différée (anti-rebond). */
  notify(data: AppData) {
    this.latest = data;
    if (!this.handle() || !this.active()) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), DEBOUNCE_MS);
  }

  private flush() {
    clearTimeout(this.timer);
    const h = this.handle();
    if (h && this.active()) void this.write(h);
  }

  private async write(h: DirHandle) {
    if (!this.latest) return;
    try {
      await writeBackup(h, this.latest);
      this.lastBackup.set(new Date());
      this.error.set(false);
    } catch (e) {
      console.error('Sauvegarde automatique impossible', e);
      this.error.set(true);
    }
  }

  async choose() {
    try {
      const h = await (window as unknown as { showDirectoryPicker(o: { mode: 'readwrite' }): Promise<DirHandle> }).showDirectoryPicker({
        mode: 'readwrite',
      });
      await idb('readwrite', (s) => s.put(h, KEY));
      this.handle.set(h);
      this.active.set(true);
      await this.write(h);
    } catch (e) {
      if ((e as DOMException).name !== 'AbortError') console.error(e);
    }
  }

  async resume() {
    const h = this.handle();
    if (!h) return;
    if ((await h.requestPermission({ mode: 'readwrite' })) === 'granted') {
      this.active.set(true);
      await this.write(h);
    }
  }

  async disable() {
    clearTimeout(this.timer);
    await idb('readwrite', (s) => s.delete(KEY)).catch(() => {});
    this.handle.set(null);
    this.active.set(false);
    this.error.set(false);
    this.lastBackup.set(null);
  }
}
