export type ProjectAiValuationStatus =
  | "ready"
  | "pending_inputs"
  | "error"
  | "not_applicable";

export type ProjectAiValuationModelType =
  | "forestry_agri"
  | "solar"
  | "methane"
  | "windmill";

export interface ProjectAiValuationScientificData {
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

export interface ProjectAiValuationMarketData {
  effective_surviving_trees_per_ha: number;
  sellable_credits: number;
  price_per_credit_inr: number;
  total_asset_value_inr: number;
}

export interface ProjectAiValuationSolarScientificData {
  panel_efficiency: number;
  performance_ratio: number;
  annual_degradation_rate: number;
  grid_emission_factor_tco2_per_mwh: number;
  risk_buffer_percent: number;
}

export interface ProjectAiValuationSolarMarketData {
  verified_annual_energy_mwh: number;
  sellable_credits: number;
  price_per_credit_inr: number;
  total_asset_value_inr: number;
}

export interface ProjectAiValuationMethaneScientificData {
  gwp_multiplier: number;
  destruction_efficiency: number;
  methane_density_kg_per_m3: number;
  energy_content_kwh_per_m3: number;
  engine_electrical_efficiency: number;
  grid_emission_factor_tco2_per_mwh: number;
  risk_buffer_percent: number;
  flare_active_confidence: number;
  viirs_score: number | null;
  plume_drop_score: number;
  viirs_current_mean_frp: number | null;
  viirs_bypassed: boolean;
  s5p_current_mean_ch4: number;
  s5p_baseline_mean_ch4: number;
  satellite_raw_response: Record<string, unknown> | null;
}

export interface ProjectAiValuationMethaneMarketData {
  verified_ch4_destroyed_tonnes: number;
  destruction_credits: number;
  electricity_generated_mwh: number;
  grid_displacement_credits: number;
  total_sellable_credits: number;
  price_per_credit_inr: number;
  total_asset_value_inr: number;
}

export interface ProjectAiValuationWindmillScientificData {
  turbine_model_key: string;
  manufacturer: string;
  model: string;
  capacity_mw: number;
  rotor_diameter_m: number;
  optimal_cp: number;
  centroid_latitude: number;
  centroid_longitude: number;
  reading_period_start: string;
  reading_period_end: string;
  reading_period_year: number;
  source_mode: "dual" | "open_meteo_fallback";
  open_meteo_hour_count: number;
  open_meteo_base_url: string | null;
  renewables_ninja_base_url: string | null;
  renewables_ninja_error: string | null;
  renewables_ninja_available: boolean;
  api_diagnostics: Record<string, unknown> | null;
}

export interface ProjectAiValuationWindmillMarketData {
  theoretical_capacity_mwh_open_meteo: number;
  theoretical_capacity_mwh_renewables_ninja: number | null;
  theoretical_capacity_mwh_used: number;
  verified_generation_mwh: number;
  total_carbon_credits: number;
  price_per_credit_inr: number;
  total_asset_value_inr: number;
  grid_emission_factor_tco2_per_mwh: number;
}

export interface ProjectAiValuation {
  status: ProjectAiValuationStatus;
  model_type: ProjectAiValuationModelType | null;
  computed_at: string | null;
  expires_at: string | null;
  input_fingerprint: string | null;
  scientific_data: ProjectAiValuationScientificData | null;
  market_data: ProjectAiValuationMarketData | null;
  solar_scientific_data: ProjectAiValuationSolarScientificData | null;
  solar_market_data: ProjectAiValuationSolarMarketData | null;
  methane_scientific_data: ProjectAiValuationMethaneScientificData | null;
  methane_market_data: ProjectAiValuationMethaneMarketData | null;
  windmill_scientific_data: ProjectAiValuationWindmillScientificData | null;
  windmill_market_data: ProjectAiValuationWindmillMarketData | null;
  reason: string | null;
  error_message: string | null;
}

export interface NormalizedProjectAiValuation {
  status: ProjectAiValuationStatus;
  modelType: ProjectAiValuationModelType | null;
  computedAt: string | null;
  expiresAt: string | null;
  reason: string | null;
  errorMessage: string | null;
  creditsAvailable: number | null;
  pricePerCreditInr: number | null;
  totalAssetValueInr: number | null;
  effectiveSurvivingTreesPerHa: number | null;
  verifiedAnnualEnergyMwh: number | null;
}

export interface ProjectSubmissionMetadata {
  description?: string | null;
  short_description?: string | null;
  street_address?: string | null;
  state?: string | null;
  country?: string | null;
  pin_code?: string | null;
  organization_name?: string | null;
  organization_type?: string | null;
  organization_type_other?: string | null;
  seller_name?: string | null;
  seller_email?: string | null;
  ownership_type?: string | null;
  declaration_carbon_rights?: boolean;
  declaration_document_use?: boolean;
  species?: string[];
  number_of_trees?: string | null;
  planting_year?: string | null;
  plantation_density?: string | null;
  claimed_capacity_mw?: number | string | null;
  panel_technology?: string | null;
  grid_region?: string | null;
  methane_source_type?: string | null;
  methane_destruction_method?: string | null;
  methane_generates_electricity?: "yes" | "no" | null;
  claimed_methane_volume_m3?: number | string | null;
  ch4_concentration?: number | string | null;
  windmill_locations?: Array<{ latitude: number; longitude: number }>;
  windmill_turbine_model?: string | null;
  windmill_hub_height_m?: number | string | null;
  windmill_claimed_net_export_mwh?: number | string | null;
  windmill_power_offtaker_type?: string | null;
  ownership_document_urls?: string[];
  project_photo_urls?: string[];
  photo_gps_data?: Array<{ lat: number | null; lng: number | null }>;
  agreement_voluntary?: boolean;
  agreement_right_to_sell?: boolean;
  agreement_not_sold_elsewhere?: boolean;
  agreement_marketplace?: boolean;
  rejection_reason?: string | null;
  ai_valuation?: ProjectAiValuation | null;
}

export interface ParsedProjectReviewNotes {
  raw: Record<string, unknown>;
  submissionMetadata: ProjectSubmissionMetadata;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value !== "boolean") return null;
  return value;
}

