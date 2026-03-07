import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sendVerificationEmail } from "@/lib/verification/send-verification-email";
import {
  getMissingRequiredIdentityFields,
  validateDateOfBirth,
  validatePhoneNumber,
  validatePostalCode,
  type IdentityFields,
} from "@/lib/profile/identity-validation";

const MAX_DOC_BYTES = 5 * 1024 * 1024;
const SUBMISSION_RATE_LIMIT_SECONDS = 5 * 60;
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

function getRetryRemainingSeconds(submittedAt: string | null): number {
  if (!submittedAt) return 0;

  const submittedTime = new Date(submittedAt).getTime();
  if (Number.isNaN(submittedTime)) return 0;

  const elapsedSeconds = Math.floor((Date.now() - submittedTime) / 1000);
  const remaining = SUBMISSION_RATE_LIMIT_SECONDS - elapsedSeconds;
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
      .select(
        "verification_status, verification_submitted_at, phone_verified, date_of_birth, phone_number, address_line1, address_line2, city, state, postal_code, country",
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return errorResponse("Unable to read current verification status.", 500);
    }

    const verificationStatus = (profile?.verification_status ?? "not_submitted") as VerificationStatus;
    if (verificationStatus === "pending") {
      return errorResponse("Verification is currently under review. Please wait for admin action.", 409);
    }

    if (verificationStatus === "verified") {
      return errorResponse("Your account is already verified.", 409);
    }

    if (!profile?.phone_verified) {
      return errorResponse(
        "Phone number must be verified before identity submission.",
        409,
      );
    }

    if (
      verificationStatus !== "not_submitted" &&
      verificationStatus !== "resubmit_required" &&
      verificationStatus !== "rejected"
    ) {
      return errorResponse(
        "You cannot submit verification in the current status.",
        409,
      );
    }

    const identityFields: IdentityFields = {
      date_of_birth: profile?.date_of_birth ?? null,
      phone_number: profile?.phone_number ?? null,
      address_line1: profile?.address_line1 ?? null,
      address_line2: profile?.address_line2 ?? null,
      city: profile?.city ?? null,
      state: profile?.state ?? null,
      postal_code: profile?.postal_code ?? null,
      country: profile?.country ?? null,
    };

    const missingFields = getMissingRequiredIdentityFields(identityFields);
    if (missingFields.length > 0) {
      return errorResponse(
        "Complete date of birth, phone, and address details before submitting verification.",
        400,
      );
    }

    const dobValidationError = validateDateOfBirth(identityFields.date_of_birth);
    if (dobValidationError) {
      return errorResponse(dobValidationError, 400);
    }

    const phoneValidationError = validatePhoneNumber(identityFields.phone_number);
    if (phoneValidationError) {
      return errorResponse(phoneValidationError, 400);
    }

    const postalValidationError = validatePostalCode(identityFields.postal_code);
    if (postalValidationError) {
      return errorResponse(postalValidationError, 400);
    }

    const { data: latestSubmission, error: latestSubmissionError } = await supabase
      .from("verification_submissions")
      .select("version, submitted_at")
      .eq("user_id", user.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestSubmissionError) {
      return errorResponse("Unable to read verification submission history.", 500);
    }

    const retryAfterSeconds = getRetryRemainingSeconds(latestSubmission?.submitted_at ?? null);
    if (retryAfterSeconds > 0) {
      return errorResponse(`Please wait ${retryAfterSeconds} seconds before submitting again.`, 429);
    }

    const nextVersion = (latestSubmission?.version ?? 0) + 1;
    const storagePath = `verification-documents/${user.id}/document_v${nextVersion}.${extension}`;
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
    const { error: updateProfileError } = await supabase
      .from("profiles")
      .update({
        verification_document_url: storagePath,
        verification_document_type: documentType,
        verification_status: "pending",
        verification_submitted_at: submittedAt,
      })
      .eq("id", user.id);

    if (updateProfileError) {
      return errorResponse(updateProfileError.message || "Failed to update verification status.", 500);
    }

    const { error: submissionInsertError } = await supabase.from("verification_submissions").insert({
      user_id: user.id,
      version: nextVersion,
      document_path: storagePath,
      document_type: documentType,
      status: "pending",
      submitted_at: submittedAt,
    });

    if (submissionInsertError) {
      return errorResponse(
        submissionInsertError.message || "Failed to record verification submission history.",
        500,
      );
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
            "Document submitted and marked as pending, but admin email delivery failed. Please retry after 5 minutes if needed.",
          status: "pending",
          submittedAt,
          version: nextVersion,
        },
        { status: 202 },
      );
    }

    return NextResponse.json(
      {
        message: "Verification submitted successfully. Your document is under review.",
        status: "pending",
        submittedAt,
        version: nextVersion,
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

