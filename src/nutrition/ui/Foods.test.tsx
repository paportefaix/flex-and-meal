import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { loadFromDb } from '../../infrastructure/db';
import { makeData, renderWithStore } from '../../test/render';
import Foods from './Foods';

const riz = { id: 'riz', name: 'Riz test', unit: 'g' as const, kcal: 130, protein: 2.7 };
const noFetch = () => vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify([{ id: 'c1', name: 'Thon cru', unit: 'g', kcal: 110, protein: 24, group: 'poissons' }])));

describe('Foods', () => {
  it('liste et filtre les aliments', async () => {
    noFetch();
    await renderWithStore(<Foods />, { data: makeData({ foods: [riz, { id: 'p', name: 'Pomme test', unit: 'unité', kcal: 80 }] }) });
    expect(await screen.findByText('Riz test')).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText('Filtrer…'), 'pomme');
    expect(screen.queryByText('Riz test')).not.toBeInTheDocument();
    expect(screen.getByText('Pomme test')).toBeInTheDocument();
  });

  it('crée un aliment', async () => {
    noFetch();
    await renderWithStore(<Foods />, { data: makeData({ foods: [] }) });
    await userEvent.type(await screen.findByLabelText('Nom'), 'Lentilles');
    await userEvent.type(screen.getByLabelText('Calories (kcal)'), '116');
    await userEvent.type(screen.getByLabelText('Protéines (g)'), '9');
    await userEvent.selectOptions(screen.getByLabelText('Unité'), 'ml');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    await waitFor(async () => expect((await loadFromDb())?.foods).toEqual([expect.objectContaining({ name: 'Lentilles', kcal: 116, protein: 9, unit: 'ml' })]));
    expect(screen.getByLabelText('Nom')).toHaveValue('');
  });

  it('modifie puis annule la modification', async () => {
    noFetch();
    await renderWithStore(<Foods />, { data: makeData({ foods: [riz] }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Modifier' }));
    expect(screen.getByText('Modifier l’aliment')).toBeInTheDocument();
    expect(screen.getByLabelText('Nom')).toHaveValue('Riz test');
    await userEvent.clear(screen.getByLabelText('Calories (kcal)'));
    await userEvent.type(screen.getByLabelText('Calories (kcal)'), '999');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('999')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Modifier' }));
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.getByText('Nouvel aliment')).toBeInTheDocument();
  });

  it('supprime un aliment après confirmation et le retire des repas types', async () => {
    noFetch();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const data = makeData({ foods: [riz], templates: [{ id: 't', name: 'Repas', items: [{ foodId: 'riz', quantity: 100 }] }] });
    await renderWithStore(<Foods />, { data });
    await userEvent.click(await screen.findByLabelText('Supprimer Riz test'));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('1 repas type'));
    await waitFor(async () => {
      const saved = await loadFromDb();
      expect(saved?.foods).toEqual([]);
      expect(saved?.templates[0].items).toEqual([]);
    });
  });

  it('conserve l’aliment si la suppression est refusée', async () => {
    noFetch();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await renderWithStore(<Foods />, { data: makeData({ foods: [riz] }) });
    await userEvent.click(await screen.findByLabelText('Supprimer Riz test'));
    expect(within(screen.getByRole('table')).getByText('Riz test')).toBeInTheDocument();
  });

  it('préremplit le formulaire depuis un résultat de recherche', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([{ id: 'c1', name: 'Thon cru', unit: 'g', kcal: 110, protein: 24, group: 'poissons' }])));
    await renderWithStore(<Foods />, { data: makeData({ foods: [] }) });
    await userEvent.type(await screen.findByLabelText('Nom'), 'thon');
    await userEvent.click(await screen.findByRole('button', { name: /Thon cru/ }));
    expect(screen.getByLabelText('Nom')).toHaveValue('Thon cru');
    expect(screen.getByLabelText('Calories (kcal)')).toHaveValue('110');
  });
});
