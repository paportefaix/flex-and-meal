export type MeasureKey = 'chest' | 'underbust' | 'waist' | 'waistAboveNavel' | 'loveHandles' | 'glutes';

export interface Measurement {
  id: string;
  date: string;
  values: Partial<Record<MeasureKey, number>>;
}

export const MEASURES: { key: MeasureKey; label: string }[] = [
  { key: 'chest', label: 'Poitrine' },
  { key: 'underbust', label: 'Sous poitrine' },
  { key: 'waist', label: 'Taille' },
  { key: 'waistAboveNavel', label: 'Taille au-dessus du nombril' },
  { key: 'loveHandles', label: "Poignées d'amour" },
  { key: 'glutes', label: 'Fesses' },
];
