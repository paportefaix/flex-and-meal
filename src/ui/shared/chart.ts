// Couleurs lisibles en thème clair comme sombre (les attributs SVG ne lisent pas les variables CSS).
export const COLORS = {
  intake: '#4f7cff',
  burned: '#f59e0b',
  weight: '#10b981',
  goal: '#ef4444',
  grid: 'rgba(128,128,128,0.2)',
  axis: '#8a8f98',
};

export const axisProps = { stroke: COLORS.axis, fontSize: 12, tickLine: false } as const;

export const tooltipStyle = {
  contentStyle: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' },
  labelStyle: { color: 'var(--text)' },
};
