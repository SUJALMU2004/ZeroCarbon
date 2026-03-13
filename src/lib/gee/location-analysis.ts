import "server-only";

import { getGeeAccessToken } from "@/lib/gee/auth";

type ImageryQuality = "clear" | "cloudy" | "failed";

type LocationAnalysisResult = {
  location_confirmed: boolean;
  imagery_quality: ImageryQuality;
  thumbnail_url: string | null;
  raw_response: Record<string, unknown>;
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

function isValidCoordinate(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;
}

function buildRgbExpression(params: {
  latitude: number;
  longitude: number;
  cloudThreshold: number;
}): Record<string, unknown> {
  const dataset = getDataset();
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 90);

  return {
    result: "0",
    values: {
      "0": {
        functionInvocationValue: {
          functionName: "Image.visualize",
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
                                                  constantValue: `${start.toISOString().slice(0, 10)}T00:00:00Z`,
                                                },
                                                end: {
                                                  constantValue: `${now.toISOString().slice(0, 10)}T23:59:59Z`,
                                                },
                                              },
                                            },
                                          },
                                          rightField: { constantValue: "system:time_start" },
                                        },
                                      },
                                    },
                                    {
                                      functionInvocationValue: {
                                        functionName: "Filter.lessThan",
                                        arguments: {
                                          leftField: { constantValue: "CLOUDY_PIXEL_PERCENTAGE" },
                                          rightValue: { constantValue: params.cloudThreshold },
                                        },
                                      },
                                    },
                                    {
                                      functionInvocationValue: {
                                        functionName: "Filter.intersects",
                                        arguments: {
                                          leftField: { constantValue: ".geo" },
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
                                                distance: { constantValue: 2000 },
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
            bands: {
              arrayValue: {
                values: [
                  { constantValue: "B4_median" },
                  { constantValue: "B3_median" },
                  { constantValue: "B2_median" },
                ],
              },
            },
            min: { constantValue: 0 },
            max: { constantValue: 3000 },
          },
        },
      },
    },
  };
}

async function requestThumbnail(params: {
  token: string;
  latitude: number;
  longitude: number;
  cloudThreshold: number;
}): Promise<{ thumbnailUrl: string | null; raw: Record<string, unknown> }> {
  const projectId = getProjectId();
  const endpoint = `${GEE_BASE_URL}/projects/${projectId}/thumbnails`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      expression: buildRgbExpression({
        latitude: params.latitude,
        longitude: params.longitude,
        cloudThreshold: params.cloudThreshold,
      }),
      fileFormat: "PNG",
      grid: {
        dimensions: {
          width: 512,
          height: 512,
        },
      },
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
        ? `GEE thumbnail request failed (${response.status}): ${details}`
        : `GEE thumbnail request failed (${response.status})`,
    );
  }

  const name = typeof raw.name === "string" ? raw.name : null;
  const thumbnailUrl = name ? `${GEE_BASE_URL}/${name}:getPixels` : null;
  return { thumbnailUrl, raw };
}

export async function runLocationAnalysis(params: {
  latitude: number;
  longitude: number;
  projectId: string;
}): Promise<LocationAnalysisResult> {
  try {
    if (!isValidCoordinate(params.latitude, params.longitude)) {
      return {
        location_confirmed: false,
        imagery_quality: "failed",
        thumbnail_url: null,
        raw_response: { error: "Invalid coordinates" },
      };
    }

    const token = await getGeeAccessToken();

    try {
      const clear = await requestThumbnail({
        token,
        latitude: params.latitude,
        longitude: params.longitude,
        cloudThreshold: 30,
      });

      return {
        location_confirmed: true,
        imagery_quality: "clear",
        thumbnail_url: clear.thumbnailUrl,
        raw_response: {
          project_id: params.projectId,
          cloud_filter: 30,
          response: clear.raw,
        },
      };
    } catch (clearError) {
      console.error("gee_location_clear_failed", {
        projectId: params.projectId,
        reason: clearError instanceof Error ? clearError.message : "unknown_error",
      });

      try {
        const cloudy = await requestThumbnail({
          token,
          latitude: params.latitude,
          longitude: params.longitude,
          cloudThreshold: 60,
        });

        return {
          location_confirmed: true,
          imagery_quality: "cloudy",
          thumbnail_url: cloudy.thumbnailUrl,
          raw_response: {
            project_id: params.projectId,
            cloud_filter: 60,
            response: cloudy.raw,
          },
        };
      } catch (cloudyError) {
        return {
          location_confirmed: false,
          imagery_quality: "failed",
          thumbnail_url: null,
          raw_response: {
            project_id: params.projectId,
            error: cloudyError instanceof Error ? cloudyError.message : "unknown_error",
          },
        };
      }
    }
  } catch (error) {
    return {
      location_confirmed: false,
      imagery_quality: "failed",
      thumbnail_url: null,
      raw_response: {
        project_id: params.projectId,
        error: error instanceof Error ? error.message : "unknown_error",
      },
    };
  }
}
