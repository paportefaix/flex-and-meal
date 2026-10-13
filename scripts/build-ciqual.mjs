// Convertit les XML CIQUAL (dossier /ciqual) en un JSON compact : public/ciqual.json.
// Usage : npm run build:ciqual
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const dir = new URL('../ciqual/', import.meta.url);
const find = (prefix) => {
  const f = readdirSync(dir).filter((n) => n.startsWith(prefix) && n.endsWith('.xml')).sort().pop();
  if (!f) throw new Error(`Fichier ${prefix}*.xml introuvable dans /ciqual`);
  return readFileSync(new URL(f, dir), 'utf8');
};
const text = (block, tag) => block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1].trim();
const blocks = (xml, tag) => xml.match(new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`, 'g')) ?? [];
const decode = (s) => s.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// Teneur CIQUAL : "12,5", "< 0,5" / "traces" (→ 0), "-" (→ inconnu).
const parseValue = (s) => {
  if (s === undefined || s === '-' || s === '') return undefined;
  if (s === 'traces' || s.startsWith('&lt;')) return 0;
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

const CODES = { kcal: ['328', '333'], protein: ['25003', '25000'], carbs: ['31000'], fat: ['40000'] };
const wanted = new Set(Object.values(CODES).flat());

const groups = new Map(blocks(find('alim_grp'), 'ALIM_GRP').map((b) => [text(b, 'alim_grp_code'), decode(text(b, 'alim_grp_nom_fr'))]));

const values = new Map(); // alim_code -> { const_code -> valeur }
for (const b of blocks(find('compo'), 'COMPO')) {
  const c = text(b, 'const_code');
  if (!wanted.has(c)) continue;
  const code = text(b, 'alim_code');
  if (!values.has(code)) values.set(code, {});
  values.get(code)[c] = parseValue(text(b, 'teneur'));
}

const r1 = (n) => Math.round(n * 10) / 10;
const pick = (v, codes) => {
  for (const c of codes) if (v[c] !== undefined) return r1(v[c]);
  return undefined;
};

const out = [];
for (const b of blocks(find('alim_2'), 'ALIM')) {
  const code = text(b, 'alim_code');
  const v = values.get(code) ?? {};
  const kcal = pick(v, CODES.kcal);
  if (kcal === undefined) continue;
  out.push({
    id: `ciqual-${code}`,
    name: decode(text(b, 'alim_nom_fr')),
    group: groups.get(text(b, 'alim_grp_code')) ?? '',
    unit: 'g',
    kcal,
    protein: pick(v, CODES.protein),
    carbs: pick(v, CODES.carbs),
    fat: pick(v, CODES.fat),
  });
}

writeFileSync(new URL('../public/ciqual.json', import.meta.url), JSON.stringify(out));
console.log(`${out.length} aliments écrits dans public/ciqual.json`);
