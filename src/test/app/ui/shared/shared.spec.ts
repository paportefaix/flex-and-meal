import { screen } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';
import { renderWithStore } from '../../../render';
import { DateField } from '../../../../app/ui/shared/date-field';
import { DaySummary, Stat } from '../../../../app/ui/shared/day-summary';

const intake = { kcal: 1500, protein: 100, carbs: 150, fat: 50 };

describe('DateField', () => {
  it('affiche la date en jj/mm/aaaa', async () => {
    await renderWithStore(DateField, { inputs: { value: '2025-03-07' } });
    expect(screen.getByRole('textbox')).toHaveValue('07/03/2025');
  });

  it('affiche un gabarit quand la valeur est vide', async () => {
    await renderWithStore(DateField, { inputs: { value: '' } });
    expect(screen.getByPlaceholderText('jj/mm/aaaa')).toHaveValue('');
  });

  it('transmet la nouvelle date saisie', async () => {
    const { component, settle } = await renderWithStore(DateField, { inputs: { value: '2025-03-07' } });
    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.value = '01/04/2025';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('change'));
    await settle();
    expect(component.value()).toBe('2025-04-01');
  });
});

describe('DaySummary', () => {
  it('affiche les calories restantes, sport inclus dans le budget', async () => {
    await renderWithStore(DaySummary, { inputs: { intake, burned: 300, goal: 2000 } });
    expect(screen.getByText('Restantes')).toBeInTheDocument();
    expect(screen.getByText('800')).toBeInTheDocument(); // 2000 + 300 - 1500
    expect(screen.getByText('−300')).toBeInTheDocument();
    expect(screen.getByText(/Protéines 100 g · Glucides 150 g · Lipides 50 g/)).toBeInTheDocument();
  });

  it('signale un dépassement', async () => {
    await renderWithStore(DaySummary, { inputs: { intake: { ...intake, kcal: 2500 }, burned: 0, goal: 2000 } });
    expect(screen.getByText('Dépassement')).toBeInTheDocument();
    expect(screen.getByLabelText('100 % du budget')).toBeInTheDocument();
  });

  it('affiche la progression des macros quand des objectifs existent', async () => {
    await renderWithStore(DaySummary, { inputs: { intake, burned: 0, goal: 2000, settings: { kcalGoal: 2000, proteinGoal: 200 } } });
    expect(screen.getByText('100 / 200 g')).toBeInTheDocument();
    expect(screen.queryByText(/Glucides 150 g · Lipides/)).not.toBeInTheDocument();
  });

  it('revient au résumé simple sans objectif de macros', async () => {
    await renderWithStore(DaySummary, { inputs: { intake, burned: 0, goal: 2000, settings: { kcalGoal: 2000 } } });
    expect(screen.getByText(/Protéines 100 g/)).toBeInTheDocument();
  });

  it('gère un budget nul', async () => {
    await renderWithStore(DaySummary, { inputs: { intake, burned: 0, goal: 0 } });
    expect(screen.getByLabelText('0 % du budget')).toBeInTheDocument();
  });
});

describe('Stat', () => {
  it('affiche libellé, valeur et unité', async () => {
    await renderWithStore(Stat, { inputs: { label: 'Poids', value: 72, unit: 'kg', tone: 'good' } });
    expect(screen.getByText('Poids')).toBeInTheDocument();
    expect(screen.getByText('kg')).toBeInTheDocument();
  });
});
