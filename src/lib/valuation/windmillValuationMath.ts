import type { WindmillTurbineModel } from "@/types/verify-project";

export const WINDMILL_BASE_PRICE_INR = 850;
export const WINDMILL_AIR_DENSITY = 1.225;
export const WINDMILL_CUT_IN_SPEED_MS = 3;
export const WINDMILL_CUT_OUT_SPEED_MS = 25;
export const WINDMILL_NATIONAL_AVERAGE_GEF = 0.76;

export interface WindmillLocation {
  latitude: number;
  longitude: number;
}

export interface WindmillTurbineSpec {
  manufacturer: string;
  model: string;
  capacity_mw: number;
  rotor_diameter_m: number;
  optimal_cp: number;
}

export interface WindmillReadingPeriod {
  startDate: string;
  endDate: string;
  year: number;
}

export interface WindmillValuationMarketData {
  theoretical_capacity_mwh_open_meteo: number;
  theoretical_capacity_mwh_renewables_ninja: number | null;
  theoretical_capacity_mwh_used: number;
  verified_generation_mwh: number;
  total_carbon_credits: number;
  price_per_credit_inr: number;
  total_asset_value_inr: number;
  grid_emission_factor_tco2_per_mwh: number;
}

export interface ComputeWindmillValuationInput {
  theoreticalCapacityMwhOpenMeteo: number;
  theoreticalCapacityMwhRenewablesNinja: number | null;
  theoreticalCapacityMwhUsed: number;
  claimedNetExportMwh: number;
  gridEmissionFactorTco2PerMwh: number;
  pricePerCreditInr?: number;
}

export const WINDMILL_TURBINE_REGISTRY: Record<
  WindmillTurbineModel,
  WindmillTurbineSpec
> = {
  suzlon_s120_2_1_mw: {
    manufacturer: "Suzlon",
    model: "S120",
    capacity_mw: 2.1,
    rotor_diameter_m: 120,
    optimal_cp: 0.42,
  },
  vestas_v110_2_0_mw: {
    manufacturer: "Vestas",
    model: "V110",
    capacity_mw: 2.0,
    rotor_diameter_m: 110,
    optimal_cp: 0.44,
  },
  ge_1_5_sle_1_5_mw: {
    manufacturer: "General Electric",
    model: "1.5-sle",
    capacity_mw: 1.5,
    rotor_diameter_m: 77,
    optimal_cp: 0.38,
  },
  siemens_gamesa_sg_2_1_114_2_1_mw: {
    manufacturer: "Siemens Gamesa",
    model: "SG 2.1-114",
    capacity_mw: 2.1,
    rotor_diameter_m: 114,
    optimal_cp: 0.43,
  },
  envision_en_131_2_5_mw: {
    manufacturer: "Envision",
    model: "EN-131",
    capacity_mw: 2.5,
    rotor_diameter_m: 131,
    optimal_cp: 0.45,
  },
};

const WINDMILL_STATE_GEF_MAP: Record<string, number> = {
  andhra_pradesh: 0.76,
  arunachal_pradesh: 0.76,
  assam: 0.76,
  bihar: 0.76,
  chhattisgarh: 0.76,
  goa: 0.76,
  gujarat: 0.76,
  haryana: 0.76,
  himachal_pradesh: 0.76,
  jharkhand: 0.76,
  karnataka: 0.76,
  kerala: 0.76,
  madhya_pradesh: 0.76,
  maharashtra: 0.76,
  manipur: 0.76,
  meghalaya: 0.76,
  mizoram: 0.76,
  nagaland: 0.76,
  odisha: 0.76,
  punjab: 0.76,
  rajasthan: 0.76,
  sikkim: 0.76,
  tamil_nadu: 0.76,
  telangana: 0.76,
  tripura: 0.76,
  uttar_pradesh: 0.76,
  uttarakhand: 0.76,
  west_bengal: 0.76,
  andaman_and_nicobar: 0.76,
  chandigarh: 0.76,
  dadra_and_nagar_haveli_and_daman_and_diu: 0.76,
  delhi: 0.76,
  jammu_and_kashmir: 0.76,
  ladakh: 0.76,
  lakshadweep: 0.76,
  puducherry: 0.76,
  national_average: 0.76,
};

const WINDMILL_STATE_GEF_ALIASES: Record<string, string> = {
  andaman_and_nicobar_islands: "andaman_and_nicobar",
  nct_of_delhi: "delhi",
  orissa: "odisha",
  pondicherry: "puducherry",
  uttaranchal: "uttarakhand",
  dadra_nagar_haveli_and_daman_diu: "dadra_and_nagar_haveli_and_daman_and_diu",
  dadra_and_nagar_haveli: "dadra_and_nagar_haveli_and_daman_and_diu",
  daman_and_diu: "dadra_and_nagar_haveli_and_daman_and_diu",
};

