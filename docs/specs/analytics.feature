@analytics
Feature: Weekly summary, home dashboard and insights
  As a user
  I want summaries of my recent days
  So that I can see whether I stick to my goals

  Background:
    Given my calorie goal is 2000 kcal

  Rule: The week page summarises Monday to Sunday

    Scenario: Default week
      When I open "/semaine"
      Then the week containing today is shown, from Monday to Sunday

    Scenario: Navigate weeks
      When I click "Semaine précédente" or "Semaine suivante"
      Then the week shifts by 7 days
      And the start of the week is kept in the URL as "?w="

    Scenario: Averages only use logged days
      Given only 3 days of the week have food entries
      Then averages are computed over these 3 days
      And a note says "Moyennes calculées sur les 3 jour(s) renseigné(s)."

    Scenario: Balance versus goal
      Given two logged days with a net of 2300 and 1900 kcal
      Then the balance is the sum of (net - goal) = +200
      And it is flagged as over goal

    Scenario: Weight change over the week
      Given two weights in the week, 72.0 kg then 71.4 kg
      Then the weight change is -0.6 kg

    Scenario: Strength block
      Given strength sessions in the week
      Then the page shows their count, volume in tonnes and estimated kcal

    Scenario: Average macros versus goals
      Given a protein goal of 120 g
      Then protein is flagged good between 95 % and 110 % of the goal, otherwise bad

    Scenario: Daily table links to the journal
      When I click a day in the table
      Then the journal opens on that day

    Scenario: Days without entries
      Then their intake, protein, net and gap are shown as "—"

  Rule: The home page is a snapshot of today

    Scenario: Cards
      When I open "/"
      Then I see today's summary, the last 7 days, strength training and weight

    Scenario: Weight evolution over 30 days
      Given a last weight of 71 kg and a weight of 72 kg 30 days ago
      Then the 30-day change is -1.0 kg and flagged good

    Scenario: Weight chart needs two points
      Given fewer than two weights in the last 90 days
      Then no chart is displayed

    Scenario: Empty states
      Given no weight entry
      Then the card says "Aucune pesée enregistrée."

  Rule: A day is classified against the calorie goal with a ±10 % band

    Scenario Outline: Day status
      Given a day with <entries> and a net of <net> kcal
      Then its status is "<status>"

      Examples:
        | entries | net  | status |
        | none    | 0    | none   |
        | food    | 1700 | under  |
        | food    | 1800 | on     |
        | food    | 2200 | on     |
        | food    | 2201 | over   |

  Rule: The "Analyses" page explains habits in plain language

    Scenario: Logging streak
      Given I logged food on each of the last 4 days including today
      Then the streak is 4
      And a note "Série en cours : 4 jours consécutifs renseignés." is shown

    Scenario: Streak survives an empty today
      Given I logged the last 3 days but not yet today
      Then the streak is 3

    Scenario: Short streaks are not announced
      Given a streak of 2 days
      Then no streak note is shown

    Scenario: Target adherence this week
      Given 5 days logged in the last 7, 3 of them on target
      Then a note says the goal was met 3 days out of 5

    Scenario: Protein adherence
      Given a protein goal of 120 g
      Then a day counts as a hit from 114 g (95 %)

    Scenario: No protein note without a protein goal
      Given no protein goal
      Then no protein adherence note is shown

    Scenario: Weekend versus weekday gap
      Given at least 2 logged weekend days over 28 days
      And weekends average 2400 kcal against 2000 on weekdays
      Then a note says weekends are 400 kcal higher

    Scenario: Small gaps are ignored
      Given a weekend/weekday gap under 100 kcal
      Then no gap note is shown

    Scenario: Busiest weekday
      Given a weekday with at least 3 logged occurrences in the last 12 weeks
      Then the note names the weekday with the highest average kcal

    Scenario: 28-day macro split
      Given food logged over the last 28 days
      Then a note gives the share of kcal from carbs, fat and protein

    Scenario: Waist-to-height ratio
      Given a waist of 85 cm and a height of 180 cm
      Then the ratio is 0.47 and is described as under the 0.5 reference

    Scenario: Waist change
      Given two waist measurements, 90 cm then 86 cm
      Then the change since the first measurement is -4 cm

    Scenario: Calendar heatmap
      Then 12 weeks are displayed, Monday to Sunday, the last being the current week
      And future days are blank
      And each past day is coloured under, on target or over
      And clicking a day opens its journal
