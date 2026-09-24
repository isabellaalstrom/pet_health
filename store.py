"""Storage for the Pet Health integration."""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from typing import Protocol

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import (
    STORAGE_KEY_APPETITE_LEVELS,
    STORAGE_KEY_BLOOD_GLUCOSE,
    STORAGE_KEY_DRINKS,
    STORAGE_KEY_GENERIC_LOGS,
    STORAGE_KEY_GLYCATED_HEMOGLOBIN,
    STORAGE_KEY_KETONES,
    STORAGE_KEY_MEALS,
    STORAGE_KEY_MEDICATIONS,
    STORAGE_KEY_THIRST_LEVELS,
    STORAGE_KEY_VISITS,
    STORAGE_KEY_VOMIT,
    STORAGE_KEY_WEIGHT,
    STORAGE_KEY_WELLBEING,
    STORAGE_VERSION,
)
from .models import (
    AppetiteLevelRecord,
    BathroomVisit,
    BloodGlucoseRecord,
    DrinkRecord,
    GenericLog,
    GlycatedHemoglobinRecord,
    KetoneRecord,
    MealRecord,
    MedicationRecord,
    ThirstLevelRecord,
    VomitRecord,
    WeightRecord,
    WellbeingRecord,
)


class _StoredRecord(Protocol):
    """Structural type shared by every record model this store persists."""

    pet_id: str

    def to_dict(self) -> dict: ...


class _RecordCollection[T: _StoredRecord]:
    """Per-pet list storage backed by a single HA `Store` file.

    Every pet-health record type (visits, meals, blood glucose, ...) used to
    get its own hand-written copy of "keep a dict[pet_id, list], load it,
    re-serialize the whole thing and save it". This class holds that logic
    once. The on-disk layout (`{pet_id: [record.to_dict(), ...]}` in its own
    storage-key file) is unchanged, so existing storage files and everything
    that reads through `PetHealthStore` (sensors, services, websocket API)
    keep working exactly as before.
    """

    def __init__(
        self, hass: HomeAssistant, storage_key: str, from_dict: Callable[[dict], T]
    ) -> None:
        """Initialize the collection."""
        self._store: Store[dict[str, list[dict]]] = Store(
            hass, STORAGE_VERSION, storage_key
        )
        self._from_dict = from_dict
        self.data: dict[str, list[T]] = {}

    async def async_load(self) -> None:
        """Load this collection's records from storage."""
        stored = await self._store.async_load()
        if stored:
            for pet_id, items in stored.items():
                self.data[pet_id] = [self._from_dict(item) for item in items]

    async def async_append_and_save(self, record: T) -> None:
        """Append a record for its pet and persist the whole collection."""
        self.data.setdefault(record.pet_id, []).append(record)
        await self.async_save_all()

    async def async_save_all(self) -> None:
        """Persist the current in-memory state to storage."""
        store_data = {
            pet_id: [record.to_dict() for record in records]
            for pet_id, records in self.data.items()
        }
        await self._store.async_save(store_data)

    def get(self, pet_id: str) -> list[T]:
        """Get all records for a pet."""
        return self.data.get(pet_id, [])


