import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { initialData, parseData, type AppData } from '../../application/appData';
import { useBackup, type Backup } from '../../infrastructure/backup';
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
interface Store {
  data: AppData;
  update: (fn: Updater) => void;
  replace: (d: AppData) => void;
  reset: () => void;
  backup: Backup;
  /** Vrai si la dernière écriture dans la base locale a échoué. */
  saveError: boolean;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [initial, setInitial] = useState<AppData | null>(null);

  useEffect(() => {
    let cancelled = false; // évite un double amorçage (StrictMode)
    load().then(async ({ data, fromDb }) => {
      if (cancelled) return;
      if (!fromDb) {
        // Première ouverture (ou migration depuis localStorage) : on remplit la base avant d'afficher l'app.
        try {
          await saveDiff(null, data);
          localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
          console.error('Écriture initiale dans la base locale impossible', e);
        }
      }
      if (!cancelled) setInitial(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!initial) return null;
  return <LoadedStore initial={initial}>{children}</LoadedStore>;
}

function LoadedStore({ initial, children }: { initial: AppData; children: ReactNode }) {
  const [data, setData] = useState(initial);
  const [saveError, setSaveError] = useState(false);
  const backup = useBackup(data);
  const persisted = useRef(initial);
  const queue = useRef(Promise.resolve());

  // Écritures sérialisées pour préserver l'ordre ; seules les différences sont écrites.
  useEffect(() => {
    const prev = persisted.current;
    if (prev === data) return;
    persisted.current = data;
    queue.current = queue.current
      .then(() => saveDiff(prev, data))
      .then(() => setSaveError(false))
      .catch((e) => {
        console.error('Enregistrement dans la base locale impossible', e);
        setSaveError(true);
      });
  }, [data]);

  useEffect(() => {
    // Demande au navigateur de ne pas purger le stockage local.
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  return (
    <StoreContext.Provider value={{ data, update: setData, replace: setData, reset: () => setData(initialData()), backup, saveError }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore doit être utilisé dans <StoreProvider>');
  return store;
}
