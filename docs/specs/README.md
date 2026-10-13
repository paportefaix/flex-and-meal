# Functional specification (Gherkin)

Living specification of Flex & Meal's behaviour, written in Gherkin. It is derived from the code and its unit tests; the app UI is in French, so UI labels and messages are quoted in French inside English scenarios.

| File | Scope |
|---|---|
| `nutrition.feature` | Foods, nutrient maths, macro split, food search (local, CIQUAL, Open Food Facts), meal templates |
| `journal.feature` | Daily journal, meals, quick add, templates, cardio, day summary |
| `training.feature` | Hevy CSV and link import, volume / 1RM / records, MET energy, exercise trends |
| `body-and-settings.feature` | Weight, measurements, calorie and macro goals |
| `analytics.feature` | Home, week page, day status, "Analyses" insights and heatmap |
| `data-and-backup.feature` | Local storage, JSON export / import, reminder, folder backup |

Conventions
- `Rule:` groups scenarios around one business rule; `@tags` at the top of each file name the bounded context (see `ARCHITECTURE.md`).
- Scenarios describe observable behaviour, not implementation. Pure-domain scenarios map to the existing Vitest tests (`*.test.ts`); UI scenarios are not automated yet.
- Backlog items from `IMPROVEMENTS.md` (PWA, weight trend, adaptive TDEE, …) are intentionally not specified until they are built.
