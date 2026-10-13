import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { addDays, startOfWeek, todayISO } from '../../shared/kernel/dates';
import { makeData, makeSession, renderWithStore } from '../../test/render';
import Week from './Week';

const today = todayISO();
const item = (date: string, kcal: number) => ({ id: `l${date}${kcal}`, date, meal: 'lunch' as const, name: 'Plat', quantity: 1, unit: 'unité' as const, kcal, protein: 20, carbs: 0, fat: 0 });

describe('Week', () => {
  it('affiche une semaine vide', async () => {
    await renderWithStore(<Week />);
    expect(await screen.findByRole('heading', { name: 'Semaine' })).toBeInTheDocument();
    expect(screen.getByText(/sur les 0 jour/)).toBeInTheDocument();
  });

  it('calcule moyennes, sport, muscu et variation de poids', async () => {
    const monday = startOfWeek(today);
    const data = makeData({
      log: [item(monday, 2500), item(addDays(monday, 1), 1500)],
      workouts: [{ id: 'w', date: monday, activity: 'Vélo', duration: 45, kcal: 300 }],
      strength: [makeSession(0)],
      weights: [
        { id: 'a', date: monday, weight: 80 },
        { id: 'b', date: addDays(monday, 2), weight: 79 },
      ],
      settings: { kcalGoal: 2000, proteinGoal: 40 },
    });
    await renderWithStore(<Week />, { data });
    expect(await screen.findByText('Moyenne / jour')).toBeInTheDocument();
    expect(screen.getByText(/sur les 2 jour/)).toBeInTheDocument();
    expect(screen.getByText('Muscu')).toBeInTheDocument();
    expect(screen.getByText('Poids')).toBeInTheDocument();
    expect(screen.getByText('Protéines (objectif 40 g)')).toBeInTheDocument();
  });

  it('navigue entre les semaines', async () => {
    await renderWithStore(<Week />);
    await userEvent.click(await screen.findByLabelText('Semaine précédente'));
    const back = screen.getByRole('button', { name: 'Cette semaine' });
    await userEvent.click(back);
    expect(screen.queryByRole('button', { name: 'Cette semaine' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Semaine suivante'));
    expect(screen.getByRole('button', { name: 'Cette semaine' })).toBeInTheDocument();
  });

  it('lie chaque jour au journal', async () => {
    await renderWithStore(<Week />);
    const links = await screen.findAllByRole('link');
    expect(links).toHaveLength(7);
    expect(links[0].getAttribute('href')).toMatch(/^\/journal\?d=\d{4}-\d{2}-\d{2}$/);
  });
});
