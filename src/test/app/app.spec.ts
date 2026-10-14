import { screen, waitFor, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../app/app';
import { routes } from '../../app/app.routes';
import { SAVE_DIFF } from '../../app/ui/state/store';
import { todayISO } from '../../app/shared/kernel/dates';
import { makeData, renderWithStore } from '../render';

const log = [{ id: 'l', date: todayISO(), meal: 'lunch' as const, name: 'Plat', quantity: 1, unit: 'unité' as const, kcal: 500, protein: 0, carbs: 0, fat: 0 }];

describe('App', () => {
  it('affiche la navigation et l’accueil', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('[]'));
    await renderWithStore(App, { routes });
    expect(await screen.findByText('Flex & Meal')).toBeInTheDocument();
    expect(within(screen.getByRole('tablist', { name: 'Navigation principale' })).getAllByRole('tab')).toHaveLength(9);
    expect(await screen.findByText("Aujourd'hui")).toBeInTheDocument();
  });

  it('navigue vers les autres pages', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('[]'));
    await renderWithStore(App, { routes });
    for (const [link, heading] of [
      ['Journal', /Petit-déjeuner/],
      ['Semaine', 'Semaine'],
      ['Analyses', 'Analyses'],
      ['Muscu', 'Musculation'],
      ['Poids & mensurations', 'Poids & mensurations'],
      ['Repas types', 'Repas types'],
      ['Aliments', 'Aliments'],
      ['Réglages', 'Réglages'],
    ] as const) {
      await userEvent.click(await screen.findByRole('tab', { name: link }));
      expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    }
  });

  it('redirige une route inconnue vers l’accueil', async () => {
    await renderWithStore(App, { routes, route: '/nimporte-quoi' });
    expect(await screen.findByText("Aujourd'hui")).toBeInTheDocument();
  });

  it('rappelle d’exporter quand des repas existent sans export récent', async () => {
    await renderWithStore(App, { routes, data: makeData({ log }) });
    expect(await screen.findByText(/n'ont pas été sauvegardées récemment/)).toBeInTheDocument();
  });

  it('ne rappelle rien après un export récent', async () => {
    localStorage.setItem('flex-and-meal:lastExport', String(Date.now()));
    await renderWithStore(App, { routes, data: makeData({ log }) });
    await screen.findByText('Flex & Meal');
    expect(screen.queryByText(/n'ont pas été sauvegardées récemment/)).not.toBeInTheDocument();
  });

  it('signale un échec d’enregistrement dans la base locale', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { store } = await renderWithStore(App, { routes, storeProviders: [{ provide: SAVE_DIFF, useValue: () => Promise.reject(new Error('quota')) }] });
    store.update((d) => ({ ...d, weights: [{ id: 'w', date: todayISO(), weight: 70 }] }));
    expect(await screen.findByText(/L'enregistrement dans la base locale a échoué/)).toBeInTheDocument();
    await waitFor(() => expect(store.saveError()).toBe(true));
  });
});
