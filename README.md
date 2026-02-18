# Pet Health

IN DEVELOPMENT - integration will possibly change rapidly without warning and not be backwards compatible.

> Home Assistant integration to track and log your pet's bathroom visits, meals, drinks, medications and overall wellbeing.

<!-- Version information is omitted — this project changes rapidly. -->

## Frontend Development

The Pet Health panel is now built with React for better maintainability and modularity. The frontend source code is in the `frontend/` directory.

### Building the Frontend

To build the frontend panel:

```bash
cd frontend
npm install
npm run build
```

This will compile the React application and output the bundled `pet-health-panel.js` to the `www/` directory.

### Development Mode

For development with hot-reload:

```bash
cd frontend
npm run dev
```

Note: Development mode is primarily for working on the React components. For full integration testing, you'll need to build and test within Home Assistant.

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

### Unknown Pet Visits (AI Detection Support)

**New in this version**: You can now log bathroom visits without specifying which pet, useful for AI-based detection systems:

```yaml
service: pet_health.log_bathroom_visit
data:
  did_pee: true
  did_poop: false
  confirmed: false
  notes: "Detected by AI camera"
```

When `confirmed: false` and `config_entry_id` is omitted:
- Visit is stored with a special "unknown" identifier
- Appears in "Unknown Pet Visits" section in the UI
- Can be reassigned to the correct pet later
- Badge shows count of unconfirmed + unknown visits

This is particularly useful for:
- AI-powered litter box cameras
- Motion detection systems
- Automated pet monitoring setups

**Note**: Confirmed visits (`confirmed: true`) still require `config_entry_id`.

## Developer API & Panel

- WebSocket API: the integration exposes a simple WebSocket API for frontend or external tooling. Available commands (developer-facing) include:
  - `pet_health/get_visits` — fetch visits (optional `pet_id`).
  - `pet_health/get_pet_data` — fetch config entries and pet metadata (optional `entry_id`).
  - `pet_health/get_medications` — fetch medication records (optional `pet_id`).
  - `pet_health/get_store_dump` — fetch the full store dump for one or all pets (optional `pet_id`).
  - `pet_health/get_unknown_visits` — fetch visits logged to the "unknown" entry.

  These commands return JSON-serializable objects and are intended for the frontend panel and advanced automations or integrations.

- Panel registration details: the integration registers a custom frontend panel as a webcomponent named `pet-health-panel`, served from the integration bundle at the module URL `/pet_health_panel/pet-health-panel.js`. The panel is registered so it does not require an administrator to view (`require_admin=False`).

- Auto-refresh event: the frontend listens for the `pet_health_data_updated` event fired on the Home Assistant bus. Services and store updates should fire this event after modifying data so the panel and any subscribed clients refresh automatically.

## How to use the integration

- Add pets via the Integrations UI, then use the provided services or the panel to log events.
- Typical sensors you get per pet (examples):
  - `sensor.<pet>_last_bathroom_visit` — timestamp of last bathroom visit
  - `sensor.<pet>_daily_visit_count` — number of visits today
  - `sensor.<pet>_hours_since_last_visit` — hours since last visit
  - `sensor.<pet>_last_poop_consistency` / `sensor.<pet>_last_poop_color`
  - `sensor.<pet>_last_drink`, `sensor.<pet>_daily_drink_count`, `sensor.<pet>_last_drink_amount`
  - `sensor.<pet>_last_meal`, `sensor.<pet>_daily_meal_count`, `sensor.<pet>_last_meal_amount`
  - `sensor.<pet>_current_weight`, `sensor.<pet>_weight_change_7d`
  - `sensor.<pet>_last_vomit`, `sensor.<pet>_daily_vomit_count`
  - Medication sensors: `sensor.<pet>_medication_<med_id>_last_dose` (created when you add medications in options)

These sensors expose useful attributes like `visit_id`, `confirmed`, and observation details (notes, urine amount, poop consistencies, etc.). Use attributes in templates and automations.

Example automations

- Notify when a pet hasn't visited in X hours (uses `hours_since_last_visit`):

```yaml
alias: 'Pet hasn't visited in 12h'
trigger:
  - platform: numeric_state
    entity_id: sensor.fluffy_hours_since_last_visit
    above: 12
action:
  - service: notify.mobile_app_me
    data:
      message: "Fluffy hasn't had a bathroom visit in over 12 hours. Check in."
``` 

