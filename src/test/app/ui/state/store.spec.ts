import { describe, expect, it } from 'vitest';
import { loadFromDb } from '../../../../app/infrastructure/db';
import { loadStore, makeData } from '../../../render';

describe('Store', () => {
  it('charge les données de la base locale', async () => {
    const store = await loadStore(makeData({ settings: { kcalGoal: 1800 } }));
    expect(store.data().settings.kcalGoal).toBe(1800);
  });

  it('enregistre les modifications dans la base', async () => {
    const store = await loadStore();
    store.update((d) => ({ ...d, settings: { ...d.settings, kcalGoal: 1234 } }));
    await store.whenSaved();
    expect((await loadFromDb())?.settings.kcalGoal).toBe(1234);
    expect(store.saveError()).toBe(false);
  });

  it('remet les données à zéro', async () => {
    const store = await loadStore(makeData({ settings: { kcalGoal: 1800 } }));
    store.reset();
    expect(store.data().settings.kcalGoal).toBe(2000);
  });
});
