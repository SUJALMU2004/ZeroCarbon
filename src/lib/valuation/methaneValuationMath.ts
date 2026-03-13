import { normalizePercentFraction } from "@/lib/valuation/carbonValuationMath";

export const METHANE_BASE_PRICE_INR = 850;

export interface MethaneScientificConstants {
  gwp_multiplier: number;
  destruction_efficiency: number;
  methane_density_kg_per_m3: number;
  energy_content_kwh_per_m3: number;
  engine_electrical_efficiency: number;
  grid_emission_factor_tco2_per_mwh: number;
  risk_buffer_percent: number;
}

export interface MethaneValuationInput {
  claimedVolumeM3: number;
  ch4Concentration: number;
  flareActiveConfidence: number;
  endUseElectricity: boolean;
  constants: MethaneScientificConstants;
}

export interface MethaneValuationMarketData {
  verified_ch4_destroyed_tonnes: number;
  destruction_credits: number;
  electricity_generated_mwh: number;
  grid_displacement_credits: number;
  total_sellable_credits: number;
  price_per_credit_inr: number;
  total_asset_value_inr: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function normalizeCh4Concentration(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const normalized = value > 1 ? value / 100 : value;
  return clamp(normalized, 0, 1);
}

export function composeMethaneFlareConfidence(
  viirsScore: number,
  plumeDropScore: number,
): number {
  return clamp(0.7 * viirsScore + 0.3 * plumeDropScore, 0, 1);
}

export function computeMethaneCarbonValuation(
  input: MethaneValuationInput,
): MethaneValuationMarketData {
  const claimedVolumeM3 = Math.max(input.claimedVolumeM3, 0);
  const ch4Fraction = normalizeCh4Concentration(input.ch4Concentration);
  const flareActiveConfidence = clamp(input.flareActiveConfidence, 0, 1);

  const gwpMultiplier = Math.max(input.constants.gwp_multiplier, 0);
  const destructionEfficiency = clamp(
    normalizePercentFraction(input.constants.destruction_efficiency),
    0,
    1,
  );
  const methaneDensity = Math.max(input.constants.methane_density_kg_per_m3, 0);
  const energyContent = Math.max(input.constants.energy_content_kwh_per_m3, 0);
  const engineElectricalEfficiency = clamp(
    normalizePercentFraction(input.constants.engine_electrical_efficiency),
    0,
    1,
  );
  const gridEmissionFactor = Math.max(
    input.constants.grid_emission_factor_tco2_per_mwh,
    0,
  );
  const riskBufferPercent = clamp(
    normalizePercentFraction(input.constants.risk_buffer_percent),
    0,
    1,
  );

  const verifiedPureCh4M3 =
    claimedVolumeM3 * ch4Fraction * flareActiveConfidence;
  const ch4Tonnes = (verifiedPureCh4M3 * methaneDensity) / 1000;
  const destructionCo2e = ch4Tonnes * destructionEfficiency * gwpMultiplier;

  let generatedMwh = 0;
  let displacementCo2e = 0;
  if (input.endUseElectricity) {
    generatedMwh =
      (verifiedPureCh4M3 * energyContent * engineElectricalEfficiency) / 1000;
    displacementCo2e = generatedMwh * gridEmissionFactor;
  }

  const grossCo2e = destructionCo2e + displacementCo2e;
  const bufferPool = grossCo2e * riskBufferPercent;
  const totalSellableCredits = Math.max(Math.floor(grossCo2e - bufferPool), 0);
  const totalAssetValueInr = Math.max(
    Math.floor(totalSellableCredits * METHANE_BASE_PRICE_INR),
    0,
  );

  return {
    verified_ch4_destroyed_tonnes:
      Math.round((ch4Tonnes + Number.EPSILON) * 100) / 100,
    destruction_credits: Math.max(Math.floor(destructionCo2e), 0),
    electricity_generated_mwh:
      Math.round((generatedMwh + Number.EPSILON) * 100) / 100,
    grid_displacement_credits: Math.max(Math.floor(displacementCo2e), 0),
    total_sellable_credits: totalSellableCredits,
    price_per_credit_inr: METHANE_BASE_PRICE_INR,
    total_asset_value_inr: totalAssetValueInr,
  };
}
