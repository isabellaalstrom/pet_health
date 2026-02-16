"""The Pet Health integration."""

from __future__ import annotations

from datetime import datetime
import logging
import os

import voluptuous as vol

from homeassistant.components.http import StaticPathConfig
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant, ServiceCall, ServiceResponse
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv
from homeassistant.util import dt as dt_util

from .const import (
    ATTR_AMOUNT,
    ATTR_CONFIG_ENTRY_ID,
    ATTR_CONFIRMED,
    ATTR_DID_PEE,
    ATTR_DID_POOP,
    ATTR_DOSAGE,
    ATTR_FOOD_TYPE,
    ATTR_GIVEN_AT,
    ATTR_LEVEL,
    ATTR_LOGGED_AT,
    ATTR_MEDICATION_ID,
    ATTR_MEDICATION_NAME,
    ATTR_NOTES,
    ATTR_POOP_COLOR,
    ATTR_POOP_CONSISTENCIES,
    ATTR_REASON,
    ATTR_SYMPTOMS,
    ATTR_UNIT,
    ATTR_URINE_AMOUNT,
    ATTR_VISIT_ID,
    ATTR_VOMIT_TYPE,
    ATTR_WEIGHT_GRAMS,
    ATTR_WELLBEING_SCORE,
    CONF_MEDICATION_DOSAGE,
    CONF_MEDICATION_ID,
    CONF_MEDICATION_NAME,
    CONF_MEDICATION_UNIT,
    CONF_MEDICATIONS,
    CONF_PET_ID,
    CONF_PET_NAME,
    CONF_PET_TYPE,
    DOMAIN,
    SERVICE_AMEND_VISIT,
    SERVICE_CONFIRM_VISIT,
    SERVICE_DELETE_VISIT,
    SERVICE_LOG_APPETITE,
    SERVICE_LOG_BATHROOM_VISIT,
    SERVICE_LOG_DRINK,
    SERVICE_LOG_MEAL,
    SERVICE_LOG_MEDICATION,
    SERVICE_LOG_THIRST,
    SERVICE_LOG_VOMIT,
    SERVICE_LOG_WEIGHT,
    SERVICE_LOG_WELLBEING,
    SERVICE_REASSIGN_VISIT,
    UNKNOWN_ENTRY_ID,
    ConsumptionAmount,
    LevelState,
    PetType,
    PoopColor,
    PoopConsistency,
    UrineAmount,
    VomitType,
    WellbeingScore,
)
from .models import (
    AppetiteLevelRecord,
    BathroomVisit,
    DrinkRecord,
    MealRecord,
    MedicationRecord,
    PetData,
    PetHealthConfigEntry,
    ThirstLevelRecord,
    VomitRecord,
    WeightRecord,
    WellbeingRecord,
)
from .store import PetHealthStore
from . import panel
from . import websocket

_LOGGER = logging.getLogger(__name__)

# Platforms to set up
_PLATFORMS: list[Platform] = [Platform.SENSOR]

# Schema for log_bathroom_visit service
SERVICE_LOG_BATHROOM_VISIT_SCHEMA = vol.Schema(
    {
        vol.Optional(ATTR_CONFIG_ENTRY_ID): cv.string,
        vol.Optional(ATTR_DID_PEE, default=False): cv.boolean,
        vol.Optional(ATTR_DID_POOP, default=False): cv.boolean,
        vol.Optional(
            ATTR_CONFIRMED, default=True
        ): cv.boolean,  # Default True for manual logs
        vol.Optional(ATTR_POOP_CONSISTENCIES): vol.All(
            cv.ensure_list, [vol.In([c.value for c in PoopConsistency])]
        ),
        vol.Optional(ATTR_POOP_COLOR): vol.In([c.value for c in PoopColor]),
        vol.Optional(ATTR_URINE_AMOUNT): vol.In([a.value for a in UrineAmount]),
        vol.Optional(ATTR_NOTES): cv.string,
        vol.Optional(ATTR_LOGGED_AT): cv.datetime,
    }
)

