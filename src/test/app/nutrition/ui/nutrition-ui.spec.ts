import { screen, waitFor, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { loadFromDb } from '../../../../app/infrastructure/db';
import { makeData, renderWithStore } from '../../../render';
import { FoodPicker } from '../../../../app/nutrition/ui/food-picker';
import { FoodSearch } from '../../../../app/nutrition/ui/food-search';
import { Foods } from '../../../../app/nutrition/ui/foods';
import { Templates } from '../../../../app/nutrition/ui/templates';

const riz = { id: 'riz', name: 'Riz test', unit: 'g' as const, kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 };
const tpl = { id: 't', name: 'Déj riz', items: [{ foodId: 'riz', quantity: 200 }] };
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
    await renderWithStore(FoodSearch, { inputs: { query: 'thon' } });
    expect(await screen.findByText('Base CIQUAL indisponible.')).toBeInTheDocument();
  });

  it('ne montre aucun résultat sous la longueur minimale', async () => {
    mockFetch();
    await renderWithStore(FoodSearch, { inputs: { query: 't' } });
    await screen.findByText('Ma base + CIQUAL');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('trouve un aliment CIQUAL et le renvoie sans champ de groupe', async () => {
    mockFetch();
    const { component } = await renderWithStore(FoodSearch, { inputs: { query: 'thon' } });
    const picked = vi.fn();
    component.picked.subscribe(picked);
    await userEvent.click(await screen.findByRole('button', { name: /Thon cru/ }));
    expect(picked).toHaveBeenCalledWith({ id: 'c1', name: 'Thon cru', unit: 'g', kcal: 110, protein: 24, carbs: 0, fat: 1 });
  });

  it('trouve un aliment de la base perso', async () => {
    mockFetch();
    const mine = { id: 'm', name: 'Thon maison', unit: 'g' as const, kcal: 100 };
    await renderWithStore(FoodSearch, { inputs: { query: 'thon' }, data: makeData({ foods: [mine] }) });
    expect(await screen.findByText('Mes aliments')).toBeInTheDocument();
  });

  it('indique l’absence de résultat', async () => {
    mockFetch();
    await renderWithStore(FoodSearch, { inputs: { query: 'zzzzz' } });
    await waitFor(() => expect(screen.getByText('Aucun résultat.')).toBeInTheDocument());
  });

  it('recherche sur Open Food Facts, filtre les bruts et renvoie le produit avec sa marque', async () => {
    mockFetch();
    const { component } = await renderWithStore(FoodSearch, { inputs: { query: 'pomme' } });
    const picked = vi.fn();
    component.picked.subscribe(picked);
    await userEvent.click(await screen.findByText('Open Food Facts'));
    expect(await screen.findByText('Ultra-transformé')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/Bruts uniquement/));
    await waitFor(() => expect(screen.queryByText('Ultra-transformé')).not.toBeInTheDocument());
    await userEvent.click(screen.getByLabelText(/Bruts uniquement/));
    await userEvent.click(await screen.findByRole('button', { name: /Chips/ }));
    expect(picked).toHaveBeenCalledWith(expect.objectContaining({ name: 'Chips (Lays)', kcal: 540 }));
  });

  it('signale une recherche en ligne en erreur', async () => {
    mockFetch({}, false);
    await renderWithStore(FoodSearch, { inputs: { query: 'pomme' } });
    await userEvent.click(await screen.findByText('Open Food Facts'));
    expect(await screen.findByText(/Recherche en ligne indisponible/)).toBeInTheDocument();
  });

  it('indique l’absence de produit en ligne', async () => {
    mockFetch({ hits: [] });
    await renderWithStore(FoodSearch, { inputs: { query: 'pomme' } });
    await userEvent.click(await screen.findByText('Open Food Facts'));
    expect(await screen.findByText('Aucun résultat sur Open Food Facts.')).toBeInTheDocument();
  });
});

