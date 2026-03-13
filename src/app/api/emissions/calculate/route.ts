import { NextResponse } from "next/server";
import {
  computeNetGridKwh,
  convertGridGramsToTonnes,
  estimateDieselLitersFromRuntime,
  resolveTotalGridKwh,
  roundToTwo,
} from "@/lib/emissions/corporateMath";
import { getElectricityMapsZoneForState } from "@/lib/emissions/mappings";
import {
  fetchClimatiqPhysicalEstimate,
  fetchElectricityMapsGridIntensity,
  ProviderRequestError,
} from "@/lib/emissions/providers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import type {
  DgTrackingMethod,
  IndustrySector,
  RefrigerantType,
  WaterSource,
  YesNoOption,
} from "@/types/emissions-calculator";

const INDUSTRY_SECTORS: IndustrySector[] = [
  "it_services",
  "manufacturing",
  "logistics",
  "energy",
  "retail",
  "agriculture",
  "finance",
  "healthcare",
  "construction",
  "other",
];

const DG_METHODS: DgTrackingMethod[] = [
  "fuel_logs",
  "runtime_logs",
  "no_dg_usage",
];

const YES_NO_VALUES: YesNoOption[] = ["yes", "no"];
const REFRIGERANT_TYPES: RefrigerantType[] = ["r32", "r410a", "r22", "r134a"];
const WATER_SOURCES: WaterSource[] = [
  "municipal_piped",
  "private_diesel_tanker",
];

const REFRIGERANT_ACTIVITY_IDS: Record<RefrigerantType, string> = {
  r32: "fugitive_gas-type_r32",
  r410a: "fugitive_gas-type_r410a",
  r22: "fugitive_gas-type_r22",
  r134a: "fugitive_gas-type_hfc_134a",
};

const LOCAL_EEIO_MAP = {
  it_software_services: 0.15,
  heavy_manufacturing: 0.45,
  logistics_transportation: 0.60,
  healthcare_pharma: 0.30,
  construction_real_estate: 0.55,
  retail_consumer_goods: 0.35,
  agriculture_food: 0.70,
} as const;

type LocalEeioSectorKey = keyof typeof LOCAL_EEIO_MAP;

const APP_INDUSTRY_TO_LOCAL_EEIO_KEY: Partial<Record<IndustrySector, LocalEeioSectorKey>> = {
  it_services: "it_software_services",
  manufacturing: "heavy_manufacturing",
  logistics: "logistics_transportation",
  healthcare: "healthcare_pharma",
  construction: "construction_real_estate",
  retail: "retail_consumer_goods",
  agriculture: "agriculture_food",
  energy: "heavy_manufacturing",
  finance: "it_software_services",
  other: "retail_consumer_goods",
};

function calculateLocalSpendFallback(
  spendInr: number,
  industrySector: IndustrySector,
): {
  co2eTonnes: number;
  spendUsd: number;
  mappedSectorKey: LocalEeioSectorKey | null;
  emissionFactor: number;
  exchangeRateInrToUsd: number;
} {
  const exchangeRateInrToUsd = 83.0;
  const spendUsd = spendInr / exchangeRateInrToUsd;
  const mappedSectorKey = APP_INDUSTRY_TO_LOCAL_EEIO_KEY[industrySector] ?? null;
  const emissionFactor =
    mappedSectorKey !== null ? LOCAL_EEIO_MAP[mappedSectorKey] ?? 0.35 : 0.35;
  const totalKgCo2e = spendUsd * emissionFactor;

  return {
    co2eTonnes: totalKgCo2e / 1000,
    spendUsd,
    mappedSectorKey,
    emissionFactor,
    exchangeRateInrToUsd,
  };
}

type RequestPayload = {
  baseline?: unknown;
  scope1?: unknown;
  scope2?: unknown;
  scope3?: unknown;
};

type CompanyRow = {
  id: string;
  status: string | null;
};

