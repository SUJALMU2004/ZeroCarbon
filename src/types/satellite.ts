export type ProjectType = "forestry" | "solar" | "methane" | "other";

export type SatelliteStatus = "pending" | "processing" | "completed" | "failed";

export interface ProjectSatelliteData {
  id: string;
  project_name: string;
  project_type: ProjectType;
  latitude: number;
  longitude: number;
  land_area_hectares: number;
  estimated_co2_per_year: number;
  satellite_status: SatelliteStatus | string;
  satellite_ndvi_current: number | null;
  satellite_ndvi_2020: number | null;
  satellite_ndvi_2022: number | null;
  satellite_ndvi_2024: number | null;
  satellite_ndvi_trend: "positive" | "flat" | "negative" | null | string;
  satellite_confidence_score: number | null;
  satellite_confidence_badge: "High" | "Medium" | "Low" | null | string;
  satellite_thumbnail_url: string | null;
  satellite_verified_at: string | null;
  price_per_credit: null;
}
