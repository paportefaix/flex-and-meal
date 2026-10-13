import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeData, renderWithStore } from '../../test/render';
import { FoodPicker } from './FoodPicker';

const riz = { id: 'riz', name: 'Riz test', unit: 'g' as const, kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 };

describe('FoodPicker', () => {
  it('reste désactivé tant que l’aliment ou la quantité manquent', async () => {
    await renderWithStore(<FoodPicker onAdd={() => {}} />, { data: makeData({ foods: [riz] }) });
    const add = await screen.findByRole('button', { name: 'Ajouter' });
    expect(add).toBeDisabled();
    await userEvent.type(screen.getByPlaceholderText('Rechercher un aliment…'), 'Riz test');
    expect(add).toBeDisabled();
  });

  it('ajoute un aliment connu avec sa quantité et affiche les calories', async () => {
    const onAdd = vi.fn();
    await renderWithStore(<FoodPicker onAdd={onAdd} />, { data: makeData({ foods: [riz] }) });
    await userEvent.type(await screen.findByPlaceholderText('Rechercher un aliment…'), 'riz TEST');
    await userEvent.type(screen.getByPlaceholderText('g'), '200');
    expect(screen.getByText('260 kcal')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: 'riz' }), 200);
    expect(screen.getByPlaceholderText('Rechercher un aliment…')).toHaveValue('');
  });

  it('sélectionne un résultat de recherche et l’enregistre dans la base perso', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([{ id: 'c1', name: 'Courgette crue', unit: 'g', kcal: 20, group: 'légumes' }])));
    const onAdd = vi.fn();
    await renderWithStore(<FoodPicker onAdd={onAdd} />, { data: makeData({ foods: [] }) });
    await userEvent.type(await screen.findByPlaceholderText('Rechercher un aliment…'), 'courgette');
    await userEvent.click(await screen.findByRole('button', { name: /Courgette crue/ }));
    await waitFor(() => expect(screen.getByPlaceholderText('Rechercher un aliment…')).toHaveValue('Courgette crue'));
    await userEvent.type(screen.getByPlaceholderText('g'), '100');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ name: 'Courgette crue' }), 100);
  });
});
