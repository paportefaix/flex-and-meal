@data
Feature: Data storage, export, import and backup
  As a user whose data lives only in my browser
  I want to protect and move it
  So that I never lose my history

  Rule: Data is stored locally

    Scenario: First launch
      Given no data exists
      Then the app starts with the seed foods, no log, and a calorie goal of 2000 kcal

    Scenario: Automatic persistence
      When I change any data
      Then it is saved in the browser's IndexedDB

    Scenario: Local save failure
      Given IndexedDB is unavailable or full
      Then a banner says "L'enregistrement dans la base locale a échoué : exportez vos données depuis les Réglages."

    Scenario: Unknown routes
      When I open an unknown URL
      Then I am redirected to the home page

  Rule: Data can be exported and imported as JSON

    Scenario: Export
      Given I am on "/reglages"
      When I click "Exporter (JSON)"
      Then a file "flex-and-meal-YYYY-MM-DD.json" is downloaded
      And the export date is remembered

    Scenario: Import a valid file
      Given a JSON export with "version": 1
      When I import it and confirm "Remplacer toutes les données actuelles par celles du fichier ?"
      Then my data is replaced by the file's content

    Scenario: Declining the import
      When I import a file and decline the confirmation
      Then my data is unchanged

    Scenario: Import an unknown format
      Given a JSON file without "version": 1
      When I import it
      Then I see "Import impossible : Format de données inconnu"

    Scenario: Import a file that is not JSON
      When I import a text file
      Then an "Import impossible" message is shown

    Scenario: Older files lack newer collections
      Given an export made before strength training existed
      When I import it
      Then the missing collections are empty
      And the settings default to a 2000 kcal goal

    Scenario: A collection with the wrong type is reset
      Given an export where "log" is not an array
      When I import it
      Then "log" is an empty list

  Rule: Reset

    Scenario: Erase everything needs two confirmations
      When I click "Tout effacer"
      Then I must confirm "Effacer définitivement toutes les données ?"
      And confirm again "Vraiment ? Pensez à exporter avant."
      And only then is the data reset to the initial state

  Rule: Export reminder

    Scenario Outline: Reminder to back up
      Given no backup folder is configured
      And I have <entries> and my last export was <last_export>
      Then the reminder banner is <shown>

      Examples:
        | entries         | last_export     | shown   |
        | food entries    | never           | shown   |
        | food entries    | 20 days ago     | shown   |
        | food entries    | 3 days ago      | hidden  |
        | no food entries | never           | hidden  |

    Scenario: A backup folder replaces the reminder
      Given a backup folder is configured
      Then the reminder is never shown

    Scenario: Banner link
      When I click the reminder link
      Then I land on the settings page

  Rule: Automatic backup to a folder (Chrome / Edge)

    Scenario: Browser not supported
      Given a browser without the File System Access API
      Then the settings explain the feature needs Chrome or Edge

    Scenario: Choose a folder
      When I click "Choisir un dossier de sauvegarde…" and pick a folder
      Then the file "flex-and-meal.json" is written there immediately
      And the folder name and last backup time are displayed

    Scenario: Backups follow changes
      Given a folder is configured
      When I change data
      Then the file is rewritten 1.5 seconds after the last change

    Scenario: Backup on tab hide
      Given a folder is configured
      When the tab becomes hidden
      Then the latest data is written immediately

    Scenario: Permission expired
      Given a folder was chosen in a previous session and the browser asks for permission again
      Then a button "Réactiver la sauvegarde" is shown
      When I click it and grant access
      Then the backup resumes and writes the file

    Scenario: Backup failure
      Given writing to the folder fails
      Then "Échec de la sauvegarde" is displayed

    Scenario: Disable the backup
      When I click "Désactiver"
      Then the folder is forgotten and no more files are written

    Scenario: Cancelled folder picker
      When I close the folder picker without choosing
      Then nothing changes and no error is logged