describe('FoodPicker', () => {
  it('reste désactivé tant que l’aliment ou la quantité manquent', async () => {
    await renderWithStore(FoodPicker, { inputs: {}, data: makeData({ foods: [riz] }) });
    const add = await screen.findByRole('button', { name: 'Ajouter' });
    expect(add).toBeDisabled();
    await userEvent.type(screen.getByPlaceholderText('Rechercher un aliment…'), 'Riz test');
    expect(add).toBeDisabled();
  });

  it('ajoute un aliment connu avec sa quantité et affiche les calories', async () => {
    mockFetch();
    const { component } = await renderWithStore(FoodPicker, { inputs: {}, data: makeData({ foods: [riz] }) });
    const added = vi.fn();
    component.add.subscribe(added);
    await userEvent.type(await screen.findByPlaceholderText('Rechercher un aliment…'), 'riz TEST');
    await userEvent.type(await screen.findByPlaceholderText('g'), '200');
    expect(await screen.findByText('260 kcal')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(added).toHaveBeenCalledWith({ food: expect.objectContaining({ id: 'riz' }), quantity: 200 });
    await waitFor(() => expect(screen.getByPlaceholderText('Rechercher un aliment…')).toHaveValue(''));
  });

  it('sélectionne un résultat de recherche et l’enregistre dans la base perso', async () => {
    mockFetch();
    const { component, store } = await renderWithStore(FoodPicker, { inputs: {}, data: makeData({ foods: [] }) });
    const added = vi.fn();
    component.add.subscribe(added);
    await userEvent.type(await screen.findByPlaceholderText('Rechercher un aliment…'), 'thon');
    await userEvent.click(await screen.findByRole('button', { name: /Thon cru/ }));
    await waitFor(() => expect(screen.getByPlaceholderText('Rechercher un aliment…')).toHaveValue('Thon cru'));
    expect(store.data().foods.map((f) => f.name)).toEqual(['Thon cru']);
    await userEvent.type(await screen.findByPlaceholderText('g'), '100');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(added).toHaveBeenCalledWith({ food: expect.objectContaining({ name: 'Thon cru' }), quantity: 100 });
  });
});

const confirmDialog = async () => userEvent.click(await screen.findByRole('button', { name: 'Confirmer' }));

describe('Foods', () => {
  it('liste et filtre les aliments', async () => {
    mockFetch();
    await renderWithStore(Foods, { data: makeData({ foods: [riz, { id: 'p', name: 'Pomme test', unit: 'unité', kcal: 80 }] }) });
    expect(await screen.findByText('Riz test')).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText('Filtrer…'), 'pomme');
    await waitFor(() => expect(screen.queryByText('Riz test')).not.toBeInTheDocument());
    expect(screen.getByText('Pomme test')).toBeInTheDocument();
  });

  it('crée un aliment', async () => {
    mockFetch();
    await renderWithStore(Foods, { data: makeData({ foods: [] }) });
    await userEvent.type(await screen.findByLabelText('Nom'), 'Lentilles');
    await userEvent.type(screen.getByLabelText('Calories (kcal)'), '116');
    await userEvent.type(screen.getByLabelText('Protéines (g)'), '9');
    await userEvent.selectOptions(screen.getByLabelText('Unité'), 'ml');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    await waitFor(async () => expect((await loadFromDb())?.foods).toEqual([expect.objectContaining({ name: 'Lentilles', kcal: 116, protein: 9, unit: 'ml' })]));
    await waitFor(() => expect(screen.getByLabelText('Nom')).toHaveValue(''));
  });

  it('modifie puis annule la modification', async () => {
    mockFetch();
    await renderWithStore(Foods, { data: makeData({ foods: [riz] }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Modifier' }));
    expect(await screen.findByText('Modifier l’aliment')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Nom')).toHaveValue('Riz test'));
    await userEvent.clear(screen.getByLabelText('Calories (kcal)'));
    await userEvent.type(screen.getByLabelText('Calories (kcal)'), '999');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('999')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Modifier' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Annuler' }));
    expect(await screen.findByText('Nouvel aliment')).toBeInTheDocument();
  });

  it('supprime un aliment après confirmation et le retire des repas types', async () => {
    mockFetch();
    const data = makeData({ foods: [riz], templates: [{ id: 't', name: 'Repas', items: [{ foodId: 'riz', quantity: 100 }] }] });
    await renderWithStore(Foods, { data });
    await userEvent.click(await screen.findByLabelText('Supprimer Riz test'));
    expect(await screen.findByText(/1 repas type/)).toBeInTheDocument();
    await confirmDialog();
    await waitFor(async () => {
      const saved = await loadFromDb();
      expect(saved?.foods).toEqual([]);
      expect(saved?.templates[0].items).toEqual([]);
    });
  });

  it('conserve l’aliment si la suppression est refusée', async () => {
    mockFetch();
    await renderWithStore(Foods, { data: makeData({ foods: [riz] }) });
    await userEvent.click(await screen.findByLabelText('Supprimer Riz test'));
    await userEvent.click(await screen.findByRole('button', { name: 'Annuler' }));
    expect(within(screen.getByRole('table')).getByText('Riz test')).toBeInTheDocument();
  });

  it('préremplit le formulaire depuis un résultat de recherche', async () => {
    mockFetch();
    await renderWithStore(Foods, { data: makeData({ foods: [] }) });
    await userEvent.type(await screen.findByLabelText('Nom'), 'thon');
    await userEvent.click(await screen.findByRole('button', { name: /Thon cru/ }));
    await waitFor(() => expect(screen.getByLabelText('Nom')).toHaveValue('Thon cru'));
    await waitFor(() => expect(screen.getByLabelText('Calories (kcal)')).toHaveValue('110'));
  });
});

describe('Templates', () => {
  it('invite à créer un premier repas type', async () => {
    await renderWithStore(Templates, { data: makeData({ foods: [riz] }) });
    expect(await screen.findByText(/Aucun repas type/)).toBeInTheDocument();
  });

  it('affiche les repas types avec leurs totaux', async () => {
    await renderWithStore(Templates, { data: makeData({ foods: [riz], templates: [tpl] }) });
    expect(await screen.findByText('Déj riz')).toBeInTheDocument();
    expect(screen.getByText('260 kcal')).toBeInTheDocument();
    expect(screen.getByText('Riz test (200 g)')).toBeInTheDocument();
  });

  it('crée un repas type', async () => {
    mockFetch();
    await renderWithStore(Templates, { data: makeData({ foods: [riz] }) });
    await userEvent.click(await screen.findByRole('button', { name: '+ Nouveau repas type' }));
    const save = await screen.findByRole('button', { name: 'Enregistrer' });
    expect(save).toBeDisabled();
    await userEvent.type(screen.getByPlaceholderText(/Nom/), 'Mon repas');
    await userEvent.type(screen.getByPlaceholderText('Rechercher un aliment…'), 'Riz test');
    await userEvent.type(await screen.findByPlaceholderText('g'), '100');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(await screen.findByText('Total : 130 kcal')).toBeInTheDocument();
    await userEvent.click(save);
    await waitFor(async () => expect((await loadFromDb())?.templates).toEqual([expect.objectContaining({ name: 'Mon repas', items: [{ foodId: 'riz', quantity: 100 }] })]));
  });

  it('modifie la quantité d’un repas type existant, retire un aliment et annule', async () => {
    await renderWithStore(Templates, { data: makeData({ foods: [riz], templates: [tpl] }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Modifier' }));
    expect(await screen.findByText('Modifier le repas type')).toBeInTheDocument();
    const qty = screen.getByDisplayValue('200');
    await userEvent.clear(qty);
    await userEvent.type(qty, '300');
    expect(await screen.findByText('Total : 390 kcal')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Retirer Riz test'));
    expect(await screen.findByText('Total : 0 kcal')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(await screen.findByRole('button', { name: '+ Nouveau repas type' })).toBeInTheDocument();
  });

  it('supprime un repas type après confirmation', async () => {
    await renderWithStore(Templates, { data: makeData({ foods: [riz], templates: [tpl] }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer' }));
    await confirmDialog();
    await waitFor(async () => expect((await loadFromDb())?.templates).toEqual([]));
  });
});
