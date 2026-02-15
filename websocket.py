"""WebSocket API for Pet Health integration."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import DOMAIN
from .store import PetHealthStore


@callback
def async_register_websocket_api(hass: HomeAssistant) -> None:
    """Register WebSocket API commands."""
    websocket_api.async_register_command(hass, handle_get_visits)
    websocket_api.async_register_command(hass, handle_get_pet_data)


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

        entries.append(
            {
                "entry_id": entry.entry_id,
                "title": entry.title,
                "pet_id": entry.data.get("pet_id"),
                "pet_name": entry.data.get("pet_name"),
                "pet_type": entry.data.get("pet_type"),
            }
        )

    connection.send_result(msg["id"], {"entries": entries})
