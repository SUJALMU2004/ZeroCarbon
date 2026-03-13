import {
  composeMethaneFlareConfidence,
  computeMethaneCarbonValuation,
  normalizeCh4Concentration,
} from "@/lib/valuation/methaneValuationMath";

describe("normalizeCh4Concentration", () => {
  it("normalizes percent values into fractions", () => {
    expect(normalizeCh4Concentration(52)).toBe(0.52);
  });

  it("keeps fractional values unchanged", () => {
    expect(normalizeCh4Concentration(0.52)).toBe(0.52);
  });
});

describe("composeMethaneFlareConfidence", () => {
  it("applies 0.7 viirs and 0.3 plume weighting with clamp", () => {
    expect(composeMethaneFlareConfidence(0.9, 0.5)).toBeCloseTo(0.78, 5);
    expect(composeMethaneFlareConfidence(2, 2)).toBe(1);
    expect(composeMethaneFlareConfidence(-1, -1)).toBe(0);
  });
});

describe("computeMethaneCarbonValuation", () => {
  it("returns deterministic methane market output", () => {
    const result = computeMethaneCarbonValuation({
      claimedVolumeM3: 2_500_000,
      ch4Concentration: 0.52,
      flareActiveConfidence: 0.97,
      endUseElectricity: true,
      constants: {
        gwp_multiplier: 28,
        destruction_efficiency: 0.98,
        methane_density_kg_per_m3: 0.717,
        energy_content_kwh_per_m3: 9.94,
        engine_electrical_efficiency: 0.38,
        grid_emission_factor_tco2_per_mwh: 0.82,
        risk_buffer_percent: 0.1,
      },
    });

    expect(result).toEqual({
      verified_ch4_destroyed_tonnes: 904.14,
      destruction_credits: 24809,
      electricity_generated_mwh: 4763.05,
      grid_displacement_credits: 3905,
      total_sellable_credits: 25843,
      price_per_credit_inr: 850,
      total_asset_value_inr: 21966550,
    });
  });

  it("normalizes percent-style constants and concentration inputs", () => {
    const result = computeMethaneCarbonValuation({
      claimedVolumeM3: 1000,
      ch4Concentration: 52,
      flareActiveConfidence: 1,
      endUseElectricity: false,
      constants: {
        gwp_multiplier: 28,
        destruction_efficiency: 98,
        methane_density_kg_per_m3: 0.717,
        energy_content_kwh_per_m3: 9.94,
        engine_electrical_efficiency: 38,
        grid_emission_factor_tco2_per_mwh: 0.82,
        risk_buffer_percent: 10,
      },
    });

    expect(result.total_sellable_credits).toBe(9);
    expect(result.electricity_generated_mwh).toBe(0);
    expect(result.grid_displacement_credits).toBe(0);
  });
});