function roundToPrecision(value: number, precision: number): number {
  const multiplier = 10 ** precision;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

function toDateOnlyIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getLatestFullYearReadingPeriod(
  now: Date = new Date(),
): WindmillReadingPeriod {
  const latestCompletedYear = now.getUTCFullYear() - 1;
  const start = new Date(Date.UTC(latestCompletedYear, 0, 1));
  const end = new Date(Date.UTC(latestCompletedYear, 11, 31));

  return {
    startDate: toDateOnlyIso(start),
    endDate: toDateOnlyIso(end),
    year: latestCompletedYear,
  };
}

export function isWindmillTurbineModel(
  value: string | null | undefined,
): value is WindmillTurbineModel {
  return typeof value === "string" && value in WINDMILL_TURBINE_REGISTRY;
}

export function resolveWindmillTurbineSpec(
  value: string | null | undefined,
): WindmillTurbineSpec | null {
  if (!isWindmillTurbineModel(value)) {
    return null;
  }
  return WINDMILL_TURBINE_REGISTRY[value];
}

export function calculateWindFarmCentroid(
  locations: WindmillLocation[],
): WindmillLocation | null {
  if (!Array.isArray(locations) || locations.length === 0) {
    return null;
  }

  const finiteLocations = locations.filter(
    (location) =>
      Number.isFinite(location.latitude) && Number.isFinite(location.longitude),
  );

  if (finiteLocations.length === 0) {
    return null;
  }

  const totalLatitude = finiteLocations.reduce(
    (sum, location) => sum + location.latitude,
    0,
  );
  const totalLongitude = finiteLocations.reduce(
    (sum, location) => sum + location.longitude,
    0,
  );

  return {
    latitude: totalLatitude / finiteLocations.length,
    longitude: totalLongitude / finiteLocations.length,
  };
}

export function getWindmillLocationsSignature(
  locations: WindmillLocation[],
): string | null {
  if (!Array.isArray(locations) || locations.length === 0) {
    return null;
  }

  const normalized = locations
    .filter(
      (location) =>
        Number.isFinite(location.latitude) && Number.isFinite(location.longitude),
    )
    .map((location) => ({
      latitude: roundToPrecision(location.latitude, 6),
      longitude: roundToPrecision(location.longitude, 6),
    }));

  return normalized.length > 0 ? JSON.stringify(normalized) : null;
}

export function integrateWindEnergyFromHourlySpeeds(params: {
  hourlyWindSpeedsMs: number[];
  rotorDiameterM: number;
  optimalCp: number;
  turbineCount: number;
}): number {
  if (!Array.isArray(params.hourlyWindSpeedsMs) || params.hourlyWindSpeedsMs.length === 0) {
    return 0;
  }

  const turbineCount = Math.max(Math.floor(params.turbineCount), 0);
  if (turbineCount === 0) {
    return 0;
  }

  const rotorDiameterM = Math.max(params.rotorDiameterM, 0);
  const optimalCp = Math.max(params.optimalCp, 0);
  const sweptArea = Math.PI * (rotorDiameterM / 2) ** 2;
  let theoreticalTotalWattHours = 0;

  params.hourlyWindSpeedsMs.forEach((velocity) => {
    if (!Number.isFinite(velocity)) {
      return;
    }
    if (velocity <= WINDMILL_CUT_IN_SPEED_MS || velocity >= WINDMILL_CUT_OUT_SPEED_MS) {
      return;
    }

    const hourlyPowerWatts =
      0.5 *
      WINDMILL_AIR_DENSITY *
      sweptArea *
      velocity ** 3 *
      optimalCp;
    theoreticalTotalWattHours += hourlyPowerWatts;
  });

  const singleTurbineMwh = theoreticalTotalWattHours / 1_000_000;
  return Math.max(singleTurbineMwh * turbineCount, 0);
}

export function normalizeIndianRegionKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function getWindmillGridEmissionFactor(state: string | null | undefined): number {
  if (!state || state.trim().length === 0) {
    return WINDMILL_STATE_GEF_MAP.national_average;
  }

  const key = normalizeIndianRegionKey(state);
  const aliased = WINDMILL_STATE_GEF_ALIASES[key] ?? key;
  const fromMap = WINDMILL_STATE_GEF_MAP[aliased];

  return typeof fromMap === "number"
    ? fromMap
    : WINDMILL_STATE_GEF_MAP.national_average;
}

export function computeWindmillCarbonValuation(
  input: ComputeWindmillValuationInput,
): WindmillValuationMarketData {
  const theoreticalOpenMeteo = Math.max(input.theoreticalCapacityMwhOpenMeteo, 0);
  const theoreticalNinja =
    typeof input.theoreticalCapacityMwhRenewablesNinja === "number" &&
    Number.isFinite(input.theoreticalCapacityMwhRenewablesNinja)
      ? Math.max(input.theoreticalCapacityMwhRenewablesNinja, 0)
      : null;
  const theoreticalUsed = Math.max(input.theoreticalCapacityMwhUsed, 0);
  const claimedNetExportMwh = Math.max(input.claimedNetExportMwh, 0);
  const verifiedGenerationMwh = Math.max(
    Math.min(theoreticalUsed, claimedNetExportMwh),
    0,
  );
  const gridEmissionFactor = Math.max(input.gridEmissionFactorTco2PerMwh, 0);
  const totalCarbonCredits = Math.max(
    Math.round(verifiedGenerationMwh * gridEmissionFactor),
    0,
  );
  const pricePerCreditInr = Math.max(
    Math.floor(input.pricePerCreditInr ?? WINDMILL_BASE_PRICE_INR),
    0,
  );
  const totalAssetValueInr = Math.max(
    Math.round(totalCarbonCredits * pricePerCreditInr),
    0,
  );

  return {
    theoretical_capacity_mwh_open_meteo: roundToPrecision(theoreticalOpenMeteo, 2),
    theoretical_capacity_mwh_renewables_ninja:
      theoreticalNinja === null ? null : roundToPrecision(theoreticalNinja, 2),
    theoretical_capacity_mwh_used: roundToPrecision(theoreticalUsed, 2),
    verified_generation_mwh: roundToPrecision(verifiedGenerationMwh, 2),
    total_carbon_credits: totalCarbonCredits,
    price_per_credit_inr: pricePerCreditInr,
    total_asset_value_inr: totalAssetValueInr,
    grid_emission_factor_tco2_per_mwh: gridEmissionFactor,
  };
}