type ParsedPayload = {
  baseline: {
    companyName: string;
    industrySector: IndustrySector;
    operatingState: string;
    employeeCount: number | null;
    annualRevenueInr: number;
    facilityAreaSqFt: number | null;
  };
  scope1: {
    dgTrackingMethod: DgTrackingMethod;
    dgFuelLiters: number | null;
    dgRuntimeHours: number | null;
    dgCapacityKva: number | null;
    naturalGasM3: number | null;
    coalTonnes: number | null;
    fleetDieselLiters: number | null;
    fleetPetrolLiters: number | null;
    refrigerantType: RefrigerantType | null;
    refrigerantRechargedKg: number | null;
  };
  scope2: {
    hasExactAnnualKwh: YesNoOption;
    annualGridKwh: number | null;
    annualElectricityBillInr: number | null;
    onSiteSolarGeneratedKwh: number | null;
    greenTariffPercentage: number | null;
  };
  scope3: {
    isActivityBased: boolean;
    steelPurchasedTonnes: number | null;
    cementPurchasedTonnes: number | null;
    plasticsPurchasedTonnes: number | null;
    totalProcurementSpendInr: number | null;
    logisticsSpendInr: number | null;
    waterConsumedKl: number | null;
    waterSource: WaterSource | null;
    flightsDomestic: number | null;
    flightsInternational: number | null;
    commuteSplit: {
      twoWheelers: number | null;
      cars: number | null;
      publicTransit: number | null;
      remoteWork: number | null;
    };
  };
};

type ValidationError = {
  status: number;
  error: string;
  field?: string;
  failureStage: string;
};

