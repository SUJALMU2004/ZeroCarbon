import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { normalizeOptionalText } from "@/lib/profile/identity-validation";
import { INDIA_STATES_AND_UTS } from "@/lib/data/india-states";

const PROJECT_TYPES = [
  "forestry",
  "agricultural",
  "solar",
  "methane",
  "windmill",
] as const;

const DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
const PANEL_TECHNOLOGIES = [
  "monocrystalline",
  "polycrystalline",
  "thin_film",
  "bifacial",
] as const;
const METHANE_SOURCE_TYPES = [
  "municipal_solid_waste_landfill",
  "agricultural_anaerobic_digester",
  "coal_mine_gas",
  "wastewater_treatment",
] as const;
const METHANE_DESTRUCTION_METHODS = [
  "open_flare",
  "enclosed_high_temperature_flare",
  "internal_combustion_engine",
  "boiler",
  "bio_cng_vehicle_fuel",
  "pipeline_injection",
] as const;
const WINDMILL_TURBINE_MODELS = [
  "suzlon_s120_2_1_mw",
  "vestas_v110_2_0_mw",
  "ge_1_5_sle_1_5_mw",
  "siemens_gamesa_sg_2_1_114_2_1_mw",
  "envision_en_131_2_5_mw",
] as const;
const WINDMILL_POWER_OFFTAKER_TYPES = [
  "exported_to_state_grid",
  "captive_consumption_industrial_facility",
] as const;

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const RESEND_FROM = "ZeroCarbon <onboarding@resend.dev>";

type VerifyProjectPayload = {
  project_title?: unknown;
  project_name?: unknown;
  project_type?: unknown;
  short_description?: unknown;
  project_start_date?: unknown;
  start_date?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  land_area_hectares?: unknown;
  estimated_co2_per_year?: unknown;
  polygon_geojson?: unknown;
  organization_name?: unknown;
  organization_type?: unknown;
  organization_type_other?: unknown;
  seller_name?: unknown;
  seller_email?: unknown;
  ownership_type?: unknown;
  declaration_carbon_rights?: unknown;
  declaration_document_use?: unknown;
  street_address?: unknown;
  state?: unknown;
  country?: unknown;
  pin_code?: unknown;
  species?: unknown;
  number_of_trees?: unknown;
  planting_year?: unknown;
  plantation_density?: unknown;
  claimed_capacity_mw?: unknown;
  panel_technology?: unknown;
  grid_region?: unknown;
  methane_source_type?: unknown;
  methane_destruction_method?: unknown;
  methane_generates_electricity?: unknown;
  claimed_methane_volume_m3?: unknown;
  ch4_concentration?: unknown;
  windmill_locations?: unknown;
  windmill_turbine_model?: unknown;
  windmill_hub_height_m?: unknown;
  windmill_claimed_net_export_mwh?: unknown;
  windmill_power_offtaker_type?: unknown;
  ownership_document_urls?: unknown;
  project_photo_urls?: unknown;
  photo_gps_data?: unknown;
  agreement_voluntary?: unknown;
  agreement_right_to_sell?: unknown;
  agreement_not_sold_elsewhere?: unknown;
  agreement_marketplace?: unknown;
  document_path?: unknown;
  document_type?: unknown;
};

type InsertedProjectRow = {
  id: string;
};

