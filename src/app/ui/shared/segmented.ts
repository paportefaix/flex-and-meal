import { Component, input, model } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

export interface SegmentOption<T> {
  value: T;
  label: string;
}

/** Choix exclusif parmi quelques options (période, unité, filtre…), en boutons Material. */
@Component({
  selector: 'app-segmented',
  imports: [MatButtonToggleModule],
  templateUrl: './segmented.html',
})
export class Segmented<T> {
  readonly options = input.required<SegmentOption<T>[]>();
  readonly label = input('');
  readonly value = model.required<T>();
}
