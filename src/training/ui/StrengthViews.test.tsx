import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { addDays, todayISO } from '../../shared/kernel/dates';
import { renderWithStore } from '../../test/render';
import type { StrengthSession } from '../domain/session';
import { MuscleHeatmap, MuscleMap, SessionsPanel, WeekBanner } from './StrengthViews';

const today = todayISO();

const session = (daysAgo: number, title = 'Push', weight = 60): StrengthSession => ({
  id: `v-${daysAgo}-${title}`,
  date: addDays(today, -daysAgo),
  title,
  minutes: 65,
  exercises: [
    { name: 'Bench Press (Barbell)', sets: [{ type: 'warmup', weight: 20, reps: 10 }, { type: 'normal', weight, reps: 8, rpe: 8 }, { type: 'normal', weight, reps: 6 }] },
    { name: 'Squat (Barbell)', sets: [{ type: 'normal', weight: weight + 20, reps: 5 }] },
    { name: 'Pull Up', sets: [{ type: 'normal', weight: 0, reps: 8 }] },
    { name: 'Plank', sets: [{ type: 'normal', weight: 0, reps: 0, seconds: 60 }] },
  ],
});

/** Une séance tous les 2 jours pendant ~10 semaines. */
const many = (): StrengthSession[] => Array.from({ length: 30 }, (_, i) => session(i * 2, i % 2 ? 'Pull' : 'Push', 50 + (30 - i)));

describe('WeekBanner', () => {
  it('résume la semaine en cours avec habitude et record', async () => {
    await renderWithStore(<WeekBanner sessions={many()} today={today} />);
    expect(await screen.findByRole('heading', { name: 'Cette semaine' })).toBeInTheDocument();
    expect(screen.getByText(/habituel/)).toBeInTheDocument();
  });

  it('gère une seule séance, sans semaine de référence', async () => {
    await renderWithStore(<WeekBanner sessions={[session(0)]} today={today} />);
    expect(await screen.findByText('Pas de semaine précédente')).toBeInTheDocument();
  });
});

describe('MuscleHeatmap', () => {
  it('affiche les séries par muscle et par semaine', async () => {
    await renderWithStore(<MuscleHeatmap sessions={many()} today={today} />);
    expect(await screen.findByText('Séries par muscle et par semaine')).toBeInTheDocument();
    expect(screen.getByText('Pectoraux')).toBeInTheDocument();
  });
});

describe('MuscleMap', () => {
  it('affiche la carte musculaire pour la période', async () => {
    await renderWithStore(<MuscleMap period={many()} weeks={8} />);
    expect(await screen.findByText('Carte musculaire')).toBeInTheDocument();
    expect(screen.getAllByRole('img').length).toBeGreaterThan(0);
  });

  it('gère une période vide', async () => {
    await renderWithStore(<MuscleMap period={[]} weeks={4} />);
    expect(await screen.findByText('Carte musculaire')).toBeInTheDocument();
  });
});

describe('SessionsPanel', () => {
  it('liste les séances, pagine et filtre par muscle', async () => {
    const workouts = [{ id: 'c', date: today, activity: 'Vélo', duration: 30, kcal: 250 }];
    await renderWithStore(<SessionsPanel sessions={many()} workouts={workouts} today={today} />);
    expect(await screen.findByRole('heading', { name: 'Séances' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Voir \d+ séances de plus/ }));
    const filters = within(screen.getByRole('group', { name: 'Filtrer par muscle' })).getAllByRole('button');
    await userEvent.click(filters[1]);
    expect(filters[1]).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(filters[0]);
  });

  it('sélectionne un jour du calendrier puis affiche tout', async () => {
    await renderWithStore(<SessionsPanel sessions={many()} workouts={[]} today={today} />);
    const day = (await screen.findAllByRole('button', { pressed: false })).find((b) => /^.+ : .+/.test(b.getAttribute('aria-label') ?? ''))!;
    await userEvent.click(day);
    expect(day).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: /tout afficher/ }));
  });

  it('navigue entre les mois', async () => {
    await renderWithStore(<SessionsPanel sessions={many()} workouts={[]} today={today} />);
    const next = await screen.findByLabelText('Mois suivant');
    expect(next).toBeDisabled();
    await userEvent.click(screen.getByLabelText('Mois précédent'));
    expect(next).toBeEnabled();
    await userEvent.click(next);
    expect(next).toBeDisabled();
  });

  it('fonctionne sans séance', async () => {
    await renderWithStore(<SessionsPanel sessions={[]} workouts={[]} today={today} />);
    expect(await screen.findByRole('heading', { name: 'Séances' })).toBeInTheDocument();
  });
});
