import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { loadFromDb } from '../../infrastructure/db';
import { addDays, todayISO } from '../../shared/kernel/dates';
import { makeData, makeSession, renderWithStore } from '../../test/render';
import Journal from './Journal';

const today = todayISO();
const riz = { id: 'riz', name: 'Riz test', unit: 'g' as const, kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 };
const logged = { id: 'l1', date: today, meal: 'lunch' as const, foodId: 'riz', name: 'Riz test', quantity: 200, unit: 'g' as const, kcal: 260, protein: 5, carbs: 56, fat: 1 };

const section = (title: string) => screen.getByRole('heading', { name: title }).closest('section')!;

describe('Journal', () => {
  it('affiche les quatre repas et la section sport', async () => {
    await renderWithStore(<Journal />);
    for (const t of ['Petit-déjeuner', 'Déjeuner', 'Collation', 'Dîner', 'Sport']) expect(await screen.findByRole('heading', { name: t })).toBeInTheDocument();
  });

  it('ajoute un aliment à un repas', async () => {
    await renderWithStore(<Journal />, { data: makeData({ foods: [riz] }) });
    await screen.findByRole('heading', { name: 'Déjeuner' });
    const lunch = within(section('Déjeuner'));
    await userEvent.type(lunch.getByPlaceholderText('Rechercher un aliment…'), 'Riz test');
    await userEvent.type(lunch.getByPlaceholderText('g'), '200');
    await userEvent.click(lunch.getByRole('button', { name: 'Ajouter' }));
    await waitFor(async () => expect((await loadFromDb())?.log).toEqual([expect.objectContaining({ meal: 'lunch', date: today, name: 'Riz test', quantity: 200, kcal: 260 })]));
    expect(await lunch.findByText('260 kcal', { selector: '.num' })).toBeInTheDocument();
  });

  it('retire un aliment', async () => {
    await renderWithStore(<Journal />, { data: makeData({ foods: [riz], log: [logged] }) });
    await userEvent.click(await screen.findByLabelText('Retirer Riz test'));
    await waitFor(async () => expect((await loadFromDb())?.log).toEqual([]));
  });

  it('ajoute une saisie libre puis annule une seconde', async () => {
    await renderWithStore(<Journal />);
    await screen.findByRole('heading', { name: 'Dîner' });
    const dinner = within(section('Dîner'));
    await userEvent.click(dinner.getByRole('button', { name: '+ Saisie libre' }));
    await userEvent.type(dinner.getByPlaceholderText('Plat'), 'Restaurant');
    await userEvent.type(dinner.getByPlaceholderText('kcal'), '800');
    await userEvent.click(dinner.getByRole('button', { name: 'OK' }));
    await waitFor(async () => expect((await loadFromDb())?.log).toEqual([expect.objectContaining({ meal: 'dinner', name: 'Restaurant', kcal: 800 })]));
    await userEvent.click(dinner.getByRole('button', { name: '+ Saisie libre' }));
    await userEvent.click(dinner.getByRole('button', { name: 'Annuler' }));
    expect(dinner.getByRole('button', { name: '+ Saisie libre' })).toBeInTheDocument();
  });

  it('ajoute un repas type', async () => {
    const templates = [{ id: 't', name: 'Mon riz', items: [{ foodId: 'riz', quantity: 100 }, { foodId: 'inconnu', quantity: 1 }] }];
    await renderWithStore(<Journal />, { data: makeData({ foods: [riz], templates }) });
    await screen.findByRole('heading', { name: 'Petit-déjeuner' });
    await userEvent.selectOptions(within(section('Petit-déjeuner')).getByRole('combobox'), 'Mon riz');
    await waitFor(async () => expect((await loadFromDb())?.log).toEqual([expect.objectContaining({ meal: 'breakfast', name: 'Riz test', quantity: 100 })]));
  });

  it('enregistre un repas comme repas type', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('  Déj habituel ');
    await renderWithStore(<Journal />, { data: makeData({ foods: [riz], log: [logged] }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer comme repas type' }));
    await waitFor(async () => expect((await loadFromDb())?.templates).toEqual([expect.objectContaining({ name: 'Déj habituel', items: [{ foodId: 'riz', quantity: 200 }] })]));
  });

  it('n’enregistre pas de repas type sans nom', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('');
    await renderWithStore(<Journal />, { data: makeData({ foods: [riz], log: [logged] }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer comme repas type' }));
    expect((await loadFromDb())?.templates).toEqual([]);
  });

  it('navigue entre les jours', async () => {
    await renderWithStore(<Journal />, { route: `/journal?d=${addDays(today, -3)}` });
    await userEvent.click(await screen.findByLabelText('Jour suivant'));
    await userEvent.click(screen.getByLabelText('Jour précédent'));
    await userEvent.click(screen.getByRole('button', { name: "Aujourd'hui" }));
    expect(screen.queryByRole('button', { name: "Aujourd'hui" })).not.toBeInTheDocument();
  });

  it('affiche les séances de muscu et de cardio du jour, et supprime le cardio', async () => {
    const data = makeData({
      strength: [makeSession(0)],
      workouts: [{ id: 'w', date: today, activity: 'Vélo', duration: 45, kcal: 300, distanceKm: 20 }],
    });
    await renderWithStore(<Journal />, { data });
    expect(await screen.findByText(/Muscu · Push/)).toBeInTheDocument();
    expect(screen.getByText(/20 km/)).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Retirer Vélo'));
    await waitFor(async () => expect((await loadFromDb())?.workouts).toEqual([]));
  });
});
