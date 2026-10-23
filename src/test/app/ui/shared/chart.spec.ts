import type { TooltipItem } from 'chart.js';
import { describe, expect, it } from 'vitest';
import { COLORS, chartOptions, goalLine } from '../../../../app/ui/shared/chart';

type Cb = {
  title: (items: { label?: string }[]) => string;
  label: (ctx: unknown) => string;
};
const callbacks = (style = {}) => (chartOptions(style).plugins!.tooltip!.callbacks as unknown) as Cb;
const ctx = (y: number | null | undefined, label = 'Poids', formatted = '70') =>
  ({ dataset: { label }, parsed: { y }, formattedValue: formatted }) as unknown as TooltipItem<'line'>;

describe('goalLine', () => {
  it('trace une valeur constante pointillée sur toutes les étiquettes', () => {
    const line = goalLine(['a', 'b', 'c'], 2000);
    expect(line.data).toEqual([2000, 2000, 2000]);
    expect(line.borderColor).toBe(COLORS.goal);
    expect(line.borderDash).toEqual([4, 4]);
    expect(line.label).toBe('Objectif');
  });

  it('accepte un libellé personnalisé', () => {
    expect(goalLine(['a'], 1, 'Cible').label).toBe('Cible');
  });
});

describe('chartOptions', () => {
  it('masque la légende par défaut et l’affiche à la demande', () => {
    expect(chartOptions().plugins!.legend!.display).toBe(false);
    expect(chartOptions({ legend: true }).plugins!.legend!.display).toBe(true);
  });

  it('empile les axes si demandé', () => {
    const scales = chartOptions({ stacked: true }).scales as Record<string, { stacked: boolean }>;
    expect(scales['x'].stacked).toBe(true);
    expect(scales['y'].stacked).toBe(true);
  });

  it('commence l’axe vertical à zéro sauf en mode serré', () => {
    const y = (s = {}) => (chartOptions(s).scales as Record<string, { beginAtZero: boolean }>)['y'];
    expect(y().beginAtZero).toBe(true);
    expect(y({ tight: true }).beginAtZero).toBe(false);
  });

  it('transmet bornes, limite d’étiquettes et graduations entières', () => {
    const scales = chartOptions({ min: 1, max: 9, maxTicks: 6, integer: true }).scales as Record<
      string,
      { min?: number; max?: number; ticks: { maxTicksLimit?: number; precision?: number } }
    >;
    expect(scales['y'].min).toBe(1);
    expect(scales['y'].max).toBe(9);
    expect(scales['y'].ticks.precision).toBe(0);
    expect(scales['x'].ticks.maxTicksLimit).toBe(6);
  });

  it('ajoute un second axe vertical uniquement avec y2', () => {
    expect((chartOptions().scales as Record<string, unknown>)['y2']).toBeUndefined();
    const y2 = (chartOptions({ y2: { min: 0, max: 5 } }).scales as Record<string, { position: string; min: number; max: number }>)['y2'];
    expect(y2).toMatchObject({ position: 'right', min: 0, max: 5 });
  });

  describe('infobulles', () => {
    it('préfixe le titre', () => {
      expect(callbacks({ titlePrefix: 'Semaine du ' }).title([{ label: '01/03' }])).toBe('Semaine du 01/03');
      expect(callbacks().title([{ label: '01/03' }])).toBe('01/03');
      expect(callbacks().title([])).toBe('');
    });

    it('ajoute l’unité à la valeur', () => {
      expect(callbacks({ unit: 'kg' }).label(ctx(70.5, 'Poids', '70,5'))).toBe('Poids : 70,5 kg');
      expect(callbacks().label(ctx(70, 'Poids', '70'))).toBe('Poids : 70');
    });

    it('utilise le formateur personnalisé à la place de l’unité', () => {
      const format = (series: string, v: number) => `${series}=${v * 2}`;
      expect(callbacks({ unit: 'kg', format }).label(ctx(5, 'S', '5'))).toBe('S : S=10');
    });

    it('n’affiche que le nom de la série quand la valeur est absente', () => {
      expect(callbacks().label(ctx(null))).toBe('Poids');
      expect(callbacks().label(ctx(undefined))).toBe('Poids');
    });
  });
});
