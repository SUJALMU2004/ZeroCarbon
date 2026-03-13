import "server-only";

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { calculateForestryConfidence } from "@/lib/gee/confidence-calculator";
import { runMethaneSatelliteConfidenceAnalysis } from "@/lib/gee/methane-analysis";
import { runForestryNdviAnalysis } from "@/lib/gee/ndvi-analysis";
import { runSolarIrradianceAnalysis } from "@/lib/gee/solar-analysis";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import {
  type ProjectAiValuationWindmillMarketData,
  type ProjectAiValuationWindmillScientificData,
  type ProjectAiValuationMethaneMarketData,
  type ProjectAiValuationMethaneScientificData,
  parseProjectReviewNotes,
  serializeProjectReviewNotes,
  type ProjectAiValuation,
  type ProjectAiValuationMarketData,
  type ProjectAiValuationModelType,
  type ProjectAiValuationScientificData,
  type ProjectAiValuationSolarMarketData,
  type ProjectAiValuationSolarScientificData,
  type ProjectSubmissionMetadata,
} from "@/lib/utils/projectMetadata";
import {
  computeCarbonValuation,
  normalizePercentFraction,
  type CarbonScientificConstants,
} from "@/lib/valuation/carbonValuationMath";
import {
  computeSolarCarbonValuation,
  type SolarScientificConstants,
} from "@/lib/valuation/solarValuationMath";
import {
  computeMethaneCarbonValuation,
  normalizeCh4Concentration,
  type MethaneScientificConstants,
} from "@/lib/valuation/methaneValuationMath";
import {
  calculateWindFarmCentroid,
  computeWindmillCarbonValuation,
  getLatestFullYearReadingPeriod,
  getWindmillGridEmissionFactor,
  getWindmillLocationsSignature,
  integrateWindEnergyFromHourlySpeeds,
  isWindmillTurbineModel,
  resolveWindmillTurbineSpec,
  WINDMILL_BASE_PRICE_INR,
  type WindmillLocation,
} from "@/lib/valuation/windmillValuationMath";

const SNAPSHOT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FORESTRY_PROJECT_TYPES = new Set(["forestry", "agricultural"]);
const SOLAR_PROJECT_TYPE = "solar";
const METHANE_PROJECT_TYPE = "methane";
const WINDMILL_PROJECT_TYPE = "windmill";

interface ResolveProjectAiValuationInput {
  projectId: string;
  status: string | null;
  projectType: string | null;
  latitude: number | null;
  longitude: number | null;
  polygonGeojson: object | null;
  landAreaHectares: number | null;
  satelliteNdviCurrent: number | null;
  satelliteStatus: string | null;
  satelliteErrorMessage: string | null;
  satelliteLastAttemptedAt: string | null;
  projectStartDate: string | null;
  reviewNotes: string | null;
}

interface ForestryValuationInputs {
  species: string | null;
  region: string;
  plantingYear: number | null;
  ageYears: number | null;
  ndvi: number | null;
  areaHa: number | null;
}

interface SolarValuationInputs {
  panelTechnology: string | null;
  gridRegion: string | null;
  commissioningYear: number | null;
  ageYears: number | null;
  claimedCapacityMw: number | null;
  polygonGeojson: object | null;
}

interface MethaneValuationInputs {
  sourceType: string | null;
  destructionMethod:
    | "open_flare"
    | "enclosed_high_temperature_flare"
    | "internal_combustion_engine"
    | "boiler"
    | "bio_cng_vehicle_fuel"
    | "pipeline_injection"
    | null;
  generatesElectricity: "yes" | "no" | null;
  claimedVolumeM3: number | null;
  ch4Concentration: number | null;
  gridRegion: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface WindmillValuationInputs {
  locations: WindmillLocation[];
  turbineModel: string | null;
  hubHeightM: number | null;
  claimedNetExportMwh: number | null;
  state: string | null;
}

let forestryGeminiModel:
  | ReturnType<GoogleGenerativeAI["getGenerativeModel"]>
  | null = null;

let solarGeminiModel:
  | ReturnType<GoogleGenerativeAI["getGenerativeModel"]>
  | null = null;

let methaneGeminiModel:
  | ReturnType<GoogleGenerativeAI["getGenerativeModel"]>
  | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY.");
  }

  return new GoogleGenerativeAI(apiKey);
}

function getForestryGeminiModel() {
  if (forestryGeminiModel) {
    return forestryGeminiModel;
  }

  const client = getGeminiClient();
  forestryGeminiModel = client.getGenerativeModel({
    model: "gemini-3-flash-preview",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          wood_density: { type: SchemaType.NUMBER },
          biomass_expansion_factor: { type: SchemaType.NUMBER },
          root_to_shoot_ratio: { type: SchemaType.NUMBER },
          carbon_fraction: { type: SchemaType.NUMBER },
          annual_volume_growth_per_tree_m3: { type: SchemaType.NUMBER },
          theoretical_max_trees_per_ha: { type: SchemaType.NUMBER },
          risk_buffer_percent: { type: SchemaType.NUMBER },
          leakage_percent: { type: SchemaType.NUMBER },
          premium_multiplier: { type: SchemaType.NUMBER },
        },
        required: [
          "wood_density",
          "biomass_expansion_factor",
          "root_to_shoot_ratio",
          "carbon_fraction",
          "annual_volume_growth_per_tree_m3",
          "theoretical_max_trees_per_ha",
          "risk_buffer_percent",
          "leakage_percent",
          "premium_multiplier",
        ],
      },
    },
  });

  return forestryGeminiModel;
}

function getSolarGeminiModel() {
  if (solarGeminiModel) {
    return solarGeminiModel;
  }

  const client = getGeminiClient();
  solarGeminiModel = client.getGenerativeModel({
    model: "gemini-3-flash-preview",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          panel_efficiency: { type: SchemaType.NUMBER },
          performance_ratio: { type: SchemaType.NUMBER },
          annual_degradation_rate: { type: SchemaType.NUMBER },
          grid_emission_factor_tco2_per_mwh: { type: SchemaType.NUMBER },
          risk_buffer_percent: { type: SchemaType.NUMBER },
        },
        required: [
          "panel_efficiency",
          "performance_ratio",
          "annual_degradation_rate",
          "grid_emission_factor_tco2_per_mwh",
          "risk_buffer_percent",
        ],
      },
    },
  });

  return solarGeminiModel;
}

function getMethaneGeminiModel() {
  if (methaneGeminiModel) {
    return methaneGeminiModel;
  }

  const client = getGeminiClient();
  methaneGeminiModel = client.getGenerativeModel({
    model: "gemini-3-flash-preview",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          gwp_multiplier: { type: SchemaType.NUMBER },
          destruction_efficiency: { type: SchemaType.NUMBER },
          methane_density_kg_per_m3: { type: SchemaType.NUMBER },
          energy_content_kwh_per_m3: { type: SchemaType.NUMBER },
          engine_electrical_efficiency: { type: SchemaType.NUMBER },
          grid_emission_factor_tco2_per_mwh: { type: SchemaType.NUMBER },
          risk_buffer_percent: { type: SchemaType.NUMBER },
        },
        required: [
          "gwp_multiplier",
          "destruction_efficiency",
          "methane_density_kg_per_m3",
          "energy_content_kwh_per_m3",
          "engine_electrical_efficiency",
          "grid_emission_factor_tco2_per_mwh",
          "risk_buffer_percent",
        ],
      },
    },
  });

  return methaneGeminiModel;
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

function getWindmillSnapshotTtlMs(): number {
  const days = Math.max(
    1,
    Math.floor(getNumberEnv("WINDMILL_VALUATION_TTL_DAYS", 7)),
  );
  return days * 24 * 60 * 60 * 1000;
}

function getWindmillCreditPriceInr(): number {
  return Math.max(
    0,
    Math.floor(getNumberEnv("WINDMILL_CREDIT_PRICE_INR", WINDMILL_BASE_PRICE_INR)),
  );
}

