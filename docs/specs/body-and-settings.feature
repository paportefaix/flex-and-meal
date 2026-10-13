@body @settings
Feature: Body tracking and personal goals
  As a user
  I want to record my weight and measurements and set my goals
  So that the app can show my progress and size my targets

  Rule: Weight entries

    Scenario: Record a weight
      Given I am on "/corps"
      When I enter 72.4 kg and validate
      Then the entry is saved for the selected date
      And the weight chart and history are updated

    Scenario: BMI is shown when my height is set
      Given my height is 180 cm in the settings
      And my last weight is 72.4 kg
      Then the BMI shown is 22.3

    Scenario: No BMI without height
      Given no height is set
      Then the BMI is not shown

    Scenario Outline: Weight known on a given date
      Given weights of 80 kg on 2026-10-01 and 78 kg on 2026-10-10
      When I ask the weight on <date>
      Then the result is <weight> kg

      Examples:
        | date       | weight |
        | 2026-10-05 | 80     |
        | 2026-10-10 | 78     |
        | 2026-10-20 | 78     |
        | 2026-09-01 | 80     |

    Scenario: Default weight when nothing is recorded
      Given no weight entry
      When I ask the weight on any date
      Then the result is 70 kg

  Rule: Measurements

    Scenario: Available measurements
      Then I can record chest, underbust, waist, waist above navel, love handles and glutes

    Scenario: Record only some measurements
      When I fill in only "Taille" with 82 cm
      Then a measurement entry holds only the waist

    Scenario: The previous value is suggested
      Given my last waist was 84 cm
      Then the waist input shows 84 as placeholder

    Scenario: Body diagram
      Then the measurements are displayed on a body diagram

  Rule: Calorie and weight goals

    Scenario: Default calorie goal
      Given a fresh install
      Then the calorie goal is 2000 kcal

    Scenario: Settings are saved automatically
      Given I am on "/reglages"
      When I change the calorie goal to 2300
      And I wait 600 ms
      Then the goal is saved and "Enregistré ✓" is displayed for 2 seconds

    Scenario: Pending changes are not lost
      Given I changed a goal less than 600 ms ago
      When I leave the page or the tab is hidden
      Then the change is saved immediately

    Scenario: An invalid calorie goal is not saved
      When I clear the calorie goal or set it to 0
      Then nothing is saved

    Scenario: Optional fields can be cleared
      Given a target weight of 70 kg is set
      When I clear the field
      Then the target weight is removed

    Scenario: Target weight is shown on the home page
      Given a target weight of 70 kg
      Then the "Poids" card displays "Objectif 70 kg"

  Rule: Macro goals

    Scenario: Suggest macro goals
      Given a calorie goal of 2000 kcal and a last weight of 70 kg
      When I click "Proposer des valeurs"
      Then protein is 126 g (1.8 g per kg)
      And fat is 62 g (28 % of calories)
      And carbs are 235 g (the remaining calories)

    Scenario: Carbs never go negative
      Given a calorie goal of 500 kcal and a weight of 120 kg
      When macro goals are suggested
      Then carbs are 0 g

    Scenario: Suggestion needs a weight
      Given no weight has been recorded
      Then "Proposer des valeurs" is disabled
      And a hint asks me to record a weight

    Scenario: A macro can be left untracked
      When I leave a macro goal empty
      Then that macro shows no target or progress bar
