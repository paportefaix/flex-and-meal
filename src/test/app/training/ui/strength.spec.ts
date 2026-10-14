import { TestBed } from '@angular/core/testing';
import { fireEvent, screen, waitFor, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { loadFromDb } from '../../../../app/infrastructure/db';
import { addDays, todayISO } from '../../../../app/shared/kernel/dates';
import { makeData, makeSessions, renderWithStore } from '../../../render';
import type { StrengthSession } from '../../../../app/training/domain/session';
import { Strength } from '../../../../app/training/ui/strength';
import { ConsistencyCard, CrossCard, MuscleLoadCard, TrendsCard } from '../../../../app/training/ui/strength-analysis';
import { MuscleHeatmap, MuscleMap, SessionsPanel, WeekBanner } from '../../../../app/training/ui/strength-views';

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
    await renderWithStore(Strength);
    expect(await screen.findByText('Importer vos séances Hevy')).toBeInTheDocument();
    expect(screen.getByText('Ajouter une séance Hevy')).toBeInTheDocument();
  });

  it('importe un export CSV', async () => {
    await renderWithStore(Strength);
    await screen.findByText('Importer vos séances Hevy');
    fireEvent.change(document.querySelector('input[type=file]')!, { target: { files: [fileWith(CSV)] } });
    expect(await screen.findByText(/1 nouvelle séance importée/)).toBeInTheDocument();
    await waitFor(async () => expect((await loadFromDb())?.strength).toHaveLength(1));
  });

  it('signale un CSV invalide', async () => {
    await renderWithStore(Strength);
    await screen.findByText('Importer vos séances Hevy');
    fireEvent.change(document.querySelector('input[type=file]')!, { target: { files: [fileWith('a,b\n1,2')] } });
    expect(await screen.findByText(/ne ressemble pas à un export Hevy/)).toBeInTheDocument();
  });

  it('ouvre le sélecteur de fichier depuis le bouton', async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    await renderWithStore(Strength);
    await userEvent.click(await screen.findByRole('button', { name: 'Importer le CSV Hevy' }));
    expect(click).toHaveBeenCalled();
  });

  it('synchronise une séance depuis son lien de partage', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(shared)));
    await renderWithStore(Strength);
    const button = await screen.findByRole('button', { name: 'Synchroniser la séance' });
    expect(button).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Liens de séances Hevy'), 'https://hevy.com/workout/abcdefgh');
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);
    // La page bascule sur la vue complète dès la première séance : le message du formulaire disparaît avec lui.
    expect(await screen.findByRole('tab', { name: 'Aperçu' })).toBeInTheDocument();
    await waitFor(async () => expect((await loadFromDb())?.strength).toHaveLength(1));
  });

  it('affiche les erreurs de synchronisation', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }));
    await renderWithStore(Strength);
    await userEvent.type(await screen.findByLabelText('Liens de séances Hevy'), 'workout/abcdefgh workout/ijklmnop');
    await userEvent.click(await screen.findByRole('button', { name: 'Synchroniser 2 séances' }));
    expect(await screen.findAllByText(/introuvable/)).toHaveLength(2);
  });
});

