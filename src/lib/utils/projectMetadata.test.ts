import {
  getNormalizedProjectAiValuation,
  parseProjectReviewNotes,
} from "@/lib/utils/projectMetadata";

describe("parseProjectReviewNotes", () => {
  it("parses legacy forestry valuation without model_type", () => {
    const payload = JSON.stringify({
      submission_metadata: {
        ai_valuation: {
          status: "ready",
          computed_at: "2026-03-10T10:00:00.000Z",
          expires_at: "2026-03-17T10:00:00.000Z",
          input_fingerprint: "abc",
          scientific_data: {
            wood_density: 0.5,
            biomass_expansion_factor: 1.2,
            root_to_shoot_ratio: 0.3,
            carbon_fraction: 0.47,
            annual_volume_growth_per_tree_m3: 0.02,
            theoretical_max_trees_per_ha: 1000,
            risk_buffer_percent: 0.2,
            leakage_percent: 0.1,
            premium_multiplier: 1.2,
          },
          market_data: {
            effective_surviving_trees_per_ha: 500,
            sellable_credits: 100,
            price_per_credit_inr: 1200,
            total_asset_value_inr: 120000,
          },
        },
      },
    });

    const parsed = parseProjectReviewNotes(payload);
    expect(parsed.submissionMetadata.ai_valuation?.model_type).toBe("forestry_agri");
  });

  it("parses solar valuation and normalizes display fields", () => {
    const payload = JSON.stringify({
      submission_metadata: {
        ai_valuation: {
          status: "ready",
          model_type: "solar",
          computed_at: "2026-03-10T10:00:00.000Z",
          expires_at: "2026-03-17T10:00:00.000Z",
          input_fingerprint: "xyz",
          solar_scientific_data: {
            panel_efficiency: 0.2,
            performance_ratio: 0.8,
            annual_degradation_rate: 0.01,
            grid_emission_factor_tco2_per_mwh: 0.8,
            risk_buffer_percent: 0.1,
          },
          solar_market_data: {
            verified_annual_energy_mwh: 5000,
            sellable_credits: 3000,
            price_per_credit_inr: 800,
            total_asset_value_inr: 2400000,
          },
        },
      },
    });

    const parsed = parseProjectReviewNotes(payload);
    const normalized = getNormalizedProjectAiValuation(
      parsed.submissionMetadata.ai_valuation,
    );

    expect(normalized.modelType).toBe("solar");
    expect(normalized.creditsAvailable).toBe(3000);
    expect(normalized.pricePerCreditInr).toBe(800);
    expect(normalized.totalAssetValueInr).toBe(2400000);
    expect(normalized.verifiedAnnualEnergyMwh).toBe(5000);
    expect(normalized.effectiveSurvivingTreesPerHa).toBeNull();
  });

  it("returns empty metadata for malformed review notes", () => {
    const parsed = parseProjectReviewNotes("{invalid_json");
    expect(parsed.submissionMetadata).toEqual({});
  });

  it("parses methane valuation and normalizes display fields", () => {
    const payload = JSON.stringify({
      submission_metadata: {
        ai_valuation: {
          status: "ready",
          model_type: "methane",
          computed_at: "2026-03-10T10:00:00.000Z",
          expires_at: "2026-03-17T10:00:00.000Z",
          input_fingerprint: "methane-fp",
          methane_scientific_data: {
            gwp_multiplier: 28,
            destruction_efficiency: 0.98,
            methane_density_kg_per_m3: 0.717,
            energy_content_kwh_per_m3: 9.94,
            engine_electrical_efficiency: 0.38,
            grid_emission_factor_tco2_per_mwh: 0.82,
            risk_buffer_percent: 0.1,
            flare_active_confidence: 0.97,
            viirs_score: 0.9,
            plume_drop_score: 0.7,
            viirs_current_mean_frp: 56.2,
            s5p_current_mean_ch4: 1800,
            s5p_baseline_mean_ch4: 1850,
            satellite_raw_response: {},
          },
          methane_market_data: {
            verified_ch4_destroyed_tonnes: 904.14,
            destruction_credits: 24809,
            electricity_generated_mwh: 4763.05,
            grid_displacement_credits: 3905,
            total_sellable_credits: 25843,
            price_per_credit_inr: 850,
            total_asset_value_inr: 21966550,
          },
        },
      },
    });

    const parsed = parseProjectReviewNotes(payload);
    const normalized = getNormalizedProjectAiValuation(
      parsed.submissionMetadata.ai_valuation,
    );

    expect(normalized.modelType).toBe("methane");
    expect(normalized.creditsAvailable).toBe(25843);
    expect(normalized.pricePerCreditInr).toBe(850);
    expect(normalized.totalAssetValueInr).toBe(21966550);
    expect(normalized.effectiveSurvivingTreesPerHa).toBeNull();
    expect(normalized.verifiedAnnualEnergyMwh).toBeNull();
  });

  it("parses windmill valuation and normalizes display fields", () => {
    const payload = JSON.stringify({
      submission_metadata: {
        ai_valuation: {
          status: "ready",
          model_type: "windmill",
          computed_at: "2026-03-10T10:00:00.000Z",
          expires_at: "2026-03-17T10:00:00.000Z",
          input_fingerprint: "wind-fp",
          windmill_scientific_data: {
            turbine_model_key: "suzlon_s120_2_1_mw",
            manufacturer: "Suzlon",
            model: "S120",
            capacity_mw: 2.1,
            rotor_diameter_m: 120,
            optimal_cp: 0.42,
            centroid_latitude: 15.36,
            centroid_longitude: 75.12,
            reading_period_start: "2025-01-01",
            reading_period_end: "2025-12-31",
            reading_period_year: 2025,
            source_mode: "dual",
            open_meteo_hour_count: 8760,
            open_meteo_base_url: "https://archive-api.open-meteo.com/v1/archive",
            renewables_ninja_base_url: "https://www.renewables.ninja/api",
            renewables_ninja_error: null,
            renewables_ninja_available: true,
            api_diagnostics: {},
          },
          windmill_market_data: {
            theoretical_capacity_mwh_open_meteo: 11450.2,
            theoretical_capacity_mwh_renewables_ninja: 10890.7,
            theoretical_capacity_mwh_used: 10890.7,
            verified_generation_mwh: 9800.2,
            total_carbon_credits: 7448,
            price_per_credit_inr: 850,
            total_asset_value_inr: 6330800,
            grid_emission_factor_tco2_per_mwh: 0.76,
          },
        },
      },
    });

    const parsed = parseProjectReviewNotes(payload);
    const normalized = getNormalizedProjectAiValuation(
      parsed.submissionMetadata.ai_valuation,
    );

    expect(normalized.modelType).toBe("windmill");
    expect(normalized.creditsAvailable).toBe(7448);
    expect(normalized.pricePerCreditInr).toBe(850);
    expect(normalized.totalAssetValueInr).toBe(6330800);
    expect(normalized.verifiedAnnualEnergyMwh).toBe(9800.2);
    expect(normalized.effectiveSurvivingTreesPerHa).toBeNull();
  });
});
