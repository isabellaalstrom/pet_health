# Pet Health

IN DEVELOPMENT - integration will possibly change rapidly without warning and not be backwards compatible.

> Home Assistant integration to track and log your pet's bathroom visits, meals, drinks, medications and overall wellbeing.

Version: 0.1.0

## Overview

`Pet Health` helps you monitor and record your pet's health-related events: bathroom visits (pee/poop), food and water intake, medication doses, thirst/appetite assessments and wellbeing checks. Events can be logged manually (Developer Tools / automations / scripts), via the integration's services, or from external AI/vision systems that push visits into Home Assistant.

## Features

- Persistent storage of bathroom visits, medications and assessments.
- A suite of sensors that expose visit counts, timestamps, recent observations (poop consistency, color, urine amount), and state scores (thirst, appetite, wellbeing).
- Services to log, amend, confirm, reassign and delete visits; log meals, drinks, medications and assessments.
- Config flow support (UI setup) and per-pet options (medications configuration).

## Installation

1. Place the `pet_health` folder inside your Home Assistant `custom_components` directory: `custom_components/pet_health`.
2. Restart Home Assistant.
3. Go to Settings → Devices & Services → Integrations and add `Pet Health`.

Note: If you plan to publish this or use HACS, follow HACS packaging guidelines.

## Configuration

- Setup is available through the Integrations UI (config flow).
- Per-pet options include configuring medications (name + id) so medication-related sensors will be created automatically.

There is no required YAML — use the UI to add your pets and configure options.

## Entities

Sensors created by this integration follow a predictable pattern and are created per pet. Examples:

- `sensor.<pet>_last_bathroom_visit` — timestamp of last bathroom visit
- `sensor.<pet>_daily_visit_count` — number of visits today
- `sensor.<pet>_hours_since_last_visit` — hours since last visit
- `sensor.<pet>_last_poop_consistency` — textual consistency of last poop
- `sensor.<pet>_last_poop_color` — color of last poop
- `sensor.<pet>_daily_pee_count` / `sensor.<pet>_daily_poоп_count` — counts for today
- `sensor.<pet>_medication_<med_id>_last_dose` — medication-specific sensors (created when you configure medications in options)

The integration also creates additional sensors to help monitor hydration, food, wellbeing and other vitals. Common additional sensors:

- Drink sensors:
  - `sensor.<pet>_last_drink` — timestamp of last drink
  - `sensor.<pet>_daily_drink_count` — number of drink records today
  - `sensor.<pet>_last_drink_amount` — amount of last drink

- Meal sensors:
  - `sensor.<pet>_last_meal` — timestamp of last meal
  - `sensor.<pet>_daily_meal_count` — number of meals today
  - `sensor.<pet>_last_meal_amount` — amount of last meal

- Thirst / Appetite / Wellbeing:
  - `sensor.<pet>_last_thirst_level` / `sensor.<pet>_current_thirst_level`
  - `sensor.<pet>_last_appetite_level` / `sensor.<pet>_current_appetite_level`
  - `sensor.<pet>_last_wellbeing_assessment` / `sensor.<pet>_current_wellbeing_score`

- Weight tracking:
  - `sensor.<pet>_last_weight` — timestamp of last weight measurement
  - `sensor.<pet>_current_weight` — most recent weight (grams)
  - `sensor.<pet>_weight_change_7d` / `sensor.<pet>_weight_change_30d` — change in grams

- Vomiting tracking:
  - `sensor.<pet>_last_vomit` — timestamp of last vomiting incident
  - `sensor.<pet>_last_vomit_type` — type of last vomit (hairball/food/bile/...)
  - `sensor.<pet>_daily_vomit_count` / `sensor.<pet>_weekly_vomit_count`

- Administrative / review:
  - `sensor.<pet>_unconfirmed_visits_count` — number of unconfirmed AI/automatic visits

