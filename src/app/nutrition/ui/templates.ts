import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import type { AppData } from '../../application/appData';
import { uid } from '../../shared/kernel/id';
import { num, round } from '../../shared/kernel/numbers';
import { Dialogs } from '../../ui/shared/dialogs';
import { Store } from '../../ui/state/store';
import type { Food } from '../domain/food';
import type { MealTemplate, Portion } from '../domain/meal';
import { portionNutrients, sumNutrients } from '../domain/nutrients';
import { FoodPicker } from './food-picker';

const templateNutrients = (data: AppData, items: Portion[]) =>
  sumNutrients(
    items.flatMap((p) => {
      const food = data.foods.find((f) => f.id === p.foodId);
      return food ? [portionNutrients(food, p.quantity)] : [];
    }),
  );

@Component({
  selector: 'app-templates',
  imports: [FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, FoodPicker],
  templateUrl: './templates.html',
})
export class Templates {
  private readonly store = inject(Store);
  private readonly dialogs = inject(Dialogs);
  protected readonly data = this.store.data;
  protected readonly draft = signal<MealTemplate | null>(null);
  protected readonly round = round;
  protected readonly newId = uid;

  protected readonly isExisting = computed(() => this.data().templates.some((t) => t.id === this.draft()?.id));
  protected readonly total = computed(() => templateNutrients(this.data(), this.draft()?.items ?? []));

  protected nutrients(t: MealTemplate) {
    return templateNutrients(this.data(), t.items);
  }

  protected foodOf(p: Portion) {
    return this.data().foods.find((f) => f.id === p.foodId);
  }

  protected kcalOf(food: Food, quantity: number) {
    return portionNutrients(food, quantity).kcal;
  }

  protected summary(t: MealTemplate) {
    return t.items
      .map((p) => {
        const f = this.foodOf(p);
        return f ? `${f.name} (${round(p.quantity, 1)} ${f.unit})` : null;
      })
      .filter(Boolean)
      .join(' · ');
  }

  protected clone(t: MealTemplate): MealTemplate {
    return structuredClone(t);
  }

  protected rename(name: string) {
    this.draft.update((d) => d && { ...d, name });
  }

  private setItems(items: Portion[]) {
    this.draft.update((d) => d && { ...d, items });
  }

  protected setQuantity(idx: number, value: string) {
    const q = num(value);
    const d = this.draft();
    if (d && q > 0) this.setItems(d.items.map((x, i) => (i === idx ? { ...x, quantity: q } : x)));
  }

  protected addItem(food: Food, quantity: number) {
    const d = this.draft();
    if (d) this.setItems([...d.items, { foodId: food.id, quantity }]);
  }

  protected removeItem(idx: number) {
    const d = this.draft();
    if (d) this.setItems(d.items.filter((_, i) => i !== idx));
  }

  protected save() {
    const d = this.draft();
    if (!d || !d.name.trim()) return;
    const tpl = { ...d, name: d.name.trim() };
    this.store.update((s) => ({
      ...s,
      templates: s.templates.some((t) => t.id === tpl.id) ? s.templates.map((t) => (t.id === tpl.id ? tpl : t)) : [...s.templates, tpl],
    }));
    this.draft.set(null);
  }

  protected async remove(t: MealTemplate) {
    if (await this.dialogs.confirm(`Supprimer le repas type « ${t.name} » ?`)) {
      this.store.update((d) => ({ ...d, templates: d.templates.filter((x) => x.id !== t.id) }));
    }
  }
}
