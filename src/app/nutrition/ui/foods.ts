import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { uid } from '../../shared/kernel/id';
import { num, round } from '../../shared/kernel/numbers';
import { Dialogs } from '../../ui/shared/dialogs';
import { Store } from '../../ui/state/store';
import { type Food, type Unit, unitBasis, UNITS } from '../domain/food';
import { FoodSearch } from './food-search';

type Draft = { name: string; unit: Unit; kcal: string; protein: string; carbs: string; fat: string };
const EMPTY: Draft = { name: '', unit: 'g', kcal: '', protein: '', carbs: '', fat: '' };
const toDraft = (f: Food): Draft => ({
  name: f.name,
  unit: f.unit,
  kcal: String(f.kcal),
  protein: f.protein?.toString() ?? '',
  carbs: f.carbs?.toString() ?? '',
  fat: f.fat?.toString() ?? '',
});
const optional = (s: string) => (s.trim() === '' || isNaN(num(s)) ? undefined : num(s));

@Component({
  selector: 'app-foods',
  imports: [FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, FoodSearch],
  templateUrl: './foods.html',
})
export class Foods {
  private readonly store = inject(Store);
  private readonly dialogs = inject(Dialogs);

  protected readonly units = UNITS;
  protected readonly unitBasis = unitBasis;
  protected readonly round = round;
  protected readonly draft = signal<Draft>(EMPTY);
  protected readonly editingId = signal<string | null>(null);
  protected readonly search = signal('');
  // La recherche est coupée après sélection d'un résultat, et reprend dès que le nom est modifié.
  protected readonly suppressed = signal(false);

  protected readonly foods = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.store.data().foods.filter((f) => f.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  });

  protected pick(f: Food) {
    this.suppressed.set(true);
    this.draft.set(toDraft(f));
  }

  protected rename(name: string) {
    this.suppressed.set(false);
    this.set('name', name);
  }

  protected set(k: keyof Draft, v: string) {
    this.draft.update((d) => ({ ...d, [k]: v }));
  }

  protected edit(f: Food) {
    this.editingId.set(f.id);
    this.draft.set(toDraft(f));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected cancel() {
    this.editingId.set(null);
    this.draft.set(EMPTY);
  }

  protected submit() {
    const draft = this.draft();
    const editingId = this.editingId();
    const kcal = num(draft.kcal);
    if (!draft.name.trim() || !(kcal >= 0)) return;
    const food: Food = {
      id: editingId ?? uid(),
      name: draft.name.trim(),
      unit: draft.unit,
      kcal,
      protein: optional(draft.protein),
      carbs: optional(draft.carbs),
      fat: optional(draft.fat),
    };
    this.store.update((d) => ({ ...d, foods: editingId ? d.foods.map((f) => (f.id === editingId ? food : f)) : [...d.foods, food] }));
    this.cancel();
  }

  protected async remove(food: Food) {
    const used = this.store.data().templates.filter((t) => t.items.some((i) => i.foodId === food.id));
    const msg = used.length
      ? `« ${food.name} » est utilisé dans ${used.length} repas type(s), il en sera retiré. Supprimer ?`
      : `Supprimer « ${food.name} » ?`;
    if (!(await this.dialogs.confirm(msg))) return;
    this.store.update((d) => ({
      ...d,
      foods: d.foods.filter((f) => f.id !== food.id),
      templates: d.templates.map((t) => ({ ...t, items: t.items.filter((i) => i.foodId !== food.id) })),
    }));
  }
}
