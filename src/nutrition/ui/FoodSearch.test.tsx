import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeData, renderWithStore } from '../../test/render';
import { FoodSearch } from './FoodSearch';

const ciqual = [{ id: 'c1', name: 'Thon cru', unit: 'g', kcal: 110, protein: 24, carbs: 0, fat: 1, group: 'poissons' }];
const hits = {
  hits: [
    { code: '1', product_name: 'Pomme', nutriments: { 'energy-kcal_100g': 52 }, nova_group: 1 },
    { code: '2', product_name: 'Chips', brands: 'Lays', nutriments: { 'energy-kcal_100g': 540 }, nova_group: 4 },
  ],
};

function mockFetch(online: unknown = hits, ok = true) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) =>
    String(url).includes('off-search') ? new Response(JSON.stringify(online), { status: ok ? 200 : 500 }) : new Response(JSON.stringify(ciqual)),
  );
}

describe('FoodSearch', () => {
  // Doit rester le premier test : la table CIQUAL est ensuite chargée et mise en cache pour tout le fichier.
  it('signale une base CIQUAL indisponible', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }));
    await renderWithStore(<FoodSearch query="thon" onPick={() => {}} />);
    expect(await screen.findByText('Base CIQUAL indisponible.')).toBeInTheDocument();
  });

  it('ne montre aucun résultat sous la longueur minimale', async () => {
    mockFetch();
    await renderWithStore(<FoodSearch query="t" onPick={() => {}} />);
    await screen.findByText('Ma base + CIQUAL');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('trouve un aliment CIQUAL et le renvoie sans champ de groupe', async () => {
    mockFetch();
    const onPick = vi.fn();
    await renderWithStore(<FoodSearch query="thon" onPick={onPick} />);
    await userEvent.click(await screen.findByRole('button', { name: /Thon cru/ }));
    expect(onPick).toHaveBeenCalledWith({ id: 'c1', name: 'Thon cru', unit: 'g', kcal: 110, protein: 24, carbs: 0, fat: 1 });
  });

  it('trouve un aliment de la base perso', async () => {
    mockFetch();
    const mine = { id: 'm', name: 'Thon maison', unit: 'g' as const, kcal: 100 };
    await renderWithStore(<FoodSearch query="thon" onPick={() => {}} />, { data: makeData({ foods: [mine] }) });
    expect(await screen.findByText('Mes aliments')).toBeInTheDocument();
  });

  it('indique l’absence de résultat', async () => {
    mockFetch();
    await renderWithStore(<FoodSearch query="zzzzz" onPick={() => {}} />);
    await screen.findByText('Recherche…');
    await waitFor(() => expect(screen.getByText('Aucun résultat.')).toBeInTheDocument());
  });

  it('recherche sur Open Food Facts, filtre les bruts et renvoie le produit avec sa marque', async () => {
    mockFetch();
    const onPick = vi.fn();
    await renderWithStore(<FoodSearch query="pomme" onPick={onPick} />);
    await userEvent.click(await screen.findByText('Open Food Facts'));
    expect(await screen.findByText('Ultra-transformé')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/Bruts uniquement/));
    expect(screen.queryByText('Ultra-transformé')).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/Bruts uniquement/));
    await userEvent.click(screen.getByRole('button', { name: /Chips/ }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ name: 'Chips (Lays)', kcal: 540 }));
  });

  it('signale une recherche en ligne en erreur', async () => {
    mockFetch({}, false);
    await renderWithStore(<FoodSearch query="pomme" onPick={() => {}} />);
    await userEvent.click(await screen.findByText('Open Food Facts'));
    expect(await screen.findByText(/Recherche en ligne indisponible/)).toBeInTheDocument();
  });

  it('indique l’absence de produit en ligne', async () => {
    mockFetch({ hits: [] });
    await renderWithStore(<FoodSearch query="pomme" onPick={() => {}} />);
    await userEvent.click(await screen.findByText('Open Food Facts'));
    expect(await screen.findByText('Aucun résultat sur Open Food Facts.')).toBeInTheDocument();
  });
});
