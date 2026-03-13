import "server-only";

import { getClimatiqApiKey, getElectricityMapsApiKey } from "@/lib/emissions/env";

type JsonLike = Record<string, unknown>;

export type ProviderName = "climatiq" | "electricity_maps";

export class ProviderRequestError extends Error {
  provider: ProviderName;
  stage: string;
  status: number | null;
  diagnostic: JsonLike;

  constructor(params: {
    provider: ProviderName;
    stage: string;
    message: string;
    status: number | null;
    diagnostic: JsonLike;
  }) {
    super(params.message);
    this.name = "ProviderRequestError";
    this.provider = params.provider;
    this.stage = params.stage;
    this.status = params.status;
    this.diagnostic = params.diagnostic;
  }
}

async function parseResponseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return await response.text().catch(() => "");
  }
}

function bodyPreview(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    return value.slice(0, 600);
  }
  try {
    return JSON.stringify(value).slice(0, 600);
  } catch {
    return String(value).slice(0, 600);
  }
}

function readNumericValue(
  body: unknown,
  candidates: string[],
): number | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;

  for (const key of candidates) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

const CLIMATIQ_ESTIMATE_URL =
  process.env.CLIMATIQ_ESTIMATE_URL?.trim() ||
  "https://api.climatiq.io/data/v1/estimate";
const CLIMATIQ_DATA_VERSION = process.env.CLIMATIQ_DATA_VERSION?.trim() || "^32";
const ELECTRICITY_MAPS_BASE_URL = normalizeBaseUrl(
  process.env.ELECTRICITY_MAPS_BASE_URL?.trim() ||
    "https://api-access.electricitymaps.com/free-tier",
);

export async function fetchClimatiqPhysicalEstimate(params: {
  stage: string;
  activityId: string;
  quantity: number;
  quantityUnit: string;
  quantityType: "volume" | "weight";
  region?: string | null;
}): Promise<{ co2e: number; diagnostic: JsonLike }> {
  const parameters =
    params.quantityType === "weight"
      ? {
          weight: params.quantity,
          weight_unit: params.quantityUnit,
        }
      : {
          volume: params.quantity,
          volume_unit: params.quantityUnit,
        };

  const emissionFactor: Record<string, unknown> = {
    activity_id: params.activityId,
    data_version: CLIMATIQ_DATA_VERSION,
  };

  if (params.region && params.region.trim()) {
    emissionFactor.region = params.region.trim();
  }

  const payload = {
    emission_factor: emissionFactor,
    parameters,
  };
  const url = CLIMATIQ_ESTIMATE_URL;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getClimatiqApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const responseBody = await parseResponseBody(response);

  const diagnostic: JsonLike = {
    provider: "climatiq",
    stage: params.stage,
    url,
    request: payload,
    status: response.status,
    response_preview: bodyPreview(responseBody),
  };

  if (!response.ok) {
    const preview = bodyPreview(responseBody);
    throw new ProviderRequestError({
      provider: "climatiq",
      stage: params.stage,
      message: `Climatiq physical estimate failed (${response.status})${preview ? `: ${preview}` : ""}`,
      status: response.status,
      diagnostic,
    });
  }

  const co2e = readNumericValue(responseBody, ["co2e"]);
  if (co2e === null) {
    throw new ProviderRequestError({
      provider: "climatiq",
      stage: params.stage,
      message: "Climatiq physical estimate missing numeric co2e",
      status: response.status,
      diagnostic,
    });
  }

  return {
    co2e,
    diagnostic,
  };
}

export async function fetchElectricityMapsGridIntensity(params: {
  stage: string;
  zone: string;
}): Promise<{ carbonIntensity: number; diagnostic: JsonLike }> {
  const url = `${ELECTRICITY_MAPS_BASE_URL}/carbon-intensity/latest?zone=${encodeURIComponent(params.zone)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "auth-token": getElectricityMapsApiKey(),
    },
  });
  const responseBody = await parseResponseBody(response);

  const diagnostic: JsonLike = {
    provider: "electricity_maps",
    stage: params.stage,
    url,
    request: {
      zone: params.zone,
    },
    status: response.status,
    response_preview: bodyPreview(responseBody),
  };

  if (!response.ok) {
    const preview = bodyPreview(responseBody);
    throw new ProviderRequestError({
      provider: "electricity_maps",
      stage: params.stage,
      message: `Electricity Maps intensity fetch failed (${response.status})${preview ? `: ${preview}` : ""}`,
      status: response.status,
      diagnostic,
    });
  }

  const carbonIntensity =
    readNumericValue(responseBody, ["carbonIntensity", "carbon_intensity"]) ??
    (responseBody &&
    typeof responseBody === "object" &&
    typeof (responseBody as Record<string, unknown>).data === "object"
      ? readNumericValue(
          (responseBody as Record<string, unknown>).data as Record<string, unknown>,
          ["carbonIntensity", "carbon_intensity"],
        )
      : null);

  if (carbonIntensity === null) {
    throw new ProviderRequestError({
      provider: "electricity_maps",
      stage: params.stage,
      message: "Electricity Maps response missing numeric carbon intensity",
      status: response.status,
      diagnostic,
    });
  }

  return {
    carbonIntensity,
    diagnostic,
  };
}
