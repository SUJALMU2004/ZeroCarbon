import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sendVerificationEmail } from "@/lib/verification/send-verification-email";

const MAX_DOC_BYTES = 5 * 1024 * 1024;
const PENDING_RETRY_COOLDOWN_SECONDS = 60;
const ALLOWED_DOC_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_DOCUMENT_TYPES = new Set([
  "Aadhar",
  "Passport",
  "National ID",
  "Driver License",
  "Voter ID",
  "Other Government ID",
]);

type VerificationStatus =
  | "not_submitted"
  | "pending"
  | "verified"
  | "rejected"
  | "resubmit_required";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

function fileExtensionFromMime(mimeType: string): "jpg" | "png" | "webp" | null {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return null;
}

function getPendingRetryRemainingSeconds(submittedAt: string | null): number {
  if (!submittedAt) return 0;

  const submittedTime = new Date(submittedAt).getTime();
  if (Number.isNaN(submittedTime)) return 0;

  const elapsedSeconds = Math.floor((Date.now() - submittedTime) / 1000);
  const remaining = PENDING_RETRY_COOLDOWN_SECONDS - elapsedSeconds;
  return remaining > 0 ? remaining : 0;
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse("Unauthorized. Please log in again.", 401);
    }

    const formData = await request.formData();
    const documentType = formData.get("document_type");
    const documentFile = formData.get("document");

    if (typeof documentType !== "string" || !ALLOWED_DOCUMENT_TYPES.has(documentType)) {
      return errorResponse("Please select a valid document type.", 400);
    }

    if (!(documentFile instanceof File)) {
      return errorResponse("Please attach a verification document.", 400);
    }

    if (!ALLOWED_DOC_MIME_TYPES.has(documentFile.type)) {
      return errorResponse("Invalid document format. Only JPG, PNG, and WEBP are allowed.", 400);
    }

    if (documentFile.size > MAX_DOC_BYTES) {
      return errorResponse("Document exceeds 5MB size limit.", 400);
    }

    const extension = fileExtensionFromMime(documentFile.type);
    if (!extension) {
      return errorResponse("Unsupported document format.", 400);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("verification_status, verification_submitted_at")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return errorResponse("Unable to read current verification status.", 500);
    }

    const verificationStatus = (profile?.verification_status ?? "not_submitted") as VerificationStatus;
    if (verificationStatus === "pending") {
      const retryAfterSeconds = getPendingRetryRemainingSeconds(profile?.verification_submitted_at ?? null);
      if (retryAfterSeconds > 0) {
        return errorResponse(
          `Please wait ${retryAfterSeconds} seconds before retrying verification submission.`,
          429,
        );
      }
    }

    if (verificationStatus === "verified") {
      return errorResponse("Your account is already verified.", 409);
    }

    if (verificationStatus === "rejected") {
      return errorResponse(
        "Your account is marked as not verified. Please contact support for the next steps.",
        409,
      );
    }

    const storagePath = `verification-documents/${user.id}/document.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("verification-documents")
      .upload(storagePath, documentFile, {
        upsert: true,
        cacheControl: "3600",
        contentType: documentFile.type,
      });

    if (uploadError) {
      return errorResponse(uploadError.message || "Failed to upload verification document.", 500);
    }

    const submittedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        verification_document_url: storagePath,
        verification_document_type: documentType,
        verification_status: "pending",
        verification_submitted_at: submittedAt,
      })
      .eq("id", user.id);

    if (updateError) {
      return errorResponse(updateError.message || "Failed to update verification status.", 500);
    }

    try {
      await sendVerificationEmail({
        supabase,
        userId: user.id,
      });
    } catch (error) {
      console.error("verification_submit_email_failed", {
        userId: user.id,
        status: "pending",
        stage: "send_verification_email",
        reason: error instanceof Error ? error.message : "unknown_error",
      });

      return NextResponse.json(
        {
          message:
            "Document submitted and marked as pending, but admin email delivery failed. You can retry by re-uploading after 60 seconds.",
          status: "pending",
          submittedAt,
        },
        { status: 202 },
      );
    }

    return NextResponse.json(
      {
        message: "Verification submitted successfully. Your document is under review.",
        status: "pending",
        submittedAt,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("verification_submit_failed", {
      stage: "submit_verification",
      reason: error instanceof Error ? error.message : "unknown_error",
    });

    return errorResponse("Unable to process verification submission right now. Please try again.", 500);
  }
}

