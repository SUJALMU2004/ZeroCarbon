import { NextRequest } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

type IdentityStatus =
  | "not_submitted"
  | "pending"
  | "verified"
  | "rejected"
  | "resubmit_required";

type CompanyRow = {
  id: string;
  user_id: string;
  status: IdentityStatus;
  legal_company_name: string | null;
  country: string | null;
  business_email: string | null;
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
  companyName: string;
  companyEmail: string;
  companyCountry: string;
  error?: string;
  reason?: string;
}) {
  const errorHtml = params.error
    ? `<p style="margin:0 0 10px;color:#b91c1c;font-size:13px;">${escapeHtml(params.error)}</p>`
    : "";

  const reasonValue = params.reason ? escapeHtml(params.reason) : "";

  return renderAdminHtmlPage(
    "Reject Company Registration",
    `
      <p style="margin:0 0 12px;color:#334155;font-size:14px;">Provide a rejection reason so the applicant can resubmit correctly.</p>
      <div style="border:1px solid #e2e8f0;background:#f8fafc;border-radius:12px;padding:12px;margin-bottom:14px;">
        <p style="margin:0 0 6px;font-size:13px;"><strong>Company:</strong> ${escapeHtml(params.companyName)}</p>
        <p style="margin:0 0 6px;font-size:13px;"><strong>Business Email:</strong> ${escapeHtml(params.companyEmail)}</p>
        <p style="margin:0;font-size:13px;"><strong>Country:</strong> ${escapeHtml(params.companyCountry)}</p>
      </div>
      ${errorHtml}
      <form method="post" action="/api/admin/company-review" style="display:grid;gap:12px;">
        <input type="hidden" name="token" value="${escapeHtml(params.token)}" />
        <input type="hidden" name="action" value="reject" />
        <label style="display:grid;gap:8px;font-size:13px;color:#334155;">
          Rejection Reason (required, max 500 characters)
          <textarea name="reason" rows="6" maxlength="500" required placeholder="Explain what needs to be corrected so the user can resubmit..." style="resize:vertical;border:1px solid #cbd5e1;border-radius:10px;padding:10px;font-size:14px;font-family:Arial,sans-serif;">${reasonValue}</textarea>
        </label>
        <button type="submit" style="border:0;border-radius:10px;background:#dc2626;color:#ffffff;font-weight:700;padding:10px 14px;cursor:pointer;">Submit Rejection</button>
      </form>
    `,
    true,
  );
}

async function lookupCompanyByToken(token: string): Promise<CompanyRow | null> {
  const serviceClient = createServiceSupabaseClient();
  const { data, error } = await serviceClient
    .from("companies")
    .select(
      "id, user_id, status, legal_company_name, country, business_email, admin_token, admin_token_expires_at",
    )
    .eq("admin_token", token)
    .maybeSingle();

  if (error) {
    console.error("admin_company_review_lookup_failed", {
      reason: error.message,
    });
    return null;
  }

  return (data ?? null) as CompanyRow | null;
}

function isTokenExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true;

  const timestamp = new Date(expiresAt).getTime();
  if (Number.isNaN(timestamp)) return true;

  return timestamp < Date.now();
}

async function sendUserEmail(params: {
  to: string;
  subject: string;
  html: string;
}) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.error("admin_company_review_resend_key_missing");
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

async function getProfileEmail(userId: string): Promise<string | null> {
  const serviceClient = createServiceSupabaseClient();
  const { data, error } = await serviceClient
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("admin_company_review_profile_lookup_failed", {
      userId,
      reason: error.message,
    });
    return null;
  }

  const email = (data as { email?: string | null } | null)?.email ?? null;
  return email && email.trim().length > 0 ? email.trim() : null;
}

async function approveCompany(company: CompanyRow) {
  const serviceClient = createServiceSupabaseClient();
  const { error } = await serviceClient
    .from("companies")
    .update({
      status: "verified",
      reviewed_at: new Date().toISOString(),
      admin_token: null,
      admin_token_expires_at: null,
      rejection_reason: null,
      rejection_reason_updated_at: null,
    })
    .eq("id", company.id);

  if (error) {
    throw new Error(error.message);
  }
}

