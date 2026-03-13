import type { IndustrySector } from "@/types/emissions-calculator";

const STATE_TO_ELECTRICITY_MAPS_ZONE: Record<string, string> = {
  andhra_pradesh: "IN",
  arunachal_pradesh: "IN",
  assam: "IN",
  bihar: "IN",
  chhattisgarh: "IN",
  goa: "IN",
  gujarat: "IN",
  haryana: "IN",
  himachal_pradesh: "IN",
  jharkhand: "IN",
  karnataka: "IN",
  kerala: "IN",
  madhya_pradesh: "IN",
  maharashtra: "IN",
  manipur: "IN",
  meghalaya: "IN",
  mizoram: "IN",
  nagaland: "IN",
  odisha: "IN",
  punjab: "IN",
  rajasthan: "IN",
  sikkim: "IN",
  tamil_nadu: "IN",
  telangana: "IN",
  tripura: "IN",
  uttar_pradesh: "IN",
  uttarakhand: "IN",
  west_bengal: "IN",
  andaman_and_nicobar_islands: "IN",
  chandigarh: "IN",
  dadra_and_nagar_haveli_and_daman_and_diu: "IN",
  delhi: "IN",
  jammu_and_kashmir: "IN",
  ladakh: "IN",
  lakshadweep: "IN",
  puducherry: "IN",
};

const DEFAULT_SECTOR_CLASSIFICATION = "exiobase-i-27";

const INDUSTRY_TO_CLIMATIQ_CLASSIFICATION: Record<IndustrySector, string> = {
  it_services: DEFAULT_SECTOR_CLASSIFICATION,
  manufacturing: DEFAULT_SECTOR_CLASSIFICATION,
  logistics: DEFAULT_SECTOR_CLASSIFICATION,
  energy: DEFAULT_SECTOR_CLASSIFICATION,
  retail: DEFAULT_SECTOR_CLASSIFICATION,
  agriculture: DEFAULT_SECTOR_CLASSIFICATION,
  finance: DEFAULT_SECTOR_CLASSIFICATION,
  healthcare: DEFAULT_SECTOR_CLASSIFICATION,
  construction: DEFAULT_SECTOR_CLASSIFICATION,
  other: DEFAULT_SECTOR_CLASSIFICATION,
};

function normalizeRegionKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
}

function industryOverrideEnvKey(industry: IndustrySector): string {
  return `CLIMATIQ_CLASSIFICATION_${industry.toUpperCase()}`;
}

export function getElectricityMapsZoneForState(state: string): string | null {
  const key = normalizeRegionKey(state);
  const zone = STATE_TO_ELECTRICITY_MAPS_ZONE[key];
  return zone ?? null;
}

export function getClimatiqClassificationForIndustry(
  industry: IndustrySector,
): string | null {
  const override = process.env[industryOverrideEnvKey(industry)]?.trim();
  if (override) {
    return override;
  }

  const mapped = INDUSTRY_TO_CLIMATIQ_CLASSIFICATION[industry];
  return mapped?.trim() || null;
}