function asStatus(value: unknown): ProjectAiValuationStatus | null {
  if (
    value === "ready" ||
    value === "pending_inputs" ||
    value === "error" ||
    value === "not_applicable"
  ) {
    return value;
  }

  return null;
}

function asModelType(value: unknown): ProjectAiValuationModelType | null {
  if (
    value === "forestry_agri" ||
    value === "solar" ||
    value === "methane" ||
    value === "windmill"
  ) {
    return value;
  }

  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item));
}

function asCoordinateArray(
  value: unknown,
): Array<{ latitude: number; longitude: number }> {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const record = asRecord(item);
      const latitude = asNumber(record.latitude);
      const longitude = asNumber(record.longitude);
      if (latitude === null || longitude === null) return null;
      return { latitude, longitude };
    })
    .filter((item): item is { latitude: number; longitude: number } => Boolean(item));
}

function asScientificData(value: unknown): ProjectAiValuationScientificData | null {
  const record = asRecord(value);
  const woodDensity = asNumber(record.wood_density);
  const biomassExpansionFactor = asNumber(record.biomass_expansion_factor);
  const rootToShootRatio = asNumber(record.root_to_shoot_ratio);
  const carbonFraction = asNumber(record.carbon_fraction);
  const annualVolumeGrowth = asNumber(record.annual_volume_growth_per_tree_m3);
  const theoreticalMaxTrees = asNumber(record.theoretical_max_trees_per_ha);
  const riskBufferPercent = asNumber(record.risk_buffer_percent);
  const leakagePercent = asNumber(record.leakage_percent);
  const premiumMultiplier = asNumber(record.premium_multiplier);

  if (
    woodDensity === null ||
    biomassExpansionFactor === null ||
    rootToShootRatio === null ||
    carbonFraction === null ||
    annualVolumeGrowth === null ||
    theoreticalMaxTrees === null ||
    riskBufferPercent === null ||
    leakagePercent === null ||
    premiumMultiplier === null
  ) {
    return null;
  }

  return {
    wood_density: woodDensity,
    biomass_expansion_factor: biomassExpansionFactor,
    root_to_shoot_ratio: rootToShootRatio,
    carbon_fraction: carbonFraction,
    annual_volume_growth_per_tree_m3: annualVolumeGrowth,
    theoretical_max_trees_per_ha: theoreticalMaxTrees,
    risk_buffer_percent: riskBufferPercent,
    leakage_percent: leakagePercent,
    premium_multiplier: premiumMultiplier,
  };
}

