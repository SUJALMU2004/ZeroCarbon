import { computeSolarCarbonValuation } from "@/lib/valuation/solarValuationMath";

describe("computeSolarCarbonValuation", () => {
  it("returns deterministic solar sellable credits and INR pricing", () => {
    const result = computeSolarCarbonValuation({
      verifiedTotalAreaM2: 50000,
      annualGhiKwhPerM2: 1950,
      ageYears: 4,
      constants: {
        panel_efficiency: 0.2,
        performance_ratio: 0.8,
        annual_degradation_rate: 0.005,
        grid_emission_factor_tco2_per_mwh: 0.82,
        risk_buffer_percent: 0.1,
      },
    });

    expect(result).toEqual({
      verified_annual_energy_mwh: 10703.23,
      sellable_credits: 7898,
      price_per_credit_inr: 800,
      total_asset_value_inr: 6318400,
    });
  });

  it("normalizes 0..100 percent-style fields", () => {
    const result = computeSolarCarbonValuation({
      verifiedTotalAreaM2: 1000,
      annualGhiKwhPerM2: 1000,
      ageYears: 1,
      constants: {
        panel_efficiency: 20,
        performance_ratio: 80,
        annual_degradation_rate: 0.5,
        grid_emission_factor_tco2_per_mwh: 1,
        risk_buffer_percent: 10,
      },
    });

    expect(result.sellable_credits).toBe(50);
    expect(result.price_per_credit_inr).toBe(800);
  });
});