type ValidatedPayload = {
  project_name: string;
  project_type: (typeof PROJECT_TYPES)[number];
  latitude: number;
  longitude: number;
  land_area_hectares: number;
  estimated_co2_per_year: number;
  project_start_date: string;
  polygon_geojson: object | null;
  document_path: string | null;
  document_type: (typeof DOCUMENT_TYPES)[number] | null;
  metadata: Record<string, unknown>;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function errorResponse(status: number, error: string, field?: string) {
  return NextResponse.json(
    {
      error,
      ...(field ? { field } : {}),
    },
    { status },
  );
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value.trim());
  return Number.NaN;
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function getPolygonCentroid(polygonGeojson: unknown): {
  latitude: number;
  longitude: number;
} | null {
  if (!polygonGeojson || typeof polygonGeojson !== "object") {
    return null;
  }

  const feature = polygonGeojson as {
    geometry?: {
      type?: string;
      coordinates?: number[][][];
    };
  };
  if (feature.geometry?.type !== "Polygon") return null;
  const ring = feature.geometry.coordinates?.[0];
  if (!Array.isArray(ring) || ring.length < 3) return null;

  let latSum = 0;
  let lngSum = 0;
  let count = 0;

  ring.forEach((point) => {
    if (Array.isArray(point) && point.length >= 2) {
      const lng = Number(point[0]);
      const lat = Number(point[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        latSum += lat;
        lngSum += lng;
        count += 1;
      }
    }
  });

  if (count === 0) return null;
  return {
    latitude: latSum / count,
    longitude: lngSum / count,
  };
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeOptionalText(item))
    .filter((item): item is string => Boolean(item));
}

function parseBoolean(value: unknown) {
  return value === true;
}

function parsePhotoGpsData(
  value: unknown,
): Array<{ lat: number | null; lng: number | null }> {
  if (!Array.isArray(value)) return [];

  return value.map((entry) => {
    const lat = toNumber((entry as { lat?: unknown })?.lat);
    const lng = toNumber((entry as { lng?: unknown })?.lng);
    return {
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
    };
  });
}

function parseWindmillLocations(
  value: unknown,
): Array<{ latitude: number; longitude: number }> {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      const latitude = toNumber((entry as { latitude?: unknown })?.latitude);
      const longitude = toNumber((entry as { longitude?: unknown })?.longitude);
      if (
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90 ||
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180
      ) {
        return null;
      }
      return { latitude, longitude };
    })
    .filter(
      (entry): entry is { latitude: number; longitude: number } => Boolean(entry),
    );
}

function getLocationsCentroid(locations: Array<{ latitude: number; longitude: number }>): {
  latitude: number;
  longitude: number;
} | null {
  if (locations.length < 1) return null;

  const totals = locations.reduce(
    (accumulator, location) => ({
      latitude: accumulator.latitude + location.latitude,
      longitude: accumulator.longitude + location.longitude,
    }),
    { latitude: 0, longitude: 0 },
  );

  return {
    latitude: totals.latitude / locations.length,
    longitude: totals.longitude / locations.length,
  };
}

