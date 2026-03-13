import { waitUntil } from "@vercel/functions";
import { NextRequest } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

type ProjectStatus =
  | "not_submitted"
  | "pending"
  | "verified"
  | "rejected"
  | "resubmit_required";

type ProjectType =
  | "forestry"
  | "agricultural"
  | "solar"
  | "methane"
  | "windmill"
  | "other";

type ProjectRow = {
  id: string;
  user_id: string;
  status: ProjectStatus;
  project_name: string | null;
  project_type: ProjectType | null;
  latitude: number | null;
  longitude: number | null;
  land_area_hectares: number | null;
  review_notes: string | null;
  admin_token: string | null;
  admin_token_expires_at: string | null;
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const RESEND_FROM = "ZeroCarbon <onboarding@resend.dev>";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderAdminHtmlPage(title: string, content: string, isError = false) {
  const accent = isError ? "#dc2626" : "#16a34a";
  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
    <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;">
      <section style="width:100%;max-width:620px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;box-shadow:0 12px 32px rgba(15,23,42,0.08);">
        <div style="color:#16a34a;font-weight:800;letter-spacing:0.08em;font-size:13px;margin-bottom:12px;">ZEROCARBON</div>
        <h1 style="margin:0 0 12px;color:${accent};font-size:24px;line-height:1.2;">${escapeHtml(title)}</h1>
        ${content}
      </section>
    </main>
  </body>
</html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}

function renderRejectForm(params: {
  token: string;
  projectName: string;
  projectType: string;
  error?: string;
  reason?: string;
}) {
  const errorHtml = params.error
    ? `<p style="margin:0 0 10px;color:#b91c1c;font-size:13px;">${escapeHtml(params.error)}</p>`
    : "";
  const reasonValue = params.reason ? escapeHtml(params.reason) : "";

  return renderAdminHtmlPage(
    "Reject Project Submission",
    `
      <p style="margin:0 0 12px;color:#334155;font-size:14px;">Provide a rejection reason so the project owner can resubmit correctly.</p>
      <div style="border:1px solid #e2e8f0;background:#f8fafc;border-radius:12px;padding:12px;margin-bottom:14px;">
        <p style="margin:0 0 6px;font-size:13px;"><strong>Project:</strong> ${escapeHtml(params.projectName)}</p>
        <p style="margin:0;font-size:13px;"><strong>Type:</strong> ${escapeHtml(params.projectType)}</p>
      </div>
      ${errorHtml}
      <form method="post" action="/api/admin/project-review" style="display:grid;gap:12px;">
        <input type="hidden" name="token" value="${escapeHtml(params.token)}" />
        <input type="hidden" name="action" value="reject" />
        <label style="display:grid;gap:8px;font-size:13px;color:#334155;">
          Rejection Reason (required, max 500 characters)
          <textarea name="reason" rows="6" maxlength="500" required placeholder="Explain what needs to be corrected so the project can be resubmitted..." style="resize:vertical;border:1px solid #cbd5e1;border-radius:10px;padding:10px;font-size:14px;font-family:Arial,sans-serif;">${reasonValue}</textarea>
        </label>
        <button type="submit" style="border:0;border-radius:10px;background:#dc2626;color:#ffffff;font-weight:700;padding:10px 14px;cursor:pointer;">Submit Rejection</button>
      </form>
    `,
    true,
  );
}

async function lookupProjectByToken(token: string): Promise<ProjectRow | null> {
  const serviceClient = createServiceSupabaseClient();
  const { data, error } = await serviceClient
    .from("carbon_projects")
    .select(
      "id, user_id, status, project_name, project_type, latitude, longitude, land_area_hectares, review_notes, admin_token, admin_token_expires_at",
    )
    .eq("admin_token", token)
    .maybeSingle();

  if (error) {
    console.error("admin_project_review_lookup_failed", {
      reason: error.message,
    });
    return null;
  }

  return (data ?? null) as ProjectRow | null;
}

function mergeRejectionReasonIntoReviewNotes(
  rawReviewNotes: string | null,
  rejectionReason: string,
): string {
  if (!rawReviewNotes) return rejectionReason;

  try {
    const parsed = JSON.parse(rawReviewNotes) as Record<string, unknown>;
    const submissionMetadata =
      parsed.submission_metadata &&
      typeof parsed.submission_metadata === "object"
        ? (parsed.submission_metadata as Record<string, unknown>)
        : {};

    return JSON.stringify({
      ...parsed,
      submission_metadata: {
        ...submissionMetadata,
        rejection_reason: rejectionReason,
      },
    });
  } catch {
    return rejectionReason;
  }
}

function isTokenExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  const timestamp = new Date(expiresAt).getTime();
  if (Number.isNaN(timestamp)) return true;
  return timestamp < Date.now();
}

