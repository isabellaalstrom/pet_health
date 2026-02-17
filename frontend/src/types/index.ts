export interface HomeAssistant {
  callWS: (params: any) => Promise<any>;
  callService: (domain: string, service: string, data: any) => Promise<any>;
  connection: {
    subscribeEvents: (callback: (event: any) => void, eventType: string) => Promise<() => void>;
  };
  states: Record<string, any>;
}

export interface PetEntry {
  entry_id: string;
  pet_id?: string;
  name: string;
  pet_type?: string;
  pet_image_path?: string;
  data?: {
    pet_image_path?: string;
  };
}

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

export interface StoreData {
  visits?: Visit[];
  medications?: Record<string, MedicationLog[]>;
  meals?: any[];
  drinks?: any[];
  weights?: any[];
  vomits?: any[];
  assessments?: any[];
}

export type View = 'dashboard' | 'visits' | 'medications' | 'health' | 'nutrition';