- Medication reminder (checks last dose sensor for a med_id):

```yaml
alias: 'Give Ziggy morning med'
trigger:
  - platform: time
    at: '08:00:00'
condition: []
action:
  - choose:
      - conditions:
          - condition: template
            value_template: "{{ states('sensor.ziggy_medication_abc123_last_dose') == '' }}"
        sequence:
          - service: notify.mobile_app_me
            data:
              message: 'Time to give Ziggy their morning medication.'
    default: []
``` 

Unconfirmed visits (AI / automation logs)

Automations or external systems can log visits without a `config_entry_id` and with `confirmed: false`. These are stored as "unknown" visits (so they are not yet assigned to a pet) and are intended for human review.

How to review and confirm:

- Use the panel UI (the Pet Health panel lists unconfirmed / unknown visits for review). The frontend calls the WebSocket commands `pet_health/get_unknown_visits` and `pet_health/get_visits` to populate the review list.
- Confirm a visit via service call (manual confirmation):

```yaml
service: pet_health.confirm_visit
data:
  visit_id: '<visit-id-from-sensor-attribute-or-panel>'
```

- Reassign a visit (also marks it confirmed):

```yaml
service: pet_health.reassign_visit
data:
  visit_id: '<visit-id>'
  config_entry_id: '<target-config-entry-id>'
```

- Delete false positives via `pet_health.delete_visit` if an AI detection is incorrect.

This workflow lets AI or camera systems push likely events while ensuring a human can verify and attribute them later.

Config Flow — adding medicines and images

- Open the Integrations UI → select the Pet Health entry for a pet → Configure (Options).
- To add or manage medications: choose **Manage medications** → **Add new medication**. Fill the form fields: name, dosage, unit (optional), frequency (daily/weekly/etc.), scheduled times (optional), start date, and notes. Each medication is assigned an internal ID; medication-specific sensors are created using that ID: `sensor.<pet>_medication_<med_id>_last_dose`.
- To edit the pet image: choose **Edit pet image** → paste an image path or URL into the field and save. An empty value removes the custom image and falls back to default avatars.

Installing via HACS (custom repository)

1. In Home Assistant, open HACS → Integrations.
2. Click the three dots (top-right) → **Custom repositories**.
3. Paste the repository URL (your repo) and set category `integration`, then click **Add**.
4. Install the integration from HACS and restart Home Assistant when prompted.

Alternatively, for manual installs copy the `pet_health` folder into `custom_components/pet_health` and restart Home Assistant.

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

### Release Process

This project uses GitHub Actions to automate releases. There are two ways to create a release:

#### 1. Manual Release (Recommended)

1. Go to the [Actions tab](../../actions/workflows/release.yml) in GitHub
2. Click "Run workflow"
3. Enter the new version number (e.g., `0.3.1`)
4. Click "Run workflow"

The workflow will:
- Update version numbers in `manifest.json`, `hacs.json`, and `frontend/package.json`
- Build the React frontend
- Commit the changes to main
- Create a git tag
- Generate release notes from commits
- Create a GitHub release with a downloadable zip

#### 2. Release via Pull Request

1. Create a PR with your changes
2. Add the `release` label to the PR
3. Merge the PR to main

The workflow will automatically:
- Use the current version from `manifest.json`
- Build the React frontend
- Create a git tag
- Generate release notes
- Create a GitHub release

### Frontend Development

The React frontend must be built before releases. The GitHub Actions workflow handles this automatically, but for local development:

```bash
cd frontend
npm install
npm run build
```

This compiles the React application and outputs `pet-health-panel.js` to the `www/` directory.

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

## Change notes

- Initial release and experimental development.
- Added a WebSocket developer API to fetch visits, medications, store dumps and unknown visits from the frontend or external tools.
- Panel registration updated: the custom panel is exposed as a webcomponent and served from the integration `www` bundle; the panel does not require an admin user to view.
- Frontend listens for `pet_health_data_updated` events so the panel and subscribed clients auto-refresh when data changes.

## License

This integration follows the licensing of the containing repository. Include or reference a license file in the project root if you intend to publish.

---

If you'd like, I can also add example Lovelace cards, example automations, or a short CONTRIBUTING.md. Which would you prefer next?
