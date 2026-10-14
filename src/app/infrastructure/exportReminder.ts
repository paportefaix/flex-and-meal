const KEY = 'flex-and-meal:lastExport';
const DAYS = 14;

export const markExported = () => {
  try {
    localStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* stockage indisponible */
  }
};

/** Vrai si aucun export n'a été fait depuis 14 jours (ou jamais). */
export const exportDue = () => {
  try {
    const last = Number(localStorage.getItem(KEY));
    return !last || Date.now() - last > DAYS * 86400000;
  } catch {
    return false;
  }
};
