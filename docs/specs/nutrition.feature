@nutrition
Feature: Food catalogue and nutrient computation
  As a user tracking what I eat
  I want a catalogue of foods whose nutrients scale with the quantity I eat
  So that every portion I log has accurate calories and macros

  Background:
    Given the app is opened for the first time
    And the catalogue contains the 15 seed foods (e.g. "Blanc de poulet cuit", "Œuf", "Huile d'olive")

  Rule: Nutrients are stored per 100 g, per 100 ml or per unit

    Scenario Outline: Nutrients of a portion scale with the quantity
      Given a food "<food>" in unit "<unit>" with <kcal> kcal and <protein> g protein
      When I compute the nutrients of a portion of <quantity> <unit>
      Then the portion has <portion_kcal> kcal and <portion_protein> g protein

      Examples:
        | food  | unit  | kcal | protein | quantity | portion_kcal | portion_protein |
        | Riz   | g     | 130  | 2.7     | 200      | 260          | 5.4             |
        | Œuf   | unité | 70   | 6       | 3        | 210          | 18              |
        | Lait  | ml    | 46   | 3.3     | 250      | 115          | 8.25            |

    Scenario: Missing macros count as zero
      Given a food "Œuf" in unit "unité" with only kcal and protein filled in
      When I compute the nutrients of 3 units
      Then carbs are 0 g and fat is 0 g

    Scenario: Summing nutrients of an empty list gives zero
      When I sum the nutrients of no items
      Then the result is 0 kcal, 0 g protein, 0 g carbs and 0 g fat

  Rule: Calories are split between macros on a 4 / 4 / 9 kcal-per-gram basis

    Scenario: Macro split of a balanced meal
      Given a total of 25 g protein, 25 g carbs and 0 g fat
      When I compute the macro split
      Then protein is 50 %, carbs are 50 % and fat is 0 %

    Scenario: Macro split sums to 100 %
      Given a total of 30 g protein, 50 g carbs and 20 g fat
      When I compute the macro split
      Then the three shares add up to 100 %

    Scenario: No macro split without calories from macros
      Given a total of 0 g protein, 0 g carbs and 0 g fat
      When I compute the macro split
      Then there is no split to show

  Rule: I manage my own foods in the "Aliments" page

    Scenario: Create a food
      Given I am on "/aliments"
      When I fill in the name "Skyr", the unit "g" and 63 kcal
      And I leave protein, carbs and fat empty
      And I save
      Then "Skyr" appears in my food list

    Scenario: Edit a food
      Given the food "Skyr" exists
      When I edit it and change kcal to 65
      Then the food list shows 65 kcal for "Skyr"

    Scenario: Past journal entries keep the nutrients they were logged with
      Given I logged 200 g of "Skyr" at 63 kcal per 100 g
      When I change "Skyr" to 65 kcal per 100 g
      Then the journal entry still shows 126 kcal

    Scenario: Filter my foods
      Given my catalogue contains "Pomme" and "Banane"
      When I type "pom" in the filter
      Then only "Pomme" is listed

    Scenario: Deleting a food asks for confirmation
      Given the food "Skyr" exists
      When I delete "Skyr"
      Then I am asked to confirm
      And declining leaves the food in place

  Rule: Foods can be found in my catalogue, the CIQUAL table and Open Food Facts

    Scenario: Local search ignores case and accents
      When I search for "oeuf"
      Then "Œuf" is among the results

    Scenario: Every search word must match
      Given the CIQUAL table is loaded
      When I search for "thon cru"
      Then every result name contains both "thon" and "cru"

    Scenario: My own foods come before CIQUAL results
      Given I own a food called "Thon maison"
      When I search for "thon"
      Then "Thon maison" is listed first with the origin "perso"
      And the following results have the origin "ciqual" and show their food group

    Scenario: CIQUAL names starting with the query rank first
      When I search for "thon"
      Then names starting with "thon" come before names that merely contain it
      And among those, shorter names come first

    Scenario: A food I already own is not duplicated from CIQUAL
      Given I saved a CIQUAL food into my catalogue
      When I search for it
      Then it appears once, as one of my foods

    Scenario: Search results are capped
      When I search for a very common word
      Then at most 40 results are shown

    Scenario: A blank search returns nothing
      When I search for "   "
      Then no result is shown

    Scenario: Open Food Facts results are sorted from least to most processed
      Given Open Food Facts returns a raw product, an ultra-processed product and a product of unknown level
      When I search Open Food Facts
      Then the order is: raw, processed, unknown, ultra-processed

    Scenario Outline: Processing level of an Open Food Facts product
      Given a product with NOVA group "<nova>"
      When it is classified
      Then its level is "<level>"

      Examples:
        | nova | level     |
        | 1    | raw       |
        | 2    | processed |
        | 3    | processed |
        | 4    | ultra     |

    Scenario: Products without calories are ignored
      Given Open Food Facts returns a product with no "energy-kcal_100g"
      When I search Open Food Facts
      Then that product is not listed

    Scenario: Saving an Open Food Facts product adds the brand to its name
      Given the product "Yaourt grec" from the brand "Fage"
      When I add it to my foods
      Then it is saved as "Yaourt grec (Fage)"

    Scenario: Open Food Facts is unavailable
      Given Open Food Facts answers with an HTTP error
      When I search Open Food Facts
      Then an error "Open Food Facts : erreur <status>" is reported

  Rule: Meal templates group foods I often eat together

    Scenario: Create a template
      Given I am on "/repas"
      When I name a template "Petit-déj classique"
      And I add 60 g of "Flocons d'avoine" and 1 "Banane"
      And I save
      Then the template appears in the list

    Scenario: A template needs a name and at least one food
      Given I am on "/repas"
      When the template name is empty or has no food
      Then the save button is disabled

    Scenario: Delete a template
      Given the template "Petit-déj classique" exists
      When I delete it and confirm
      Then it no longer appears in the list
