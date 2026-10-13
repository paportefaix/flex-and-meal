# Flex & Meal — proposed improvements

Status: ✅ done · 🔜 suggested next · 💡 backlog

## 1. Close gaps in what is already tracked

- ✅ **Macro goals** — protein / carbs / fat targets in Settings (with a "suggest values" button: 1.8 g protein per kg, 28 % fat, rest carbs), progress bars in the Journal and Home, weekly macro averages and a protein column on the Week page.
- 🔜 **Weight trend** — 7-day moving average (or exponentially weighted) instead of raw daily weight, plus a projected date for reaching `targetWeight` from the last 4 weeks.
- 🔜 **Adaptive TDEE** — estimate real maintenance calories from average intake and the weight trend (~7700 kcal per kg), and suggest adjusting `kcalGoal`.
- 💡 **Use `heightCm` further** — BMI exists; add a Mifflin-St Jeor starting estimate (needs age and sex in Settings).

## 2. Faster logging

- 🔜 **Copy yesterday / copy a meal to another day** in one tap.
- 🔜 **Recents and frequents** at the top of the food picker.
- 💡 **Quick-add kcal** without looking up a food.
- 💡 **Default quantity** per food = last quantity logged.
- 💡 **Barcode scanning** (`BarcodeDetector` / ZXing) feeding the existing Open Food Facts lookup.
- 💡 **Suggest a template** for the meal type and time of day.

## 3. Planning

- 💡 **Weekly meal planner** — drop templates onto future days, show planned vs. actual.
- 💡 **Shopping list** generated from the plan, quantities summed per food.
- 💡 **"What fits my remaining macros?"** — suggest foods/templates that fit what is left for the day.

## 4. Insights

- ✅ **Analyses page** (`/analyses`):
  - plain-language "À retenir" notes (streak, target adherence, protein adherence, weekend vs. weekday gap, busiest weekday, macro split, waist-to-height);
  - logging streak, days logged and days on target over 28 days;
  - 28-day macro split (share of kcal, g/day);
  - average kcal per day of the week (12 weeks);
  - 12-week calendar heatmap (under / on target / over, ±10 % of the goal), each cell links to that day's journal;
  - waist, change since first measurement, waist-to-height ratio.
- 💡 **Micronutrients** — extend `scripts/build-ciqual.mjs` with fiber, sugar and salt (most useful), saturated fat.
- 💡 **Configurable adherence band** (currently fixed at ±10 %) and a "bulk" mode where over-goal is not flagged red.

## 5. Workouts

- ✅ **Strength** (`/muscu`): Hevy CSV import + API sync, weekly volume, estimated 1RM, personal records, muscle split, kcal estimated from MET × body weight × duration and counted in the Journal / Week / Home budgets.
- ✅ **Strength analysis** (`/muscu`, `src/strengthAnalysis.ts`): per-exercise trend table (sparkline, 4 / 12-week change, plateau / decline detection), weekly volume and hard sets (RPE ≥ 8 or failure) per muscle group with training frequency, consistency (week streak, session heatmap, density), and cross-views with body weight (relative strength), nutrition (protein / kcal vs. volume) and waist. All derived from `data.strength` and the other collections, so nothing extra to back up.
- ✅ **Manual cardio entry** (duration, distance, automatic kcal estimate) in the Journal and on `/muscu`.
- 💡 Import from Strava / Garmin export files.

## 6. Reliability and polish

- 🔜 **PWA** — manifest + service worker so it installs on a phone and works offline (probably the highest-value item for daily logging).
- 💡 **Phone ↔ PC sync** — encrypted file in a synced folder (builds on the existing backup folder), or WebDAV / Drive.
- 💡 **Schema versioning and migrations** — `version: 1` is hardcoded in `parseData`; add a migration path before the types grow further.
- 💡 **Unit tests** for `dayTotals`, `computeInsights` and backup import/export — the places where a silent bug would corrupt or mislead.
- 💡 Manual dark/light toggle; i18n if the app is ever shared.
- 💡 Code-split the bundle (Recharts pushes it past 500 kB).

## Suggested order for the next round

1. PWA
2. Weight trend + goal projection
3. Copy yesterday + recents
4. Adaptive TDEE