async function getProfileEmail(userId: string): Promise<string | null> {
  const serviceClient = createServiceSupabaseClient();
  const { data, error } = await serviceClient
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("admin_project_review_profile_lookup_failed", {
      userId,
      reason: error.message,
    });
    return null;
  }

  const email = (data as { email?: string | null } | null)?.email ?? null;
  return email && email.trim().length > 0 ? email.trim() : null;
}

async function sendEmail(params: { to: string; subject: string; html: string }) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.error("admin_project_review_resend_key_missing");
    return;
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`resend_failed:${response.status}:${body.slice(0, 300)}`);
  }
}

async function triggerSatelliteAnalysis(params: {
  projectId: string;
  projectType: ProjectType;
  latitude: number;
  longitude: number;
  landAreaHectares: number;
}): Promise<void> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/satellite/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": process.env.INTERNAL_API_SECRET ?? "",
      },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      const details = body.error?.trim();
      throw new Error(
        details && details.length > 0
          ? `Satellite API returned ${response.status}: ${details}`
          : `Satellite API returned ${response.status}`,
      );
    }
  } catch (error) {
    console.error("satellite_trigger_failed", {
      projectId: params.projectId,
      reason: error instanceof Error ? error.message : "unknown_error",
    });

    try {
      const serviceClient = createServiceSupabaseClient();
      await serviceClient
        .from("carbon_projects")
        .update({
          satellite_status: "failed",
          satellite_error_message:
            error instanceof Error ? error.message : "Failed to trigger analysis",
          satellite_last_attempted_at: new Date().toISOString(),
        })
        .eq("id", params.projectId);
    } catch (updateError) {
      console.error("satellite_trigger_failure_update_failed", {
        projectId: params.projectId,
        reason: updateError instanceof Error ? updateError.message : "unknown_error",
      });
    }
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action")?.trim();
  const token = url.searchParams.get("token")?.trim();

  if (!action || !token) {
    return renderAdminHtmlPage("Invalid review link", "<p>Missing action or token.</p>", true);
  }

  if (action !== "approve" && action !== "reject") {
    return renderAdminHtmlPage("Invalid review link", "<p>Unsupported action.</p>", true);
  }

  const project = await lookupProjectByToken(token);
  if (!project) {
    return renderAdminHtmlPage(
      "Invalid or Expired Link",
      "<p>This review link is invalid or has already been used.</p>",
      true,
    );
  }

  if (isTokenExpired(project.admin_token_expires_at)) {
    return renderAdminHtmlPage(
      "Link Expired",
      "<p>This approval link has expired. Please ask the project owner to resubmit.</p>",
      true,
    );
  }

  if (project.status === "verified") {
    return renderAdminHtmlPage(
      "Already Approved",
      "<p>This project has already been approved.</p>",
    );
  }

  if (action === "approve") {
    const serviceClient = createServiceSupabaseClient();
    const nowIso = new Date().toISOString();
    const { error: approveError } = await serviceClient
      .from("carbon_projects")
      .update({
        status: "verified",
        reviewed_at: nowIso,
        satellite_status: "processing",
        admin_token: null,
        admin_token_expires_at: null,
      })
      .eq("id", project.id);

    if (approveError) {
      console.error("admin_project_review_approve_failed", {
        projectId: project.id,
        reason: approveError.message,
      });
      return renderAdminHtmlPage(
        "Approval Failed",
        "<p>Unable to approve this project right now. Please retry.</p>",
        true,
      );
    }

    const profileEmail = await getProfileEmail(project.user_id);
    if (profileEmail) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      try {
        await sendEmail({
          to: profileEmail,
          subject: "Your Project Has Been Verified - ZeroCarbon",
          html: `
<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
  <h2 style="margin:0 0 10px;color:#16a34a">Project Approved</h2>
  <p style="margin:0 0 8px;">Your project <strong>${escapeHtml(project.project_name ?? "your project")}</strong> has been approved by ZeroCarbon.</p>
  <p style="margin:0 0 14px;">Satellite verification is now running in the background.</p>
  <a href="${baseUrl}/dashboard/seller" style="background:#16a34a;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:700;display:inline-block;">Go to Dashboard</a>
</div>`,
        });
      } catch (emailError) {
        console.error("admin_project_review_approval_email_failed", {
          projectId: project.id,
          reason: emailError instanceof Error ? emailError.message : "unknown_error",
        });
      }
    }

    if (
      project.project_type &&
      project.latitude !== null &&
      project.longitude !== null &&
      project.land_area_hectares !== null
    ) {
      waitUntil(
        triggerSatelliteAnalysis({
          projectId: project.id,
          projectType: project.project_type,
          latitude: Number(project.latitude),
          longitude: Number(project.longitude),
          landAreaHectares: Number(project.land_area_hectares),
        }),
      );
    } else {
      waitUntil(
        triggerSatelliteAnalysis({
          projectId: project.id,
          projectType: "other",
          latitude: Number(project.latitude ?? 0),
          longitude: Number(project.longitude ?? 0),
          landAreaHectares: Number(project.land_area_hectares ?? 1),
        }),
      );
    }

    return renderAdminHtmlPage(
      "Project Approved",
      `<p>You have approved <strong>${escapeHtml(project.project_name ?? "this project")}</strong>.</p><p>Satellite verification is now running in the background.</p>`,
    );
  }

  if (project.status === "rejected") {
    return renderAdminHtmlPage(
      "Already Rejected",
      "<p>This project has already been rejected.</p>",
      true,
    );
  }

  return renderRejectForm({
    token,
    projectName: project.project_name ?? "Unknown project",
    projectType: project.project_type ?? "Unknown",
  });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const action = String(formData.get("action") ?? "").trim();
  const token = String(formData.get("token") ?? "").trim();
  const rawReason = String(formData.get("reason") ?? "");

  if (action !== "reject" || !token) {
    return renderAdminHtmlPage("Invalid submission", "<p>Invalid reject form payload.</p>", true);
  }

  const project = await lookupProjectByToken(token);
  if (!project) {
    return renderAdminHtmlPage(
      "Invalid or Expired Link",
      "<p>This review link is invalid or has already been used.</p>",
      true,
    );
  }

  if (isTokenExpired(project.admin_token_expires_at)) {
    return renderAdminHtmlPage(
      "Link Expired",
      "<p>This approval link has expired. Please ask the project owner to resubmit.</p>",
      true,
    );
  }

  if (project.status === "verified") {
    return renderAdminHtmlPage(
      "Already Approved",
      "<p>This project has already been approved.</p>",
      true,
    );
  }

  const sanitizedReason = rawReason.replace(/<[^>]*>/g, "").trim();
  if (!sanitizedReason) {
    return renderRejectForm({
      token,
      projectName: project.project_name ?? "Unknown project",
      projectType: project.project_type ?? "Unknown",
      error: "Please provide a rejection reason.",
      reason: rawReason,
    });
  }

  const clippedReason = sanitizedReason.slice(0, 500);
  const nextReviewNotes = mergeRejectionReasonIntoReviewNotes(
    project.review_notes,
    clippedReason,
  );
  const serviceClient = createServiceSupabaseClient();
  const nowIso = new Date().toISOString();

  const { error: rejectError } = await serviceClient
    .from("carbon_projects")
    .update({
      status: "rejected",
      review_notes: nextReviewNotes,
      reviewed_at: nowIso,
      admin_token: null,
      admin_token_expires_at: null,
    })
    .eq("id", project.id);

  if (rejectError) {
    console.error("admin_project_review_reject_failed", {
      projectId: project.id,
      reason: rejectError.message,
    });
    return renderAdminHtmlPage(
      "Rejection Failed",
      "<p>Unable to reject this project right now. Please retry.</p>",
      true,
    );
  }

  const profileEmail = await getProfileEmail(project.user_id);
  if (profileEmail) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    try {
      await sendEmail({
        to: profileEmail,
        subject: "Action Required - Project Submission Update",
        html: `
<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
  <h2 style="margin:0 0 10px;color:#dc2626">Project Submission Requires Attention</h2>
  <p style="margin:0 0 8px;">Your project <strong>${escapeHtml(project.project_name ?? "your project")}</strong> was reviewed and requires updates.</p>
  <p style="margin:0 0 6px;"><strong>Reason:</strong></p>
  <div style="border:1px solid #fecaca;background:#fef2f2;border-radius:8px;padding:10px;margin:0 0 12px;">${escapeHtml(clippedReason)}</div>
  <p style="margin:0 0 14px;">Please address the feedback and resubmit your project.</p>
  <a href="${baseUrl}/verify-project" style="background:#16a34a;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:700;display:inline-block;">Resubmit Project</a>
</div>`,
      });
    } catch (emailError) {
      console.error("admin_project_review_rejection_email_failed", {
        projectId: project.id,
        reason: emailError instanceof Error ? emailError.message : "unknown_error",
      });
    }
  }

  return renderAdminHtmlPage(
    "Project Rejected",
    `<p>Rejection reason has been recorded for <strong>${escapeHtml(project.project_name ?? "this project")}</strong>.</p><p>The project owner has been notified.</p>`,
    true,
  );
}