function asMarketData(value: unknown): ProjectAiValuationMarketData | null {
  const record = asRecord(value);
  const effectiveSurvivingTrees = asNumber(record.effective_surviving_trees_per_ha);
  const sellableCredits = asNumber(record.sellable_credits);
  const pricePerCredit = asNumber(record.price_per_credit_inr);
  const totalAssetValue = asNumber(record.total_asset_value_inr);

  if (
    effectiveSurvivingTrees === null ||
    sellableCredits === null ||
    pricePerCredit === null ||
    totalAssetValue === null
  ) {
    return null;
  }

  return {
    effective_surviving_trees_per_ha: effectiveSurvivingTrees,
    sellable_credits: sellableCredits,
    price_per_credit_inr: pricePerCredit,
    total_asset_value_inr: totalAssetValue,
  };
}

function asSolarScientificData(
  value: unknown,
): ProjectAiValuationSolarScientificData | null {
  const record = asRecord(value);
  const panelEfficiency = asNumber(record.panel_efficiency);
  const performanceRatio = asNumber(record.performance_ratio);
  const annualDegradationRate = asNumber(record.annual_degradation_rate);
  const gridEmissionFactor = asNumber(record.grid_emission_factor_tco2_per_mwh);
  const riskBufferPercent = asNumber(record.risk_buffer_percent);

  if (
    panelEfficiency === null ||
    performanceRatio === null ||
    annualDegradationRate === null ||
    gridEmissionFactor === null ||
    riskBufferPercent === null
  ) {
    return null;
  }

  return {
    panel_efficiency: panelEfficiency,
    performance_ratio: performanceRatio,
    annual_degradation_rate: annualDegradationRate,
    grid_emission_factor_tco2_per_mwh: gridEmissionFactor,
    risk_buffer_percent: riskBufferPercent,
  };
}

function asSolarMarketData(value: unknown): ProjectAiValuationSolarMarketData | null {
  const record = asRecord(value);
  const annualEnergy = asNumber(record.verified_annual_energy_mwh);
  const sellableCredits = asNumber(record.sellable_credits);
  const pricePerCredit = asNumber(record.price_per_credit_inr);
  const totalAssetValue = asNumber(record.total_asset_value_inr);

  if (
    annualEnergy === null ||
    sellableCredits === null ||
    pricePerCredit === null ||
    totalAssetValue === null
  ) {
    return null;
  }

  return {
    verified_annual_energy_mwh: annualEnergy,
    sellable_credits: sellableCredits,
    price_per_credit_inr: pricePerCredit,
    total_asset_value_inr: totalAssetValue,
  };
}

function asMethaneScientificData(
  value: unknown,
): ProjectAiValuationMethaneScientificData | null {
  const record = asRecord(value);
  const gwpMultiplier = asNumber(record.gwp_multiplier);
  const destructionEfficiency = asNumber(record.destruction_efficiency);
  const methaneDensity = asNumber(record.methane_density_kg_per_m3);
  const energyContent = asNumber(record.energy_content_kwh_per_m3);
  const engineElectricalEfficiency = asNumber(record.engine_electrical_efficiency);
  const gridEmissionFactor = asNumber(record.grid_emission_factor_tco2_per_mwh);
  const riskBufferPercent = asNumber(record.risk_buffer_percent);
  const flareActiveConfidence = asNumber(record.flare_active_confidence);
  const viirsScore =
    record.viirs_score === null ? null : asNumber(record.viirs_score);
  const plumeDropScore = asNumber(record.plume_drop_score);
  const viirsCurrentMeanFrp =
    record.viirs_current_mean_frp === null
      ? null
      : asNumber(record.viirs_current_mean_frp);
  const viirsBypassed = asBoolean(record.viirs_bypassed) ?? false;
  const s5pCurrentMeanCh4 = asNumber(record.s5p_current_mean_ch4);
  const s5pBaselineMeanCh4 = asNumber(record.s5p_baseline_mean_ch4);
  const satelliteRawResponse =
    record.satellite_raw_response !== null &&
    typeof record.satellite_raw_response === "object"
      ? (record.satellite_raw_response as Record<string, unknown>)
      : null;

  if (
    gwpMultiplier === null ||
    destructionEfficiency === null ||
    methaneDensity === null ||
    energyContent === null ||
    engineElectricalEfficiency === null ||
    gridEmissionFactor === null ||
    riskBufferPercent === null ||
    flareActiveConfidence === null ||
    plumeDropScore === null ||
    s5pCurrentMeanCh4 === null ||
    s5pBaselineMeanCh4 === null
  ) {
    return null;
  }

  return {
    gwp_multiplier: gwpMultiplier,
    destruction_efficiency: destructionEfficiency,
    methane_density_kg_per_m3: methaneDensity,
    energy_content_kwh_per_m3: energyContent,
    engine_electrical_efficiency: engineElectricalEfficiency,
    grid_emission_factor_tco2_per_mwh: gridEmissionFactor,
    risk_buffer_percent: riskBufferPercent,
    flare_active_confidence: flareActiveConfidence,
    viirs_score: viirsScore,
    plume_drop_score: plumeDropScore,
    viirs_current_mean_frp: viirsCurrentMeanFrp,
    viirs_bypassed: viirsBypassed,
    s5p_current_mean_ch4: s5pCurrentMeanCh4,
    s5p_baseline_mean_ch4: s5pBaselineMeanCh4,
    satellite_raw_response: satelliteRawResponse,
  };
}

