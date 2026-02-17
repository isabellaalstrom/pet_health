// Home Assistant types
export interface HomeAssistant {
  callWS: <T = unknown>(params: Record<string, unknown>) => Promise<T>;
  callService: (domain: string, service: string, data?: Record<string, unknown>) => Promise<void>;
  connection: {
    subscribeEvents: (callback: (event: unknown) => void, eventType: string) => Promise<() => void>;
  };
  states: Record<string, unknown>;
}

// Pet types
export interface PetEntry {
  entry_id: string;
  title?: string;
  pet_id?: string;
  pet_name?: string;
  name?: string;
  pet_type?: string;
  pet_image_path?: string;
  medications?: Medication[];
}

// Visit types
export interface Visit {
  visit_id: string;
  timestamp: string;
  did_pee?: boolean;
  did_poop?: boolean;
  consistency?: string;
  color?: string;
  urine_amount?: number;
  notes?: string;
  confirmed?: boolean;
  config_entry_id?: string;
}

export interface LogBathroomVisitData extends Record<string, unknown> {
  config_entry_id: string;
  timestamp?: string;
  did_pee?: boolean;
  did_poop?: boolean;
  consistency?: string;
  color?: string;
  urine_amount?: number;
  notes?: string;
  confirmed?: boolean;
}

// Medication types
export interface Medication {
  medication_id: string;
  medication_name: string;
  dosage?: string;
  unit?: string;
}

export interface MedicationLog {
  timestamp: string;
  medication_id: string;
  dosage?: string;
  unit?: string;
  notes?: string;
}

export interface LogMedicationData extends Record<string, unknown> {
  config_entry_id: string;
  medication_id: string;
  timestamp?: string;
  dosage?: string;
  unit?: string;
  notes?: string;
}

export interface AmendVisitData extends Record<string, unknown> {
  did_pee?: boolean;
  did_poop?: boolean;
  consistency?: string;
  color?: string;
  urine_amount?: number;
  notes?: string;
}

// Store data types
export interface StoreData {
  visits?: Visit[];
  medications?: Record<string, MedicationLog[]>;
  meals?: unknown[];
  drinks?: unknown[];
  weights?: unknown[];
  vomits?: unknown[];
  assessments?: unknown[];
}

// View types
export type View = 'dashboard' | 'visits' | 'medications' | 'health' | 'nutrition';
