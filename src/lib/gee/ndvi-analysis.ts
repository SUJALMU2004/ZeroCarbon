import "server-only";

import { getGeeAccessToken } from "@/lib/gee/auth";

type NdviTrend = "positive" | "flat" | "negative";

type TimeWindowKey = "current" | "2020" | "2022" | "2024";

type ForestryNdviResult = {
  ndvi_current: number | null;
  ndvi_2020: number | null;
  ndvi_2022: number | null;
  ndvi_2024: number | null;
  ndvi_trend: NdviTrend | null;
  raw_response: Record<string, unknown>;
};

type DateWindow = {
  start: string;
  end: string;
};

const GEE_BASE_URL = "https://earthengine.googleapis.com/v1";

function getProjectId(): string {
  const projectId = process.env.GEE_PROJECT_ID;
  if (!projectId) {
    throw new Error("Missing GEE_PROJECT_ID");
  }
  return projectId;
}

function getDataset(): string {
  const configured = process.env.GEE_DEFAULT_DATASET?.trim();
  if (!configured || configured === "COPERNICUS/S2_SR") {
    return "COPERNICUS/S2_SR_HARMONIZED";
  }
  return configured;
}

function getRedBand(): string {
  return process.env.GEE_NDVI_RED_BAND ?? "B4";
}

function getNirBand(): string {
  return process.env.GEE_NDVI_NIR_BAND ?? "B8";
}

function getDateWindows(): Record<TimeWindowKey, DateWindow> {
  const now = new Date();
  const startCurrent = new Date(now);
  startCurrent.setDate(startCurrent.getDate() - 60);

  const toIsoDate = (value: Date) => value.toISOString().slice(0, 10);

  return {
    current: {
      start: toIsoDate(startCurrent),
      end: toIsoDate(now),
    },
    "2020": {
      start: "2020-01-01",
      end: "2020-03-31",
    },
    "2022": {
      start: "2022-01-01",
      end: "2022-03-31",
    },
    "2024": {
      start: "2024-01-01",
      end: "2024-03-31",
    },
  };
}

function toBufferRadiusMeters(landAreaHectares: number): number {
  const radius = Math.sqrt((landAreaHectares * 10_000) / Math.PI);
  return Math.max(500, Math.min(50_000, radius));
}

