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

export function BodyDiagram({ active }: { active?: MeasureKey | null }) {
  return (
    <div className="body-diagram">
      <svg viewBox="0 0 200 410" role="img" aria-label="Schéma d'un homme montrant où prendre chaque mensuration">
        <defs>
          <g id="body-half">
            <path d={HALF} />
            <path d={ARM} />
          </g>
        </defs>
        <g fill="var(--border)" stroke="var(--muted)" strokeWidth="1.2" strokeLinejoin="round">
          <circle cx="100" cy="28" r="17" />
          <use href="#body-half" />
          <use href="#body-half" transform="translate(200,0) scale(-1,1)" />
        </g>
        {SITES.map((s, i) => {
          const on = active === s.key;
          const color = on ? 'var(--accent)' : 'var(--text)';
          return (
            <g key={s.key} opacity={active && !on ? 0.35 : 1}>
              <line x1={s.x1} x2={s.x2} y1={s.y} y2={s.y} stroke={color} strokeWidth={on ? 2.2 : 1.4} strokeDasharray="4 2" />
              <polyline points={`${s.x2},${s.y} 160,${s.labelY}`} fill="none" stroke={color} strokeWidth="0.7" />
              <circle cx="168" cy={s.labelY} r="8" fill={on ? 'var(--accent)' : 'var(--surface)'} stroke={color} strokeWidth="1" />
              <text x="168" y={s.labelY} textAnchor="middle" dominantBaseline="central" fontSize="9" fontWeight="600" fill={on ? 'var(--accent-text)' : 'var(--text)'}>
                {i + 1}
              </text>
            </g>
          );
        })}
      </svg>
      <ol className="body-diagram-list">
        {SITES.map((s) => (
          <li key={s.key} className={active === s.key ? 'on' : undefined}>
            <strong>{LABELS[s.key]}</strong> — {s.help}
          </li>
        ))}
      </ol>
    </div>
  );
}
