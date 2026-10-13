import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import Body from '../../body/ui/Body';
import { exportDue } from '../../infrastructure/exportReminder';
import Foods from '../../nutrition/ui/Foods';
import Templates from '../../nutrition/ui/Templates';
import Strength from '../../training/ui/Strength';
import Dashboard from '../pages/Dashboard';
import Insights from '../pages/Insights';
import Journal from '../pages/Journal';
import Settings from '../pages/Settings';
import Week from '../pages/Week';
import { useStore } from '../state/store';

const LINKS = [
  { to: '/', label: 'Accueil' },
  { to: '/journal', label: 'Journal' },
  { to: '/semaine', label: 'Semaine' },
  { to: '/analyses', label: 'Analyses' },
  { to: '/muscu', label: 'Muscu' },
  { to: '/corps', label: 'Poids & mensurations' },
  { to: '/repas', label: 'Repas types' },
  { to: '/aliments', label: 'Aliments' },
  { to: '/reglages', label: 'Réglages' },
];

export function App() {
  const { data, backup, saveError } = useStore();
  const remind = !backup.folder && data.log.length > 0 && exportDue();
  return (
    <>
      <header className="topbar">
        <span className="brand">Flex & Meal</span>
        <nav>
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end>
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main>
        {saveError && (
          <section className="card">
            <p className="danger small">L'enregistrement dans la base locale a échoué : exportez vos données depuis les Réglages.</p>
          </section>
        )}
        {remind && (
          <section className="card">
            <p className="small">
              Vos données n'ont pas été sauvegardées récemment. <NavLink to="/reglages">Activer la sauvegarde automatique ou exporter</NavLink>
            </p>
          </section>
        )}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/semaine" element={<Week />} />
          <Route path="/analyses" element={<Insights />} />
          <Route path="/muscu" element={<Strength />} />
          <Route path="/corps" element={<Body />} />
          <Route path="/repas" element={<Templates />} />
          <Route path="/aliments" element={<Foods />} />
          <Route path="/reglages" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
