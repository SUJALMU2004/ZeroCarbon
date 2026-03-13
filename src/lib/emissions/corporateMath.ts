export const DG_RUNTIME_BURN_RATE_MULTIPLIER = 0.2;
export const ELECTRICITY_TARIFF_INR_PER_KWH = 8.5;
export const GRAMS_PER_METRIC_TONNE = 1_000_000;

export function roundToTwo(value: number): number {
  return Number(value.toFixed(2));
}

export function estimateDieselLitersFromRuntime(
  dgRuntimeHours: number,
  dgCapacityKva: number,
): number {
  return dgRuntimeHours * (dgCapacityKva * DG_RUNTIME_BURN_RATE_MULTIPLIER);
}

export function resolveTotalGridKwh(params: {
  annualGridKwh: number | null;
  annualElectricityBillInr: number | null;
}): number {
  if (params.annualGridKwh !== null && params.annualGridKwh > 0) {
    return params.annualGridKwh;
  }

  if (
    params.annualElectricityBillInr !== null &&
    params.annualElectricityBillInr > 0
  ) {
    return params.annualElectricityBillInr / ELECTRICITY_TARIFF_INR_PER_KWH;
  }

  return 0;
}

export function computeNetGridKwh(params: {
  totalKwh: number;
  onSiteSolarGeneratedKwh: number;
}): number {
  return Math.max(0, params.totalKwh - params.onSiteSolarGeneratedKwh);
}

export function convertGridGramsToTonnes(params: {
  netGridKwh: number;
  gridIntensityGramsPerKwh: number;
}): number {
  return (
    (params.netGridKwh * params.gridIntensityGramsPerKwh) / GRAMS_PER_METRIC_TONNE
  );
}