function parseAndValidatePayload(payload: VerifyProjectPayload):
  | ValidatedPayload
  | { error: string; field: string } {
  const projectName =
    normalizeOptionalText(payload.project_title) ??
    normalizeOptionalText(payload.project_name);
  if (!projectName || projectName.length < 2 || projectName.length > 200) {
    return {
      error: "Project title must be between 2 and 200 characters.",
      field: "project_title",
    };
  }

  const projectType = normalizeOptionalText(payload.project_type);
  if (
    !projectType ||
    !PROJECT_TYPES.includes(projectType as (typeof PROJECT_TYPES)[number])
  ) {
    return {
      error: "Please select a valid project type.",
      field: "project_type",
    };
  }

  const startDate =
    normalizeOptionalText(payload.start_date) ??
    normalizeOptionalText(payload.project_start_date);
  if (!startDate) {
    return { error: "Project start date is required.", field: "start_date" };
  }

  const parsedStartDate = parseDate(startDate);
  if (!parsedStartDate) {
    return {
      error: "Project start date must be a valid date.",
      field: "start_date",
    };
  }

  const minDate = new Date(Date.UTC(1990, 0, 1));
  const today = new Date();
  const todayUtc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  if (parsedStartDate < minDate || parsedStartDate > todayUtc) {
    return {
      error: "Project start date must be between 1990-01-01 and today.",
      field: "start_date",
    };
  }

  const isLandProject =
    projectType === "forestry" || projectType === "agricultural";
  const isPolygonProject = isLandProject || projectType === "solar";

  const polygonGeojson =
    payload.polygon_geojson && typeof payload.polygon_geojson === "object"
      ? (payload.polygon_geojson as object)
      : null;

  let latitude = toNumber(payload.latitude);
  let longitude = toNumber(payload.longitude);
  if ((!Number.isFinite(latitude) || !Number.isFinite(longitude)) && polygonGeojson) {
    const centroid = getPolygonCentroid(polygonGeojson);
    if (centroid) {
      latitude = centroid.latitude;
      longitude = centroid.longitude;
    }
  }

  const landAreaInput = toNumber(payload.land_area_hectares);
  const landArea = Number.isFinite(landAreaInput) ? landAreaInput : 0;
  if (isPolygonProject && (!Number.isFinite(landArea) || landArea <= 0 || landArea > 10000000)) {
    return {
      error: "Land area must be a positive number.",
      field: "land_area_hectares",
    };
  }

  if (isPolygonProject && !polygonGeojson) {
    return {
      error: "Polygon boundary is required for forestry/agricultural/solar projects.",
      field: "polygon_geojson",
    };
  }

  const claimedCapacityRaw = toNumber(payload.claimed_capacity_mw);
  const claimedCapacityMw = Number.isFinite(claimedCapacityRaw)
    ? claimedCapacityRaw
    : Number.NaN;
  const panelTechnologyRaw = normalizeOptionalText(payload.panel_technology);
  const panelTechnology =
    panelTechnologyRaw
      ?.toLowerCase()
      .replaceAll("-", "_")
      .replace(/\s+/g, "_") ?? null;
  const gridRegionRaw = normalizeOptionalText(payload.grid_region);
  const gridRegion =
    gridRegionRaw !== null
      ? INDIA_STATES_AND_UTS.find(
          (region) => region.toLowerCase() === gridRegionRaw.toLowerCase(),
        ) ?? null
      : null;
  const methaneSourceTypeRaw = normalizeOptionalText(payload.methane_source_type);
  const methaneSourceType =
    methaneSourceTypeRaw &&
    METHANE_SOURCE_TYPES.includes(
      methaneSourceTypeRaw as (typeof METHANE_SOURCE_TYPES)[number],
    )
      ? (methaneSourceTypeRaw as (typeof METHANE_SOURCE_TYPES)[number])
      : null;
  const methaneDestructionMethodRaw = normalizeOptionalText(
    payload.methane_destruction_method,
  );
  const methaneDestructionMethod =
    methaneDestructionMethodRaw &&
    METHANE_DESTRUCTION_METHODS.includes(
      methaneDestructionMethodRaw as (typeof METHANE_DESTRUCTION_METHODS)[number],
    )
      ? (methaneDestructionMethodRaw as (typeof METHANE_DESTRUCTION_METHODS)[number])
      : null;
  const methaneGeneratesElectricityRaw = normalizeOptionalText(
    payload.methane_generates_electricity,
  );
  const methaneGeneratesElectricity =
    methaneGeneratesElectricityRaw === "yes" || methaneGeneratesElectricityRaw === "no"
      ? methaneGeneratesElectricityRaw
      : null;
  const claimedMethaneVolumeRaw = toNumber(payload.claimed_methane_volume_m3);
  const claimedMethaneVolumeM3 = Number.isFinite(claimedMethaneVolumeRaw)
    ? claimedMethaneVolumeRaw
    : Number.NaN;
  const ch4ConcentrationRaw = toNumber(payload.ch4_concentration);
  const ch4ConcentrationNormalized = Number.isFinite(ch4ConcentrationRaw)
    ? ch4ConcentrationRaw > 1
      ? ch4ConcentrationRaw / 100
      : ch4ConcentrationRaw
    : Number.NaN;
  const windmillLocations = parseWindmillLocations(payload.windmill_locations);
  const windmillTurbineModelRaw = normalizeOptionalText(payload.windmill_turbine_model);
  const windmillTurbineModel =
    windmillTurbineModelRaw &&
    WINDMILL_TURBINE_MODELS.includes(
      windmillTurbineModelRaw as (typeof WINDMILL_TURBINE_MODELS)[number],
    )
      ? (windmillTurbineModelRaw as (typeof WINDMILL_TURBINE_MODELS)[number])
      : null;
  const windmillHubHeightRaw = toNumber(payload.windmill_hub_height_m);
  const windmillHubHeight = Number.isFinite(windmillHubHeightRaw)
    ? windmillHubHeightRaw
    : Number.NaN;
  const windmillClaimedNetExportRaw = toNumber(
    payload.windmill_claimed_net_export_mwh,
  );
  const windmillClaimedNetExport = Number.isFinite(windmillClaimedNetExportRaw)
    ? windmillClaimedNetExportRaw
    : Number.NaN;
  const windmillPowerOfftakerRaw = normalizeOptionalText(
    payload.windmill_power_offtaker_type,
  );
  const windmillPowerOfftaker =
    windmillPowerOfftakerRaw &&
    WINDMILL_POWER_OFFTAKER_TYPES.includes(
      windmillPowerOfftakerRaw as (typeof WINDMILL_POWER_OFFTAKER_TYPES)[number],
    )
      ? (windmillPowerOfftakerRaw as (typeof WINDMILL_POWER_OFFTAKER_TYPES)[number])
      : null;

  if (projectType === "windmill") {
    if (windmillLocations.length < 1) {
      return {
        error: "At least one windmill location is required.",
        field: "windmill_locations",
      };
    }

    const centroid = getLocationsCentroid(windmillLocations);
    if (!centroid) {
      return {
        error: "Unable to derive project coordinates from windmill locations.",
        field: "windmill_locations",
      };
    }

    latitude = centroid.latitude;
    longitude = centroid.longitude;
  }

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return {
      error: "Latitude must be a valid number between -90 and 90.",
      field: "latitude",
    };
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return {
      error: "Longitude must be a valid number between -180 and 180.",
      field: "longitude",
    };
  }

  if (projectType === "solar") {
    if (!Number.isFinite(claimedCapacityMw) || claimedCapacityMw <= 0) {
      return {
        error: "Claimed capacity must be a positive number.",
        field: "claimed_capacity_mw",
      };
    }
    if (
      !panelTechnology ||
      !PANEL_TECHNOLOGIES.includes(
        panelTechnology as (typeof PANEL_TECHNOLOGIES)[number],
      )
    ) {
      return {
        error: "Panel technology is invalid.",
        field: "panel_technology",
      };
    }
    if (!gridRegion) {
      return {
        error: "Grid region must be a valid India state or union territory.",
        field: "grid_region",
      };
    }
  }

  if (projectType === "methane") {
    if (!methaneSourceType) {
      return {
        error: "Methane source type is required.",
        field: "methane_source_type",
      };
    }
    if (!methaneDestructionMethod) {
      return {
        error: "Methane destruction method is required.",
        field: "methane_destruction_method",
      };
    }
    if (!methaneGeneratesElectricity) {
      return {
        error: "Methane electricity generation selection is required.",
        field: "methane_generates_electricity",
      };
    }
    if (!Number.isFinite(claimedMethaneVolumeM3) || claimedMethaneVolumeM3 <= 0) {
      return {
        error: "Claimed methane volume must be a positive number.",
        field: "claimed_methane_volume_m3",
      };
    }
    if (
      !Number.isFinite(ch4ConcentrationRaw) ||
      ch4ConcentrationRaw <= 0 ||
      ch4ConcentrationRaw > 100 ||
      !Number.isFinite(ch4ConcentrationNormalized) ||
      ch4ConcentrationNormalized <= 0 ||
      ch4ConcentrationNormalized > 1
    ) {
      return {
        error:
          "CH4 concentration must be a valid number between 0 and 1, or 0 and 100 for percent.",
        field: "ch4_concentration",
      };
    }
  }

  if (projectType === "windmill") {
    if (!windmillTurbineModel) {
      return {
        error: "Installed turbine model is required.",
        field: "windmill_turbine_model",
      };
    }
    if (!Number.isFinite(windmillHubHeight) || windmillHubHeight <= 0) {
      return {
        error: "Tower hub height must be a positive number.",
        field: "windmill_hub_height_m",
      };
    }
    if (!Number.isFinite(windmillClaimedNetExport) || windmillClaimedNetExport <= 0) {
      return {
        error: "Claimed net export must be a positive number.",
        field: "windmill_claimed_net_export_mwh",
      };
    }
    if (!windmillPowerOfftaker) {
      return {
        error: "Power offtaker type is required.",
        field: "windmill_power_offtaker_type",
      };
    }
  }

  const estimatedCo2 = toNumber(payload.estimated_co2_per_year);
  const safeEstimatedCo2 =
    Number.isFinite(estimatedCo2) && estimatedCo2 > 0 ? estimatedCo2 : 0;

  const ownershipDocumentUrls = parseStringArray(payload.ownership_document_urls);
  const projectPhotoUrls = parseStringArray(payload.project_photo_urls);
  const photoGpsData = parsePhotoGpsData(payload.photo_gps_data);

  if (ownershipDocumentUrls.length < 1) {
    return {
      error: "At least one ownership document is required.",
      field: "ownership_document_urls",
    };
  }

  if (projectPhotoUrls.length < 2) {
    return {
      error: "At least two project photos are required.",
      field: "project_photo_urls",
    };
  }

  const species = parseStringArray(payload.species);
  if (isLandProject && species.length < 1) {
    return {
      error: "At least one species is required for this project type.",
      field: "species",
    };
  }

  const metadata: Record<string, unknown> = {
    short_description: normalizeOptionalText(payload.short_description),
    street_address: normalizeOptionalText(payload.street_address),
    state: normalizeOptionalText(payload.state),
    country: normalizeOptionalText(payload.country),
    pin_code: normalizeOptionalText(payload.pin_code),
    organization_name: normalizeOptionalText(payload.organization_name),
    organization_type: normalizeOptionalText(payload.organization_type),
    organization_type_other: normalizeOptionalText(payload.organization_type_other),
    seller_name: normalizeOptionalText(payload.seller_name),
    seller_email: normalizeOptionalText(payload.seller_email),
    ownership_type: normalizeOptionalText(payload.ownership_type),
    declaration_carbon_rights: parseBoolean(payload.declaration_carbon_rights),
    declaration_document_use: parseBoolean(payload.declaration_document_use),
    species,
    number_of_trees: normalizeOptionalText(payload.number_of_trees),
    planting_year: normalizeOptionalText(payload.planting_year),
    plantation_density: normalizeOptionalText(payload.plantation_density),
    claimed_capacity_mw:
      projectType === "solar" && Number.isFinite(claimedCapacityMw)
        ? claimedCapacityMw
        : null,
    panel_technology: projectType === "solar" ? panelTechnology : null,
    grid_region: projectType === "solar" ? gridRegion : null,
    methane_source_type:
      projectType === "methane" ? methaneSourceType : null,
    methane_destruction_method:
      projectType === "methane" ? methaneDestructionMethod : null,
    methane_generates_electricity:
      projectType === "methane" ? methaneGeneratesElectricity : null,
    claimed_methane_volume_m3:
      projectType === "methane" && Number.isFinite(claimedMethaneVolumeM3)
        ? claimedMethaneVolumeM3
        : null,
    ch4_concentration:
      projectType === "methane" && Number.isFinite(ch4ConcentrationNormalized)
        ? ch4ConcentrationNormalized
        : null,
    windmill_locations: projectType === "windmill" ? windmillLocations : null,
    windmill_turbine_model:
      projectType === "windmill" ? windmillTurbineModel : null,
    windmill_hub_height_m:
      projectType === "windmill" && Number.isFinite(windmillHubHeight)
        ? windmillHubHeight
        : null,
    windmill_claimed_net_export_mwh:
      projectType === "windmill" && Number.isFinite(windmillClaimedNetExport)
        ? windmillClaimedNetExport
        : null,
    windmill_power_offtaker_type:
      projectType === "windmill" ? windmillPowerOfftaker : null,
    ownership_document_urls: ownershipDocumentUrls,
    project_photo_urls: projectPhotoUrls,
    photo_gps_data: photoGpsData,
    agreement_voluntary: parseBoolean(payload.agreement_voluntary),
    agreement_right_to_sell: parseBoolean(payload.agreement_right_to_sell),
    agreement_not_sold_elsewhere: parseBoolean(payload.agreement_not_sold_elsewhere),
    agreement_marketplace: parseBoolean(payload.agreement_marketplace),
  };

  const fallbackDocumentPath =
    normalizeOptionalText(payload.document_path) ?? ownershipDocumentUrls[0] ?? null;
  const fallbackDocumentType = normalizeOptionalText(payload.document_type);
  const validatedDocumentType = DOCUMENT_TYPES.includes(
    fallbackDocumentType as (typeof DOCUMENT_TYPES)[number],
  )
    ? (fallbackDocumentType as (typeof DOCUMENT_TYPES)[number])
    : null;

  return {
    project_name: projectName,
    project_type: projectType as (typeof PROJECT_TYPES)[number],
    latitude,
    longitude,
    land_area_hectares: landArea,
    estimated_co2_per_year: safeEstimatedCo2,
    project_start_date: startDate,
    polygon_geojson: polygonGeojson,
    document_path: fallbackDocumentPath,
    document_type: validatedDocumentType,
    metadata,
  };
}

