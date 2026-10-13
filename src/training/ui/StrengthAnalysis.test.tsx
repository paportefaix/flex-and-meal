import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { addDays, todayISO } from '../../shared/kernel/dates';
import { makeData, makeSessions, renderWithStore } from '../../test/render';
import type { StrengthSession } from '../domain/session';
import { ConsistencyCard, CrossCard, MuscleLoadCard, TrendsCard } from './StrengthAnalysis';

const today = todayISO();

const NAMES = ['Bench Press', 'Squat', 'Deadlift', 'Overhead Press', 'Barbell Row', 'Curl', 'Triceps Pushdown', 'Leg Press', 'Lat Pulldown', 'Plank', 'Crunch', 'Lunge', 'Dips', 'Face Pull', 'Calf Raise'];

/** Séances riches : de nombreux exercices pour déplier la liste, avec des charges croissantes. */
const manyExercises = (): StrengthSession[] =>
  [50, 40, 30, 20, 10, 3].map((d, i) => ({
    id: `m-${d}`,
    date: addDays(today, -d),
    title: 'Full body',
    minutes: 70,
    exercises: NAMES.map((name) => ({ name, sets: [{ type: 'normal' as const, weight: 40 + i * 5, reps: 8 }] })),
  }));

describe('TrendsCard', () => {
  it('liste les exercices, filtre et déplie', async () => {
    const onSelect = vi.fn();
    const { container } = await renderWithStore(<TrendsCard sessions={manyExercises()} today={today} selected="Squat" onSelect={onSelect} />);
    expect(await screen.findByText('Tendance par exercice')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Voir les \d+ autres/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Réduire' }));
    await userEvent.click(screen.getByRole('button', { name: 'À surveiller' }));
    await userEvent.click(screen.getByRole('button', { name: 'Tous' }));
    await userEvent.click(screen.getAllByRole('row')[1]);
    expect(onSelect).toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('indique l’absence de plateau dans « À surveiller »', async () => {
    await renderWithStore(<TrendsCard sessions={makeSessions()} today={today} />);
    await userEvent.click(await screen.findByRole('button', { name: 'À surveiller' }));
    expect(screen.getByText(/Aucun plateau ni baisse|Aucun exercice/)).toBeInTheDocument();
  });
});

describe('MuscleLoadCard', () => {
  it('bascule entre séries et tonnage', async () => {
    const sessions = makeSessions();
    await renderWithStore(<MuscleLoadCard all={sessions} period={sessions} today={today} weeks={8} />);
    expect(await screen.findByText('Charge par muscle')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tonnage' }));
    expect(screen.getByRole('button', { name: 'Tonnage' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Séries' }));
    expect(screen.getByText('Séries dures par semaine')).toBeInTheDocument();
  });
});

describe('ConsistencyCard', () => {
  it('affiche la régularité, le calendrier et la densité', async () => {
    await renderWithStore(<ConsistencyCard sessions={makeSessions()} today={today} />);
    expect(await screen.findByText('Régularité')).toBeInTheDocument();
    expect(screen.getByText('Séances par semaine')).toBeInTheDocument();
    expect(screen.getByText('Durée et densité')).toBeInTheDocument();
    expect(screen.getAllByLabelText(/ : \d+ séance/).length).toBeGreaterThan(0);
  });
});

describe('CrossCard', () => {
  it('parcourt les croisements, les périodes et les exercices', async () => {
    const data = makeData({
      strength: makeSessions(),
      weights: [
        { id: 'w1', date: addDays(today, -40), weight: 80 },
        { id: 'w2', date: addDays(today, -5), weight: 79 },
      ],
      measurements: [
        { id: 'm1', date: addDays(today, -40), values: { waist: 92 } },
        { id: 'm2', date: addDays(today, -5), values: { waist: 90 } },
      ],
      log: Array.from({ length: 28 }, (_, i) => ({ id: `l${i}`, date: addDays(today, -i), meal: 'lunch' as const, name: 'Plat', quantity: 1, unit: 'unité' as const, kcal: 2000, protein: 120, carbs: 200, fat: 60 })),
    });
    await renderWithStore(<CrossCard data={data} today={today} />, { data });
    expect(await screen.findByText('Croisements')).toBeInTheDocument();
    for (const name of ['Nutrition', 'Tour de taille', 'Poids de corps']) await userEvent.click(screen.getByRole('button', { name }));
    await userEvent.click(screen.getByRole('button', { name: 'Nutrition' }));
    await userEvent.click(screen.getByRole('button', { name: 'Calories' }));
    await userEvent.click(screen.getByRole('button', { name: 'Protéines' }));
    const periods = within(screen.getByRole('group', { name: 'Période du croisement' })).getAllByRole('button');
    for (const p of periods) await userEvent.click(p);
    await userEvent.click(screen.getByRole('button', { name: 'Poids de corps' }));
    await userEvent.selectOptions(screen.getByLabelText('Exercice'), 'Squat (Barbell)');
    expect(screen.getByLabelText('Exercice')).toHaveValue('Squat (Barbell)');
  });

  it('fonctionne sans aucune donnée', async () => {
    const data = makeData();
    await renderWithStore(<CrossCard data={data} today={today} />, { data });
    expect(await screen.findByText('Croisements')).toBeInTheDocument();
  });
});
