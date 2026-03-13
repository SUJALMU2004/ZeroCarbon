import { NextResponse } from "next/server";
import { runForestryNdviAnalysis } from "@/lib/gee/ndvi-analysis";
import { runLocationAnalysis } from "@/lib/gee/location-analysis";
import {
  calculateForestryConfidence,
  calculateLocationConfidence,
} from "@/lib/gee/confidence-calculator";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

type ProjectType =
  | "forestry"
  | "agricultural"
  | "solar"
  | "methane"
  | "windmill"
  | "other";

type AnalyzePayload = {
  projectId?: unknown;
  projectType?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  landAreaHectares?: unknown;
};

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value.trim());
  return Number.NaN;
}

function parsePayload(payload: AnalyzePayload): {
  projectId: string;
  projectType: ProjectType;
  latitude: number;
  longitude: number;
  landAreaHectares: number;
} | null {
  const projectId = typeof payload.projectId === "string" ? payload.projectId.trim() : "";
  const projectType = typeof payload.projectType === "string" ? payload.projectType.trim() : "";
  const latitude = toNumber(payload.latitude);
  const longitude = toNumber(payload.longitude);
  const landAreaHectares = toNumber(payload.landAreaHectares);

  if (!projectId) return null;
  if (
    !["forestry", "agricultural", "solar", "methane", "windmill", "other"].includes(
      projectType,
    )
  ) {
    return null;
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (!Number.isFinite(landAreaHectares) || landAreaHectares <= 0) return null;

  return {
    projectId,
    projectType: projectType as ProjectType,
    latitude,
    longitude,
    landAreaHectares,
  };
}

export async function POST(request: Request) {
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? "";
  const providedSecret = request.headers.get("x-internal-secret") ?? "";
  if (providedSecret !== expectedSecret) {
    return unauthorized();
  }

  let rawPayload: AnalyzePayload;
  try {
    rawPayload = (await request.json()) as AnalyzePayload;
  } catch {
    return badRequest("Invalid request payload.");
  }

  const payload = parsePayload(rawPayload);
  if (!payload) {
    return badRequest("Invalid analysis payload.");
  }

  const serviceClient = createServiceSupabaseClient();
  const nowIso = new Date().toISOString();

  await serviceClient
    .from("carbon_projects")
    .update({
      satellite_status: "processing",
      satellite_last_attempted_at: nowIso,
    })
    .eq("id", payload.projectId);

  try {
    if (
      payload.projectType === "forestry" ||
      payload.projectType === "agricultural"
    ) {
      const result = await runForestryNdviAnalysis({
        latitude: payload.latitude,
        longitude: payload.longitude,
        landAreaHectares: payload.landAreaHectares,
        projectId: payload.projectId,
      });

      const confidence = calculateForestryConfidence(
        result.ndvi_current,
        result.ndvi_trend,
      );

      const { error: updateError } = await serviceClient
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
        })
        .eq("id", payload.projectId);

      if (updateError) {
        throw new Error(updateError.message);
      }
    } else {
      const result = await runLocationAnalysis({
        latitude: payload.latitude,
        longitude: payload.longitude,
        projectId: payload.projectId,
      });

      const confidence = calculateLocationConfidence(result.imagery_quality);

      const { error: updateError } = await serviceClient
        .from("carbon_projects")
        .update({
          satellite_status: "completed",
          satellite_confidence_score: confidence.score,
          satellite_confidence_badge: confidence.badge,
          satellite_thumbnail_url: result.thumbnail_url,
          satellite_verified_at: new Date().toISOString(),
          satellite_raw_response: result.raw_response,
          satellite_error_message: null,
        })
        .eq("id", payload.projectId);

      if (updateError) {
        throw new Error(updateError.message);
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await serviceClient
      .from("carbon_projects")
      .update({
        satellite_status: "failed",
        satellite_error_message: message,
        satellite_last_attempted_at: new Date().toISOString(),
      })
      .eq("id", payload.projectId);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
