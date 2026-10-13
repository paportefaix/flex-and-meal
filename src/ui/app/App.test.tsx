import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { todayISO } from '../../shared/kernel/dates';
import { makeData, renderWithStore, seed } from '../../test/render';
import { StoreProvider } from '../state/store';
import { App } from './App';

const log = [{ id: 'l', date: todayISO(), meal: 'lunch' as const, name: 'Plat', quantity: 1, unit: 'unité' as const, kcal: 500, protein: 0, carbs: 0, fat: 0 }];

describe('App', () => {
  it('affiche la navigation et l’accueil', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('[]'));
    await renderWithStore(<App />);
    expect(await screen.findByText('Flex & Meal')).toBeInTheDocument();
    expect(within(screen.getByRole('navigation')).getAllByRole('link')).toHaveLength(9);
    expect(screen.getByText("Aujourd'hui")).toBeInTheDocument();
  });

  it('navigue vers les autres pages', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('[]'));
    await renderWithStore(<App />);
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
      await userEvent.click(await screen.findByRole('link', { name: link }));
      expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    }
  });

  it('redirige une route inconnue vers l’accueil', async () => {
    await renderWithStore(<App />, { route: '/nimporte-quoi' });
    expect(await screen.findByText('Aujourd\'hui')).toBeInTheDocument();
  });

  it('rappelle d’exporter quand des repas existent sans export récent', async () => {
    await renderWithStore(<App />, { data: makeData({ log }) });
    expect(await screen.findByText(/n'ont pas été sauvegardées récemment/)).toBeInTheDocument();
  });

  it('ne rappelle rien après un export récent', async () => {
    localStorage.setItem('flex-and-meal:lastExport', String(Date.now()));
    await renderWithStore(<App />, { data: makeData({ log }) });
    await screen.findByText('Flex & Meal');
    expect(screen.queryByText(/n'ont pas été sauvegardées récemment/)).not.toBeInTheDocument();
  });

  it('signale un échec d’enregistrement dans la base locale', async () => {
    await seed(makeData());
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const db = await import('../../infrastructure/db');
    vi.spyOn(db, 'saveDiff').mockRejectedValue(new Error('quota'));
    render(
      <MemoryRouter>
        <StoreProvider>
          <App />
        </StoreProvider>
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole('link', { name: 'Poids & mensurations' }));
    await userEvent.type(await screen.findByPlaceholderText('kg'), '70');
    await userEvent.tab();
    expect(await screen.findByText(/L'enregistrement dans la base locale a échoué/)).toBeInTheDocument();
  });
});
