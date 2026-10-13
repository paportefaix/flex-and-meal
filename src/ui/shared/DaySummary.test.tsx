import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DaySummary, Stat } from './DaySummary';

const intake = { kcal: 1500, protein: 100, carbs: 150, fat: 50 };

describe('DaySummary', () => {
  it('affiche les calories restantes, sport inclus dans le budget', () => {
    render(<DaySummary intake={intake} burned={300} goal={2000} />);
    expect(screen.getByText('Restantes')).toBeInTheDocument();
    expect(screen.getByText('800')).toBeInTheDocument(); // 2000 + 300 - 1500
    expect(screen.getByText('−300')).toBeInTheDocument();
    expect(screen.getByText(/Protéines 100 g · Glucides 150 g · Lipides 50 g/)).toBeInTheDocument();
  });

  it('signale un dépassement', () => {
    render(<DaySummary intake={{ ...intake, kcal: 2500 }} burned={0} goal={2000} />);
    expect(screen.getByText('Dépassement')).toBeInTheDocument();
    expect(screen.getByLabelText('100 % du budget')).toBeInTheDocument();
  });

  it('affiche la progression des macros quand des objectifs existent', () => {
    render(<DaySummary intake={intake} burned={0} goal={2000} settings={{ kcalGoal: 2000, proteinGoal: 200 }} />);
    expect(screen.getByText('100 / 200 g')).toBeInTheDocument();
    expect(screen.queryByText(/Glucides 150 g · Lipides/)).not.toBeInTheDocument();
  });

  it('revient au résumé simple sans objectif de macros', () => {
    render(<DaySummary intake={intake} burned={0} goal={2000} settings={{ kcalGoal: 2000 }} />);
    expect(screen.getByText(/Protéines 100 g/)).toBeInTheDocument();
  });

  it('gère un budget nul', () => {
    render(<DaySummary intake={intake} burned={0} goal={0} />);
    expect(screen.getByLabelText('0 % du budget')).toBeInTheDocument();
  });
});

describe('Stat', () => {
  it('affiche libellé, valeur et unité', () => {
    render(<Stat label="Poids" value={72} unit="kg" tone="good" />);
    expect(screen.getByText('Poids')).toBeInTheDocument();
    expect(screen.getByText('kg')).toBeInTheDocument();
  });
});
