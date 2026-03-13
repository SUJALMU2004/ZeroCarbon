export const BASE_PRICE_INR = 1200;
export const CO2_TO_CARBON_RATIO = 44.01 / 12.011;

export interface CarbonScientificConstants {
  wood_density: number;
  biomass_expansion_factor: number;
  root_to_shoot_ratio: number;
  carbon_fraction: number;
  annual_volume_growth_per_tree_m3: number;
  theoretical_max_trees_per_ha: number;
  risk_buffer_percent: number;
  leakage_percent: number;
  premium_multiplier: number;
}

export interface CarbonValuationInput {
  ndviScore: number;
  verifiedAreaHa: number;
  ageYears: number;
  constants: CarbonScientificConstants;
}

export interface CarbonValuationMarketData {
  effective_surviving_trees_per_ha: number;
  sellable_credits: number;
  price_per_credit_inr: number;
  total_asset_value_inr: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function normalizePercentFraction(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const normalized = value > 1 ? value / 100 : value;
  return clamp(normalized, 0, 1);
}

export function computeCarbonValuation(
  input: CarbonValuationInput,
): CarbonValuationMarketData {
  const ndviScore = clamp(input.ndviScore, 0, 1);
  const verifiedAreaHa = Math.max(input.verifiedAreaHa, 0);
  const ageYears = Math.max(input.ageYears, 0);
  const constants = input.constants;

  const riskBufferFraction = normalizePercentFraction(constants.risk_buffer_percent);
  const leakageFraction = normalizePercentFraction(constants.leakage_percent);
  const premiumMultiplier = Math.max(constants.premium_multiplier, 0);

  const effectiveDensity = Math.max(
    constants.theoretical_max_trees_per_ha * ndviScore,
    0,
  );
  const volumePerHa =
    effectiveDensity * constants.annual_volume_growth_per_tree_m3 * ageYears;

  const agbPerHa =
    volumePerHa * constants.wood_density * constants.biomass_expansion_factor;
  const bgbPerHa = agbPerHa * constants.root_to_shoot_ratio;

  const totalBiomass = (agbPerHa + bgbPerHa) * verifiedAreaHa;
  const totalCarbon = totalBiomass * constants.carbon_fraction;
  const grossCo2e = totalCarbon * CO2_TO_CARBON_RATIO;

  const leakageDeduction = grossCo2e * leakageFraction;
  const netCo2e = grossCo2e - leakageDeduction;
  const bufferPool = netCo2e * riskBufferFraction;

  const sellableCredits = Math.max(Math.floor(netCo2e - bufferPool), 0);
  const pricePerCreditInr = Math.max(
    Math.floor(BASE_PRICE_INR * premiumMultiplier * ndviScore),
    0,
  );
  const totalAssetValueInr = Math.max(
    Math.floor(sellableCredits * pricePerCreditInr),
    0,
  );

  return {
    effective_surviving_trees_per_ha: Math.max(Math.floor(effectiveDensity), 0),
    sellable_credits: sellableCredits,
    price_per_credit_inr: pricePerCreditInr,
    total_asset_value_inr: totalAssetValueInr,
  };
}
