import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { addDays, todayISO } from '../../shared/kernel/dates';
import { makeData, makeSession, renderWithStore } from '../../test/render';
import Dashboard from './Dashboard';

const today = todayISO();

describe('Dashboard', () => {
  it('invite à importer des séances et à saisir une pesée quand il n’y a rien', async () => {
    await renderWithStore(<Dashboard />);
    expect(await screen.findByText(/Aucune séance importée/)).toBeInTheDocument();
    expect(screen.getByText('Aucune pesée enregistrée.')).toBeInTheDocument();
  });

  it('résume la journée, la musculation et le poids', async () => {
    const data = makeData({
      log: [{ id: 'l', date: today, meal: 'lunch', name: 'Riz', quantity: 100, unit: 'g', kcal: 500, protein: 10, carbs: 80, fat: 5 }],
      strength: [makeSession(1)],
      weights: [
        { id: 'w1', date: addDays(today, -40), weight: 82 },
        { id: 'w2', date: addDays(today, -5), weight: 80 },
      ],
      settings: { kcalGoal: 2000, targetWeight: 75 },
    });
    await renderWithStore(<Dashboard />, { data });
    expect(await screen.findByText('Restantes')).toBeInTheDocument();
    expect(screen.getByText('1500')).toBeInTheDocument();
    expect(screen.getByText('Séances cette semaine')).toBeInTheDocument();
    expect(screen.getByText(/Dernière séance/)).toBeInTheDocument();
    expect(screen.getByText('Sur 30 jours')).toBeInTheDocument();
    expect(screen.getAllByText('Objectif').length).toBeGreaterThan(0);
    expect(screen.queryByText('Aucune pesée enregistrée.')).not.toBeInTheDocument();
  });
});
