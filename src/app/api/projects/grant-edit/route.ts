import { createServiceSupabaseClient } from "@/lib/supabase/service";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const RESEND_FROM = "ZeroCarbon <onboarding@resend.dev>";

type ProjectRow = {
  id: string;
  user_id: string;
  project_name: string | null;
  edit_token: string | null;
  edit_token_expires_at: string | null;
};

type ProfileRow = {
  email: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderHtmlPage(title: string, body: string, isError = false) {
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
        ${body}
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

async function sendSellerEmail(params: {
  to: string;
  projectName: string;
  projectLink: string;
}) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.error("grant_edit_resend_key_missing");
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
      subject: `Edit Access Granted - ${params.projectName}`,
      html: `
<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
  <h2 style="margin:0 0 10px;color:#16a34a">Edit Access Granted</h2>
  <p style="margin:0 0 10px;">Your request to edit <strong>${escapeHtml(params.projectName)}</strong> has been approved.</p>
  <p style="margin:0 0 14px;">Log in to make your changes. Edit access is one-time and will be revoked after you save.</p>
  <a href="${params.projectLink}" style="background:#16a34a;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:700;display:inline-block;">Open Project</a>
</div>`,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`resend_failed:${response.status}:${body.slice(0, 300)}`);
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim() ?? "";

  if (!token) {
    return renderHtmlPage(
      "Invalid approval link",
      "<p>Missing token. Please use a valid email link.</p>",
      true,
    );
  }

  const serviceClient = createServiceSupabaseClient();
  const { data: projectData, error: projectError } = await serviceClient
    .from("carbon_projects")
    .select("id, user_id, project_name, edit_token, edit_token_expires_at")
    .eq("edit_token", token)
    .maybeSingle();

  if (projectError) {
    console.error("grant_edit_project_query_failed", {
      reason: projectError.message,
    });
    return renderHtmlPage(
      "Approval failed",
      "<p>Unable to validate this token right now. Please retry.</p>",
      true,
    );
  }

  const project = (projectData ?? null) as ProjectRow | null;
  if (!project) {
    return renderHtmlPage(
      "Invalid or expired link",
      "<p>This link is invalid or has already been used.</p>",
      true,
    );
  }

  const expiry = project.edit_token_expires_at
    ? new Date(project.edit_token_expires_at).getTime()
    : Number.NaN;

  if (Number.isNaN(expiry) || expiry < Date.now()) {
    return renderHtmlPage(
      "Invalid or expired link",
      "<p>This link is invalid or has expired.</p>",
      true,
    );
  }

  const { error: updateError } = await serviceClient
    .from("carbon_projects")
    .update({
      edit_permitted: true,
      edit_token: null,
      edit_token_expires_at: null,
    })
    .eq("id", project.id)
    .eq("edit_token", token);

  if (updateError) {
    console.error("grant_edit_project_update_failed", {
      projectId: project.id,
      reason: updateError.message,
    });
    return renderHtmlPage(
      "Approval failed",
      "<p>Unable to grant edit permission right now. Please retry.</p>",
      true,
    );
  }

  const { data: profileData } = await serviceClient
    .from("profiles")
    .select("email")
    .eq("id", project.user_id)
    .maybeSingle();

  const profile = (profileData ?? null) as ProfileRow | null;
  const sellerEmail = profile?.email?.trim();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const projectLink = `${baseUrl}/dashboard/seller/projects/${project.id}`;

  if (sellerEmail) {
    try {
      await sendSellerEmail({
        to: sellerEmail,
        projectName: project.project_name ?? "Your project",
        projectLink,
      });
    } catch (emailError) {
      console.error("grant_edit_notify_seller_failed", {
        projectId: project.id,
        reason: emailError instanceof Error ? emailError.message : "unknown_error",
      });
    }
  }

  return renderHtmlPage(
    "Edit permission granted",
    "<p>Edit permission has been granted. The seller has been notified by email.</p>",
  );
}