type PersistRunParams = {
  userId: string;
  companyId: string | null;
  inputPayload: Record<string, unknown>;
  auditStatus: "SUCCESS_ZERO_TRUST_VERIFIED" | "FAILED";
  scope1: number | null;
  scope2: number | null;
  scope3: number | null;
  total: number | null;
  failureStage: string | null;
  errorMessage: string | null;
  providerDiagnostics: Record<string, unknown>;
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function isEnumValue<T extends string>(value: string, choices: readonly T[]): value is T {
  return (choices as readonly string[]).includes(value);
}

function buildValidationError(
  failureStage: string,
  error: string,
  field?: string,
): ValidationError {
  return {
    status: 400,
    error,
    field,
    failureStage,
  };
}

function validatePayload(payload: RequestPayload): ParsedPayload | ValidationError {
  const baseline = asObject(payload.baseline);
  const scope1 = asObject(payload.scope1);
  const scope2 = asObject(payload.scope2);
  const scope3 = asObject(payload.scope3);

  if (!baseline || !scope1 || !scope2 || !scope3) {
    return buildValidationError(
      "payload_validation",
      "Invalid payload: baseline, scope1, scope2, and scope3 are required objects.",
    );
  }

  const companyName = normalizeText(baseline.companyName);
  if (!companyName) {
    return buildValidationError("baseline_validation", "Company name is required.", "companyName");
  }

  const industrySector = normalizeText(baseline.industrySector);
  if (!isEnumValue(industrySector, INDUSTRY_SECTORS)) {
    return buildValidationError(
      "baseline_validation",
      "Invalid industry sector.",
      "industrySector",
    );
  }

  const operatingState = normalizeText(baseline.operatingState);
  if (!operatingState) {
    return buildValidationError(
      "baseline_validation",
      "Operating state is required.",
      "operatingState",
    );
  }

  const annualRevenueInr = toNumberOrNull(baseline.annualRevenueInr);
  if (annualRevenueInr === null || annualRevenueInr <= 0) {
    return buildValidationError(
      "baseline_validation",
      "Annual revenue must be a positive number.",
      "annualRevenueInr",
    );
  }

  const dgTrackingMethod = normalizeText(scope1.dgTrackingMethod);
  if (!isEnumValue(dgTrackingMethod, DG_METHODS)) {
    return buildValidationError(
      "scope1_validation",
      "Invalid DG tracking method.",
      "dgTrackingMethod",
    );
  }

  const dgFuelLiters = toNumberOrNull(scope1.dgFuelLiters);
  const dgRuntimeHours = toNumberOrNull(scope1.dgRuntimeHours);
  const dgCapacityKva = toNumberOrNull(scope1.dgCapacityKva);
  if (dgTrackingMethod === "fuel_logs" && (dgFuelLiters === null || dgFuelLiters <= 0)) {
    return buildValidationError(
      "scope1_validation",
      "DG fuel liters must be a positive number for fuel_logs mode.",
      "dgFuelLiters",
    );
  }
  if (
    dgTrackingMethod === "runtime_logs" &&
    ((dgRuntimeHours === null || dgRuntimeHours <= 0) ||
      (dgCapacityKva === null || dgCapacityKva <= 0))
  ) {
    return buildValidationError(
      "scope1_validation",
      "DG runtime hours and capacity must be positive numbers for runtime_logs mode.",
      "dgRuntimeHours",
    );
  }

  const refrigerantTypeRaw = normalizeText(scope1.refrigerantType);
  const refrigerantType =
    refrigerantTypeRaw && isEnumValue(refrigerantTypeRaw, REFRIGERANT_TYPES)
      ? refrigerantTypeRaw
      : null;
  const refrigerantRechargedKg = toNumberOrNull(scope1.refrigerantRechargedKg);
  if (refrigerantRechargedKg !== null && refrigerantRechargedKg > 0 && !refrigerantType) {
    return buildValidationError(
      "scope1_validation",
      "Refrigerant type is required when recharge quantity is provided.",
      "refrigerantType",
    );
  }
  if (refrigerantType && (refrigerantRechargedKg === null || refrigerantRechargedKg <= 0)) {
    return buildValidationError(
      "scope1_validation",
      "Refrigerant recharge quantity must be a positive number when type is selected.",
      "refrigerantRechargedKg",
    );
  }

  const hasExactAnnualKwh = normalizeText(scope2.hasExactAnnualKwh);
  if (!isEnumValue(hasExactAnnualKwh, YES_NO_VALUES)) {
    return buildValidationError(
      "scope2_validation",
      "Please select whether exact annual kWh is available.",
      "hasExactAnnualKwh",
    );
  }

  const annualGridKwh = toNumberOrNull(scope2.annualGridKwh);
  const annualElectricityBillInr = toNumberOrNull(scope2.annualElectricityBillInr);
  if (hasExactAnnualKwh === "yes" && (annualGridKwh === null || annualGridKwh <= 0)) {
    return buildValidationError(
      "scope2_validation",
      "Annual grid kWh must be a positive number when exact kWh is selected.",
      "annualGridKwh",
    );
  }
  if (
    hasExactAnnualKwh === "no" &&
    (annualElectricityBillInr === null || annualElectricityBillInr <= 0)
  ) {
    return buildValidationError(
      "scope2_validation",
      "Annual electricity bill must be a positive number when exact kWh is unavailable.",
      "annualElectricityBillInr",
    );
  }

  const onSiteSolarGeneratedKwh = toNumberOrNull(scope2.onSiteSolarGeneratedKwh);
  if (onSiteSolarGeneratedKwh !== null && onSiteSolarGeneratedKwh < 0) {
    return buildValidationError(
      "scope2_validation",
      "On-site solar generated kWh cannot be negative.",
      "onSiteSolarGeneratedKwh",
    );
  }

  const greenTariffPercentage = toNumberOrNull(scope2.greenTariffPercentage);
  if (
    greenTariffPercentage !== null &&
    (greenTariffPercentage < 0 || greenTariffPercentage > 100)
  ) {
    return buildValidationError(
      "scope2_validation",
      "Green tariff percentage must be between 0 and 100.",
      "greenTariffPercentage",
    );
  }

  const isActivityBased = asBoolean(scope3.isActivityBased);
  if (isActivityBased === null) {
    return buildValidationError(
      "scope3_validation",
      "Invalid procurement mode. isActivityBased must be boolean.",
      "isActivityBased",
    );
  }

  const steelPurchasedTonnes = toNumberOrNull(scope3.steelPurchasedTonnes);
  const totalProcurementSpendInr = toNumberOrNull(scope3.totalProcurementSpendInr);
  if (isActivityBased && (steelPurchasedTonnes === null || steelPurchasedTonnes <= 0)) {
    return buildValidationError(
      "scope3_validation",
      "Steel purchased tonnes must be a positive number in activity-based mode.",
      "steelPurchasedTonnes",
    );
  }
  if (!isActivityBased && (totalProcurementSpendInr === null || totalProcurementSpendInr <= 0)) {
    return buildValidationError(
      "scope3_validation",
      "Total procurement spend must be a positive number in spend-based mode.",
      "totalProcurementSpendInr",
    );
  }

  const waterSourceRaw = normalizeText(scope3.waterSource);
  const waterSource =
    waterSourceRaw && isEnumValue(waterSourceRaw, WATER_SOURCES)
      ? waterSourceRaw
      : null;

  return {
    baseline: {
      companyName,
      industrySector,
      operatingState,
      employeeCount: toNumberOrNull(baseline.employeeCount),
      annualRevenueInr,
      facilityAreaSqFt: toNumberOrNull(baseline.facilityAreaSqFt),
    },
    scope1: {
      dgTrackingMethod,
      dgFuelLiters,
      dgRuntimeHours,
      dgCapacityKva,
      naturalGasM3: toNumberOrNull(scope1.naturalGasM3),
      coalTonnes: toNumberOrNull(scope1.coalTonnes),
      fleetDieselLiters: toNumberOrNull(scope1.fleetDieselLiters),
      fleetPetrolLiters: toNumberOrNull(scope1.fleetPetrolLiters),
      refrigerantType,
      refrigerantRechargedKg,
    },
    scope2: {
      hasExactAnnualKwh,
      annualGridKwh,
      annualElectricityBillInr,
      onSiteSolarGeneratedKwh,
      greenTariffPercentage,
    },
    scope3: {
      isActivityBased,
      steelPurchasedTonnes,
      cementPurchasedTonnes: toNumberOrNull(scope3.cementPurchasedTonnes),
      plasticsPurchasedTonnes: toNumberOrNull(scope3.plasticsPurchasedTonnes),
      totalProcurementSpendInr,
      logisticsSpendInr: toNumberOrNull(scope3.logisticsSpendInr),
      waterConsumedKl: toNumberOrNull(scope3.waterConsumedKl),
      waterSource,
      flightsDomestic: toNumberOrNull(scope3.flightsDomestic),
      flightsInternational: toNumberOrNull(scope3.flightsInternational),
      commuteSplit: {
        twoWheelers: toNumberOrNull(asObject(scope3.commuteSplit)?.twoWheelers),
        cars: toNumberOrNull(asObject(scope3.commuteSplit)?.cars),
        publicTransit: toNumberOrNull(asObject(scope3.commuteSplit)?.publicTransit),
        remoteWork: toNumberOrNull(asObject(scope3.commuteSplit)?.remoteWork),
      },
    },
  };
}

function toDbNumber(value: number | null): number | null {
  return value === null ? null : Number(value.toFixed(6));
}

async function persistAssessmentRun(params: PersistRunParams): Promise<string | null> {
  const serviceClient = createServiceSupabaseClient();
  const { data, error } = await serviceClient
    .from("company_emission_assessments")
    .insert({
      user_id: params.userId,
      company_id: params.companyId,
      input_payload: params.inputPayload,
      scope_1_tco2e: toDbNumber(params.scope1),
      scope_2_tco2e: toDbNumber(params.scope2),
      scope_3_tco2e: toDbNumber(params.scope3),
      total_corporate_tco2e: toDbNumber(params.total),
      audit_status: params.auditStatus,
      failure_stage: params.failureStage,
      error_message: params.errorMessage,
      provider_diagnostics: params.providerDiagnostics,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("emissions_assessment_persist_failed", {
      userId: params.userId,
      companyId: params.companyId,
      reason: error.message,
    });
    return null;
  }

  return (data as { id?: string } | null)?.id ?? null;
}

function failureResponse(status: number, body: Record<string, unknown>) {
  return NextResponse.json(
    {
      audit_status: "FAILED",
      ...body,
    },
    { status },
  );
}

export async function POST(request: Request) {
  const providerDiagnostics: Record<string, unknown> = {};
  let activeStage = "request_parse";
  let userId: string | null = null;
  let companyId: string | null = null;
  let inputSnapshot: Record<string, unknown> = {};

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return failureResponse(401, {
        failure_stage: "auth",
        error: "Unauthorized. Please log in.",
      });
    }

    userId = user.id;

    const body = (await request.json().catch(() => null)) as RequestPayload | null;
    if (!body || typeof body !== "object") {
      return failureResponse(400, {
        failure_stage: "payload_parse",
        error: "Invalid request body. JSON object expected.",
      });
    }

    const parsed = validatePayload(body);
    if ("error" in parsed) {
      return failureResponse(parsed.status, {
        failure_stage: parsed.failureStage,
        error: parsed.error,
        ...(parsed.field ? { field: parsed.field } : {}),
      });
    }

    inputSnapshot = {
      baseline: parsed.baseline,
      scope1: parsed.scope1,
      scope2: parsed.scope2,
      scope3: parsed.scope3,
    };

    const { data: companyData, error: companyError } = await supabase
      .from("companies")
      .select("id, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (companyError) {
      return failureResponse(500, {
        failure_stage: "company_lookup",
        error: `Failed to read company profile: ${companyError.message}`,
      });
    }

    const company = (companyData ?? null) as CompanyRow | null;
    if (!company) {
      return failureResponse(403, {
        failure_stage: "company_verification",
        error: "Company profile not found for this user.",
      });
    }
    companyId = company.id;

    if (company.status !== "verified") {
      return failureResponse(403, {
        failure_stage: "company_verification",
        error: "Company must be verified before calculating emissions.",
      });
    }

    const zone = getElectricityMapsZoneForState(parsed.baseline.operatingState);
    if (!zone) {
      await persistAssessmentRun({
        userId,
        companyId,
        inputPayload: inputSnapshot,
        auditStatus: "FAILED",
        scope1: null,
        scope2: null,
        scope3: null,
        total: null,
        failureStage: "mapping_state_zone",
        errorMessage: `No Electricity Maps zone mapping for state: ${parsed.baseline.operatingState}`,
        providerDiagnostics,
      });
      return failureResponse(400, {
        failure_stage: "mapping_state_zone",
        error: `Missing zone mapping for state: ${parsed.baseline.operatingState}`,
      });
    }

    inputSnapshot.mapping = {
      electricity_maps_zone: zone,
      local_eeio_sector_key:
        APP_INDUSTRY_TO_LOCAL_EEIO_KEY[parsed.baseline.industrySector] ?? null,
    };

    const resultMode = "full" as const;
    const partialReason = null;
    let totalScope1 = 0;
    let totalScope2 = 0;
    let totalScope3 = 0;

    if (
      parsed.scope1.dgFuelLiters !== null &&
      parsed.scope1.dgFuelLiters > 0
    ) {
      activeStage = "scope1_diesel_physical";
      const diesel = await fetchClimatiqPhysicalEstimate({
        stage: activeStage,
        activityId: "fuel-type_diesel-fuel_use_stationary",
        quantity: parsed.scope1.dgFuelLiters,
        quantityUnit: "l",
        quantityType: "volume",
        region: null,
      });
      providerDiagnostics.scope1_diesel = diesel.diagnostic;
      totalScope1 += diesel.co2e;
    } else if (
      parsed.scope1.dgRuntimeHours !== null &&
      parsed.scope1.dgRuntimeHours > 0 &&
      parsed.scope1.dgCapacityKva !== null &&
      parsed.scope1.dgCapacityKva > 0
    ) {
      activeStage = "scope1_diesel_runtime";
      const estimatedLiters = estimateDieselLitersFromRuntime(
        parsed.scope1.dgRuntimeHours,
        parsed.scope1.dgCapacityKva,
      );
      const diesel = await fetchClimatiqPhysicalEstimate({
        stage: activeStage,
        activityId: "fuel-type_diesel-fuel_use_stationary",
        quantity: estimatedLiters,
        quantityUnit: "l",
        quantityType: "volume",
        region: null,
      });
      providerDiagnostics.scope1_diesel = {
        ...diesel.diagnostic,
        estimated_liters_from_runtime: estimatedLiters,
      };
      totalScope1 += diesel.co2e;
    }

    if (
      parsed.scope1.refrigerantRechargedKg !== null &&
      parsed.scope1.refrigerantRechargedKg > 0 &&
      parsed.scope1.refrigerantType
    ) {
      activeStage = "scope1_refrigerant";
      const refrigerantActivityId =
        REFRIGERANT_ACTIVITY_IDS[parsed.scope1.refrigerantType];
      const refrigerant = await fetchClimatiqPhysicalEstimate({
        stage: activeStage,
        activityId: refrigerantActivityId,
        quantity: parsed.scope1.refrigerantRechargedKg,
        quantityUnit: "kg",
        quantityType: "weight",
        region: null,
      });
      providerDiagnostics.scope1_refrigerant = refrigerant.diagnostic;
      totalScope1 += refrigerant.co2e;
    }

    activeStage = "scope2_grid_intensity";
    const grid = await fetchElectricityMapsGridIntensity({
      stage: activeStage,
      zone,
    });
    providerDiagnostics.scope2_grid_intensity = grid.diagnostic;

    const totalKwh = resolveTotalGridKwh({
      annualGridKwh: parsed.scope2.annualGridKwh,
      annualElectricityBillInr: parsed.scope2.annualElectricityBillInr,
    });
    const netGridKwh = computeNetGridKwh({
      totalKwh,
      onSiteSolarGeneratedKwh: parsed.scope2.onSiteSolarGeneratedKwh ?? 0,
    });
    totalScope2 = convertGridGramsToTonnes({
      netGridKwh,
      gridIntensityGramsPerKwh: grid.carbonIntensity,
    });
    providerDiagnostics.scope2_computation = {
      total_kwh: totalKwh,
      net_grid_kwh: netGridKwh,
      grid_intensity_gco2_per_kwh: grid.carbonIntensity,
    };

    if (
      parsed.scope3.isActivityBased &&
      parsed.scope3.steelPurchasedTonnes !== null &&
      parsed.scope3.steelPurchasedTonnes > 0
    ) {
      activeStage = "scope3_activity_steel";
      const steel = await fetchClimatiqPhysicalEstimate({
        stage: activeStage,
        activityId: "metals-type_steel",
        quantity: parsed.scope3.steelPurchasedTonnes,
        quantityUnit: "t",
        quantityType: "weight",
        region: null,
      });
      providerDiagnostics.scope3_activity_steel = steel.diagnostic;
      totalScope3 += steel.co2e;
    }

    if (
      !parsed.scope3.isActivityBased &&
      parsed.scope3.totalProcurementSpendInr !== null &&
      parsed.scope3.totalProcurementSpendInr > 0
    ) {
      activeStage = "scope3_spend_procurement";
      const localEeio = calculateLocalSpendFallback(
        parsed.scope3.totalProcurementSpendInr,
        parsed.baseline.industrySector,
      );
      totalScope3 += localEeio.co2eTonnes;
      providerDiagnostics.scope3_spend_local_eeio = {
        stage: activeStage,
        spend_inr: parsed.scope3.totalProcurementSpendInr,
        spend_usd: localEeio.spendUsd,
        exchange_rate_inr_to_usd: localEeio.exchangeRateInrToUsd,
        mapped_sector_key: localEeio.mappedSectorKey,
        emission_factor: localEeio.emissionFactor,
        co2e_tonnes: localEeio.co2eTonnes,
      };
    }

    const totalFootprint = totalScope1 + totalScope2 + totalScope3;
    const roundedScope1 = roundToTwo(totalScope1);
    const roundedScope2 = roundToTwo(totalScope2);
    const roundedScope3 = roundToTwo(totalScope3);
    const roundedTotal = roundToTwo(totalFootprint);

    providerDiagnostics.result_mode = "full";
    providerDiagnostics.partial_reason = null;
    providerDiagnostics.scope3_status = "computed";

    const assessmentId = await persistAssessmentRun({
      userId,
      companyId,
      inputPayload: inputSnapshot,
      auditStatus: "SUCCESS_ZERO_TRUST_VERIFIED",
      scope1: roundedScope1,
      scope2: roundedScope2,
      scope3: roundedScope3,
      total: roundedTotal,
      failureStage: null,
      errorMessage: null,
      providerDiagnostics,
    });

    if (!assessmentId) {
      return failureResponse(500, {
        failure_stage: "database_persist_success",
        error: "Calculated emissions but failed to persist assessment run.",
      });
    }

    return NextResponse.json(
      {
        audit_status: "SUCCESS_ZERO_TRUST_VERIFIED",
        result_mode: resultMode,
        partial_reason: partialReason,
        assessment_id: assessmentId,
        location_verified: `${parsed.baseline.operatingState} mapped to zone ${zone}`,
        emissions: {
          scope_1_tco2e: roundedScope1,
          scope_2_tco2e: roundedScope2,
          scope_3_tco2e: roundedScope3,
          total_corporate_tco2e: roundedTotal,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const status =
      error instanceof ProviderRequestError
        ? (error.status && error.status >= 400 ? 502 : 500)
        : 500;
    const failureStage =
      error instanceof ProviderRequestError ? error.stage : activeStage;
    const message =
      error instanceof ProviderRequestError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Unknown emissions pipeline failure.";

    if (error instanceof ProviderRequestError) {
      providerDiagnostics[failureStage] = error.diagnostic;
    }

    if (userId) {
      await persistAssessmentRun({
        userId,
        companyId,
        inputPayload: inputSnapshot,
        auditStatus: "FAILED",
        scope1: null,
        scope2: null,
        scope3: null,
        total: null,
        failureStage,
        errorMessage: message,
        providerDiagnostics,
      });
    }

    console.error("emissions_calculation_failed", {
      userId,
      companyId,
      failureStage,
      reason: message,
    });

    return failureResponse(status, {
      failure_stage: failureStage,
      error: message,
      diagnostics: providerDiagnostics,
    });
  }
}
