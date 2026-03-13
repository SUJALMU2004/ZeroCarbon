import {
  calculateWindFarmCentroid,
  computeWindmillCarbonValuation,
  getLatestFullYearReadingPeriod,
  getWindmillGridEmissionFactor,
  getWindmillLocationsSignature,
  integrateWindEnergyFromHourlySpeeds,
  normalizeIndianRegionKey,
  resolveWindmillTurbineSpec,
} from "@/lib/valuation/windmillValuationMath";

describe("windmillValuationMath", () => {
  it("resolves known turbine model from registry", () => {
    const spec = resolveWindmillTurbineSpec("suzlon_s120_2_1_mw");
    expect(spec).not.toBeNull();
    expect(spec?.manufacturer).toBe("Suzlon");
    expect(spec?.rotor_diameter_m).toBe(120);
  });

  it("calculates centroid for multi-pin wind farm", () => {
    const centroid = calculateWindFarmCentroid([
      { latitude: 15.36, longitude: 75.12 },
      { latitude: 15.4, longitude: 75.2 },
      { latitude: 15.44, longitude: 75.08 },
    ]);

    expect(centroid).not.toBeNull();
    expect(centroid?.latitude ?? 0).toBeCloseTo(15.4, 8);
    expect(centroid?.longitude ?? 0).toBeCloseTo(75.13333333333334, 8);
  });

  it("generates stable windmill location signature", () => {
    const signature = getWindmillLocationsSignature([
      { latitude: 15.364712345, longitude: 75.123498765 },
      { latitude: 15.364799999, longitude: 75.123400001 },
    ]);

    expect(signature).toBe(
      '[{"latitude":15.364712,"longitude":75.123499},{"latitude":15.3648,"longitude":75.1234}]',
    );
  });

  it("computes latest full calendar year period", () => {
    const period = getLatestFullYearReadingPeriod(
      new Date("2026-03-12T08:00:00.000Z"),
    );

    expect(period).toEqual({
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      year: 2025,
    });
  });

  it("integrates open-meteo hourly speeds into farm MWh", () => {
    const mwh = integrateWindEnergyFromHourlySpeeds({
      hourlyWindSpeedsMs: [4, 5, 2, 30],
      rotorDiameterM: 120,
      optimalCp: 0.42,
      turbineCount: 2,
    });

    expect(mwh).toBeCloseTo(1.0997641456, 8);
  });

  it("applies verified generation cap and pricing", () => {
    const market = computeWindmillCarbonValuation({
      theoreticalCapacityMwhOpenMeteo: 120.2,
      theoreticalCapacityMwhRenewablesNinja: 110.7,
      theoreticalCapacityMwhUsed: 110.7,
      claimedNetExportMwh: 90,
      gridEmissionFactorTco2PerMwh: 0.76,
    });

    expect(market).toEqual({
      theoretical_capacity_mwh_open_meteo: 120.2,
      theoretical_capacity_mwh_renewables_ninja: 110.7,
      theoretical_capacity_mwh_used: 110.7,
      verified_generation_mwh: 90,
      total_carbon_credits: 68,
      price_per_credit_inr: 850,
      total_asset_value_inr: 57800,
      grid_emission_factor_tco2_per_mwh: 0.76,
    });
  });

  it("normalizes state keys and falls back to national average", () => {
    expect(normalizeIndianRegionKey("Andaman & Nicobar Islands")).toBe(
      "andaman_and_nicobar_islands",
    );
    expect(getWindmillGridEmissionFactor("Karnataka")).toBe(0.76);
    expect(getWindmillGridEmissionFactor("Andaman & Nicobar Islands")).toBe(0.76);
    expect(getWindmillGridEmissionFactor("Unknown Region")).toBe(0.76);
  });
});
