export interface Unit {
  model_number: string;
  serial_number: string;
  manufacture_date: string;
  age_years: number;
  brand: string;
  refrigerant_type: string;
  system_type: "Split" | "Mini Split" | "Package" | "Heat Pump";
  tonnage: number;
  nameplate_photo_path: string;
}

export interface Readings {
  high_side_psi: number;
  low_side_psi: number;
  suction_line_temp_f: number;
  liquid_line_temp_f: number;
  superheat_f: number;
  subcooling_f: number;
  supply_air_temp_f: number;
  return_air_temp_f: number;
  delta_t_f: number;
  voltage: number;
  amperage: number;
  static_pressure_in_wc: number;
  outdoor_temp_f: number;
  taken_at: string;
}

export type FindingType =
  | "capacitor_bulging"
  | "capacitor_reading"
  | "contactor_pitting"
  | "fault_code"
  | "wiring_diagram_pulled"
  | "coil_dirty"
  | "filter_dirty"
  | "refrigerant_leak_suspected"
  | "damage_detected";

export interface Finding {
  id: string;
  type: FindingType;
  severity: "info" | "warning" | "critical";
  description: string;
  photo_path: string;
  component: string;
}

export interface Part {
  name: string;
  spec: string;
  reason: string;
}

export interface Diagnosis {
  primary_issue: string;
  confidence: "high" | "medium" | "low";
  technical_summary: string;
  recommended_actions: string[];
  parts_needed: Part[];
  urgency: "routine" | "urgent" | "emergency";
  full_llm_output: string;
}

export type ActionType =
  | "refrigerant_added"
  | "part_replaced"
  | "repair_made"
  | "cleaned"
  | "adjusted"
  | "inspected_only"
  | "deferred";

export interface Action {
  id: string;
  type: ActionType;
  description: string;
  quantity: number;
  unit: string;
  part_number: string;
  timestamp: string;
}

export interface Photo {
  id: string;
  file_path: string;
  type: "nameplate" | "capacitor" | "contactor" | "wiring" | "coil" | "general";
  caption: string;
  taken_at: string;
}

export interface Job {
  id: string;
  created_at: string;
  completed_at: string;
  duration_minutes: number;
  customer_address: string;
  customer_name: string;
  customer_phone: string;
  technician_id: string;
  technician_name: string;
  unit: Unit;
  readings: Readings;
  findings: Finding[];
  diagnosis: Diagnosis;
  actions: Action[];
  service_report: string;
  photos: Photo[];
  notes: Note[];
  clips: Clip[];
  story?: JobStory;
  signature?: Signature;
  source?: "local" | "jobber";
  jobberJobId?: string;
  status: "in_progress" | "completed";
}

export interface Signature {
  paths: string;
  signed_at: string;
  signed_by: string;
}

export interface Note {
  id: string;
  text: string;
  source: "manual" | "vision";
  created_at: string;
  created_by: string;
  tags?: string[];
  category?: string;
  reminder?: string;
}

export interface Clip {
  id: string;
  file_path: string;
  duration_seconds: number;
  thumbnail_path: string;
  caption: string;
  recorded_at: string;
  recorded_by: string;
}

export interface StorySegment {
  id: string;
  timestamp_start: number;
  timestamp_end: number;
  thumbnail_path: string;
  title: string;
  description: string;
  tag: "travel" | "inspection" | "diagnostic" | "repair" | "customer" | "complete";
}

export interface JobStory {
  id: string;
  job_id: string;
  video_path: string;
  summary: string;
  segments: StorySegment[];
  generated_at: string;
}
