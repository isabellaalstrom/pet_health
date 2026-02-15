"""Constants for the Pet Health integration."""

from enum import StrEnum

DOMAIN = "pet_health"

# Config entry data keys
CONF_PET_TYPE = "pet_type"
CONF_PET_NAME = "pet_name"
CONF_PET_ID = "pet_id"

# Storage
STORAGE_VERSION = 1
STORAGE_KEY = "pet_health_visits"

# Service names
SERVICE_LOG_LITTER_BOX_VISIT = "log_litter_box_visit"

# Service attributes
ATTR_CONFIG_ENTRY_ID = "config_entry_id"
ATTR_DID_PEE = "did_pee"
ATTR_DID_POOP = "did_poop"
ATTR_POOP_CONSISTENCIES = "poop_consistencies"
ATTR_POOP_COLOR = "poop_color"
ATTR_URINE_AMOUNT = "urine_amount"
ATTR_NOTES = "notes"


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
