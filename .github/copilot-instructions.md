# Copilot Instructions for Pet Health

## Project Overview

This is a **Home Assistant custom component** (integration) for tracking and logging pet health events including bathroom visits, medications, meals, drinks, weight, vomiting incidents, and wellness assessments.

**Tech Stack:**
- Python 3.11+
- Home Assistant Core
- HACS (Home Assistant Community Store) compatible
- No external dependencies beyond Home Assistant core

**Code Owner:** @isabellaalstrom  
**Current Version:** See `manifest.json` for the latest version

## Project Structure

```
pet_health/
├── __init__.py          # Main integration setup, services registration
├── config_flow.py       # UI configuration flow
├── sensor.py            # Sensor entity implementations
├── services.yaml        # Service definitions and schemas
├── store.py             # Persistent storage using Home Assistant Store
├── models.py            # Data models for visits, medications, etc.
├── websocket.py         # WebSocket API for frontend
├── panel.py             # Custom panel registration
├── const.py             # Constants and configuration keys
├── strings.json         # UI strings
├── translations/        # Localization files
├── www/                 # Frontend assets (panel UI)
└── manifest.json        # Integration metadata
```

## Key Concepts

### Pets and Config Entries
- Each pet is a separate config entry
- Config entry ID is used to identify which pet an event belongs to
- Special "unknown" pet ID exists for unconfirmed AI-detected visits

### Event Types
- **Bathroom visits**: pee/poop with optional consistency, color, amount
- **Medications**: tracked by medication_id with dosage and timing
- **Meals/Drinks**: amount and timing tracking
- **Assessments**: thirst, appetite, wellbeing scores
- **Weight**: tracking in grams with change calculations
- **Vomiting**: type and frequency tracking

### Confirmation System
- `confirmed: false` visits are unconfirmed (e.g., from AI detection)
- `confirmed: true` visits are verified by user
- Unconfirmed visits can be reassigned or confirmed later
- When `confirmed: false`, `config_entry_id` is optional (for unknown pet)

## Commands

**No traditional build/test commands** - This is a Home Assistant component that runs within Home Assistant:

1. **Development Setup:**
   ```bash
   # Copy to Home Assistant custom_components
   cp -r . ~/.homeassistant/custom_components/pet_health/
   # Or use symlink for development
   ln -s $(pwd) ~/.homeassistant/custom_components/pet_health
   ```

2. **Restart Home Assistant** after code changes

3. **Check logs:**
   ```bash
   # Enable debug logging in Home Assistant configuration.yaml:
   # logger:
   #   logs:
   #     custom_components.pet_health: debug
   ```

4. **Linting (if needed):**
   ```bash
   # Run pylint or ruff if available
   ruff check .
   pylint *.py
   ```

## Code Style and Conventions

### General Python
- Use type hints (from `__future__ import annotations`)
- Follow Home Assistant code style (similar to PEP 8)
- Use `logging.getLogger(__name__)` for logging
- Prefer `dt_util` from Home Assistant for datetime operations
- All timestamps should be timezone-aware using `dt_util.now()` or `dt_util.utcnow()`

### Home Assistant Patterns
- Use `async def` for all integration code (Home Assistant is async)
- Services are registered in `__init__.py` using `@hass.services.async_register()`
- Sensors extend `SensorEntity` from `homeassistant.components.sensor`
- Use `homeassistant.helpers.config_validation as cv` for validation
- Store data using `Store` from `homeassistant.helpers.storage`
- Fire events for UI updates: `hass.bus.async_fire("pet_health_data_updated")`

### Sensor Naming
- Format: `sensor.<pet_name>_<metric>`
  - `<pet_name>` is the pet's name in lowercase with spaces replaced by underscores
  - `<metric>` is the measurement type (e.g., `last_bathroom_visit`, `daily_visit_count`)
