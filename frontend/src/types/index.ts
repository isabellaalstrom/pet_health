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
  generic_log_categories?: Category[];
}

export interface Category {
  category_id: string;
  category_name: string;
}

// Visit types
export interface Visit {
  visit_id: string;
  timestamp: string;
  pet_id?: string;
  did_pee?: boolean;
  did_poop?: boolean;
  poop_consistencies?: string;  // API returns this field name
  poop_color?: string;  // API returns this field name
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
  poop_consistencies?: string[];  // Service expects array
  poop_color?: string;
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
  pet_id?: string;
  medication_name: string;  // API returns this field name
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
  poop_consistencies?: string[];  // Service expects array
  poop_color?: string;
  urine_amount?: number;
  notes?: string;
}

// Store data types
export interface DrinkRecord {
  timestamp: string;
  pet_id: string;
  amount: string;
  notes?: string;
}

export interface MealRecord {
  timestamp: string;
  pet_id: string;
  amount: string;
  food_type?: string;
  notes?: string;
}

export interface ThirstLevelRecord {
  timestamp: string;
  pet_id: string;
  level: string;
  notes?: string;
}

export interface AppetiteLevelRecord {
  timestamp: string;
  pet_id: string;
  level: string;
  notes?: string;
}

export interface WellbeingRecord {
  timestamp: string;
  pet_id: string;
  wellbeing_score: string;
  symptoms?: string[];
  notes?: string;
}

export interface WeightRecord {
  timestamp: string;
  pet_id: string;
  weight_grams: number;
  notes?: string;
}

export interface VomitRecord {
  timestamp: string;
  pet_id: string;
  vomit_type: string;
  notes?: string;
}

export interface GenericLog {
  log_id: string;
  timestamp: string;
  pet_id: string;
  category: string;
  notes: string;
}

export interface StoreData {
  visits?: Visit[];
  medications?: Record<string, MedicationLog[]>;
  meals?: MealRecord[];
  drinks?: DrinkRecord[];
  weight?: WeightRecord[];
  vomit?: VomitRecord[];
  thirst_levels?: ThirstLevelRecord[];
  appetite_levels?: AppetiteLevelRecord[];
  wellbeing?: WellbeingRecord[];
  generic_logs?: GenericLog[];
}

// View types
export type View = 'dashboard' | 'visits' | 'medications' | 'health' | 'nutrition' | 'logs';
