import type {
  HomeAssistant,
  PetEntry,
  Visit,
  StoreData,
  MedicationLog,
  LogBathroomVisitData,
  LogMedicationData,
  AmendVisitData,
} from '../types';

export class PetHealthAPI {
  private petDataCache: PetEntry[] = [];

  constructor(private hass: HomeAssistant) {}

  private async ensurePetDataCache(): Promise<void> {
    if (this.petDataCache.length === 0) {
      this.petDataCache = await this.getPetData();
    }
  }

  private getPetIdFromEntryId(entryId: string): string | undefined {
    const pet = this.petDataCache.find(p => p.entry_id === entryId);
    return pet?.pet_id;
  }

  async getPetData(): Promise<PetEntry[]> {
    const result = await this.hass.callWS<{ entries: PetEntry[] }>({
      type: 'pet_health/get_pet_data',
    });
    this.petDataCache = result?.entries || [];
    return this.petDataCache;
  }

  async getStoreDump(entryId?: string): Promise<StoreData> {
    await this.ensurePetDataCache();
    const petId = entryId ? this.getPetIdFromEntryId(entryId) : undefined;

    const result = await this.hass.callWS<{ data: Record<string, StoreData> }>({
      type: 'pet_health/get_store_dump',
      pet_id: petId,
    });

    // If specific pet requested, return just that pet's data
    if (petId && result?.data?.[petId]) {
      return result.data[petId];
    }

    // Otherwise return all data
    return result?.data || {};
  }

  async getVisits(entryId: string): Promise<Visit[]> {
    await this.ensurePetDataCache();
    const petId = this.getPetIdFromEntryId(entryId);

    if (!petId) {
      console.warn('No pet_id found for entry_id:', entryId);
      return [];
    }

    const result = await this.hass.callWS<{ visits: Visit[] }>({
      type: 'pet_health/get_visits',
      pet_id: petId,
    });
    return result?.visits || [];
  }

  async getUnknownVisits(): Promise<Visit[]> {
    const result = await this.hass.callWS<{ visits: Visit[] }>({
      type: 'pet_health/get_unknown_visits',
    });
    return result?.visits || [];
  }

  async getMedications(entryId: string): Promise<MedicationLog[]> {
    await this.ensurePetDataCache();
    const petId = this.getPetIdFromEntryId(entryId);

    if (!petId) {
      console.warn('No pet_id found for entry_id:', entryId);
      return [];
    }

    const result = await this.hass.callWS<{ medications: MedicationLog[] }>({
      type: 'pet_health/get_medications',
      pet_id: petId,
    });
    return result?.medications || [];
  }

  async logBathroomVisit(data: LogBathroomVisitData): Promise<void> {
    await this.hass.callService('pet_health', 'log_bathroom_visit', data);
  }

  async logMedication(data: LogMedicationData): Promise<void> {
    await this.hass.callService('pet_health', 'log_medication', data);
  }

  async confirmVisit(visitId: string): Promise<void> {
    await this.hass.callService('pet_health', 'confirm_visit', {
      visit_id: visitId,
    });
  }

  async confirmAllVisits(entryId?: string, removeUnknownVisits = false): Promise<void> {
    const data: Record<string, unknown> = {
      remove_unknown_visits: removeUnknownVisits,
    };

    if (entryId) {
      data.config_entry_id = entryId;
    }

    await this.hass.callService('pet_health', 'confirm_all_visits', data);
  }

  async deleteVisit(visitId: string): Promise<void> {
    await this.hass.callService('pet_health', 'delete_visit', {
      visit_id: visitId,
    });
  }

  async amendVisit(visitId: string, data: AmendVisitData): Promise<void> {
    await this.hass.callService('pet_health', 'amend_visit', {
      visit_id: visitId,
      ...data,
    });
  }

  async reassignVisit(visitId: string, newEntryId: string): Promise<void> {
    await this.hass.callService('pet_health', 'reassign_visit', {
      visit_id: visitId,
      config_entry_id: newEntryId,
    });
  }

  async logGeneric(entryId: string, category: string, notes: string, loggedAt?: string): Promise<void> {
    const data: Record<string, unknown> = {
      config_entry_id: entryId,
      category,
      notes,
    };
    
    if (loggedAt) {
      data.logged_at = loggedAt;
    }
    
    await this.hass.callService('pet_health', 'log_generic', data);
  }

  async logDrink(entryId: string, amount: string, notes?: string, loggedAt?: string): Promise<void> {
    const data: Record<string, unknown> = {
      config_entry_id: entryId,
      amount,
    };
    if (notes) data.notes = notes;
    if (loggedAt) data.logged_at = loggedAt;
    await this.hass.callService('pet_health', 'log_drink', data);
  }

  async logMeal(entryId: string, amount: string, foodType?: string, notes?: string, loggedAt?: string): Promise<void> {
    const data: Record<string, unknown> = {
      config_entry_id: entryId,
      amount,
    };
    if (foodType) data.food_type = foodType;
    if (notes) data.notes = notes;
    if (loggedAt) data.logged_at = loggedAt;
    await this.hass.callService('pet_health', 'log_meal', data);
  }

  async logThirst(entryId: string, level: string, notes?: string, loggedAt?: string): Promise<void> {
    const data: Record<string, unknown> = {
      config_entry_id: entryId,
      level,
    };
    if (notes) data.notes = notes;
    if (loggedAt) data.logged_at = loggedAt;
    await this.hass.callService('pet_health', 'log_thirst', data);
  }

  async logAppetite(entryId: string, level: string, notes?: string, loggedAt?: string): Promise<void> {
    const data: Record<string, unknown> = {
      config_entry_id: entryId,
      level,
    };
    if (notes) data.notes = notes;
    if (loggedAt) data.logged_at = loggedAt;
    await this.hass.callService('pet_health', 'log_appetite', data);
  }

  async logWellbeing(entryId: string, wellbeingScore: string, symptoms: string[], notes?: string, loggedAt?: string): Promise<void> {
    const data: Record<string, unknown> = {
      config_entry_id: entryId,
      wellbeing_score: wellbeingScore,
    };
    if (symptoms.length > 0) data.symptoms = symptoms;
    if (notes) data.notes = notes;
    if (loggedAt) data.logged_at = loggedAt;
    await this.hass.callService('pet_health', 'log_wellbeing', data);
  }

  async logWeight(entryId: string, weightGrams: number, notes?: string, loggedAt?: string): Promise<void> {
    const data: Record<string, unknown> = {
      config_entry_id: entryId,
      weight_grams: weightGrams,
    };
    if (notes) data.notes = notes;
    if (loggedAt) data.logged_at = loggedAt;
    await this.hass.callService('pet_health', 'log_weight', data);
  }

  async logVomit(entryId: string, vomitType: string, notes?: string, loggedAt?: string): Promise<void> {
    const data: Record<string, unknown> = {
      config_entry_id: entryId,
      vomit_type: vomitType,
    };
    if (notes) data.notes = notes;
    if (loggedAt) data.logged_at = loggedAt;
    await this.hass.callService('pet_health', 'log_vomit', data);
  }

  subscribeToDataUpdates(callback: () => void): Promise<() => void> {
    return this.hass.connection.subscribeEvents(callback, 'pet_health_data_updated');
  }
}