function asMethaneMarketData(
  value: unknown,
): ProjectAiValuationMethaneMarketData | null {
  const record = asRecord(value);
  const verifiedCh4DestroyedTonnes = asNumber(record.verified_ch4_destroyed_tonnes);
  const destructionCredits = asNumber(record.destruction_credits);
  const electricityGeneratedMwh = asNumber(record.electricity_generated_mwh);
  const gridDisplacementCredits = asNumber(record.grid_displacement_credits);
  const totalSellableCredits = asNumber(record.total_sellable_credits);
  const pricePerCredit = asNumber(record.price_per_credit_inr);
  const totalAssetValue = asNumber(record.total_asset_value_inr);

  if (
    verifiedCh4DestroyedTonnes === null ||
    destructionCredits === null ||
    electricityGeneratedMwh === null ||
    gridDisplacementCredits === null ||
    totalSellableCredits === null ||
    pricePerCredit === null ||
    totalAssetValue === null
  ) {
    return null;
  }

  return {
    verified_ch4_destroyed_tonnes: verifiedCh4DestroyedTonnes,
    destruction_credits: destructionCredits,
    electricity_generated_mwh: electricityGeneratedMwh,
    grid_displacement_credits: gridDisplacementCredits,
    total_sellable_credits: totalSellableCredits,
    price_per_credit_inr: pricePerCredit,
    total_asset_value_inr: totalAssetValue,
  };
}

function asWindmillScientificData(
  value: unknown,
): ProjectAiValuationWindmillScientificData | null {
  const record = asRecord(value);
  const turbineModelKey = asString(record.turbine_model_key);
  const manufacturer = asString(record.manufacturer);
  const model = asString(record.model);
  const capacityMw = asNumber(record.capacity_mw);
  const rotorDiameterM = asNumber(record.rotor_diameter_m);
  const optimalCp = asNumber(record.optimal_cp);
  const centroidLatitude = asNumber(record.centroid_latitude);
  const centroidLongitude = asNumber(record.centroid_longitude);
  const readingPeriodStart = asString(record.reading_period_start);
  const readingPeriodEnd = asString(record.reading_period_end);
  const readingPeriodYear = asNumber(record.reading_period_year);
  const sourceMode =
    record.source_mode === "dual" || record.source_mode === "open_meteo_fallback"
      ? record.source_mode
      : null;
  const openMeteoHourCount = asNumber(record.open_meteo_hour_count);
  const openMeteoBaseUrl = asString(record.open_meteo_base_url);
  const renewablesNinjaBaseUrl = asString(record.renewables_ninja_base_url);
  const renewablesNinjaError =
    record.renewables_ninja_error === null
      ? null
      : asString(record.renewables_ninja_error);
  const renewablesNinjaAvailable = asBoolean(record.renewables_ninja_available);
  const apiDiagnostics =
    record.api_diagnostics !== null && typeof record.api_diagnostics === "object"
      ? (record.api_diagnostics as Record<string, unknown>)
      : null;

  if (
    turbineModelKey === null ||
    manufacturer === null ||
    model === null ||
    capacityMw === null ||
    rotorDiameterM === null ||
    optimalCp === null ||
    centroidLatitude === null ||
    centroidLongitude === null ||
    readingPeriodStart === null ||
    readingPeriodEnd === null ||
    readingPeriodYear === null ||
    sourceMode === null ||
    openMeteoHourCount === null ||
    renewablesNinjaAvailable === null
  ) {
    return null;
  }

  return {
    turbine_model_key: turbineModelKey,
    manufacturer,
    model,
    capacity_mw: capacityMw,
    rotor_diameter_m: rotorDiameterM,
    optimal_cp: optimalCp,
    centroid_latitude: centroidLatitude,
    centroid_longitude: centroidLongitude,
    reading_period_start: readingPeriodStart,
    reading_period_end: readingPeriodEnd,
    reading_period_year: readingPeriodYear,
    source_mode: sourceMode,
    open_meteo_hour_count: openMeteoHourCount,
    open_meteo_base_url: openMeteoBaseUrl,
    renewables_ninja_base_url: renewablesNinjaBaseUrl,
    renewables_ninja_error: renewablesNinjaError,
    renewables_ninja_available: renewablesNinjaAvailable,
    api_diagnostics: apiDiagnostics,
  };
}

