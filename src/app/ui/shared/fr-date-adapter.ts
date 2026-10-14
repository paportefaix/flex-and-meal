import { Injectable, type Provider } from '@angular/core';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE, MAT_NATIVE_DATE_FORMATS, NativeDateAdapter } from '@angular/material/core';

/** Adaptateur de dates natif qui lit les saisies au format français jj/mm/aaaa (et non mm/jj/aaaa). */
@Injectable()
export class FrDateAdapter extends NativeDateAdapter {
  override parse(value: unknown, parseFormat?: unknown): Date | null {
    if (typeof value === 'string') {
      const m = /^\s*(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{2}|\d{4})\s*$/.exec(value);
      if (!m) return value.trim() ? this.invalid() : null;
      const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      const d = new Date(year, Number(m[2]) - 1, Number(m[1]));
      // Refuse 31/02 et autres dates qui « débordent » sur le mois suivant.
      return d.getDate() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 ? d : this.invalid();
    }
    return super.parse(value, parseFormat);
  }
}

/** Sélecteur de dates Material en français (locale fr-FR, saisie jj/mm/aaaa). */
export const provideFrDateAdapter = (): Provider[] => [
  { provide: MAT_DATE_LOCALE, useValue: 'fr-FR' },
  { provide: DateAdapter, useClass: FrDateAdapter, deps: [MAT_DATE_LOCALE] },
  { provide: MAT_DATE_FORMATS, useValue: MAT_NATIVE_DATE_FORMATS },
];
