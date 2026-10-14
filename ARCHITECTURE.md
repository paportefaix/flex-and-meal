# Architecture (DDD)

Le code est découpé par **contexte délimité** (bounded context), puis par couche à l'intérieur de chaque contexte.

```
src/app/
  shared/kernel/     Noyau partagé : dates, nombres, texte, identifiants (aucune logique métier)
  nutrition/         Aliments, repas types, journal alimentaire, macros
  training/          Musculation (séances Hevy), cardio, dépense énergétique, analyses
  body/              Pesées et mensurations
  settings/          Objectifs de l'utilisateur
  application/       Cas d'usage transverses : AppData (agrégat racine), bilan du jour,
                     analyses croisées, insights
  infrastructure/    Adaptateurs techniques : IndexedDB (Dexie), sauvegarde dans un dossier, rappel d'export
  ui/                Store (signals), pages transverses, composants partagés (Angular Material)
  app.ts, app.routes.ts, app.config.ts   Coque, routes (chargées à la demande), fournisseurs
src/main.ts          Point d'entrée
```

Chaque contexte suit la même forme :

| Dossier | Contenu | Peut importer |
|---|---|---|
| `domain/` | Entités, valeurs, règles métier pures (aucun Angular, aucun I/O) | `shared`, et le `domain` d'un autre contexte |
| `infrastructure/` | Accès externes : Open Food Facts, recherche CIQUAL, import CSV / API Hevy | `domain`, `shared`, `infrastructure` global |
| `ui/` | Composants Angular (standalone) du contexte | tout ce qui précède, `ui/` |

Règle de dépendance : `domain` ← `application` ← `infrastructure` / `ui`. Le domaine et l'application n'importent jamais l'infrastructure ni l'UI.

## Contextes

- **nutrition** — `Food`, `Nutrients`, `MealTemplate`, `LogItem`, `MEALS`, `MACROS`, `portionNutrients`, `macroSplit`.
- **training** — `StrengthSession`, `Workout`, `hevySessionId` (identité déterministe), `mergeSessions`, énergie (MET), indicateurs de force, tendances et charge musculaire. Import Hevy (CSV et API) dans `infrastructure/`.
- **body** — `WeightEntry` (`weightOn`), `Measurement`.
- **settings** — `Settings`, `suggestMacroGoals`.

## Couche application

- `appData.ts` : `AppData` (agrégat racine sauvegardé/exporté), `initialData`, `parseData`.
- `dailySummary.ts` : `dayTotals` (consommé − dépensé, croise nutrition, training et body).
- `crossAnalysis.ts` : croisements force / poids / nutrition / mensurations.
- `insights.ts` : constats et calendrier de la page « Analyses ».

## Tests

Les tests sont dans `src/test/`, qui reflète l'arborescence de `src/app/` (`src/app/x/foo.ts` → `src/test/app/x/foo.spec.ts`). `npm test` lance Vitest via le builder Angular `unit-test`.