describe('Strength — avec séances', () => {
  it('affiche l’aperçu et change de période', async () => {
    await renderWithStore(Strength, { data: withSessions() });
    expect(await screen.findByRole('heading', { name: 'Musculation' })).toBeInTheDocument();
    expect(await screen.findByText('Séries de travail')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: '4 semaines' }));
    await waitFor(() => expect(screen.getByRole('radio', { name: '4 semaines' })).toHaveAttribute('aria-checked', 'true'));
    await userEvent.click(screen.getByRole('radio', { name: '6 mois' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Total' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Par muscle' }));
  });

  it('parcourt tous les onglets et mémorise le dernier', async () => {
    const { fixture } = await renderWithStore(Strength, { data: withSessions() });
    for (const tab of ['Progression', 'Muscles', 'Séances', 'Import & cardio', 'Aperçu']) {
      await userEvent.click(await screen.findByRole('tab', { name: tab }));
      await waitFor(() => expect(screen.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true'));
    }
    await userEvent.click(screen.getByRole('tab', { name: 'Muscles' }));
    expect(await screen.findByText('Carte musculaire')).toBeInTheDocument();
    expect(screen.getByText('Plages de répétitions')).toBeInTheDocument();
    fixture.destroy();
    TestBed.resetTestingModule();
    await renderWithStore(Strength, { data: withSessions() });
    expect(await screen.findByRole('tab', { name: 'Muscles' })).toHaveAttribute('aria-selected', 'true');
  });

  it('montre la progression d’un exercice et les records', async () => {
    await renderWithStore(Strength, { data: withSessions() });
    await userEvent.click(await screen.findByRole('tab', { name: 'Progression' }));
    expect(await screen.findByText('Records personnels')).toBeInTheDocument();
    expect(screen.getByText('1RM estimé actuel')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getAllByLabelText('Exercice')[0], 'Squat (Barbell)');
    await waitFor(() => expect(screen.getAllByLabelText('Exercice')[0]).toHaveValue('Squat (Barbell)'));
    await userEvent.click(screen.getAllByRole('row', { name: 'Voir la progression de Bench Press (Barbell)' })[0]);
    fireEvent.keyDown(screen.getAllByRole('row', { name: 'Voir la progression de Squat (Barbell)' })[0], { key: 'Enter' });
  });

  it('gère un exercice au poids du corps et une seule séance', async () => {
    const pullUps = { id: 'p', date: today, title: 'Dos', exercises: [{ name: 'Pull Up', sets: [{ type: 'normal' as const, weight: 0, reps: 10 }] }] };
    await renderWithStore(Strength, { data: makeData({ strength: [pullUps] }) });
    await userEvent.click(await screen.findByRole('tab', { name: 'Progression' }));
    expect(await screen.findByText(/Au moins deux séances/)).toBeInTheDocument();
    expect(screen.getAllByText('PDC').length).toBeGreaterThan(0);
  });

  it('ajoute et retire une sortie de cardio', async () => {
    await renderWithStore(Strength, { data: withSessions() });
    await userEvent.click(await screen.findByRole('tab', { name: 'Import & cardio' }));
    await userEvent.type(await screen.findByLabelText('Activité'), 'Marche');
    await userEvent.type(screen.getByLabelText('Durée en minutes'), '40');
    await userEvent.type(screen.getByLabelText('Distance en kilomètres'), '3');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    await userEvent.click(await screen.findByLabelText('Retirer Marche'));
    await waitFor(async () => expect((await loadFromDb())?.workouts).toEqual([]));
  });
});

// --- Cartes d'analyse ---

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
    const { component, fixture } = await renderWithStore(TrendsCard, { inputs: { sessions: manyExercises(), today, selected: 'Squat', selectable: true } });
    const picked = vi.fn();
    component.picked.subscribe(picked);
    expect(await screen.findByText('Tendance par exercice')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Voir les \d+ autres/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Réduire' }));
    await userEvent.click(screen.getByRole('radio', { name: 'À surveiller' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Tous' }));
    await userEvent.click((await screen.findAllByRole('row'))[1]);
    expect(picked).toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    expect(fixture.nativeElement.querySelector('svg')).not.toBeNull();
  });

  it('indique l’absence de plateau dans « À surveiller »', async () => {
    await renderWithStore(TrendsCard, { inputs: { sessions: makeSessions(), today } });
    await userEvent.click(await screen.findByRole('radio', { name: 'À surveiller' }));
    expect(await screen.findByText(/Aucun plateau ni baisse|Aucun exercice/)).toBeInTheDocument();
  });
});

