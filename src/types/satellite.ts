export type ProjectType = "forestry" | "agricultural" | "solar" | "methane" | "windmill";

export type SatelliteStatus = "pending" | "processing" | "completed" | "failed";

export interface ProjectSatelliteData {
  id: string;
  project_name: string;
  project_type: ProjectType;
  latitude: number;
  longitude: number;
  land_area_hectares: number | null;
  estimated_co2_per_year: number | null;
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
  project_image_url: string | null;
  price_per_credit_inr: number | null;
}
