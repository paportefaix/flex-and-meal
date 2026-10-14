import { screen, waitFor, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { loadFromDb } from '../../../../app/infrastructure/db';
import { addDays, todayISO } from '../../../../app/shared/kernel/dates';
import { CardioForm } from '../../../../app/training/ui/cardio-form';
import { BodyDiagram } from '../../../../app/body/ui/body-diagram';
import { makeData, makeSession, renderWithStore } from '../../../render';
import { Journal } from '../../../../app/ui/pages/journal';

const today = todayISO();
const riz = { id: 'riz', name: 'Riz test', unit: 'g' as const, kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 };
const logged = { id: 'l1', date: today, meal: 'lunch' as const, foodId: 'riz', name: 'Riz test', quantity: 200, unit: 'g' as const, kcal: 260, protein: 5, carbs: 56, fat: 1 };

const section = (title: string) => screen.getByRole('heading', { name: title }).closest('mat-card') as HTMLElement;

describe('Journal', () => {
  it('affiche les quatre repas et la section sport', async () => {
    await renderWithStore(Journal);
    for (const t of ['Petit-déjeuner', 'Déjeuner', 'Collation', 'Dîner', 'Sport']) expect(await screen.findByRole('heading', { name: t })).toBeInTheDocument();
  });

  it('ajoute un aliment à un repas', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('[]'));
    await renderWithStore(Journal, { data: makeData({ foods: [riz] }) });
    await screen.findByRole('heading', { name: 'Déjeuner' });
    const lunch = within(section('Déjeuner'));
    await userEvent.type(lunch.getByPlaceholderText('Rechercher un aliment…'), 'Riz test');
    await userEvent.type(lunch.getByPlaceholderText('g'), '200');
    await userEvent.click(lunch.getByRole('button', { name: 'Ajouter' }));
    await waitFor(async () => expect((await loadFromDb())?.log).toEqual([expect.objectContaining({ meal: 'lunch', date: today, name: 'Riz test', quantity: 200, kcal: 260 })]));
    expect(await lunch.findByText('260 kcal', { selector: '.num' })).toBeInTheDocument();
  });

  it('retire un aliment', async () => {
    await renderWithStore(Journal, { data: makeData({ foods: [riz], log: [logged] }) });
    await userEvent.click(await screen.findByLabelText('Retirer Riz test'));
    await waitFor(async () => expect((await loadFromDb())?.log).toEqual([]));
  });

  it('ajoute une saisie libre puis annule une seconde', async () => {
    await renderWithStore(Journal);
    await screen.findByRole('heading', { name: 'Dîner' });
    const dinner = within(section('Dîner'));
    await userEvent.click(dinner.getByRole('button', { name: '+ Saisie libre' }));
    await userEvent.type(await dinner.findByPlaceholderText('Plat'), 'Restaurant');
    await userEvent.type(dinner.getByPlaceholderText('kcal'), '800');
    await userEvent.click(dinner.getByRole('button', { name: 'OK' }));
    await waitFor(async () => expect((await loadFromDb())?.log).toEqual([expect.objectContaining({ meal: 'dinner', name: 'Restaurant', kcal: 800 })]));
    await userEvent.click(await dinner.findByRole('button', { name: '+ Saisie libre' }));
    await userEvent.click(await dinner.findByRole('button', { name: 'Annuler' }));
    expect(await dinner.findByRole('button', { name: '+ Saisie libre' })).toBeInTheDocument();
  });

  it('ajoute un repas type', async () => {
    const templates = [{ id: 't', name: 'Mon riz', items: [{ foodId: 'riz', quantity: 100 }, { foodId: 'inconnu', quantity: 1 }] }];
    await renderWithStore(Journal, { data: makeData({ foods: [riz], templates }) });
    await screen.findByRole('heading', { name: 'Petit-déjeuner' });
    await userEvent.selectOptions(within(section('Petit-déjeuner')).getByRole('combobox'), 'Mon riz');
    await waitFor(async () => expect((await loadFromDb())?.log).toEqual([expect.objectContaining({ meal: 'breakfast', name: 'Riz test', quantity: 100 })]));
  });

  it('enregistre un repas comme repas type', async () => {
    await renderWithStore(Journal, { data: makeData({ foods: [riz], log: [logged] }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer comme repas type' }));
    const nameInput = await screen.findByLabelText('Nom du repas type :');
    await userEvent.type(nameInput, '  Déj habituel ');
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(async () => expect((await loadFromDb())?.templates).toEqual([expect.objectContaining({ name: 'Déj habituel', items: [{ foodId: 'riz', quantity: 200 }] })]));
  });

  it('n’enregistre pas de repas type sans nom', async () => {
    await renderWithStore(Journal, { data: makeData({ foods: [riz], log: [logged] }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer comme repas type' }));
    await userEvent.click(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'OK' })).not.toBeInTheDocument());
    expect((await loadFromDb())?.templates).toEqual([]);
  });

  it('navigue entre les jours', async () => {
    const { settle } = await renderWithStore(Journal, { route: `/journal?d=${addDays(today, -3)}` });
    await userEvent.click(await screen.findByLabelText('Jour suivant'));
    await settle();
    await userEvent.click(screen.getByLabelText('Jour précédent'));
    await settle();
    await userEvent.click(await screen.findByRole('button', { name: "Aujourd'hui" }));
    await waitFor(() => expect(screen.queryByRole('button', { name: "Aujourd'hui" })).not.toBeInTheDocument());
  });

  it('affiche les séances de muscu et de cardio du jour, et supprime le cardio', async () => {
    const data = makeData({
      strength: [makeSession(0)],
      workouts: [{ id: 'w', date: today, activity: 'Vélo', duration: 45, kcal: 300, distanceKm: 20 }],
    });
    await renderWithStore(Journal, { data });
    expect(await screen.findByText(/Muscu · Push/)).toBeInTheDocument();
    expect(screen.getByText(/20 km/)).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Retirer Vélo'));
    await waitFor(async () => expect((await loadFromDb())?.workouts).toEqual([]));
  });
});

describe('CardioForm', () => {
  it('n’enregistre rien sans activité ni durée', async () => {
    await renderWithStore(CardioForm, { inputs: { date: '2025-01-10' } });
    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter' }));
    expect((await loadFromDb())?.workouts).toEqual([]);
  });

  it('enregistre une séance avec les calories saisies et la distance', async () => {
    await renderWithStore(CardioForm, { inputs: { date: '2025-01-10' } });
    await userEvent.type(await screen.findByLabelText('Activité'), 'Course');
    await userEvent.type(screen.getByLabelText('Durée en minutes'), '30');
    await userEvent.type(screen.getByLabelText('Distance en kilomètres'), '5');
    await userEvent.type(screen.getByLabelText('Calories brûlées'), '300');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    await waitFor(async () =>
      expect((await loadFromDb())?.workouts).toEqual([expect.objectContaining({ date: '2025-01-10', activity: 'Course', duration: 30, kcal: 300, distanceKm: 5 })]),
    );
    await waitFor(() => expect(screen.getByLabelText('Activité')).toHaveValue(''));
  });

  it('estime les calories quand elles sont laissées vides', async () => {
    await renderWithStore(CardioForm, { inputs: { date: '2025-01-10' }, data: makeData({ weights: [{ id: 'w', date: '2025-01-01', weight: 80 }] }) });
    await userEvent.type(await screen.findByLabelText('Activité'), 'Course à pied');
    await userEvent.type(screen.getByLabelText('Durée en minutes'), '60');
    await waitFor(() => expect(screen.getByLabelText('Calories brûlées').getAttribute('placeholder')).toMatch(/^~\d+$/));
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    await waitFor(async () => expect((await loadFromDb())?.workouts[0].kcal).toBeGreaterThan(0));
  });

  it('propose les activités déjà utilisées', async () => {
    const workouts = [{ id: 'x', date: '2025-01-01', activity: 'Escalade perso', duration: 60, kcal: 400 }];
    const { component } = await renderWithStore(CardioForm, { inputs: { date: '2025-01-10' }, data: makeData({ workouts }) });
    await screen.findByLabelText('Activité');
    expect((component as unknown as { activities(): string[] }).activities()).toContain('Escalade perso');
  });
});

describe('BodyDiagram', () => {
  it('liste les six mensurations avec leur explication', async () => {
    await renderWithStore(BodyDiagram, { inputs: {} });
    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
    expect(screen.getByText('Taille')).toBeInTheDocument();
  });

  it('met en avant la mesure active', async () => {
    const { fixture } = await renderWithStore(BodyDiagram, { inputs: { active: 'waist' } });
    const on = fixture.nativeElement.querySelectorAll('li.on');
    expect(on).toHaveLength(1);
    expect(on[0]).toHaveTextContent('Taille');
  });
});
