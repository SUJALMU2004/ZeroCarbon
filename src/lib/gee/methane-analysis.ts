import "server-only";

import { getGeeAccessToken } from "@/lib/gee/auth";
import { composeMethaneFlareConfidence } from "@/lib/valuation/methaneValuationMath";

type GeeExpression = Record<string, unknown>;

export interface MethaneSatelliteConfidenceResult {
  flare_active_confidence: number;
  viirs_score: number | null;
  plume_drop_score: number;
  viirs_current_mean_frp: number | null;
  viirs_bypassed: boolean;
  s5p_current_mean_ch4: number;
  s5p_baseline_mean_ch4: number;
  raw_response: Record<string, unknown>;
}

const GEE_BASE_URL = "https://earthengine.googleapis.com/v1";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getProjectId(): string {
  const projectId = process.env.GEE_PROJECT_ID?.trim();
  if (!projectId) {
    throw new Error("Missing GEE_PROJECT_ID");
  }
  return projectId;
}

function getNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function getWindowDaysCurrent(): number {
  return Math.max(1, Math.floor(getNumberEnv("GEE_METHANE_WINDOW_DAYS_CURRENT", 90)));
}

function getWindowDaysBaseline(): number {
  return Math.max(1, Math.floor(getNumberEnv("GEE_METHANE_WINDOW_DAYS_BASELINE", 90)));
}

function getViirsDataset(): string {
  return process.env.GEE_METHANE_VIIRS_DATASET?.trim() || "NOAA/VIIRS/001/VNP14A1";
}

function getViirsBand(): string {
  return process.env.GEE_METHANE_VIIRS_BAND?.trim() || "MaxFRP";
}

function getViirsScaleMeters(): number {
  return Math.max(30, getNumberEnv("GEE_METHANE_VIIRS_SCALE_METERS", 375));
}

function getViirsFrpCap(): number {
  return Math.max(1, getNumberEnv("GEE_METHANE_VIIRS_FRP_CAP", 100));
}

function getS5pDataset(): string {
  return process.env.GEE_METHANE_S5P_DATASET?.trim() || "COPERNICUS/S5P/OFFL/L3_CH4";
}

function getS5pBand(): string {
  return (
    process.env.GEE_METHANE_S5P_BAND?.trim() ||
    "CH4_column_volume_mixing_ratio_dry_air"
  );
}

