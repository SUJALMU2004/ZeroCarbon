import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { COUNTRIES } from "@/lib/data/countries";
import {
  BLOCKED_EMAIL_MESSAGE,
  isBlockedEmailDomain,
} from "@/lib/validation/blocked-email-domains";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type IdentityStatus =
  | "not_submitted"
  | "pending"
  | "verified"
  | "rejected"
  | "resubmit_required";

type CompanyStatus = IdentityStatus;

type VerifyCompanyPayload = {
  legal_company_name?: unknown;
  registration_number?: unknown;
  country?: unknown;
  official_website?: unknown;
  business_email?: unknown;
  industry_type?: unknown;
  custom_industry_text?: unknown;
  company_size?: unknown;
};

type ExistingCompanyRow = {
  id: string;
  status: CompanyStatus;
  submitted_at: string | null;
};

type ProfileGateRow = {
  phone_verified: boolean | null;
  verification_status: IdentityStatus | null;
};

const INDUSTRY_TYPES = [
  "Manufacturing",
  "Technology",
  "Logistics",
  "Energy",
  "Retail",
  "Agriculture",
  "Finance",
  "Other",
] as const;

const COMPANY_SIZES = ["1–10", "10–50", "50–200", "200–1000", "1000+"] as const;
const RESUBMIT_WINDOW_SECONDS = 60;
const RESEND_ENDPOINT = "https://api.resend.com/emails";
const RESEND_FROM = "ZeroCarbon <onboarding@resend.dev>";

