"""Config flow for the Pet Health integration."""

from __future__ import annotations

from datetime import date
import logging
from typing import Any
from uuid import uuid4

import voluptuous as vol

from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    OptionsFlow,
)
from homeassistant.core import callback
from homeassistant.helpers.selector import (
    DateSelector,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
    TextSelector,
    TimeSelector,
)
from homeassistant.util import slugify

from .const import (
    CONF_MEDICATION_ACTIVE,
    CONF_MEDICATION_DOSAGE,
    CONF_MEDICATION_FREQUENCY,
    CONF_MEDICATION_ID,
    CONF_MEDICATION_NAME,
    CONF_MEDICATION_NOTES,
    CONF_MEDICATION_START_DATE,
    CONF_MEDICATION_TIMES,
    CONF_MEDICATION_UNIT,
    CONF_MEDICATIONS,
    CONF_PET_ID,
    CONF_PET_NAME,
    CONF_PET_TYPE,
    DOMAIN,
    MedicationFrequency,
    PetType,
)

_LOGGER = logging.getLogger(__name__)


class PetHealthConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Pet Health."""

    VERSION = 1
    MINOR_VERSION = 1

    def __init__(self) -> None:
        """Initialize the config flow."""
        self._pet_type: PetType | None = None

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> PetHealthOptionsFlow:
        """Get the options flow for this handler."""
        return PetHealthOptionsFlow()

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


class PetHealthOptionsFlow(OptionsFlow):
    """Handle options flow for Pet Health."""

    _medication_id: str | None = None
    _editing_medication: dict[str, Any] | None = None

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Manage medications."""
        return await self.async_step_medication_list()

    async def async_step_medication_list(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Show list of medications."""
        if user_input is not None:
            action = user_input.get("action")
            if action == "add":
                return await self.async_step_add_medication()
            if action and action.startswith("edit_"):
                self._medication_id = action[5:]
                medications = self.config_entry.options.get(CONF_MEDICATIONS, [])
                self._editing_medication = next(
                    (
                        m
                        for m in medications
                        if m[CONF_MEDICATION_ID] == self._medication_id
                    ),
                    None,
                )
                return await self.async_step_edit_medication()
            if action and action.startswith("delete_"):
                med_id = action[7:]
                medications = list(self.config_entry.options.get(CONF_MEDICATIONS, []))
                medications = [
                    m for m in medications if m[CONF_MEDICATION_ID] != med_id
                ]
                return self.async_create_entry(
                    title="",
                    data={CONF_MEDICATIONS: medications},
                )
            return self.async_create_entry(title="", data={})

        # Build medication list options
        medications = self.config_entry.options.get(CONF_MEDICATIONS, [])
        actions = [{"label": "Add new medication", "value": "add"}]

        for med in medications:
            status = "Active" if med.get(CONF_MEDICATION_ACTIVE, True) else "Inactive"
            dosage_info = f"{med.get(CONF_MEDICATION_DOSAGE, '')} {med.get(CONF_MEDICATION_UNIT, '')}".strip()
            label = f"{med[CONF_MEDICATION_NAME]} ({dosage_info}) - {status}"
            actions.append(
                {"label": f"✏️  {label}", "value": f"edit_{med[CONF_MEDICATION_ID]}"}
            )
            actions.append(
                {
                    "label": f"🗑️  Delete {med[CONF_MEDICATION_NAME]}",
                    "value": f"delete_{med[CONF_MEDICATION_ID]}",
                }
            )

        actions.append({"label": "Done", "value": "done"})

        return self.async_show_form(
            step_id="medication_list",
            data_schema=vol.Schema(
                {
                    vol.Required("action"): SelectSelector(
                        SelectSelectorConfig(
                            options=actions, mode=SelectSelectorMode.LIST
                        )
                    )
                }
            ),
            description_placeholders={"pet_name": self.config_entry.title},
        )

    async def async_step_add_medication(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Add a new medication."""
        errors: dict[str, str] = {}

        if user_input is not None:
            if not user_input.get(CONF_MEDICATION_NAME, "").strip():
                errors[CONF_MEDICATION_NAME] = "empty_name"
            else:
                medication = {
                    CONF_MEDICATION_ID: uuid4().hex,
                    CONF_MEDICATION_NAME: user_input[CONF_MEDICATION_NAME].strip(),
                    CONF_MEDICATION_DOSAGE: user_input.get(CONF_MEDICATION_DOSAGE, ""),
                    CONF_MEDICATION_UNIT: user_input.get(CONF_MEDICATION_UNIT, ""),
                    CONF_MEDICATION_FREQUENCY: user_input[CONF_MEDICATION_FREQUENCY],
                    CONF_MEDICATION_TIMES: user_input.get(CONF_MEDICATION_TIMES, []),
                    CONF_MEDICATION_START_DATE: user_input.get(
                        CONF_MEDICATION_START_DATE, str(date.today())
                    ),
                    CONF_MEDICATION_ACTIVE: True,
                    CONF_MEDICATION_NOTES: user_input.get(CONF_MEDICATION_NOTES, ""),
                }

                medications = list(self.config_entry.options.get(CONF_MEDICATIONS, []))
                medications.append(medication)

                return self.async_create_entry(
                    title="",
                    data={CONF_MEDICATIONS: medications},
                )

        return self.async_show_form(
            step_id="add_medication",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_MEDICATION_NAME): TextSelector(),
                    vol.Optional(CONF_MEDICATION_DOSAGE): TextSelector(),
                    vol.Optional(CONF_MEDICATION_UNIT): TextSelector(),
                    vol.Required(
                        CONF_MEDICATION_FREQUENCY, default=MedicationFrequency.DAILY
                    ): SelectSelector(
                        SelectSelectorConfig(
                            options=[freq.value for freq in MedicationFrequency],
                            translation_key="medication_frequency",
                        )
                    ),
                    vol.Optional(CONF_MEDICATION_TIMES): TimeSelector(),
                    vol.Optional(
                        CONF_MEDICATION_START_DATE, default=str(date.today())
                    ): DateSelector(),
                    vol.Optional(CONF_MEDICATION_NOTES): TextSelector(),
                }
            ),
            errors=errors,
        )

    async def async_step_edit_medication(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Edit an existing medication."""
        errors: dict[str, str] = {}

        if user_input is not None:
            if not user_input.get(CONF_MEDICATION_NAME, "").strip():
                errors[CONF_MEDICATION_NAME] = "empty_name"
            else:
                medications = list(self.config_entry.options.get(CONF_MEDICATIONS, []))
                for i, med in enumerate(medications):
                    if med[CONF_MEDICATION_ID] == self._medication_id:
                        medications[i] = {
                            CONF_MEDICATION_ID: self._medication_id,
                            CONF_MEDICATION_NAME: user_input[
                                CONF_MEDICATION_NAME
                            ].strip(),
                            CONF_MEDICATION_DOSAGE: user_input.get(
                                CONF_MEDICATION_DOSAGE, ""
                            ),
                            CONF_MEDICATION_UNIT: user_input.get(
                                CONF_MEDICATION_UNIT, ""
                            ),
                            CONF_MEDICATION_FREQUENCY: user_input[
                                CONF_MEDICATION_FREQUENCY
                            ],
                            CONF_MEDICATION_TIMES: user_input.get(
                                CONF_MEDICATION_TIMES, []
                            ),
                            CONF_MEDICATION_START_DATE: user_input.get(
                                CONF_MEDICATION_START_DATE, str(date.today())
                            ),
                            CONF_MEDICATION_ACTIVE: user_input.get(
                                CONF_MEDICATION_ACTIVE, True
                            ),
                            CONF_MEDICATION_NOTES: user_input.get(
                                CONF_MEDICATION_NOTES, ""
                            ),
                        }
                        break

                return self.async_create_entry(
                    title="",
                    data={CONF_MEDICATIONS: medications},
                )

        if not self._editing_medication:
            return await self.async_step_medication_list()

        return self.async_show_form(
            step_id="edit_medication",
            data_schema=vol.Schema(
                {
                    vol.Required(
                        CONF_MEDICATION_NAME,
                        default=self._editing_medication[CONF_MEDICATION_NAME],
                    ): TextSelector(),
                    vol.Optional(
                        CONF_MEDICATION_DOSAGE,
                        default=self._editing_medication.get(
                            CONF_MEDICATION_DOSAGE, ""
                        ),
                    ): TextSelector(),
                    vol.Optional(
                        CONF_MEDICATION_UNIT,
                        default=self._editing_medication.get(CONF_MEDICATION_UNIT, ""),
                    ): TextSelector(),
                    vol.Required(
                        CONF_MEDICATION_FREQUENCY,
                        default=self._editing_medication[CONF_MEDICATION_FREQUENCY],
                    ): SelectSelector(
                        SelectSelectorConfig(
                            options=[freq.value for freq in MedicationFrequency],
                            translation_key="medication_frequency",
                        )
                    ),
                    vol.Optional(
                        CONF_MEDICATION_TIMES,
                        default=self._editing_medication.get(CONF_MEDICATION_TIMES, []),
                    ): TimeSelector(),
                    vol.Optional(
                        CONF_MEDICATION_START_DATE,
                        default=self._editing_medication.get(
                            CONF_MEDICATION_START_DATE, str(date.today())
                        ),
                    ): DateSelector(),
                    vol.Optional(
                        CONF_MEDICATION_ACTIVE,
                        default=self._editing_medication.get(
                            CONF_MEDICATION_ACTIVE, True
                        ),
                    ): bool,
                    vol.Optional(
                        CONF_MEDICATION_NOTES,
                        default=self._editing_medication.get(CONF_MEDICATION_NOTES, ""),
                    ): TextSelector(),
                }
            ),
            errors=errors,
        )
