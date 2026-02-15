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
            self._attr_extra_state_attributes = {
                "did_pee": last_visit.did_pee,
                "did_poop": last_visit.did_poop,
                "poop_consistencies": last_visit.poop_consistencies,
                "poop_color": last_visit.poop_color,
                "urine_amount": last_visit.urine_amount,
                "notes": last_visit.notes,
            }
        else:
            self._attr_native_value = None
            self._attr_extra_state_attributes = {}


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
