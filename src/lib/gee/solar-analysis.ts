import "server-only";

import { getGeeAccessToken } from "@/lib/gee/auth";

type SolarAnalysisResult = {
  verified_total_area_m2: number;
  annual_ghi_kwh_per_m2: number;
  raw_response: Record<string, unknown>;
};

type GeeExpression = Record<string, unknown>;

const GEE_BASE_URL = "https://earthengine.googleapis.com/v1";

function getProjectId(): string {
  const projectId = process.env.GEE_PROJECT_ID;
  if (!projectId) {
    throw new Error("Missing GEE_PROJECT_ID");
  }
  return projectId;
}

function getSolarDataset(): string {
  return (
    process.env.GEE_SOLAR_GHI_DATASET?.trim() || "ECMWF/ERA5_LAND/DAILY_AGGR"
  );
}

function getSolarBand(): string {
  return (
    process.env.GEE_SOLAR_GHI_BAND?.trim() ||
    "surface_solar_radiation_downwards_sum"
  );
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function getSolarDateWindow() {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setUTCDate(startDate.getUTCDate() - 365);

  const windowDays = Math.max(
    1,
    Math.round((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)),
  );

  return {
    startIso: `${toIsoDate(startDate)}T00:00:00Z`,
    endIso: `${toIsoDate(endDate)}T23:59:59Z`,
    windowDays,
  };
}

function parseRingCoordinates(
  polygonGeojson: object,
): Array<[number, number]> {
  const feature = polygonGeojson as {
    geometry?: {
      type?: string;
      coordinates?: unknown;
    };
  };

  if (feature.geometry?.type !== "Polygon") {
    throw new Error("Solar valuation pending: missing polygon_geojson");
  }

  const coordinates = feature.geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    throw new Error("Solar valuation pending: missing polygon_geojson");
  }

  const outerRing = coordinates[0];
  if (!Array.isArray(outerRing) || outerRing.length < 3) {
    throw new Error("Solar valuation pending: missing polygon_geojson");
  }

  const parsed = outerRing
    .map((point) => {
      if (!Array.isArray(point) || point.length < 2) {
        return null;
      }

      const lng = Number(point[0]);
      const lat = Number(point[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
      }

      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return null;
      }

      return [lng, lat] as [number, number];
    })
    .filter((value): value is [number, number] => Boolean(value));

  if (parsed.length < 3) {
    throw new Error("Solar valuation pending: missing polygon_geojson");
  }

  const first = parsed[0];
  const last = parsed[parsed.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    parsed.push(first);
  }

  return parsed;
}

function buildPolygonGeometryExpression(
  ringCoordinates: Array<[number, number]>,
): Record<string, unknown> {
  return {
    functionInvocationValue: {
      functionName: "GeometryConstructors.Polygon",
      arguments: {
        coordinates: {
          arrayValue: {
            values: [
              {
                arrayValue: {
                  values: ringCoordinates.map(([lng, lat]) => ({
                    arrayValue: {
                      values: [{ constantValue: lng }, { constantValue: lat }],
                    },
                  })),
                },
              },
            ],
          },
        },
      },
    },
  };
}

function buildAreaExpression(geometry: Record<string, unknown>): GeeExpression {
  return {
    result: "0",
    values: {
      "0": {
        functionInvocationValue: {
          functionName: "Geometry.area",
          arguments: {
            geometry,
          },
        },
      },
    },
  };
}

function buildGhiExpression(params: {
  geometry: Record<string, unknown>;
  dataset: string;
  band: string;
  startIso: string;
  endIso: string;
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
                                                start: {
                                                  constantValue: params.startIso,
                                                },
                                                end: {
                                                  constantValue: params.endIso,
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
                      functionName: "Reducer.sum",
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
            scale: { constantValue: 11132 },
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

async function requestCompute(params: {
  token: string;
  expression: GeeExpression;
  stageLabel: "area" | "ghi";
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
        ? `Solar GEE ${params.stageLabel} failed (${response.status}): ${details}`
        : `Solar GEE ${params.stageLabel} failed (${response.status})`,
    );
  }

  return raw;
}

export async function runSolarIrradianceAnalysis(params: {
  projectId: string;
  polygonGeojson: object;
}): Promise<SolarAnalysisResult> {
  const ringCoordinates = parseRingCoordinates(params.polygonGeojson);
  const polygonGeometry = buildPolygonGeometryExpression(ringCoordinates);
  const { startIso, endIso, windowDays } = getSolarDateWindow();
  const dataset = getSolarDataset();
  const band = getSolarBand();
  const bandName = `${band}_sum`;

  const token = await getGeeAccessToken();

  const [areaRaw, ghiRaw] = await Promise.all([
    requestCompute({
      token,
      expression: buildAreaExpression(polygonGeometry),
      stageLabel: "area",
    }),
    requestCompute({
      token,
      expression: buildGhiExpression({
        geometry: polygonGeometry,
        dataset,
        band,
        startIso,
        endIso,
      }),
      stageLabel: "ghi",
    }),
  ]);

  const areaSquareMeters = extractNumericValue(areaRaw.result ?? areaRaw.value ?? areaRaw);
  if (areaSquareMeters === null || areaSquareMeters <= 0) {
    throw new Error("Solar GEE area failed: unable to derive polygon area.");
  }

  const bandValue = extractNumericValue(
    (ghiRaw.result as Record<string, unknown> | undefined)?.[bandName] ??
      ghiRaw.result ??
      ghiRaw.value ??
      ghiRaw,
  );

  if (bandValue === null || bandValue <= 0) {
    throw new Error("Solar GEE ghi failed: unable to derive annual irradiance.");
  }

  const annualKwhPerM2 = (bandValue / 3_600_000) * (365 / windowDays);

  return {
    verified_total_area_m2: Number(areaSquareMeters.toFixed(2)),
    annual_ghi_kwh_per_m2: Number(annualKwhPerM2.toFixed(2)),
    raw_response: {
      dataset,
      band,
      window: { startIso, endIso, windowDays },
      area_response: areaRaw,
      ghi_response: ghiRaw,
    },
  };
}
