import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import { dayTotals } from '../../application/dailySummary';
import { MACROS } from '../../nutrition/domain/nutrients';
import { addDays, byDate, fmtDate, fmtDay, startOfWeek, todayISO, weekDays } from '../../shared/kernel/dates';
import { round, signed } from '../../shared/kernel/numbers';
import { sessionVolume } from '../../training/domain/strength';
import { AppChart, COLORS, goalLine } from '../shared/chart';
import { Stat } from '../shared/day-summary';
import { queryParam } from '../shared/query-param';
import { Store } from '../state/store';

@Component({
  selector: 'app-week',
  imports: [RouterLink, MatButtonModule, MatCardModule, Stat, AppChart],
  templateUrl: './week.html',
})
export class Week {
  private readonly data = inject(Store).data;
  private readonly param = queryParam('w');
  protected readonly today = todayISO();
  protected readonly thisWeekStart = startOfWeek(this.today);
  protected readonly round = round;
  protected readonly signed = signed;
  protected readonly fmtDay = fmtDay;

  protected readonly start = computed(() => startOfWeek(this.param.value() ?? this.today));
  protected readonly goal = computed(() => this.data().settings.kcalGoal);
  protected readonly days = computed(() => weekDays(this.start()).map((date) => ({ date, ...dayTotals(this.data(), date) })));
  protected readonly logged = computed(() => this.days().filter((d) => d.hasEntries));
  protected readonly range = computed(() => {
    const end = addDays(this.start(), 6);
    return `${fmtDate(this.start(), { day: 'numeric', month: 'short' })} – ${fmtDate(end, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  });

  private avg(f: (d: ReturnType<Week['days']>[number]) => number) {
    const logged = this.logged();
    return logged.length ? logged.reduce((s, d) => s + f(d), 0) / logged.length : 0;
  }

  protected readonly avgIntake = computed(() => this.avg((d) => d.intake.kcal));
  protected readonly avgNet = computed(() => this.avg((d) => d.net));
  // Écart cumulé à l'objectif sur les jours saisis (négatif = déficit).
  protected readonly balance = computed(() => this.logged().reduce((s, d) => s + d.net - this.goal(), 0));
  protected readonly minutes = computed(() => this.days().reduce((s, d) => s + d.minutes, 0));
  protected readonly sessions = computed(() => this.days().reduce((s, d) => s + d.sessions, 0));
  protected readonly strengthSessions = computed(() => this.days().flatMap((d) => d.strength));
  protected readonly strengthUnit = computed(() => {
    const volume = this.strengthSessions().reduce((v, x) => v + sessionVolume(x), 0);
    const burned = this.days().reduce((v, d) => v + d.strengthBurned, 0);
    return `${round(volume / 1000, 1).toLocaleString('fr-FR')} t · ~${round(burned)} kcal`;
  });
  protected readonly weightDelta = computed(() => {
    const end = addDays(this.start(), 6);
    const weights = this.data().weights.filter((w) => w.date >= this.start() && w.date <= end).sort(byDate);
    return weights.length >= 2 ? weights[weights.length - 1].weight - weights[0].weight : null;
  });

  protected readonly macros = computed(() =>
    MACROS.map((m) => {
      const target = this.data().settings[m.goalKey];
      const value = this.avg((d) => d.intake[m.key]);
      const tone: 'good' | 'bad' | undefined = target && this.logged().length ? (value >= target * 0.95 && value <= target * 1.1 ? 'good' : 'bad') : undefined;
      return { key: m.key, label: target ? `${m.label} (objectif ${target} g)` : m.label, value, tone };
    }),
  );

  protected readonly chart = computed(() => {
    const labels = this.days().map((d) => fmtDay(d.date));
    return {
      labels,
      datasets: [
        goalLine(labels, this.goal()),
        { type: 'bar' as const, label: 'Consommées', data: this.days().map((d) => round(d.intake.kcal)), backgroundColor: COLORS.intake, borderRadius: 4 },
        { type: 'bar' as const, label: 'Sport', data: this.days().map((d) => round(d.burned)), backgroundColor: COLORS.burned, borderRadius: 4 },
      ],
    };
  });

  protected setStart(w: string) {
    this.param.set(w);
  }

  protected shift(days: number) {
    this.setStart(addDays(this.start(), days));
  }
}
