import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { round } from '../../shared/kernel/numbers';
import { Store } from '../../ui/state/store';
import type { Food } from '../domain/food';
import { searchLocal, type LocalResult } from '../infrastructure/localSearch';
import { offToFood, searchOpenFoodFacts, type Level, type OffResult } from '../infrastructure/openFoodFacts';

type Source = 'local' | 'online';

const LEVELS: Record<Level, { label: string; cls: string }> = {
  raw: { label: 'Brut', cls: 'raw' },
  processed: { label: 'Transformé', cls: 'processed' },
  ultra: { label: 'Ultra-transformé', cls: 'ultra' },
  unknown: { label: 'Inconnu', cls: 'unknown' },
};

/** Sans les champs propres à la table CIQUAL. */
const plain = ({ id, name, unit, kcal, protein, carbs, fat }: Food): Food => ({ id, name, unit, kcal, protein, carbs, fat });

/**
 * Recherche d'aliment pour `query` : dans la base locale (mes aliments + CIQUAL)
 * ou sur Open Food Facts (pastille de transformation, marque, filtre « bruts »).
 */
@Component({
  selector: 'app-food-search',
  imports: [MatButtonModule, MatButtonToggleModule, MatCheckboxModule],
  templateUrl: './food-search.html',
})
export class FoodSearch {
  private readonly data = inject(Store).data;
  readonly query = input.required<string>();
  readonly minLength = input(2);
  readonly picked = output<Food>();

  protected readonly source = signal<Source>('local');
  protected readonly rawOnly = signal(false);
  protected readonly local = signal<LocalResult[]>([]);
  protected readonly online = signal<OffResult[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  protected readonly levels = LEVELS;
  protected readonly plain = plain;
  protected readonly offToFood = offToFood;
  private readonly q = computed(() => this.query().trim());
  protected readonly active = computed(() => this.q().length >= this.minLength());
  protected readonly shownOnline = computed(() => (this.rawOnly() ? this.online().filter((r) => r.level === 'raw') : this.online()));

  constructor() {
    effect((onCleanup) => {
      const q = this.q();
      const source = this.source();
      const foods = this.data().foods;
      if (!this.active()) {
        this.local.set([]);
        this.online.set([]);
        this.error.set('');
        this.loading.set(false);
        return;
      }
      const ctrl = new AbortController();
      this.loading.set(true);
      this.error.set('');
      const t = setTimeout(
        async () => {
          try {
            if (source === 'local') this.local.set(await searchLocal(q, foods));
            else this.online.set(await searchOpenFoodFacts(q, ctrl.signal));
          } catch (e) {
            if ((e as DOMException).name === 'AbortError') return;
            this.error.set(source === 'local' ? 'Base CIQUAL indisponible.' : 'Recherche en ligne indisponible, réessayez plus tard.');
          }
          this.loading.set(false);
        },
        source === 'local' ? 120 : 400,
      );
      onCleanup(() => {
        clearTimeout(t);
        ctrl.abort();
      });
    });
  }

  protected macros(f: Food) {
    return `${round(f.kcal)} kcal · P ${f.protein ?? '–'} / G ${f.carbs ?? '–'} / L ${f.fat ?? '–'} (100 g)`;
  }
}