function errorResponse(
  status: number,
  payload: {
    error: string;
    field?: string;
    code?: string;
    message?: string;
  },
) {
  return NextResponse.json(payload, { status });
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function validatePayload(payload: VerifyCompanyPayload):
  | {
      legal_company_name: string;
      registration_number: string;
      country: string;
      official_website: string;
      business_email: string;
      industry_type: (typeof INDUSTRY_TYPES)[number];
      custom_industry_text: string | null;
      company_size: (typeof COMPANY_SIZES)[number];
    }
  | {
      error: string;
      field?: string;
      code?: string;
    } {
  const legalCompanyName = normalizeText(payload.legal_company_name);
  if (!legalCompanyName || legalCompanyName.length < 2 || legalCompanyName.length > 200) {
    return { error: "Legal company name must be between 2 and 200 characters.", field: "legal_company_name" };
  }

  if (!/^[A-Za-z0-9 .,&'()\/-]+$/.test(legalCompanyName)) {
    return {
      error: "Legal company name contains unsupported characters.",
      field: "legal_company_name",
    };
  }

  const registrationNumber = normalizeText(payload.registration_number);
  if (!registrationNumber || registrationNumber.length < 2 || registrationNumber.length > 100) {
    return {
      error: "Registration number must be between 2 and 100 characters.",
      field: "registration_number",
    };
  }

  if (!/^[A-Za-z0-9\-/\s]+$/.test(registrationNumber)) {
    return {
      error: "Registration number contains unsupported characters.",
      field: "registration_number",
    };
  }

  const country = normalizeText(payload.country);
  if (!country || country.length > 100) {
    return { error: "Please select a valid country.", field: "country" };
  }

  if (!COUNTRIES.includes(country)) {
    console.warn("verify_company_country_not_in_reference_list", { country });
  }

  const industryType = normalizeText(payload.industry_type);
  if (!INDUSTRY_TYPES.includes(industryType as (typeof INDUSTRY_TYPES)[number])) {
    return { error: "Please select a valid industry.", field: "industry_type" };
  }

  const customIndustryTextInput = normalizeText(payload.custom_industry_text);
  let customIndustryText: string | null = null;
  if (industryType === "Other") {
    if (!customIndustryTextInput || customIndustryTextInput.length < 2 || customIndustryTextInput.length > 100) {
      return {
        error: "Please provide a custom industry description between 2 and 100 characters.",
        field: "custom_industry_text",
      };
    }
    customIndustryText = customIndustryTextInput;
  }

  const companySize = normalizeText(payload.company_size);
  if (!COMPANY_SIZES.includes(companySize as (typeof COMPANY_SIZES)[number])) {
    return { error: "Please select a valid company size.", field: "company_size" };
  }

  const officialWebsite = normalizeText(payload.official_website);
  if (!officialWebsite || officialWebsite.length > 500) {
    return { error: "Official website is required and must be 500 characters or fewer.", field: "official_website" };
  }

  if (!officialWebsite.startsWith("http://") && !officialWebsite.startsWith("https://")) {
    return {
      error: "Official website must start with https:// or http://.",
      field: "official_website",
    };
  }

  try {
    const parsed = new URL(officialWebsite);
    if (!parsed.hostname || !parsed.hostname.includes(".")) {
      return { error: "Official website must include a valid domain.", field: "official_website" };
    }
  } catch {
    return { error: "Official website must be a valid URL.", field: "official_website" };
  }

  const businessEmail = normalizeText(payload.business_email).toLowerCase();
  if (!businessEmail || businessEmail.length > 254) {
    return {
      error: "Business email is required and must be 254 characters or fewer.",
      field: "business_email",
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(businessEmail)) {
    return { error: "Please enter a valid email address.", field: "business_email" };
  }

  if (isBlockedEmailDomain(businessEmail)) {
    return { error: BLOCKED_EMAIL_MESSAGE, field: "business_email" };
  }

  return {
    legal_company_name: legalCompanyName,
    registration_number: registrationNumber,
    country,
    official_website: officialWebsite,
    business_email: businessEmail,
    industry_type: industryType as (typeof INDUSTRY_TYPES)[number],
    custom_industry_text: customIndustryText,
    company_size: companySize as (typeof COMPANY_SIZES)[number],
  };
}

function getRetryAfterSeconds(submittedAt: string | null): number {
  if (!submittedAt) return 0;

  const submittedAtMs = new Date(submittedAt).getTime();
  if (Number.isNaN(submittedAtMs)) return 0;

  const elapsedSeconds = Math.floor((Date.now() - submittedAtMs) / 1000);
  const remaining = RESUBMIT_WINDOW_SECONDS - elapsedSeconds;
  return remaining > 0 ? remaining : 0;
}

async function sendAdminReviewEmail(params: {
  adminToken: string;
  legalCompanyName: string;
  registrationNumber: string;
  country: string;
  officialWebsite: string;
  businessEmail: string;
  industryType: string;
  customIndustryText: string | null;
  companySize: string;
  submitterEmail: string;
  submittedAtIso: string;
}) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!resendApiKey) {
    console.error("verify_company_resend_api_key_missing");
    return;
  }

  if (!adminEmail) {
    console.error("verify_company_admin_email_missing");
    return;
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const approveUrl = `${baseUrl}/api/admin/company-review?action=approve&token=${encodeURIComponent(params.adminToken)}`;
  const rejectUrl = `${baseUrl}/api/admin/company-review?action=reject&token=${encodeURIComponent(params.adminToken)}`;

  const industryDisplay =
    params.industryType === "Other" && params.customIndustryText
      ? `Other: ${params.customIndustryText}`
      : params.industryType;

  const submittedAtLabel = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(params.submittedAtIso));

  const html = `
<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
  <h2 style="margin:0 0 14px">ZeroCarbon - Company Registration Review Required</h2>
  <table style="border-collapse:collapse;width:100%;max-width:640px;margin:0 0 16px">
    <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600">Legal Name</td><td style="padding:8px;border:1px solid #e2e8f0">${escapeHtml(params.legalCompanyName)}</td></tr>
    <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600">Registration No</td><td style="padding:8px;border:1px solid #e2e8f0">${escapeHtml(params.registrationNumber)}</td></tr>
    <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600">Country</td><td style="padding:8px;border:1px solid #e2e8f0">${escapeHtml(params.country)}</td></tr>
    <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600">Website</td><td style="padding:8px;border:1px solid #e2e8f0">${escapeHtml(params.officialWebsite)}</td></tr>
    <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600">Business Email</td><td style="padding:8px;border:1px solid #e2e8f0">${escapeHtml(params.businessEmail)}</td></tr>
    <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600">Industry</td><td style="padding:8px;border:1px solid #e2e8f0">${escapeHtml(industryDisplay)}</td></tr>
    <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600">Company Size</td><td style="padding:8px;border:1px solid #e2e8f0">${escapeHtml(params.companySize)}</td></tr>
    <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600">Submitted by</td><td style="padding:8px;border:1px solid #e2e8f0">${escapeHtml(params.submitterEmail)}</td></tr>
    <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600">Submitted at</td><td style="padding:8px;border:1px solid #e2e8f0">${escapeHtml(submittedAtLabel)}</td></tr>
  </table>

  <div style="display:flex;gap:10px;flex-wrap:wrap;margin:18px 0">
    <a href="${approveUrl}" style="background:#16a34a;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:700">Approve Company</a>
    <a href="${rejectUrl}" style="background:#dc2626;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:700">Reject Company</a>
  </div>

  <p style="margin:0 0 6px;color:#92400e">Clicking reject will prompt you to enter a rejection reason.</p>
  <p style="margin:0;color:#475569">This link expires in 7 days.</p>
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
      subject: "ZeroCarbon - Company Registration Review Required",
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
      return errorResponse(401, { error: "Unauthorized. Please log in." });
    }

    let rawPayload: VerifyCompanyPayload;
    try {
      rawPayload = (await request.json()) as VerifyCompanyPayload;
    } catch {
      return errorResponse(400, { error: "Invalid request payload." });
    }

    const validated = validatePayload(rawPayload);
    if ("error" in validated) {
      return errorResponse(400, {
        error: validated.error,
        field: validated.field,
        code: validated.code,
      });
    }

    const serviceClient = createServiceSupabaseClient();

    const { data: profileGate, error: profileError } = await serviceClient
      .from("profiles")
      .select("phone_verified, verification_status")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("verify_company_profile_gate_lookup_failed", {
        userId: user.id,
        reason: profileError.message,
      });
      return errorResponse(500, { error: "Unable to submit. Please try again." });
    }

    const typedProfile = (profileGate ?? null) as ProfileGateRow | null;
    const identityVerified =
      typedProfile?.phone_verified === true &&
      typedProfile?.verification_status === "verified";

    if (!identityVerified) {
      return errorResponse(403, {
        error: "Identity verification required.",
        code: "IDENTITY_NOT_VERIFIED",
        message:
          "You must complete phone and identity verification before registering your company.",
      });
    }

    const { data: existingCompany, error: existingError } = await serviceClient
      .from("companies")
      .select("id, status, submitted_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingError) {
      console.error("verify_company_existing_lookup_failed", {
        userId: user.id,
        reason: existingError.message,
      });
      return errorResponse(500, { error: "Unable to submit. Please try again." });
    }

    const typedExisting = (existingCompany ?? null) as ExistingCompanyRow | null;

    if (typedExisting?.status === "verified") {
      return errorResponse(409, {
        error: "Your company is already verified.",
        code: "ALREADY_VERIFIED",
      });
    }

    if (typedExisting?.status === "pending") {
      return errorResponse(409, {
        error: "Your company registration is already under review.",
        code: "ALREADY_PENDING",
      });
    }

    const retryAfterSeconds = getRetryAfterSeconds(typedExisting?.submitted_at ?? null);
    if (retryAfterSeconds > 0) {
      return errorResponse(429, {
        error: "Please wait before resubmitting.",
        code: "RATE_LIMITED",
      });
    }

    const submittedAt = new Date().toISOString();
    const adminToken = randomBytes(32).toString("hex");
    const adminTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: upsertError } = await serviceClient
      .from("companies")
      .upsert(
        {
          user_id: user.id,
          legal_company_name: validated.legal_company_name,
          company_name: validated.legal_company_name,
          registration_number: validated.registration_number,
          country: validated.country,
          industry_type: validated.industry_type,
          custom_industry_text: validated.custom_industry_text,
          company_size: validated.company_size,
          official_website: validated.official_website,
          website_url: validated.official_website,
          business_email: validated.business_email,
          status: "pending",
          submitted_at: submittedAt,
          rejection_reason: null,
          rejection_reason_updated_at: null,
          admin_token: adminToken,
          admin_token_expires_at: adminTokenExpiresAt,
        },
        { onConflict: "user_id" },
      );

    if (upsertError) {
      console.error("verify_company_upsert_failed", {
        userId: user.id,
        reason: upsertError.message,
      });
      return errorResponse(500, { error: "Unable to submit. Please try again." });
    }

    try {
      await sendAdminReviewEmail({
        adminToken,
        legalCompanyName: validated.legal_company_name,
        registrationNumber: validated.registration_number,
        country: validated.country,
        officialWebsite: validated.official_website,
        businessEmail: validated.business_email,
        industryType: validated.industry_type,
        customIndustryText: validated.custom_industry_text,
        companySize: validated.company_size,
        submitterEmail: user.email ?? "your registered email",
        submittedAtIso: submittedAt,
      });
    } catch (emailError) {
      console.error("verify_company_admin_email_failed", {
        userId: user.id,
        reason: emailError instanceof Error ? emailError.message : "unknown_error",
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: "Company registration submitted successfully.",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("verify_company_unhandled_error", {
      reason: error instanceof Error ? error.message : "unknown_error",
    });
    return errorResponse(500, { error: "Unable to submit. Please try again." });
  }
}

