import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { byDate, fmtShort, todayISO } from '../../shared/kernel/dates';
import { uid } from '../../shared/kernel/id';
import { num, round, signed } from '../../shared/kernel/numbers';
import { AppChart, COLORS, goalLine } from '../../ui/shared/chart';
import { DateField } from '../../ui/shared/date-field';
import { Stat } from '../../ui/shared/day-summary';
import { Store } from '../../ui/state/store';
import { type MeasureKey, MEASURES } from '../domain/measurement';
import { BodyDiagram } from './body-diagram';

@Component({
  selector: 'app-weight-section',
  imports: [FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, AppChart, DateField, Stat],
  templateUrl: './weight-section.html',
})
export class WeightSection {
  private readonly store = inject(Store);
  protected readonly round = round;
  protected readonly signed = signed;
  protected readonly fmtShort = fmtShort;
  protected readonly max0 = (n: number) => Math.max(0, n);

  protected readonly date = signal(todayISO());
  protected readonly weight = signal('');
  protected readonly settings = computed(() => this.store.data().settings);

  protected readonly weights = computed(() => [...this.store.data().weights].sort(byDate));
  protected readonly reversed = computed(() => [...this.weights()].reverse());
  protected readonly first = computed(() => this.weights()[0]);
  protected readonly last = computed(() => this.weights()[this.weights().length - 1]);
  protected readonly bmi = computed(() => {
    const l = this.last();
    const h = this.settings().heightCm;
    return l && h ? l.weight / (h / 100) ** 2 : null;
  });
  private readonly existing = computed(() => this.store.data().weights.find((x) => x.date === this.date())?.weight);

  protected readonly chart = computed(() => {
    const labels = this.weights().map((w) => fmtShort(w.date));
    const target = this.settings().targetWeight;
    return {
      labels,
      datasets: [
        ...(target ? [goalLine(labels, target)] : []),
        {
          type: 'line' as const,
          label: 'Poids',
          data: this.weights().map((w) => w.weight),
          borderColor: COLORS.weight,
          backgroundColor: COLORS.weight,
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.3,
        },
      ],
    };
  });
  protected readonly chartLook = computed(() => {
    const t = this.settings().targetWeight;
    const values = this.weights().map((w) => w.weight).concat(t ? [t] : []);
    return { unit: 'kg', tight: true, min: Math.floor(Math.min(...values) - 1), max: Math.ceil(Math.max(...values) + 1) };
  });

  constructor() {
    // Le champ reflète la pesée enregistrée pour la date choisie.
    effect(() => this.weight.set(this.existing()?.toString() ?? ''));
  }

  // Enregistrement automatique à la validation du champ (sortie du champ ou Entrée).
  protected save() {
    const w = num(this.weight());
    const date = this.date();
    if (!(w > 0) || w === this.existing()) return;
    // Une seule pesée par jour : on remplace celle existante.
    this.store.update((d) => ({ ...d, weights: [...d.weights.filter((x) => x.date !== date), { id: uid(), date, weight: w }] }));
  }

  protected remove(id: string) {
    this.store.update((d) => ({ ...d, weights: d.weights.filter((x) => x.id !== id) }));
  }
}

@Component({
  selector: 'app-measurements-section',
  imports: [FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, AppChart, BodyDiagram, DateField, Stat],
  templateUrl: './measurements-section.html',
})
export class MeasurementsSection {
  private readonly store = inject(Store);
  protected readonly measures = MEASURES;
  protected readonly signed = signed;
  protected readonly fmtShort = fmtShort;

  protected readonly date = signal(todayISO());
  protected readonly values = signal<Partial<Record<MeasureKey, string>>>({});
  protected readonly selected = signal<MeasureKey>('waist');
  protected readonly focused = signal<MeasureKey | null>(null);

  protected readonly entries = computed(() => [...this.store.data().measurements].sort(byDate));
  protected readonly reversed = computed(() => [...this.entries()].reverse());
  private readonly entryForDate = computed(() => this.entries().find((e) => e.date === this.date()));
  protected readonly usedKeys = computed(() => MEASURES.filter((m) => this.entries().some((e) => e.values[m.key] != null)));
  protected readonly selectedLabel = computed(() => MEASURES.find((m) => m.key === this.selected())!.label);
  protected readonly series = computed(() =>
    this.entries()
      .filter((e) => e.values[this.selected()] != null)
      .map((e) => ({ name: fmtShort(e.date), cm: e.values[this.selected()]! })),
  );
  protected readonly chart = computed(() => ({
    labels: this.series().map((s) => s.name),
    datasets: [
      {
        type: 'line' as const,
        label: this.selectedLabel(),
        data: this.series().map((s) => s.cm),
        borderColor: COLORS.intake,
        backgroundColor: COLORS.intake,
        borderWidth: 2,
        pointRadius: 3,
        tension: 0.3,
      },
    ],
  }));
  protected readonly chartLook = computed(() => {
    const cm = this.series().map((s) => s.cm);
    return { unit: 'cm', tight: true, min: Math.min(...cm) - 2, max: Math.max(...cm) + 2 };
  });

  constructor() {
    // Les champs reflètent le relevé enregistré pour la date choisie.
    effect(() => {
      const entry = this.entryForDate();
      const v: Partial<Record<MeasureKey, string>> = {};
      for (const m of MEASURES) if (entry?.values[m.key] != null) v[m.key] = String(entry.values[m.key]);
      this.values.set(v);
    });
  }

  protected firstValue(k: MeasureKey) {
    return this.entries().find((e) => e.values[k] != null)?.values[k];
  }

  protected lastValue(k: MeasureKey) {
    return [...this.entries()].reverse().find((e) => e.values[k] != null)?.values[k];
  }

  protected delta(k: MeasureKey) {
    return this.lastValue(k)! - this.firstValue(k)!;
  }

  protected setValue(k: MeasureKey, v: string) {
    this.values.update((x) => ({ ...x, [k]: v }));
  }

  // Enregistrement automatique d'une mesure à la sortie du champ.
  protected saveField(key: MeasureKey) {
    const v = num(this.values()[key] ?? '');
    const date = this.date();
    if (!(v > 0) || v === this.entryForDate()?.values[key]) return;
    this.store.update((d) => {
      const existing = d.measurements.find((x) => x.date === date);
      const merged = { id: existing?.id ?? uid(), date, values: { ...existing?.values, [key]: v } };
      return { ...d, measurements: [...d.measurements.filter((x) => x.date !== date), merged] };
    });
  }

  protected blurActive() {
    (document.activeElement as HTMLElement | null)?.blur(); // déclenche l'enregistrement du champ
  }

  protected remove(id: string) {
    this.store.update((d) => ({ ...d, measurements: d.measurements.filter((x) => x.id !== id) }));
  }
}

@Component({
  selector: 'app-body',
  imports: [WeightSection, MeasurementsSection],
  templateUrl: './body.html',
})
export class Body {}
