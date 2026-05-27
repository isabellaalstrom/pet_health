"""Storage for the Pet Health integration."""

from __future__ import annotations

from collections.abc import Callable

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import (
    STORAGE_KEY_APPETITE_LEVELS,
    STORAGE_KEY_DRINKS,
    STORAGE_KEY_GENERIC_LOGS,
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
    DrinkRecord,
    GenericLog,
    MealRecord,
    MedicationRecord,
    ThirstLevelRecord,
    VomitRecord,
    WeightRecord,
    WellbeingRecord,
)


class PetHealthStore:
    """Store for pet health data."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize the store."""
        self.hass = hass
        self._visits_store = Store[dict[str, list[dict]]](
            hass, STORAGE_VERSION, STORAGE_KEY_VISITS
        )
        self._medications_store = Store[dict[str, list[dict]]](
            hass, STORAGE_VERSION, STORAGE_KEY_MEDICATIONS
        )
        self._drinks_store = Store[dict[str, list[dict]]](
            hass, STORAGE_VERSION, STORAGE_KEY_DRINKS
        )
        self._meals_store = Store[dict[str, list[dict]]](
            hass, STORAGE_VERSION, STORAGE_KEY_MEALS
        )
        self._thirst_levels_store = Store[dict[str, list[dict]]](
            hass, STORAGE_VERSION, STORAGE_KEY_THIRST_LEVELS
        )
        self._appetite_levels_store = Store[dict[str, list[dict]]](
            hass, STORAGE_VERSION, STORAGE_KEY_APPETITE_LEVELS
        )
        self._wellbeing_store = Store[dict[str, list[dict]]](
            hass, STORAGE_VERSION, STORAGE_KEY_WELLBEING
        )
        self._weight_store = Store[dict[str, list[dict]]](
            hass, STORAGE_VERSION, STORAGE_KEY_WEIGHT
        )
        self._vomit_store = Store[dict[str, list[dict]]](
            hass, STORAGE_VERSION, STORAGE_KEY_VOMIT
        )
        self._generic_logs_store = Store[dict[str, list[dict]]](
            hass, STORAGE_VERSION, STORAGE_KEY_GENERIC_LOGS
        )
        self._visits_data: dict[str, list[BathroomVisit]] = {}
        self._medications_data: dict[str, list[MedicationRecord]] = {}
        self._drinks_data: dict[str, list[DrinkRecord]] = {}
        self._meals_data: dict[str, list[MealRecord]] = {}
        self._thirst_levels_data: dict[str, list[ThirstLevelRecord]] = {}
        self._appetite_levels_data: dict[str, list[AppetiteLevelRecord]] = {}
        self._wellbeing_data: dict[str, list[WellbeingRecord]] = {}
        self._weight_data: dict[str, list[WeightRecord]] = {}
        self._vomit_data: dict[str, list[VomitRecord]] = {}
        self._generic_logs_data: dict[str, list[GenericLog]] = {}
        self._callbacks: dict[str, list[Callable]] = {}

    async def async_load(self) -> None:
        """Load data from storage."""
        # Load visits
        stored_visits = await self._visits_store.async_load()
        if stored_visits:
            # Convert stored dicts back to BathroomVisit objects
            for pet_id, visits in stored_visits.items():
                self._visits_data[pet_id] = [
                    BathroomVisit.from_dict(visit) for visit in visits
                ]

        # Load medications
        stored_medications = await self._medications_store.async_load()
        if stored_medications:
            # Convert stored dicts back to MedicationRecord objects
            for pet_id, medications in stored_medications.items():
                self._medications_data[pet_id] = [
                    MedicationRecord.from_dict(med) for med in medications
                ]

        # Load drink records
        stored_drinks = await self._drinks_store.async_load()
        if stored_drinks:
            for pet_id, records in stored_drinks.items():
                self._drinks_data[pet_id] = [
                    DrinkRecord.from_dict(record) for record in records
                ]

        # Load meal records
        stored_meals = await self._meals_store.async_load()
        if stored_meals:
            for pet_id, records in stored_meals.items():
                self._meals_data[pet_id] = [
                    MealRecord.from_dict(record) for record in records
                ]

        # Load thirst level records
        stored_thirst_levels = await self._thirst_levels_store.async_load()
        if stored_thirst_levels:
            for pet_id, records in stored_thirst_levels.items():
                self._thirst_levels_data[pet_id] = [
                    ThirstLevelRecord.from_dict(record) for record in records
                ]

        # Load appetite level records
        stored_appetite_levels = await self._appetite_levels_store.async_load()
        if stored_appetite_levels:
            for pet_id, records in stored_appetite_levels.items():
                self._appetite_levels_data[pet_id] = [
                    AppetiteLevelRecord.from_dict(record) for record in records
                ]

        # Load wellbeing records
        stored_wellbeing = await self._wellbeing_store.async_load()
        if stored_wellbeing:
            for pet_id, records in stored_wellbeing.items():
                self._wellbeing_data[pet_id] = [
                    WellbeingRecord.from_dict(record) for record in records
                ]

        # Load weight records
        stored_weight = await self._weight_store.async_load()
        if stored_weight:
            for pet_id, records in stored_weight.items():
                self._weight_data[pet_id] = [
                    WeightRecord.from_dict(record) for record in records
                ]

        # Load vomit records
        stored_vomit = await self._vomit_store.async_load()
        if stored_vomit:
            for pet_id, records in stored_vomit.items():
                self._vomit_data[pet_id] = [
                    VomitRecord.from_dict(record) for record in records
                ]

        # Load generic logs
        stored_generic_logs = await self._generic_logs_store.async_load()
        if stored_generic_logs:
            for pet_id, logs in stored_generic_logs.items():
                self._generic_logs_data[pet_id] = [
                    GenericLog.from_dict(log) for log in logs
                ]

    async def async_save_visit(self, visit: BathroomVisit) -> None:
        """Save a bathroom visit."""
        if visit.pet_id not in self._visits_data:
            self._visits_data[visit.pet_id] = []
        self._visits_data[visit.pet_id].append(visit)

        # Convert to storable format
        store_data = {
            pet_id: [v.to_dict() for v in visits]
            for pet_id, visits in self._visits_data.items()
        }
        await self._visits_store.async_save(store_data)

        # Notify callbacks to update sensors immediately
        self._notify_callbacks(visit.pet_id)

    async def async_save_medication(self, medication: MedicationRecord) -> None:
        """Save a medication record."""
        if medication.pet_id not in self._medications_data:
            self._medications_data[medication.pet_id] = []
        self._medications_data[medication.pet_id].append(medication)

        # Convert to storable format
        store_data = {
            pet_id: [m.to_dict() for m in meds]
            for pet_id, meds in self._medications_data.items()
        }
        await self._medications_store.async_save(store_data)

        # Notify callbacks to update sensors immediately
        self._notify_callbacks(medication.pet_id)

    def get_visits(self, pet_id: str) -> list[BathroomVisit]:
        """Get all visits for a pet."""
        return self._visits_data.get(pet_id, [])

    def get_medications(self, pet_id: str) -> list[MedicationRecord]:
        """Get all medications for a pet."""
        return self._medications_data.get(pet_id, [])

    def find_visit(self, visit_id: str) -> tuple[str, BathroomVisit] | None:
        """Find a visit by ID. Returns (pet_id, visit) or None."""
        for pet_id, visits in self._visits_data.items():
            for visit in visits:
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
            self._visits_data[old_pet_id].remove(visit)
            if visit.pet_id not in self._visits_data:
                self._visits_data[visit.pet_id] = []
            self._visits_data[visit.pet_id].append(visit)

        # Save to storage (after move if needed)
        visits_dict = {
            pet_id: [visit.to_dict() for visit in visits]
            for pet_id, visits in self._visits_data.items()
        }
        await self._visits_store.async_save(visits_dict)

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
        self._visits_data[pet_id].remove(visit)

        # Save to storage
        visits_dict = {
            pet_id: [visit.to_dict() for visit in visits]
            for pet_id, visits in self._visits_data.items()
        }
        await self._visits_store.async_save(visits_dict)

        # Notify callbacks
        self._notify_callbacks(pet_id)

        return True

    async def async_save_drink(self, record: DrinkRecord) -> None:
        """Save a drink record."""
        if record.pet_id not in self._drinks_data:
            self._drinks_data[record.pet_id] = []
        self._drinks_data[record.pet_id].append(record)

        # Convert to storable format
        store_data = {
            pet_id: [r.to_dict() for r in records]
            for pet_id, records in self._drinks_data.items()
        }
        await self._drinks_store.async_save(store_data)

        # Notify callbacks to update sensors immediately
        self._notify_callbacks(record.pet_id)

    async def async_save_meal(self, record: MealRecord) -> None:
        """Save a meal record."""
        if record.pet_id not in self._meals_data:
            self._meals_data[record.pet_id] = []
        self._meals_data[record.pet_id].append(record)

        # Convert to storable format
        store_data = {
            pet_id: [r.to_dict() for r in records]
            for pet_id, records in self._meals_data.items()
        }
        await self._meals_store.async_save(store_data)

        # Notify callbacks to update sensors immediately
        self._notify_callbacks(record.pet_id)

    async def async_save_thirst_level(self, record: ThirstLevelRecord) -> None:
        """Save a thirst level record."""
        if record.pet_id not in self._thirst_levels_data:
            self._thirst_levels_data[record.pet_id] = []
        self._thirst_levels_data[record.pet_id].append(record)

        # Convert to storable format
        store_data = {
            pet_id: [r.to_dict() for r in records]
            for pet_id, records in self._thirst_levels_data.items()
        }
        await self._thirst_levels_store.async_save(store_data)

        # Notify callbacks to update sensors immediately
        self._notify_callbacks(record.pet_id)

    async def async_save_appetite_level(self, record: AppetiteLevelRecord) -> None:
        """Save an appetite level record."""
        if record.pet_id not in self._appetite_levels_data:
            self._appetite_levels_data[record.pet_id] = []
        self._appetite_levels_data[record.pet_id].append(record)

        # Convert to storable format
        store_data = {
            pet_id: [r.to_dict() for r in records]
            for pet_id, records in self._appetite_levels_data.items()
        }
        await self._appetite_levels_store.async_save(store_data)

        # Notify callbacks to update sensors immediately
        self._notify_callbacks(record.pet_id)

    async def async_save_wellbeing(self, record: WellbeingRecord) -> None:
        """Save a wellbeing record."""
        if record.pet_id not in self._wellbeing_data:
            self._wellbeing_data[record.pet_id] = []
        self._wellbeing_data[record.pet_id].append(record)

        # Convert to storable format
        store_data = {
            pet_id: [r.to_dict() for r in records]
            for pet_id, records in self._wellbeing_data.items()
        }
        await self._wellbeing_store.async_save(store_data)

        # Notify callbacks to update sensors immediately
        self._notify_callbacks(record.pet_id)

    async def async_save_weight(self, record: WeightRecord) -> None:
        """Save a weight record."""
        if record.pet_id not in self._weight_data:
            self._weight_data[record.pet_id] = []
        self._weight_data[record.pet_id].append(record)

        # Convert to storable format
        store_data = {
            pet_id: [r.to_dict() for r in records]
            for pet_id, records in self._weight_data.items()
        }
        await self._weight_store.async_save(store_data)

        # Notify callbacks to update sensors immediately
        self._notify_callbacks(record.pet_id)

    async def async_save_vomit(self, record: VomitRecord) -> None:
        """Save a vomit record."""
        if record.pet_id not in self._vomit_data:
            self._vomit_data[record.pet_id] = []
        self._vomit_data[record.pet_id].append(record)

        # Convert to storable format
        store_data = {
            pet_id: [r.to_dict() for r in records]
            for pet_id, records in self._vomit_data.items()
        }
        await self._vomit_store.async_save(store_data)

        # Notify callbacks to update sensors immediately
        self._notify_callbacks(record.pet_id)

    def get_drink_records(self, pet_id: str) -> list[DrinkRecord]:
        """Get all drink records for a pet."""
        return self._drinks_data.get(pet_id, [])

    def get_meal_records(self, pet_id: str) -> list[MealRecord]:
        """Get all meal records for a pet."""
        return self._meals_data.get(pet_id, [])

    def get_thirst_level_records(self, pet_id: str) -> list[ThirstLevelRecord]:
        """Get all thirst level records for a pet."""
        return self._thirst_levels_data.get(pet_id, [])

    def get_appetite_level_records(self, pet_id: str) -> list[AppetiteLevelRecord]:
        """Get all appetite level records for a pet."""
        return self._appetite_levels_data.get(pet_id, [])

    def get_wellbeing_records(self, pet_id: str) -> list[WellbeingRecord]:
        """Get all wellbeing records for a pet."""
        return self._wellbeing_data.get(pet_id, [])

    def get_weight_records(self, pet_id: str) -> list[WeightRecord]:
        """Get all weight records for a pet."""
        return self._weight_data.get(pet_id, [])

    def get_vomit_records(self, pet_id: str) -> list[VomitRecord]:
        """Get all vomit records for a pet."""
        return self._vomit_data.get(pet_id, [])

    async def async_save_generic_log(self, log: GenericLog) -> None:
        """Save a generic log."""
        if log.pet_id not in self._generic_logs_data:
            self._generic_logs_data[log.pet_id] = []
        self._generic_logs_data[log.pet_id].append(log)

        # Convert to storable format
        store_data = {
            pet_id: [l.to_dict() for l in logs]
            for pet_id, logs in self._generic_logs_data.items()
        }
        await self._generic_logs_store.async_save(store_data)

        # Notify callbacks to update sensors immediately
        self._notify_callbacks(log.pet_id)

    def get_generic_logs(self, pet_id: str) -> list[GenericLog]:
        """Get all generic logs for a pet."""
        return self._generic_logs_data.get(pet_id, [])

    def register_update_callback(self, pet_id: str, callback: Callable) -> None:
        """Register a callback for when data is updated."""
        if pet_id not in self._callbacks:
            self._callbacks[pet_id] = []
        self._callbacks[pet_id].append(callback)

    def unregister_update_callback(self, pet_id: str, callback: Callable) -> None:
        """Unregister a callback."""
        if pet_id in self._callbacks and callback in self._callbacks[pet_id]:
            self._callbacks[pet_id].remove(callback)

    def _notify_callbacks(self, pet_id: str) -> None:
        """Notify all callbacks for a pet."""
        if pet_id in self._callbacks:
            for callback in self._callbacks[pet_id]:
                callback()
