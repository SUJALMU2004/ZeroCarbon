"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import FormProgress from "@/components/verify-project/FormProgress";
import { INDIA_STATES_AND_UTS } from "@/lib/data/india-states";
import {
  DG_TRACKING_OPTIONS,
  EMPTY_EMISSIONS_DRAFT,
  INDUSTRY_SECTOR_OPTIONS,
  REFRIGERANT_TYPE_OPTIONS,
  WATER_SOURCE_OPTIONS,
  YES_NO_OPTIONS,
  type EmissionsCalculatorDraft,
} from "@/types/emissions-calculator";

interface EmissionsCalculatorWizardProps {
  userId: string;
}

type EmissionsCalculationSuccess = {
  kind: "success";
  assessmentId: string;
  auditStatus: string;
  resultMode: "full" | "partial";
  partialReason: string | null;
  emissions: {
    scope1: number;
    scope2: number;
    scope3: number | null;
    total: number;
  };
};

type EmissionsCalculationFailure = {
  kind: "failure";
  assessmentId: string | null;
  auditStatus: string;
  failureStage: string;
  error: string;
};

type EmissionsCalculationResult =
  | EmissionsCalculationSuccess
  | EmissionsCalculationFailure;

type StepKey =
  | "corporate_baseline"
  | "direct_operations"
  | "purchased_energy"
  | "value_chain"
  | "review_finish";

const STEP_FLOW: StepKey[] = [
  "corporate_baseline",
  "direct_operations",
  "purchased_energy",
  "value_chain",
  "review_finish",
];

const STEP_LABELS: Record<StepKey, string> = {
  corporate_baseline: "Corporate Baseline",
  direct_operations: "Direct Operations",
  purchased_energy: "Purchased Energy",
  value_chain: "Value Chain",
  review_finish: "Review & Finish",
};

type CommuteField =
  | "commuteTwoWheelers"
  | "commuteCars"
  | "commutePublicTransit"
  | "commuteRemoteWork";

const COMMUTE_FIELDS: Array<{ key: CommuteField; label: string }> = [
  { key: "commuteTwoWheelers", label: "Two-Wheelers" },
  { key: "commuteCars", label: "Cars" },
  { key: "commutePublicTransit", label: "Public Transit" },
  { key: "commuteRemoteWork", label: "Remote Work" },
];

function asText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStep(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(STEP_FLOW.length, Math.floor(parsed)));
}

function normalizeDraft(
  raw: Partial<EmissionsCalculatorDraft>,
): EmissionsCalculatorDraft {
  const merged: EmissionsCalculatorDraft = {
    ...EMPTY_EMISSIONS_DRAFT,
    ...raw,
  };

  return {
    ...merged,
    companyName: asText(merged.companyName),
    industrySector: asText(merged.industrySector) as EmissionsCalculatorDraft["industrySector"],
    operatingState: asText(merged.operatingState),
    employeeCount: asText(merged.employeeCount),
    annualRevenueInr: asText(merged.annualRevenueInr),
    facilityAreaSqFt: asText(merged.facilityAreaSqFt),
    dgTrackingMethod: asText(merged.dgTrackingMethod) as EmissionsCalculatorDraft["dgTrackingMethod"],
    dgFuelLiters: asText(merged.dgFuelLiters),
    dgRuntimeHours: asText(merged.dgRuntimeHours),
    dgCapacityKva: asText(merged.dgCapacityKva),
    naturalGasM3: asText(merged.naturalGasM3),
    coalTonnes: asText(merged.coalTonnes),
    fleetDieselLiters: asText(merged.fleetDieselLiters),
    fleetPetrolLiters: asText(merged.fleetPetrolLiters),
    refrigerantType: asText(merged.refrigerantType) as EmissionsCalculatorDraft["refrigerantType"],
    refrigerantRechargedKg: asText(merged.refrigerantRechargedKg),
    hasExactAnnualKwh: asText(merged.hasExactAnnualKwh) as EmissionsCalculatorDraft["hasExactAnnualKwh"],
    annualGridKwh: asText(merged.annualGridKwh),
    annualElectricityBillInr: asText(merged.annualElectricityBillInr),
    onSiteSolarGeneratedKwh: asText(merged.onSiteSolarGeneratedKwh),
    greenTariffPercentage: asText(merged.greenTariffPercentage),
    flightsDomestic: asText(merged.flightsDomestic),
    flightsInternational: asText(merged.flightsInternational),
    commuteTwoWheelers: asText(
      merged.commuteTwoWheelers,
      EMPTY_EMISSIONS_DRAFT.commuteTwoWheelers,
    ),
    commuteCars: asText(merged.commuteCars, EMPTY_EMISSIONS_DRAFT.commuteCars),
    commutePublicTransit: asText(
      merged.commutePublicTransit,
      EMPTY_EMISSIONS_DRAFT.commutePublicTransit,
    ),
    commuteRemoteWork: asText(
      merged.commuteRemoteWork,
      EMPTY_EMISSIONS_DRAFT.commuteRemoteWork,
    ),
    tracksPhysicalMaterialWeights: asText(
      merged.tracksPhysicalMaterialWeights,
    ) as EmissionsCalculatorDraft["tracksPhysicalMaterialWeights"],
    steelPurchasedTonnes: asText(merged.steelPurchasedTonnes),
    cementPurchasedTonnes: asText(merged.cementPurchasedTonnes),
    plasticsPurchasedTonnes: asText(merged.plasticsPurchasedTonnes),
    totalProcurementSpendInr: asText(merged.totalProcurementSpendInr),
    logisticsSpendInr: asText(merged.logisticsSpendInr),
    waterConsumedKl: asText(merged.waterConsumedKl),
    waterSource: asText(merged.waterSource) as EmissionsCalculatorDraft["waterSource"],
    current_step: asStep(merged.current_step),
    last_saved: asText(merged.last_saved),
  };
}