- Examples: `sensor.fluffy_last_bathroom_visit`, `sensor.mr_whiskers_daily_visit_count`
- Medication sensors: `sensor.<pet_name>_medication_<med_id>_last_dose`
  - `<med_id>` is the medication identifier configured in pet options

### Service Conventions
- All services accept `config_entry_id` to identify the pet
- `confirmed: false` visits allow omitting `config_entry_id` (for unknown pet detection)
- Use `vol.Schema` for service validation
- Return `ServiceResponse` when appropriate (e.g., for visit IDs)

### Data Persistence
- All persistent data stored via `Store` helper
- File: `.storage/pet_health_<config_entry_id>.json`
- Store saves automatically, but call `await store.async_save()` explicitly when needed
- Data includes visits, medications, assessments, weights, vomit incidents

## Boundaries and Restrictions

**DO:**
- Keep code async (use `async def`, `await`)
- Add proper type hints
- Use Home Assistant's built-in helpers (`cv`, `dt_util`, `Store`)
- Fire `pet_health_data_updated` events when data changes
- Validate all service inputs with voluptuous schemas
- Handle timezone-aware datetimes consistently

**DO NOT:**
- Add external dependencies (keep dependencies minimal per Home Assistant guidelines)
- Block the event loop (no synchronous I/O)
- Modify `.storage/` files directly (use Store API)
- Hard-code pet names or IDs (use config entries)
- Forget to handle the "unknown pet" case for unconfirmed visits
- Remove working sensors or services without migration path

## Testing Approach

**Note:** This repository currently has no automated test infrastructure.

For manual testing:
1. Install the integration in a development Home Assistant instance
2. Add a pet via the UI (Settings → Devices & Services → Add Integration → Pet Health)
3. Test services via Developer Tools → Services
4. Check sensor states in Developer Tools → States
5. Verify data persistence by restarting Home Assistant
6. Test the custom panel UI if modified

## Security Considerations

- No credentials or secrets should be stored
- Input validation is critical (use voluptuous schemas)
- All user input in services must be validated
- The integration uses local storage only (no external APIs)
- Sanitize any user input displayed in the UI to prevent XSS

## Special Features to Remember

### Unknown Pet Visits (AI Support)
- Services can log visits without `config_entry_id` when `confirmed: false`
- These appear in "Unknown Pet Visits" UI section
- Use `reassign_visit` service to assign to correct pet later

### Auto-refresh
- Frontend panel auto-refreshes via `pet_health_data_updated` event subscription
- Always fire this event after data changes: `hass.bus.async_fire("pet_health_data_updated")`

### Validation Rules
- When `confirmed: false`, bathroom visits don't require `did_pee` or `did_poop` to be true
- This allows AI detection systems to log visits even when uncertain

## Common Tasks

### Adding a New Sensor
1. Define sensor class in `sensor.py` extending `SensorEntity`
2. Set `_attr_name`, `_attr_unique_id`, `_attr_state_class`, etc.
3. Implement `native_value` property
4. Add to `async_setup_entry()` sensor list
5. Update README.md with new sensor documentation

### Adding a New Service
1. Define schema in `services.yaml` with fields and descriptions
2. Register service handler in `__init__.py` with `@hass.services.async_register()`
3. Validate input with voluptuous `vol.Schema`
4. Update data via Store
5. Fire `pet_health_data_updated` event
6. Update README.md with service example

### Modifying the Frontend Panel
1. Edit files in `www/` directory
2. Changes take effect after browser cache clear or hard refresh
3. Panel is registered in `panel.py` with static path

## Git Workflow

- Branch from `main` for features
- Keep commits focused and atomic
- Update README.md if adding user-facing features
- No specific PR template, but describe changes clearly
- Tag releases according to semantic versioning

---

**Remember:** This integration runs inside Home Assistant, so all code must be async, use Home Assistant patterns, and avoid blocking operations. When in doubt, check similar patterns in Home Assistant core or other integrations.
