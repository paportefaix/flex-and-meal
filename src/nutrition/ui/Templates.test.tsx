import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { loadFromDb } from '../../infrastructure/db';
import { makeData, renderWithStore } from '../../test/render';
import Templates from './Templates';

const riz = { id: 'riz', name: 'Riz test', unit: 'g' as const, kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 };
const tpl = { id: 't', name: 'Déj riz', items: [{ foodId: 'riz', quantity: 200 }] };

describe('Templates', () => {
  it('invite à créer un premier repas type', async () => {
    await renderWithStore(<Templates />, { data: makeData({ foods: [riz] }) });
    expect(await screen.findByText(/Aucun repas type/)).toBeInTheDocument();
  });

  it('affiche les repas types avec leurs totaux', async () => {
    await renderWithStore(<Templates />, { data: makeData({ foods: [riz], templates: [tpl] }) });
    expect(await screen.findByText('Déj riz')).toBeInTheDocument();
    expect(screen.getByText('260 kcal')).toBeInTheDocument();
    expect(screen.getByText('Riz test (200 g)')).toBeInTheDocument();
  });

  it('crée un repas type', async () => {
    await renderWithStore(<Templates />, { data: makeData({ foods: [riz] }) });
    await userEvent.click(await screen.findByRole('button', { name: '+ Nouveau repas type' }));
    const save = screen.getByRole('button', { name: 'Enregistrer' });
    expect(save).toBeDisabled();
    await userEvent.type(screen.getByPlaceholderText(/Nom/), 'Mon repas');
    await userEvent.type(screen.getByPlaceholderText('Rechercher un aliment…'), 'Riz test');
    await userEvent.type(screen.getByPlaceholderText('g'), '100');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(screen.getByText('Total : 130 kcal')).toBeInTheDocument();
    await userEvent.click(save);
    await waitFor(async () => expect((await loadFromDb())?.templates).toEqual([expect.objectContaining({ name: 'Mon repas', items: [{ foodId: 'riz', quantity: 100 }] })]));
  });

  it('modifie la quantité d’un repas type existant, retire un aliment et annule', async () => {
    await renderWithStore(<Templates />, { data: makeData({ foods: [riz], templates: [tpl] }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Modifier' }));
    expect(screen.getByText('Modifier le repas type')).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue('200'), { target: { value: '300' } });
    expect(screen.getByText('Total : 390 kcal')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Retirer Riz test'));
    expect(screen.getByText('Total : 0 kcal')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.getByRole('button', { name: '+ Nouveau repas type' })).toBeInTheDocument();
  });

  it('supprime un repas type après confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await renderWithStore(<Templates />, { data: makeData({ foods: [riz], templates: [tpl] }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer' }));
    await waitFor(async () => expect((await loadFromDb())?.templates).toEqual([]));
  });
});
