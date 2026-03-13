import {
  computeCarbonValuation,
  normalizePercentFraction,
} from "@/lib/valuation/carbonValuationMath";

describe("normalizePercentFraction", () => {
  it("normalizes 0..100 percent values", () => {
    expect(normalizePercentFraction(25)).toBe(0.25);
  });

  it("keeps 0..1 fraction values", () => {
    expect(normalizePercentFraction(0.18)).toBe(0.18);
  });

  it("clamps out-of-range values safely", () => {
    expect(normalizePercentFraction(-5)).toBe(0);
    expect(normalizePercentFraction(500)).toBe(1);
  });
});

describe("computeCarbonValuation", () => {
  it("returns deterministic sellable credits and INR pricing", () => {
    const result = computeCarbonValuation({
      ndviScore: 0.85,
      verifiedAreaHa: 5.57,
      ageYears: 20,
      constants: {
        wood_density: 0.56,
        biomass_expansion_factor: 1.25,
        root_to_shoot_ratio: 0.26,
        carbon_fraction: 0.47,
        annual_volume_growth_per_tree_m3: 0.02,
        theoretical_max_trees_per_ha: 1200,
        risk_buffer_percent: 0.2,
        leakage_percent: 0.1,
        premium_multiplier: 1.4,
      },
    });

    expect(result).toEqual({
      effective_surviving_trees_per_ha: 1020,
      sellable_credits: 2485,
      price_per_credit_inr: 1428,
      total_asset_value_inr: 3548580,
    });
  });
});
