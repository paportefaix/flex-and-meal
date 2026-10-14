import { screen, waitFor } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { loadFromDb } from '../../../../app/infrastructure/db';
import { addDays, todayISO } from '../../../../app/shared/kernel/dates';
import { makeData, renderWithStore } from '../../../render';
import { Body } from '../../../../app/body/ui/body';

const today = todayISO();
const weights = [
  { id: 'w1', date: addDays(today, -20), weight: 80 },
  { id: 'w2', date: addDays(today, -10), weight: 78 },
];

describe('Body', () => {
  it('affiche le titre, le schéma et les formulaires vides', async () => {
    await renderWithStore(Body);
    expect(await screen.findByRole('heading', { name: 'Poids & mensurations' })).toBeInTheDocument();
    expect(screen.getByText('Où prendre les mesures ?')).toBeInTheDocument();
    expect(screen.queryByText(/Historique/)).not.toBeInTheDocument();
  });

  it('enregistre une pesée en quittant le champ', async () => {
    await renderWithStore(Body);
    await userEvent.type(await screen.findByPlaceholderText('kg'), '75,5');
    await userEvent.tab();
    await waitFor(async () => expect((await loadFromDb())?.weights).toEqual([expect.objectContaining({ date: today, weight: 75.5 })]));
  });

  it('remplace la pesée du jour au lieu d’en ajouter une seconde', async () => {
    await renderWithStore(Body, { data: makeData({ weights: [{ id: 'w', date: today, weight: 70 }] }) });
    const input = await screen.findByPlaceholderText('kg');
    await waitFor(() => expect(input).toHaveValue('70'));
    await userEvent.clear(input);
    await userEvent.type(input, '71');
    await userEvent.tab();
    await waitFor(async () => expect((await loadFromDb())?.weights.map((w) => w.weight)).toEqual([71]));
  });

  it('résume l’évolution, l’IMC et le poids restant à perdre', async () => {
    const settings = { kcalGoal: 2000, heightCm: 180, targetWeight: 75 };
    await renderWithStore(Body, { data: makeData({ weights, settings }) });
    expect(await screen.findByText('Actuel')).toBeInTheDocument();
    expect(screen.getByText('Reste à perdre')).toBeInTheDocument();
    expect(screen.getByText('IMC')).toBeInTheDocument();
    expect(screen.getByText('Historique (2)')).toBeInTheDocument();
  });

  it('supprime une pesée de l’historique', async () => {
    await renderWithStore(Body, { data: makeData({ weights }) });
    await userEvent.click((await screen.findAllByLabelText('Supprimer'))[0]);
    await waitFor(async () => expect((await loadFromDb())?.weights).toHaveLength(1));
  });

  it('enregistre une mensuration et la met en avant sur le schéma', async () => {
    const { fixture } = await renderWithStore(Body);
    const waist = await screen.findByLabelText('Taille');
    await userEvent.click(waist);
    await waitFor(() => expect(fixture.nativeElement.querySelector('li.on')).toHaveTextContent('Taille'));
    await userEvent.type(waist, '85');
    await userEvent.tab();
    await waitFor(async () => expect((await loadFromDb())?.measurements).toEqual([expect.objectContaining({ date: today, values: { waist: 85 } })]));
  });

  it('complète le relevé du jour, résume et supprime les relevés', async () => {
    const measurements = [
      { id: 'm1', date: addDays(today, -30), values: { waist: 90 } },
      { id: 'm2', date: today, values: { waist: 87 } },
    ];
    await renderWithStore(Body, { data: makeData({ measurements }) });
    expect(await screen.findByText('cm (-3)')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Taille' }));
    expect(screen.getByText('Historique (2)')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Fesses'), '100');
    await userEvent.tab();
    await waitFor(async () => expect((await loadFromDb())?.measurements.find((m) => m.id === 'm2')?.values).toEqual({ waist: 87, glutes: 100 }));
    await userEvent.click(screen.getAllByLabelText('Supprimer')[0]);
    await waitFor(async () => expect((await loadFromDb())?.measurements).toHaveLength(1));
  });

  it('demande deux relevés pour tracer la courbe d’une mensuration', async () => {
    const measurements = [{ id: 'm1', date: today, values: { waist: 90 } }];
    await renderWithStore(Body, { data: makeData({ measurements }) });
    expect(await screen.findByText(/au moins deux relevés/)).toBeInTheDocument();
  });
});
