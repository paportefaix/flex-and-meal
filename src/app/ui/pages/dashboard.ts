import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { dayTotals } from '../../application/dailySummary';
import { addDays, byDate, fmtDate, fmtDay, fmtShort, todayISO } from '../../shared/kernel/dates';
import { round, signed } from '../../shared/kernel/numbers';
import { sessionSets, sessionVolume, weeklyVolume } from '../../training/domain/strength';
import { AppChart, COLORS, goalLine } from '../shared/chart';
import { DaySummary, Stat } from '../shared/day-summary';
import { Store } from '../state/store';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, MatCardModule, Stat, DaySummary, AppChart],
  templateUrl: './dashboard.html',
})
export class Dashboard {
  protected readonly data = inject(Store).data;
  protected readonly today = todayISO();
  protected readonly title = fmtDate(this.today);
  protected readonly round = round;
  protected readonly signed = signed;
  protected readonly fmtShort = fmtShort;
  protected readonly volume = sessionVolume;
  protected readonly sets = sessionSets;

  protected readonly goal = computed(() => this.data().settings.kcalGoal);
  protected readonly totals = computed(() => dayTotals(this.data(), this.today));
  private readonly last7 = computed(() =>
    Array.from({ length: 7 }, (_, i) => addDays(this.today, i - 6)).map((date) => ({ date, ...dayTotals(this.data(), date) })),
  );
  protected readonly avg7 = computed(() => {
    const logged = this.last7().filter((d) => d.hasEntries);
    return logged.length ? logged.reduce((s, d) => s + d.intake.kcal, 0) / logged.length : 0;
  });
  protected readonly sessions7 = computed(() => this.last7().reduce((s, d) => s + d.sessions, 0));
  protected readonly kcalChart = computed(() => {
    const labels = this.last7().map((d) => fmtDay(d.date));
    return {
      labels,
      datasets: [
        goalLine(labels, this.goal()),
        { type: 'bar' as const, label: 'Consommées', data: this.last7().map((d) => round(d.intake.kcal)), backgroundColor: COLORS.intake, borderRadius: 4 },
      ],
    };
  });

  protected readonly lastSession = computed(() => [...this.data().strength].sort((a, b) => b.date.localeCompare(a.date))[0]);
  protected readonly thisWeek = computed(() => weeklyVolume(this.data().strength, this.today, 1)[0]);

  private readonly weights = computed(() => [...this.data().weights].sort(byDate));
  protected readonly recentWeights = computed(() => this.weights().filter((w) => w.date >= addDays(this.today, -90)));
  protected readonly lastWeight = computed(() => this.weights()[this.weights().length - 1]);
  protected readonly monthAgo = computed(() => [...this.weights()].reverse().find((w) => w.date <= addDays(this.today, -30)));
  protected readonly weightChart = computed(() => ({
    labels: this.recentWeights().map((w) => fmtShort(w.date)),
    datasets: [
      {
        label: 'Poids',
        data: this.recentWeights().map((w) => w.weight),
        borderColor: COLORS.weight,
        backgroundColor: COLORS.weight,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
      },
    ],
  }));
}
