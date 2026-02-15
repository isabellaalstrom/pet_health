"""Constants for the Pet Health integration."""

from enum import StrEnum

DOMAIN = "pet_health"

# Config entry data keys
CONF_PET_TYPE = "pet_type"
CONF_PET_NAME = "pet_name"
CONF_PET_ID = "pet_id"

# Options keys
CONF_MEDICATIONS = "medications"

# Medication config keys
CONF_MEDICATION_ID = "medication_id"
CONF_MEDICATION_NAME = "medication_name"
CONF_MEDICATION_DOSAGE = "dosage"
CONF_MEDICATION_UNIT = "unit"
CONF_MEDICATION_FREQUENCY = "frequency"
CONF_MEDICATION_TIMES = "times"
CONF_MEDICATION_START_DATE = "start_date"
CONF_MEDICATION_ACTIVE = "active"
CONF_MEDICATION_NOTES = "notes"

# Storage
STORAGE_VERSION = 1
STORAGE_KEY_VISITS = "pet_health_visits"
STORAGE_KEY_MEDICATIONS = "pet_health_medications"

# Service names
SERVICE_LOG_BATHROOM_VISIT = "log_bathroom_visit"
SERVICE_LOG_MEDICATION = "log_medication"

# Service attributes
ATTR_CONFIG_ENTRY_ID = "config_entry_id"
ATTR_DID_PEE = "did_pee"
ATTR_DID_POOP = "did_poop"
ATTR_POOP_CONSISTENCIES = "poop_consistencies"
ATTR_POOP_COLOR = "poop_color"
ATTR_URINE_AMOUNT = "urine_amount"
ATTR_NOTES = "notes"

# Medication service attributes
ATTR_MEDICATION_ID = "medication_id"
ATTR_MEDICATION_NAME = "medication_name"
ATTR_DOSAGE = "dosage"
ATTR_UNIT = "unit"
ATTR_REASON = "reason"
ATTR_GIVEN_AT = "given_at"


class PetType(StrEnum):
    """Pet type enum."""

    CAT = "cat"
    DOG = "dog"
    OTHER = "other"


class PoopConsistency(StrEnum):
    """Poop consistency options."""

    NORMAL = "normal"
    SOFT = "soft"
    DIARRHEA = "diarrhea"
    HARD = "hard"
    CONSTIPATED = "constipated"


class PoopColor(StrEnum):
    """Poop color options."""

    BROWN = "brown"
    DARK_BROWN = "dark_brown"
    LIGHT_BROWN = "light_brown"
    BLOODY = "bloody"
    GREEN = "green"
    YELLOW = "yellow"
    BLACK = "black"
    UNUSUAL = "unusual"


class UrineAmount(StrEnum):
    """Urine amount options."""

    NORMAL = "normal"
    MORE_THAN_USUAL = "more_than_usual"
    LESS_THAN_USUAL = "less_than_usual"


class MedicationFrequency(StrEnum):
    """Medication frequency options."""

    AS_NEEDED = "as_needed"
    DAILY = "daily"
    TWICE_DAILY = "twice_daily"
    THREE_TIMES_DAILY = "three_times_daily"
    EVERY_8_HOURS = "every_8_hours"
    EVERY_12_HOURS = "every_12_hours"
    WEEKLY = "weekly"
