# AGENTS.md — guide for AI agents

Flex & Meal: a local-first personal tracker (nutrition journal, strength/cardio training, body weight and measurements, goals, cross-analysis). Single-user, no backend. **The UI language is French**; code identifiers are English, code comments and UI strings are French.

## Stack and commands

React 18 + TypeScript (strict) + Vite 5, react-router-dom 6, Recharts, Dexie (IndexedDB). Tests: Vitest + Testing Library + jsdom + fake-indexeddb.

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Run all tests once (`vitest run`) |
| `npx tsc` | Type-check (`noUnusedLocals` / `noUnusedParameters` are on). `npm run build` = `tsc && vite build` |
| `npm start` / `flex-and-meal.bat` | Build then serve on port 5173 |
| `npm run build:ciqual` | Regenerate `public/ciqual.json` (CIQUAL food table) via `scripts/build-ciqual.mjs` |

Before finishing a change, run `npx tsc` and `npm test`.

## Architecture (see `ARCHITECTURE.md` for detail)

Domain-driven, split by bounded context, then by layer:

```
src/shared/kernel/   dates, numbers, text, id (no business logic)
src/nutrition|training|body|settings/{domain,infrastructure,ui}
src/application/     cross-context use cases: AppData, dailySummary, crossAnalysis, insights
src/infrastructure/  Dexie DB (db.ts), folder backup, export reminder
src/ui/              app shell (App.tsx routes), store, cross-context pages, shared components
```

Dependency rules (enforced by convention only):
- `domain` is pure: no React, no I/O. May import `shared` and other contexts' `domain`.
- `application` imports only domain/shared — never infrastructure or UI.
- `infrastructure` and `ui` may import everything above them.
- Put new business rules in `domain/` (or `application/` if they span contexts), not in components.

## Data flow

- `AppData` (`src/application/appData.ts`) is the aggregate root: everything the user owns, also the JSON export/import format. `parseData` validates/migrates imported data; `initialData` seeds defaults (including `SEED_FOODS`).
- `src/ui/state/store.tsx` (`StoreProvider`) holds `AppData` in React state and persists diffs to IndexedDB via `saveDiff` (`src/infrastructure/db.ts`). Legacy `localStorage` key `flex-and-meal:v1` is migrated on first load.
- Dexie tables: `foods, templates, log, workouts, strength, weights, measurements, meta` (+ `ciqual`, a reference table that is **not** part of the JSON backup; reloaded from `public/ciqual.json`). Schema changes need a new `this.version(n)` in `db.ts` — never edit an existing version.
- Hevy training import: CSV (`hevyCsv.ts`) and API (`hevyApi.ts`); session ids are deterministic (`hevySessionId`) so re-importing merges instead of duplicating (`mergeSessions`).
- Food search: local foods, CIQUAL (`localSearch.ts`), Open Food Facts (`openFoodFacts.ts`).

## Routes (`src/ui/app/App.tsx`)

`/` Dashboard · `/journal` · `/semaine` Week · `/analyses` Insights · `/muscu` Strength · `/corps` Body · `/repas` Templates · `/aliments` Foods · `/reglages` Settings.

## Testing conventions

- Tests sit next to the code: `Foo.ts` → `Foo.test.ts`, `Foo.tsx` → `Foo.test.tsx`.
- Domain/application: plain unit tests. UI: use `src/test/render.tsx` — `renderWithStore(ui, { data, route })` seeds fake IndexedDB and wraps in `StoreProvider` + `MemoryRouter`; helpers `makeData`, `seed`, `makeSession`. Setup in `src/test/setup.ts`.
- New behaviour should come with a test. Dates in tests use `todayISO`/`addDays` from `shared/kernel/dates` (avoid hard-coded "today").

## Specs and docs

- `docs/specs/*.feature` — living Gherkin specification of behaviour (English scenarios, French UI labels quoted). When you change observable behaviour, update the matching feature file. Index and conventions: `docs/specs/README.md`.
- `IMPROVEMENTS.md` — roadmap (✅ done · 🔜 next · 💡 backlog). Update status when you ship an item; backlog items are deliberately not in the specs until built.
- `ARCHITECTURE.md` — layering and context contents; update if you add a context or layer.

## Gotchas

- Do not read or modify `w.js` (a minified third-party bundle unrelated to the app) nor `tsconfig.tsbuildinfo` (generated).
- `dist/`, `node_modules/`, `save/`, `ciqual/` are git-ignored; do not commit them. `.idea/` is untracked.
- Keep user-facing text in French; keep numbers/dates through the `shared/kernel` helpers rather than ad hoc formatting.
- Stored data is user data: changes to `AppData` shape must stay backward compatible with existing exports (handle in `parseData`).