function buildNdviComputeExpression(params: {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  start: string;
  end: string;
  cloudThreshold: number;
}): Record<string, unknown> {
  const dataset = getDataset();
  const redBand = getRedBand();
  const nirBand = getNirBand();

  return {
    result: "0",
    values: {
      "0": {
        functionInvocationValue: {
          functionName: "Image.reduceRegion",
          arguments: {
            image: {
              functionInvocationValue: {
                functionName: "Image.normalizedDifference",
                arguments: {
                  input: {
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
                                    id: { constantValue: dataset },
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
                                                      start: {
                                                        constantValue: `${params.start}T00:00:00Z`,
                                                      },
                                                      end: {
                                                        constantValue: `${params.end}T23:59:59Z`,
                                                      },
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
                                              functionName: "Filter.lessThan",
                                              arguments: {
                                                leftField: {
                                                  constantValue: "CLOUDY_PIXEL_PERCENTAGE",
                                                },
                                                rightValue: {
                                                  constantValue: params.cloudThreshold,
                                                },
                                              },
                                            },
                                          },
                                          {
                                            functionInvocationValue: {
                                              functionName: "Filter.intersects",
                                              arguments: {
                                                leftField: {
                                                  constantValue: ".geo",
                                                },
                                                rightValue: {
                                                  functionInvocationValue: {
                                                    functionName: "Geometry.buffer",
                                                    arguments: {
                                                      geometry: {
                                                        functionInvocationValue: {
                                                          functionName: "GeometryConstructors.Point",
                                                          arguments: {
                                                            coordinates: {
                                                              arrayValue: {
                                                                values: [
                                                                  { constantValue: params.longitude },
                                                                  { constantValue: params.latitude },
                                                                ],
                                                              },
                                                            },
                                                          },
                                                        },
                                                      },
                                                      distance: {
                                                        constantValue: params.radiusMeters,
                                                      },
                                                    },
                                                  },
                                                },
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
                            functionName: "Reducer.median",
                            arguments: {},
                          },
                        },
                        parallelScale: { constantValue: 2 },
                      },
                    },
                  },
                  bandNames: {
                    arrayValue: {
                      values: [
                        { constantValue: `${nirBand}_median` },
                        { constantValue: `${redBand}_median` },
                      ],
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
                  geometry: {
                    functionInvocationValue: {
                      functionName: "Geometry.buffer",
                      arguments: {
                        geometry: {
                          functionInvocationValue: {
                            functionName: "GeometryConstructors.Point",
                            arguments: {
                              coordinates: {
                                arrayValue: {
                            values: [
                              { constantValue: params.longitude },
                              { constantValue: params.latitude },
                            ],
                          },
                        },
                      },
                    },
                  },
                  distance: { constantValue: params.radiusMeters },
                },
              },
            },
            scale: { constantValue: 20 },
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

async function computeWindowNdvi(params: {
  token: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  start: string;
  end: string;
}): Promise<{ value: number | null; raw: unknown }> {
  const projectId = getProjectId();
  const endpoint = `${GEE_BASE_URL}/projects/${projectId}/value:compute`;

  const callCompute = async (cloudThreshold: number) => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expression: buildNdviComputeExpression({
          latitude: params.latitude,
          longitude: params.longitude,
          radiusMeters: params.radiusMeters,
          start: params.start,
          end: params.end,
          cloudThreshold,
        }),
      }),
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
          ? `GEE NDVI compute failed (${response.status}): ${details}`
          : `GEE NDVI compute failed (${response.status})`,
      );
    }

    const result = raw.result ?? raw.value ?? raw;
    const value = extractNumericValue(result);
    return { value, raw };
  };

  try {
    return await callCompute(20);
  } catch (error20) {
    console.error("gee_ndvi_window_cloud20_failed", {
      reason: error20 instanceof Error ? error20.message : "unknown_error",
    });
    return callCompute(50);
  }
}

function calculateTrend(values: {
  current: number | null;
  y2020: number | null;
}): NdviTrend | null {
  if (values.current === null || values.y2020 === null) {
    return null;
  }

  const delta = values.current - values.y2020;
  if (delta > 0.05) return "positive";
  if (delta < -0.05) return "negative";
  return "flat";
}

export async function runForestryNdviAnalysis(params: {
  latitude: number;
  longitude: number;
  landAreaHectares: number;
  projectId: string;
}): Promise<ForestryNdviResult> {
  const token = await getGeeAccessToken();
  const windows = getDateWindows();
  const radiusMeters = toBufferRadiusMeters(params.landAreaHectares);
  const rawResponse: Record<string, unknown> = {
    windows: {},
    radius_meters: radiusMeters,
    project_id: params.projectId,
  };

  const results: Record<TimeWindowKey, number | null> = {
    current: null,
    "2020": null,
    "2022": null,
    "2024": null,
  };

  const entries = Object.entries(windows) as Array<[TimeWindowKey, DateWindow]>;

  for (const [key, window] of entries) {
    try {
      const computed = await computeWindowNdvi({
        token,
        latitude: params.latitude,
        longitude: params.longitude,
        radiusMeters,
        start: window.start,
        end: window.end,
      });

      results[key] = computed.value;
      (rawResponse.windows as Record<string, unknown>)[key] = computed.raw;
    } catch (error) {
      results[key] = null;
      (rawResponse.windows as Record<string, unknown>)[key] = {
        error: error instanceof Error ? error.message : "unknown_error",
      };
      console.error("gee_ndvi_window_failed", {
        projectId: params.projectId,
        window: key,
        reason: error instanceof Error ? error.message : "unknown_error",
      });
    }
  }

  const successfulWindows = Object.values(results).filter((value) => value !== null);
  if (successfulWindows.length === 0) {
    const windowErrors = entries
      .map(([key]) => {
        const windowPayload = (rawResponse.windows as Record<string, unknown>)[key] as
          | Record<string, unknown>
          | undefined;
        const message =
          typeof windowPayload?.error === "string" ? windowPayload.error : null;
        return message ? `${key}: ${message}` : null;
      })
      .filter((message): message is string => Boolean(message));

    throw new Error(
      windowErrors.length > 0
        ? `All NDVI windows failed. ${windowErrors.join(" | ")}`
        : "All NDVI windows failed",
    );
  }

  const trend = calculateTrend({
    current: results.current,
    y2020: results["2020"],
  });

  return {
    ndvi_current: results.current,
    ndvi_2020: results["2020"],
    ndvi_2022: results["2022"],
    ndvi_2024: results["2024"],
    ndvi_trend: trend,
    raw_response: rawResponse,
  };
}
