@journal
Feature: Daily food and activity journal
  As a user
  I want to log what I eat and the exercise I do each day
  So that I can compare calories eaten and burned with my daily goal

  Background:
    Given my daily calorie goal is 2000 kcal
    And I am on "/journal"

  Rule: The journal is organised by day and by meal

    Scenario: Today is shown by default
      When I open the journal without a date
      Then the page title is today's date
      And four meals are listed: "Petit-déjeuner", "Déjeuner", "Collation", "Dîner"

    Scenario: Navigate between days
      When I click "Jour suivant"
      Then the journal shows the next day
      And the date is kept in the URL as "?d=YYYY-MM-DD"

    Scenario: Return to today
      Given I am viewing a day other than today
      Then a button "Aujourd'hui" is visible
      When I click it
      Then the journal shows today

    Scenario: Each meal shows its own calorie badge
      Given I logged 300 kcal at breakfast and 700 kcal at lunch
      Then the "Petit-déjeuner" badge shows "300 kcal"
      And the "Déjeuner" badge shows "700 kcal"

    Scenario: Each meal shows its macros as coloured chips
      Given I logged a lunch with 5 g of protein, 56 g of carbs and 1 g of fat
      Then the "Déjeuner" card shows the chips "Protéines 5 g", "Glucides 56 g" and "Lipides 1 g"
      And the chips use the same colours as the daily macro bars
      And a meal without entries shows no chips

  Rule: I can log a food by quantity

    Scenario: Log a food from the catalogue
      When I pick "Riz blanc cuit" in the lunch food picker with 200 g
      Then the lunch lists "Riz blanc cuit", "200 g" and "260 kcal"

    Scenario: Logged nutrients are frozen at entry time
      When I log a food
      Then the entry stores its kcal, protein, carbs and fat
      And later edits to the food do not change the entry

    Scenario: Remove an entry
      Given "Riz blanc cuit" is logged at lunch
      When I click "Retirer Riz blanc cuit"
      Then it disappears from the lunch

  Rule: Quick add logs a dish when only its macros are known (calories required, carbs/fat/protein optional)

    Scenario: Quick add
      When I click "+ Saisie libre" at dinner
      And I enter "Restaurant" with 850 kcal and validate
      Then dinner lists "Restaurant" with 1 unité and 850 kcal
      And protein, carbs and fat are 0 g

    Scenario: Quick add with macros
      When I click "+ Saisie libre" at dinner
      And I enter "Restaurant" with 850 kcal, 90 g carbs, 30 g fat, 45 g protein and validate
      Then the logged entry has carbs 90 g, fat 30 g and protein 45 g

    Scenario Outline: Invalid quick add is ignored
      When I click "+ Saisie libre"
      And I enter the name "<name>" and the kcal "<kcal>"
      And I validate
      Then nothing is logged

      Examples:
        | name       | kcal |
        |            | 500  |
        | Restaurant |      |

    Scenario: Cancel a quick add
      When I click "+ Saisie libre" then "Annuler"
      Then the form closes and nothing is logged

  Rule: Meal templates speed up logging

    Scenario: Add a template to a meal
      Given the template "Petit-déj classique" contains 60 g of "Flocons d'avoine" and 1 "Banane"
      When I choose "Petit-déj classique" in "+ Repas type…" at breakfast
      Then breakfast lists both foods with their quantities and nutrients

    Scenario: Foods deleted since the template was made are skipped
      Given a template references a food that no longer exists
      When I add the template to a meal
      Then only the remaining foods are logged

    Scenario: The template selector only appears when templates exist
      Given I have no template
      Then the "+ Repas type…" selector is not shown

    Scenario: Save a meal as a template
      Given breakfast contains catalogue foods
      When I click "Enregistrer comme repas type" and enter the name "Mon petit-déj"
      Then a template "Mon petit-déj" is created with these foods and quantities

    Scenario: Quick-add entries are left out of a saved template
      Given breakfast contains a catalogue food and a quick-add entry
      When I save the meal as a template
      Then the template contains only the catalogue food

    Scenario: The save-as-template button needs a catalogue food
      Given a meal contains only quick-add entries
      Then "Enregistrer comme repas type" is not shown

  Rule: Cardio is logged in the "Sport" card

    Scenario: Log a cardio session with an automatic kcal estimate
      Given my weight is 70 kg
      When I enter the activity "Course à pied", 30 minutes and 5 km
      Then the kcal placeholder suggests an estimate of about 343 kcal
      And once saved, the session shows "30 min", "5 km" and its kcal

    Scenario: Unknown activity has no estimate
      When I enter an activity that is not in the list
      Then no estimate is suggested
      And I must enter the kcal myself

    Scenario: Remove a cardio session
      Given a cardio session is logged
      When I click its remove button
      Then it disappears and the burned total decreases

    Scenario: Strength sessions appear in the Sport card
      Given I imported a Hevy session "Pecs / Triceps" on this day
      Then the Sport card lists "Muscu · Pecs / Triceps" with its sets, volume, duration and estimated kcal
      And strength sessions have no remove button here

  Rule: A day summary compares intake, activity and goal

    Scenario: Net calories
      Given I ate 2200 kcal and burned 300 kcal in cardio and strength
      Then the net is 1900 kcal

    Scenario: Remaining calories ignore sport
      Given my goal is 2000 kcal, I ate 1500 kcal and burned 300 kcal
      Then "Restantes" shows 500 and "Sport" shows 300

    Scenario: Burned calories and minutes add cardio and strength
      Given a 30-minute cardio session of 300 kcal
      And a strength session of 45 minutes
      Then total duration is 75 minutes
      And the number of sessions is 2

    Scenario: Strength calories use the weight known on that day
      Given I weighed 80 kg on the 1st and 78 kg on the 10th
      And I did a 60-minute strength session on the 5th
      Then its kcal use 80 kg

    Scenario: Default weight is 70 kg
      Given no weight has ever been recorded
      When a strength session is evaluated
      Then 70 kg is used

    Scenario: A day without food entries is "not logged"
      Given only a workout is logged
      Then the day does not count as logged

    Scenario: Macro progress bars
      Given I set protein, carbs and fat goals
      Then the day summary shows progress towards each macro goal