function getOpenMeteoArchiveBaseUrl(): string {
  return (
    process.env.OPEN_METEO_ARCHIVE_BASE_URL?.trim() ||
    "https://archive-api.open-meteo.com/v1/archive"
  ).replace(/\/+$/, "");
}

function getRenewablesNinjaBaseUrl(): string {
  return (
    process.env.RENEWABLES_NINJA_BASE_URL?.trim() ||
    "https://www.renewables.ninja/api"
  ).replace(/\/+$/, "");
}

function getRenewablesNinjaApiKey(): string | null {
  const key = process.env.RENEWABLES_NINJA_API_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

function getWindmillGefDefault(): number {
  const configured = getNumberEnv("WINDMILL_GEF_DEFAULT", 0.76);
  return Number.isFinite(configured) && configured > 0 ? configured : 0.76;
}

function getExpiryIso(nowIso: string, ttlMs: number = SNAPSHOT_TTL_MS): string {
  const base = toDate(nowIso) ?? new Date();
  return new Date(base.getTime() + ttlMs).toISOString();
}

function buildRegion(metadata: ProjectSubmissionMetadata): string {
  const state = metadata.state?.trim();
  const country = metadata.country?.trim();

  if (state && country) {
    return `${state}, ${country}`;
  }
  if (country) {
    return country;
  }
  if (state) {
    return state;
  }
  return "Unknown region";
}

function parsePlantingYear(
  metadata: ProjectSubmissionMetadata,
  projectStartDate: string | null,
): number | null {
  const nowYear = new Date().getFullYear();
  const metadataYear = Number.parseInt(metadata.planting_year ?? "", 10);
  if (
    Number.isFinite(metadataYear) &&
    metadataYear >= 1900 &&
    metadataYear <= nowYear
  ) {
    return metadataYear;
  }

  const parsedStartDate = toDate(projectStartDate);
  if (!parsedStartDate) {
    return null;
  }

  const startYear = parsedStartDate.getUTCFullYear();
  if (startYear < 1900 || startYear > nowYear) {
    return null;
  }

  return startYear;
}

function parseCommissioningYear(projectStartDate: string | null): number | null {
  const parsedStartDate = toDate(projectStartDate);
  if (!parsedStartDate) {
    return null;
  }

  const startYear = parsedStartDate.getUTCFullYear();
  const nowYear = new Date().getFullYear();
  if (startYear < 1900 || startYear > nowYear) {
    return null;
  }

  return startYear;
}

function parseClaimedCapacityMw(
  metadata: ProjectSubmissionMetadata,
): number | null {
  if (typeof metadata.claimed_capacity_mw === "number") {
    return Number.isFinite(metadata.claimed_capacity_mw)
      ? metadata.claimed_capacity_mw
      : null;
  }

  if (typeof metadata.claimed_capacity_mw === "string") {
    const parsed = Number(metadata.claimed_capacity_mw.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseClaimedMethaneVolumeM3(
  metadata: ProjectSubmissionMetadata,
): number | null {
  if (typeof metadata.claimed_methane_volume_m3 === "number") {
    return Number.isFinite(metadata.claimed_methane_volume_m3)
      ? metadata.claimed_methane_volume_m3
      : null;
  }

  if (typeof metadata.claimed_methane_volume_m3 === "string") {
    const parsed = Number(metadata.claimed_methane_volume_m3.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseCh4Concentration(
  metadata: ProjectSubmissionMetadata,
): number | null {
  if (typeof metadata.ch4_concentration === "number") {
    return Number.isFinite(metadata.ch4_concentration)
      ? normalizeCh4Concentration(metadata.ch4_concentration)
      : null;
  }

  if (typeof metadata.ch4_concentration === "string") {
    const parsed = Number(metadata.ch4_concentration.trim());
    return Number.isFinite(parsed) ? normalizeCh4Concentration(parsed) : null;
  }

  return null;
}

function parseWindmillHubHeightM(
  metadata: ProjectSubmissionMetadata,
): number | null {
  if (typeof metadata.windmill_hub_height_m === "number") {
    return Number.isFinite(metadata.windmill_hub_height_m)
      ? metadata.windmill_hub_height_m
      : null;
  }

  if (typeof metadata.windmill_hub_height_m === "string") {
    const parsed = Number(metadata.windmill_hub_height_m.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseWindmillClaimedNetExportMwh(
  metadata: ProjectSubmissionMetadata,
): number | null {
  if (typeof metadata.windmill_claimed_net_export_mwh === "number") {
    return Number.isFinite(metadata.windmill_claimed_net_export_mwh)
      ? metadata.windmill_claimed_net_export_mwh
      : null;
  }

  if (typeof metadata.windmill_claimed_net_export_mwh === "string") {
    const parsed = Number(metadata.windmill_claimed_net_export_mwh.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseWindmillLocations(
  metadata: ProjectSubmissionMetadata,
): WindmillLocation[] {
  if (!Array.isArray(metadata.windmill_locations)) {
    return [];
  }

  return metadata.windmill_locations.filter(
    (location): location is WindmillLocation =>
      Number.isFinite(location.latitude) && Number.isFinite(location.longitude),
  );
}

function normalizePanelTechnology(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replaceAll("-", "_");
  return normalized.length > 0 ? normalized : null;
}

function deriveForestryInputs(
  metadata: ProjectSubmissionMetadata,
  projectStartDate: string | null,
  landAreaHectares: number | null,
  satelliteNdviCurrent: number | null,
): ForestryValuationInputs {
  const primarySpecies = metadata.species?.[0]?.trim() ?? null;
  const plantingYear = parsePlantingYear(metadata, projectStartDate);
  const nowYear = new Date().getFullYear();

  return {
    species: primarySpecies && primarySpecies.length > 0 ? primarySpecies : null,
    region: buildRegion(metadata),
    plantingYear,
    ageYears:
      plantingYear !== null ? Math.max(nowYear - plantingYear, 0) : null,
    ndvi: toFiniteNumber(satelliteNdviCurrent),
    areaHa: toFiniteNumber(landAreaHectares),
  };
}

function deriveSolarInputs(
  metadata: ProjectSubmissionMetadata,
  projectStartDate: string | null,
  polygonGeojson: object | null,
): SolarValuationInputs {
  const commissioningYear = parseCommissioningYear(projectStartDate);
  const nowYear = new Date().getFullYear();

  return {
    panelTechnology: normalizePanelTechnology(metadata.panel_technology),
    gridRegion: metadata.grid_region?.trim() || null,
    commissioningYear,
    ageYears:
      commissioningYear !== null ? Math.max(nowYear - commissioningYear, 0) : null,
    claimedCapacityMw: parseClaimedCapacityMw(metadata),
    polygonGeojson,
  };
}

function deriveMethaneInputs(
  metadata: ProjectSubmissionMetadata,
  latitude: number | null,
  longitude: number | null,
): MethaneValuationInputs {
  const sourceType = metadata.methane_source_type?.trim() || null;
  const destructionMethodRaw = metadata.methane_destruction_method?.trim() || null;
  const destructionMethod =
    destructionMethodRaw === "open_flare" ||
    destructionMethodRaw === "enclosed_high_temperature_flare" ||
    destructionMethodRaw === "internal_combustion_engine" ||
    destructionMethodRaw === "boiler" ||
    destructionMethodRaw === "bio_cng_vehicle_fuel" ||
    destructionMethodRaw === "pipeline_injection"
      ? destructionMethodRaw
      : null;
  const generatesElectricity = metadata.methane_generates_electricity ?? null;
  const gridRegion = metadata.state?.trim() || null;

  return {
    sourceType,
    destructionMethod,
    generatesElectricity:
      generatesElectricity === "yes" || generatesElectricity === "no"
        ? generatesElectricity
        : null,
    claimedVolumeM3: parseClaimedMethaneVolumeM3(metadata),
    ch4Concentration: parseCh4Concentration(metadata),
    gridRegion,
    latitude,
    longitude,
  };
}

function deriveWindmillInputs(
  metadata: ProjectSubmissionMetadata,
): WindmillValuationInputs {
  return {
    locations: parseWindmillLocations(metadata),
    turbineModel: metadata.windmill_turbine_model?.trim() || null,
    hubHeightM: parseWindmillHubHeightM(metadata),
    claimedNetExportMwh: parseWindmillClaimedNetExportMwh(metadata),
    state: metadata.state?.trim() || null,
  };
}

function buildForestryFingerprint(params: {
  status: string | null;
  projectType: string | null;
  species: string | null;
  plantingYear: number | null;
  areaHa: number | null;
  ndvi: number | null;
  region: string;
}): string {
  return JSON.stringify({
    v: 2,
    modelType: "forestry_agri",
    status: params.status ?? "unknown",
    projectType: params.projectType ?? "unknown",
    species: params.species?.toLowerCase() ?? null,
    plantingYear: params.plantingYear,
    areaHa: params.areaHa !== null ? Number(params.areaHa.toFixed(4)) : null,
    ndvi: params.ndvi !== null ? Number(params.ndvi.toFixed(4)) : null,
    region: params.region,
  });
}

function getPolygonSignature(polygonGeojson: object | null): string | null {
  if (!polygonGeojson || typeof polygonGeojson !== "object") {
    return null;
  }

  const feature = polygonGeojson as {
    geometry?: {
      type?: string;
      coordinates?: unknown;
    };
  };

  if (feature.geometry?.type !== "Polygon") {
    return null;
  }

  const coordinates = feature.geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    return null;
  }

  const firstRing = coordinates[0];
  if (!Array.isArray(firstRing) || firstRing.length < 3) {
    return null;
  }

  const normalizedRing = firstRing
    .map((point) => {
      if (!Array.isArray(point) || point.length < 2) return null;
      const lng = Number(point[0]);
      const lat = Number(point[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return [Number(lng.toFixed(6)), Number(lat.toFixed(6))];
    })
    .filter((point): point is [number, number] => Boolean(point));

  if (normalizedRing.length < 3) {
    return null;
  }

  return JSON.stringify(normalizedRing);
}

function buildSolarFingerprint(params: {
  status: string | null;
  projectType: string | null;
  panelTechnology: string | null;
  gridRegion: string | null;
  commissioningYear: number | null;
  claimedCapacityMw: number | null;
  polygonSignature: string | null;
}): string {
  return JSON.stringify({
    v: 2,
    modelType: "solar",
    status: params.status ?? "unknown",
    projectType: params.projectType ?? "unknown",
    panelTechnology: params.panelTechnology,
    gridRegion: params.gridRegion,
    commissioningYear: params.commissioningYear,
    claimedCapacityMw:
      params.claimedCapacityMw !== null
        ? Number(params.claimedCapacityMw.toFixed(4))
        : null,
    polygonSignature: params.polygonSignature,
  });
}

function buildMethaneFingerprint(params: {
  status: string | null;
  projectType: string | null;
  sourceType: string | null;
  destructionMethod: string | null;
  generatesElectricity: "yes" | "no" | null;
  claimedVolumeM3: number | null;
  ch4Concentration: number | null;
  gridRegion: string | null;
  latitude: number | null;
  longitude: number | null;
}): string {
  return JSON.stringify({
    v: 2,
    modelType: "methane",
    status: params.status ?? "unknown",
    projectType: params.projectType ?? "unknown",
    sourceType: params.sourceType,
    destructionMethod: params.destructionMethod,
    generatesElectricity: params.generatesElectricity,
    claimedVolumeM3:
      params.claimedVolumeM3 !== null
        ? Number(params.claimedVolumeM3.toFixed(4))
        : null,
    ch4Concentration:
      params.ch4Concentration !== null
        ? Number(params.ch4Concentration.toFixed(6))
        : null,
    gridRegion: params.gridRegion,
    latitude:
      params.latitude !== null ? Number(params.latitude.toFixed(6)) : null,
    longitude:
      params.longitude !== null ? Number(params.longitude.toFixed(6)) : null,
  });
}

function buildWindmillFingerprint(params: {
  status: string | null;
  projectType: string | null;
  locationsSignature: string | null;
  turbineModel: string | null;
  hubHeightM: number | null;
  claimedNetExportMwh: number | null;
  state: string | null;
  readingPeriodStart: string;
  readingPeriodEnd: string;
}): string {
  return JSON.stringify({
    v: 2,
    modelType: "windmill",
    status: params.status ?? "unknown",
    projectType: params.projectType ?? "unknown",
    locationsSignature: params.locationsSignature,
    turbineModel: params.turbineModel,
    hubHeightM:
      params.hubHeightM !== null ? Number(params.hubHeightM.toFixed(3)) : null,
    claimedNetExportMwh:
      params.claimedNetExportMwh !== null
        ? Number(params.claimedNetExportMwh.toFixed(3))
        : null,
    state: params.state,
    readingPeriodStart: params.readingPeriodStart,
    readingPeriodEnd: params.readingPeriodEnd,
  });
}

function parseTimestamp(value: string | null): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function isSnapshotFresh(
  snapshot: ProjectAiValuation | null | undefined,
  fingerprint: string,
): boolean {
  if (!snapshot || snapshot.input_fingerprint !== fingerprint) {
    return false;
  }

  const expiry = parseTimestamp(snapshot.expires_at);
  if (!expiry) {
    return false;
  }

  return expiry > Date.now();
}

function createSnapshot(params: {
  status: ProjectAiValuation["status"];
  modelType: ProjectAiValuationModelType | null;
  nowIso: string;
  fingerprint: string;
  ttlMs?: number;
  scientificData?: ProjectAiValuationScientificData | null;
  marketData?: ProjectAiValuationMarketData | null;
  solarScientificData?: ProjectAiValuationSolarScientificData | null;
  solarMarketData?: ProjectAiValuationSolarMarketData | null;
  methaneScientificData?: ProjectAiValuationMethaneScientificData | null;
  methaneMarketData?: ProjectAiValuationMethaneMarketData | null;
  windmillScientificData?: ProjectAiValuationWindmillScientificData | null;
  windmillMarketData?: ProjectAiValuationWindmillMarketData | null;
  reason?: string | null;
  errorMessage?: string | null;
}): ProjectAiValuation {
  return {
    status: params.status,
    model_type: params.modelType,
    computed_at: params.nowIso,
    expires_at: getExpiryIso(params.nowIso, params.ttlMs),
    input_fingerprint: params.fingerprint,
    scientific_data: params.scientificData ?? null,
    market_data: params.marketData ?? null,
    solar_scientific_data: params.solarScientificData ?? null,
    solar_market_data: params.solarMarketData ?? null,
    methane_scientific_data: params.methaneScientificData ?? null,
    methane_market_data: params.methaneMarketData ?? null,
    windmill_scientific_data: params.windmillScientificData ?? null,
    windmill_market_data: params.windmillMarketData ?? null,
    reason: params.reason ?? null,
    error_message: params.errorMessage ?? null,
  };
}

function shouldSkipNdviRetry(params: {
  satelliteStatus: string | null;
  satelliteLastAttemptedAt: string | null;
}): boolean {
  const lastAttempt = parseTimestamp(params.satelliteLastAttemptedAt);
  if (params.satelliteStatus === "processing") {
    if (!lastAttempt) return false;
    return Date.now() - lastAttempt < 20 * 60 * 1000;
  }

  if (!lastAttempt) return false;
  return Date.now() - lastAttempt < 2 * 60 * 1000;
}

async function hydrateMissingNdvi(params: {
  projectId: string;
  latitude: number;
  longitude: number;
  landAreaHectares: number;
}): Promise<{ ndvi: number | null; errorMessage: string | null }> {
  const serviceClient = createServiceSupabaseClient();
  const nowIso = new Date().toISOString();

  await serviceClient
    .from("carbon_projects")
    .update({
      satellite_status: "processing",
      satellite_last_attempted_at: nowIso,
      satellite_error_message: null,
    })
    .eq("id", params.projectId);

  try {
    const result = await runForestryNdviAnalysis({
      latitude: params.latitude,
      longitude: params.longitude,
      landAreaHectares: params.landAreaHectares,
      projectId: params.projectId,
    });

    const confidence = calculateForestryConfidence(
      result.ndvi_current,
      result.ndvi_trend,
    );

    await serviceClient
      .from("carbon_projects")
      .update({
        satellite_status: "completed",
        satellite_ndvi_current: result.ndvi_current,
        satellite_ndvi_2020: result.ndvi_2020,
        satellite_ndvi_2022: result.ndvi_2022,
        satellite_ndvi_2024: result.ndvi_2024,
        satellite_ndvi_trend: result.ndvi_trend,
        satellite_confidence_score: confidence.score,
        satellite_confidence_badge: confidence.badge,
        satellite_verified_at: new Date().toISOString(),
        satellite_raw_response: result.raw_response,
        satellite_error_message: null,
        satellite_last_attempted_at: nowIso,
      })
      .eq("id", params.projectId);

    return { ndvi: result.ndvi_current, errorMessage: null };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "NDVI analysis failed.";

    await serviceClient
      .from("carbon_projects")
      .update({
        satellite_status: "failed",
        satellite_error_message: errorMessage,
        satellite_last_attempted_at: nowIso,
      })
      .eq("id", params.projectId);

    return { ndvi: null, errorMessage };
  }
}

function asForestryScientificConstants(value: unknown): CarbonScientificConstants {
  const source =
    value !== null && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  const read = (key: string): number => {
    const fieldValue = source[key];
    if (typeof fieldValue !== "number" || !Number.isFinite(fieldValue)) {
      throw new Error(`Gemini returned invalid ${key}.`);
    }
    return fieldValue;
  };

  return {
    wood_density: read("wood_density"),
    biomass_expansion_factor: read("biomass_expansion_factor"),
    root_to_shoot_ratio: read("root_to_shoot_ratio"),
    carbon_fraction: read("carbon_fraction"),
    annual_volume_growth_per_tree_m3: read("annual_volume_growth_per_tree_m3"),
    theoretical_max_trees_per_ha: read("theoretical_max_trees_per_ha"),
    risk_buffer_percent: read("risk_buffer_percent"),
    leakage_percent: read("leakage_percent"),
    premium_multiplier: read("premium_multiplier"),
  };
}

function asSolarScientificConstants(value: unknown): SolarScientificConstants {
  const source =
    value !== null && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  const read = (key: string): number => {
    const fieldValue = source[key];
    if (typeof fieldValue !== "number" || !Number.isFinite(fieldValue)) {
      throw new Error(`Gemini solar constants invalid ${key}.`);
    }
    return fieldValue;
  };

  return {
    panel_efficiency: read("panel_efficiency"),
    performance_ratio: read("performance_ratio"),
    annual_degradation_rate: read("annual_degradation_rate"),
    grid_emission_factor_tco2_per_mwh: read("grid_emission_factor_tco2_per_mwh"),
    risk_buffer_percent: read("risk_buffer_percent"),
  };
}

function asMethaneScientificConstants(
  value: unknown,
): MethaneScientificConstants {
  const source =
    value !== null && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  const read = (key: string): number => {
    const fieldValue = source[key];
    if (typeof fieldValue !== "number" || !Number.isFinite(fieldValue)) {
      throw new Error(`Gemini methane constants invalid ${key}.`);
    }
    return fieldValue;
  };

  return {
    gwp_multiplier: read("gwp_multiplier"),
    destruction_efficiency: read("destruction_efficiency"),
    methane_density_kg_per_m3: read("methane_density_kg_per_m3"),
    energy_content_kwh_per_m3: read("energy_content_kwh_per_m3"),
    engine_electrical_efficiency: read("engine_electrical_efficiency"),
    grid_emission_factor_tco2_per_mwh: read("grid_emission_factor_tco2_per_mwh"),
    risk_buffer_percent: read("risk_buffer_percent"),
  };
}

async function fetchForestryScientificConstants(
  species: string,
  region: string,
): Promise<ProjectAiValuationScientificData> {
  const model = getForestryGeminiModel();
  const prompt =
    `Act as a Tier-3 IPCC carbon accounting algorithm. ` +
    `Return biological and market constants for species "${species}" in region "${region}". ` +
    `Return only numeric values in JSON and keep values realistic for field verification.`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new Error("Gemini returned non-JSON constants.");
  }

  const raw = asForestryScientificConstants(parsed);

  return {
    ...raw,
    risk_buffer_percent: normalizePercentFraction(raw.risk_buffer_percent),
    leakage_percent: normalizePercentFraction(raw.leakage_percent),
  };
}

async function fetchSolarScientificConstants(
  panelTechnology: string,
  gridRegion: string,
): Promise<ProjectAiValuationSolarScientificData> {
  const model = getSolarGeminiModel();
  const prompt = [
    "Act as a UNFCCC Tier-3 Solar Carbon Assessor.",
    `The project uses "${panelTechnology}" panel technology.`,
    `The project is connected to "${gridRegion}" grid region in India.`,
    "Return only numeric constants in JSON for panel efficiency, performance ratio, annual degradation rate, grid emission factor, and risk buffer percent.",
  ].join(" ");

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new Error("Gemini solar constants failed: non-JSON response.");
  }

  const raw = asSolarScientificConstants(parsed);
  return {
    panel_efficiency: normalizePercentFraction(raw.panel_efficiency),
    performance_ratio: normalizePercentFraction(raw.performance_ratio),
    annual_degradation_rate: normalizePercentFraction(raw.annual_degradation_rate),
    grid_emission_factor_tco2_per_mwh: Math.max(
      raw.grid_emission_factor_tco2_per_mwh,
      0,
    ),
    risk_buffer_percent: normalizePercentFraction(raw.risk_buffer_percent),
  };
}

async function fetchMethaneScientificConstants(params: {
  sourceType: string;
  destructionMethod: string;
  endUseElectricity: boolean;
  gridRegion: string;
}): Promise<MethaneScientificConstants> {
  const model = getMethaneGeminiModel();
  const prompt = [
    "Act as a UNFCCC Tier-3 Carbon Assessor.",
    `Source: "${params.sourceType}".`,
    `Destruction Method: "${params.destructionMethod}".`,
    `Generating Electricity to Grid: ${params.endUseElectricity}.`,
    `Grid Region: "${params.gridRegion}".`,
    "Provide only numeric JSON constants for methane valuation.",
  ].join(" ");

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new Error("Gemini methane constants failed: non-JSON response.");
  }

  const raw = asMethaneScientificConstants(parsed);
  return {
    gwp_multiplier: Math.max(raw.gwp_multiplier, 0),
    destruction_efficiency: normalizePercentFraction(raw.destruction_efficiency),
    methane_density_kg_per_m3: Math.max(raw.methane_density_kg_per_m3, 0),
    energy_content_kwh_per_m3: Math.max(raw.energy_content_kwh_per_m3, 0),
    engine_electrical_efficiency: normalizePercentFraction(
      raw.engine_electrical_efficiency,
    ),
    grid_emission_factor_tco2_per_mwh: Math.max(
      raw.grid_emission_factor_tco2_per_mwh,
      0,
    ),
    risk_buffer_percent: normalizePercentFraction(raw.risk_buffer_percent),
  };
}

async function fetchOpenMeteoWindSpeeds(params: {
  latitude: number;
  longitude: number;
  readingPeriodStart: string;
  readingPeriodEnd: string;
}): Promise<{ hourlyWindSpeedsMs: number[]; sourceUrl: string; hourCount: number }> {
  const baseUrl = getOpenMeteoArchiveBaseUrl();
  const url = new URL(baseUrl);
  url.searchParams.set("latitude", params.latitude.toString());
  url.searchParams.set("longitude", params.longitude.toString());
  url.searchParams.set("start_date", params.readingPeriodStart);
  url.searchParams.set("end_date", params.readingPeriodEnd);
  url.searchParams.set("hourly", "wind_speed_100m");
  url.searchParams.set("wind_speed_unit", "ms");

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch (error) {
    throw new Error(
      `Windmill Open-Meteo request failed: ${error instanceof Error ? error.message : "network_error"}`,
    );
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    throw new Error(
      `Windmill Open-Meteo request failed (${response.status}): ${bodyText || response.statusText}`,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Windmill Open-Meteo response parsing failed: invalid JSON.");
  }

  const record =
    payload !== null && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : null;
  const hourly =
    record?.hourly !== null && typeof record?.hourly === "object"
      ? (record.hourly as Record<string, unknown>)
      : null;
  const speeds = Array.isArray(hourly?.wind_speed_100m)
    ? hourly?.wind_speed_100m
    : null;

  if (!speeds) {
    throw new Error("Windmill Open-Meteo response missing hourly.wind_speed_100m.");
  }

  const hourlyWindSpeedsMs = speeds
    .map((value) => (typeof value === "number" ? value : Number(value)))
    .filter((value) => Number.isFinite(value));

  if (hourlyWindSpeedsMs.length === 0) {
    throw new Error("Windmill Open-Meteo response contains no finite hourly wind values.");
  }

  return {
    hourlyWindSpeedsMs,
    sourceUrl: baseUrl,
    hourCount: hourlyWindSpeedsMs.length,
  };
}

function extractRenewablesNinjaTheoreticalMwh(value: unknown): number | null {
  const asFinite = (input: unknown): number | null => {
    if (typeof input === "number" && Number.isFinite(input)) {
      return input;
    }
    if (typeof input === "string") {
      const parsed = Number(input);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const asRecord = (input: unknown): Record<string, unknown> | null =>
    input !== null && typeof input === "object"
      ? (input as Record<string, unknown>)
      : null;

  const root = asRecord(value);
  if (!root) return null;

  const candidateNumericPaths: Array<[Record<string, unknown>, string, number]> = [
    [root, "annual_energy_mwh", 1],
    [root, "energy_mwh", 1],
    [root, "annual_mwh", 1],
    [root, "annual_energy_kwh", 1 / 1000],
    [root, "energy_kwh", 1 / 1000],
  ];

  for (const [record, key, multiplier] of candidateNumericPaths) {
    const valueAtKey = asFinite(record[key]);
    if (valueAtKey !== null) {
      return Math.max(valueAtKey * multiplier, 0);
    }
  }

  const nestedData = asRecord(root.data);
  if (nestedData) {
    for (const key of ["annual_energy_mwh", "energy_mwh", "annual_mwh"]) {
      const valueAtKey = asFinite(nestedData[key]);
      if (valueAtKey !== null) {
        return Math.max(valueAtKey, 0);
      }
    }
    for (const key of ["annual_energy_kwh", "energy_kwh"]) {
      const valueAtKey = asFinite(nestedData[key]);
      if (valueAtKey !== null) {
        return Math.max(valueAtKey / 1000, 0);
      }
    }
  }

  const seriesSources: unknown[] = [root.electricity, nestedData?.electricity];
  for (const source of seriesSources) {
    if (Array.isArray(source)) {
      const sum = source.reduce((acc, item) => {
        const num = asFinite(item);
        return acc + (num ?? 0);
      }, 0);
      if (sum > 0) {
        return Math.max(sum / 1000, 0);
      }
    }
    if (source !== null && typeof source === "object") {
      const sum = Object.values(source as Record<string, unknown>).reduce<number>(
        (acc, item) => {
          const num = asFinite(item);
          return acc + (num ?? 0);
        },
        0,
      );
      if (sum > 0) {
        return Math.max(sum / 1000, 0);
      }
    }
  }

  return null;
}

async function fetchRenewablesNinjaTheoreticalMwh(params: {
  latitude: number;
  longitude: number;
  readingPeriodStart: string;
  readingPeriodEnd: string;
  hubHeightM: number;
  turbineModel: string;
}): Promise<{ theoreticalMwh: number | null; sourceUrl: string; errorMessage: string | null }> {
  const apiKey = getRenewablesNinjaApiKey();
  const sourceUrl = getRenewablesNinjaBaseUrl();
  if (!apiKey) {
    return {
      theoreticalMwh: null,
      sourceUrl,
      errorMessage: "Missing RENEWABLES_NINJA_API_KEY.",
    };
  }

  const endpoint = new URL(`${sourceUrl}/data/wind`);
  endpoint.searchParams.set("lat", params.latitude.toString());
  endpoint.searchParams.set("lon", params.longitude.toString());
  endpoint.searchParams.set("date_from", params.readingPeriodStart);
  endpoint.searchParams.set("date_to", params.readingPeriodEnd);
  endpoint.searchParams.set("height", params.hubHeightM.toFixed(2));
  endpoint.searchParams.set("turbine", params.turbineModel);
  endpoint.searchParams.set("format", "json");

  let response: Response;
  try {
    response = await fetch(endpoint.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Token ${apiKey}`,
      },
      cache: "no-store",
    });
  } catch (error) {
    return {
      theoreticalMwh: null,
      sourceUrl,
      errorMessage: `Renewables.ninja request failed: ${error instanceof Error ? error.message : "network_error"}`,
    };
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    return {
      theoreticalMwh: null,
      sourceUrl,
      errorMessage: `Renewables.ninja request failed (${response.status}): ${bodyText || response.statusText}`,
    };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return {
      theoreticalMwh: null,
      sourceUrl,
      errorMessage: "Renewables.ninja response parsing failed: invalid JSON.",
    };
  }

  const theoreticalMwh = extractRenewablesNinjaTheoreticalMwh(payload);
  if (theoreticalMwh === null) {
    return {
      theoreticalMwh: null,
      sourceUrl,
      errorMessage:
        "Renewables.ninja response parsing failed: no annual energy series detected.",
    };
  }

  return {
    theoreticalMwh,
    sourceUrl,
    errorMessage: null,
  };
}

async function persistSnapshot(params: {
  projectId: string;
  metadata: ProjectSubmissionMetadata;
  raw: Record<string, unknown>;
  snapshot: ProjectAiValuation;
}) {
  const nextMetadata: ProjectSubmissionMetadata = {
    ...params.metadata,
    ai_valuation: params.snapshot,
  };

  const nextReviewNotes = serializeProjectReviewNotes(params.raw, nextMetadata);
  const serviceClient = createServiceSupabaseClient();
  const { error } = await serviceClient
    .from("carbon_projects")
    .update({
      review_notes: nextReviewNotes,
    })
    .eq("id", params.projectId);

  if (error) {
    console.error("project_ai_valuation_persist_failed", {
      projectId: params.projectId,
      reason: error.message,
    });
  }
}

function resolveMissingForestryInputsReason(inputs: ForestryValuationInputs): string {
  if (!inputs.species) return "Primary species is missing.";
  if (inputs.ageYears === null) return "Planting year or start date is missing.";
  if (inputs.areaHa === null || inputs.areaHa <= 0) return "Project area is missing.";
  if (inputs.ndvi === null) return "Awaiting satellite NDVI verification.";
  return "Missing required inputs.";
}

function resolveMissingSolarInputsReason(inputs: SolarValuationInputs): string {
  if (!inputs.polygonGeojson) {
    return "Solar valuation pending: missing polygon_geojson";
  }
  if (!inputs.panelTechnology) {
    return "Solar valuation pending: missing panel_technology";
  }
  if (!inputs.gridRegion) {
    return "Solar valuation pending: missing grid_region";
  }
  if (inputs.commissioningYear === null || inputs.ageYears === null) {
    return "Solar valuation pending: missing project_start_date";
  }
  if (inputs.claimedCapacityMw === null || inputs.claimedCapacityMw <= 0) {
    return "Solar valuation pending: missing claimed_capacity_mw";
  }
  return "Solar valuation pending: missing required inputs";
}

function resolveMissingMethaneInputsReason(inputs: MethaneValuationInputs): string {
  if (inputs.latitude === null || inputs.longitude === null) {
    return "Methane valuation pending: missing coordinates";
  }
  if (!inputs.sourceType) {
    return "Methane valuation pending: missing methane_source_type";
  }
  if (!inputs.destructionMethod) {
    return "Methane valuation pending: missing methane_destruction_method";
  }
  if (!inputs.generatesElectricity) {
    return "Methane valuation pending: missing methane_generates_electricity";
  }
  if (inputs.claimedVolumeM3 === null || inputs.claimedVolumeM3 <= 0) {
    return "Methane valuation pending: missing claimed_methane_volume_m3";
  }
  if (inputs.ch4Concentration === null || inputs.ch4Concentration <= 0) {
    return "Methane valuation pending: missing ch4_concentration";
  }
  if (!inputs.gridRegion) {
    return "Methane valuation pending: missing state for grid region";
  }
  return "Methane valuation pending: missing required inputs";
}

function resolveMissingWindmillInputsReason(inputs: WindmillValuationInputs): string {
  if (inputs.locations.length < 1) {
    return "Windmill valuation pending: missing windmill_locations";
  }
  if (!inputs.turbineModel) {
    return "Windmill valuation pending: missing windmill_turbine_model";
  }
  if (!isWindmillTurbineModel(inputs.turbineModel)) {
    return "Windmill valuation pending: unsupported windmill_turbine_model";
  }
  if (inputs.hubHeightM === null || inputs.hubHeightM <= 0) {
    return "Windmill valuation pending: missing windmill_hub_height_m";
  }
  if (inputs.claimedNetExportMwh === null || inputs.claimedNetExportMwh <= 0) {
    return "Windmill valuation pending: missing windmill_claimed_net_export_mwh";
  }
  if (!inputs.state) {
    return "Windmill valuation pending: missing state";
  }
  return "Windmill valuation pending: missing required inputs";
}

function isReadySnapshot(snapshot: ProjectAiValuation | null | undefined): boolean {
  return snapshot?.status === "ready";
}

function branchUnsupportedSnapshot(params: {
  nowIso: string;
  fingerprint: string;
}): ProjectAiValuation {
  return createSnapshot({
    status: "not_applicable",
    modelType: null,
    nowIso: params.nowIso,
    fingerprint: params.fingerprint,
    reason:
      "Valuation is available only for forestry, agricultural, solar, methane, and windmill projects.",
  });
}

async function resolveForestryValuation(params: {
  input: ResolveProjectAiValuationInput;
  existingSnapshot: ProjectAiValuation | null | undefined;
  metadata: ProjectSubmissionMetadata;
  nowIso: string;
  rawReviewNotes: Record<string, unknown>;
}): Promise<ProjectAiValuation> {
  const valuationInputs = deriveForestryInputs(
    params.metadata,
    params.input.projectStartDate,
    params.input.landAreaHectares,
    params.input.satelliteNdviCurrent,
  );

  const canHydrateNdvi =
    FORESTRY_PROJECT_TYPES.has(params.input.projectType ?? "") &&
    params.input.status === "verified" &&
    valuationInputs.areaHa !== null &&
    valuationInputs.areaHa > 0 &&
    valuationInputs.ndvi === null &&
    params.input.latitude !== null &&
    params.input.longitude !== null &&
    !shouldSkipNdviRetry({
      satelliteStatus: params.input.satelliteStatus,
      satelliteLastAttemptedAt: params.input.satelliteLastAttemptedAt,
    });

  let ndviHydrateError: string | null = null;
  if (canHydrateNdvi) {
    const ndviHydration = await hydrateMissingNdvi({
      projectId: params.input.projectId,
      latitude: params.input.latitude as number,
      longitude: params.input.longitude as number,
      landAreaHectares: valuationInputs.areaHa as number,
    });
    valuationInputs.ndvi = ndviHydration.ndvi;
    ndviHydrateError = ndviHydration.errorMessage;
  }

  const fingerprint = buildForestryFingerprint({
    status: params.input.status,
    projectType: params.input.projectType,
    species: valuationInputs.species,
    plantingYear: valuationInputs.plantingYear,
    areaHa: valuationInputs.areaHa,
    ndvi: valuationInputs.ndvi,
    region: valuationInputs.region,
  });

  if (isSnapshotFresh(params.existingSnapshot, fingerprint)) {
    return params.existingSnapshot as ProjectAiValuation;
  }

  let nextSnapshot: ProjectAiValuation;
  if (params.input.status !== "verified") {
    nextSnapshot = createSnapshot({
      status: "not_applicable",
      modelType: "forestry_agri",
      nowIso: params.nowIso,
      fingerprint,
      reason: "Valuation is available only for verified projects.",
    });
  } else if (
    !valuationInputs.species ||
    valuationInputs.ageYears === null ||
    valuationInputs.areaHa === null ||
    valuationInputs.areaHa <= 0 ||
    valuationInputs.ndvi === null
  ) {
    nextSnapshot = createSnapshot({
      status: "pending_inputs",
      modelType: "forestry_agri",
      nowIso: params.nowIso,
      fingerprint,
      reason:
        valuationInputs.ndvi === null && ndviHydrateError
          ? `Satellite NDVI analysis failed: ${ndviHydrateError}`
          : valuationInputs.ndvi === null && params.input.satelliteStatus === "processing"
            ? "Satellite NDVI analysis is still processing."
            : valuationInputs.ndvi === null && params.input.satelliteErrorMessage
              ? `Satellite NDVI analysis failed: ${params.input.satelliteErrorMessage}`
              : resolveMissingForestryInputsReason(valuationInputs),
    });
  } else {
    try {
      const scientificData = await fetchForestryScientificConstants(
        valuationInputs.species,
        valuationInputs.region,
      );
      const marketData = computeCarbonValuation({
        ndviScore: valuationInputs.ndvi,
        verifiedAreaHa: valuationInputs.areaHa,
        ageYears: valuationInputs.ageYears,
        constants: scientificData,
      });

      nextSnapshot = createSnapshot({
        status: "ready",
        modelType: "forestry_agri",
        nowIso: params.nowIso,
        fingerprint,
        scientificData,
        marketData,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unable to compute valuation.";

      if (isReadySnapshot(params.existingSnapshot)) {
        console.error("project_ai_valuation_refresh_failed", {
          projectId: params.input.projectId,
          stage: "forestry_compute",
          reason: errorMessage,
        });
        return params.existingSnapshot as ProjectAiValuation;
      }

      nextSnapshot = createSnapshot({
        status: "error",
        modelType: "forestry_agri",
        nowIso: params.nowIso,
        fingerprint,
        errorMessage,
      });
    }
  }

  await persistSnapshot({
    projectId: params.input.projectId,
    metadata: params.metadata,
    raw: params.rawReviewNotes,
    snapshot: nextSnapshot,
  });

  return nextSnapshot;
}

async function resolveSolarValuation(params: {
  input: ResolveProjectAiValuationInput;
  existingSnapshot: ProjectAiValuation | null | undefined;
  metadata: ProjectSubmissionMetadata;
  nowIso: string;
  rawReviewNotes: Record<string, unknown>;
}): Promise<ProjectAiValuation> {
  const valuationInputs = deriveSolarInputs(
    params.metadata,
    params.input.projectStartDate,
    params.input.polygonGeojson,
  );

  const polygonSignature = getPolygonSignature(valuationInputs.polygonGeojson);
  const fingerprint = buildSolarFingerprint({
    status: params.input.status,
    projectType: params.input.projectType,
    panelTechnology: valuationInputs.panelTechnology,
    gridRegion: valuationInputs.gridRegion,
    commissioningYear: valuationInputs.commissioningYear,
    claimedCapacityMw: valuationInputs.claimedCapacityMw,
    polygonSignature,
  });

  if (isSnapshotFresh(params.existingSnapshot, fingerprint)) {
    return params.existingSnapshot as ProjectAiValuation;
  }

  let nextSnapshot: ProjectAiValuation;
  if (params.input.status !== "verified") {
    nextSnapshot = createSnapshot({
      status: "not_applicable",
      modelType: "solar",
      nowIso: params.nowIso,
      fingerprint,
      reason: "Valuation is available only for verified projects.",
    });
  } else if (
    !valuationInputs.polygonGeojson ||
    !valuationInputs.panelTechnology ||
    !valuationInputs.gridRegion ||
    valuationInputs.commissioningYear === null ||
    valuationInputs.ageYears === null ||
    valuationInputs.claimedCapacityMw === null ||
    valuationInputs.claimedCapacityMw <= 0
  ) {
    nextSnapshot = createSnapshot({
      status: "pending_inputs",
      modelType: "solar",
      nowIso: params.nowIso,
      fingerprint,
      reason: resolveMissingSolarInputsReason(valuationInputs),
    });
  } else {
    try {
      const geeData = await runSolarIrradianceAnalysis({
        projectId: params.input.projectId,
        polygonGeojson: valuationInputs.polygonGeojson,
      });

      const solarScientificData = await fetchSolarScientificConstants(
        valuationInputs.panelTechnology,
        valuationInputs.gridRegion,
      );

      const solarMarketData = computeSolarCarbonValuation({
        verifiedTotalAreaM2: geeData.verified_total_area_m2,
        annualGhiKwhPerM2: geeData.annual_ghi_kwh_per_m2,
        ageYears: valuationInputs.ageYears,
        constants: solarScientificData,
      });

      nextSnapshot = createSnapshot({
        status: "ready",
        modelType: "solar",
        nowIso: params.nowIso,
        fingerprint,
        solarScientificData,
        solarMarketData,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Solar valuation failed: unknown error.";

      if (isReadySnapshot(params.existingSnapshot)) {
        console.error("project_ai_valuation_refresh_failed", {
          projectId: params.input.projectId,
          stage: "solar_compute",
          reason: errorMessage,
        });
        return params.existingSnapshot as ProjectAiValuation;
      }

      nextSnapshot = createSnapshot({
        status: "error",
        modelType: "solar",
        nowIso: params.nowIso,
        fingerprint,
        errorMessage,
      });
    }
  }

  await persistSnapshot({
    projectId: params.input.projectId,
    metadata: params.metadata,
    raw: params.rawReviewNotes,
    snapshot: nextSnapshot,
  });

  return nextSnapshot;
}

async function resolveMethaneValuation(params: {
  input: ResolveProjectAiValuationInput;
  existingSnapshot: ProjectAiValuation | null | undefined;
  metadata: ProjectSubmissionMetadata;
  nowIso: string;
  rawReviewNotes: Record<string, unknown>;
}): Promise<ProjectAiValuation> {
  const valuationInputs = deriveMethaneInputs(
    params.metadata,
    params.input.latitude,
    params.input.longitude,
  );

  const fingerprint = buildMethaneFingerprint({
    status: params.input.status,
    projectType: params.input.projectType,
    sourceType: valuationInputs.sourceType,
    destructionMethod: valuationInputs.destructionMethod,
    generatesElectricity: valuationInputs.generatesElectricity,
    claimedVolumeM3: valuationInputs.claimedVolumeM3,
    ch4Concentration: valuationInputs.ch4Concentration,
    gridRegion: valuationInputs.gridRegion,
    latitude: valuationInputs.latitude,
    longitude: valuationInputs.longitude,
  });

  if (isSnapshotFresh(params.existingSnapshot, fingerprint)) {
    return params.existingSnapshot as ProjectAiValuation;
  }

  let nextSnapshot: ProjectAiValuation;
  if (params.input.status !== "verified") {
    nextSnapshot = createSnapshot({
      status: "not_applicable",
      modelType: "methane",
      nowIso: params.nowIso,
      fingerprint,
      reason: "Valuation is available only for verified projects.",
    });
  } else if (
    valuationInputs.latitude === null ||
    valuationInputs.longitude === null ||
    !valuationInputs.sourceType ||
    !valuationInputs.destructionMethod ||
    !valuationInputs.generatesElectricity ||
    valuationInputs.claimedVolumeM3 === null ||
    valuationInputs.claimedVolumeM3 <= 0 ||
    valuationInputs.ch4Concentration === null ||
    valuationInputs.ch4Concentration <= 0 ||
    !valuationInputs.gridRegion
  ) {
    nextSnapshot = createSnapshot({
      status: "pending_inputs",
      modelType: "methane",
      nowIso: params.nowIso,
      fingerprint,
      reason: resolveMissingMethaneInputsReason(valuationInputs),
    });
  } else {
    try {
      const satelliteData = await runMethaneSatelliteConfidenceAnalysis({
        projectId: params.input.projectId,
        latitude: valuationInputs.latitude,
        longitude: valuationInputs.longitude,
        destructionMethod: valuationInputs.destructionMethod,
      });

      const methaneConstants = await fetchMethaneScientificConstants({
        sourceType: valuationInputs.sourceType,
        destructionMethod: valuationInputs.destructionMethod,
        endUseElectricity: valuationInputs.generatesElectricity === "yes",
        gridRegion: valuationInputs.gridRegion,
      });

      const methaneMarketData = computeMethaneCarbonValuation({
        claimedVolumeM3: valuationInputs.claimedVolumeM3,
        ch4Concentration: valuationInputs.ch4Concentration,
        flareActiveConfidence: satelliteData.flare_active_confidence,
        endUseElectricity: valuationInputs.generatesElectricity === "yes",
        constants: methaneConstants,
      });

      const methaneScientificData: ProjectAiValuationMethaneScientificData = {
        ...methaneConstants,
        flare_active_confidence: satelliteData.flare_active_confidence,
        viirs_score: satelliteData.viirs_score,
        plume_drop_score: satelliteData.plume_drop_score,
        viirs_current_mean_frp: satelliteData.viirs_current_mean_frp,
        viirs_bypassed: satelliteData.viirs_bypassed,
        s5p_current_mean_ch4: satelliteData.s5p_current_mean_ch4,
        s5p_baseline_mean_ch4: satelliteData.s5p_baseline_mean_ch4,
        satellite_raw_response: satelliteData.raw_response,
      };

      nextSnapshot = createSnapshot({
        status: "ready",
        modelType: "methane",
        nowIso: params.nowIso,
        fingerprint,
        methaneScientificData,
        methaneMarketData,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Methane valuation failed: unknown error.";

      if (isReadySnapshot(params.existingSnapshot)) {
        console.error("project_ai_valuation_refresh_failed", {
          projectId: params.input.projectId,
          stage: "methane_compute",
          reason: errorMessage,
        });
        return params.existingSnapshot as ProjectAiValuation;
      }

      nextSnapshot = createSnapshot({
        status: "error",
        modelType: "methane",
        nowIso: params.nowIso,
        fingerprint,
        errorMessage,
      });
    }
  }

  await persistSnapshot({
    projectId: params.input.projectId,
    metadata: params.metadata,
    raw: params.rawReviewNotes,
    snapshot: nextSnapshot,
  });

  return nextSnapshot;
}

async function resolveWindmillValuation(params: {
  input: ResolveProjectAiValuationInput;
  existingSnapshot: ProjectAiValuation | null | undefined;
  metadata: ProjectSubmissionMetadata;
  nowIso: string;
  rawReviewNotes: Record<string, unknown>;
}): Promise<ProjectAiValuation> {
  const valuationInputs = deriveWindmillInputs(params.metadata);
  const readingPeriod = getLatestFullYearReadingPeriod();
  const locationsSignature = getWindmillLocationsSignature(valuationInputs.locations);
  const fingerprint = buildWindmillFingerprint({
    status: params.input.status,
    projectType: params.input.projectType,
    locationsSignature,
    turbineModel: valuationInputs.turbineModel,
    hubHeightM: valuationInputs.hubHeightM,
    claimedNetExportMwh: valuationInputs.claimedNetExportMwh,
    state: valuationInputs.state,
    readingPeriodStart: readingPeriod.startDate,
    readingPeriodEnd: readingPeriod.endDate,
  });

  if (isSnapshotFresh(params.existingSnapshot, fingerprint)) {
    return params.existingSnapshot as ProjectAiValuation;
  }

  const snapshotTtlMs = getWindmillSnapshotTtlMs();
  let nextSnapshot: ProjectAiValuation;
  if (params.input.status !== "verified") {
    nextSnapshot = createSnapshot({
      status: "not_applicable",
      modelType: "windmill",
      nowIso: params.nowIso,
      fingerprint,
      ttlMs: snapshotTtlMs,
      reason: "Valuation is available only for verified projects.",
    });
  } else if (
    valuationInputs.locations.length < 1 ||
    !valuationInputs.turbineModel ||
    !isWindmillTurbineModel(valuationInputs.turbineModel) ||
    valuationInputs.hubHeightM === null ||
    valuationInputs.hubHeightM <= 0 ||
    valuationInputs.claimedNetExportMwh === null ||
    valuationInputs.claimedNetExportMwh <= 0 ||
    !valuationInputs.state
  ) {
    nextSnapshot = createSnapshot({
      status: "pending_inputs",
      modelType: "windmill",
      nowIso: params.nowIso,
      fingerprint,
      ttlMs: snapshotTtlMs,
      reason: resolveMissingWindmillInputsReason(valuationInputs),
    });
  } else {
    try {
      const turbineSpec = resolveWindmillTurbineSpec(valuationInputs.turbineModel);
      if (!turbineSpec) {
        throw new Error("Windmill valuation failed: unsupported turbine registry model.");
      }

      const centroid = calculateWindFarmCentroid(valuationInputs.locations);
      if (!centroid) {
        throw new Error(
          "Windmill valuation failed: unable to derive centroid from windmill_locations.",
        );
      }

      const openMeteoData = await fetchOpenMeteoWindSpeeds({
        latitude: centroid.latitude,
        longitude: centroid.longitude,
        readingPeriodStart: readingPeriod.startDate,
        readingPeriodEnd: readingPeriod.endDate,
      });

      const theoreticalOpenMeteoMwh = integrateWindEnergyFromHourlySpeeds({
        hourlyWindSpeedsMs: openMeteoData.hourlyWindSpeedsMs,
        rotorDiameterM: turbineSpec.rotor_diameter_m,
        optimalCp: turbineSpec.optimal_cp,
        turbineCount: valuationInputs.locations.length,
      });

      const renewablesNinjaData = await fetchRenewablesNinjaTheoreticalMwh({
        latitude: centroid.latitude,
        longitude: centroid.longitude,
        readingPeriodStart: readingPeriod.startDate,
        readingPeriodEnd: readingPeriod.endDate,
        hubHeightM: valuationInputs.hubHeightM,
        turbineModel: valuationInputs.turbineModel,
      });

      const theoreticalNinjaMwh = renewablesNinjaData.theoreticalMwh;
      const sourceMode =
        theoreticalNinjaMwh !== null ? "dual" : "open_meteo_fallback";
      const theoreticalUsedMwh =
        theoreticalNinjaMwh !== null
          ? Math.min(theoreticalOpenMeteoMwh, theoreticalNinjaMwh)
          : theoreticalOpenMeteoMwh;

      const mappedGef = getWindmillGridEmissionFactor(valuationInputs.state);
      const gridEmissionFactorTco2PerMwh =
        Number.isFinite(mappedGef) && mappedGef > 0
          ? mappedGef
          : getWindmillGefDefault();

      const windmillMarketData = computeWindmillCarbonValuation({
        theoreticalCapacityMwhOpenMeteo: theoreticalOpenMeteoMwh,
        theoreticalCapacityMwhRenewablesNinja: theoreticalNinjaMwh,
        theoreticalCapacityMwhUsed: theoreticalUsedMwh,
        claimedNetExportMwh: valuationInputs.claimedNetExportMwh,
        gridEmissionFactorTco2PerMwh,
        pricePerCreditInr: getWindmillCreditPriceInr(),
      });

      const windmillScientificData: ProjectAiValuationWindmillScientificData = {
        turbine_model_key: valuationInputs.turbineModel,
        manufacturer: turbineSpec.manufacturer,
        model: turbineSpec.model,
        capacity_mw: turbineSpec.capacity_mw,
        rotor_diameter_m: turbineSpec.rotor_diameter_m,
        optimal_cp: turbineSpec.optimal_cp,
        centroid_latitude: centroid.latitude,
        centroid_longitude: centroid.longitude,
        reading_period_start: readingPeriod.startDate,
        reading_period_end: readingPeriod.endDate,
        reading_period_year: readingPeriod.year,
        source_mode: sourceMode,
        open_meteo_hour_count: openMeteoData.hourCount,
        open_meteo_base_url: openMeteoData.sourceUrl,
        renewables_ninja_base_url: renewablesNinjaData.sourceUrl,
        renewables_ninja_error: renewablesNinjaData.errorMessage,
        renewables_ninja_available: theoreticalNinjaMwh !== null,
        api_diagnostics: {
          location_count: valuationInputs.locations.length,
          claimed_net_export_mwh: valuationInputs.claimedNetExportMwh,
          state: valuationInputs.state,
          used_source_mode: sourceMode,
        },
      };

      if (renewablesNinjaData.errorMessage) {
        console.error("project_ai_valuation_refresh_partial_source", {
          projectId: params.input.projectId,
          stage: "windmill_renewables_ninja",
          reason: renewablesNinjaData.errorMessage,
        });
      }

      nextSnapshot = createSnapshot({
        status: "ready",
        modelType: "windmill",
        nowIso: params.nowIso,
        fingerprint,
        ttlMs: snapshotTtlMs,
        windmillScientificData,
        windmillMarketData,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Windmill valuation failed: unknown error.";

      if (isReadySnapshot(params.existingSnapshot)) {
        console.error("project_ai_valuation_refresh_failed", {
          projectId: params.input.projectId,
          stage: "windmill_compute",
          reason: errorMessage,
        });
        return params.existingSnapshot as ProjectAiValuation;
      }

      nextSnapshot = createSnapshot({
        status: "error",
        modelType: "windmill",
        nowIso: params.nowIso,
        fingerprint,
        ttlMs: snapshotTtlMs,
        errorMessage,
      });
    }
  }

  await persistSnapshot({
    projectId: params.input.projectId,
    metadata: params.metadata,
    raw: params.rawReviewNotes,
    snapshot: nextSnapshot,
  });

  return nextSnapshot;
}

export async function resolveAndPersistProjectAiValuation(
  input: ResolveProjectAiValuationInput,
): Promise<ProjectAiValuation> {
  const parsedNotes = parseProjectReviewNotes(input.reviewNotes);
  const metadata = parsedNotes.submissionMetadata;
  const existingSnapshot = metadata.ai_valuation;
  const nowIso = new Date().toISOString();

  if (FORESTRY_PROJECT_TYPES.has(input.projectType ?? "")) {
    return resolveForestryValuation({
      input,
      existingSnapshot,
      metadata,
      nowIso,
      rawReviewNotes: parsedNotes.raw,
    });
  }

  if (input.projectType === SOLAR_PROJECT_TYPE) {
    return resolveSolarValuation({
      input,
      existingSnapshot,
      metadata,
      nowIso,
      rawReviewNotes: parsedNotes.raw,
    });
  }

  if (input.projectType === METHANE_PROJECT_TYPE) {
    return resolveMethaneValuation({
      input,
      existingSnapshot,
      metadata,
      nowIso,
      rawReviewNotes: parsedNotes.raw,
    });
  }

  if (input.projectType === WINDMILL_PROJECT_TYPE) {
    return resolveWindmillValuation({
      input,
      existingSnapshot,
      metadata,
      nowIso,
      rawReviewNotes: parsedNotes.raw,
    });
  }

  const fingerprint = JSON.stringify({
    v: 2,
    modelType: null,
    status: input.status ?? "unknown",
    projectType: input.projectType ?? "unknown",
  });

  if (isSnapshotFresh(existingSnapshot, fingerprint)) {
    return existingSnapshot as ProjectAiValuation;
  }

  const snapshot = branchUnsupportedSnapshot({
    nowIso,
    fingerprint,
  });

  await persistSnapshot({
    projectId: input.projectId,
    metadata,
    raw: parsedNotes.raw,
    snapshot,
  });

  return snapshot;
}