Entity attributes often include `visit_id`, `confirmed`, timestamps and additional observation details (notes, consistencies, urine amount, amounts, symptoms, weight_grams, etc.). Use these attributes to build automations or dashboards.

## Services

The integration exposes multiple services (see `services.yaml`). Key services include:

- `pet_health.log_bathroom_visit` — Record a bathroom visit.
- `pet_health.log_medication` — Record a medication dose.
- `pet_health.confirm_visit` — Mark an AI/automatic visit as confirmed.
- `pet_health.reassign_visit` — Move a visit to a different pet.
- `pet_health.delete_visit` — Remove a visit.
- `pet_health.amend_visit` — Update an existing visit.
- `pet_health.log_drink` — Record water intake.
- `pet_health.log_meal` — Record food intake.
- `pet_health.log_thirst` / `pet_health.log_appetite` / `pet_health.log_wellbeing` — Log assessments.
 - `pet_health.log_weight` — Record a weight measurement.
 - `pet_health.log_vomit` — Record a vomiting incident.

Example: log a bathroom visit via Developer Tools → Services

```yaml
service: pet_health.log_bathroom_visit
data:
  config_entry_id: <your-pet-config-entry-id>
  did_pee: true
  did_poop: false
  notes: "Seen near the litter box"
  confirmed: false
```

Example: log a medication dose

```yaml
service: pet_health.log_medication
data:
  config_entry_id: <your-pet-config-entry-id>
  medication_id: "abc123"
  notes: "Given with food"
```

Example: log a weight measurement

```yaml
service: pet_health.log_weight
data:
  config_entry_id: <your-pet-config-entry-id>
  weight_grams: 3500
  notes: "Routine monthly weigh-in"
```

Example: log a vomiting incident

```yaml
service: pet_health.log_vomit
data:
  config_entry_id: <your-pet-config-entry-id>
  vomit_type: hairball
  notes: "Small hairball, otherwise normal"
```

Replace `<your-pet-config-entry-id>` with the config entry selected in the service UI or copied from the integration entry.

## Automations & Dashboards

- Use the provided sensors in Lovelace cards to show daily counts, last visit timestamp and trends.
- Combine `hours_since_last_visit` with `sensor` thresholds to trigger reminders or alerts.
- Use `visit_id` attributes in sensors to create review workflows (e.g., a dashboard listing unconfirmed AI visits).

## Troubleshooting

- Integration not appearing: ensure the folder is in `custom_components/pet_health` and Home Assistant has been restarted.
- Sensors not created: check the integration options for the pet (medication config) and that the integration is set up for each pet.
- Missing data / wrong timestamps: ensure your Home Assistant timezone is correct; the integration stores timezone-aware timestamps.
- Check logs: enable debug logging for `custom_components.pet_health` in your Home Assistant `configuration.yaml` (or via the UI) to get detailed messages.

Example logger configuration (temporary for debugging):

```yaml
logger:
  default: info
  logs:
    custom_components.pet_health: debug
```

After enabling debug, check the Home Assistant logs (Settings → System → Logs) for messages from `pet_health`.

## Development

- Code structure highlights:
  - `manifest.json` — integration metadata
  - `config_flow.py` — UI setup flow
  - `sensor.py` — sensor entity implementations
  - `services.yaml` — service definitions and schemas
  - `store.py` / `models.py` — persistent storage models and helpers
  - `translations/` — translation strings (update `strings.json` and generate translations as needed)

- To contribute:
  1. Fork the repository and create a feature branch.
  2. Make changes and add tests where appropriate.
  3. Open a Pull Request with a clear description and changelog entry.

Contact / code owner: @isabellaalstrom (see `manifest.json`).

## Changelog

- 0.1.0 — Initial release.

## License

This integration follows the licensing of the containing repository. Include or reference a license file in the project root if you intend to publish.

---

If you'd like, I can also add example Lovelace cards, example automations, or a short CONTRIBUTING.md. Which would you prefer next?