class PetHealthStore:
    """Store for pet health data."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize the store."""
        self.hass = hass
        self._visits = _RecordCollection(
            hass, STORAGE_KEY_VISITS, BathroomVisit.from_dict
        )
        self._medications = _RecordCollection(
            hass, STORAGE_KEY_MEDICATIONS, MedicationRecord.from_dict
        )
        self._drinks = _RecordCollection(
            hass, STORAGE_KEY_DRINKS, DrinkRecord.from_dict
        )
        self._meals = _RecordCollection(hass, STORAGE_KEY_MEALS, MealRecord.from_dict)
        self._thirst_levels = _RecordCollection(
            hass, STORAGE_KEY_THIRST_LEVELS, ThirstLevelRecord.from_dict
        )
        self._appetite_levels = _RecordCollection(
            hass, STORAGE_KEY_APPETITE_LEVELS, AppetiteLevelRecord.from_dict
        )
        self._wellbeing = _RecordCollection(
            hass, STORAGE_KEY_WELLBEING, WellbeingRecord.from_dict
        )
        self._weight = _RecordCollection(
            hass, STORAGE_KEY_WEIGHT, WeightRecord.from_dict
        )
        self._vomit = _RecordCollection(
            hass, STORAGE_KEY_VOMIT, VomitRecord.from_dict
        )
        self._generic_logs = _RecordCollection(
            hass, STORAGE_KEY_GENERIC_LOGS, GenericLog.from_dict
        )
        self._blood_glucose = _RecordCollection(
            hass, STORAGE_KEY_BLOOD_GLUCOSE, BloodGlucoseRecord.from_dict
        )
        self._glycated_hemoglobin = _RecordCollection(
            hass, STORAGE_KEY_GLYCATED_HEMOGLOBIN, GlycatedHemoglobinRecord.from_dict
        )
        self._ketones = _RecordCollection(
            hass, STORAGE_KEY_KETONES, KetoneRecord.from_dict
        )

        # visit_id -> pet_id, so amend/confirm/reassign/delete don't need to
        # scan every pet's full visit history to find one visit.
        self._visit_index: dict[str, str] = {}
        self._callbacks: dict[str, list[Callable]] = {}

    async def async_load(self) -> None:
        """Load data from storage."""
        await asyncio.gather(
            self._visits.async_load(),
            self._medications.async_load(),
            self._drinks.async_load(),
            self._meals.async_load(),
            self._thirst_levels.async_load(),
            self._appetite_levels.async_load(),
            self._wellbeing.async_load(),
            self._weight.async_load(),
            self._vomit.async_load(),
            self._generic_logs.async_load(),
            self._blood_glucose.async_load(),
            self._glycated_hemoglobin.async_load(),
            self._ketones.async_load(),
        )

        for pet_id, visits in self._visits.data.items():
            for visit in visits:
                self._visit_index[visit.visit_id] = pet_id

    async def async_save_visit(self, visit: BathroomVisit) -> None:
        """Save a bathroom visit."""
        await self._visits.async_append_and_save(visit)
        self._visit_index[visit.visit_id] = visit.pet_id
        self._notify_callbacks(visit.pet_id)

    async def async_save_medication(self, medication: MedicationRecord) -> None:
        """Save a medication record."""
        await self._medications.async_append_and_save(medication)
        self._notify_callbacks(medication.pet_id)

    def get_visits(self, pet_id: str) -> list[BathroomVisit]:
        """Get all visits for a pet."""
        return self._visits.get(pet_id)

    def get_medications(self, pet_id: str) -> list[MedicationRecord]:
        """Get all medications for a pet."""
        return self._medications.get(pet_id)

    def find_visit(self, visit_id: str) -> tuple[str, BathroomVisit] | None:
        """Find a visit by ID. Returns (pet_id, visit) or None."""
        pet_id = self._visit_index.get(visit_id)
        if pet_id is None:
            return None
        for visit in self._visits.get(pet_id):
            if visit.visit_id == visit_id:
                return (pet_id, visit)
        return None

    async def async_update_visit(
        self, visit_id: str, update_fn: Callable[[BathroomVisit], None]
    ) -> bool:
        """Update a visit by ID. Returns True if found and updated."""
        result = self.find_visit(visit_id)
        if not result:
            return False

        old_pet_id, visit = result
        # Apply the update
        update_fn(visit)

        # If pet was changed, move visit to new pet's list BEFORE saving
        if visit.pet_id != old_pet_id:
            self._visits.data[old_pet_id].remove(visit)
            self._visits.data.setdefault(visit.pet_id, []).append(visit)
            self._visit_index[visit.visit_id] = visit.pet_id

        # Save to storage (after move if needed)
        await self._visits.async_save_all()

        # Notify callbacks for old pet
        self._notify_callbacks(old_pet_id)
        # If pet was changed, notify new pet too
        if visit.pet_id != old_pet_id:
            self._notify_callbacks(visit.pet_id)

        return True

    async def async_delete_visit(self, visit_id: str) -> bool:
        """Delete a visit by ID. Returns True if found and deleted."""
        result = self.find_visit(visit_id)
        if not result:
            return False

        pet_id, visit = result
        # Remove from list
        self._visits.data[pet_id].remove(visit)
        del self._visit_index[visit_id]

        # Save to storage
        await self._visits.async_save_all()

        # Notify callbacks
        self._notify_callbacks(pet_id)

        return True

    async def async_save_drink(self, record: DrinkRecord) -> None:
        """Save a drink record."""
        await self._drinks.async_append_and_save(record)
        self._notify_callbacks(record.pet_id)

    async def async_save_meal(self, record: MealRecord) -> None:
        """Save a meal record."""
        await self._meals.async_append_and_save(record)
        self._notify_callbacks(record.pet_id)

    async def async_save_thirst_level(self, record: ThirstLevelRecord) -> None:
        """Save a thirst level record."""
        await self._thirst_levels.async_append_and_save(record)
        self._notify_callbacks(record.pet_id)

    async def async_save_appetite_level(self, record: AppetiteLevelRecord) -> None:
        """Save an appetite level record."""
        await self._appetite_levels.async_append_and_save(record)
        self._notify_callbacks(record.pet_id)

    async def async_save_wellbeing(self, record: WellbeingRecord) -> None:
        """Save a wellbeing record."""
        await self._wellbeing.async_append_and_save(record)
        self._notify_callbacks(record.pet_id)

    async def async_save_weight(self, record: WeightRecord) -> None:
        """Save a weight record."""
        await self._weight.async_append_and_save(record)
        self._notify_callbacks(record.pet_id)

    async def async_save_vomit(self, record: VomitRecord) -> None:
        """Save a vomit record."""
        await self._vomit.async_append_and_save(record)
        self._notify_callbacks(record.pet_id)

    def get_drink_records(self, pet_id: str) -> list[DrinkRecord]:
        """Get all drink records for a pet."""
        return self._drinks.get(pet_id)

    def get_meal_records(self, pet_id: str) -> list[MealRecord]:
        """Get all meal records for a pet."""
        return self._meals.get(pet_id)

    def get_thirst_level_records(self, pet_id: str) -> list[ThirstLevelRecord]:
        """Get all thirst level records for a pet."""
        return self._thirst_levels.get(pet_id)

    def get_appetite_level_records(self, pet_id: str) -> list[AppetiteLevelRecord]:
        """Get all appetite level records for a pet."""
        return self._appetite_levels.get(pet_id)

    def get_wellbeing_records(self, pet_id: str) -> list[WellbeingRecord]:
        """Get all wellbeing records for a pet."""
        return self._wellbeing.get(pet_id)

    def get_weight_records(self, pet_id: str) -> list[WeightRecord]:
        """Get all weight records for a pet."""
        return self._weight.get(pet_id)

    def get_vomit_records(self, pet_id: str) -> list[VomitRecord]:
        """Get all vomit records for a pet."""
        return self._vomit.get(pet_id)

    async def async_save_generic_log(self, log: GenericLog) -> None:
        """Save a generic log."""
        await self._generic_logs.async_append_and_save(log)
        self._notify_callbacks(log.pet_id)

    async def async_update_generic_log_category(
        self, pet_id: str, category_id: str, old_name: str, new_name: str
    ) -> None:
        """Update stored generic log category metadata after a category rename."""
        logs = self._generic_logs.get(pet_id)
        updated = False

        for log in logs:
            if log.category_id == category_id or (
                log.category_id is None and log.category == old_name
            ):
                if log.category != new_name or log.category_id != category_id:
                    log.category = new_name
                    log.category_id = category_id
                    updated = True

        if not updated:
            return

        await self._generic_logs.async_save_all()
        self._notify_callbacks(pet_id)

    def get_generic_logs(self, pet_id: str) -> list[GenericLog]:
        """Get all generic logs for a pet."""
        return self._generic_logs.get(pet_id)

    async def async_save_blood_glucose(self, record: BloodGlucoseRecord) -> None:
        """Save a blood glucose record."""
        await self._blood_glucose.async_append_and_save(record)
        self._notify_callbacks(record.pet_id)

    async def async_save_glycated_hemoglobin(
        self, record: GlycatedHemoglobinRecord
    ) -> None:
        """Save a glycated hemoglobin record."""
        await self._glycated_hemoglobin.async_append_and_save(record)
        self._notify_callbacks(record.pet_id)

    async def async_save_ketones(self, record: KetoneRecord) -> None:
        """Save a ketone record."""
        await self._ketones.async_append_and_save(record)
        self._notify_callbacks(record.pet_id)

    def get_blood_glucose_records(self, pet_id: str) -> list[BloodGlucoseRecord]:
        """Get all blood glucose records for a pet."""
        return self._blood_glucose.get(pet_id)

    def get_glycated_hemoglobin_records(
        self, pet_id: str
    ) -> list[GlycatedHemoglobinRecord]:
        """Get all glycated hemoglobin records for a pet."""
        return self._glycated_hemoglobin.get(pet_id)

    def get_ketone_records(self, pet_id: str) -> list[KetoneRecord]:
        """Get all ketone records for a pet."""
        return self._ketones.get(pet_id)

    def register_update_callback(self, pet_id: str, callback: Callable) -> None:
        """Register a callback for when data is updated."""
        self._callbacks.setdefault(pet_id, []).append(callback)

    def unregister_update_callback(self, pet_id: str, callback: Callable) -> None:
        """Unregister a callback."""
        if pet_id in self._callbacks and callback in self._callbacks[pet_id]:
            self._callbacks[pet_id].remove(callback)

    def known_pet_ids(self) -> set[str]:
        """Return the pet_ids that have any stored data, across all record types."""
        collections = (
            self._visits,
            self._medications,
            self._drinks,
            self._meals,
            self._thirst_levels,
            self._appetite_levels,
            self._wellbeing,
            self._weight,
            self._vomit,
            self._generic_logs,
            self._blood_glucose,
            self._glycated_hemoglobin,
            self._ketones,
        )
        pet_ids: set[str] = set()
        for collection in collections:
            pet_ids.update(collection.data.keys())
        return pet_ids

    def refresh_pet(self, pet_id: str) -> None:
        """Trigger a pet's registered callbacks (e.g. a periodic time-based refresh)."""
        self._notify_callbacks(pet_id)

    def _notify_callbacks(self, pet_id: str) -> None:
        """Notify all callbacks for a pet."""
        for callback in self._callbacks.get(pet_id, []):
            callback()
