import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  TwilioVerifyError,
  checkTwilioVerification,
} from "@/lib/twilio/verify";
import {
  normalizeOptionalText,
  validatePhoneNumber,
} from "@/lib/profile/identity-validation";

type VerifyOtpPayload = {
  phone?: unknown;
  code?: unknown;
};

type ProfilePhoneRow = {
  phone_number: string | null;
  phone_verified: boolean | null;
  phone_verified_at: string | null;
};

function errorResponse(message: string, status: number, code?: string) {
  return NextResponse.json(
    {
      message,
      ...(code ? { code } : {}),
    },
    { status },
  );
}

function validateOtpCode(value: string | null): string | null {
  if (!value || !/^\d{6}$/.test(value)) {
    return "Please enter a valid 6-digit OTP.";
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse("Your session expired. Please log in again.", 401, "session_expired");
    }

    let payload: VerifyOtpPayload;
    try {
      payload = (await request.json()) as VerifyOtpPayload;
    } catch {
      return errorResponse("Invalid request payload.", 400, "invalid_payload");
    }

    const phone = normalizeOptionalText(payload.phone);
    const code = normalizeOptionalText(payload.code);

    if (!phone) {
      return errorResponse(
        "Please enter a valid phone number (e.g. +919876543210).",
        400,
        "invalid_phone",
      );
    }

    const phoneValidationError = validatePhoneNumber(phone);
    if (phoneValidationError) {
      return errorResponse(phoneValidationError, 400, "invalid_phone");
    }

    const otpValidationError = validateOtpCode(code);
    if (otpValidationError) {
      return errorResponse(otpValidationError, 400, "invalid_otp");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("phone_number, phone_verified, phone_verified_at")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return errorResponse("Unable to load profile data.", 500, "profile_read_failed");
    }

    if (!profile) {
      return errorResponse("Profile not found.", 404, "profile_not_found");
    }

    const typedProfile = profile as ProfilePhoneRow;
    const savedPhone = normalizeOptionalText(typedProfile.phone_number);
    if (!savedPhone || savedPhone !== phone) {
      return errorResponse("Phone verification mismatch. Save and verify again.", 409, "phone_mismatch");
    }

    if (typedProfile.phone_verified) {
      return NextResponse.json(
        {
          message: "Phone number already verified.",
          phone_verified: true,
          phone_verified_at: typedProfile.phone_verified_at,
          phone_number: phone,
        },
        { status: 200 },
      );
    }

    const verificationResult = await checkTwilioVerification({
      to: phone,
      code: code as string,
    });

    if (!verificationResult.isApproved) {
      return errorResponse("Invalid or expired OTP. Please try again.", 400, "otp_not_approved");
    }

    const verifiedAt = new Date().toISOString();
    const adminSupabase = createAdminSupabaseClient();
    const { error: updateError } = await adminSupabase
      .from("profiles")
      .update({
        phone_verified: true,
        phone_verified_at: verifiedAt,
      })
      .eq("id", user.id);

    if (updateError) {
      return errorResponse(
        "Unable to persist phone verification state. Please try again.",
        500,
        "profile_update_failed",
      );
    }

    return NextResponse.json(
      {
        message: "Phone number verified successfully.",
        phone_verified: true,
        phone_verified_at: verifiedAt,
        phone_number: phone,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof TwilioVerifyError) {
      return errorResponse(error.message, error.status, error.code);
    }

    console.error("phone_verify_otp_failed", {
      stage: "unhandled",
      reason: error instanceof Error ? error.message : "unknown_error",
    });

    return errorResponse(
      "Unable to verify OTP right now. Please try again.",
      500,
      "otp_verify_failed",
    );
  }
}
