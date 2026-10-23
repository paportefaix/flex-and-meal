import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { addDays, fmtShort, startOfWeek, todayISO } from '../../shared/kernel/dates';
import { round, signed } from '../../shared/kernel/numbers';
import { AppChart, COLORS } from '../../ui/shared/chart';
import { DateField } from '../../ui/shared/date-field';
import { Stat } from '../../ui/shared/day-summary';
import { Segmented, type SegmentOption } from '../../ui/shared/segmented';
import { Store } from '../../ui/state/store';
import { mergeSessions, type StrengthSession } from '../domain/session';
import { exerciseHistory, exerciseNames, MUSCLE_GROUPS, records, repZones, sessionReps, sessionSets, sessionVolume, weeklyVolume } from '../domain/strength';
import { weeklyMuscleLoad } from '../domain/strengthAnalysis';
import { fetchSharedWorkout, parseWorkoutRefs } from '../infrastructure/hevyApi';
import { parseHevyCsv } from '../infrastructure/hevyCsv';
import { CardioForm } from './cardio-form';
import { fmtDuration, fr, MUSCLE_COLORS, tonnes } from './muscle-colors';
import { ConsistencyCard, CrossCard, MuscleLoadCard, ProgressionCard, TrendsCard } from './strength-analysis';
import { MuscleHeatmap, MuscleMap, SessionsPanel, WeekBanner } from './strength-views';

const PERIODS: SegmentOption<number>[] = [
  { value: 1, label: '1 semaine' },
  { value: 4, label: '4 semaines' },
  { value: 8, label: '8 semaines' },
  { value: 26, label: '6 mois' },
];
const VOLUME_BY: SegmentOption<'muscle' | 'total'>[] = [
  { value: 'muscle', label: 'Par muscle' },
  { value: 'total', label: 'Total' },
];

interface Message {
  text: string;
  error: boolean;
}

/** Ajout de séances à partir de leurs liens de partage Hevy (« Partager » → copier le lien). */
@Component({
  selector: 'app-hevy-link-card',
  imports: [FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  templateUrl: './hevy-link-card.html',
})
export class HevyLinkCard {
  private readonly store = inject(Store);
  protected readonly text = signal('');
  protected readonly busy = signal(false);
  protected readonly messages = signal<Message[]>([]);
  protected readonly ids = computed(() => parseWorkoutRefs(this.text()));

  protected async sync() {
    const ids = this.ids();
    if (!ids.length || this.busy()) return;
    this.busy.set(true);
    const out: Message[] = [];
    const fetched: StrengthSession[] = [];
    for (const id of ids) {
      try {
        fetched.push(await fetchSharedWorkout(id));
      } catch (err) {
        out.push({ text: err instanceof Error ? err.message : `Séance ${id} : import impossible`, error: true });
      }
    }
    if (fetched.length) {
      const { sessions, added } = mergeSessions(this.store.data().strength, fetched);
      this.store.update((d) => ({ ...d, strength: mergeSessions(d.strength, fetched).sessions }));
      out.unshift({
        text: added ? `${added} nouvelle${added > 1 ? 's' : ''} séance${added > 1 ? 's' : ''} ajoutée${added > 1 ? 's' : ''} (${sessions.length} au total).` : 'Séance déjà présente : mise à jour effectuée.',
        error: false,
      });
      if (!out.some((m) => m.error)) this.text.set('');
    }
    this.messages.set(out);
    this.busy.set(false);
  }
}

/** Saisie manuelle du cardio et liste des dernières sorties de la période. */
@Component({
  selector: 'app-cardio-card',
  imports: [MatButtonModule, MatCardModule, CardioForm, DateField],
  templateUrl: './cardio-card.html',
})
export class CardioCard {
  private readonly store = inject(Store);
  readonly from = input.required<string>();
  protected readonly today = todayISO();
  protected readonly date = signal(todayISO());
  protected readonly fmtDuration = fmtDuration;
  protected readonly fmtShort = fmtShort;
  protected readonly fr = fr;
  protected readonly round = round;

  protected readonly list = computed(() =>
    this.store.data().workouts.filter((w) => w.date >= this.from()).sort((a, b) => b.date.localeCompare(a.date)),
  );
  protected readonly km = computed(() => this.list().reduce((n, w) => n + (w.distanceKm ?? 0), 0));
  protected readonly minutes = computed(() => this.list().reduce((n, w) => n + w.duration, 0));

  protected remove(id: string) {
    this.store.update((d) => ({ ...d, workouts: d.workouts.filter((x) => x.id !== id) }));
  }
}

type Tab = 'overview' | 'progress' | 'muscles' | 'sessions' | 'more';
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Aperçu' },
  { key: 'progress', label: 'Progression' },
  { key: 'muscles', label: 'Muscles' },
  { key: 'sessions', label: 'Séances' },
  { key: 'more', label: 'Import & cardio' },
];

