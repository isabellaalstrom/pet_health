"""Sensor platform for Pet Health integration."""

from __future__ import annotations

from datetime import datetime, timedelta

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorStateClass,
)
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.util import dt as dt_util

from .const import CONF_MEDICATIONS, DOMAIN
from .models import BathroomVisit, MedicationRecord, PetHealthConfigEntry
from .store import PetHealthStore


async def async_setup_entry(
    hass: HomeAssistant,
    entry: PetHealthConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up Pet Health sensors."""
    store: PetHealthStore = hass.data[DOMAIN]["store"]
    pet_data = entry.runtime_data

    sensors: list[SensorEntity] = [
        LastVisitTimestampSensor(entry, store, pet_data.pet_id),
        DailyVisitCountSensor(entry, store, pet_data.pet_id),
        WeeklyVisitCountSensor(entry, store, pet_data.pet_id),
        HoursSinceLastVisitSensor(entry, store, pet_data.pet_id),
        LastPoopConsistencySensor(entry, store, pet_data.pet_id),
        LastPoopColorSensor(entry, store, pet_data.pet_id),
        LastUrineAmountSensor(entry, store, pet_data.pet_id),
        DailyPeeCountSensor(entry, store, pet_data.pet_id),
        DailyPoopCountSensor(entry, store, pet_data.pet_id),
        UnconfirmedVisitsCountSensor(entry, store, pet_data.pet_id),
        # Drink sensors (consumption)
        LastDrinkTimestampSensor(entry, store, pet_data.pet_id),
        DailyDrinkCountSensor(entry, store, pet_data.pet_id),
        LastDrinkAmountSensor(entry, store, pet_data.pet_id),
        # Meal sensors (consumption)
        LastMealTimestampSensor(entry, store, pet_data.pet_id),
        DailyMealCountSensor(entry, store, pet_data.pet_id),
        LastMealAmountSensor(entry, store, pet_data.pet_id),
        # Thirst level sensors (symptoms/state)
        LastThirstLevelTimestampSensor(entry, store, pet_data.pet_id),
        CurrentThirstLevelSensor(entry, store, pet_data.pet_id),
        # Appetite level sensors (symptoms/state)
        LastAppetiteLevelTimestampSensor(entry, store, pet_data.pet_id),
        CurrentAppetiteLevelSensor(entry, store, pet_data.pet_id),
        # Wellbeing sensors
        LastWellbeingAssessmentSensor(entry, store, pet_data.pet_id),
        CurrentWellbeingScoreSensor(entry, store, pet_data.pet_id),
    ]

    # Add medication sensors for each configured medication
    medications = entry.options.get(CONF_MEDICATIONS, [])
    for medication in medications:
        med_id = medication["medication_id"]
        med_name = medication["medication_name"]
        sensors.extend(
            [
                LastMedicationDoseSensor(
                    entry, store, pet_data.pet_id, med_id, med_name
                ),
                DailyMedicationCountSensor(
                    entry, store, pet_data.pet_id, med_id, med_name
                ),
            ]
        )

    async_add_entities(sensors)


class PetHealthSensorBase(SensorEntity):
    """Base class for Pet Health sensors."""

    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(
        self, entry: PetHealthConfigEntry, store: PetHealthStore, pet_id: str
    ) -> None:
        """Initialize the sensor."""
        self._entry = entry
        self._store = store
        self._pet_id = pet_id
        self._pet_data = entry.runtime_data
        self._attr_device_info = self._pet_data.device_info()
        self._remove_update_tracker = None
        # Common attributes for all pet health sensors
        self._attr_extra_state_attributes = {
            "pet": self._pet_data.name,
            "integration": DOMAIN,
        }

    async def async_added_to_hass(self) -> None:
        """Register callbacks when entity is added."""
        # Update every minute to refresh time-based sensors
        self._remove_update_tracker = async_track_time_interval(
            self.hass, self._async_update, timedelta(minutes=1)
        )
        # Listen for storage updates
        self._store.register_update_callback(self._pet_id, self._async_update)
        # Initial update
        self._update_from_store()

    async def async_will_remove_from_hass(self) -> None:
        """Clean up when entity is removed."""
        if self._remove_update_tracker:
            self._remove_update_tracker()
        self._store.unregister_update_callback(self._pet_id, self._async_update)

    @callback
    def _async_update(self, _=None) -> None:
        """Update the sensor."""
        self._update_from_store()
        self.async_write_ha_state()

    def _update_from_store(self) -> None:
        """Update sensor value from store."""
        # Override in subclasses
        pass

    def _get_visits(self) -> list[BathroomVisit]:
        """Get all visits for this pet."""
        return self._store.get_visits(self._pet_id)

    def _get_visits_since(self, since: datetime) -> list[BathroomVisit]:
        """Get visits since a given time."""
        visits = self._get_visits()
        # Ensure both timestamps are timezone-aware for comparison
        since_aware = dt_util.as_utc(since) if since.tzinfo is None else since
        return [
            v
            for v in visits
            if (
                dt_util.as_utc(v.timestamp)
                if v.timestamp.tzinfo is None
                else v.timestamp
            )
            >= since_aware
        ]

    def _get_medications(self) -> list[MedicationRecord]:
        """Get all medication records for this pet."""
        return self._store.get_medications(self._pet_id)

    def _get_medications_since(self, since: datetime) -> list[MedicationRecord]:
        """Get medication records since a given time."""
        medications = self._get_medications()
        # Ensure both timestamps are timezone-aware for comparison
        since_aware = dt_util.as_utc(since) if since.tzinfo is None else since
        return [
            m
            for m in medications
            if (
                dt_util.as_utc(m.timestamp)
                if m.timestamp.tzinfo is None
                else m.timestamp
            )
            >= since_aware
        ]


class LastVisitTimestampSensor(PetHealthSensorBase):
    """Sensor showing the timestamp of the last bathroom visit."""

    _attr_translation_key = "last_bathroom_visit"
    _attr_device_class = SensorDeviceClass.TIMESTAMP

    def __init__(
        self, entry: PetHealthConfigEntry, store: PetHealthStore, pet_id: str
    ) -> None:
        """Initialize the sensor."""
        super().__init__(entry, store, pet_id)
        self._attr_unique_id = f"{pet_id}_last_bathroom_visit"

    def _update_from_store(self) -> None:
        """Update the sensor value."""
        visits = self._get_visits()
        if visits:
            last_visit = visits[-1]
            # Ensure timestamp is timezone-aware
            timestamp = last_visit.timestamp
            if timestamp.tzinfo is None:
                timestamp = dt_util.as_utc(timestamp)
            self._attr_native_value = timestamp
            # Merge with base attributes (pet, integration)
            self._attr_extra_state_attributes = {
                **self._attr_extra_state_attributes,  # Base attributes (pet, integration)
                "visit_id": last_visit.visit_id,
                "confirmed": last_visit.confirmed,
                "did_pee": last_visit.did_pee,
                "did_poop": last_visit.did_poop,
                "poop_consistencies": last_visit.poop_consistencies,
                "poop_color": last_visit.poop_color,
                "urine_amount": last_visit.urine_amount,
                "notes": last_visit.notes,
            }
        else:
            self._attr_native_value = None
            # Keep base attributes even when no visits
            self._attr_extra_state_attributes = {
                "pet": self._pet_data.name,
                "integration": DOMAIN,
            }


class DailyVisitCountSensor(PetHealthSensorBase):
    """Sensor counting bathroom visits today."""

    _attr_translation_key = "daily_visit_count"
    _attr_state_class = SensorStateClass.TOTAL_INCREASING
    _attr_native_unit_of_measurement = "visits"
    _attr_icon = "mdi:counter"

    def __init__(
        self, entry: PetHealthConfigEntry, store: PetHealthStore, pet_id: str
    ) -> None:
        """Initialize the sensor."""
        super().__init__(entry, store, pet_id)
        self._attr_unique_id = f"{pet_id}_daily_visit_count"

    def _update_from_store(self) -> None:
        """Update the sensor value."""
        now = dt_util.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        visits_today = self._get_visits_since(today_start)
        self._attr_native_value = len(visits_today)


class WeeklyVisitCountSensor(PetHealthSensorBase):
    """Sensor counting bathroom visits this week."""

    _attr_translation_key = "weekly_visit_count"
    _attr_state_class = SensorStateClass.TOTAL
    _attr_native_unit_of_measurement = "visits"
    _attr_icon = "mdi:calendar-week"

    def __init__(
        self, entry: PetHealthConfigEntry, store: PetHealthStore, pet_id: str
    ) -> None:
        """Initialize the sensor."""
        super().__init__(entry, store, pet_id)
        self._attr_unique_id = f"{pet_id}_weekly_visit_count"

    def _update_from_store(self) -> None:
        """Update the sensor value."""
        now = dt_util.now()
        week_start = now - timedelta(days=7)
        visits_this_week = self._get_visits_since(week_start)
        self._attr_native_value = len(visits_this_week)


class HoursSinceLastVisitSensor(PetHealthSensorBase):
    """Sensor showing hours since last bathroom visit."""

    _attr_translation_key = "hours_since_last_visit"
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_native_unit_of_measurement = "h"
    _attr_device_class = SensorDeviceClass.DURATION
    _attr_suggested_display_precision = 1

    def __init__(
        self, entry: PetHealthConfigEntry, store: PetHealthStore, pet_id: str
    ) -> None:
        """Initialize the sensor."""
        super().__init__(entry, store, pet_id)
        self._attr_unique_id = f"{pet_id}_hours_since_last_visit"

    def _update_from_store(self) -> None:
        """Update the sensor value."""
        visits = self._get_visits()
        if visits:
            last_visit = visits[-1]
            # Ensure both timestamps are timezone-aware
            last_timestamp = (
                dt_util.as_utc(last_visit.timestamp)
                if last_visit.timestamp.tzinfo is None
                else last_visit.timestamp
            )
            time_diff = dt_util.now() - last_timestamp
            self._attr_native_value = time_diff.total_seconds() / 3600
        else:
            self._attr_native_value = None


class LastPoopConsistencySensor(PetHealthSensorBase):
    """Sensor showing the consistency of the last poop."""

    _attr_translation_key = "last_poop_consistency"
    _attr_icon = "mdi:texture"

    def __init__(
        self, entry: PetHealthConfigEntry, store: PetHealthStore, pet_id: str
    ) -> None:
        """Initialize the sensor."""
        super().__init__(entry, store, pet_id)
        self._attr_unique_id = f"{pet_id}_last_poop_consistency"

    def _update_from_store(self) -> None:
        """Update the sensor value."""
        visits = self._get_visits()
        # Find most recent visit with poop
        for visit in reversed(visits):
            if visit.poop_consistencies:
                # Join multiple consistencies with arrow to show progression
                # Order matters: enter them chronologically (e.g., normal, then diarrhea)
                self._attr_native_value = " → ".join(visit.poop_consistencies)
                self._attr_extra_state_attributes = {
                    "consistencies": visit.poop_consistencies,
                    "visit_timestamp": visit.timestamp.isoformat(),
                }
                return
        self._attr_native_value = None
        self._attr_extra_state_attributes = {}


class LastPoopColorSensor(PetHealthSensorBase):
    """Sensor showing the color of the last poop."""

    _attr_translation_key = "last_poop_color"
    _attr_icon = "mdi:palette"

    def __init__(
        self, entry: PetHealthConfigEntry, store: PetHealthStore, pet_id: str
    ) -> None:
        """Initialize the sensor."""
        super().__init__(entry, store, pet_id)
        self._attr_unique_id = f"{pet_id}_last_poop_color"

    def _update_from_store(self) -> None:
        """Update the sensor value."""
        visits = self._get_visits()
        # Find most recent visit with poop color
        for visit in reversed(visits):
            if visit.poop_color:
                self._attr_native_value = visit.poop_color
                self._attr_extra_state_attributes = {
                    "visit_timestamp": visit.timestamp.isoformat()
                }
                return
        self._attr_native_value = None
        self._attr_extra_state_attributes = {}


class LastUrineAmountSensor(PetHealthSensorBase):
    """Sensor showing the amount of urine in the last pee."""

    _attr_translation_key = "last_urine_amount"
    _attr_icon = "mdi:water"

    def __init__(
        self, entry: PetHealthConfigEntry, store: PetHealthStore, pet_id: str
    ) -> None:
        """Initialize the sensor."""
        super().__init__(entry, store, pet_id)
        self._attr_unique_id = f"{pet_id}_last_urine_amount"

    def _update_from_store(self) -> None:
        """Update the sensor value."""
        visits = self._get_visits()
        # Find most recent visit with urine amount
        for visit in reversed(visits):
            if visit.urine_amount:
                self._attr_native_value = visit.urine_amount
                self._attr_extra_state_attributes = {
                    "visit_timestamp": visit.timestamp.isoformat()
                }
                return
        self._attr_native_value = None
        self._attr_extra_state_attributes = {}


class DailyPeeCountSensor(PetHealthSensorBase):
    """Sensor counting pee visits today."""

    _attr_translation_key = "daily_pee_count"
    _attr_state_class = SensorStateClass.TOTAL_INCREASING
    _attr_native_unit_of_measurement = "visits"
    _attr_icon = "mdi:water"

    def __init__(
        self, entry: PetHealthConfigEntry, store: PetHealthStore, pet_id: str
    ) -> None:
        """Initialize the sensor."""
        super().__init__(entry, store, pet_id)
        self._attr_unique_id = f"{pet_id}_daily_pee_count"

    def _update_from_store(self) -> None:
        """Update the sensor value."""
        now = dt_util.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        visits_today = self._get_visits_since(today_start)
        pee_visits = [v for v in visits_today if v.did_pee]
        self._attr_native_value = len(pee_visits)


class DailyPoopCountSensor(PetHealthSensorBase):
    """Sensor counting poop visits today."""

    _attr_translation_key = "daily_poop_count"
    _attr_state_class = SensorStateClass.TOTAL_INCREASING
    _attr_native_unit_of_measurement = "visits"
    _attr_icon = "mdi:texture"

    def __init__(
        self, entry: PetHealthConfigEntry, store: PetHealthStore, pet_id: str
    ) -> None:
        """Initialize the sensor."""
        super().__init__(entry, store, pet_id)
        self._attr_unique_id = f"{pet_id}_daily_poop_count"

    def _update_from_store(self) -> None:
        """Update the sensor value."""
        now = dt_util.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        visits_today = self._get_visits_since(today_start)
        poop_visits = [v for v in visits_today if v.did_poop]
        self._attr_native_value = len(poop_visits)


class UnconfirmedVisitsCountSensor(PetHealthSensorBase):
    """Sensor counting unconfirmed bathroom visits."""

    _attr_translation_key = "unconfirmed_visits_count"
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_native_unit_of_measurement = "visits"
    _attr_icon = "mdi:alert-circle"

    def __init__(
        self, entry: PetHealthConfigEntry, store: PetHealthStore, pet_id: str
    ) -> None:
        """Initialize the sensor."""
        super().__init__(entry, store, pet_id)
        self._attr_unique_id = f"{pet_id}_unconfirmed_visits_count"

    def _update_from_store(self) -> None:
        """Update the sensor value."""
        visits = self._get_visits()
        unconfirmed_visits = [v for v in visits if not v.confirmed]
        self._attr_native_value = len(unconfirmed_visits)

        # Add list of unconfirmed visits with details to attributes
        visits_list = []
        for visit in unconfirmed_visits:
            visit_info = {
                "visit_id": visit.visit_id,
                "timestamp": visit.timestamp.isoformat(),
                "did_pee": visit.did_pee,
                "did_poop": visit.did_poop,
            }
            if visit.poop_consistencies:
                visit_info["poop_consistencies"] = visit.poop_consistencies
            if visit.poop_color:
                visit_info["poop_color"] = visit.poop_color
            if visit.urine_amount:
                visit_info["urine_amount"] = visit.urine_amount
            if visit.notes:
                visit_info["notes"] = visit.notes
            visits_list.append(visit_info)

        # Sort by timestamp (oldest first)
        visits_list.sort(key=lambda x: x["timestamp"])
        self._attr_extra_state_attributes["unconfirmed_visits"] = visits_list


class LastMedicationDoseSensor(PetHealthSensorBase):
    """Sensor showing the timestamp of the last medication dose."""

    _attr_device_class = SensorDeviceClass.TIMESTAMP

    def __init__(
        self,
        entry: PetHealthConfigEntry,
        store: PetHealthStore,
        pet_id: str,
        medication_id: str,
        medication_name: str,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(entry, store, pet_id)
        self._medication_id = medication_id
        self._medication_name = medication_name
        self._attr_unique_id = f"{pet_id}_medication_{medication_id}_last_dose"
        self._attr_translation_key = "last_medication_dose"
        self._attr_translation_placeholders = {
            "medication_name": medication_name,
        }

    def _update_from_store(self) -> None:
        """Update the sensor value."""
        medications = self._get_medications()
        # Filter by medication name
        med_doses = [
            m for m in medications if m.medication_name == self._medication_name
        ]

        if med_doses:
            last_dose = max(med_doses, key=lambda m: m.timestamp)
            self._attr_native_value = dt_util.as_utc(last_dose.timestamp)
            # Update attributes while preserving base attributes
            self._attr_extra_state_attributes = {
                "pet": self._pet_data.name,
                "integration": DOMAIN,
                "medication_id": self._medication_id,
                "medication_name": last_dose.medication_name,
                "dosage": last_dose.dosage,
                "unit": last_dose.unit,
                "notes": last_dose.notes,
            }
        else:
            self._attr_native_value = None
            self._attr_extra_state_attributes = {
                "pet": self._pet_data.name,
                "integration": DOMAIN,
                "medication_id": self._medication_id,
            }


class DailyMedicationCountSensor(PetHealthSensorBase):
    """Sensor counting medication doses given today."""

    _attr_state_class = SensorStateClass.TOTAL_INCREASING
    _attr_native_unit_of_measurement = "doses"
    _attr_icon = "mdi:pill"

    def __init__(
        self,
        entry: PetHealthConfigEntry,
        store: PetHealthStore,
        pet_id: str,
        medication_id: str,
        medication_name: str,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(entry, store, pet_id)
        self._medication_id = medication_id
        self._medication_name = medication_name
        self._attr_unique_id = f"{pet_id}_medication_{medication_id}_daily_count"
        self._attr_translation_key = "daily_medication_count"
        self._attr_translation_placeholders = {
            "medication_name": medication_name,
        }

    def _update_from_store(self) -> None:
        """Update the sensor value."""
        now = dt_util.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        medications_today = self._get_medications_since(today_start)
        # Filter by medication name
        med_doses_today = [
            m for m in medications_today if m.medication_name == self._medication_name
        ]
        self._attr_native_value = len(med_doses_today)


# Thirst Sensors


class LastDrinkTimestampSensor(PetHealthSensorBase):
    """Sensor showing the timestamp of the last drink."""

    _attr_translation_key = "last_drink"
    _attr_device_class = SensorDeviceClass.TIMESTAMP

    def __init__(
        self, entry: PetHealthConfigEntry, store: PetHealthStore, pet_id: str
    ) -> None:
        """Initialize the sensor."""
        super().__init__(entry, store, pet_id)
        self._attr_unique_id = f"{pet_id}_last_drink"

    def _update_from_store(self) -> None:
        """Update the sensor value."""
        records = self._store.get_drink_records(self._pet_id)
        if records:
            last_record = records[-1]
            timestamp = last_record.timestamp
            if timestamp.tzinfo is None:
                timestamp = dt_util.as_utc(timestamp)
            self._attr_native_value = timestamp
            self._attr_extra_state_attributes = {
                **self._attr_extra_state_attributes,
                "amount": last_record.amount,
                "notes": last_record.notes,
            }
        else:
            self._attr_native_value = None
            self._attr_extra_state_attributes = {
                "pet": self._pet_data.name,
                "integration": DOMAIN,
            }


class DailyDrinkCountSensor(PetHealthSensorBase):
    """Sensor counting drinks today."""

    _attr_translation_key = "daily_drink_count"
    _attr_state_class = SensorStateClass.TOTAL_INCREASING
    _attr_native_unit_of_measurement = "drinks"
    _attr_icon = "mdi:cup-water"

    def __init__(
        self, entry: PetHealthConfigEntry, store: PetHealthStore, pet_id: str
    ) -> None:
        """Initialize the sensor."""
        super().__init__(entry, store, pet_id)
        self._attr_unique_id = f"{pet_id}_daily_drink_count"

    def _update_from_store(self) -> None:
        """Update the sensor value."""
        records = self._store.get_drink_records(self._pet_id)
        now = dt_util.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        drinks_today = [
            r
            for r in records
            if (
                dt_util.as_utc(r.timestamp)
                if r.timestamp.tzinfo is None
                else r.timestamp
            )
            >= today_start
        ]
        self._attr_native_value = len(drinks_today)


class LastDrinkAmountSensor(PetHealthSensorBase):
    """Sensor showing the amount of the last drink."""

    _attr_translation_key = "last_drink_amount"
    _attr_icon = "mdi:water"

    def __init__(
        self, entry: PetHealthConfigEntry, store: PetHealthStore, pet_id: str
    ) -> None:
        """Initialize the sensor."""
        super().__init__(entry, store, pet_id)
        self._attr_unique_id = f"{pet_id}_last_drink_amount"

    def _update_from_store(self) -> None:
        """Update the sensor value."""
        records = self._store.get_drink_records(self._pet_id)
        if records:
            last_record = records[-1]
            self._attr_native_value = last_record.amount
        else:
            self._attr_native_value = None


# Hunger Sensors


class LastMealTimestampSensor(PetHealthSensorBase):
    """Sensor showing the timestamp of the last meal."""

    _attr_translation_key = "last_meal"
    _attr_device_class = SensorDeviceClass.TIMESTAMP

    def __init__(
        self, entry: PetHealthConfigEntry, store: PetHealthStore, pet_id: str
    ) -> None:
        """Initialize the sensor."""
        super().__init__(entry, store, pet_id)
        self._attr_unique_id = f"{pet_id}_last_meal"

    def _update_from_store(self) -> None:
        """Update the sensor value."""
        records = self._store.get_meal_records(self._pet_id)
        if records:
            last_record = records[-1]
            timestamp = last_record.timestamp
            if timestamp.tzinfo is None:
                timestamp = dt_util.as_utc(timestamp)
            self._attr_native_value = timestamp
            self._attr_extra_state_attributes = {
                **self._attr_extra_state_attributes,
                "amount": last_record.amount,
                "food_type": last_record.food_type,
                "notes": last_record.notes,
            }
        else:
            self._attr_native_value = None
            self._attr_extra_state_attributes = {
                "pet": self._pet_data.name,
                "integration": DOMAIN,
            }


class DailyMealCountSensor(PetHealthSensorBase):
    """Sensor counting meals today."""

    _attr_translation_key = "daily_meal_count"
    _attr_state_class = SensorStateClass.TOTAL_INCREASING
    _attr_native_unit_of_measurement = "meals"
    _attr_icon = "mdi:food"

    def __init__(
        self, entry: PetHealthConfigEntry, store: PetHealthStore, pet_id: str
    ) -> None:
        """Initialize the sensor."""
        super().__init__(entry, store, pet_id)
        self._attr_unique_id = f"{pet_id}_daily_meal_count"

    def _update_from_store(self) -> None:
        """Update the sensor value."""
        records = self._store.get_meal_records(self._pet_id)
        now = dt_util.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        meals_today = [
            r
            for r in records
            if (
                dt_util.as_utc(r.timestamp)
                if r.timestamp.tzinfo is None
                else r.timestamp
            )
            >= today_start
        ]
        self._attr_native_value = len(meals_today)


class LastMealAmountSensor(PetHealthSensorBase):
    """Sensor showing the amount of the last meal."""

    _attr_translation_key = "last_meal_amount"
    _attr_icon = "mdi:food-variant"

    def __init__(
        self, entry: PetHealthConfigEntry, store: PetHealthStore, pet_id: str
    ) -> None:
        """Initialize the sensor."""
        super().__init__(entry, store, pet_id)
        self._attr_unique_id = f"{pet_id}_last_meal_amount"

    def _update_from_store(self) -> None:
        """Update the sensor value."""
        records = self._store.get_meal_records(self._pet_id)
        if records:
            last_record = records[-1]
            self._attr_native_value = last_record.amount
        else:
            self._attr_native_value = None


# Wellbeing Sensors


class LastWellbeingAssessmentSensor(PetHealthSensorBase):
    """Sensor showing the timestamp of the last wellbeing assessment."""

    _attr_translation_key = "last_wellbeing_assessment"
    _attr_device_class = SensorDeviceClass.TIMESTAMP

    def __init__(
        self, entry: PetHealthConfigEntry, store: PetHealthStore, pet_id: str
    ) -> None:
        """Initialize the sensor."""
        super().__init__(entry, store, pet_id)
        self._attr_unique_id = f"{pet_id}_last_wellbeing_assessment"

    def _update_from_store(self) -> None:
        """Update the sensor value."""
        records = self._store.get_wellbeing_records(self._pet_id)
        if records:
            last_record = records[-1]
            timestamp = last_record.timestamp
            if timestamp.tzinfo is None:
                timestamp = dt_util.as_utc(timestamp)
            self._attr_native_value = timestamp
            self._attr_extra_state_attributes = {
                **self._attr_extra_state_attributes,
                "wellbeing_score": last_record.wellbeing_score,
                "symptoms": last_record.symptoms,
                "notes": last_record.notes,
            }
        else:
            self._attr_native_value = None
            self._attr_extra_state_attributes = {
                "pet": self._pet_data.name,
                "integration": DOMAIN,
            }


class CurrentWellbeingScoreSensor(PetHealthSensorBase):
    """Sensor showing the current wellbeing score."""

    _attr_translation_key = "current_wellbeing_score"
    _attr_icon = "mdi:heart-pulse"

    def __init__(
        self, entry: PetHealthConfigEntry, store: PetHealthStore, pet_id: str
    ) -> None:
        """Initialize the sensor."""
        super().__init__(entry, store, pet_id)
        self._attr_unique_id = f"{pet_id}_current_wellbeing_score"

    def _update_from_store(self) -> None:
        """Update the sensor value."""
        records = self._store.get_wellbeing_records(self._pet_id)
        if records:
            last_record = records[-1]
            self._attr_native_value = last_record.wellbeing_score
        else:
            self._attr_native_value = None


# Thirst Level Sensors (Symptoms/State)


class LastThirstLevelTimestampSensor(PetHealthSensorBase):
    """Sensor showing the timestamp of the last thirst level assessment."""

    _attr_translation_key = "last_thirst_level"
    _attr_device_class = SensorDeviceClass.TIMESTAMP

    def __init__(
        self, entry: PetHealthConfigEntry, store: PetHealthStore, pet_id: str
    ) -> None:
        """Initialize the sensor."""
        super().__init__(entry, store, pet_id)
        self._attr_unique_id = f"{pet_id}_last_thirst_level"

    def _update_from_store(self) -> None:
        """Update the sensor value."""
        records = self._store.get_thirst_level_records(self._pet_id)
        if records:
            last_record = records[-1]
            timestamp = last_record.timestamp
            if timestamp.tzinfo is None:
                timestamp = dt_util.as_utc(timestamp)
            self._attr_native_value = timestamp
            self._attr_extra_state_attributes = {
                **self._attr_extra_state_attributes,
                "level": last_record.level,
                "notes": last_record.notes,
            }
        else:
            self._attr_native_value = None
            self._attr_extra_state_attributes = {
                "pet": self._pet_data.name,
                "integration": DOMAIN,
            }


class CurrentThirstLevelSensor(PetHealthSensorBase):
    """Sensor showing the current thirst level."""

    _attr_translation_key = "current_thirst_level"
    _attr_icon = "mdi:water"

    def __init__(
        self, entry: PetHealthConfigEntry, store: PetHealthStore, pet_id: str
    ) -> None:
        """Initialize the sensor."""
        super().__init__(entry, store, pet_id)
        self._attr_unique_id = f"{pet_id}_current_thirst_level"

    def _update_from_store(self) -> None:
        """Update the sensor value."""
        records = self._store.get_thirst_level_records(self._pet_id)
        if records:
            last_record = records[-1]
            self._attr_native_value = last_record.level
        else:
            self._attr_native_value = None


# Appetite Level Sensors (Symptoms/State)


class LastAppetiteLevelTimestampSensor(PetHealthSensorBase):
    """Sensor showing the timestamp of the last appetite level assessment."""

    _attr_translation_key = "last_appetite_level"
    _attr_device_class = SensorDeviceClass.TIMESTAMP

    def __init__(
        self, entry: PetHealthConfigEntry, store: PetHealthStore, pet_id: str
    ) -> None:
        """Initialize the sensor."""
        super().__init__(entry, store, pet_id)
        self._attr_unique_id = f"{pet_id}_last_appetite_level"

    def _update_from_store(self) -> None:
        """Update the sensor value."""
        records = self._store.get_appetite_level_records(self._pet_id)
        if records:
            last_record = records[-1]
            timestamp = last_record.timestamp
            if timestamp.tzinfo is None:
                timestamp = dt_util.as_utc(timestamp)
            self._attr_native_value = timestamp
            self._attr_extra_state_attributes = {
                **self._attr_extra_state_attributes,
                "level": last_record.level,
                "notes": last_record.notes,
            }
        else:
            self._attr_native_value = None
            self._attr_extra_state_attributes = {
                "pet": self._pet_data.name,
                "integration": DOMAIN,
            }


class CurrentAppetiteLevelSensor(PetHealthSensorBase):
    """Sensor showing the current appetite level."""

    _attr_translation_key = "current_appetite_level"
    _attr_icon = "mdi:food-apple"

    def __init__(
        self, entry: PetHealthConfigEntry, store: PetHealthStore, pet_id: str
    ) -> None:
        """Initialize the sensor."""
        super().__init__(entry, store, pet_id)
        self._attr_unique_id = f"{pet_id}_current_appetite_level"

    def _update_from_store(self) -> None:
        """Update the sensor value."""
        records = self._store.get_appetite_level_records(self._pet_id)
        if records:
            last_record = records[-1]
            self._attr_native_value = last_record.level
        else:
            self._attr_native_value = None


# Weight Tracking Sensors


class LastWeightTimestampSensor(PetHealthSensorBase):
    """Sensor showing the timestamp of the last weight measurement."""

    _attr_translation_key = "last_weight"
    _attr_device_class = SensorDeviceClass.TIMESTAMP

    def __init__(
        self, entry: PetHealthConfigEntry, store: PetHealthStore, pet_id: str
    ) -> None:
        """Initialize the sensor."""
        super().__init__(entry, store, pet_id)
        self._attr_unique_id = f"{pet_id}_last_weight"

    def _update_from_store(self) -> None:
        """Update the sensor value."""
        records = self._store.get_weight_records(self._pet_id)
        if records:
            last_record = records[-1]
            timestamp = last_record.timestamp
            if timestamp.tzinfo is None:
                timestamp = dt_util.as_utc(timestamp)
            self._attr_native_value = timestamp
            self._attr_extra_state_attributes = {
                **self._attr_extra_state_attributes,
                "weight_grams": last_record.weight_grams,
                "notes": last_record.notes,
            }
        else:
            self._attr_native_value = None
            self._attr_extra_state_attributes = {
                "pet": self._pet_data.name,
                "integration": DOMAIN,
            }


class CurrentWeightSensor(PetHealthSensorBase):
    """Sensor showing the current weight in grams."""

    _attr_translation_key = "current_weight"
    _attr_device_class = SensorDeviceClass.WEIGHT
    _attr_native_unit_of_measurement = "g"
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(
        self, entry: PetHealthConfigEntry, store: PetHealthStore, pet_id: str
    ) -> None:
        """Initialize the sensor."""
        super().__init__(entry, store, pet_id)
        self._attr_unique_id = f"{pet_id}_current_weight"

    def _update_from_store(self) -> None:
        """Update the sensor value."""
        records = self._store.get_weight_records(self._pet_id)
        if records:
            last_record = records[-1]
            self._attr_native_value = last_record.weight_grams
        else:
            self._attr_native_value = None


class WeightChange7DSensor(PetHealthSensorBase):
    """Sensor showing weight change over the last 7 days."""

    _attr_translation_key = "weight_change_7d"
    _attr_device_class = SensorDeviceClass.WEIGHT
    _attr_native_unit_of_measurement = "g"
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_icon = "mdi:trending-up"

    def __init__(
        self, entry: PetHealthConfigEntry, store: PetHealthStore, pet_id: str
    ) -> None:
        """Initialize the sensor."""
        super().__init__(entry, store, pet_id)
        self._attr_unique_id = f"{pet_id}_weight_change_7d"

    def _update_from_store(self) -> None:
        """Update the sensor value."""
        records = self._store.get_weight_records(self._pet_id)
        if len(records) >= 2:
            sorted_records = sorted(records, key=lambda r: r.timestamp, reverse=True)
            current_weight = sorted_records[0].weight_grams
            current_time = sorted_records[0].timestamp

            # Find weight from 7 days ago or closest
            for old_record in reversed(sorted_records[1:]):
                days_ago = (current_time - old_record.timestamp).days
                if days_ago >= 7:
                    self._attr_native_value = current_weight - old_record.weight_grams
                    return

        self._attr_native_value = None


class WeightChange30DSensor(PetHealthSensorBase):
    """Sensor showing weight change over the last 30 days."""

    _attr_translation_key = "weight_change_30d"
    _attr_device_class = SensorDeviceClass.WEIGHT
    _attr_native_unit_of_measurement = "g"
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_icon = "mdi:trending-up"

    def __init__(
        self, entry: PetHealthConfigEntry, store: PetHealthStore, pet_id: str
    ) -> None:
        """Initialize the sensor."""
        super().__init__(entry, store, pet_id)
        self._attr_unique_id = f"{pet_id}_weight_change_30d"

    def _update_from_store(self) -> None:
        """Update the sensor value."""
        records = self._store.get_weight_records(self._pet_id)
        if len(records) >= 2:
            sorted_records = sorted(records, key=lambda r: r.timestamp, reverse=True)
            current_weight = sorted_records[0].weight_grams
            current_time = sorted_records[0].timestamp

            # Find weight from 30 days ago or closest
            for old_record in reversed(sorted_records[1:]):
                days_ago = (current_time - old_record.timestamp).days
                if days_ago >= 30:
                    self._attr_native_value = current_weight - old_record.weight_grams
                    return

        self._attr_native_value = None


# Vomiting Tracking Sensors


class LastVomitTimestampSensor(PetHealthSensorBase):
    """Sensor showing the timestamp of the last vomiting incident."""

    _attr_translation_key = "last_vomit"
    _attr_device_class = SensorDeviceClass.TIMESTAMP

    def __init__(
        self, entry: PetHealthConfigEntry, store: PetHealthStore, pet_id: str
    ) -> None:
        """Initialize the sensor."""
        super().__init__(entry, store, pet_id)
        self._attr_unique_id = f"{pet_id}_last_vomit"

    def _update_from_store(self) -> None:
        """Update the sensor value."""
        records = self._store.get_vomit_records(self._pet_id)
        if records:
            last_record = records[-1]
            timestamp = last_record.timestamp
            if timestamp.tzinfo is None:
                timestamp = dt_util.as_utc(timestamp)
            self._attr_native_value = timestamp
            self._attr_extra_state_attributes = {
                **self._attr_extra_state_attributes,
                "vomit_type": last_record.vomit_type,
                "notes": last_record.notes,
            }
        else:
            self._attr_native_value = None
            self._attr_extra_state_attributes = {
                "pet": self._pet_data.name,
                "integration": DOMAIN,
            }


class LastVomitTypeSensor(PetHealthSensorBase):
    """Sensor showing the type of the last vomiting incident."""

    _attr_translation_key = "last_vomit_type"
    _attr_icon = "mdi:alert-circle"

    def __init__(
        self, entry: PetHealthConfigEntry, store: PetHealthStore, pet_id: str
    ) -> None:
        """Initialize the sensor."""
        super().__init__(entry, store, pet_id)
        self._attr_unique_id = f"{pet_id}_last_vomit_type"

    def _update_from_store(self) -> None:
        """Update the sensor value."""
        records = self._store.get_vomit_records(self._pet_id)
        if records:
            last_record = records[-1]
            self._attr_native_value = last_record.vomit_type
        else:
            self._attr_native_value = None


class DailyVomitCountSensor(PetHealthSensorBase):
    """Sensor showing the count of vomiting incidents today."""

    _attr_translation_key = "daily_vomit_count"
    _attr_state_class = SensorStateClass.TOTAL
    _attr_icon = "mdi:counter"

    def __init__(
        self, entry: PetHealthConfigEntry, store: PetHealthStore, pet_id: str
    ) -> None:
        """Initialize the sensor."""
        super().__init__(entry, store, pet_id)
        self._attr_unique_id = f"{pet_id}_daily_vomit_count"

    def _update_from_store(self) -> None:
        """Update the sensor value."""
        records = self._store.get_vomit_records(self._pet_id)
        today = dt_util.start_of_local_day()

        count = sum(
            1 for record in records if dt_util.as_local(record.timestamp) >= today
        )
        self._attr_native_value = count


class WeeklyVomitCountSensor(PetHealthSensorBase):
    """Sensor showing the count of vomiting incidents this week."""

    _attr_translation_key = "weekly_vomit_count"
    _attr_state_class = SensorStateClass.TOTAL
    _attr_icon = "mdi:counter"

    def __init__(
        self, entry: PetHealthConfigEntry, store: PetHealthStore, pet_id: str
    ) -> None:
        """Initialize the sensor."""
        super().__init__(entry, store, pet_id)
        self._attr_unique_id = f"{pet_id}_weekly_vomit_count"

    def _update_from_store(self) -> None:
        """Update the sensor value."""
        records = self._store.get_vomit_records(self._pet_id)
        week_ago = dt_util.now() - timedelta(days=7)

        count = sum(1 for record in records if record.timestamp >= week_ago)
        self._attr_native_value = count
        self._attr_unique_id = f"{pet_id}_current_wellbeing_score"

    def _update_from_store(self) -> None:
        """Update the sensor value."""
        records = self._store.get_wellbeing_records(self._pet_id)
        if records:
            last_record = records[-1]
            self._attr_native_value = last_record.wellbeing_score
        else:
            self._attr_native_value = None
