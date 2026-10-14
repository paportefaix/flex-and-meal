# AGENTS.md — guide for AI agents

Flex & Meal: a local-first personal tracker (nutrition journal, strength/cardio training, body weight and measurements, goals, cross-analysis). Single-user, no backend. **The UI language is French**; code identifiers are English, code comments and UI strings are French.

## Stack and commands

Angular 22 (standalone components, signals, zoneless) + Angular Material 3 + TypeScript (strict), `@angular/router` (hash location), ng2-charts / Chart.js, Dexie (IndexedDB). Tests: Vitest (via the Angular `unit-test` builder) + Testing Library DOM + jsdom + fake-indexeddb.

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server (`ng serve`, proxies from `proxy.conf.json`) |
| `npm test` | Run all tests once (`ng test --no-watch`; files `src/**/*.spec.ts`) |
| `npm run build` | `ng build` — type-checks (strict, `noUnusedLocals` / `noUnusedParameters`) and bundles to `dist/flex-and-meal/browser` |
| `npm start` / `flex-and-meal.bat` | Build then serve on port 5173 (`server.mjs`: static files + `/off-search` and `/hevy-api` proxies) |
| `npm run build:ciqual` | Regenerate `public/ciqual.json` (CIQUAL food table) via `scripts/build-ciqual.mjs` |

Before finishing a change, run `npm run build` and `npm test`.

## Architecture (see `ARCHITECTURE.md` for detail)

Domain-driven, split by bounded context, then by layer:

```
src/app/shared/kernel/   dates, numbers, text, id (no business logic)
src/app/nutrition|training|body|settings/{domain,infrastructure,ui}
src/app/application/     cross-context use cases: AppData, dailySummary, crossAnalysis, insights
src/app/infrastructure/  Dexie DB (db.ts), BackupService (folder backup), export reminder
src/app/ui/          store (state/store.ts), cross-context pages, shared components (chart, dialogs, date-field…)
src/app/app.ts, app.routes.ts, app.config.ts   shell (toolbar + tab nav), lazy routes, providers
```

Dependency rules (enforced by convention only):
- `domain` is pure: no Angular, no I/O. May import `shared` and other contexts' `domain`.
- `application` imports only domain/shared — never infrastructure or UI.
- `infrastructure` and `ui` may import everything above them.
- Put new business rules in `domain/` (or `application/` if they span contexts), not in components.

## Data flow

- `AppData` (`src/app/application/appData.ts`) is the aggregate root: everything the user owns, also the JSON export/import format. `parseData` validates/migrates imported data; `initialData` seeds defaults (including `SEED_FOODS`).
- `src/app/ui/state/store.ts` (`Store`, loaded by `provideAppInitializer`) holds `AppData` in a signal and persists diffs to IndexedDB via `saveDiff` (`src/app/infrastructure/db.ts`, injectable as `SAVE_DIFF`). Legacy `localStorage` key `flex-and-meal:v1` is migrated on first load.
- Dexie tables: `foods, templates, log, workouts, strength, weights, measurements, meta` (+ `ciqual`, a reference table that is **not** part of the JSON backup; reloaded from `public/ciqual.json`). Schema changes need a new `this.version(n)` in `db.ts` — never edit an existing version.
- Hevy training import: CSV (`hevyCsv.ts`) and API (`hevyApi.ts`); session ids are deterministic (`hevySessionId`) so re-importing merges instead of duplicating (`mergeSessions`).
- Food search: local foods, CIQUAL (`localSearch.ts`), Open Food Facts (`openFoodFacts.ts`).

## Routes (`src/app/app.routes.ts`)

`/` Dashboard · `/journal` · `/semaine` Week · `/analyses` Insights · `/muscu` Strength · `/corps` Body · `/repas` Templates · `/aliments` Foods · `/reglages` Settings.

## Testing conventions

- Tests live outside the app code, mirroring its structure: `src/app/x/foo.ts` → `src/test/app/x/foo.spec.ts`. Shared helpers: `src/test/render.ts`, `src/test/setup.ts`.
- Domain/application: plain unit tests. UI: use `src/test/render.ts` — `renderWithStore(Component, { data, route, inputs, routes })` seeds fake IndexedDB, provides a loaded `Store` and the router (pages are rendered through `RouterTestingHarness`; pass `inputs` for plain components); query with `screen` from `@testing-library/dom`. Helpers `makeData`, `seed`, `makeSession`. Setup in `src/test/setup.ts`. Material single-choice toggles expose `role=radio` / `aria-checked`; dialogs (`Dialogs.confirm/prompt`) replace `window.confirm/prompt`.
- New behaviour should come with a test. Dates in tests use `todayISO`/`addDays` from `shared/kernel/dates` (avoid hard-coded "today").

## Specs and docs

- `docs/specs/*.feature` — living Gherkin specification of behaviour (English scenarios, French UI labels quoted). When you change observable behaviour, update the matching feature file. Index and conventions: `docs/specs/README.md`.
- `IMPROVEMENTS.md` — roadmap (✅ done · 🔜 next · 💡 backlog). Update status when you ship an item; backlog items are deliberately not in the specs until built.
- `ARCHITECTURE.md` — layering and context contents; update if you add a context or layer.

## Gotchas

- Do not read or modify `w.js` (a minified third-party bundle unrelated to the app) nor `tsconfig.tsbuildinfo` (generated).
- `dist/`, `node_modules/`, `save/`, `ciqual/` are git-ignored; do not commit them. `.idea/` is untracked.
- Component templates live in external `.html` files (`templateUrl`) next to the component `.ts`; no inline `template:`.
- Keep user-facing text in French; keep numbers/dates through the `shared/kernel` helpers rather than ad hoc formatting.
- Stored data is user data: changes to `AppData` shape must stay backward compatible with existing exports (handle in `parseData`).