function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatSavedTime(value: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatNumericText(value: string, decimals = 2): string {
  const parsed = parseNumber(value);
  if (parsed === null) return "-";
  return parsed.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

function sumCommute(draft: EmissionsCalculatorDraft): number {
  return COMMUTE_FIELDS.reduce((accumulator, field) => {
    const parsed = parseNumber(draft[field.key]);
    return accumulator + (parsed ?? 0);
  }, 0);
}

function parseDraftNumber(value: string): number | null {
  return parseNumber(value);
}

function buildCalculatePayload(draft: EmissionsCalculatorDraft) {
  return {
    baseline: {
      companyName: draft.companyName.trim(),
      industrySector: draft.industrySector,
      operatingState: draft.operatingState.trim(),
      employeeCount: parseDraftNumber(draft.employeeCount),
      annualRevenueInr: parseDraftNumber(draft.annualRevenueInr),
      facilityAreaSqFt: parseDraftNumber(draft.facilityAreaSqFt),
    },
    scope1: {
      dgTrackingMethod: draft.dgTrackingMethod,
      dgFuelLiters: parseDraftNumber(draft.dgFuelLiters),
      dgRuntimeHours: parseDraftNumber(draft.dgRuntimeHours),
      dgCapacityKva: parseDraftNumber(draft.dgCapacityKva),
      naturalGasM3: parseDraftNumber(draft.naturalGasM3),
      coalTonnes: parseDraftNumber(draft.coalTonnes),
      fleetDieselLiters: parseDraftNumber(draft.fleetDieselLiters),
      fleetPetrolLiters: parseDraftNumber(draft.fleetPetrolLiters),
      refrigerantType: draft.refrigerantType || null,
      refrigerantRechargedKg: parseDraftNumber(draft.refrigerantRechargedKg),
    },
    scope2: {
      hasExactAnnualKwh: draft.hasExactAnnualKwh,
      annualGridKwh: parseDraftNumber(draft.annualGridKwh),
      annualElectricityBillInr: parseDraftNumber(draft.annualElectricityBillInr),
      onSiteSolarGeneratedKwh: parseDraftNumber(draft.onSiteSolarGeneratedKwh),
      greenTariffPercentage: parseDraftNumber(draft.greenTariffPercentage),
    },
    scope3: {
      isActivityBased: draft.tracksPhysicalMaterialWeights === "yes",
      steelPurchasedTonnes: parseDraftNumber(draft.steelPurchasedTonnes),
      cementPurchasedTonnes: parseDraftNumber(draft.cementPurchasedTonnes),
      plasticsPurchasedTonnes: parseDraftNumber(draft.plasticsPurchasedTonnes),
      totalProcurementSpendInr: parseDraftNumber(draft.totalProcurementSpendInr),
      logisticsSpendInr: parseDraftNumber(draft.logisticsSpendInr),
      waterConsumedKl: parseDraftNumber(draft.waterConsumedKl),
      waterSource: draft.waterSource || null,
      flightsDomestic: parseDraftNumber(draft.flightsDomestic),
      flightsInternational: parseDraftNumber(draft.flightsInternational),
      commuteSplit: {
        twoWheelers: parseDraftNumber(draft.commuteTwoWheelers),
        cars: parseDraftNumber(draft.commuteCars),
        publicTransit: parseDraftNumber(draft.commutePublicTransit),
        remoteWork: parseDraftNumber(draft.commuteRemoteWork),
      },
    },
  };
}

export default function EmissionsCalculatorWizard({
  userId,
}: EmissionsCalculatorWizardProps) {
  const draftKey = useMemo(
    () => `zerocarbon_emissions_draft_${userId}`,
    [userId],
  );
  const [draft, setDraft] = useState<EmissionsCalculatorDraft>(
    EMPTY_EMISSIONS_DRAFT,
  );
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lastSaved, setLastSaved] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);
  const [completionMessage, setCompletionMessage] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculationResult, setCalculationResult] =
    useState<EmissionsCalculationResult | null>(null);

  const currentStepSafe = Math.max(1, Math.min(STEP_FLOW.length, currentStep));
  const currentStepKey = STEP_FLOW[currentStepSafe - 1];
  const stepLabels = STEP_FLOW.map((step) => STEP_LABELS[step]);
  const commuteTotal = sumCommute(draft);

  const labelMaps = useMemo(() => {
    const buildMap = (options: Array<{ value: string; label: string }>) =>
      new Map(options.map((option) => [option.value, option.label]));

    return {
      industry: buildMap(INDUSTRY_SECTOR_OPTIONS),
      dgTracking: buildMap(DG_TRACKING_OPTIONS),
      yesNo: buildMap(YES_NO_OPTIONS),
      refrigerant: buildMap(REFRIGERANT_TYPE_OPTIONS),
      waterSource: buildMap(WATER_SOURCE_OPTIONS),
    };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) {
        setIsHydrated(true);
        return;
      }

      const parsed = JSON.parse(raw) as Partial<EmissionsCalculatorDraft>;
      const normalized = normalizeDraft(parsed);
      setDraft(normalized);
      setCurrentStep(asStep(normalized.current_step));
      setLastSaved(normalized.last_saved);
    } catch {
      setDraft(EMPTY_EMISSIONS_DRAFT);
      setCurrentStep(1);
    } finally {
      setIsHydrated(true);
    }
  }, [draftKey]);

  useEffect(() => {
    if (!isHydrated) return;

    const timeout = setTimeout(() => {
      const savedAt = new Date().toISOString();
      const payload: EmissionsCalculatorDraft = {
        ...draft,
        current_step: currentStepSafe,
        last_saved: savedAt,
      };
      localStorage.setItem(draftKey, JSON.stringify(payload));
      setLastSaved(savedAt);
    }, 500);

    return () => clearTimeout(timeout);
  }, [currentStepSafe, draft, draftKey, isHydrated]);

  const handleFieldChange = useCallback(
    <K extends keyof EmissionsCalculatorDraft>(
      key: K,
      value: EmissionsCalculatorDraft[K],
    ) => {
      setDraft((previous) => ({
        ...previous,
        [key]: value,
      }));

      setErrors((previous) => {
        if (!previous[key as string]) return previous;
        const next = { ...previous };
        delete next[key as string];
        return next;
      });
    },
    [],
  );

  const validateRequiredPositive = useCallback(
    (value: string, key: string, message: string, next: Record<string, string>) => {
      const parsed = parseNumber(value);
      if (parsed === null || parsed <= 0) {
        next[key] = message;
      }
    },
    [],
  );

  const validateOptionalNonNegative = useCallback(
    (value: string, key: string, message: string, next: Record<string, string>) => {
      if (!value.trim()) return;
      const parsed = parseNumber(value);
      if (parsed === null || parsed < 0) {
        next[key] = message;
      }
    },
    [],
  );

  const validateCorporateBaseline = useCallback(() => {
    const next: Record<string, string> = {};

    if (!draft.companyName.trim()) next.companyName = "Company name is required.";
    if (!draft.industrySector) next.industrySector = "Industry sector is required.";
    if (!draft.operatingState.trim()) next.operatingState = "Operating state is required.";

    validateRequiredPositive(
      draft.annualRevenueInr,
      "annualRevenueInr",
      "Annual revenue must be a positive number.",
      next,
    );
    validateOptionalNonNegative(
      draft.employeeCount,
      "employeeCount",
      "Employee count cannot be negative.",
      next,
    );
    validateOptionalNonNegative(
      draft.facilityAreaSqFt,
      "facilityAreaSqFt",
      "Facility area cannot be negative.",
      next,
    );

    return next;
  }, [draft, validateOptionalNonNegative, validateRequiredPositive]);

  const validateDirectOperations = useCallback(() => {
    const next: Record<string, string> = {};

    if (!draft.dgTrackingMethod) {
      next.dgTrackingMethod = "Please select generator tracking method.";
    } else if (draft.dgTrackingMethod === "fuel_logs") {
      validateRequiredPositive(
        draft.dgFuelLiters,
        "dgFuelLiters",
        "Diesel fuel liters must be a positive number.",
        next,
      );
    } else if (draft.dgTrackingMethod === "runtime_logs") {
      validateRequiredPositive(
        draft.dgRuntimeHours,
        "dgRuntimeHours",
        "Runtime hours must be a positive number.",
        next,
      );
      validateRequiredPositive(
        draft.dgCapacityKva,
        "dgCapacityKva",
        "Generator capacity must be a positive number.",
        next,
      );
    }

    validateOptionalNonNegative(
      draft.naturalGasM3,
      "naturalGasM3",
      "Natural gas volume cannot be negative.",
      next,
    );
    validateOptionalNonNegative(
      draft.coalTonnes,
      "coalTonnes",
      "Coal quantity cannot be negative.",
      next,
    );
    validateOptionalNonNegative(
      draft.fleetDieselLiters,
      "fleetDieselLiters",
      "Fleet diesel liters cannot be negative.",
      next,
    );
    validateOptionalNonNegative(
      draft.fleetPetrolLiters,
      "fleetPetrolLiters",
      "Fleet petrol liters cannot be negative.",
      next,
    );

    if (draft.refrigerantType && !draft.refrigerantRechargedKg.trim()) {
      next.refrigerantRechargedKg =
        "Recharged quantity is required when refrigerant type is selected.";
    }
    if (!draft.refrigerantType && draft.refrigerantRechargedKg.trim()) {
      next.refrigerantType = "Please select refrigerant type.";
    }
    if (draft.refrigerantRechargedKg.trim()) {
      validateRequiredPositive(
        draft.refrigerantRechargedKg,
        "refrigerantRechargedKg",
        "Recharged refrigerant must be a positive number.",
        next,
      );
    }

    return next;
  }, [draft, validateOptionalNonNegative, validateRequiredPositive]);

  const validatePurchasedEnergy = useCallback(() => {
    const next: Record<string, string> = {};

    if (!draft.hasExactAnnualKwh) {
      next.hasExactAnnualKwh = "Please select Yes or No.";
    } else if (draft.hasExactAnnualKwh === "yes") {
      validateRequiredPositive(
        draft.annualGridKwh,
        "annualGridKwh",
        "Annual grid kWh must be a positive number.",
        next,
      );
    } else if (draft.hasExactAnnualKwh === "no") {
      validateRequiredPositive(
        draft.annualElectricityBillInr,
        "annualElectricityBillInr",
        "Annual electricity bill must be a positive number.",
        next,
      );
    }

    validateOptionalNonNegative(
      draft.onSiteSolarGeneratedKwh,
      "onSiteSolarGeneratedKwh",
      "On-site solar generation cannot be negative.",
      next,
    );

    if (draft.greenTariffPercentage.trim()) {
      const parsed = parseNumber(draft.greenTariffPercentage);
      if (parsed === null || parsed < 0 || parsed > 100) {
        next.greenTariffPercentage =
          "Green tariff percentage must be between 0 and 100.";
      }
    }

    return next;
  }, [draft, validateOptionalNonNegative, validateRequiredPositive]);

  const validateValueChain = useCallback(() => {
    const next: Record<string, string> = {};

    validateOptionalNonNegative(
      draft.flightsDomestic,
      "flightsDomestic",
      "Domestic flights cannot be negative.",
      next,
    );
    validateOptionalNonNegative(
      draft.flightsInternational,
      "flightsInternational",
      "International flights cannot be negative.",
      next,
    );

    const commuteValues = COMMUTE_FIELDS.map((field) => parseNumber(draft[field.key]));
    const invalidCommute = commuteValues.some(
      (value) => value === null || value < 0 || value > 100,
    );
    if (invalidCommute) {
      next.commuteSplit = "Each commute split must be between 0 and 100.";
    } else if (commuteTotal !== 100) {
      next.commuteSplit = "Commute split must total exactly 100%.";
    }

    if (!draft.tracksPhysicalMaterialWeights) {
      next.tracksPhysicalMaterialWeights = "Please select Yes or No.";
    } else if (draft.tracksPhysicalMaterialWeights === "yes") {
      validateRequiredPositive(
        draft.steelPurchasedTonnes,
        "steelPurchasedTonnes",
        "Steel purchased must be a positive number.",
        next,
      );
      validateRequiredPositive(
        draft.cementPurchasedTonnes,
        "cementPurchasedTonnes",
        "Cement purchased must be a positive number.",
        next,
      );
      validateRequiredPositive(
        draft.plasticsPurchasedTonnes,
        "plasticsPurchasedTonnes",
        "Plastics purchased must be a positive number.",
        next,
      );
    } else {
      validateRequiredPositive(
        draft.totalProcurementSpendInr,
        "totalProcurementSpendInr",
        "Total procurement spend must be a positive number.",
        next,
      );
    }

    validateOptionalNonNegative(
      draft.logisticsSpendInr,
      "logisticsSpendInr",
      "Logistics spend cannot be negative.",
      next,
    );
    validateOptionalNonNegative(
      draft.waterConsumedKl,
      "waterConsumedKl",
      "Water consumed cannot be negative.",
      next,
    );

    const waterConsumed = parseNumber(draft.waterConsumedKl);
    if (waterConsumed !== null && waterConsumed > 0 && !draft.waterSource) {
      next.waterSource = "Please select water source.";
    }
    if (draft.waterSource && (waterConsumed === null || waterConsumed <= 0)) {
      next.waterConsumedKl =
        "Water consumed must be a positive number when source is selected.";
    }

    return next;
  }, [
    commuteTotal,
    draft,
    validateOptionalNonNegative,
    validateRequiredPositive,
  ]);

  const validateStep = useCallback(
    (step: StepKey): Record<string, string> => {
      if (step === "corporate_baseline") return validateCorporateBaseline();
      if (step === "direct_operations") return validateDirectOperations();
      if (step === "purchased_energy") return validatePurchasedEnergy();
      if (step === "value_chain") return validateValueChain();

      return {
        ...validateCorporateBaseline(),
        ...validateDirectOperations(),
        ...validatePurchasedEnergy(),
        ...validateValueChain(),
      };
    },
    [
      validateCorporateBaseline,
      validateDirectOperations,
      validatePurchasedEnergy,
      validateValueChain,
    ],
  );

  const scrollToFirstError = useCallback((nextErrors: Record<string, string>) => {
    const firstKey = Object.keys(nextErrors)[0];
    if (!firstKey) return;
    const element =
      document.getElementById(firstKey) ??
      document.querySelector(`[name='${firstKey}']`);
    if (element instanceof HTMLElement) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.focus();
    }
  }, []);

  const goNext = useCallback(() => {
    const nextErrors = validateStep(currentStepKey);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      scrollToFirstError(nextErrors);
      return;
    }
    setErrors({});
    setCurrentStep((previous) => Math.min(STEP_FLOW.length, previous + 1));
  }, [currentStepKey, scrollToFirstError, validateStep]);

  const goBack = useCallback(() => {
    setErrors({});
    setCurrentStep((previous) => Math.max(1, previous - 1));
  }, []);

  const handleFinish = useCallback(() => {
    const submit = async () => {
      const nextErrors = validateStep("review_finish");
      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors);
        if (
          nextErrors.companyName ||
          nextErrors.industrySector ||
          nextErrors.operatingState ||
          nextErrors.annualRevenueInr
        ) {
          setCurrentStep(1);
        } else if (
          nextErrors.dgTrackingMethod ||
          nextErrors.dgFuelLiters ||
          nextErrors.dgRuntimeHours ||
          nextErrors.dgCapacityKva
        ) {
          setCurrentStep(2);
        } else if (
          nextErrors.hasExactAnnualKwh ||
          nextErrors.annualGridKwh ||
          nextErrors.annualElectricityBillInr
        ) {
          setCurrentStep(3);
        } else {
          setCurrentStep(4);
        }
        scrollToFirstError(nextErrors);
        return;
      }

      setErrors({});
      setCompletionMessage("");
      setCalculationResult(null);
      setIsCalculating(true);

      const savedAt = new Date().toISOString();
      const localPayload: EmissionsCalculatorDraft = {
        ...draft,
        current_step: currentStepSafe,
        last_saved: savedAt,
      };
      localStorage.setItem(draftKey, JSON.stringify(localPayload));
      setLastSaved(savedAt);

      try {
        const response = await fetch("/api/emissions/calculate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildCalculatePayload(draft)),
        });

        const raw = (await response.json().catch(() => null)) as
          | Record<string, unknown>
          | null;

        if (!response.ok) {
          const failureStage =
            typeof raw?.failure_stage === "string"
              ? raw.failure_stage
              : "unknown_failure_stage";
          const errorText =
            typeof raw?.error === "string"
              ? raw.error
              : `Calculation failed with status ${response.status}.`;
          const failedResult: EmissionsCalculationFailure = {
            kind: "failure",
            assessmentId:
              typeof raw?.assessment_id === "string" ? raw.assessment_id : null,
            auditStatus:
              typeof raw?.audit_status === "string" ? raw.audit_status : "FAILED",
            failureStage,
            error: errorText,
          };
          setCalculationResult(failedResult);
          setCompletionMessage("");
          toast.error(errorText);
          return;
        }

        const emissions =
          raw && typeof raw.emissions === "object" && raw.emissions
            ? (raw.emissions as Record<string, unknown>)
            : null;

        const successResult: EmissionsCalculationSuccess = {
          kind: "success",
          assessmentId:
            typeof raw?.assessment_id === "string" ? raw.assessment_id : "",
          auditStatus:
            typeof raw?.audit_status === "string"
              ? raw.audit_status
              : "SUCCESS_ZERO_TRUST_VERIFIED",
          resultMode:
            raw?.result_mode === "partial" ? "partial" : "full",
          partialReason:
            typeof raw?.partial_reason === "string" ? raw.partial_reason : null,
          emissions: {
            scope1:
              typeof emissions?.scope_1_tco2e === "number"
                ? emissions.scope_1_tco2e
                : 0,
            scope2:
              typeof emissions?.scope_2_tco2e === "number"
                ? emissions.scope_2_tco2e
                : 0,
            scope3:
              typeof emissions?.scope_3_tco2e === "number"
                ? emissions.scope_3_tco2e
                : null,
            total:
              typeof emissions?.total_corporate_tco2e === "number"
                ? emissions.total_corporate_tco2e
                : 0,
          },
        };

        setCalculationResult(successResult);
        if (successResult.resultMode === "partial") {
          setCompletionMessage(
            "Emissions calculated partially. Scope 3 spend is unavailable with your current Climatiq plan.",
          );
          toast.warning(
            "Partial result: Scope 1+2 calculated, Scope 3 spend unavailable.",
          );
        } else {
          setCompletionMessage("Corporate emissions calculated and stored successfully.");
          toast.success("Corporate emissions calculated successfully.");
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unexpected error while calculating emissions.";
        const failedResult: EmissionsCalculationFailure = {
          kind: "failure",
          assessmentId: null,
          auditStatus: "FAILED",
          failureStage: "network_or_client",
          error: message,
        };
        setCalculationResult(failedResult);
        setCompletionMessage("");
        toast.error(message);
      } finally {
        setIsCalculating(false);
      }
    };

    void submit();
  }, [currentStepSafe, draft, draftKey, scrollToFirstError, validateStep]);

  const saveDraftNow = useCallback(() => {
    const savedAt = new Date().toISOString();
    const payload: EmissionsCalculatorDraft = {
      ...draft,
      current_step: currentStepSafe,
      last_saved: savedAt,
    };
    localStorage.setItem(draftKey, JSON.stringify(payload));
    setLastSaved(savedAt);
    toast.success("Draft saved locally.");
  }, [currentStepSafe, draft, draftKey]);

  const errorText = (key: string) =>
    errors[key] ? <p className="mt-1 text-xs text-red-500">{errors[key]}</p> : null;

  const reviewLabel = (map: Map<string, string>, key: string) =>
    key ? map.get(key) ?? "-" : "-";

  const renderCorporateBaseline = () => (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor="companyName" className="mb-1 block text-sm font-medium text-gray-700">
            Company Name
          </label>
          <input
            id="companyName"
            value={draft.companyName}
            onChange={(event) => handleFieldChange("companyName", event.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {errorText("companyName")}
        </div>

        <div>
          <label htmlFor="industrySector" className="mb-1 block text-sm font-medium text-gray-700">
            Industry Sector
          </label>
          <select
            id="industrySector"
            value={draft.industrySector}
            onChange={(event) =>
              handleFieldChange(
                "industrySector",
                event.target.value as EmissionsCalculatorDraft["industrySector"],
              )
            }
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Select industry sector</option>
            {INDUSTRY_SECTOR_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errorText("industrySector")}
        </div>

        <div>
          <label htmlFor="operatingState" className="mb-1 block text-sm font-medium text-gray-700">
            Operating State
          </label>
          <select
            id="operatingState"
            value={draft.operatingState}
            onChange={(event) => handleFieldChange("operatingState", event.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Select state</option>
            {INDIA_STATES_AND_UTS.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
          {errorText("operatingState")}
        </div>

        <div>
          <label htmlFor="employeeCount" className="mb-1 block text-sm font-medium text-gray-700">
            Employee Count (Optional)
          </label>
          <input
            id="employeeCount"
            type="number"
            min="0"
            step="1"
            value={draft.employeeCount}
            onChange={(event) => handleFieldChange("employeeCount", event.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {errorText("employeeCount")}
        </div>

        <div>
          <label htmlFor="annualRevenueInr" className="mb-1 block text-sm font-medium text-gray-700">
            Annual Revenue (INR)
          </label>
          <input
            id="annualRevenueInr"
            type="number"
            min="0"
            step="any"
            value={draft.annualRevenueInr}
            onChange={(event) => handleFieldChange("annualRevenueInr", event.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {errorText("annualRevenueInr")}
        </div>

        <div>
          <label htmlFor="facilityAreaSqFt" className="mb-1 block text-sm font-medium text-gray-700">
            Facility Area (Sq Ft, Optional)
          </label>
          <input
            id="facilityAreaSqFt"
            type="number"
            min="0"
            step="any"
            value={draft.facilityAreaSqFt}
            onChange={(event) => handleFieldChange("facilityAreaSqFt", event.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {errorText("facilityAreaSqFt")}
        </div>
      </div>
    </section>
  );

  const renderDirectOperations = () => (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="space-y-5">
        <div>
          <label htmlFor="dgTrackingMethod" className="mb-1 block text-sm font-medium text-gray-700">
            How do you track generator usage?
          </label>
          <select
            id="dgTrackingMethod"
            value={draft.dgTrackingMethod}
            onChange={(event) =>
              handleFieldChange(
                "dgTrackingMethod",
                event.target.value as EmissionsCalculatorDraft["dgTrackingMethod"],
              )
            }
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Select tracking method</option>
            {DG_TRACKING_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errorText("dgTrackingMethod")}
        </div>

        {draft.dgTrackingMethod === "fuel_logs" ? (
          <div>
            <label htmlFor="dgFuelLiters" className="mb-1 block text-sm font-medium text-gray-700">
              DG Fuel Usage (Liters)
            </label>
            <input id="dgFuelLiters" type="number" min="0" step="any" value={draft.dgFuelLiters} onChange={(event) => handleFieldChange("dgFuelLiters", event.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500" />
            {errorText("dgFuelLiters")}
          </div>
        ) : null}

        {draft.dgTrackingMethod === "runtime_logs" ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="dgRuntimeHours" className="mb-1 block text-sm font-medium text-gray-700">DG Runtime Hours</label>
              <input id="dgRuntimeHours" type="number" min="0" step="any" value={draft.dgRuntimeHours} onChange={(event) => handleFieldChange("dgRuntimeHours", event.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500" />
              {errorText("dgRuntimeHours")}
            </div>
            <div>
              <label htmlFor="dgCapacityKva" className="mb-1 block text-sm font-medium text-gray-700">DG Capacity (kVA)</label>
              <input id="dgCapacityKva" type="number" min="0" step="any" value={draft.dgCapacityKva} onChange={(event) => handleFieldChange("dgCapacityKva", event.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500" />
              {errorText("dgCapacityKva")}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="naturalGasM3" className="mb-1 block text-sm font-medium text-gray-700">Natural Gas (m3)</label>
            <input id="naturalGasM3" type="number" min="0" step="any" value={draft.naturalGasM3} onChange={(event) => handleFieldChange("naturalGasM3", event.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500" />
            {errorText("naturalGasM3")}
          </div>
          <div>
            <label htmlFor="coalTonnes" className="mb-1 block text-sm font-medium text-gray-700">Coal (Tonnes)</label>
            <input id="coalTonnes" type="number" min="0" step="any" value={draft.coalTonnes} onChange={(event) => handleFieldChange("coalTonnes", event.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500" />
            {errorText("coalTonnes")}
          </div>
          <div>
            <label htmlFor="fleetDieselLiters" className="mb-1 block text-sm font-medium text-gray-700">Fleet Diesel (Liters)</label>
            <input id="fleetDieselLiters" type="number" min="0" step="any" value={draft.fleetDieselLiters} onChange={(event) => handleFieldChange("fleetDieselLiters", event.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500" />
            {errorText("fleetDieselLiters")}
          </div>
          <div>
            <label htmlFor="fleetPetrolLiters" className="mb-1 block text-sm font-medium text-gray-700">Fleet Petrol (Liters)</label>
            <input id="fleetPetrolLiters" type="number" min="0" step="any" value={draft.fleetPetrolLiters} onChange={(event) => handleFieldChange("fleetPetrolLiters", event.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500" />
            {errorText("fleetPetrolLiters")}
          </div>
          <div>
            <label htmlFor="refrigerantType" className="mb-1 block text-sm font-medium text-gray-700">Refrigerant Type</label>
            <select id="refrigerantType" value={draft.refrigerantType} onChange={(event) => handleFieldChange("refrigerantType", event.target.value as EmissionsCalculatorDraft["refrigerantType"])} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="">Select refrigerant type</option>
              {REFRIGERANT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errorText("refrigerantType")}
          </div>
          <div>
            <label htmlFor="refrigerantRechargedKg" className="mb-1 block text-sm font-medium text-gray-700">Refrigerant Recharged (Kg)</label>
            <input id="refrigerantRechargedKg" type="number" min="0" step="any" value={draft.refrigerantRechargedKg} onChange={(event) => handleFieldChange("refrigerantRechargedKg", event.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500" />
            {errorText("refrigerantRechargedKg")}
          </div>
        </div>
      </div>
    </section>
  );

  const renderPurchasedEnergy = () => (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="space-y-5">
        <div>
          <label htmlFor="hasExactAnnualKwh" className="mb-1 block text-sm font-medium text-gray-700">Do you have your exact annual kWh consumption?</label>
          <select id="hasExactAnnualKwh" value={draft.hasExactAnnualKwh} onChange={(event) => handleFieldChange("hasExactAnnualKwh", event.target.value as EmissionsCalculatorDraft["hasExactAnnualKwh"])} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500">
            <option value="">Select option</option>
            {YES_NO_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errorText("hasExactAnnualKwh")}
        </div>

        {draft.hasExactAnnualKwh === "yes" ? (
          <div>
            <label htmlFor="annualGridKwh" className="mb-1 block text-sm font-medium text-gray-700">Annual Grid Electricity (kWh)</label>
            <input id="annualGridKwh" type="number" min="0" step="any" value={draft.annualGridKwh} onChange={(event) => handleFieldChange("annualGridKwh", event.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500" />
            {errorText("annualGridKwh")}
          </div>
        ) : null}

        {draft.hasExactAnnualKwh === "no" ? (
          <div>
            <label htmlFor="annualElectricityBillInr" className="mb-1 block text-sm font-medium text-gray-700">Annual Electricity Bill (INR)</label>
            <input id="annualElectricityBillInr" type="number" min="0" step="any" value={draft.annualElectricityBillInr} onChange={(event) => handleFieldChange("annualElectricityBillInr", event.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500" />
            {errorText("annualElectricityBillInr")}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="onSiteSolarGeneratedKwh" className="mb-1 block text-sm font-medium text-gray-700">On-site Solar Generated (kWh)</label>
            <input id="onSiteSolarGeneratedKwh" type="number" min="0" step="any" value={draft.onSiteSolarGeneratedKwh} onChange={(event) => handleFieldChange("onSiteSolarGeneratedKwh", event.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500" />
            {errorText("onSiteSolarGeneratedKwh")}
          </div>
          <div>
            <label htmlFor="greenTariffPercentage" className="mb-1 block text-sm font-medium text-gray-700">Green Tariff Percentage (0-100)</label>
            <input id="greenTariffPercentage" type="number" min="0" max="100" step="any" value={draft.greenTariffPercentage} onChange={(event) => handleFieldChange("greenTariffPercentage", event.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500" />
            {errorText("greenTariffPercentage")}
          </div>
        </div>
      </div>
    </section>
  );

  const renderValueChain = () => (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="flightsDomestic" className="mb-1 block text-sm font-medium text-gray-700">Domestic Flights (Round Trips)</label>
            <input id="flightsDomestic" type="number" min="0" step="1" value={draft.flightsDomestic} onChange={(event) => handleFieldChange("flightsDomestic", event.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500" />
            {errorText("flightsDomestic")}
          </div>
          <div>
            <label htmlFor="flightsInternational" className="mb-1 block text-sm font-medium text-gray-700">International Flights (Round Trips)</label>
            <input id="flightsInternational" type="number" min="0" step="1" value={draft.flightsInternational} onChange={(event) => handleFieldChange("flightsInternational", event.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500" />
            {errorText("flightsInternational")}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Commute Split</h3>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${commuteTotal === 100 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
              Total: {commuteTotal}%
            </span>
          </div>
          {COMMUTE_FIELDS.map((field) => (
            <div key={field.key}>
              <div className="mb-1 flex items-center justify-between text-sm text-gray-700">
                <label htmlFor={field.key}>{field.label}</label>
                <span>{draft[field.key]}%</span>
              </div>
              <input id={field.key} type="range" min="0" max="100" step="1" value={draft[field.key]} onChange={(event) => handleFieldChange(field.key, event.target.value)} className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200" />
            </div>
          ))}
          {errorText("commuteSplit")}
        </div>

        <div>
          <label htmlFor="tracksPhysicalMaterialWeights" className="mb-1 block text-sm font-medium text-gray-700">Do you track physical material weights?</label>
          <select id="tracksPhysicalMaterialWeights" value={draft.tracksPhysicalMaterialWeights} onChange={(event) => handleFieldChange("tracksPhysicalMaterialWeights", event.target.value as EmissionsCalculatorDraft["tracksPhysicalMaterialWeights"])} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500">
            <option value="">Select option</option>
            {YES_NO_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errorText("tracksPhysicalMaterialWeights")}
        </div>

        {draft.tracksPhysicalMaterialWeights === "yes" ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label htmlFor="steelPurchasedTonnes" className="mb-1 block text-sm font-medium text-gray-700">Steel Purchased (Tonnes)</label>
              <input id="steelPurchasedTonnes" type="number" min="0" step="any" value={draft.steelPurchasedTonnes} onChange={(event) => handleFieldChange("steelPurchasedTonnes", event.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500" />
              {errorText("steelPurchasedTonnes")}
            </div>
            <div>
              <label htmlFor="cementPurchasedTonnes" className="mb-1 block text-sm font-medium text-gray-700">Cement Purchased (Tonnes)</label>
              <input id="cementPurchasedTonnes" type="number" min="0" step="any" value={draft.cementPurchasedTonnes} onChange={(event) => handleFieldChange("cementPurchasedTonnes", event.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500" />
              {errorText("cementPurchasedTonnes")}
            </div>
            <div>
              <label htmlFor="plasticsPurchasedTonnes" className="mb-1 block text-sm font-medium text-gray-700">Plastics Purchased (Tonnes)</label>
              <input id="plasticsPurchasedTonnes" type="number" min="0" step="any" value={draft.plasticsPurchasedTonnes} onChange={(event) => handleFieldChange("plasticsPurchasedTonnes", event.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500" />
              {errorText("plasticsPurchasedTonnes")}
            </div>
          </div>
        ) : null}

        {draft.tracksPhysicalMaterialWeights === "no" ? (
          <div>
            <label htmlFor="totalProcurementSpendInr" className="mb-1 block text-sm font-medium text-gray-700">Total Procurement Spend (INR)</label>
            <input id="totalProcurementSpendInr" type="number" min="0" step="any" value={draft.totalProcurementSpendInr} onChange={(event) => handleFieldChange("totalProcurementSpendInr", event.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500" />
            {errorText("totalProcurementSpendInr")}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="logisticsSpendInr" className="mb-1 block text-sm font-medium text-gray-700">Logistics Spend (INR)</label>
            <input id="logisticsSpendInr" type="number" min="0" step="any" value={draft.logisticsSpendInr} onChange={(event) => handleFieldChange("logisticsSpendInr", event.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500" />
            {errorText("logisticsSpendInr")}
          </div>
          <div>
            <label htmlFor="waterConsumedKl" className="mb-1 block text-sm font-medium text-gray-700">Water Consumed (kL)</label>
            <input id="waterConsumedKl" type="number" min="0" step="any" value={draft.waterConsumedKl} onChange={(event) => handleFieldChange("waterConsumedKl", event.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500" />
            {errorText("waterConsumedKl")}
          </div>
          <div>
            <label htmlFor="waterSource" className="mb-1 block text-sm font-medium text-gray-700">Water Source</label>
            <select id="waterSource" value={draft.waterSource} onChange={(event) => handleFieldChange("waterSource", event.target.value as EmissionsCalculatorDraft["waterSource"])} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="">Select water source</option>
              {WATER_SOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errorText("waterSource")}
          </div>
        </div>
      </div>
    </section>
  );

  const renderReview = () => (
    <section className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <h3 className="text-base font-semibold text-gray-900">Review Emissions Inputs</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-gray-200 p-4">
          <h4 className="text-sm font-semibold text-gray-900">Corporate Baseline</h4>
          <p className="mt-2 text-sm text-gray-700">Company: {draft.companyName || "-"}</p>
          <p className="text-sm text-gray-700">Industry: {reviewLabel(labelMaps.industry, draft.industrySector || "")}</p>
          <p className="text-sm text-gray-700">State: {draft.operatingState || "-"}</p>
          <p className="text-sm text-gray-700">Revenue: INR {formatNumericText(draft.annualRevenueInr)}</p>
        </article>
        <article className="rounded-xl border border-gray-200 p-4">
          <h4 className="text-sm font-semibold text-gray-900">Direct Operations</h4>
          <p className="mt-2 text-sm text-gray-700">DG Tracking: {reviewLabel(labelMaps.dgTracking, draft.dgTrackingMethod || "")}</p>
          <p className="text-sm text-gray-700">Natural Gas (m3): {formatNumericText(draft.naturalGasM3)}</p>
          <p className="text-sm text-gray-700">Coal (Tonnes): {formatNumericText(draft.coalTonnes)}</p>
          <p className="text-sm text-gray-700">Refrigerant: {reviewLabel(labelMaps.refrigerant, draft.refrigerantType || "")}</p>
        </article>
        <article className="rounded-xl border border-gray-200 p-4">
          <h4 className="text-sm font-semibold text-gray-900">Purchased Energy</h4>
          <p className="mt-2 text-sm text-gray-700">Exact kWh: {reviewLabel(labelMaps.yesNo, draft.hasExactAnnualKwh || "")}</p>
          <p className="text-sm text-gray-700">Grid kWh: {formatNumericText(draft.annualGridKwh)}</p>
          <p className="text-sm text-gray-700">Bill (INR): {formatNumericText(draft.annualElectricityBillInr)}</p>
          <p className="text-sm text-gray-700">Green Tariff: {draft.greenTariffPercentage ? `${formatNumericText(draft.greenTariffPercentage)}%` : "-"}</p>
        </article>
        <article className="rounded-xl border border-gray-200 p-4">
          <h4 className="text-sm font-semibold text-gray-900">Value Chain</h4>
          <p className="mt-2 text-sm text-gray-700">Commute Total: {commuteTotal}%</p>
          <p className="text-sm text-gray-700">Physical Weights Tracked: {reviewLabel(labelMaps.yesNo, draft.tracksPhysicalMaterialWeights || "")}</p>
          <p className="text-sm text-gray-700">Procurement Spend: INR {formatNumericText(draft.totalProcurementSpendInr)}</p>
          <p className="text-sm text-gray-700">Water Source: {reviewLabel(labelMaps.waterSource, draft.waterSource || "")}</p>
        </article>
      </div>
      <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
        Finish runs a server-side emissions calculation and stores a versioned run history.
      </p>
    </section>
  );

  const renderedStep = () => {
    if (currentStepKey === "corporate_baseline") return renderCorporateBaseline();
    if (currentStepKey === "direct_operations") return renderDirectOperations();
    if (currentStepKey === "purchased_energy") return renderPurchasedEnergy();
    if (currentStepKey === "value_chain") return renderValueChain();
    return renderReview();
  };

  if (!isHydrated) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
        <p className="text-sm text-gray-600">Loading emissions draft...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FormProgress
        currentStep={currentStepSafe}
        totalSteps={STEP_FLOW.length}
        stepLabels={stepLabels}
      />

      {lastSaved ? (
        <p className="text-right text-xs text-gray-500">
          Draft saved {formatSavedTime(lastSaved)}
        </p>
      ) : null}

      {completionMessage ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {completionMessage}
        </div>
      ) : null}

      {isCalculating ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Calculating emissions now. Please wait...
        </div>
      ) : null}

      {calculationResult && calculationResult.kind === "success" ? (
        <section className="rounded-2xl border border-green-200 bg-white p-6 shadow-sm ring-1 ring-green-100">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-gray-900">Latest Emissions Result</h3>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${calculationResult.resultMode === "partial" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
              {calculationResult.auditStatus}
            </span>
          </div>
          {calculationResult.resultMode === "partial" ? (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Scope 3 spend unavailable (Climatiq plan limit). Scope 1 and Scope 2 are calculated.
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-gray-200 p-3">
              <p className="text-xs font-medium text-gray-500">Scope 1 (tCO2e)</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">
                {calculationResult.emissions.scope1.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 p-3">
              <p className="text-xs font-medium text-gray-500">Scope 2 (tCO2e)</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">
                {calculationResult.emissions.scope2.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 p-3">
              <p className="text-xs font-medium text-gray-500">Scope 3 (tCO2e)</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">
                {calculationResult.emissions.scope3 === null
                  ? "Unavailable"
                  : calculationResult.emissions.scope3.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
              </p>
            </div>
            <div className="rounded-xl border border-green-200 bg-green-50 p-3">
              <p className="text-xs font-medium text-green-700">Total (tCO2e)</p>
              <p className="mt-1 text-lg font-semibold text-green-800">
                {calculationResult.emissions.total.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>
          {calculationResult.assessmentId ? (
            <p className="mt-3 text-xs text-gray-500">
              Assessment ID: {calculationResult.assessmentId}
            </p>
          ) : null}
        </section>
      ) : null}

      {calculationResult && calculationResult.kind === "failure" ? (
        <section className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm ring-1 ring-red-100">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-gray-900">Calculation Failed</h3>
            <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
              {calculationResult.auditStatus}
            </span>
          </div>
          <p className="text-sm text-red-700">{calculationResult.error}</p>
          {calculationResult.failureStage ? (
            <p className="mt-2 text-xs text-gray-500">
              Failure stage: {calculationResult.failureStage}
            </p>
          ) : null}
        </section>
      ) : null}

      {renderedStep()}

      <div className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="flex items-center gap-2">
          <button type="button" onClick={saveDraftNow} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Save Draft</button>
          <button type="button" onClick={goBack} disabled={currentStepSafe === 1 || isCalculating} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">Back</button>
        </div>

        {currentStepSafe < STEP_FLOW.length ? (
          <button type="button" onClick={goNext} disabled={isCalculating} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-70">Next</button>
        ) : (
          <button type="button" onClick={handleFinish} disabled={isCalculating} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-70">{isCalculating ? "Calculating..." : "Finish"}</button>
        )}
      </div>
    </div>
  );
}
