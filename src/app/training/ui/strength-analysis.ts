import { Component, computed, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import type { AppData } from '../../application/appData';
import { correlation, crossSummary, crossWeekly, describeCorrelation, forceVerdict } from '../../application/crossAnalysis';
import { fmtDate, fmtShort } from '../../shared/kernel/dates';
import { round, signed } from '../../shared/kernel/numbers';
import { AppChart, COLORS, type ChartStyle } from '../../ui/shared/chart';
import { Stat } from '../../ui/shared/day-summary';
import { Segmented, type SegmentOption } from '../../ui/shared/segmented';
import type { StrengthSession } from '../domain/session';
import { MUSCLE_GROUPS, weeklyVolume } from '../domain/strength';
import { exerciseTrends, muscleSummary, sessionDensity, sessionHeatmap, weekStreaks, weeklyMuscleLoad, type ExerciseTrend, type TrendStatus } from '../domain/strengthAnalysis';
import { MUSCLE_COLORS, WEEKDAY_INITIALS, fr } from './muscle-colors';

const pct = (n: number | null) => (n === null ? '–' : `${signed(n, 1).replace('.', ',')} %`);
const tone = (n: number | null) => (n === null ? undefined : n >= 0 ? ('good' as const) : ('bad' as const));

// --- 1. Tendances par exercice ---

const STATUS: Record<TrendStatus, { label: string; badge: string }> = {
  up: { label: 'En hausse', badge: 'raw' },
  flat: { label: 'Stable', badge: 'unknown' },
  down: { label: 'En baisse', badge: 'ultra' },
  plateau: { label: 'Plateau', badge: 'processed' },
  new: { label: 'Récent', badge: 'unknown' },
  inactive: { label: 'Inactif', badge: 'unknown' },
};

const SPARK_POINTS = 12;

/** Mini-courbe de la tendance d'un exercice. */
@Component({
  selector: 'app-sparkline',
  templateUrl: './sparkline.html',
})
export class Sparkline {
  readonly trend = input.required<ExerciseTrend>();

  protected readonly geometry = computed(() => {
    const trend = this.trend();
    const pts = trend.points.slice(-SPARK_POINTS);
    if (pts.length < 2) return null;
    const [w, h, pad] = [84, 26, 3];
    const values = pts.map((p) => p.value);
    const [min, max] = [Math.min(...values), Math.max(...values)];
    const x = (i: number) => pad + (i / (pts.length - 1)) * (w - 2 * pad);
    const y = (v: number) => (max === min ? h / 2 : h - pad - ((v - min) / (max - min)) * (h - 2 * pad));
    return {
      w,
      h,
      count: pts.length,
      points: pts.map((p, i) => `${x(i)},${y(p.value)}`).join(' '),
      stroke: trend.status === 'up' ? 'var(--good)' : trend.status === 'down' ? 'var(--bad)' : 'var(--muted)',
      lastX: x(pts.length - 1),
      lastY: y(pts[pts.length - 1].value),
    };
  });
}

type TrendFilter = 'active' | 'watch' | 'all';
const FILTERS: SegmentOption<TrendFilter>[] = [
  { value: 'active', label: 'Actifs' },
  { value: 'watch', label: 'À surveiller' },
  { value: 'all', label: 'Tous' },
];
const COLLAPSED_ROWS = 12;

@Component({
  selector: 'app-trends-card',
  imports: [MatButtonModule, MatCardModule, Segmented, Sparkline, Stat],
  templateUrl: './trends-card.html',
})
export class TrendsCard {
  readonly sessions = input.required<StrengthSession[]>();
  readonly today = input.required<string>();
  readonly selected = input<string>();
  /** Rend les lignes cliquables : l'exercice choisi est émis par `picked`. */
  readonly selectable = input(false);
  readonly picked = output<string>();

  protected readonly filters = FILTERS;
  protected readonly status = STATUS;
  protected readonly collapsedRows = COLLAPSED_ROWS;
  protected readonly fr = fr;
  protected readonly pct = pct;
  protected readonly filter = signal<TrendFilter>('active');
  protected readonly expanded = signal(false);

  private readonly trends = computed(() => exerciseTrends(this.sessions(), this.today()));
  private readonly active = computed(() => this.trends().filter((t) => t.status !== 'inactive'));
  protected readonly list = computed(() =>
    this.trends().filter((t) => (this.filter() === 'all' ? true : this.filter() === 'active' ? t.status !== 'inactive' : t.status === 'plateau' || t.status === 'down')),
  );
  protected readonly shown = computed(() => (this.expanded() ? this.list() : this.list().slice(0, COLLAPSED_ROWS)));

  protected count(s: TrendStatus) {
    return this.active().filter((t) => t.status === s).length;
  }

  protected setFilter(f: TrendFilter) {
    this.filter.set(f);
    this.expanded.set(false);
  }

  protected deltaTone(d: number | null) {
    return d === null ? '' : d >= 1.5 ? 'good' : d <= -1.5 ? 'bad' : 'muted';
  }

  protected detail(t: ExerciseTrend) {
    return t.status === 'plateau'
      ? `Meilleur il y a ${t.sinceBest} séance${t.sinceBest > 1 ? 's' : ''} (${t.daysSinceBest} j)`
      : `${t.sessions} séance${t.sessions > 1 ? 's' : ''} · dernière ${fmtShort(t.lastDate)}`;
  }
}

// --- 3. Charge par muscle ---

type MuscleMetric = 'sets' | 'volume';
const METRICS: SegmentOption<MuscleMetric>[] = [
  { value: 'sets', label: 'Séries' },
  { value: 'volume', label: 'Tonnage' },
];

@Component({
  selector: 'app-muscle-load-card',
  imports: [MatCardModule, AppChart, Segmented],
  templateUrl: './muscle-load-card.html',
})
export class MuscleLoadCard {
  readonly all = input.required<StrengthSession[]>();
  readonly period = input.required<StrengthSession[]>();
  readonly today = input.required<string>();
  readonly weeks = input.required<number>();

  protected readonly metrics = METRICS;
  protected readonly colors = MUSCLE_COLORS;
  protected readonly fr = fr;
  protected readonly round = round;
  protected readonly metric = signal<MuscleMetric>('sets');

  private readonly load = computed(() => weeklyMuscleLoad(this.all(), this.today(), this.weeks()));
  protected readonly rows = computed(() => muscleSummary(this.period(), this.weeks()));
  protected readonly groups = computed(() => MUSCLE_GROUPS.filter((g) => this.load().some((w) => w[this.metric()][g] > 0)));
  protected readonly rated = computed(() => this.load().reduce((n, w) => n + w.ratedSets, 0));
  protected readonly hard = computed(() => this.load().reduce((n, w) => n + w.hardSets, 0));
  protected readonly total = computed(() => this.load().reduce((n, w) => n + w.totalSets, 0));

  protected readonly stacked = computed(() => ({
    labels: this.load().map((w) => fmtShort(w.week)),
    datasets: this.groups().map((g) => ({
      type: 'bar' as const,
      label: g,
      data: this.load().map((w) => round(w[this.metric()][g])),
      backgroundColor: MUSCLE_COLORS[g],
    })),
  }));
  protected readonly hardData = computed(() => ({
    labels: this.load().map((w) => fmtShort(w.week)),
    datasets: [
      { type: 'bar' as const, label: 'Séries dures', data: this.load().map((w) => w.hardSets), backgroundColor: COLORS.goal },
      { type: 'bar' as const, label: 'Autres séries', data: this.load().map((w) => w.totalSets - w.hardSets), backgroundColor: COLORS.grid },
    ],
  }));
}

// --- 4. Régularité ---

const HEATMAP_WEEKS = 26;
const TREND_WEEKS = 12;

@Component({
  selector: 'app-consistency-card',
  imports: [RouterLink, MatCardModule, AppChart, Stat],
  templateUrl: './consistency-card.html',
})
export class ConsistencyCard {
  readonly sessions = input.required<StrengthSession[]>();
  readonly today = input.required<string>();

  protected readonly trendWeeks = TREND_WEEKS;
  protected readonly weekdays = WEEKDAY_INITIALS;
  protected readonly fr = fr;
  protected readonly fmtDate = fmtDate;
  protected readonly streaks = computed(() => weekStreaks(this.sessions(), this.today()));
  protected readonly heat = computed(() => sessionHeatmap(this.sessions(), this.today(), HEATMAP_WEEKS));
  private readonly weekly = computed(() => weeklyVolume(this.sessions(), this.today(), TREND_WEEKS));
  protected readonly density = computed(() => sessionDensity(this.sessions()).slice(-20));
  protected readonly total = computed(() => this.weekly().reduce((n, w) => n + w.sessions, 0));
  protected readonly activeWeeks = computed(() => this.weekly().filter((w) => w.sessions > 0).length);

  protected readonly perWeek = computed(() => ({
    labels: this.weekly().map((w) => fmtShort(w.week)),
    datasets: [{ type: 'bar' as const, label: 'Séances', data: this.weekly().map((w) => w.sessions), backgroundColor: COLORS.weight, borderRadius: 4 }],
  }));

  protected readonly densityLook: ChartStyle = {
    legend: true,
    y2: {},
    format: (series, v) => (series === 'Durée' ? `${v} min` : `${v} kg/min`),
  };
  protected readonly densityData = computed(() => ({
    labels: this.density().map((d) => fmtShort(d.date)),
    datasets: [
      { type: 'bar' as const, label: 'Durée', data: this.density().map((d) => d.minutes), backgroundColor: COLORS.grid, borderRadius: 4, yAxisID: 'y' },
      {
        type: 'line' as const,
        label: 'Densité',
        data: this.density().map((d) => round(d.density, 1)),
        borderColor: COLORS.burned,
        backgroundColor: COLORS.burned,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        yAxisID: 'y2',
      },
    ],
  }));
}

// --- 5. Croisements ---

type CrossView = 'weight' | 'nutrition' | 'waist';
const VIEWS: SegmentOption<CrossView>[] = [
  { value: 'weight', label: 'Poids de corps' },
  { value: 'nutrition', label: 'Nutrition' },
  { value: 'waist', label: 'Tour de taille' },
];
const CROSS_PERIODS: SegmentOption<number>[] = [
  { value: 12, label: '12 semaines' },
  { value: 26, label: '6 mois' },
];
const NUTRIENTS: SegmentOption<'protein' | 'kcal'>[] = [
  { value: 'protein', label: 'Protéines' },
  { value: 'kcal', label: 'Calories' },
];

const line = (label: string, data: (number | null)[], color: string, yAxisID: string, dashed = false) => ({
  type: 'line' as const,
  label,
  data,
  borderColor: color,
  backgroundColor: color,
  borderWidth: 2,
  pointRadius: dashed ? 0 : 3,
  tension: 0.3,
  spanGaps: true,
  yAxisID,
  ...(dashed ? { borderDash: [4, 3] } : {}),
});

@Component({
  selector: 'app-cross-card',
  imports: [MatCardModule, MatFormFieldModule, MatInputModule, AppChart, Segmented, Stat],
  templateUrl: './cross-card.html',
})
export class CrossCard {
  readonly data = input.required<AppData>();
  readonly today = input.required<string>();

  protected readonly views = VIEWS;
  protected readonly periods = CROSS_PERIODS;
  protected readonly nutrients = NUTRIENTS;
  protected readonly pct = pct;
  protected readonly tone = tone;
  protected readonly signed = signed;

  protected readonly view = signal<CrossView>('weight');
  protected readonly weeks = signal(12);
  protected readonly chosen = signal<string | null>(null);
  protected readonly nutrient = signal<'protein' | 'kcal'>('protein');

  protected readonly lifts = computed(() => exerciseTrends(this.data().strength, this.today()).filter((t) => t.unit === 'kg'));
  protected readonly exercise = computed(() => {
    const [chosen, lifts] = [this.chosen(), this.lifts()];
    return chosen && lifts.some((l) => l.name === chosen) ? chosen : lifts[0]?.name;
  });
  private readonly rows = computed(() => crossWeekly(this.data(), this.today(), this.weeks(), this.exercise() ?? ''));
  protected readonly summary = computed(() => crossSummary(this.rows()));
  private readonly labels = computed(() => this.rows().map((r) => fmtShort(r.week)));

  // Poids de corps
  protected readonly relativePoints = computed(() => this.rows().filter((r) => r.relative !== null).length);
  protected readonly verdict = computed(() => forceVerdict(this.summary()));
  protected readonly weightLook: ChartStyle = {
    legend: true,
    tight: true,
    y2: {},
    titlePrefix: 'Semaine du ',
    format: (series, v) => (series === 'Poids' ? `${v} kg` : `${v} × poids de corps`),
  };
  protected readonly weightChart = computed(() => ({
    labels: this.labels(),
    datasets: [
      line('Force relative', this.rows().map((r) => (r.relative === null ? null : round(r.relative, 2))), COLORS.burned, 'y'),
      line('Poids', this.rows().map((r) => (r.bodyWeight === null ? null : round(r.bodyWeight, 1))), COLORS.weight, 'y2', true),
    ],
  }));

  // Nutrition
  protected readonly hasNutrient = computed(() => this.rows().some((x) => x[this.nutrient()] !== null));
  private readonly usable = computed(() => this.rows().filter((r) => r[this.nutrient()] !== null && r.volume > 0));
  private readonly apportLabel = computed(() => (this.nutrient() === 'protein' ? 'Protéines (moy./jour)' : 'Calories (moy./jour)'));
  protected readonly nutritionLook = computed<ChartStyle>(() => {
    const unit = this.nutrient() === 'protein' ? 'g/j' : 'kcal/j';
    return { legend: true, y2: {}, titlePrefix: 'Semaine du ', format: (series, v) => (series === 'Volume hebdo (kg)' ? `${v} kg` : `${v} ${unit}`) };
  });
  protected readonly nutritionChart = computed(() => {
    const key = this.nutrient();
    return {
      labels: this.labels(),
      datasets: [
        { type: 'bar' as const, label: 'Volume hebdo (kg)', data: this.rows().map((x) => round(x.volume)), backgroundColor: COLORS.intake, borderRadius: 4, yAxisID: 'y' },
        line(this.apportLabel(), this.rows().map((x) => (x[key] === null ? null : round(x[key]!))), COLORS.burned, 'y2'),
      ],
    };
  });
  protected readonly correlationText = computed(() => {
    const key = this.nutrient();
    const usable = this.usable();
    const r = correlation(usable.map((x) => [x[key]!, x.volume]));
    return r === null
      ? `Pas encore assez de semaines complètes pour une corrélation (${usable.length} sur 6 minimum, avec séances et au moins 3 jours de journal).`
      : `Sur ${usable.length} semaines, lien ${describeCorrelation(r)} entre ${key === 'protein' ? 'tes protéines' : 'tes calories'} et ton volume (r = ${fr(r, 2)}).`;
  });

  // Tour de taille
  protected readonly waistPoints = computed(() => this.rows().filter((r) => r.waist !== null).length);
  protected readonly waistLook: ChartStyle = {
    legend: true,
    tight: true,
    y2: {},
    titlePrefix: 'Semaine du ',
    format: (series, v) => (series === 'Taille' ? `${v} cm` : `${v} kg`),
  };
  protected readonly waistChart = computed(() => ({
    labels: this.labels(),
    datasets: [
      line('1RM estimé', this.rows().map((r) => (r.e1rm === null ? null : round(r.e1rm, 1))), COLORS.burned, 'y'),
      line('Taille', this.rows().map((r) => (r.waist === null ? null : round(r.waist, 1))), COLORS.weight, 'y2', true),
    ],
  }));
  protected readonly waistNote = computed(() => {
    const [d, e] = [this.summary().waistDelta, this.summary().e1rmPct];
    if (d === null || e === null) return null;
    if (d <= -0.5 && e >= 0) return 'Le tour de taille baisse pendant que la force se maintient ou progresse : signe de recomposition.';
    if (d >= 0.5 && e >= 2) return 'Taille et force montent ensemble : cohérent avec une prise de masse.';
    return null;
  });
}
