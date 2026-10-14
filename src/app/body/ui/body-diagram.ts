import { Component, input } from '@angular/core';
import type { MeasureKey } from '../domain/measurement';

interface Site {
  key: MeasureKey;
  y: number; // hauteur de la mesure sur le schéma
  x1: number;
  x2: number;
  labelY: number; // position du numéro (à droite)
  help: string;
}

// Du haut vers le bas du corps.
const SITES: Site[] = [
  { key: 'chest', y: 100, x1: 62, x2: 138, labelY: 96, help: 'À hauteur des tétons, mètre horizontal sous les aisselles, bras relâchés.' },
  { key: 'underbust', y: 118, x1: 65, x2: 135, labelY: 112, help: 'Juste sous les pectoraux, à la base de la cage thoracique.' },
  { key: 'waistAboveNavel', y: 138, x1: 68, x2: 132, labelY: 128, help: 'Environ 2 à 3 cm au-dessus du nombril.' },
  { key: 'waist', y: 150, x1: 68, x2: 132, labelY: 144, help: 'À hauteur du nombril, à la fin d’une expiration normale (sans rentrer le ventre).' },
  { key: 'loveHandles', y: 176, x1: 65, x2: 135, labelY: 176, help: 'Juste au-dessus des os des hanches (crêtes iliaques), là où l’on pince sur le côté.' },
  { key: 'glutes', y: 206, x1: 62, x2: 138, labelY: 208, help: 'Autour de la partie la plus saillante des fesses, mètre bien horizontal.' },
];

const LABELS: Record<MeasureKey, string> = {
  chest: 'Poitrine',
  underbust: 'Sous poitrine',
  waist: 'Taille',
  waistAboveNavel: 'Taille au-dessus du nombril',
  loveHandles: "Poignées d'amour",
  glutes: 'Fesses',
};

// Demi-silhouette de gauche (miroir pour la droite).
const HALF =
  'M91,50 L89,60 Q70,64 64,72 L66,100 Q70,130 72,150 Q70,178 66,205 Q68,250 72,300 Q74,345 75,385 L64,395 L88,395 L88,340 Q90,280 96,215 L100,208 L100,50 Z';
const ARM = 'M64,72 Q52,74 50,90 L46,150 L42,192 Q48,198 54,192 L60,150 L63,110 Z';

@Component({
  selector: 'app-body-diagram',
  templateUrl: './body-diagram.html',
})
export class BodyDiagram {
  readonly active = input<MeasureKey | null>(null);
  protected readonly sites = SITES;
  protected readonly labels = LABELS;
  protected readonly half = HALF;
  protected readonly arm = ARM;
}
