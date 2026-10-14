import { Component, computed, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import { computeInsights, WEEKDAYS, type DayStatus } from '../../application/insights';
import { MACROS } from '../../nutrition/domain/nutrients';
import { fmtDate, todayISO } from '../../shared/kernel/dates';
import { round } from '../../shared/kernel/numbers';
import { AppChart, COLORS, goalLine } from '../shared/chart';
import { Stat } from '../shared/day-summary';
import { Store } from '../state/store';

const STATUS_LABEL: Record<DayStatus, string> = {
  none: 'Non renseigné',
  under: 'Sous la cible',
  on: 'Dans la cible',
  over: 'Au-dessus',
};

@Component({
  selector: 'app-insights',
  imports: [RouterLink, MatCardModule, Stat, AppChart],
  templateUrl: './insights.html',
})
export class Insights {
  protected readonly data = inject(Store).data;
  protected readonly i = computed(() => computeInsights(this.data(), todayISO()));
  protected readonly macros = MACROS;
  protected readonly weekdays = WEEKDAYS;
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly statuses: DayStatus[] = ['under', 'on', 'over', 'none'];
  protected readonly round = round;
  protected readonly fmtDate = fmtDate;

  protected readonly weekdayChart = computed(() => {
    const labels = this.i().byWeekday.map((d) => d.label.slice(0, 3));
    return {
      labels,
      datasets: [
        goalLine(labels, this.data().settings.kcalGoal),
        { type: 'bar' as const, label: 'Moyenne', data: this.i().byWeekday.map((d) => d.kcal), backgroundColor: COLORS.intake, borderRadius: 4 },
      ],
    };
  });
}
