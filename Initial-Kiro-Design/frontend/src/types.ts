// Mirrors backend/app/models.py

export type Role = 'renter' | 'owner';
export type ScoreLabel = 'Low' | 'Moderate' | 'High' | 'Very high';

export interface Location {
  block_id: string;
  label: string;
  city_line: string;
  neighborhood: string | null;
  lat: number;
  lon: number;
}

export interface LookupResponse {
  status: 'ok' | 'out_of_coverage' | 'not_found';
  searched: string;
  location: Location | null;
}

export interface Reason {
  id: string;
  title: string;
  text: string;
}

export interface Report {
  location: Location;
  heat: {
    score: number;
    label: ScoreLabel;
    block_surface_temp_f: number;
    city_avg_surface_temp_f: number;
    coolest_neighborhood_surface_temp_f: number;
    delta_vs_city_f: number;
    reasons: Reason[];
  };
  trees: { score: number; label: ScoreLabel; canopy_pct: number };
  solar: { status: 'coming_soon' | 'ready'; score: number | null };
  roof_is_dark: boolean;
  data_notes: { surface_temp_source: string; imagery_source: string; comparison_area: string };
  demo_data: boolean;
}

export interface PlanAction {
  program_id: string;
  title: string;
  why: string;
  cta_label: string;
  cta_url: string | null;
  tag: string | null;
  icon: string;
}

export interface Plan {
  role: Role;
  summary: string;
  actions: PlanAction[];
  generated_by: 'claude' | 'rules';
}