function loadTab(): number {
  try {
    const saved = sessionStorage.getItem('strength-tab');
    return Math.max(0, TABS.findIndex((t) => t.key === saved));
  } catch {
    return 0;
  }
}

@Component({
  selector: 'app-strength',
  imports: [
    NgTemplateOutlet,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatTabsModule,
    AppChart,
    CardioCard,
    ConsistencyCard,
    CrossCard,
    HevyLinkCard,
    MuscleHeatmap,
    MuscleLoadCard,
    MuscleMap,
    Segmented,
    SessionsPanel,
    Stat,
    TrendsCard,
    ProgressionCard,
    WeekBanner,
  ],
  templateUrl: './strength.html',
})
export class Strength {
  private readonly store = inject(Store);
  protected readonly data = this.store.data;
  protected readonly today = todayISO();
  protected readonly periods = PERIODS;
  protected readonly volumeByOptions = VOLUME_BY;
  protected readonly colors = COLORS;
  protected readonly fr = fr;
  protected readonly tonnes = tonnes;
  protected readonly round = round;
  protected readonly signed = signed;
  protected readonly fmtDuration = fmtDuration;
  protected readonly newRecordSince = addDays(this.today, -14);

  protected readonly tabIndex = signal(loadTab());
  protected readonly weeks = signal(1);
  protected readonly exercise = signal<string | null>(null);
  protected readonly volumeBy = signal<'muscle' | 'total'>('muscle');
  protected readonly message = signal<Message | null>(null);
  private readonly detail = viewChild('detail', { read: ElementRef });

  protected setTab(i: number) {
    this.tabIndex.set(i);
    try {
      sessionStorage.setItem('strength-tab', TABS[i].key);
    } catch {
      /* stockage indisponible : l'onglet n'est simplement pas mémorisé */
    }
  }

  protected readonly all = computed(() => [...this.data().strength].sort((a, b) => a.date.localeCompare(b.date)));
  protected readonly from = computed(() => addDays(startOfWeek(this.today), -7 * (this.weeks() - 1)));
  protected readonly period = computed(() => this.all().filter((s) => s.date >= this.from()));
  private readonly previous = computed(() => this.all().filter((s) => s.date >= addDays(this.from(), -7 * this.weeks()) && s.date < this.from()));

