import "server-only";

import { createHash, randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "learningtraverse@gmail.com";
const APP_BASE_URL = "https://zerocarbonworld.vercel.app";
const TOKEN_EXPIRY_HOURS = 48;
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60 * 24;
const RESEND_ENDPOINT = "https://api.resend.com/emails";
const RESEND_FROM = "ZeroCarbon Verification <onboarding@resend.dev>";

type VerificationAction = "approve" | "reject" | "resubmit";

function buildActionUrl(token: string, action: VerificationAction): string {
  return `${APP_BASE_URL}/api/admin/verify-user?token=${encodeURIComponent(token)}&action=${action}`;
}

function formatCreatedAt(value: string | null): string {
  if (!value) return "Unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

export async function sendVerificationEmail({
  supabase,
  userId,
}: {
  supabase: SupabaseClient;
  userId: string;
}) {
  let stage = "init";

  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      throw new Error("Missing required server environment variable: RESEND_API_KEY");
    }

    stage = "load_profile";
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, email, created_at, verification_document_url, verification_document_type")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      throw new Error(profileError.message);
    }

    if (!profile) {
      throw new Error("Profile not found.");
    }

    const documentPath = profile.verification_document_url;
    if (!documentPath) {
      throw new Error("Verification document path is missing.");
    }

    stage = "create_signed_url";
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("verification-documents")
      .createSignedUrl(documentPath, SIGNED_URL_EXPIRY_SECONDS);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      throw new Error(signedUrlError?.message ?? "Unable to create signed URL for document preview.");
    }

    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

    stage = "rotate_token";
    const { error: rotateTokenError } = await supabase.rpc("rotate_verification_token", {
      p_user_id: userId,
      p_token: tokenHash,
      p_expires_at: expiresAt,
    });

    if (rotateTokenError) {
      throw new Error(rotateTokenError.message);
    }

    const approveUrl = buildActionUrl(rawToken, "approve");
    const resubmitUrl = buildActionUrl(rawToken, "resubmit");
    const rejectUrl = buildActionUrl(rawToken, "reject");

    const fullName = profile.full_name?.trim() || "Not provided";
    const email = profile.email?.trim() || "Unavailable";
    const createdAt = formatCreatedAt(profile.created_at);
    const documentType = profile.verification_document_type?.trim() || "Not provided";

    const html = `
  <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
    <h2 style="margin:0 0 12px">New User Verification Request</h2>
    <p style="margin:0 0 16px">A user submitted a verification document for review.</p>

    <table style="border-collapse:collapse;width:100%;max-width:600px;margin-bottom:16px">
      <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600">Full Name</td><td style="padding:8px;border:1px solid #e2e8f0">${fullName}</td></tr>
      <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600">Email</td><td style="padding:8px;border:1px solid #e2e8f0">${email}</td></tr>
      <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600">Account Created</td><td style="padding:8px;border:1px solid #e2e8f0">${createdAt}</td></tr>
      <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600">Document Type</td><td style="padding:8px;border:1px solid #e2e8f0">${documentType}</td></tr>
    </table>

    <div style="margin:0 0 20px">
      <p style="margin:0 0 8px;font-weight:600">Document Preview</p>
      <img src="${signedUrlData.signedUrl}" alt="Verification document preview" style="max-width:100%;height:auto;border:1px solid #e2e8f0;border-radius:8px" />
    </div>

    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <a href="${approveUrl}" style="background:#16a34a;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:600">Review: Verify User</a>
      <a href="${resubmitUrl}" style="background:#f59e0b;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:600">Review: Ask for Different Document</a>
      <a href="${rejectUrl}" style="background:#dc2626;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:600">Review: Not Verify User</a>
    </div>

    <p style="margin-top:16px;color:#475569;font-size:12px">Each link opens a confirmation step, expires in ${TOKEN_EXPIRY_HOURS} hours, and can only be used once.</p>
  </div>`;

    stage = "send_email";
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [ADMIN_EMAIL],
        subject: "ZeroCarbon User Verification Request",
        html,
      }),
    });

    if (!response.ok) {
      const failureBody = await response.text();
      throw new Error(`Failed to send verification email. ${failureBody.slice(0, 400)}`);
    }
  } catch (error) {
    console.error("verification_email_send_failed", {
      userId,
      stage,
      reason: error instanceof Error ? error.message : "unknown_error",
    });
    throw error;
  }
}
