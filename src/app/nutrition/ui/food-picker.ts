import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { num, round } from '../../shared/kernel/numbers';
import { Store } from '../../ui/state/store';
import type { Food } from '../domain/food';
import { portionNutrients } from '../domain/nutrients';
import { FoodSearch } from './food-search';

/** Sélection d'un aliment (base perso ou Open Food Facts) + quantité. */
@Component({
  selector: 'app-food-picker',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, FoodSearch],
  templateUrl: './food-picker.html',
})
export class FoodPicker {
  private readonly store = inject(Store);
  readonly add = output<{ food: Food; quantity: number }>();

  protected readonly name = signal('');
  protected readonly qty = signal('');
  protected readonly picked = signal<Food | null>(null);

  protected readonly food = computed(
    () => this.picked() ?? this.store.data().foods.find((f) => f.name.toLowerCase() === this.name().trim().toLowerCase()),
  );
  private readonly q = computed(() => num(this.qty()));
  protected readonly valid = computed(() => !!this.food() && this.q() > 0);
  protected readonly preview = computed(() => {
    const f = this.food();
    return this.valid() && f ? `${round(portionNutrients(f, this.q()).kcal)} kcal` : (f?.unit ?? '');
  });

  protected rename(v: string) {
    this.name.set(v);
    this.picked.set(null);
  }

  protected choose(f: Food) {
    // Enregistré dans la base perso pour pouvoir être référencé (repas types) et réutilisé.
    if (!this.store.data().foods.some((x) => x.id === f.id)) this.store.update((d) => ({ ...d, foods: [...d.foods, f] }));
    this.picked.set(f);
    this.name.set(f.name);
  }

  protected submit() {
    const food = this.food();
    if (!this.valid() || !food) return;
    this.add.emit({ food, quantity: this.q() });
    this.name.set('');
    this.qty.set('');
    this.picked.set(null);
  }
}