  protected async onFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const { sessions, added } = mergeSessions(this.data().strength, parseHevyCsv(await file.text()));
      this.store.update((d) => ({ ...d, strength: sessions }));
      this.message.set({ text: `${added} nouvelle${added > 1 ? 's' : ''} séance${added > 1 ? 's' : ''} importée${added > 1 ? 's' : ''} (${sessions.length} au total).`, error: false });
    } catch (err) {
      this.message.set({ text: err instanceof Error ? err.message : 'Import impossible', error: true });
    }
    input.value = '';
  }

  // --- Aperçu ---
  private static sum(list: StrengthSession[], f: (s: StrengthSession) => number) {
    return list.reduce((n, s) => n + f(s), 0);
  }
  protected readonly volume = computed(() => Strength.sum(this.period(), sessionVolume));
  private readonly prevVolume = computed(() => Strength.sum(this.previous(), sessionVolume));
  protected readonly sets = computed(() => Strength.sum(this.period(), sessionSets));
  protected readonly reps = computed(() => Strength.sum(this.period(), sessionReps));
  protected readonly timed = computed(() => this.period().filter((s) => s.minutes));
  protected readonly minutes = computed(() => Strength.sum(this.timed(), (s) => s.minutes ?? 0));
  protected readonly timedVolume = computed(() => Strength.sum(this.timed(), sessionVolume));
  protected readonly volumeDelta = computed(() => (this.prevVolume() > 0 ? ((this.volume() - this.prevVolume()) / this.prevVolume()) * 100 : null));

  private readonly weekly = computed(() => weeklyVolume(this.all(), this.today, this.weeks()));
  private readonly muscleWeeks = computed(() => weeklyMuscleLoad(this.all(), this.today, this.weeks()));
  protected readonly volumeChart = computed(() => {
    const labels = this.weekly().map((w) => fmtShort(w.week));
    if (this.volumeBy() === 'total') {
      return { labels, datasets: [{ type: 'bar' as const, label: 'Volume', data: this.weekly().map((w) => round(w.volume)), backgroundColor: COLORS.intake, borderRadius: 4 }] };
    }
    const groups = MUSCLE_GROUPS.filter((g) => this.muscleWeeks().some((w) => w.volume[g] > 0));
    return {
      labels,
      datasets: groups.map((g) => ({ type: 'bar' as const, label: g, data: this.muscleWeeks().map((w) => round(w.volume[g])), backgroundColor: MUSCLE_COLORS[g] })),
    };
  });

  // --- Progression ---
  protected readonly names = computed(() => exerciseNames(this.all()));
  protected readonly selected = computed(() => {
    const [e, names] = [this.exercise(), this.names()];
    return e && names.includes(e) ? e : names[0];
  });
  protected readonly history = computed(() => exerciseHistory(this.all(), this.selected()));
  protected readonly last = computed(() => this.history()[this.history().length - 1]);
  protected readonly gain = computed(() => {
    const [first, last] = [this.history()[0], this.last()];
    return first && last && first.e1rm > 0 ? ((last.e1rm - first.e1rm) / first.e1rm) * 100 : null;
  });
  protected readonly bodyweightOnly = computed(() => this.history().every((p) => p.maxWeight === 0));
  protected readonly recs = computed(() => records(this.all()));

  protected readonly progressChart = computed(() => {
    const history = this.history();
    let best = 0;
    const isRecord = history.map((p, i) => {
      const record = i > 0 && p.e1rm > best;
      best = Math.max(best, p.e1rm);
      return record;
    });
    const labels = history.map((p) => fmtShort(p.date));
    const style = (color: string, width = 2) => ({ borderColor: color, backgroundColor: color, borderWidth: width, tension: 0.3 });
    if (this.bodyweightOnly()) {
      return { labels, datasets: [{ type: 'line' as const, label: 'Volume', data: history.map((p) => round(p.volume)), pointRadius: 3, ...style(COLORS.burned) }] };
    }
    return {
      labels,
      datasets: [
        {
          type: 'line' as const,
          label: '1RM estimé',
          data: history.map((p) => round(p.e1rm, 1)),
          pointStyle: isRecord.map((r) => (r ? 'star' : 'circle')),
          pointRadius: isRecord.map((r) => (r ? 9 : 3)),
          pointBackgroundColor: isRecord.map((r) => (r ? '#e0a400' : COLORS.burned)),
          pointBorderColor: isRecord.map((r) => (r ? '#e0a400' : COLORS.burned)),
          ...style(COLORS.burned),
        },
        { type: 'line' as const, label: 'Charge max', data: history.map((p) => p.maxWeight), pointRadius: 0, ...style(COLORS.weight) },
      ],
    };
  });
  protected readonly progressLook = computed(() => (this.bodyweightOnly() ? { legend: true, tight: true } : { legend: true, tight: true, unit: 'kg' }));

  protected selectExercise(name: string) {
    this.exercise.set(name);
    this.detail()?.nativeElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // --- Muscles ---
  protected readonly zones = computed(() => repZones(this.period()));
  protected readonly zonesTotal = computed(() => this.zones().strength + this.zones().hypertrophy + this.zones().endurance);
}
