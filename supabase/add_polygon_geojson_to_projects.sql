-- Add polygon GeoJSON support for forestry/agricultural project verification.

ALTER TABLE carbon_projects
  ADD COLUMN IF NOT EXISTS polygon_geojson JSONB DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_carbon_projects_polygon_geojson
  ON carbon_projects
  USING GIN (polygon_geojson);

ALTER TABLE carbon_projects
  ADD COLUMN IF NOT EXISTS land_area_hectares DECIMAL(10,2) DEFAULT NULL;
