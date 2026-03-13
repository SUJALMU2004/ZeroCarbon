import { normalizePercentFraction } from "@/lib/valuation/carbonValuationMath";

export const SOLAR_BASE_PRICE_INR = 800;

export interface SolarScientificConstants {
  panel_efficiency: number;
  performance_ratio: number;
  annual_degradation_rate: number;
  grid_emission_factor_tco2_per_mwh: number;
  risk_buffer_percent: number;
}

export interface SolarValuationInput {
  verifiedTotalAreaM2: number;
  annualGhiKwhPerM2: number;
  ageYears: number;
  constants: SolarScientificConstants;
}

export interface SolarValuationMarketData {
  verified_annual_energy_mwh: number;
  sellable_credits: number;
  price_per_credit_inr: number;
  total_asset_value_inr: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function computeSolarCarbonValuation(
  input: SolarValuationInput,
): SolarValuationMarketData {
  const verifiedTotalAreaM2 = Math.max(input.verifiedTotalAreaM2, 0);
  const annualGhiKwhPerM2 = Math.max(input.annualGhiKwhPerM2, 0);
  const ageYears = Math.max(input.ageYears, 0);

  const panelEfficiency = clamp(
    normalizePercentFraction(input.constants.panel_efficiency),
    0,
    1,
  );
  const performanceRatio = clamp(
    normalizePercentFraction(input.constants.performance_ratio),
    0,
    1,
  );
  const annualDegradationRate = clamp(
    normalizePercentFraction(input.constants.annual_degradation_rate),
    0,
    1,
  );
  const riskBufferFraction = clamp(
    normalizePercentFraction(input.constants.risk_buffer_percent),
    0,
    1,
  );
  const gridEmissionFactor = Math.max(
    input.constants.grid_emission_factor_tco2_per_mwh,
    0,
  );

  const usablePanelAreaM2 = verifiedTotalAreaM2 * 0.7;
  const efficiencyRemaining = Math.pow(1 - annualDegradationRate, ageYears);

  const annualKwhGenerated =
    usablePanelAreaM2 *
    annualGhiKwhPerM2 *
    panelEfficiency *
    performanceRatio *
    efficiencyRemaining;

  const annualMwhGenerated = annualKwhGenerated / 1000;
  const grossCo2e = annualMwhGenerated * gridEmissionFactor;
  const bufferPool = grossCo2e * riskBufferFraction;

  const sellableCredits = Math.max(Math.floor(grossCo2e - bufferPool), 0);
  const totalAssetValueInr = Math.max(
    Math.floor(sellableCredits * SOLAR_BASE_PRICE_INR),
    0,
  );

  return {
    verified_annual_energy_mwh:
      Math.round((annualMwhGenerated + Number.EPSILON) * 100) / 100,
    sellable_credits: sellableCredits,
    price_per_credit_inr: SOLAR_BASE_PRICE_INR,
    total_asset_value_inr: totalAssetValueInr,
  };
}