async function rejectCompany(company: CompanyRow, rejectionReason: string) {
  const serviceClient = createServiceSupabaseClient();
  const now = new Date().toISOString();

  const { error } = await serviceClient
    .from("companies")
    .update({
      status: "rejected",
      rejection_reason: rejectionReason,
      rejection_reason_updated_at: now,
      reviewed_at: now,
      admin_token: null,
      admin_token_expires_at: null,
    })
    .eq("id", company.id);

  if (error) {
    throw new Error(error.message);
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

  const company = await lookupCompanyByToken(token);
  if (!company) {
    return renderAdminHtmlPage(
      "Invalid or Expired Link",
      "<p>This review link is invalid or has already been used.</p>",
      true,
    );
  }

  if (isTokenExpired(company.admin_token_expires_at)) {
    return renderAdminHtmlPage(
      "Link Expired",
      "<p>This approval link has expired. Please ask the applicant to resubmit.</p>",
      true,
    );
  }

  if (action === "approve") {
    if (company.status === "verified") {
      return renderAdminHtmlPage(
        "Already Approved",
        "<p>This company has already been approved.</p>",
      );
    }

    try {
      await approveCompany(company);

      const profileEmail = await getProfileEmail(company.user_id);
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      if (profileEmail) {
        try {
          await sendUserEmail({
            to: profileEmail,
            subject: "Your Company Has Been Verified - ZeroCarbon",
            html: `
<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
  <h2 style="margin:0 0 10px;color:#16a34a">Congratulations!</h2>
  <p style="margin:0 0 8px;">Your company <strong>${escapeHtml(company.legal_company_name ?? "your company")}</strong> has been verified on ZeroCarbon.</p>
  <p style="margin:0 0 14px;">You can now access full marketplace features, calculate emissions, and purchase carbon credits.</p>
  <a href="${baseUrl}/dashboard/buyer" style="background:#16a34a;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:700;display:inline-block;">Go to Dashboard</a>
</div>`,
          });
        } catch (emailError) {
          console.error("admin_company_review_approval_email_failed", {
            userId: company.user_id,
            reason: emailError instanceof Error ? emailError.message : "unknown_error",
          });
        }
      }

      return renderAdminHtmlPage(
        "Company Approved",
        `<p>You have approved <strong>${escapeHtml(company.legal_company_name ?? "this company")}</strong>.</p><p>A confirmation email has been sent to the company.</p>`,
      );
    } catch (error) {
      console.error("admin_company_review_approve_failed", {
        companyId: company.id,
        reason: error instanceof Error ? error.message : "unknown_error",
      });
      return renderAdminHtmlPage(
        "Approval Failed",
        "<p>Unable to approve this company right now. Please retry.</p>",
        true,
      );
    }
  }

  if (company.status === "rejected") {
    return renderAdminHtmlPage(
      "Already Rejected",
      "<p>This company has already been rejected.</p>",
      true,
    );
  }

  return renderRejectForm({
    token,
    companyName: company.legal_company_name ?? "Unknown company",
    companyEmail: company.business_email ?? "Not provided",
    companyCountry: company.country ?? "Not provided",
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

  const company = await lookupCompanyByToken(token);
  if (!company) {
    return renderAdminHtmlPage(
      "Invalid or Expired Link",
      "<p>This review link is invalid or has already been used.</p>",
      true,
    );
  }

  if (isTokenExpired(company.admin_token_expires_at)) {
    return renderAdminHtmlPage(
      "Link Expired",
      "<p>This approval link has expired. Please ask the applicant to resubmit.</p>",
      true,
    );
  }

  if (company.status === "verified") {
    return renderAdminHtmlPage(
      "Already Approved",
      "<p>This company has already been approved.</p>",
      true,
    );
  }

  const sanitizedReason = rawReason.replace(/<[^>]*>/g, "").trim();
  if (!sanitizedReason) {
    return renderRejectForm({
      token,
      companyName: company.legal_company_name ?? "Unknown company",
      companyEmail: company.business_email ?? "Not provided",
      companyCountry: company.country ?? "Not provided",
      error: "Please provide a rejection reason.",
      reason: rawReason,
    });
  }

  if (sanitizedReason.length > 500) {
    return renderRejectForm({
      token,
      companyName: company.legal_company_name ?? "Unknown company",
      companyEmail: company.business_email ?? "Not provided",
      companyCountry: company.country ?? "Not provided",
      error: "Rejection reason must be 500 characters or fewer.",
      reason: rawReason,
    });
  }

  try {
    await rejectCompany(company, sanitizedReason);

    const profileEmail = await getProfileEmail(company.user_id);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    if (profileEmail) {
      try {
        await sendUserEmail({
          to: profileEmail,
          subject: "Action Required - Company Registration Update",
          html: `
<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
  <h2 style="margin:0 0 10px;color:#dc2626">Company Registration Requires Attention</h2>
  <p style="margin:0 0 8px;">Your company registration for <strong>${escapeHtml(company.legal_company_name ?? "your company")}</strong> was reviewed and requires updates.</p>
  <p style="margin:0 0 6px;"><strong>Reason:</strong></p>
  <div style="border:1px solid #fecaca;background:#fef2f2;border-radius:8px;padding:10px;margin:0 0 12px;">${escapeHtml(sanitizedReason)}</div>
  <p style="margin:0 0 14px;">Please review the feedback and resubmit your company registration.</p>
  <a href="${baseUrl}/verify-company" style="background:#16a34a;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:700;display:inline-block;">Update Registration</a>
</div>`,
        });
      } catch (emailError) {
        console.error("admin_company_review_rejection_email_failed", {
          userId: company.user_id,
          reason: emailError instanceof Error ? emailError.message : "unknown_error",
        });
      }
    }

    return renderAdminHtmlPage(
      "Company Registration Rejected",
      `<p>Rejection reason has been recorded for <strong>${escapeHtml(company.legal_company_name ?? "this company")}</strong>.</p><p>The applicant has been notified.</p>`,
      true,
    );
  } catch (error) {
    console.error("admin_company_review_reject_failed", {
      companyId: company.id,
      reason: error instanceof Error ? error.message : "unknown_error",
    });
    return renderAdminHtmlPage(
      "Rejection Failed",
      "<p>Unable to reject this company right now. Please retry.</p>",
      true,
    );
  }
}