describe('MuscleLoadCard', () => {
  it('bascule entre séries et tonnage', async () => {
    const sessions = makeSessions();
    await renderWithStore(MuscleLoadCard, { inputs: { all: sessions, period: sessions, today, weeks: 8 } });
    expect(await screen.findByText('Charge par muscle')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Tonnage' }));
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Tonnage' })).toHaveAttribute('aria-checked', 'true'));
    await userEvent.click(screen.getByRole('radio', { name: 'Séries' }));
    expect(screen.getByText('Séries dures par semaine')).toBeInTheDocument();
  });
});

describe('ConsistencyCard', () => {
  it('affiche la régularité, le calendrier et la densité', async () => {
    await renderWithStore(ConsistencyCard, { inputs: { sessions: makeSessions(), today } });
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
    await renderWithStore(CrossCard, { inputs: { data, today }, data });
    expect(await screen.findByText('Croisements')).toBeInTheDocument();
    for (const name of ['Nutrition', 'Tour de taille', 'Poids de corps']) await userEvent.click(screen.getByRole('radio', { name }));
    await userEvent.click(screen.getByRole('radio', { name: 'Nutrition' }));
    await userEvent.click(await screen.findByRole('radio', { name: 'Calories' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Protéines' }));
    const periods = within(screen.getByRole('radiogroup', { name: 'Période du croisement' })).getAllByRole('radio');
    for (const p of periods) await userEvent.click(p);
    await userEvent.click(screen.getByRole('radio', { name: 'Poids de corps' }));
    await userEvent.selectOptions(await screen.findByLabelText('Exercice'), 'Squat (Barbell)');
    await waitFor(() => expect(screen.getByLabelText('Exercice')).toHaveValue('Squat (Barbell)'));
  });

  it('fonctionne sans aucune donnée', async () => {
    const data = makeData();
    await renderWithStore(CrossCard, { inputs: { data, today }, data });
    expect(await screen.findByText('Croisements')).toBeInTheDocument();
  });
});

// --- Vues ---

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
    await renderWithStore(WeekBanner, { inputs: { sessions: many(), today } });
    expect(await screen.findByRole('heading', { name: 'Cette semaine' })).toBeInTheDocument();
    expect(screen.getByText(/habituel/)).toBeInTheDocument();
  });

  it('gère une seule séance, sans semaine de référence', async () => {
    await renderWithStore(WeekBanner, { inputs: { sessions: [session(0)], today } });
    expect(await screen.findByText('Pas de semaine précédente')).toBeInTheDocument();
  });
});

describe('MuscleHeatmap', () => {
  it('affiche les séries par muscle et par semaine', async () => {
    await renderWithStore(MuscleHeatmap, { inputs: { sessions: many(), today } });
    expect(await screen.findByText('Séries par muscle et par semaine')).toBeInTheDocument();
    expect(screen.getByText('Pectoraux')).toBeInTheDocument();
  });
});

describe('MuscleMap', () => {
  it('affiche la carte musculaire pour la période', async () => {
    await renderWithStore(MuscleMap, { inputs: { period: many(), weeks: 8 } });
    expect(await screen.findByText('Carte musculaire')).toBeInTheDocument();
    expect(screen.getAllByRole('img').length).toBeGreaterThan(0);
  });

  it('gère une période vide', async () => {
    await renderWithStore(MuscleMap, { inputs: { period: [], weeks: 4 } });
    expect(await screen.findByText('Carte musculaire')).toBeInTheDocument();
  });
});

describe('SessionsPanel', () => {
  it('liste les séances, pagine et filtre par muscle', async () => {
    const workouts = [{ id: 'c', date: today, activity: 'Vélo', duration: 30, kcal: 250 }];
    await renderWithStore(SessionsPanel, { inputs: { sessions: many(), workouts, today } });
    expect(await screen.findByRole('heading', { name: 'Séances' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Voir \d+ séances de plus/ }));
    const filters = within(screen.getByRole('group', { name: 'Filtrer par muscle' })).getAllByRole('button');
    await userEvent.click(filters[1]);
    await waitFor(() => expect(within(screen.getByRole('group', { name: 'Filtrer par muscle' })).getAllByRole('button')[1]).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(within(screen.getByRole('group', { name: 'Filtrer par muscle' })).getAllByRole('button')[0]);
  });

  it('sélectionne un jour du calendrier puis affiche tout', async () => {
    await renderWithStore(SessionsPanel, { inputs: { sessions: many(), workouts: [], today } });
    const day = (await screen.findAllByRole('button', { pressed: false })).find((b) => /^.+ : .+/.test(b.getAttribute('aria-label') ?? ''))!;
    await userEvent.click(day);
    await waitFor(() => expect(day).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(screen.getByRole('button', { name: /tout afficher/ }));
  });

  it('navigue entre les mois', async () => {
    await renderWithStore(SessionsPanel, { inputs: { sessions: many(), workouts: [], today } });
    const next = await screen.findByLabelText('Mois suivant');
    expect(next).toBeDisabled();
    await userEvent.click(screen.getByLabelText('Mois précédent'));
    await waitFor(() => expect(next).toBeEnabled());
    await userEvent.click(next);
    await waitFor(() => expect(next).toBeDisabled());
  });

  it('fonctionne sans séance', async () => {
    await renderWithStore(SessionsPanel, { inputs: { sessions: [], workouts: [], today } });
    expect(await screen.findByRole('heading', { name: 'Séances' })).toBeInTheDocument();
  });
});