# Schema for log_medication service
SERVICE_LOG_MEDICATION_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_CONFIG_ENTRY_ID): cv.string,
        vol.Required(ATTR_MEDICATION_ID): cv.string,
        vol.Optional(ATTR_GIVEN_AT): cv.datetime,
        vol.Optional(ATTR_DOSAGE): cv.string,
        vol.Optional(ATTR_UNIT): cv.string,
        vol.Optional(ATTR_NOTES): cv.string,
    }
)

# Schema for confirm_visit service
SERVICE_CONFIRM_VISIT_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_VISIT_ID): cv.string,
    }
)

# Schema for reassign_visit service
SERVICE_REASSIGN_VISIT_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_VISIT_ID): cv.string,
        vol.Required(ATTR_CONFIG_ENTRY_ID): cv.string,  # New pet
    }
)

# Schema for delete_visit service
SERVICE_DELETE_VISIT_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_VISIT_ID): cv.string,
    }
)

# Schema for amend_visit service
SERVICE_AMEND_VISIT_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_VISIT_ID): cv.string,
        vol.Optional(ATTR_DID_PEE): cv.boolean,
        vol.Optional(ATTR_DID_POOP): cv.boolean,
        vol.Optional(ATTR_POOP_CONSISTENCIES): vol.All(
            cv.ensure_list, [vol.In([c.value for c in PoopConsistency])]
        ),
        vol.Optional(ATTR_POOP_COLOR): vol.In([c.value for c in PoopColor]),
        vol.Optional(ATTR_URINE_AMOUNT): vol.In([a.value for a in UrineAmount]),
        vol.Optional(ATTR_NOTES): cv.string,
    }
)

# Schema for log_drink service (water consumption)
SERVICE_LOG_DRINK_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_CONFIG_ENTRY_ID): cv.string,
        vol.Optional(ATTR_AMOUNT, default="normal"): vol.In(
            [a.value for a in ConsumptionAmount]
        ),
        vol.Optional(ATTR_LOGGED_AT): cv.datetime,
        vol.Optional(ATTR_NOTES): cv.string,
    }
)

# Schema for log_meal service (food consumption)
SERVICE_LOG_MEAL_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_CONFIG_ENTRY_ID): cv.string,
        vol.Optional(ATTR_AMOUNT, default="normal"): vol.In(
            [a.value for a in ConsumptionAmount]
        ),
        vol.Optional(ATTR_FOOD_TYPE): cv.string,
        vol.Optional(ATTR_LOGGED_AT): cv.datetime,
        vol.Optional(ATTR_NOTES): cv.string,
    }
)

# Schema for log_thirst service (thirst level assessment)
SERVICE_LOG_THIRST_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_CONFIG_ENTRY_ID): cv.string,
        vol.Optional(ATTR_LEVEL, default="normal"): vol.In(
            [l.value for l in LevelState]
        ),
        vol.Optional(ATTR_LOGGED_AT): cv.datetime,
        vol.Optional(ATTR_NOTES): cv.string,
    }
)

# Schema for log_appetite service (appetite level assessment)
SERVICE_LOG_APPETITE_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_CONFIG_ENTRY_ID): cv.string,
        vol.Optional(ATTR_LEVEL, default="normal"): vol.In(
            [l.value for l in LevelState]
        ),
        vol.Optional(ATTR_LOGGED_AT): cv.datetime,
        vol.Optional(ATTR_NOTES): cv.string,
    }
)

# Schema for log_wellbeing service
SERVICE_LOG_WELLBEING_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_CONFIG_ENTRY_ID): cv.string,
        vol.Required(ATTR_WELLBEING_SCORE): vol.In([s.value for s in WellbeingScore]),
        vol.Optional(ATTR_SYMPTOMS): vol.All(cv.ensure_list, [cv.string]),
        vol.Optional(ATTR_LOGGED_AT): cv.datetime,
        vol.Optional(ATTR_NOTES): cv.string,
    }
)

# Schema for log_weight service
SERVICE_LOG_WEIGHT_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_CONFIG_ENTRY_ID): cv.string,
        vol.Required(ATTR_WEIGHT_GRAMS): vol.All(
            vol.Coerce(int), vol.Range(min=100, max=50000)
        ),
        vol.Optional(ATTR_LOGGED_AT): cv.datetime,
        vol.Optional(ATTR_NOTES): cv.string,
    }
)

