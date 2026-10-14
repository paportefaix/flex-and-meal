import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { weightOn } from '../../body/domain/weight';
import { uid } from '../../shared/kernel/id';
import { num } from '../../shared/kernel/numbers';
import { Store } from '../../ui/state/store';
import { CARDIO_ACTIVITIES, cardioKcal } from '../domain/energy';

/**
 * Saisie d'une séance de cardio (ou de toute activité) : durée, distance facultative et calories.
 * Les calories laissées vides sont estimées (MET × poids × durée) pour les activités de la liste.
 */
@Component({
  selector: 'app-cardio-form',
  imports: [FormsModule, MatAutocompleteModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './cardio-form.html',
})
export class CardioForm {
  private readonly store = inject(Store);
  readonly date = input.required<string>();

  protected readonly activity = signal('');
  protected readonly duration = signal('');
  protected readonly distance = signal('');
  protected readonly kcal = signal('');

  protected readonly activities = computed(() => [
    ...new Set([...CARDIO_ACTIVITIES.map((a) => a.name), ...this.store.data().workouts.map((w) => w.activity)]),
  ]);
  private readonly minutes = computed(() => num(this.duration()));
  protected readonly estimate = computed(() =>
    this.minutes() > 0 ? cardioKcal(this.activity(), this.minutes(), weightOn(this.store.data().weights, this.date())) : null,
  );

  protected submit() {
    const minutes = this.minutes();
    const activity = this.activity().trim();
    if (!activity || !(minutes > 0)) return;
    const km = num(this.distance());
    const burned = num(this.kcal()) || this.estimate() || 0;
    const date = this.date();
    this.store.update((s) => ({
      ...s,
      workouts: [...s.workouts, { id: uid(), date, activity, duration: minutes, kcal: burned, ...(km > 0 ? { distanceKm: km } : {}) }],
    }));
    this.activity.set('');
    this.duration.set('');
    this.distance.set('');
    this.kcal.set('');
  }
}
