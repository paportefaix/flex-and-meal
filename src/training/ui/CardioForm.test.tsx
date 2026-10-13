import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { loadFromDb } from '../../infrastructure/db';
import { makeData, renderWithStore } from '../../test/render';
import { CardioForm } from './CardioForm';

describe('CardioForm', () => {
  it('n’enregistre rien sans activité ni durée', async () => {
    await renderWithStore(<CardioForm date="2025-01-10" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter' }));
    expect((await loadFromDb())?.workouts).toEqual([]);
  });

  it('enregistre une séance avec les calories saisies et la distance', async () => {
    await renderWithStore(<CardioForm date="2025-01-10" />);
    await userEvent.type(await screen.findByLabelText('Activité'), 'Course');
    await userEvent.type(screen.getByLabelText('Durée en minutes'), '30');
    await userEvent.type(screen.getByLabelText('Distance en kilomètres'), '5');
    await userEvent.type(screen.getByLabelText('Calories brûlées'), '300');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    await waitFor(async () =>
      expect((await loadFromDb())?.workouts).toEqual([expect.objectContaining({ date: '2025-01-10', activity: 'Course', duration: 30, kcal: 300, distanceKm: 5 })]),
    );
    expect(screen.getByLabelText('Activité')).toHaveValue('');
  });

  it('estime les calories quand elles sont laissées vides', async () => {
    await renderWithStore(<CardioForm date="2025-01-10" />, { data: makeData({ weights: [{ id: 'w', date: '2025-01-01', weight: 80 }] }) });
    await userEvent.type(await screen.findByLabelText('Activité'), 'Course à pied');
    await userEvent.type(screen.getByLabelText('Durée en minutes'), '60');
    expect(screen.getByLabelText('Calories brûlées').getAttribute('placeholder')).toMatch(/^~\d+$/);
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    await waitFor(async () => expect((await loadFromDb())?.workouts[0].kcal).toBeGreaterThan(0));
  });

  it('propose les activités déjà utilisées', async () => {
    const workouts = [{ id: 'x', date: '2025-01-01', activity: 'Escalade perso', duration: 60, kcal: 400 }];
    const { container } = await renderWithStore(<CardioForm date="2025-01-10" />, { data: makeData({ workouts }) });
    await screen.findByLabelText('Activité');
    expect(container.querySelector('option[value="Escalade perso"]')).toBeInTheDocument();
  });
});
