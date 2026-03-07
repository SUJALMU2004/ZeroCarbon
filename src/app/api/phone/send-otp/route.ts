import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  TwilioVerifyError,
  sendTwilioVerification,
} from "@/lib/twilio/verify";
import {
  normalizeOptionalText,
  validatePhoneNumber,
} from "@/lib/profile/identity-validation";

const OTP_RESEND_COOLDOWN_SECONDS = 60;

type ProfilePhoneRow = {
  phone_number: string | null;
  phone_verified: boolean | null;
  phone_otp_last_sent_at: string | null;
};

function errorResponse(
  message: string,
  status: number,
  code?: string,
  retryAfterSeconds?: number,
) {
  return NextResponse.json(
    {
      message,
      ...(code ? { code } : {}),
      ...(typeof retryAfterSeconds === "number"
        ? { retryAfterSeconds }
        : {}),
    },
    { status },
  );
}

function getRetryAfterSeconds(lastSentAt: string | null): number {
  if (!lastSentAt) return 0;

  const lastSentMs = new Date(lastSentAt).getTime();
  if (Number.isNaN(lastSentMs)) return 0;

  const elapsedSeconds = Math.floor((Date.now() - lastSentMs) / 1000);
  const remaining = OTP_RESEND_COOLDOWN_SECONDS - elapsedSeconds;
  return remaining > 0 ? remaining : 0;
}

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse("Your session expired. Please log in again.", 401, "session_expired");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("phone_number, phone_verified, phone_otp_last_sent_at")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return errorResponse("Unable to load profile data.", 500, "profile_read_failed");
    }

    if (!profile) {
      return errorResponse("Profile not found.", 404, "profile_not_found");
    }

    const typedProfile = profile as ProfilePhoneRow;
    const phoneNumber = normalizeOptionalText(typedProfile.phone_number);
    if (!phoneNumber) {
      return errorResponse(
        "Please save your phone number before requesting OTP.",
        400,
        "phone_missing",
      );
    }

    const phoneValidationError = validatePhoneNumber(phoneNumber);
    if (phoneValidationError) {
      return errorResponse(phoneValidationError, 400, "invalid_phone");
    }

    if (typedProfile.phone_verified) {
      return errorResponse("Phone number already verified.", 409, "already_verified");
    }

    const retryAfterSeconds = getRetryAfterSeconds(
      typedProfile.phone_otp_last_sent_at,
    );
    if (retryAfterSeconds > 0) {
      return errorResponse(
        `Please wait ${retryAfterSeconds} seconds before requesting another OTP.`,
        429,
        "otp_cooldown",
        retryAfterSeconds,
      );
    }

    await sendTwilioVerification({
      to: phoneNumber,
    });

    const sentAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        phone_otp_last_sent_at: sentAt,
      })
      .eq("id", user.id);

    if (updateError) {
      return errorResponse(
        "OTP sent but profile cooldown update failed. Please try again.",
        500,
        "cooldown_update_failed",
      );
    }

    return NextResponse.json(
      {
        message: "OTP sent successfully.",
        retryAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof TwilioVerifyError) {
      return errorResponse(error.message, error.status, error.code);
    }

    console.error("phone_send_otp_failed", {
      stage: "unhandled",
      reason: error instanceof Error ? error.message : "unknown_error",
    });

    return errorResponse(
      "Unable to send OTP right now. Please try again.",
      500,
      "otp_send_failed",
    );
  }
}