# Schema for log_vomit service
SERVICE_LOG_VOMIT_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_CONFIG_ENTRY_ID): cv.string,
        vol.Optional(ATTR_VOMIT_TYPE, default="other"): vol.In(
            [v.value for v in VomitType]
        ),
        vol.Optional(ATTR_LOGGED_AT): cv.datetime,
        vol.Optional(ATTR_NOTES): cv.string,
    }
)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the Pet Health integration."""
    # Initialize storage
    store = PetHealthStore(hass)
    await store.async_load()
    hass.data[DOMAIN] = {"store": store}

    # Register the www directory for serving panel assets
    www_dir = os.path.join(os.path.dirname(__file__), "www")
    await hass.http.async_register_static_paths(
        [StaticPathConfig("/pet_health_panel", www_dir, cache_headers=False)]
    )

    # Register the frontend panel
    await panel.async_register_panel(hass)

    # Register WebSocket API
    websocket.async_register_websocket_api(hass)

    async def handle_log_bathroom_visit(call: ServiceCall) -> ServiceResponse:
        """Handle the log_bathroom_visit service call."""
        entry_id = call.data.get(ATTR_CONFIG_ENTRY_ID)
        confirmed = call.data.get(ATTR_CONFIRMED, True)
        
        # If entry_id is not provided or is empty/unknown, and confirmed is False, use UNKNOWN_ENTRY_ID
        if not entry_id or entry_id == UNKNOWN_ENTRY_ID:
            if confirmed:
                raise HomeAssistantError(
                    "config_entry_id is required for confirmed visits"
                )
            entry_id = UNKNOWN_ENTRY_ID
            pet_id = UNKNOWN_ENTRY_ID
            pet_name = "Unknown Pet"
        else:
            entry = hass.config_entries.async_get_entry(entry_id)

            if not entry:
                raise HomeAssistantError(f"Config entry {entry_id} not found")

            if entry.domain != DOMAIN:
                raise HomeAssistantError(
                    f"Config entry {entry_id} is not a pet_health entry"
                )

            pet_data: PetData = entry.runtime_data
            pet_id = pet_data.pet_id
            pet_name = pet_data.name

        did_pee = call.data.get(ATTR_DID_PEE, False)
        did_poop = call.data.get(ATTR_DID_POOP, False)

        # Validate that at least one action was selected (only for confirmed visits)
        if confirmed and not did_pee and not did_poop:
            raise HomeAssistantError("You must select at least pee or poop")

        # Apply defaults based on what was done
        poop_consistencies = call.data.get(ATTR_POOP_CONSISTENCIES, [])
        if not poop_consistencies and did_poop:
            poop_consistencies = [PoopConsistency.NORMAL]
        else:
            poop_consistencies = [PoopConsistency(c) for c in poop_consistencies]

        poop_color = call.data.get(ATTR_POOP_COLOR)
        if not poop_color and did_poop:
            poop_color = PoopColor.BROWN
        elif poop_color:
            poop_color = PoopColor(poop_color)

        urine_amount = call.data.get(ATTR_URINE_AMOUNT)
        if not urine_amount and did_pee:
            urine_amount = UrineAmount.NORMAL
        elif urine_amount:
            urine_amount = UrineAmount(urine_amount)

        # Create visit record
        # Determine timestamp (use provided logged_at or current time)
        logged_at = call.data.get(ATTR_LOGGED_AT)
        if logged_at is None:
            timestamp = dt_util.now()
        else:
            timestamp = dt_util.as_utc(logged_at)

        # Create visit record
        visit = BathroomVisit(
            timestamp=timestamp,
            pet_id=pet_id,
            did_pee=did_pee,
            did_poop=did_poop,
            confirmed=confirmed,
            poop_consistencies=poop_consistencies,
            poop_color=poop_color,
            urine_amount=urine_amount,
            notes=call.data.get(ATTR_NOTES),
        )

        # Save to storage
        await store.async_save_visit(visit)
        actions = []
        if did_pee:
            actions.append("pee")
        if did_poop:
            actions.append("poop")
        _LOGGER.info(
            "Logged %s visit for %s at %s",
            " and ".join(actions) if actions else "bathroom",
            pet_name,
            visit.timestamp,
        )

        return {
            "visit_id": visit.visit_id,
            "timestamp": visit.timestamp.isoformat(),
            "pet_name": pet_name,
        }

    async def handle_log_medication(call: ServiceCall) -> ServiceResponse:
        """Handle the log_medication service call."""
        entry_id = call.data[ATTR_CONFIG_ENTRY_ID]
        entry = hass.config_entries.async_get_entry(entry_id)

        if not entry:
            raise HomeAssistantError(f"Config entry {entry_id} not found")

        if entry.domain != DOMAIN:
            raise HomeAssistantError(
                f"Config entry {entry_id} is not a pet_health entry"
            )

        pet_data: PetData = entry.runtime_data

        # Look up medication configuration
        medication_id = call.data[ATTR_MEDICATION_ID]
        medications = entry.options.get(CONF_MEDICATIONS, [])
        medication_config = next(
            (m for m in medications if m[CONF_MEDICATION_ID] == medication_id),
            None,
        )

        if not medication_config:
            raise HomeAssistantError(
                f"Medication {medication_id} not found in configuration"
            )

        # Use provided timestamp or current time
        given_at_raw = call.data.get(ATTR_GIVEN_AT)
        _LOGGER.debug(
            "Received given_at: %s (type: %s)", given_at_raw, type(given_at_raw)
        )

        if given_at_raw is None:
            timestamp = dt_util.now()
            _LOGGER.debug("No given_at provided, using current time: %s", timestamp)
        else:
            timestamp = given_at_raw
            if not timestamp.tzinfo:
                timestamp = dt_util.as_utc(timestamp)
            _LOGGER.debug("Using provided timestamp: %s", timestamp)

        # Create medication record using configured medication info
        # Allow dosage and unit to be overridden per dose, defaulting to config
        medication = MedicationRecord(
            timestamp=timestamp,
            pet_id=pet_data.pet_id,
            medication_name=medication_config[CONF_MEDICATION_NAME],
            dosage=call.data.get(ATTR_DOSAGE) or medication_config.get(CONF_MEDICATION_DOSAGE),
            unit=call.data.get(ATTR_UNIT) or medication_config.get(CONF_MEDICATION_UNIT),
            reason=None,  # Not storing reason per dose
            notes=call.data.get(ATTR_NOTES),
        )

        # Save to storage
        await store.async_save_medication(medication)
        _LOGGER.info(
            "Logged %s medication for %s at %s",
            medication.medication_name,
            pet_data.name,
            medication.timestamp,
        )

        return {
            "medication_id": medication_id,
            "medication_name": medication_config[CONF_MEDICATION_NAME],
            "timestamp": medication.timestamp.isoformat(),
            "pet_name": pet_data.name,
        }

    async def handle_confirm_visit(call: ServiceCall) -> ServiceResponse:
        """Handle the confirm_visit service call."""
        visit_id = call.data[ATTR_VISIT_ID]

        def confirm(visit: BathroomVisit) -> None:
            visit.confirmed = True

        if await store.async_update_visit(visit_id, confirm):
            _LOGGER.info("Confirmed visit %s", visit_id)
            return {"visit_id": visit_id, "confirmed": True}
        else:
            raise HomeAssistantError(f"Visit {visit_id} not found")

    async def handle_reassign_visit(call: ServiceCall) -> ServiceResponse:
        """Handle the reassign_visit service call."""
        visit_id = call.data[ATTR_VISIT_ID]
        new_entry_id = call.data[ATTR_CONFIG_ENTRY_ID]
        new_entry = hass.config_entries.async_get_entry(new_entry_id)

        if not new_entry:
            raise HomeAssistantError(f"Config entry {new_entry_id} not found")

        if new_entry.domain != DOMAIN:
            raise HomeAssistantError(
                f"Config entry {new_entry_id} is not a pet_health entry"
            )

        new_pet_data: PetData = new_entry.runtime_data

        def reassign(visit: BathroomVisit) -> None:
            visit.pet_id = new_pet_data.pet_id
            visit.confirmed = True  # Auto-confirm when manually reassigned

        if await store.async_update_visit(visit_id, reassign):
            _LOGGER.info("Reassigned visit %s to %s", visit_id, new_pet_data.name)
            return {
                "visit_id": visit_id,
                "new_pet_name": new_pet_data.name,
                "confirmed": True,
            }
        else:
            raise HomeAssistantError(f"Visit {visit_id} not found")

    async def handle_delete_visit(call: ServiceCall) -> ServiceResponse:
        """Handle the delete_visit service call."""
        visit_id = call.data[ATTR_VISIT_ID]

        if await store.async_delete_visit(visit_id):
            _LOGGER.info("Deleted visit %s", visit_id)
            return {"visit_id": visit_id, "deleted": True}
        else:
            raise HomeAssistantError(f"Visit {visit_id} not found")

    async def handle_amend_visit(call: ServiceCall) -> ServiceResponse:
        """Handle the amend_visit service call."""
        visit_id = call.data[ATTR_VISIT_ID]

        def amend(visit: BathroomVisit) -> None:
            # Update only the fields that were provided
            if ATTR_DID_PEE in call.data:
                visit.did_pee = call.data[ATTR_DID_PEE]
            if ATTR_DID_POOP in call.data:
                visit.did_poop = call.data[ATTR_DID_POOP]
            if ATTR_POOP_CONSISTENCIES in call.data:
                visit.poop_consistencies = call.data[ATTR_POOP_CONSISTENCIES]
            if ATTR_POOP_COLOR in call.data:
                visit.poop_color = call.data[ATTR_POOP_COLOR]
            if ATTR_URINE_AMOUNT in call.data:
                visit.urine_amount = call.data[ATTR_URINE_AMOUNT]
            if ATTR_NOTES in call.data:
                visit.notes = call.data[ATTR_NOTES]

        if await store.async_update_visit(visit_id, amend):
            _LOGGER.info("Amended visit %s", visit_id)
            return {"visit_id": visit_id, "amended": True}
        else:
            raise HomeAssistantError(f"Visit {visit_id} not found")

    async def handle_log_drink(call: ServiceCall) -> ServiceResponse:
        """Handle the log_drink service call (water consumption)."""
        entry_id = call.data[ATTR_CONFIG_ENTRY_ID]
        entry = hass.config_entries.async_get_entry(entry_id)

        if not entry:
            raise HomeAssistantError(f"Config entry {entry_id} not found")

        if entry.domain != DOMAIN:
            raise HomeAssistantError(
                f"Config entry {entry_id} is not a pet_health entry"
            )

        pet_data: PetData = entry.runtime_data

        # Get timestamp (use provided or current)
        logged_at = call.data.get(ATTR_LOGGED_AT)
        if logged_at is None:
            logged_at = dt_util.now()
        else:
            logged_at = dt_util.as_utc(logged_at)

        # Create drink record
        record = DrinkRecord(
            timestamp=logged_at,
            pet_id=pet_data.pet_id,
            amount=ConsumptionAmount(call.data.get(ATTR_AMOUNT, "normal")),
            notes=call.data.get(ATTR_NOTES),
        )

        await store.async_save_drink(record)
        _LOGGER.info(
            "Logged drink (%s) for %s at %s",
            record.amount,
            pet_data.name,
            record.timestamp,
        )

        return {
            "timestamp": record.timestamp.isoformat(),
            "pet_name": pet_data.name,
            "amount": record.amount,
        }

    async def handle_log_meal(call: ServiceCall) -> ServiceResponse:
        """Handle the log_meal service call (food consumption)."""
        entry_id = call.data[ATTR_CONFIG_ENTRY_ID]
        entry = hass.config_entries.async_get_entry(entry_id)

        if not entry:
            raise HomeAssistantError(f"Config entry {entry_id} not found")

        if entry.domain != DOMAIN:
            raise HomeAssistantError(
                f"Config entry {entry_id} is not a pet_health entry"
            )

        pet_data: PetData = entry.runtime_data

        # Get timestamp (use provided or current)
        logged_at = call.data.get(ATTR_LOGGED_AT)
        if logged_at is None:
            logged_at = dt_util.now()
        else:
            logged_at = dt_util.as_utc(logged_at)

        # Create meal record
        record = MealRecord(
            timestamp=logged_at,
            pet_id=pet_data.pet_id,
            amount=ConsumptionAmount(call.data.get(ATTR_AMOUNT, "normal")),
            food_type=call.data.get(ATTR_FOOD_TYPE),
            notes=call.data.get(ATTR_NOTES),
        )

        await store.async_save_meal(record)
        _LOGGER.info(
            "Logged meal (%s) for %s at %s",
            record.amount,
            pet_data.name,
            record.timestamp,
        )

        return {
            "timestamp": record.timestamp.isoformat(),
            "pet_name": pet_data.name,
            "amount": record.amount,
        }

    async def handle_log_thirst(call: ServiceCall) -> ServiceResponse:
        """Handle the log_thirst service call (thirst level assessment)."""
        entry_id = call.data[ATTR_CONFIG_ENTRY_ID]
        entry = hass.config_entries.async_get_entry(entry_id)

        if not entry:
            raise HomeAssistantError(f"Config entry {entry_id} not found")

        if entry.domain != DOMAIN:
            raise HomeAssistantError(
                f"Config entry {entry_id} is not a pet_health entry"
            )

        pet_data: PetData = entry.runtime_data

        # Get timestamp (use provided or current)
        logged_at = call.data.get(ATTR_LOGGED_AT)
        if logged_at is None:
            logged_at = dt_util.now()
        else:
            logged_at = dt_util.as_utc(logged_at)

        # Create thirst level record
        record = ThirstLevelRecord(
            timestamp=logged_at,
            pet_id=pet_data.pet_id,
            level=LevelState(call.data.get(ATTR_LEVEL, "normal")),
            notes=call.data.get(ATTR_NOTES),
        )

        await store.async_save_thirst_level(record)
        _LOGGER.info(
            "Logged thirst level (%s) for %s at %s",
            record.level,
            pet_data.name,
            record.timestamp,
        )

        return {
            "timestamp": record.timestamp.isoformat(),
            "pet_name": pet_data.name,
            "level": record.level,
        }

    async def handle_log_appetite(call: ServiceCall) -> ServiceResponse:
        """Handle the log_appetite service call (appetite level assessment)."""
        entry_id = call.data[ATTR_CONFIG_ENTRY_ID]
        entry = hass.config_entries.async_get_entry(entry_id)

        if not entry:
            raise HomeAssistantError(f"Config entry {entry_id} not found")

        if entry.domain != DOMAIN:
            raise HomeAssistantError(
                f"Config entry {entry_id} is not a pet_health entry"
            )

        pet_data: PetData = entry.runtime_data

        # Get timestamp (use provided or current)
        logged_at = call.data.get(ATTR_LOGGED_AT)
        if logged_at is None:
            logged_at = dt_util.now()
        else:
            logged_at = dt_util.as_utc(logged_at)

        # Create appetite level record
        record = AppetiteLevelRecord(
            timestamp=logged_at,
            pet_id=pet_data.pet_id,
            level=LevelState(call.data.get(ATTR_LEVEL, "normal")),
            notes=call.data.get(ATTR_NOTES),
        )

        await store.async_save_appetite_level(record)
        _LOGGER.info(
            "Logged appetite level (%s) for %s at %s",
            record.level,
            pet_data.name,
            record.timestamp,
        )

        return {
            "timestamp": record.timestamp.isoformat(),
            "pet_name": pet_data.name,
            "level": record.level,
        }

    async def handle_log_wellbeing(call: ServiceCall) -> ServiceResponse:
        """Handle the log_wellbeing service call."""
        entry_id = call.data[ATTR_CONFIG_ENTRY_ID]
        entry = hass.config_entries.async_get_entry(entry_id)

        if not entry:
            raise HomeAssistantError(f"Config entry {entry_id} not found")

        if entry.domain != DOMAIN:
            raise HomeAssistantError(
                f"Config entry {entry_id} is not a pet_health entry"
            )

        pet_data: PetData = entry.runtime_data

        # Get timestamp (use provided or current)
        logged_at = call.data.get(ATTR_LOGGED_AT)
        if logged_at is None:
            logged_at = dt_util.now()
        else:
            logged_at = dt_util.as_utc(logged_at)

        # Create wellbeing record
        record = WellbeingRecord(
            timestamp=logged_at,
            pet_id=pet_data.pet_id,
            wellbeing_score=WellbeingScore(call.data[ATTR_WELLBEING_SCORE]),
            symptoms=call.data.get(ATTR_SYMPTOMS, []),
            notes=call.data.get(ATTR_NOTES),
        )

        await store.async_save_wellbeing(record)
        _LOGGER.info(
            "Logged wellbeing (%s) for %s at %s",
            record.wellbeing_score,
            pet_data.name,
            record.timestamp,
        )

        return {
            "timestamp": record.timestamp.isoformat(),
            "pet_name": pet_data.name,
            "wellbeing_score": record.wellbeing_score,
        }

    async def handle_log_weight(call: ServiceCall) -> ServiceResponse:
        """Handle the log_weight service call."""
        entry_id = call.data[ATTR_CONFIG_ENTRY_ID]
        entry = hass.config_entries.async_get_entry(entry_id)

        if not entry:
            raise HomeAssistantError(f"Config entry {entry_id} not found")

        if entry.domain != DOMAIN:
            raise HomeAssistantError(
                f"Config entry {entry_id} is not a pet_health entry"
            )

        pet_data: PetData = entry.runtime_data

        # Get timestamp (use provided or current)
        logged_at = call.data.get(ATTR_LOGGED_AT)
        if logged_at is None:
            logged_at = dt_util.now()
        else:
            logged_at = dt_util.as_utc(logged_at)

        # Create weight record
        record = WeightRecord(
            timestamp=logged_at,
            pet_id=pet_data.pet_id,
            weight_grams=call.data[ATTR_WEIGHT_GRAMS],
            notes=call.data.get(ATTR_NOTES),
        )

        await store.async_save_weight(record)

        # Calculate weight change over last 7 and 30 days
        weight_records = store.get_weight_records(pet_data.pet_id)
        weight_change_7d = None
        weight_change_30d = None

        if len(weight_records) >= 2:
            # Sort by timestamp descending
            sorted_records = sorted(
                weight_records, key=lambda r: r.timestamp, reverse=True
            )
            current_weight = sorted_records[0].weight_grams

            # Find weight from 7 days ago
            for old_record in reversed(sorted_records[1:]):
                days_ago = (logged_at - old_record.timestamp).days
                if days_ago >= 7:
                    weight_change_7d = current_weight - old_record.weight_grams
                    break

            # Find weight from 30 days ago
            for old_record in reversed(sorted_records[1:]):
                days_ago = (logged_at - old_record.timestamp).days
                if days_ago >= 30:
                    weight_change_30d = current_weight - old_record.weight_grams
                    break

        _LOGGER.info(
            "Logged weight (%d grams) for %s at %s",
            record.weight_grams,
            pet_data.name,
            record.timestamp,
        )

        response = {
            "timestamp": record.timestamp.isoformat(),
            "pet_name": pet_data.name,
            "weight_grams": record.weight_grams,
        }
        if weight_change_7d is not None:
            response["weight_change_7d"] = weight_change_7d
        if weight_change_30d is not None:
            response["weight_change_30d"] = weight_change_30d

        return response

    async def handle_log_vomit(call: ServiceCall) -> ServiceResponse:
        """Handle the log_vomit service call."""
        entry_id = call.data[ATTR_CONFIG_ENTRY_ID]
        entry = hass.config_entries.async_get_entry(entry_id)

        if not entry:
            raise HomeAssistantError(f"Config entry {entry_id} not found")

        if entry.domain != DOMAIN:
            raise HomeAssistantError(
                f"Config entry {entry_id} is not a pet_health entry"
            )

        pet_data: PetData = entry.runtime_data

        # Get timestamp (use provided or current)
        logged_at = call.data.get(ATTR_LOGGED_AT)
        if logged_at is None:
            logged_at = dt_util.now()
        else:
            logged_at = dt_util.as_utc(logged_at)

        # Create vomit record
        record = VomitRecord(
            timestamp=logged_at,
            pet_id=pet_data.pet_id,
            vomit_type=VomitType(call.data.get(ATTR_VOMIT_TYPE, "other")),
            notes=call.data.get(ATTR_NOTES),
        )

        await store.async_save_vomit(record)
        _LOGGER.info(
            "Logged vomiting (%s) for %s at %s",
            record.vomit_type,
            pet_data.name,
            record.timestamp,
        )

        return {
            "timestamp": record.timestamp.isoformat(),
            "pet_name": pet_data.name,
            "vomit_type": record.vomit_type,
        }

    # Register services
    hass.services.async_register(
        DOMAIN,
        SERVICE_LOG_BATHROOM_VISIT,
        handle_log_bathroom_visit,
        schema=SERVICE_LOG_BATHROOM_VISIT_SCHEMA,
        supports_response=True,
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_LOG_MEDICATION,
        handle_log_medication,
        schema=SERVICE_LOG_MEDICATION_SCHEMA,
        supports_response=True,
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_CONFIRM_VISIT,
        handle_confirm_visit,
        schema=SERVICE_CONFIRM_VISIT_SCHEMA,
        supports_response=True,
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_REASSIGN_VISIT,
        handle_reassign_visit,
        schema=SERVICE_REASSIGN_VISIT_SCHEMA,
        supports_response=True,
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_DELETE_VISIT,
        handle_delete_visit,
        schema=SERVICE_DELETE_VISIT_SCHEMA,
        supports_response=True,
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_AMEND_VISIT,
        handle_amend_visit,
        schema=SERVICE_AMEND_VISIT_SCHEMA,
        supports_response=True,
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_LOG_DRINK,
        handle_log_drink,
        schema=SERVICE_LOG_DRINK_SCHEMA,
        supports_response=True,
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_LOG_MEAL,
        handle_log_meal,
        schema=SERVICE_LOG_MEAL_SCHEMA,
        supports_response=True,
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_LOG_THIRST,
        handle_log_thirst,
        schema=SERVICE_LOG_THIRST_SCHEMA,
        supports_response=True,
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_LOG_APPETITE,
        handle_log_appetite,
        schema=SERVICE_LOG_APPETITE_SCHEMA,
        supports_response=True,
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_LOG_WELLBEING,
        handle_log_wellbeing,
        schema=SERVICE_LOG_WELLBEING_SCHEMA,
        supports_response=True,
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_LOG_WEIGHT,
        handle_log_weight,
        schema=SERVICE_LOG_WEIGHT_SCHEMA,
        supports_response=True,
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_LOG_VOMIT,
        handle_log_vomit,
        schema=SERVICE_LOG_VOMIT_SCHEMA,
        supports_response=True,
    )

    return True


async def async_setup_entry(hass: HomeAssistant, entry: PetHealthConfigEntry) -> bool:
    """Set up Pet Health from a config entry."""
    # Create PetData from config entry
    pet_data = PetData(
        pet_id=entry.data[CONF_PET_ID],
        name=entry.data[CONF_PET_NAME],
        pet_type=PetType(entry.data[CONF_PET_TYPE]),
    )

    # Store in runtime_data for access by platforms
    # This is where a coordinator would go in the future for event handling
    entry.runtime_data = pet_data

    # Forward to platforms when they exist
    if _PLATFORMS:
        await hass.config_entries.async_forward_entry_setups(entry, _PLATFORMS)

    # Listen for options updates and reload entry (to create new medication sensors)
    entry.async_on_unload(entry.add_update_listener(async_reload_entry))

    return True


async def async_reload_entry(hass: HomeAssistant, entry: PetHealthConfigEntry) -> None:
    """Reload the config entry when options change."""
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: PetHealthConfigEntry) -> bool:
    """Unload a config entry."""
    if _PLATFORMS:
        return await hass.config_entries.async_unload_platforms(entry, _PLATFORMS)
    return True
