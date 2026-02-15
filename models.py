"""Data models for the Pet Health integration."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime

from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.device_registry import DeviceInfo

from .const import DOMAIN, PetType, PoopColor, PoopConsistency, UrineAmount


@dataclass
class PetData:
    """Data model for a pet."""

    pet_id: str
    name: str
    pet_type: PetType

    def device_info(self) -> DeviceInfo:
        """Return device info for this pet."""
        return DeviceInfo(
            identifiers={(DOMAIN, self.pet_id)},
            name=self.name,
            manufacturer="Pet Health",
            model=self.pet_type.value.capitalize(),
        )


@dataclass
class BathroomVisit:
    """Data model for a bathroom visit."""

    timestamp: datetime
    pet_id: str
    did_pee: bool
    did_poop: bool
    visit_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    confirmed: bool = True  # True for manual logs, False for AI logs
    poop_consistencies: list[PoopConsistency] = field(default_factory=list)
    poop_color: PoopColor | None = None
    urine_amount: UrineAmount | None = None
    notes: str | None = None

    def to_dict(self) -> dict:
        """Convert to dictionary for storage."""
        return {
            "visit_id": self.visit_id,
            "timestamp": self.timestamp.isoformat(),
            "pet_id": self.pet_id,
            "did_pee": self.did_pee,
            "did_poop": self.did_poop,
            "confirmed": self.confirmed,
            "poop_consistencies": self.poop_consistencies,
            "poop_color": self.poop_color,
            "urine_amount": self.urine_amount,
            "notes": self.notes,
        }

    @staticmethod
    def from_dict(data: dict) -> BathroomVisit:
        """Create from dictionary."""
        # Handle old format with visit_type (backwards compatibility)
        if "visit_type" in data:
            visit_type = data["visit_type"]
            did_pee = visit_type in ("pee", "both")
            did_poop = visit_type in ("poop", "both")
        else:
            did_pee = data.get("did_pee", False)
            did_poop = data.get("did_poop", False)

        return BathroomVisit(
            timestamp=datetime.fromisoformat(data["timestamp"]),
            pet_id=data["pet_id"],
            did_pee=did_pee,
            did_poop=did_poop,
            visit_id=data.get(
                "visit_id", str(uuid.uuid4())
            ),  # Generate if missing (old data)
            confirmed=data.get("confirmed", True),  # Default True for old data
            poop_consistencies=[
                PoopConsistency(c) for c in data.get("poop_consistencies", [])
            ],
            poop_color=PoopColor(data["poop_color"])
            if data.get("poop_color")
            else None,
            urine_amount=(
                UrineAmount(data["urine_amount"]) if data.get("urine_amount") else None
            ),
            notes=data.get("notes"),
        )


@dataclass
class MedicationRecord:
    """Data model for a medication record."""

    timestamp: datetime
    pet_id: str
    medication_name: str
    dosage: str | None = None
    unit: str | None = None
    reason: str | None = None
    notes: str | None = None

    def to_dict(self) -> dict:
        """Convert to dictionary for storage."""
        return {
            "timestamp": self.timestamp.isoformat(),
            "pet_id": self.pet_id,
            "medication_name": self.medication_name,
            "dosage": self.dosage,
            "unit": self.unit,
            "reason": self.reason,
            "notes": self.notes,
        }

    @staticmethod
    def from_dict(data: dict) -> MedicationRecord:
        """Create from dictionary."""
        return MedicationRecord(
            timestamp=datetime.fromisoformat(data["timestamp"]),
            pet_id=data["pet_id"],
            medication_name=data["medication_name"],
            dosage=data.get("dosage"),
            unit=data.get("unit"),
            reason=data.get("reason"),
            notes=data.get("notes"),
        )


type PetHealthConfigEntry = ConfigEntry[PetData]
