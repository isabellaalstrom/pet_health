"""Constants for the Pet Health integration."""

from enum import StrEnum

DOMAIN = "pet_health"

# Special entry ID for unknown pets (for unconfirmed visits)
UNKNOWN_ENTRY_ID = "00000000-0000-0000-0000-000000000000"

# Event types for data updates
EVENT_PET_HEALTH_DATA_UPDATED = "pet_health_data_updated"

# Config entry data keys
CONF_PET_TYPE = "pet_type"
CONF_PET_NAME = "pet_name"
CONF_PET_ID = "pet_id"
CONF_PET_IMAGE_PATH = "pet_image_path"

# Options keys
CONF_MEDICATIONS = "medications"
CONF_GENERIC_LOG_CATEGORIES = "generic_log_categories"

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

# Generic log category config keys
CONF_CATEGORY_ID = "category_id"
CONF_CATEGORY_NAME = "category_name"

# Storage
STORAGE_VERSION = 1
STORAGE_KEY_VISITS = "pet_health_visits"
STORAGE_KEY_MEDICATIONS = "pet_health_medications"
STORAGE_KEY_DRINKS = "pet_health_drinks"
STORAGE_KEY_MEALS = "pet_health_meals"
STORAGE_KEY_THIRST_LEVELS = "pet_health_thirst_levels"
STORAGE_KEY_APPETITE_LEVELS = "pet_health_appetite_levels"
STORAGE_KEY_WELLBEING = "pet_health_wellbeing"
STORAGE_KEY_WEIGHT = "pet_health_weight"
STORAGE_KEY_VOMIT = "pet_health_vomit"
STORAGE_KEY_GENERIC_LOGS = "pet_health_generic_logs"

# Service names
SERVICE_LOG_BATHROOM_VISIT = "log_bathroom_visit"
SERVICE_LOG_MEDICATION = "log_medication"
SERVICE_CONFIRM_VISIT = "confirm_visit"
SERVICE_REASSIGN_VISIT = "reassign_visit"
SERVICE_DELETE_VISIT = "delete_visit"
SERVICE_AMEND_VISIT = "amend_visit"
SERVICE_LOG_DRINK = "log_drink"
SERVICE_LOG_MEAL = "log_meal"
SERVICE_LOG_THIRST = "log_thirst"
SERVICE_LOG_APPETITE = "log_appetite"
SERVICE_LOG_WELLBEING = "log_wellbeing"
SERVICE_LOG_WEIGHT = "log_weight"
SERVICE_LOG_VOMIT = "log_vomit"
SERVICE_LOG_GENERIC = "log_generic"

# Service attributes
ATTR_CONFIG_ENTRY_ID = "config_entry_id"
ATTR_DID_PEE = "did_pee"
ATTR_DID_POOP = "did_poop"
ATTR_POOP_CONSISTENCIES = "poop_consistencies"
ATTR_POOP_COLOR = "poop_color"
ATTR_URINE_AMOUNT = "urine_amount"
ATTR_NOTES = "notes"
ATTR_CONFIRMED = "confirmed"
ATTR_VISIT_ID = "visit_id"

# Medication service attributes
ATTR_MEDICATION_ID = "medication_id"
ATTR_MEDICATION_NAME = "medication_name"
ATTR_DOSAGE = "dosage"
ATTR_UNIT = "unit"
ATTR_REASON = "reason"
ATTR_GIVEN_AT = "given_at"

# Thirst/Hunger/Wellbeing attributes
ATTR_AMOUNT = "amount"
ATTR_FOOD_TYPE = "food_type"
ATTR_LEVEL = "level"
ATTR_WELLBEING_SCORE = "wellbeing_score"
ATTR_SYMPTOMS = "symptoms"
ATTR_LOGGED_AT = "logged_at"

# Weight and vomiting attributes
ATTR_WEIGHT_GRAMS = "weight_grams"
ATTR_VOMIT_TYPE = "vomit_type"

# Generic log attributes
ATTR_CATEGORY = "category"
ATTR_CATEGORY_ID = "category_id"


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


class ConsumptionAmount(StrEnum):
    """Amount consumed (food/water)."""

    SMALL = "small"
    NORMAL = "normal"
    LARGE = "large"


class WellbeingScore(StrEnum):
    """General wellbeing score."""

    POOR = "poor"
    FAIR = "fair"
    GOOD = "good"
    EXCELLENT = "excellent"


class LevelState(StrEnum):
    """Appetite and thirst level states."""

    NORMAL = "normal"
    LESSENED = "lessened"
    INCREASED = "increased"


class VomitType(StrEnum):
    """Types of vomiting."""

    HAIRBALL = "hairball"
    FOOD = "food"
    BILE = "bile"
    OTHER = "other"
