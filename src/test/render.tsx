import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { initialData, type AppData } from '../application/appData';
import { loadFromDb, saveDiff } from '../infrastructure/db';
import { addDays, todayISO } from '../shared/kernel/dates';
import type { StrengthSession } from '../training/domain/session';
import { StoreProvider } from '../ui/state/store';

/** Données de test : l'état initial (aliments de départ inclus) surchargé par `overrides`. */
export const makeData = (overrides: Partial<AppData> = {}): AppData => ({ ...initialData(), ...overrides });

/** Remplace le contenu de la base locale (fake-indexeddb) par `data`, comme si l'app avait déjà été utilisée. */
export async function seed(data: AppData) {
  await saveDiff(await loadFromDb(), data);
}

/** Affiche `ui` dans un vrai StoreProvider (base IndexedDB simulée) et un routeur en mémoire. */
export async function renderWithStore(ui: ReactElement, { data = makeData(), route = '/' }: { data?: AppData; route?: string } = {}) {
  await seed(data);
  return render(
    <MemoryRouter initialEntries={[route]}>
      <StoreProvider>{ui}</StoreProvider>
    </MemoryRouter>,
  );
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
