import { Component, computed, input } from '@angular/core';
import { MACROS, type Nutrients } from '../../nutrition/domain/nutrients';
import type { Settings } from '../../settings/domain/settings';
import { round } from '../../shared/kernel/numbers';

/** Bloc de statistique (libellé, valeur, unité). */
@Component({
  selector: 'app-stat',
  templateUrl: './stat.html',
})
export class Stat {
  readonly label = input.required<string>();
  readonly value = input.required<number | string>();
  readonly unit = input('kcal');
  readonly tone = input<'good' | 'bad'>();
}

/** Bilan calorique d'une journée. Les calories brûlées en sport sont affichées mais ne modifient pas le restant. */
@Component({
  selector: 'app-day-summary',
  imports: [Stat],
  templateUrl: './day-summary.html',
})
export class DaySummary {
  readonly intake = input.required<Nutrients>();
  readonly burned = input.required<number>();
  readonly goal = input.required<number>();
  /** Réglages, pour afficher la progression vers les objectifs de macros. */
  readonly settings = input<Settings>();

  protected readonly macros = MACROS;
  protected readonly round = round;
  protected readonly abs = Math.abs;
  protected readonly budget = computed(() => this.goal());
  protected readonly remaining = computed(() => this.budget() - this.intake().kcal);
  protected readonly over = computed(() => this.remaining() < 0);
  protected readonly pct = computed(() => (this.budget() > 0 ? Math.min(100, (this.intake().kcal / this.budget()) * 100) : 0));
  protected readonly showMacroBars = computed(() => {
    const s = this.settings();
    return !!s && MACROS.some((m) => s[m.goalKey]);
  });

  protected target(k: 'proteinGoal' | 'carbsGoal' | 'fatGoal') {
    return this.settings()?.[k];
  }

  protected macroLabel(m: (typeof MACROS)[number]) {
    return `${m.label} : ${round(this.macroPct(m.key, m.goalKey))} % de l'objectif`;
  }

  protected macroPct(key: 'protein' | 'carbs' | 'fat', goalKey: 'proteinGoal' | 'carbsGoal' | 'fatGoal') {
    const t = this.target(goalKey);
    return t ? Math.min(100, (this.intake()[key] / t) * 100) : 0;
  }
}