function getS5pScaleMeters(): number {
  return Math.max(100, getNumberEnv("GEE_METHANE_S5P_SCALE_METERS", 1000));
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function getDateWindows() {
  const currentDays = getWindowDaysCurrent();
  const baselineDays = getWindowDaysBaseline();
  const now = new Date();

  const currentStart = new Date(now);
  currentStart.setUTCDate(currentStart.getUTCDate() - currentDays);

  const baselineEnd = new Date(currentStart);
  baselineEnd.setUTCDate(baselineEnd.getUTCDate() - 1);

  const baselineStart = new Date(baselineEnd);
  baselineStart.setUTCDate(baselineStart.getUTCDate() - baselineDays);

  return {
    current: {
      startIso: `${toIsoDate(currentStart)}T00:00:00Z`,
      endIso: `${toIsoDate(now)}T23:59:59Z`,
      days: currentDays,
    },
    baseline: {
      startIso: `${toIsoDate(baselineStart)}T00:00:00Z`,
      endIso: `${toIsoDate(baselineEnd)}T23:59:59Z`,
      days: baselineDays,
    },
  };
}

function buildPointExpression(latitude: number, longitude: number): Record<string, unknown> {
  return {
    functionInvocationValue: {
      functionName: "GeometryConstructors.Point",
      arguments: {
        coordinates: {
          arrayValue: {
            values: [{ constantValue: longitude }, { constantValue: latitude }],
          },
        },
      },
    },
  };
}

function buildBufferedGeometry(
  latitude: number,
  longitude: number,
  radiusMeters: number,
): Record<string, unknown> {
  return {
    functionInvocationValue: {
      functionName: "Geometry.buffer",
      arguments: {
        geometry: buildPointExpression(latitude, longitude),
        distance: { constantValue: radiusMeters },
      },
    },
  };
}

function buildCollectionBandMeanExpression(params: {
  geometry: Record<string, unknown>;
  dataset: string;
  band: string;
  startIso: string;
  endIso: string;
  scaleMeters: number;
}): GeeExpression {
  return {
    result: "0",
    values: {
      "0": {
        functionInvocationValue: {
          functionName: "Image.reduceRegion",
          arguments: {
            image: {
              functionInvocationValue: {
                functionName: "ImageCollection.reduce",
                arguments: {
                  collection: {
                    functionInvocationValue: {
                      functionName: "Collection.filter",
                      arguments: {
                        collection: {
                          functionInvocationValue: {
                            functionName: "ImageCollection.load",
                            arguments: {
                              id: { constantValue: params.dataset },
                            },
                          },
                        },
                        filter: {
                          functionInvocationValue: {
                            functionName: "Filter.and",
                            arguments: {
                              filters: {
                                arrayValue: {
                                  values: [
                                    {
                                      functionInvocationValue: {
                                        functionName: "Filter.dateRangeContains",
                                        arguments: {
                                          leftValue: {
                                            functionInvocationValue: {
                                              functionName: "DateRange",
                                              arguments: {
                                                start: { constantValue: params.startIso },
                                                end: { constantValue: params.endIso },
                                              },
                                            },
                                          },
                                          rightField: {
                                            constantValue: "system:time_start",
                                          },
                                        },
                                      },
                                    },
                                    {
                                      functionInvocationValue: {
                                        functionName: "Filter.intersects",
                                        arguments: {
                                          leftField: { constantValue: ".geo" },
                                          rightValue: params.geometry,
                                        },
                                      },
                                    },
                                  ],
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                  reducer: {
                    functionInvocationValue: {
                      functionName: "Reducer.mean",
                      arguments: {},
                    },
                  },
                  parallelScale: { constantValue: 2 },
                },
              },
            },
            reducer: {
              functionInvocationValue: {
                functionName: "Reducer.mean",
                arguments: {},
              },
            },
            geometry: params.geometry,
            scale: { constantValue: params.scaleMeters },
            maxPixels: { constantValue: 1_000_000_000 },
          },
        },
      },
    },
  };
}

function extractNumericValue(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) {
    return input;
  }

  if (typeof input === "string") {
    const numeric = Number(input);
    return Number.isFinite(numeric) ? numeric : null;
  }

  if (!input || typeof input !== "object") {
    return null;
  }

  const record = input as Record<string, unknown>;
  if (typeof record.value === "number" && Number.isFinite(record.value)) {
    return record.value;
  }

  for (const value of Object.values(record)) {
    const nested = extractNumericValue(value);
    if (nested !== null) {
      return nested;
    }
  }

  return null;
}

function extractBandMeanValue(raw: Record<string, unknown>, band: string): number | null {
  const result = raw.result;
  if (result && typeof result === "object") {
    const keyed = (result as Record<string, unknown>)[`${band}_mean`];
    const keyedValue = extractNumericValue(keyed);
    if (keyedValue !== null) {
      return keyedValue;
    }
  }

  return extractNumericValue(result ?? raw.value ?? raw);
}

async function requestCompute(params: {
  token: string;
  expression: GeeExpression;
  stageLabel: string;
}): Promise<Record<string, unknown>> {
  const projectId = getProjectId();
  const endpoint = `${GEE_BASE_URL}/projects/${projectId}/value:compute`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expression: params.expression }),
    signal: AbortSignal.timeout(60_000),
  });

  const raw = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const details =
      typeof (raw.error as { message?: unknown })?.message === "string"
        ? (raw.error as { message: string }).message
        : "";
    throw new Error(
      details.length > 0
        ? `${params.stageLabel} failed (${response.status}): ${details}`
        : `${params.stageLabel} failed (${response.status})`,
    );
  }

  return raw;
}

export async function runMethaneSatelliteConfidenceAnalysis(params: {
  projectId: string;
  latitude: number;
  longitude: number;
  destructionMethod:
    | "open_flare"
    | "enclosed_high_temperature_flare"
    | "internal_combustion_engine"
    | "boiler"
    | "bio_cng_vehicle_fuel"
    | "pipeline_injection";
}): Promise<MethaneSatelliteConfidenceResult> {
  if (
    !Number.isFinite(params.latitude) ||
    !Number.isFinite(params.longitude) ||
    params.latitude < -90 ||
    params.latitude > 90 ||
    params.longitude < -180 ||
    params.longitude > 180
  ) {
    throw new Error("Methane satellite verification failed: missing or invalid coordinates.");
  }

  const windows = getDateWindows();
  const geometry = buildBufferedGeometry(params.latitude, params.longitude, 1000);
  const viirsDataset = getViirsDataset();
  const viirsBand = getViirsBand();
  const viirsScale = getViirsScaleMeters();
  const s5pDataset = getS5pDataset();
  const s5pBand = getS5pBand();
  const s5pScale = getS5pScaleMeters();
  const token = await getGeeAccessToken();
  const isFlareMethod =
    params.destructionMethod === "open_flare" ||
    params.destructionMethod === "enclosed_high_temperature_flare";
  const [viirsCurrentRaw, s5pCurrentRaw, s5pBaselineRaw] = await Promise.all([
    isFlareMethod
      ? requestCompute({
          token,
          stageLabel: "Methane GEE VIIRS thermal check",
          expression: buildCollectionBandMeanExpression({
            geometry,
            dataset: viirsDataset,
            band: viirsBand,
            startIso: windows.current.startIso,
            endIso: windows.current.endIso,
            scaleMeters: viirsScale,
          }),
        })
      : Promise.resolve<Record<string, unknown>>({
          skipped: true,
          reason: "viirs_bypassed_for_non_flare_method",
          destruction_method: params.destructionMethod,
        }),
    requestCompute({
      token,
      stageLabel: "Methane GEE Sentinel-5P current plume check",
      expression: buildCollectionBandMeanExpression({
        geometry,
        dataset: s5pDataset,
        band: s5pBand,
        startIso: windows.current.startIso,
        endIso: windows.current.endIso,
        scaleMeters: s5pScale,
      }),
    }),
    requestCompute({
      token,
      stageLabel: "Methane GEE Sentinel-5P baseline plume check",
      expression: buildCollectionBandMeanExpression({
        geometry,
        dataset: s5pDataset,
        band: s5pBand,
        startIso: windows.baseline.startIso,
        endIso: windows.baseline.endIso,
        scaleMeters: s5pScale,
      }),
    }),
  ]);

  const viirsCurrentMeanFrp = isFlareMethod
    ? extractBandMeanValue(viirsCurrentRaw, viirsBand)
    : null;
  if (isFlareMethod && viirsCurrentMeanFrp === null) {
    throw new Error("Methane satellite verification failed: missing VIIRS thermal signal.");
  }

  const s5pCurrentMeanCh4 = extractBandMeanValue(s5pCurrentRaw, s5pBand);
  if (s5pCurrentMeanCh4 === null) {
    throw new Error(
      "Methane satellite verification failed: missing Sentinel-5P current methane concentration.",
    );
  }

  const s5pBaselineMeanCh4 = extractBandMeanValue(s5pBaselineRaw, s5pBand);
  if (s5pBaselineMeanCh4 === null || s5pBaselineMeanCh4 <= 0) {
    throw new Error(
      "Methane satellite verification failed: missing or invalid Sentinel-5P baseline methane concentration.",
    );
  }

  const plumeDropScore = clamp(
    (s5pBaselineMeanCh4 - s5pCurrentMeanCh4) / s5pBaselineMeanCh4,
    0,
    1,
  );
  const viirsScore =
    isFlareMethod && viirsCurrentMeanFrp !== null
      ? clamp(viirsCurrentMeanFrp / getViirsFrpCap(), 0, 1)
      : null;
  const flareActiveConfidence =
    isFlareMethod && viirsScore !== null
      ? composeMethaneFlareConfidence(viirsScore, plumeDropScore)
      : plumeDropScore;

  return {
    flare_active_confidence: flareActiveConfidence,
    viirs_score: viirsScore,
    plume_drop_score: plumeDropScore,
    viirs_current_mean_frp:
      viirsCurrentMeanFrp !== null ? Number(viirsCurrentMeanFrp.toFixed(4)) : null,
    viirs_bypassed: !isFlareMethod,
    s5p_current_mean_ch4: Number(s5pCurrentMeanCh4.toFixed(4)),
    s5p_baseline_mean_ch4: Number(s5pBaselineMeanCh4.toFixed(4)),
    raw_response: {
      project_id: params.projectId,
      windows,
      viirs: {
        dataset: viirsDataset,
        band: viirsBand,
        scale_meters: viirsScale,
        response: viirsCurrentRaw,
      },
      s5p: {
        dataset: s5pDataset,
        band: s5pBand,
        scale_meters: s5pScale,
        current_response: s5pCurrentRaw,
        baseline_response: s5pBaselineRaw,
      },
    },
  };
}
