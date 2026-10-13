import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { addDays, todayISO } from '../../shared/kernel/dates';
import { makeData, renderWithStore } from '../../test/render';
import Insights from './Insights';

const today = todayISO();
const item = (date: string, kcal: number) => ({ id: `l${date}`, date, meal: 'lunch' as const, name: 'Plat', quantity: 1, unit: 'unité' as const, kcal, protein: 100, carbs: 200, fat: 60 });

describe('Insights', () => {
  it('invite à renseigner des repas quand le journal est vide', async () => {
    await renderWithStore(<Insights />);
    expect(await screen.findByText(/Renseignez quelques repas/)).toBeInTheDocument();
  });

  it('affiche synthèse, répartition, calendrier et tour de taille', async () => {
    const log = Array.from({ length: 10 }, (_, i) => item(addDays(today, -i), 2000));
    const measurements = [
      { id: 'm1', date: addDays(today, -20), values: { waist: 92 } },
      { id: 'm2', date: today, values: { waist: 90 } },
    ];
    await renderWithStore(<Insights />, { data: makeData({ log, measurements, settings: { kcalGoal: 2000, proteinGoal: 90, heightCm: 180 } }) });
    expect(await screen.findByText('À retenir')).toBeInTheDocument();
    expect(screen.getByText('Série en cours')).toBeInTheDocument();
    expect(screen.getByText('Protéines atteintes (28 j)')).toBeInTheDocument();
    expect(screen.getAllByText(/g \/ jour/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link').length).toBeGreaterThan(20);
    expect(screen.getByText('Tour de taille')).toBeInTheDocument();
    expect(screen.getByText('Taille / hauteur')).toBeInTheDocument();
  });

  it('suggère de renseigner la taille quand elle manque', async () => {
    const measurements = [{ id: 'm1', date: today, values: { waist: 90 } }];
    await renderWithStore(<Insights />, { data: makeData({ log: [item(today, 1800)], measurements }) });
    expect(await screen.findByText(/Renseignez votre taille/)).toBeInTheDocument();
  });
});
