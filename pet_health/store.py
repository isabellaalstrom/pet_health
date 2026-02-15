"""Storage for the Pet Health integration."""

from __future__ import annotations

from collections.abc import Callable

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import STORAGE_KEY, STORAGE_VERSION
from .models import LitterBoxVisit


class PetHealthStore:
    """Store for pet health data."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize the store."""
        self.hass = hass
        self._store = Store[dict[str, list[dict]]](hass, STORAGE_VERSION, STORAGE_KEY)
        self._data: dict[str, list[LitterBoxVisit]] = {}
        self._callbacks: dict[str, list[Callable]] = {}

    async def async_load(self) -> None:
        """Load data from storage."""
        stored_data = await self._store.async_load()
        if stored_data:
            # Convert stored dicts back to LitterBoxVisit objects
            for pet_id, visits in stored_data.items():
                self._data[pet_id] = [
                    LitterBoxVisit.from_dict(visit) for visit in visits
                ]

    async def async_save_visit(self, visit: LitterBoxVisit) -> None:
        """Save a litter box visit."""
        if visit.pet_id not in self._data:
            self._data[visit.pet_id] = []
        self._data[visit.pet_id].append(visit)

        # Convert to storable format
        store_data = {
            pet_id: [v.to_dict() for v in visits]
            for pet_id, visits in self._data.items()
        }
        await self._store.async_save(store_data)

        # Notify callbacks to update sensors immediately
        self._notify_callbacks(visit.pet_id)

    def get_visits(self, pet_id: str) -> list[LitterBoxVisit]:
        """Get all visits for a pet."""
        return self._data.get(pet_id, [])

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
