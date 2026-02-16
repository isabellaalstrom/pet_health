"""Panel for Pet Health integration."""

from __future__ import annotations

import logging

from homeassistant.components import panel_custom
from homeassistant.components.frontend import async_remove_panel
from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

PANEL_TITLE = "Pet Health"
PANEL_ICON = "mdi:paw"
PANEL_NAME = "pet_health"


async def async_register_panel(hass: HomeAssistant) -> None:
    """Register the Pet Health panel."""
    # Register the custom panel
    await panel_custom.async_register_panel(
        hass=hass,
        frontend_url_path=PANEL_NAME,
        webcomponent_name="pet-health-panel",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        module_url="/pet_health_panel/pet-health-panel.js",
        embed_iframe=False,
        require_admin=False,
    )

    _LOGGER.info("Pet Health panel registered")


async def async_unregister_panel(hass: HomeAssistant) -> None:
    """Unregister the Pet Health panel."""
    async_remove_panel(hass, PANEL_NAME)
    _LOGGER.info("Pet Health panel unregistered")
