import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { getProjectReference } from "@/lib/utils/projectReference";

type RequestEditPayload = {
  reason?: unknown;
};

type ProjectRow = {
  id: string;
  user_id: string;
  status: string | null;
  project_name: string | null;
  created_at: string | null;
  edit_permitted: boolean | null;
};

type ProfileRow = {
  full_name: string | null;
  email: string | null;
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

function normalizeReason(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function invalid(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function sendEditRequestEmail(params: {
  projectName: string;
  projectReference: string;
  sellerName: string;
  sellerEmail: string;
  reason: string;
  approveUrl: string;
}) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!resendApiKey || !adminEmail) {
    console.error("request_edit_email_config_missing", {
      hasResendApiKey: Boolean(resendApiKey),
      hasAdminEmail: Boolean(adminEmail),
    });
    return;
  }

  const html = `
<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
  <h2 style="margin:0 0 10px;color:#16a34a">Edit Permission Request</h2>
  <table style="width:100%;border-collapse:collapse;margin:0 0 16px;">
    <tr><td style="padding:6px 0;color:#475569;font-weight:600;">Project</td><td style="padding:6px 0;">${escapeHtml(params.projectName)}</td></tr>
    <tr><td style="padding:6px 0;color:#475569;font-weight:600;">Reference</td><td style="padding:6px 0;">${escapeHtml(params.projectReference)}</td></tr>
    <tr><td style="padding:6px 0;color:#475569;font-weight:600;">Seller</td><td style="padding:6px 0;">${escapeHtml(params.sellerName)}</td></tr>
    <tr><td style="padding:6px 0;color:#475569;font-weight:600;">Seller Email</td><td style="padding:6px 0;">${escapeHtml(params.sellerEmail)}</td></tr>
  </table>

  <p style="margin:0 0 8px;font-weight:600;color:#475569;">Reason</p>
  <div style="border:1px solid #e2e8f0;background:#f8fafc;border-radius:8px;padding:10px;margin:0 0 16px;">${escapeHtml(params.reason)}</div>

  <a href="${params.approveUrl}" style="background:#16a34a;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:700;display:inline-block;">Grant Edit Access</a>
  <p style="margin:10px 0 0;color:#64748b;font-size:13px;">This link expires in 72 hours.</p>
</div>`;

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [adminEmail],
      subject: `Edit Permission Request - ${params.projectName}`,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`resend_failed:${response.status}:${body.slice(0, 300)}`);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return invalid("Unauthorized.", 401);
  }

  const params = await Promise.resolve(context.params);
  const projectId = params.id;
  if (!projectId) {
    return invalid("Project ID is required.", 400);
  }

  let payload: RequestEditPayload;
  try {
    payload = (await request.json()) as RequestEditPayload;
  } catch {
    return invalid("Invalid request payload.", 400);
  }

  const reason = normalizeReason(payload.reason);
  if (reason.length < 10 || reason.length > 500) {
    return invalid("Reason must be between 10 and 500 characters.", 400);
  }

  const serviceClient = createServiceSupabaseClient();
  const { data: projectData, error: projectError } = await serviceClient
    .from("carbon_projects")
    .select("id, user_id, status, project_name, created_at, edit_permitted")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    console.error("request_edit_project_query_failed", {
      userId: user.id,
      projectId,
      reason: projectError.message,
    });
    return invalid("Unable to process request.", 500);
  }

  const project = (projectData ?? null) as ProjectRow | null;
  if (!project || project.user_id !== user.id) {
    return invalid("Project not found.", 404);
  }

  if (project.status !== "verified") {
    return invalid("Edit requests are allowed only for verified projects.", 409);
  }

  if (project.edit_permitted) {
    return invalid("Edit access is already enabled for this project.", 409);
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
  const requestedAt = new Date().toISOString();

  const { error: updateError } = await serviceClient
    .from("carbon_projects")
    .update({
      edit_token: token,
      edit_token_expires_at: expiresAt,
      edit_requested_at: requestedAt,
      edit_request_reason: reason,
    })
    .eq("id", project.id)
    .eq("user_id", user.id);

  if (updateError) {
    console.error("request_edit_project_update_failed", {
      userId: user.id,
      projectId,
      reason: updateError.message,
    });
    return invalid("Unable to save edit request.", 500);
  }

  const { data: profileData } = await serviceClient
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const profile = (profileData ?? null) as ProfileRow | null;
  const sellerName = profile?.full_name?.trim() || user.email || "Unknown Seller";
  const sellerEmail = profile?.email?.trim() || user.email || "Unknown Email";

  const createdAt = project.created_at ?? requestedAt;
  const reference = getProjectReference(project.id, createdAt);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const approveUrl = `${baseUrl}/api/projects/grant-edit?token=${encodeURIComponent(token)}`;

  try {
    await sendEditRequestEmail({
      projectName: project.project_name ?? "Untitled Project",
      projectReference: reference,
      sellerName,
      sellerEmail,
      reason,
      approveUrl,
    });
  } catch (emailError) {
    console.error("request_edit_email_failed", {
      projectId: project.id,
      reason: emailError instanceof Error ? emailError.message : "unknown_error",
    });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}

