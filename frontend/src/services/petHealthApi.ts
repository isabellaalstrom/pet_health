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
  constructor(private hass: HomeAssistant) {}

  async getPetData(): Promise<PetEntry[]> {
    const result = await this.hass.callWS<{ entries: PetEntry[] }>({
      type: 'pet_health/get_pet_data',
    });
    return result?.entries || [];
  }

  async getStoreDump(entryId?: string): Promise<StoreData> {
    const result = await this.hass.callWS<StoreData>({
      type: 'pet_health/get_store_dump',
      entry_id: entryId,
    });
    return result || {};
  }

  async getVisits(entryId: string): Promise<Visit[]> {
    const result = await this.hass.callWS<Visit[]>({
      type: 'pet_health/get_visits',
      entry_id: entryId,
    });
    return result || [];
  }

  async getUnknownVisits(): Promise<Visit[]> {
    const result = await this.hass.callWS<Visit[]>({
      type: 'pet_health/get_unknown_visits',
    });
    return result || [];
  }

  async getMedications(entryId: string): Promise<MedicationLog[]> {
    const result = await this.hass.callWS<MedicationLog[]>({
      type: 'pet_health/get_medications',
      entry_id: entryId,
    });
    return result || [];
  }

  async logBathroomVisit(data: LogBathroomVisitData): Promise<void> {
    await this.hass.callService('pet_health', 'log_bathroom_visit', data);
  }

  async logMedication(data: LogMedicationData): Promise<void> {
    await this.hass.callService('pet_health', 'log_medication', data);
  }

  async confirmVisit(visitId: string, entryId: string): Promise<void> {
    await this.hass.callService('pet_health', 'confirm_visit', {
      visit_id: visitId,
      config_entry_id: entryId,
    });
  }

  async deleteVisit(visitId: string, entryId: string): Promise<void> {
    await this.hass.callService('pet_health', 'delete_visit', {
      visit_id: visitId,
      config_entry_id: entryId,
    });
  }

  async amendVisit(visitId: string, entryId: string, data: AmendVisitData): Promise<void> {
    await this.hass.callService('pet_health', 'amend_visit', {
      visit_id: visitId,
      config_entry_id: entryId,
      ...data,
    });
  }

  async reassignVisit(visitId: string, newEntryId: string): Promise<void> {
    await this.hass.callService('pet_health', 'reassign_visit', {
      visit_id: visitId,
      new_config_entry_id: newEntryId,
    });
  }

  subscribeToDataUpdates(callback: () => void): Promise<() => void> {
    return this.hass.connection.subscribeEvents(callback, 'pet_health_data_updated');
  }
}
