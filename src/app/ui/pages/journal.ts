import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { dayTotals } from '../../application/dailySummary';
import { weightOn } from '../../body/domain/weight';
import type { Food } from '../../nutrition/domain/food';
import { type LogItem, type MealType, MEALS } from '../../nutrition/domain/meal';
import { MACROS, portionNutrients, sumNutrients } from '../../nutrition/domain/nutrients';
import { FoodPicker } from '../../nutrition/ui/food-picker';
import { addDays, fmtDate, todayISO } from '../../shared/kernel/dates';
import { uid } from '../../shared/kernel/id';
import { num, round } from '../../shared/kernel/numbers';
import { strengthKcal, strengthMinutes } from '../../training/domain/energy';
import { sessionSets, sessionVolume } from '../../training/domain/strength';
import { CardioForm } from '../../training/ui/cardio-form';
import { DateField } from '../shared/date-field';
import { Dialogs } from '../shared/dialogs';
import { DaySummary } from '../shared/day-summary';
import { queryParam } from '../shared/query-param';
import { Store } from '../state/store';

/** Saisie libre d'un plat dont on ne connaît que les macros (restaurant, etc.) ; seules les calories sont obligatoires. */
@Component({
  selector: 'app-quick-add',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './quick-add.html',
  host: { style: 'display: block; max-width: 100%' },
})
export class QuickAdd {
  readonly add = output<{ name: string; kcal: number; carbs: number; fat: number; protein: number }>();
  protected readonly open = signal(false);
  protected readonly name = signal('');
  protected readonly kcal = signal('');
  protected readonly carbs = signal('');
  protected readonly fat = signal('');
  protected readonly protein = signal('');

  protected submit() {
    const k = num(this.kcal());
    const [carbs, fat, protein] = [this.carbs(), this.fat(), this.protein()].map((v) => (v.trim() ? num(v) : 0));
    if (!this.name().trim() || !(k >= 0) || !(carbs >= 0) || !(fat >= 0) || !(protein >= 0)) return;
    this.add.emit({ name: this.name().trim(), kcal: k, carbs, fat, protein });
    this.name.set('');
    this.kcal.set('');
    this.carbs.set('');
    this.fat.set('');
    this.protein.set('');
    this.open.set(false);
  }
}

@Component({
  selector: 'app-workouts',
  imports: [MatButtonModule, MatCardModule, CardioForm],
  templateUrl: './workouts.html',
})
export class Workouts {
  private readonly store = inject(Store);
  readonly date = input.required<string>();
  protected readonly totals = computed(() => dayTotals(this.store.data(), this.date()));
  protected readonly round = round;
  protected readonly sets = sessionSets;
  protected readonly volume = sessionVolume;
  protected readonly minutes = strengthMinutes;

  protected kcal(s: Parameters<typeof strengthKcal>[0]) {
    return strengthKcal(s, weightOn(this.store.data().weights, this.date()));
  }

  protected removeWorkout(id: string) {
    this.store.update((s) => ({ ...s, workouts: s.workouts.filter((x) => x.id !== id) }));
  }
}

@Component({
  selector: 'app-journal',
  imports: [MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, DateField, DaySummary, FoodPicker, QuickAdd, Workouts],
  templateUrl: './journal.html',
})
export class Journal {
  private readonly store = inject(Store);
  private readonly dialogs = inject(Dialogs);
  private readonly param = queryParam('d');
  protected readonly data = this.store.data;
  protected readonly meals = MEALS;
  protected readonly macros = MACROS;
  protected readonly today = todayISO();
  protected readonly round = round;

  protected readonly date = computed(() => this.param.value() ?? todayISO());
  protected readonly title = computed(() => fmtDate(this.date()));
  protected readonly totals = computed(() => dayTotals(this.data(), this.date()));

  protected setDate(d: string) {
    if (d) this.param.set(d);
  }

  protected shift(days: number) {
    return addDays(this.date(), days);
  }

  protected items(meal: MealType) {
    return this.totals().items.filter((i) => i.meal === meal);
  }

  protected nutrients(meal: MealType) {
    return sumNutrients(this.items(meal));
  }

  protected kcal(meal: MealType) {
    return this.nutrients(meal).kcal;
  }

  protected hasFoods(meal: MealType) {
    return this.items(meal).some((i) => i.foodId);
  }

  private addItems(items: Omit<LogItem, 'id' | 'date'>[]) {
    const date = this.date();
    this.store.update((d) => ({ ...d, log: [...d.log, ...items.map((i) => ({ ...i, id: uid(), date }))] }));
  }

  private fromFood(meal: MealType, food: Food, quantity: number): Omit<LogItem, 'id' | 'date'> {
    return { meal, foodId: food.id, name: food.name, quantity, unit: food.unit, ...portionNutrients(food, quantity) };
  }

  protected addFood(meal: MealType, food: Food, quantity: number) {
    this.addItems([this.fromFood(meal, food, quantity)]);
  }

  protected addQuick(meal: MealType, e: { name: string; kcal: number; carbs: number; fat: number; protein: number }) {
    this.addItems([{ meal, quantity: 1, unit: 'unité', ...e }]);
  }

  protected pickTemplate(meal: MealType, e: Event) {
    const select = e.target as HTMLSelectElement;
    const tpl = this.data().templates.find((t) => t.id === select.value);
    select.value = '';
    if (!tpl) return;
    this.addItems(
      tpl.items.flatMap((p) => {
        const food = this.data().foods.find((f) => f.id === p.foodId);
        return food ? [this.fromFood(meal, food, p.quantity)] : [];
      }),
    );
  }

  protected async saveAsTemplate(meal: MealType) {
    const name = await this.dialogs.prompt('Nom du repas type :');
    if (!name?.trim()) return;
    const portions = this.items(meal)
      .filter((i) => i.foodId)
      .map((i) => ({ foodId: i.foodId!, quantity: i.quantity }));
    this.store.update((d) => ({ ...d, templates: [...d.templates, { id: uid(), name: name.trim(), items: portions }] }));
  }

  protected remove(id: string) {
    this.store.update((d) => ({ ...d, log: d.log.filter((i) => i.id !== id) }));
  }
}