async function sendAdminReviewEmail(params: {
  adminEmail: string;
  projectName: string;
  projectType: string;
  latitude: number;
  longitude: number;
  landAreaHectares: number;
  estimatedCo2PerYear: number;
  submittedBy: string;
  approveUrl: string;
  rejectUrl: string;
}) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    throw new Error("Missing RESEND_API_KEY");
  }

  const projectTypeLabel =
    params.projectType.charAt(0).toUpperCase() + params.projectType.slice(1);

  const html = `
<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
  <h2 style="margin:0 0 10px;color:#16a34a">New Project Submission Review Required</h2>
  <table style="width:100%;border-collapse:collapse;margin:0 0 16px;">
    <tr><td style="padding:6px 0;color:#475569;font-weight:600;">Project Name</td><td style="padding:6px 0;">${escapeHtml(params.projectName)}</td></tr>
    <tr><td style="padding:6px 0;color:#475569;font-weight:600;">Project Type</td><td style="padding:6px 0;">${escapeHtml(projectTypeLabel)}</td></tr>
    <tr><td style="padding:6px 0;color:#475569;font-weight:600;">Latitude</td><td style="padding:6px 0;">${params.latitude}</td></tr>
    <tr><td style="padding:6px 0;color:#475569;font-weight:600;">Longitude</td><td style="padding:6px 0;">${params.longitude}</td></tr>
    <tr><td style="padding:6px 0;color:#475569;font-weight:600;">Land Area (ha)</td><td style="padding:6px 0;">${params.landAreaHectares}</td></tr>
    <tr><td style="padding:6px 0;color:#475569;font-weight:600;">Estimated CO2 / Year</td><td style="padding:6px 0;">${params.estimatedCo2PerYear}</td></tr>
    <tr><td style="padding:6px 0;color:#475569;font-weight:600;">Submitted By</td><td style="padding:6px 0;">${escapeHtml(params.submittedBy)}</td></tr>
  </table>
  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
    <a href="${params.approveUrl}" style="background:#16a34a;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:700;display:inline-block;">Approve Project</a>
    <a href="${params.rejectUrl}" style="background:#dc2626;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:700;display:inline-block;">Reject Project</a>
  </div>
  <p style="margin:0;color:#64748b;font-size:13px;">This link expires in 7 days.</p>
</div>`;

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [params.adminEmail],
      subject: "ZeroCarbon - Project Submission Review",
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`resend_failed:${response.status}:${body.slice(0, 300)}`);
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse(401, "Unauthorized. Please log in.");
    }

    let rawPayload: VerifyProjectPayload;
    try {
      rawPayload = (await request.json()) as VerifyProjectPayload;
    } catch {
      return errorResponse(400, "Invalid request payload.");
    }

    const validated = parseAndValidatePayload(rawPayload);
    if ("error" in validated) {
      return errorResponse(400, validated.error, validated.field);
    }

    const serviceClient = createServiceSupabaseClient();

    const { data: duplicateProject, error: duplicateError } = await serviceClient
      .from("carbon_projects")
      .select("id")
      .eq("user_id", user.id)
      .eq("project_name", validated.project_name)
      .maybeSingle();

    if (duplicateError) {
      console.error("verify_project_duplicate_lookup_failed", {
        userId: user.id,
        reason: duplicateError.message,
      });
      return errorResponse(500, "Unable to submit project. Please try again.");
    }

    if (duplicateProject) {
      return errorResponse(409, "A project with this name already exists.", "project_name");
    }

    const nowIso = new Date().toISOString();

    // TODO: Add dedicated columns on carbon_projects for seller metadata instead of storing it in review_notes JSON.
    const reviewNotesMetadata = JSON.stringify({
      submission_metadata: validated.metadata,
    });

    const { data: insertedProject, error: insertError } = await serviceClient
      .from("carbon_projects")
      .insert({
        user_id: user.id,
        project_name: validated.project_name,
        project_type: validated.project_type,
        latitude: validated.latitude,
        longitude: validated.longitude,
        land_area_hectares: validated.land_area_hectares,
        estimated_co2_per_year: validated.estimated_co2_per_year,
        project_start_date: validated.project_start_date,
        polygon_geojson: validated.polygon_geojson,
        document_path: validated.document_path,
        document_type: validated.document_type,
        review_notes: reviewNotesMetadata,
        status: "pending",
        submitted_at: nowIso,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("verify_project_insert_failed", {
        userId: user.id,
        reason: insertError.message,
      });
      return errorResponse(500, "Unable to submit project. Please try again.");
    }

    const typedInserted = insertedProject as InsertedProjectRow;
    const adminToken = randomBytes(32).toString("hex");
    const tokenExpiryIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: tokenUpdateError } = await serviceClient
      .from("carbon_projects")
      .update({
        admin_token: adminToken,
        admin_token_expires_at: tokenExpiryIso,
      })
      .eq("id", typedInserted.id);

    if (tokenUpdateError) {
      console.error("verify_project_admin_token_update_failed", {
        userId: user.id,
        projectId: typedInserted.id,
        reason: tokenUpdateError.message,
      });
      return errorResponse(500, "Unable to submit project. Please try again.");
    }

    const adminEmail = process.env.ADMIN_EMAIL?.trim() ?? "";
    if (adminEmail) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const approveUrl = `${baseUrl}/api/admin/project-review?action=approve&token=${adminToken}`;
      const rejectUrl = `${baseUrl}/api/admin/project-review?action=reject&token=${adminToken}`;

      try {
        await sendAdminReviewEmail({
          adminEmail,
          projectName: validated.project_name,
          projectType: validated.project_type,
          latitude: validated.latitude,
          longitude: validated.longitude,
          landAreaHectares: validated.land_area_hectares,
          estimatedCo2PerYear: validated.estimated_co2_per_year,
          submittedBy: user.email ?? "Unknown user",
          approveUrl,
          rejectUrl,
        });
      } catch (emailError) {
        console.error("verify_project_admin_email_failed", {
          projectId: typedInserted.id,
          reason: emailError instanceof Error ? emailError.message : "unknown_error",
        });
      }
    } else {
      console.error("verify_project_admin_email_missing");
    }

    return NextResponse.json(
      {
        success: true,
        message: "Project submitted for verification.",
        projectId: typedInserted.id,
        project_id: typedInserted.id,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("verify_project_unhandled_error", {
      reason: error instanceof Error ? error.message : "unknown_error",
    });
    return errorResponse(500, "Unable to submit project. Please try again.");
  }
}
