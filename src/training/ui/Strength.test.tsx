import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { loadFromDb } from '../../infrastructure/db';
import { todayISO } from '../../shared/kernel/dates';
import { makeData, makeSessions, renderWithStore } from '../../test/render';
import Strength from './Strength';

const today = todayISO();

const csvDate = '13 Oct 2026, 18:30';
const CSV = [
  'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe',
  `Push,"${csvDate}","13 Oct 2026, 19:30",,Bench Press (Barbell),,,0,normal,80,5,,,8`,
  `Push,"${csvDate}","13 Oct 2026, 19:30",,Bench Press (Barbell),,,1,normal,80,4,,,9`,
].join('\n');

const fileWith = (content: string, name = 'workouts.csv') => {
  const file = new File([content], name, { type: 'text/csv' });
  Object.defineProperty(file, 'text', { value: async () => content });
  return file;
};

const shared = {
  name: 'Jambes',
  start_time: Date.UTC(2026, 9, 12, 17, 0) / 1000,
  end_time: Date.UTC(2026, 9, 12, 18, 0) / 1000,
  exercises: [{ title: 'Squat (Barbell)', sets: [{ weight_kg: 100, reps: 5, indicator: 'normal' }] }],
};

const withSessions = () => makeData({ strength: makeSessions() });

describe('Strength — sans séance', () => {
  it('invite à importer et propose l’ajout par lien', async () => {
    await renderWithStore(<Strength />);
    expect(await screen.findByText('Importer vos séances Hevy')).toBeInTheDocument();
    expect(screen.getByText('Ajouter une séance Hevy')).toBeInTheDocument();
  });

  it('importe un export CSV', async () => {
    await renderWithStore(<Strength />);
    await screen.findByText('Importer vos séances Hevy');
    fireEvent.change(document.querySelector('input[type=file]')!, { target: { files: [fileWith(CSV)] } });
    expect(await screen.findByText(/1 nouvelle séance importée/)).toBeInTheDocument();
    await waitFor(async () => expect((await loadFromDb())?.strength).toHaveLength(1));
  });

  it('signale un CSV invalide', async () => {
    await renderWithStore(<Strength />);
    await screen.findByText('Importer vos séances Hevy');
    fireEvent.change(document.querySelector('input[type=file]')!, { target: { files: [fileWith('a,b\n1,2')] } });
    expect(await screen.findByText(/ne ressemble pas à un export Hevy/)).toBeInTheDocument();
  });

  it('ouvre le sélecteur de fichier depuis le bouton', async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    await renderWithStore(<Strength />);
    await userEvent.click(await screen.findByRole('button', { name: 'Importer le CSV Hevy' }));
    expect(click).toHaveBeenCalled();
  });

  it('synchronise une séance depuis son lien de partage', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(shared)));
    await renderWithStore(<Strength />);
    const button = await screen.findByRole('button', { name: 'Synchroniser la séance' });
    expect(button).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Liens de séances Hevy'), 'https://hevy.com/workout/abcdefgh');
    await userEvent.click(button);
    // La page bascule sur la vue complète dès la première séance : le message du formulaire disparaît avec lui.
    expect(await screen.findByRole('tab', { name: 'Aperçu' })).toBeInTheDocument();
    await waitFor(async () => expect((await loadFromDb())?.strength).toHaveLength(1));
  });

  it('affiche les erreurs de synchronisation', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }));
    await renderWithStore(<Strength />);
    await userEvent.type(await screen.findByLabelText('Liens de séances Hevy'), 'workout/abcdefgh workout/ijklmnop');
    await userEvent.click(screen.getByRole('button', { name: 'Synchroniser 2 séances' }));
    expect(await screen.findAllByText(/introuvable/)).toHaveLength(2);
  });
});

describe('Strength — avec séances', () => {
  it('affiche l’aperçu et change de période', async () => {
    await renderWithStore(<Strength />, { data: withSessions() });
    expect(await screen.findByRole('heading', { name: 'Musculation' })).toBeInTheDocument();
    expect(screen.getByText('Séries de travail')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '4 semaines' }));
    expect(screen.getByRole('button', { name: '4 semaines' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: '6 mois' }));
    await userEvent.click(screen.getByRole('button', { name: 'Total' }));
    await userEvent.click(screen.getByRole('button', { name: 'Par muscle' }));
  });

  it('parcourt tous les onglets et mémorise le dernier', async () => {
    const { unmount } = await renderWithStore(<Strength />, { data: withSessions() });
    for (const tab of ['Progression', 'Muscles', 'Séances', 'Import & cardio', 'Aperçu']) {
      await userEvent.click(await screen.findByRole('tab', { name: tab }));
      expect(screen.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true');
    }
    await userEvent.click(screen.getByRole('tab', { name: 'Muscles' }));
    expect(screen.getByText('Carte musculaire')).toBeInTheDocument();
    expect(screen.getByText('Plages de répétitions')).toBeInTheDocument();
    unmount();
    await renderWithStore(<Strength />, { data: withSessions() });
    expect(await screen.findByRole('tab', { name: 'Muscles' })).toHaveAttribute('aria-selected', 'true');
  });

  it('montre la progression d’un exercice et les records', async () => {
    await renderWithStore(<Strength />, { data: withSessions() });
    await userEvent.click(await screen.findByRole('tab', { name: 'Progression' }));
    expect(screen.getByText('Records personnels')).toBeInTheDocument();
    expect(screen.getByText('1RM estimé actuel')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getAllByLabelText('Exercice')[0], 'Squat (Barbell)');
    expect(screen.getAllByLabelText('Exercice')[0]).toHaveValue('Squat (Barbell)');
    await userEvent.click(screen.getAllByRole('row', { name: 'Voir la progression de Bench Press (Barbell)' })[0]);
    fireEvent.keyDown(screen.getAllByRole('row', { name: 'Voir la progression de Squat (Barbell)' })[0], { key: 'Enter' });
  });

  it('gère un exercice au poids du corps et une seule séance', async () => {
    const pullUps = { id: 'p', date: today, title: 'Dos', exercises: [{ name: 'Pull Up', sets: [{ type: 'normal' as const, weight: 0, reps: 10 }] }] };
    await renderWithStore(<Strength />, { data: makeData({ strength: [pullUps] }) });
    await userEvent.click(await screen.findByRole('tab', { name: 'Progression' }));
    expect(screen.getByText(/Au moins deux séances/)).toBeInTheDocument();
    expect(screen.getAllByText('PDC').length).toBeGreaterThan(0);
  });

  it('ajoute et retire une sortie de cardio', async () => {
    await renderWithStore(<Strength />, { data: withSessions() });
    await userEvent.click(await screen.findByRole('tab', { name: 'Import & cardio' }));
    await userEvent.type(screen.getByLabelText('Activité'), 'Marche');
    await userEvent.type(screen.getByLabelText('Durée en minutes'), '40');
    await userEvent.type(screen.getByLabelText('Distance en kilomètres'), '3');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    await userEvent.click(await screen.findByLabelText('Retirer Marche'));
    await waitFor(async () => expect((await loadFromDb())?.workouts).toEqual([]));
  });
});
