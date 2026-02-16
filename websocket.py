"""WebSocket API for Pet Health integration."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
import logging

from .const import DOMAIN
from .store import PetHealthStore


@callback
def async_register_websocket_api(hass: HomeAssistant) -> None:
    """Register WebSocket API commands."""
    websocket_api.async_register_command(hass, handle_get_visits)
    websocket_api.async_register_command(hass, handle_get_pet_data)
    websocket_api.async_register_command(hass, handle_get_medications)
    websocket_api.async_register_command(hass, handle_get_store_dump)
    websocket_api.async_register_command(hass, handle_get_unknown_visits)


_LOGGER = logging.getLogger(__name__)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "pet_health/get_visits",
        vol.Optional("pet_id"): str,
    }
)
@websocket_api.async_response
async def handle_get_visits(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Handle get visits command."""
    store: PetHealthStore = hass.data[DOMAIN]["store"]

    pet_id = msg.get("pet_id")

    _LOGGER.debug("pet_health.get_visits called with msg=%s", msg)

    all_visits = []

    if pet_id:
        visits = store.get_visits(pet_id)
        all_visits = visits
    else:
        # Get all visits from all pets
        for entry in hass.config_entries.async_entries(DOMAIN):
            entry_pet_id = entry.data.get("pet_id")
            if entry_pet_id:
                visits = store.get_visits(entry_pet_id)
                all_visits.extend(visits)

    # Convert visits to JSON-serializable format
    visits_data = [
        {
            "visit_id": visit.visit_id,
            "timestamp": visit.timestamp.isoformat(),
            "pet_id": visit.pet_id,
            "did_pee": visit.did_pee,
            "did_poop": visit.did_poop,
            "confirmed": visit.confirmed,
            "poop_consistencies": visit.poop_consistencies,
            "poop_color": visit.poop_color,
            "urine_amount": visit.urine_amount,
            "notes": visit.notes,
        }
        for visit in all_visits
    ]

    # Sort by timestamp descending
    visits_data.sort(key=lambda v: v["timestamp"], reverse=True)

    _LOGGER.debug("pet_health.get_visits: returning %d visits", len(visits_data))

    connection.send_result(msg["id"], {"visits": visits_data})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "pet_health/get_pet_data",
        vol.Optional("entry_id"): str,
    }
)
@websocket_api.async_response
async def handle_get_pet_data(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Handle get pet data command."""
    store: PetHealthStore = hass.data[DOMAIN]["store"]

    entry_id = msg.get("entry_id")

    # Get config entries
    entries = []
    for entry in hass.config_entries.async_entries(DOMAIN):
        if entry_id and entry.entry_id != entry_id:
            continue

        # Include medications for this pet (if any)
        pet_medications = []
        entry_pet_id = entry.data.get("pet_id")
        if entry_pet_id:
            meds = store.get_medications(entry_pet_id)
            pet_medications = [
                {
                    "timestamp": m.timestamp.isoformat(),
                    "pet_id": m.pet_id,
                    "medication_name": m.medication_name,
                    "dosage": m.dosage,
                    "unit": m.unit,
                    "notes": m.notes,
                }
                for m in meds
            ]

        _LOGGER.debug(
            "pet_health.get_pet_data: entry=%s pet_id=%s meds_found=%d",
            entry.entry_id,
            entry_pet_id,
            len(pet_medications),
        )

        entries.append(
            {
                "entry_id": entry.entry_id,
                "title": entry.title,
                "pet_id": entry.data.get("pet_id"),
                "pet_name": entry.data.get("pet_name"),
                "pet_type": entry.data.get("pet_type"),
                "medications": pet_medications,
            }
        )

    connection.send_result(msg["id"], {"entries": entries})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "pet_health/get_medications",
        vol.Optional("pet_id"): str,
    }
)
@websocket_api.async_response
async def handle_get_medications(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Handle get medications command."""
    store: PetHealthStore = hass.data[DOMAIN]["store"]

    pet_id = msg.get("pet_id")

    _LOGGER.debug("pet_health.get_medications called with msg=%s", msg)

    all_medications = []

    if pet_id:
        meds = store.get_medications(pet_id)
        all_medications = meds
    else:
        for entry in hass.config_entries.async_entries(DOMAIN):
            entry_pet_id = entry.data.get("pet_id")
            if entry_pet_id:
                meds = store.get_medications(entry_pet_id)
                all_medications.extend(meds)

    meds_data = [
        {
            "timestamp": med.timestamp.isoformat(),
            "pet_id": med.pet_id,
            "medication_name": med.medication_name,
            "dosage": med.dosage,
            "unit": med.unit,
            "notes": med.notes,
        }
        for med in all_medications
    ]

    meds_data.sort(key=lambda m: m["timestamp"], reverse=True)

    _LOGGER.debug(
        "pet_health.get_medications: returning %d records for %d pets",
        len(meds_data),
        len({m["pet_id"] for m in meds_data}),
    )

    connection.send_result(msg["id"], {"medications": meds_data})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "pet_health/get_store_dump",
        vol.Optional("pet_id"): str,
    }
)
@websocket_api.async_response
async def handle_get_store_dump(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return all stored pet health data for one or all pets."""
    store: PetHealthStore = hass.data[DOMAIN]["store"]

    requested_pet = msg.get("pet_id")

    # Build set of pet ids to include: configured entries + any keys present in store
    pet_ids: set[str] = set()
    for entry in hass.config_entries.async_entries(DOMAIN):
        pid = entry.data.get("pet_id")
        if pid:
            pet_ids.add(pid)

    # include any pets that have data in store stores
    pet_ids.update(getattr(store, "_visits_data", {}).keys())
    pet_ids.update(getattr(store, "_medications_data", {}).keys())
    pet_ids.update(getattr(store, "_drinks_data", {}).keys())
    pet_ids.update(getattr(store, "_meals_data", {}).keys())
    pet_ids.update(getattr(store, "_thirst_levels_data", {}).keys())
    pet_ids.update(getattr(store, "_appetite_levels_data", {}).keys())
    pet_ids.update(getattr(store, "_wellbeing_data", {}).keys())
    pet_ids.update(getattr(store, "_weight_data", {}).keys())
    pet_ids.update(getattr(store, "_vomit_data", {}).keys())

    if requested_pet:
        pet_ids = {requested_pet}

    result: dict[str, Any] = {"data": {}}

    for pid in pet_ids:
        visits = [v.to_dict() for v in store.get_visits(pid)]
        medications = [m.to_dict() for m in store.get_medications(pid)]
        drinks = [d.to_dict() for d in store.get_drink_records(pid)]
        meals = [m.to_dict() for m in store.get_meal_records(pid)]
        thirst = [t.to_dict() for t in store.get_thirst_level_records(pid)]
        appetite = [a.to_dict() for a in store.get_appetite_level_records(pid)]
        wellbeing = [w.to_dict() for w in store.get_wellbeing_records(pid)]
        weight = [w.to_dict() for w in store.get_weight_records(pid)]
        vomit = [v.to_dict() for v in store.get_vomit_records(pid)]

        # sort each list by timestamp desc
        for lst in (
            visits,
            medications,
            drinks,
            meals,
            thirst,
            appetite,
            wellbeing,
            weight,
            vomit,
        ):
            lst.sort(key=lambda x: x.get("timestamp", ""), reverse=True)

        result["data"][pid] = {
            "visits": visits,
            "medications": medications,
            "drinks": drinks,
            "meals": meals,
            "thirst_levels": thirst,
            "appetite_levels": appetite,
            "wellbeing": wellbeing,
            "weight": weight,
            "vomit": vomit,
        }

        _LOGGER.debug(
            "pet_health.get_store_dump: pet=%s counts=%s",
            pid,
            {
                "visits": len(visits),
                "medications": len(medications),
                "drinks": len(drinks),
                "meals": len(meals),
                "thirst": len(thirst),
                "appetite": len(appetite),
                "wellbeing": len(wellbeing),
                "weight": len(weight),
                "vomit": len(vomit),
            },
        )

    _LOGGER.debug("pet_health.get_store_dump: returning %d pets", len(result["data"]))

    connection.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "pet_health/get_unknown_visits",
    }
)
@websocket_api.async_response
async def handle_get_unknown_visits(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Handle get unknown visits command."""
    from .const import UNKNOWN_ENTRY_ID
    
    store: PetHealthStore = hass.data[DOMAIN]["store"]

    _LOGGER.debug("pet_health.get_unknown_visits called")

    # Get visits with unknown entry_id
    unknown_visits = store.get_visits(UNKNOWN_ENTRY_ID)

    # Convert visits to JSON-serializable format
    visits_data = [
        {
            "visit_id": visit.visit_id,
            "timestamp": visit.timestamp.isoformat(),
            "pet_id": visit.pet_id,
            "did_pee": visit.did_pee,
            "did_poop": visit.did_poop,
            "confirmed": visit.confirmed,
            "poop_consistencies": visit.poop_consistencies,
            "poop_color": visit.poop_color,
            "urine_amount": visit.urine_amount,
            "notes": visit.notes,
        }
        for visit in unknown_visits
    ]

    # Sort by timestamp descending
    visits_data.sort(key=lambda v: v["timestamp"], reverse=True)

    _LOGGER.debug("pet_health.get_unknown_visits: returning %d visits", len(visits_data))

    connection.send_result(msg["id"], {"visits": visits_data})
