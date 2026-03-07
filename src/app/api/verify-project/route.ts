import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeOptionalText } from "@/lib/profile/identity-validation";

const PROJECT_TYPES = ["forestry", "solar", "methane", "other"] as const;
const DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const RESEND_FROM = "ZeroCarbon <onboarding@resend.dev>";

type VerifyProjectPayload = {
  project_name?: unknown;
  project_type?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  land_area_hectares?: unknown;
  estimated_co2_per_year?: unknown;
  project_start_date?: unknown;
  document_path?: unknown;
  document_type?: unknown;
};

type InsertedProjectRow = {
  id: string;
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
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value.trim());
  }

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

function parseAndValidatePayload(payload: VerifyProjectPayload): {
  project_name: string;
  project_type: (typeof PROJECT_TYPES)[number];
  latitude: number;
  longitude: number;
  land_area_hectares: number;
  estimated_co2_per_year: number;
  project_start_date: string;
  document_path: string | null;
  document_type: (typeof DOCUMENT_TYPES)[number] | null;
} | {
  error: string;
  field: string;
} {
  const projectName = normalizeOptionalText(payload.project_name);
  if (!projectName || projectName.length < 2 || projectName.length > 200) {
    return {
      error: "Project name must be between 2 and 200 characters.",
      field: "project_name",
    };
  }

  const projectType = normalizeOptionalText(payload.project_type);
  if (!projectType || !PROJECT_TYPES.includes(projectType as (typeof PROJECT_TYPES)[number])) {
    return {
      error: "Please select a valid project type.",
      field: "project_type",
    };
  }

  const latitude = toNumber(payload.latitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return {
      error: "Latitude must be a valid number between -90 and 90.",
      field: "latitude",
    };
  }

  const longitude = toNumber(payload.longitude);
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return {
      error: "Longitude must be a valid number between -180 and 180.",
      field: "longitude",
    };
  }

  const landArea = toNumber(payload.land_area_hectares);
  if (!Number.isFinite(landArea) || landArea <= 0 || landArea > 10000000) {
    return {
      error: "Land area must be a positive number up to 10,000,000.",
      field: "land_area_hectares",
    };
  }

  const estimatedCo2 = toNumber(payload.estimated_co2_per_year);
  if (!Number.isFinite(estimatedCo2) || estimatedCo2 <= 0 || estimatedCo2 > 1000000000) {
    return {
      error: "Estimated CO2 reduction must be a positive number up to 1,000,000,000.",
      field: "estimated_co2_per_year",
    };
  }

  const projectStartDate = normalizeOptionalText(payload.project_start_date);
  if (!projectStartDate) {
    return {
      error: "Project start date is required.",
      field: "project_start_date",
    };
  }

  const parsedDate = parseDate(projectStartDate);
  if (!parsedDate) {
    return {
      error: "Project start date must be a valid date.",
      field: "project_start_date",
    };
  }

  const minDate = new Date(Date.UTC(1990, 0, 1));
  if (parsedDate.getTime() < minDate.getTime()) {
    return {
      error: "Project start date must be after 1990-01-01.",
      field: "project_start_date",
    };
  }

  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (parsedDate.getTime() > todayUtc.getTime()) {
    return {
      error: "Project start date cannot be in the future.",
      field: "project_start_date",
    };
  }

  const documentPath = normalizeOptionalText(payload.document_path);
  if (documentPath && documentPath.length > 1000) {
    return {
      error: "Document path is too long.",
      field: "document_path",
    };
  }

  const documentType = normalizeOptionalText(payload.document_type);
  if (
    documentType &&
    !DOCUMENT_TYPES.includes(documentType as (typeof DOCUMENT_TYPES)[number])
  ) {
    return {
      error: "Document type is invalid.",
      field: "document_type",
    };
  }

  return {
    project_name: projectName,
    project_type: projectType as (typeof PROJECT_TYPES)[number],
    latitude,
    longitude,
    land_area_hectares: landArea,
    estimated_co2_per_year: estimatedCo2,
    project_start_date: projectStartDate,
    document_path: documentPath ?? null,
    document_type: (documentType as (typeof DOCUMENT_TYPES)[number] | null) ?? null,
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
        document_path: validated.document_path,
        document_type: validated.document_type,
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
