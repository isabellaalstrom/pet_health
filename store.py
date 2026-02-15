"""Storage for the Pet Health integration."""

from __future__ import annotations

from collections.abc import Callable

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import STORAGE_KEY_MEDICATIONS, STORAGE_KEY_VISITS, STORAGE_VERSION
from .models import BathroomVisit, MedicationRecord


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
        self._visits_data: dict[str, list[BathroomVisit]] = {}
        self._medications_data: dict[str, list[MedicationRecord]] = {}
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
