import { Component, computed, input } from '@angular/core';
import type { ChartData, ChartOptions, ChartType } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

// Couleurs lisibles en thème clair comme sombre (le canvas ne lit pas les variables CSS).
export const COLORS = {
  intake: '#4f7cff',
  burned: '#f59e0b',
  weight: '#10b981',
  goal: '#ef4444',
  grid: 'rgba(128,128,128,0.2)',
  axis: '#8a8f98',
};

/** Série « ligne d'objectif » : trait pointillé horizontal à hauteur de `value`. */
export function goalLine(labels: string[], value: number, label = 'Objectif') {
  return {
    type: 'line' as const,
    label,
    data: labels.map(() => value),
    borderColor: COLORS.goal,
    borderDash: [4, 4],
    borderWidth: 1.5,
    pointRadius: 0,
    pointHitRadius: 0,
    fill: false,
    order: 0,
  };
}

export interface ChartStyle {
  legend?: boolean;
  stacked?: boolean;
  /** Unité ajoutée aux valeurs dans les infobulles. */
  unit?: string;
  /** Bornes de l'axe vertical (par défaut : automatique, à partir de 0 pour les barres). */
  min?: number;
  max?: number;
  /** Axe vertical commençant juste sous la plus petite valeur (courbes de poids, 1RM…). */
  tight?: boolean;
  /** Axe horizontal : nombre maximal d'étiquettes. */
  maxTicks?: number;
  /** Graduations entières sur l'axe vertical (comptages). */
  integer?: boolean;
  /** Préfixe du titre des infobulles (ex. « Semaine du »). */
  titlePrefix?: string;
  /** Axe vertical de droite (séries avec `yAxisID: 'y2'`). */
  y2?: { min?: number; max?: number; unit?: string };
  /** Texte d'une valeur dans l'infobulle, selon la série (remplace `unit`). */
  format?: (series: string, value: number) => string;
}

/** Options Chart.js communes (thème, axes, infobulles). */
export function chartOptions(style: ChartStyle = {}): ChartOptions {
  const { legend = false, stacked = false, unit = '', min, max, maxTicks, integer, titlePrefix, y2, format } = style;
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    animation: false,
    plugins: {
      legend: { display: legend, labels: { color: COLORS.axis, usePointStyle: true, boxWidth: 8 } },
      tooltip: {
        callbacks: {
          title: (items) => (titlePrefix ? titlePrefix : '') + (items[0]?.label ?? ''),
          label: (ctx) => {
            const name = ctx.dataset.label ?? '';
            if (ctx.parsed.y === null || ctx.parsed.y === undefined) return name;
            return `${name} : ${format ? format(name, ctx.parsed.y) : ctx.formattedValue + (unit ? ' ' + unit : '')}`;
          },
        },
      },
    },
    scales: {
      x: { stacked, grid: { display: false }, ticks: { color: COLORS.axis, maxTicksLimit: maxTicks, font: { size: 12 } }, border: { color: COLORS.axis } },
      y: {
        stacked,
        min,
        max,
        beginAtZero: !style.tight,
        grid: { color: COLORS.grid },
        ticks: { color: COLORS.axis, font: { size: 12 }, precision: integer ? 0 : undefined },
        border: { display: false },
      },
      ...(y2
        ? {
            y2: {
              position: 'right',
              min: y2.min,
              max: y2.max,
              beginAtZero: false,
              grid: { drawOnChartArea: false },
              ticks: { color: COLORS.axis, font: { size: 12 } },
              border: { display: false },
            },
          }
        : {}),
    },
  } as ChartOptions;
}

/** Graphique Chart.js au thème de l'application. */
@Component({
  selector: 'app-chart',
  imports: [BaseChartDirective],
  templateUrl: './chart.html',
})
export class AppChart {
  readonly type = input<ChartType>('bar');
  readonly data = input.required<ChartData>();
  readonly look = input<ChartStyle>({});
  readonly height = input(200);
  readonly label = input('Graphique');
  /** Surcharge complète des options (à utiliser avec parcimonie). */
  readonly options = input<ChartOptions>();
  protected readonly resolvedOptions = computed(() => this.options() ?? chartOptions(this.look()));
}
