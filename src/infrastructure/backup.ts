import { useCallback, useEffect, useRef, useState } from 'react';
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

export interface Backup {
  supported: boolean;
  /** Dossier configuré (nom) ou null. */
  folder: string | null;
  /** Le navigateur demande une confirmation de l'utilisateur pour réactiver l'accès au dossier. */
  needsPermission: boolean;
  error: boolean;
  lastBackup: Date | null;
  choose: () => Promise<void>;
  resume: () => Promise<void>;
  disable: () => Promise<void>;
}

export function useBackup(data: AppData): Backup {
  const [handle, setHandle] = useState<DirHandle | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState(false);
  const [lastBackup, setLastBackup] = useState<Date | null>(null);
  const latest = useRef(data);
  latest.current = data;

  const write = useCallback(async (h: DirHandle) => {
    try {
      await writeBackup(h, latest.current);
      setLastBackup(new Date());
      setError(false);
    } catch (e) {
      console.error('Sauvegarde automatique impossible', e);
      setError(true);
    }
  }, []);

  useEffect(() => {
    if (!backupSupported) return;
    idb<DirHandle | undefined>('readonly', (s) => s.get(KEY))
      .then(async (h) => {
        if (!h) return;
        setHandle(h);
        setActive((await h.queryPermission({ mode: 'readwrite' })) === 'granted');
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!handle || !active) return;
    const t = setTimeout(() => write(handle), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [data, handle, active, write]);

  // Évite de perdre les dernières modifications quand l'onglet est masqué ou fermé.
  useEffect(() => {
    if (!handle || !active) return;
    const flush = () => document.visibilityState === 'hidden' && write(handle);
    document.addEventListener('visibilitychange', flush);
    return () => document.removeEventListener('visibilitychange', flush);
  }, [handle, active, write]);

  const choose = async () => {
    try {
      const h = (await (window as unknown as { showDirectoryPicker(o: { mode: 'readwrite' }): Promise<DirHandle> }).showDirectoryPicker({
        mode: 'readwrite',
      }));
      await idb('readwrite', (s) => s.put(h, KEY));
      setHandle(h);
      setActive(true);
      await write(h);
    } catch (e) {
      if ((e as DOMException).name !== 'AbortError') console.error(e);
    }
  };

  const resume = async () => {
    if (!handle) return;
    if ((await handle.requestPermission({ mode: 'readwrite' })) === 'granted') {
      setActive(true);
      await write(handle);
    }
  };

  const disable = async () => {
    await idb('readwrite', (s) => s.delete(KEY)).catch(() => {});
    setHandle(null);
    setActive(false);
    setError(false);
    setLastBackup(null);
  };

  return {
    supported: backupSupported,
    folder: handle?.name ?? null,
    needsPermission: !!handle && !active,
    error,
    lastBackup,
    choose,
    resume,
    disable,
  };
}
