"""Config flow for the Pet Health integration."""

from __future__ import annotations

import logging
from typing import Any
from uuid import uuid4

import voluptuous as vol

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult
from homeassistant.helpers.selector import SelectSelector, SelectSelectorConfig
from homeassistant.util import slugify

from .const import CONF_PET_ID, CONF_PET_NAME, CONF_PET_TYPE, DOMAIN, PetType

_LOGGER = logging.getLogger(__name__)


class PetHealthConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Pet Health."""

    VERSION = 1
    MINOR_VERSION = 1

    def __init__(self) -> None:
        """Initialize the config flow."""
        self._pet_type: PetType | None = None

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Handle the initial step - select pet type."""
        if user_input is not None:
            self._pet_type = PetType(user_input[CONF_PET_TYPE])
            return await self.async_step_name()

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_PET_TYPE): SelectSelector(
                        SelectSelectorConfig(
                            options=[pet_type.value for pet_type in PetType],
                            translation_key=CONF_PET_TYPE,
                        )
                    )
                }
            ),
        )

    async def async_step_name(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Handle the name step - enter pet name."""
        errors: dict[str, str] = {}

        if user_input is not None:
            pet_name = user_input[CONF_PET_NAME].strip()

            if not pet_name:
                errors[CONF_PET_NAME] = "empty_name"
            else:
                # Use slugified name as unique_id to prevent duplicates
                await self.async_set_unique_id(slugify(pet_name))
                self._abort_if_unique_id_configured()

                # Generate stable UUID for pet_id
                pet_id = uuid4().hex

                return self.async_create_entry(
                    title=pet_name,
                    data={
                        CONF_PET_ID: pet_id,
                        CONF_PET_NAME: pet_name,
                        CONF_PET_TYPE: self._pet_type,
                    },
                )

        return self.async_show_form(
            step_id="name",
            data_schema=vol.Schema({vol.Required(CONF_PET_NAME): str}),
            errors=errors,
        )

