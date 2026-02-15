"""The Pet Health integration."""

from __future__ import annotations

from datetime import datetime
import logging

import voluptuous as vol

from homeassistant.const import Platform
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv
from homeassistant.util import dt as dt_util

from .const import (
    ATTR_CONFIG_ENTRY_ID,
    ATTR_DID_PEE,
    ATTR_DID_POOP,
    ATTR_NOTES,
    ATTR_POOP_COLOR,
    ATTR_POOP_CONSISTENCIES,
    ATTR_URINE_AMOUNT,
    CONF_PET_ID,
    CONF_PET_NAME,
    CONF_PET_TYPE,
    DOMAIN,
    SERVICE_LOG_LITTER_BOX_VISIT,
    PetType,
    PoopColor,
    PoopConsistency,
    UrineAmount,
)
from .models import LitterBoxVisit, PetData, PetHealthConfigEntry
from .store import PetHealthStore

_LOGGER = logging.getLogger(__name__)

# Platforms to set up
_PLATFORMS: list[Platform] = [Platform.SENSOR]

# Schema for log_litter_box_visit service
SERVICE_LOG_LITTER_BOX_VISIT_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_CONFIG_ENTRY_ID): cv.string,
        vol.Optional(ATTR_DID_PEE, default=False): cv.boolean,
        vol.Optional(ATTR_DID_POOP, default=False): cv.boolean,
        vol.Optional(ATTR_POOP_CONSISTENCIES): vol.All(
            cv.ensure_list, [vol.In([c.value for c in PoopConsistency])]
        ),
        vol.Optional(ATTR_POOP_COLOR): vol.In([c.value for c in PoopColor]),
        vol.Optional(ATTR_URINE_AMOUNT): vol.In([a.value for a in UrineAmount]),
        vol.Optional(ATTR_NOTES): cv.string,
    }
)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the Pet Health integration."""
    # Initialize storage
    store = PetHealthStore(hass)
    await store.async_load()
    hass.data[DOMAIN] = {"store": store}

    async def handle_log_litter_box_visit(call: ServiceCall) -> None:
        """Handle the log_litter_box_visit service call."""
        entry_id = call.data[ATTR_CONFIG_ENTRY_ID]
        entry = hass.config_entries.async_get_entry(entry_id)

        if not entry:
            raise HomeAssistantError(f"Config entry {entry_id} not found")

        if entry.domain != DOMAIN:
            raise HomeAssistantError(
                f"Config entry {entry_id} is not a pet_health entry"
            )

        pet_data: PetData = entry.runtime_data
        did_pee = call.data.get(ATTR_DID_PEE, False)
        did_poop = call.data.get(ATTR_DID_POOP, False)

        # Validate that at least one action was selected
        if not did_pee and not did_poop:
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
        visit = LitterBoxVisit(
            timestamp=dt_util.now(),
            pet_id=pet_data.pet_id,
            did_pee=did_pee,
            did_poop=did_poop,
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
            " and ".join(actions),
            pet_data.name,
            visit.timestamp,
        )

    # Register service
    hass.services.async_register(
        DOMAIN,
        SERVICE_LOG_LITTER_BOX_VISIT,
        handle_log_litter_box_visit,
        schema=SERVICE_LOG_LITTER_BOX_VISIT_SCHEMA,
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

    return True


async def async_unload_entry(hass: HomeAssistant, entry: PetHealthConfigEntry) -> bool:
    """Unload a config entry."""
    if _PLATFORMS:
        return await hass.config_entries.async_unload_platforms(entry, _PLATFORMS)
    return True
