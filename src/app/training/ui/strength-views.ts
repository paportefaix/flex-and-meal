import { Component, computed, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { addDays, fmtDate, fmtShort, startOfWeek, toISO } from '../../shared/kernel/dates';
import { round, signed } from '../../shared/kernel/numbers';
import type { StrengthSession, Workout } from '../domain/session';
import { MUSCLE_GROUPS, estimate1RM, muscleOf, records, sessionSets, sessionVolume, setVolume, weeklyVolume, workSets, type MuscleGroup } from '../domain/strength';
import { muscleSummary, weekStreaks, weeklyMuscleLoad } from '../domain/strengthAnalysis';
import { MUSCLE_COLORS, WEEKDAY_INITIALS, fmtDuration, fr, heat, tonnes } from './muscle-colors';

const pad2 = (n: number) => String(n).padStart(2, '0');

// --- Bandeau « Cette semaine » ---

@Component({
  selector: 'app-week-banner',
  imports: [MatCardModule],
  templateUrl: './week-banner.html',
})
export class WeekBanner {
  readonly sessions = input.required<StrengthSession[]>();
  readonly today = input.required<string>();
  protected readonly fmtShort = fmtShort;
  protected readonly tonnes = tonnes;
  protected readonly fr = fr;

  protected readonly thisWeek = computed(() => startOfWeek(this.today()));
  protected readonly weekEnd = computed(() => addDays(this.thisWeek(), 6));
  private readonly weekly = computed(() => weeklyVolume(this.sessions(), this.today(), 9));
  protected readonly streaks = computed(() => weekStreaks(this.sessions(), this.today()));
  protected readonly lastPR = computed(() =>
    records(this.sessions())
      .filter((r) => r.best1RM > 0)
      .sort((a, b) => b.best1RMDate.localeCompare(a.best1RMDate))[0],
  );
  protected readonly cur = computed(() => this.weekly()[this.weekly().length - 1]);
  private readonly prev = computed(() => this.weekly()[this.weekly().length - 2]);
  protected readonly target = computed(() => {
    const usual = this.weekly().slice(0, -1).filter((w) => w.sessions > 0);
    return usual.length ? Math.max(1, Math.round(usual.reduce((n, w) => n + w.sessions, 0) / usual.length)) : null;
  });
  protected readonly volumeDelta = computed(() => {
    const [cur, prev] = [this.cur(), this.prev()];
    return prev.volume > 0 ? ((cur.volume - prev.volume) / prev.volume) * 100 : null;
  });
  protected readonly volumeText = computed(() => {
    const d = this.volumeDelta();
    return d === null ? 'Pas de semaine précédente' : `${d >= 0 ? '▲' : '▼'} ${signed(d, 0)} % vs sem. dernière`;
  });
  protected readonly dots = computed(() => Math.max(this.target() ?? 0, this.cur().sessions));
  protected readonly dotList = computed(() => Array.from({ length: this.dots() }, (_, i) => i));
}

// --- Heatmap muscle × semaine ---

@Component({
  selector: 'app-muscle-heatmap',
  imports: [MatCardModule],
  templateUrl: './muscle-heatmap.html',
})
export class MuscleHeatmap {
  readonly sessions = input.required<StrengthSession[]>();
  readonly today = input.required<string>();
  readonly weeks = input(8);
  protected readonly fmtShort = fmtShort;
  protected readonly fr = fr;
  protected readonly heat = heat;
  protected readonly shades = [0.05, 0.3, 0.55, 0.8, 1];

  protected readonly load = computed(() => weeklyMuscleLoad(this.sessions(), this.today(), this.weeks()));
  protected readonly groups = computed(() => MUSCLE_GROUPS.filter((g) => this.load().some((w) => w.sets[g] > 0)));
  protected readonly max = computed(() => Math.max(20, ...this.groups().flatMap((g) => this.load().map((w) => w.sets[g]))));

  protected total(g: MuscleGroup) {
    return this.load().reduce((n, w) => n + w.sets[g], 0);
  }
}

// --- Carte musculaire ---

type Shape =
  | { path: string }
  | { circle: [cx: number, cy: number, r: number] }
  | { rect: [x: number, y: number, w: number, h: number, rx: number] };

const SHOULDERS: Shape[] = [{ circle: [55, 78, 13] }, { circle: [145, 78, 13] }];
const ARMS: Shape[] = [{ rect: [36, 94, 17, 42, 8] }, { rect: [147, 94, 17, 42, 8] }];
const LEGS: Shape[] = [{ path: 'M72 190 L98 190 L96 300 L78 300Z' }, { path: 'M102 190 L128 190 L122 300 L104 300Z' }];

const FRONT: [MuscleGroup, Shape[]][] = [
  ['Pectoraux', [{ path: 'M70 82 Q100 74 100 92 L100 108 Q82 114 66 104 Q62 92 70 82Z' }, { path: 'M130 82 Q100 74 100 92 L100 108 Q118 114 134 104 Q138 92 130 82Z' }]],
  ['Épaules', SHOULDERS],
  ['Biceps', ARMS],
  ['Abdos', [{ rect: [78, 116, 44, 64, 10] }]],
  ['Jambes', LEGS],
];

const BACK: [MuscleGroup, Shape[]][] = [
  ['Dos', [{ path: 'M72 70 Q100 60 128 70 L124 150 Q100 160 76 150Z' }]],
  ['Épaules', SHOULDERS],
  ['Triceps', ARMS],
  ['Jambes', LEGS],
];

/** Fourchette courante en hypertrophie, en séries par groupe et par semaine. */
const RANGE = [10, 20] as const;

@Component({
  selector: 'app-muscle-map',
  imports: [MatCardModule],
  templateUrl: './muscle-map.html',
})
export class MuscleMap {
  readonly period = input.required<StrengthSession[]>();
  readonly weeks = input.required<number>();
  protected readonly Math = Math;
  protected readonly fr = fr;
  protected readonly heat = heat;
  protected readonly colors = MUSCLE_COLORS;
  protected readonly range = RANGE;
  protected readonly figures = [
    { caption: 'Face', label: 'Silhouette de face colorée selon les séries par semaine', zones: FRONT },
    { caption: 'Dos', label: 'Silhouette de dos colorée selon les séries par semaine', zones: BACK },
  ];

  protected readonly rows = computed(() => muscleSummary(this.period(), this.weeks()));
  private readonly byGroup = computed(() => new Map(this.rows().map((r) => [r.group, r.setsPerWeek])));
  protected readonly max = computed(() => Math.max(24, ...this.rows().map((r) => r.setsPerWeek * 1.1)));

  protected perWeek(g: MuscleGroup) {
    return this.byGroup().get(g) ?? 0;
  }

  protected state(v: number) {
    return v < RANGE[0] ? 'sous la fourchette' : v > RANGE[1] ? 'au-dessus' : 'dans la fourchette';
  }

  protected tone(v: number) {
    return v < RANGE[0] ? 'bad' : v > RANGE[1] ? 'muted' : 'good';
  }

  protected asPath(s: Shape) {
    return 'path' in s ? s.path : null;
  }

  protected asCircle(s: Shape) {
    return 'circle' in s ? s.circle : null;
  }

  protected asRect(s: Shape) {
    return 'rect' in s ? s.rect : null;
  }
}

// --- Calendrier et liste des séances ---

interface ExerciseDelta {
  /** Variation du meilleur 1RM estimé (kg) ou des répétitions pour un exercice au poids du corps, par rapport à la dernière séance de cet exercice. */
  delta: number | null;
  unit: 'kg' | 'reps';
}

interface SessionInfo {
  deltas: ExerciseDelta[];
  muscles: MuscleGroup[];
  pr: boolean;
}

/** Pour chaque séance : variation de chaque exercice vs la séance précédente, muscles travaillés, record battu. */
function sessionInfos(sessions: StrengthSession[]): Map<string, SessionInfo> {
  const asc = [...sessions].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const last = new Map<string, number>();
  const best = new Map<string, number>();
  const out = new Map<string, SessionInfo>();
  for (const s of asc) {
    const info: SessionInfo = { deltas: [], muscles: [], pr: false };
    const seen = new Map<string, number>();
    for (const e of s.exercises) {
      const sets = workSets(e);
      if (!sets.length) {
        info.deltas.push({ delta: null, unit: 'kg' });
        continue;
      }
      const group = muscleOf(e.name);
      if (!info.muscles.includes(group)) info.muscles.push(group);
      const weighted = sets.some((x) => x.weight > 0);
      const metric = weighted ? Math.max(...sets.map((x) => estimate1RM(x.weight, x.reps))) : Math.max(...sets.map((x) => x.reps));
      const before = last.get(e.name);
      info.deltas.push({ delta: before === undefined ? null : metric - before, unit: weighted ? 'kg' : 'reps' });
      seen.set(e.name, Math.max(seen.get(e.name) ?? 0, metric));
      if (weighted && best.has(e.name) && metric > best.get(e.name)!) info.pr = true;
    }
    for (const [name, metric] of seen) {
      last.set(name, metric);
      best.set(name, Math.max(best.get(name) ?? 0, metric));
    }
    out.set(s.id, info);
  }
  return out;
}

const PAGE = 10;

@Component({
  selector: 'app-sessions-panel',
  imports: [MatButtonModule, MatCardModule],
  templateUrl: './sessions-panel.html',
})
export class SessionsPanel {
  readonly sessions = input.required<StrengthSession[]>();
  readonly workouts = input.required<Workout[]>();
  readonly today = input.required<string>();

  protected readonly Math = Math;
  protected readonly page = PAGE;
  protected readonly weekdays = WEEKDAY_INITIALS;
  protected readonly fmtDate = fmtDate;
  protected readonly fmtDuration = fmtDuration;
  protected readonly fr = fr;
  protected readonly round = round;
  protected readonly tonnes = tonnes;
  protected readonly sets = sessionSets;
  protected readonly volume = sessionVolume;
  protected readonly e1rm = estimate1RM;
  protected readonly setVol = setVolume;

  protected readonly month = signal<string | null>(null);
  protected readonly selected = signal<string | null>(null);
  protected readonly filter = signal<MuscleGroup | null>(null);
  protected readonly shown = signal(PAGE);

  protected readonly currentMonth = computed(() => `${this.today().slice(0, 8)}01`);
  protected readonly monthValue = computed(() => this.month() ?? this.currentMonth());

  protected readonly infos = computed(() => sessionInfos(this.sessions()));
  private readonly strengthByDate = computed(() => {
    const m = new Map<string, StrengthSession[]>();
    for (const s of this.sessions()) m.set(s.date, [...(m.get(s.date) ?? []), s]);
    return m;
  });
  private readonly cardioByDate = computed(() => {
    const m = new Map<string, Workout[]>();
    for (const w of this.workouts()) m.set(w.date, [...(m.get(w.date) ?? []), w]);
    return m;
  });

  private readonly ym = computed(() => {
    const m = this.monthValue();
    return [Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1] as const;
  });
  protected readonly monthLabel = computed(() => new Date(this.ym()[0], this.ym()[1], 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }));
  protected readonly blanks = computed(() => {
    const [y, mo] = this.ym();
    return Array.from({ length: (new Date(y, mo, 1).getDay() + 6) % 7 }, (_, i) => i);
  });
  protected readonly cells = computed(() => {
    const [y, mo] = this.ym();
    const daysInMonth = new Date(y, mo + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const date = `${this.monthValue().slice(0, 8)}${pad2(i + 1)}`;
      const lifts = this.strengthByDate().get(date);
      const cardio = this.cardioByDate().get(date);
      const kind = lifts ? 'lift' : cardio ? 'cardio' : '';
      return { date, day: i + 1, kind, label: lifts?.[0]?.title ?? cardio?.[0]?.activity ?? '' };
    });
  });

  protected readonly muscles = computed(() => {
    const present = new Set<MuscleGroup>();
    for (const info of this.infos().values()) info.muscles.forEach((g) => present.add(g));
    return MUSCLE_GROUPS.filter((g) => present.has(g));
  });
  protected readonly filters = computed<(MuscleGroup | null)[]>(() => [null, ...this.muscles()]);

  protected readonly list = computed(() => {
    const [selected, filter, infos] = [this.selected(), this.filter(), this.infos()];
    return [...this.sessions()].reverse().filter((s) => (selected ? s.date === selected : filter ? infos.get(s.id)?.muscles.includes(filter) : true));
  });
  protected readonly selectedCardio = computed(() => (this.selected() ? (this.cardioByDate().get(this.selected()!) ?? []) : []));
  protected readonly visible = computed(() => (this.selected() ? this.list() : this.list().slice(0, this.shown())));

  protected shiftMonth(n: number) {
    const [y, mo] = this.ym();
    this.month.set(toISO(new Date(y, mo + n, 1)));
    this.selected.set(null);
  }

  protected setFilter(g: MuscleGroup | null) {
    this.filter.set(g);
    this.shown.set(PAGE);
  }

  /** Numéro de la série de travail (les échauffements ne sont pas comptés). */
  protected workIndex(sets: { type: string }[], k: number) {
    return sets.slice(0, k + 1).filter((x) => x.type !== 'warmup').length;
  }

  protected noWorkSets(e: StrengthSession['exercises'][number]) {
    return workSets(e).length === 0;
  }

  protected deltaText(d: ExerciseDelta | undefined) {
    if (!d || d.delta === null) return null;
    const v = d.unit === 'kg' ? round(d.delta, 1) : round(d.delta);
    if (v === 0) return { text: '=', tone: 'muted', title: 'Comme la séance précédente' };
    return {
      text: `${v > 0 ? '▲' : '▼'} ${fr(Math.abs(v))} ${d.unit === 'kg' ? 'kg' : 'rép.'}`,
      tone: v > 0 ? 'good' : 'bad',
      title: 'Par rapport à la séance précédente de cet exercice',
    };
  }
}
