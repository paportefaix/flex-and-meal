import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { loadFromDb } from '../../infrastructure/db';
import { makeData, renderWithStore } from '../../test/render';
import Settings from './Settings';

const savedSettings = async () => (await loadFromDb())?.settings;

describe('Settings', () => {
  it('enregistre automatiquement les objectifs modifiés', async () => {
    await renderWithStore(<Settings />);
    const goal = await screen.findByLabelText(/Objectif calorique/);
    await userEvent.clear(goal);
    await userEvent.type(goal, '2300');
    await userEvent.type(screen.getByLabelText(/Poids cible/), '70');
    await waitFor(async () => expect(await savedSettings()).toEqual(expect.objectContaining({ kcalGoal: 2300, targetWeight: 70 })), { timeout: 3000 });
    expect(await screen.findByText('Enregistré ✓')).toBeInTheDocument();
  });

  it('n’enregistre pas un objectif calorique invalide', async () => {
    await renderWithStore(<Settings />);
    const goal = await screen.findByLabelText(/Objectif calorique/);
    await userEvent.clear(goal);
    await new Promise((r) => setTimeout(r, 800));
    expect((await savedSettings())?.kcalGoal).toBe(2000);
  });

  it('propose des objectifs de macros à partir du dernier poids', async () => {
    const data = makeData({ weights: [{ id: 'w', date: '2025-01-01', weight: 70 }] });
    await renderWithStore(<Settings />, { data });
    await userEvent.click(await screen.findByRole('button', { name: 'Proposer des valeurs' }));
    expect(screen.getByLabelText(/Protéines/)).toHaveValue('126');
  });

  it('désactive la proposition sans pesée', async () => {
    await renderWithStore(<Settings />);
    expect(await screen.findByRole('button', { name: 'Proposer des valeurs' })).toBeDisabled();
  });

  it('indique que la sauvegarde dans un dossier n’est pas disponible', async () => {
    await renderWithStore(<Settings />);
    expect(await screen.findByText(/n'est pas disponible sur ce navigateur/)).toBeInTheDocument();
  });

  it('exporte les données en JSON', async () => {
    const createObjectURL = vi.fn(() => 'blob:x');
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await renderWithStore(<Settings />);
    await userEvent.click(await screen.findByRole('button', { name: 'Exporter (JSON)' }));
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(localStorage.getItem('flex-and-meal:lastExport')).not.toBeNull();
  });

  it('importe un fichier après confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await renderWithStore(<Settings />);
    const file = new File([JSON.stringify({ version: 1, settings: { kcalGoal: 1700 } })], 'data.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: async () => JSON.stringify({ version: 1, settings: { kcalGoal: 1700 } }) });
    await screen.findByText('Importer…');
    fireEvent.change(document.querySelector('input[type=file]')!, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByLabelText(/Objectif calorique/)).toBeInTheDocument());
    await waitFor(async () => expect((await savedSettings())?.kcalGoal).toBe(1700));
  });

  it('refuse un fichier invalide', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    await renderWithStore(<Settings />);
    const file = new File(['pas du json'], 'data.json');
    Object.defineProperty(file, 'text', { value: async () => 'pas du json' });
    await screen.findByText('Importer…');
    fireEvent.change(document.querySelector('input[type=file]')!, { target: { files: [file] } });
    await waitFor(() => expect(alert).toHaveBeenCalledWith(expect.stringContaining('Import impossible')));
  });

  it('efface toutes les données après deux confirmations', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await renderWithStore(<Settings />, { data: makeData({ settings: { kcalGoal: 1800 } }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Tout effacer' }));
    expect(confirm).toHaveBeenCalledTimes(2);
    await waitFor(async () => expect((await savedSettings())?.kcalGoal).toBe(2000));
  });

  it('ne fait rien si l’effacement est refusé', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await renderWithStore(<Settings />, { data: makeData({ settings: { kcalGoal: 1800 } }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Tout effacer' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect((await savedSettings())?.kcalGoal).toBe(1800);
  });
});