function asWindmillMarketData(
  value: unknown,
): ProjectAiValuationWindmillMarketData | null {
  const record = asRecord(value);
  const theoreticalCapacityOpenMeteo = asNumber(
    record.theoretical_capacity_mwh_open_meteo,
  );
  const theoreticalCapacityNinja =
    record.theoretical_capacity_mwh_renewables_ninja === null
      ? null
      : asNumber(record.theoretical_capacity_mwh_renewables_ninja);
  const theoreticalCapacityUsed = asNumber(record.theoretical_capacity_mwh_used);
  const verifiedGenerationMwh = asNumber(record.verified_generation_mwh);
  const totalCarbonCredits = asNumber(record.total_carbon_credits);
  const pricePerCredit = asNumber(record.price_per_credit_inr);
  const totalAssetValue = asNumber(record.total_asset_value_inr);
  const gridEmissionFactor = asNumber(record.grid_emission_factor_tco2_per_mwh);

  if (
    theoreticalCapacityOpenMeteo === null ||
    theoreticalCapacityUsed === null ||
    verifiedGenerationMwh === null ||
    totalCarbonCredits === null ||
    pricePerCredit === null ||
    totalAssetValue === null ||
    gridEmissionFactor === null
  ) {
    return null;
  }

  return {
    theoretical_capacity_mwh_open_meteo: theoreticalCapacityOpenMeteo,
    theoretical_capacity_mwh_renewables_ninja: theoreticalCapacityNinja,
    theoretical_capacity_mwh_used: theoreticalCapacityUsed,
    verified_generation_mwh: verifiedGenerationMwh,
    total_carbon_credits: totalCarbonCredits,
    price_per_credit_inr: pricePerCredit,
    total_asset_value_inr: totalAssetValue,
    grid_emission_factor_tco2_per_mwh: gridEmissionFactor,
  };
}

function asAiValuation(value: unknown): ProjectAiValuation | null {
  const record = asRecord(value);
  const status = asStatus(record.status);
  if (!status) {
    return null;
  }

  const forestryScientificData = asScientificData(record.scientific_data);
  const forestryMarketData = asMarketData(record.market_data);
  const solarScientificData = asSolarScientificData(record.solar_scientific_data);
  const solarMarketData = asSolarMarketData(record.solar_market_data);
  const methaneScientificData = asMethaneScientificData(record.methane_scientific_data);
  const methaneMarketData = asMethaneMarketData(record.methane_market_data);
  const windmillScientificData = asWindmillScientificData(
    record.windmill_scientific_data,
  );
  const windmillMarketData = asWindmillMarketData(record.windmill_market_data);
  const explicitModelType = asModelType(record.model_type);
  const inferredModelType =
    explicitModelType ??
    (windmillScientificData || windmillMarketData
      ? "windmill"
      : methaneScientificData || methaneMarketData
      ? "methane"
      : solarScientificData || solarMarketData
      ? "solar"
      : forestryScientificData || forestryMarketData
        ? "forestry_agri"
        : null);

  return {
    status,
    model_type: inferredModelType,
    computed_at: asString(record.computed_at),
    expires_at: asString(record.expires_at),
    input_fingerprint: asString(record.input_fingerprint),
    scientific_data: forestryScientificData,
    market_data: forestryMarketData,
    solar_scientific_data: solarScientificData,
    solar_market_data: solarMarketData,
    methane_scientific_data: methaneScientificData,
    methane_market_data: methaneMarketData,
    windmill_scientific_data: windmillScientificData,
    windmill_market_data: windmillMarketData,
    reason: asString(record.reason),
    error_message: asString(record.error_message),
  };
}

