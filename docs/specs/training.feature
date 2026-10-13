@training
Feature: Strength training import, metrics and analysis
  As a lifter who logs workouts in Hevy
  I want to import them and see my progress
  So that I can follow volume, strength and consistency next to my nutrition

  Background:
    Given I am on "/muscu"

  Rule: Sessions are imported from a Hevy CSV export

    Scenario: Import a CSV export
      Given a CSV with columns "title", "start_time", "end_time", "exercise_title", "set_type", "weight_kg", "reps", "rpe"
      When I import it
      Then rows are grouped into sessions by start time and title
      And sets are grouped into exercises in file order

    Scenario Outline: Hevy start dates are understood in French and English
      When the start time is "<text>"
      Then the session date is "<date>"

      Examples:
        | text                | date       |
        | 13 Oct 2026, 18:30  | 2026-10-13 |
        | 13 oct. 2026, 18:30 | 2026-10-13 |
        | 5 févr. 2026, 07:00 | 2026-02-05 |
        | 2026-10-13T18:30:00 | 2026-10-13 |

    Scenario: Session duration comes from start and end times
      Given a session from 18:00 to 19:15
      Then its duration is 75 minutes

    Scenario: Missing title
      Given a row with an empty title
      Then the session is named "Séance"

    Scenario: Quoted cells, doubled quotes and line breaks are supported
      Given a CSV cell containing "a ""quoted"", multi-line value"
      Then it is read as one cell

    Scenario: Set types
      Given sets typed "warmup", "failure", "dropset", "normal" and an unknown type
      Then unknown types are treated as "normal"

    Scenario Outline: Rejected files
      When I import <file>
      Then I see the error "<error>"

      Examples:
        | file                                  | error                                                                                         |
        | an empty file                         | Fichier vide                                                                                  |
        | a CSV without the required columns    | Ce fichier ne ressemble pas à un export Hevy (colonnes start_time, exercise_title, weight_kg, reps attendues) |
        | a CSV whose dates are all unreadable  | Aucune séance lisible dans ce fichier                                                         |

    Scenario: Rows with unreadable dates are skipped
      Given a CSV with one valid and one unreadable start time
      Then only the valid row is imported

  Rule: Sessions are imported from a shared Hevy link

    Scenario: Extract workout ids from pasted text
      When I paste "https://hevy.com/workout/AbC123xyz and https://hevy.com/workout/Zz9988776"
      Then two workout ids are found

    Scenario: Bare ids are accepted
      When I paste "AbC123xyz9"
      Then it is taken as a workout id

    Scenario: Duplicate links are collapsed
      When I paste the same link twice
      Then one id is found

    Scenario: Import a shared workout
      Given Hevy returns a workout with exercises and sets
      When I import its link
      Then a session is created with the title, date, duration, sets, reps, weights, RPE and timed sets

    Scenario: Assisted bodyweight exercises carry no load
      Given an exercise of type "bodyweight_assisted_reps" with an assistance of 20 kg
      Then its sets are stored with a weight of 0 kg

    Scenario Outline: Errors fetching a shared workout
      Given Hevy answers <answer>
      When I import the link
      Then the message is "<message>"

      Examples:
        | answer              | message                                                         |
        | 404                 | Séance <id> introuvable : vérifiez le lien.                     |
        | 500                 | Séance <id> : Hevy a répondu avec l’erreur 500. Elle est peut-être privée. |
        | no exercise         | Séance <id> : aucune donnée lisible (séance privée ?).          |
        | a network failure   | Hevy est injoignable. (…) proxy local                           |

  Rule: Re-importing never creates duplicates

    Scenario: A session id is deterministic
      Given a session starting at 2026-10-13 18:30 titled "Pecs"
      Then its id is "hevy:2026-10-13 18:30|Pecs" whether it came from the CSV or the shared link

    Scenario: Importing the same workout twice
      Given a session already exists
      When I import it again from either source
      Then it replaces the existing session
      And the count of added sessions is 0

    Scenario: Merge keeps sessions sorted by date
      When I import sessions older than my existing ones
      Then all sessions are listed in chronological order

  Rule: Volume and strength indicators only count work sets

    Scenario: Warm-ups and empty sets are ignored
      Given an exercise with a warm-up set and a set of 0 reps and no duration
      Then neither counts as a work set

    Scenario: Timed sets count
      Given a plank set of 60 seconds and 0 reps
      Then it counts as a work set

    Scenario: Set volume
      Given a set of 80 kg for 5 reps
      Then its volume is 400 kg

    Scenario Outline: Estimated one-rep max (Epley)
      Given a set of <weight> kg for <reps> reps
      Then the estimated 1RM is <e1rm> kg

      Examples:
        | weight | reps | e1rm |
        | 100    | 1    | 100  |
        | 100    | 5    | 116.67 |
        | 100    | 10   | 133.33 |
        | 0      | 12   | 0    |

    Scenario: Weekly volume includes empty weeks
      When I view the last 8 weeks
      Then 8 weeks from Monday to Sunday are listed
      And weeks without session show 0 volume, 0 sets and 0 sessions

    Scenario: Records per exercise
      Then each exercise shows its max weight, best estimated 1RM with date, best set volume, work-set count and last date

    Scenario: Exercises are ordered by number of work sets
      Then the exercise with the most work sets is first
      And ties are broken alphabetically

    Scenario Outline: Muscle group inferred from the exercise name
      When the exercise is "<exercise>"
      Then its muscle group is "<group>"

      Examples:
        | exercise            | group     |
        | Squat (Barbell)     | Jambes    |
        | Bench Press         | Pectoraux |
        | Développé couché    | Pectoraux |
        | Lat Pulldown        | Dos       |
        | Tractions           | Dos       |
        | Overhead Press      | Épaules   |
        | Bicep Curl          | Biceps    |
        | Triceps Pushdown    | Triceps   |
        | Plank               | Abdos     |
        | Something unknown   | Autre     |

    Scenario Outline: Rep zones
      Given a work set of <reps> reps
      Then it counts toward "<zone>"

      Examples:
        | reps | zone         |
        | 3    | strength     |
        | 5    | strength     |
        | 8    | hypertrophy  |
        | 12   | hypertrophy  |
        | 15   | endurance    |

  Rule: Energy expenditure is estimated with MET x weight x duration

    Scenario: Formula
      Given 4 MET, 70 kg and 60 minutes
      Then the energy is 280 kcal

    Scenario: Strength uses the recorded duration
      Given a session with a recorded duration of 50 minutes
      Then 50 minutes are used

    Scenario: Strength without a duration
      Given a session with 12 work sets and no duration
      Then 12 x 2.5 = 30 minutes are used

    Scenario: Cardio activity lookup ignores case and accents
      When I ask for the estimate of "course a pied" for 30 minutes at 70 kg
      Then the estimate is 343 kcal

    Scenario: Unknown cardio activity
      When I ask for the estimate of "Quidditch"
      Then there is no estimate

  Rule: Exercise trends highlight progress and stagnation

    Scenario Outline: Trend status of an exercise
      Given an exercise trend where <situation>
      Then its status is "<status>"

      Examples:
        | situation                                                    | status   |
        | it was done fewer than 3 times                               | new      |
        | it was not done for more than 35 days                        | inactive |
        | its estimated 1RM rose by more than 1.5 % over 4 weeks       | up       |
        | its estimated 1RM fell by more than 1.5 % over 4 weeks       | down     |
        | it varied by less than 1.5 %                                 | flat     |
        | best result is 4+ sessions and 21+ days old                  | plateau  |

    Scenario: Bodyweight exercises are tracked in repetitions
      Given an exercise whose sets all have a weight of 0 kg
      Then its trend unit is "reps" and the value is the best reps count of the session

    Scenario: Weighted exercises are tracked by estimated 1RM
      Given an exercise with at least one loaded set
      Then its trend unit is "kg"

    Scenario: Variations need enough history
      Given an exercise with no session 4 weeks ago
      Then its 4-week variation is not available

  Rule: Training insights cross-reference the rest of the app

    Scenario: All derived values are computed on the fly
      Then no analysis result is stored in the app data
      And only sessions, weights, measurements and the food log are saved

    Scenario: Training views on the dashboard
      Given I have at least one strength session
      Then the home page shows this week's sessions, this week's volume in tonnes and the last session
      And without any session, it links to the Hevy import
