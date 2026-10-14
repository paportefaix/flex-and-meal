import { Component, computed, input, model } from '@angular/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { parseISO, toISO } from '../../shared/kernel/dates';

/** Champ de date (jj/mm/aaaa) avec sélecteur Material ; la valeur échangée est une date ISO `YYYY-MM-DD`. */
@Component({
  selector: 'app-date-field',
  imports: [MatFormFieldModule, MatInputModule, MatDatepickerModule],
  templateUrl: './date-field.html',
})
export class DateField {
  readonly value = model('');
  readonly required = input(false);
  readonly label = input('Date');
  protected readonly date = computed(() => (this.value() ? parseISO(this.value()) : null));

  protected change(d: Date | null) {
    if (d) this.value.set(toISO(d));
  }
}