export function getNormalizedProjectAiValuation(
  valuation: ProjectAiValuation | null | undefined,
): NormalizedProjectAiValuation {
  const modelType =
    valuation?.model_type ??
    (valuation?.windmill_market_data || valuation?.windmill_scientific_data
      ? "windmill"
      : valuation?.methane_market_data || valuation?.methane_scientific_data
      ? "methane"
      : valuation?.solar_market_data || valuation?.solar_scientific_data
      ? "solar"
      : valuation?.market_data || valuation?.scientific_data
        ? "forestry_agri"
        : null);

  const forestryReadyMarket =
    valuation?.status === "ready" && modelType === "forestry_agri"
      ? valuation.market_data
      : null;
  const solarReadyMarket =
    valuation?.status === "ready" && modelType === "solar"
      ? valuation.solar_market_data
      : null;
  const methaneReadyMarket =
    valuation?.status === "ready" && modelType === "methane"
      ? valuation.methane_market_data
      : null;
  const windmillReadyMarket =
    valuation?.status === "ready" && modelType === "windmill"
      ? valuation.windmill_market_data
      : null;

  return {
    status: valuation?.status ?? "not_applicable",
    modelType,
    computedAt: valuation?.computed_at ?? null,
    expiresAt: valuation?.expires_at ?? null,
    reason: valuation?.reason ?? null,
    errorMessage: valuation?.error_message ?? null,
    creditsAvailable:
      windmillReadyMarket?.total_carbon_credits ??
      methaneReadyMarket?.total_sellable_credits ??
      solarReadyMarket?.sellable_credits ??
      forestryReadyMarket?.sellable_credits ??
      null,
    pricePerCreditInr:
      windmillReadyMarket?.price_per_credit_inr ??
      methaneReadyMarket?.price_per_credit_inr ??
      solarReadyMarket?.price_per_credit_inr ??
      forestryReadyMarket?.price_per_credit_inr ??
      null,
    totalAssetValueInr:
      windmillReadyMarket?.total_asset_value_inr ??
      methaneReadyMarket?.total_asset_value_inr ??
      solarReadyMarket?.total_asset_value_inr ??
      forestryReadyMarket?.total_asset_value_inr ??
      null,
    effectiveSurvivingTreesPerHa: forestryReadyMarket?.effective_surviving_trees_per_ha ?? null,
    verifiedAnnualEnergyMwh:
      solarReadyMarket?.verified_annual_energy_mwh ??
      windmillReadyMarket?.verified_generation_mwh ??
      null,
  };
}

export function parseProjectReviewNotes(rawReviewNotes: string | null): ParsedProjectReviewNotes {
  if (!rawReviewNotes) {
    return {
      raw: {},
      submissionMetadata: {},
    };
  }

  try {
    const parsed = JSON.parse(rawReviewNotes) as unknown;
    const parsedRecord = asRecord(parsed);
    const submissionMetadata = asRecord(parsedRecord.submission_metadata);

    return {
      raw: parsedRecord,
      submissionMetadata: {
        ...submissionMetadata,
        ownership_document_urls: asStringArray(submissionMetadata.ownership_document_urls),
        project_photo_urls: asStringArray(submissionMetadata.project_photo_urls),
        species: asStringArray(submissionMetadata.species),
        windmill_locations: asCoordinateArray(submissionMetadata.windmill_locations),
        ai_valuation: asAiValuation(submissionMetadata.ai_valuation),
      },
    };
  } catch {
    return {
      raw: {},
      submissionMetadata: {},
    };
  }
}

export function getSubmissionDescription(metadata: ProjectSubmissionMetadata): string {
  return metadata.description?.trim() || metadata.short_description?.trim() || "";
}

export function serializeProjectReviewNotes(
  existingRaw: Record<string, unknown>,
  submissionMetadata: ProjectSubmissionMetadata,
): string {
  return JSON.stringify({
    ...existingRaw,
    submission_metadata: submissionMetadata,
  });
}
