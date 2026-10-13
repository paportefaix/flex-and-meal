import { useRef } from 'react';

// Le champ natif <input type="date"> suit la langue du navigateur (souvent en-US) :
// on affiche donc la date en jj/mm/aaaa et on garde le champ natif, invisible, pour le sélecteur.
export function DateField({ value, onChange, required }: { value: string; onChange: (v: string) => void; required?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [y, m, d] = value.split('-');
  const label = value ? `${d}/${m}/${y}` : 'jj/mm/aaaa';
  return (
    <span className="date-field">
      <input
        ref={ref}
        type="date"
        lang="fr-FR"
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        onClick={() => {
          try {
            ref.current?.showPicker();
          } catch {
            /* non supporté : le champ natif reste utilisable */
          }
        }}
      />
      <span className="date-field-label" aria-hidden="true">
        {label}
      </span>
    </span>
  );
}
