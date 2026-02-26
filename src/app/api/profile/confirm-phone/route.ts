import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  normalizeOptionalText,
  validatePhoneNumber,
} from "@/lib/profile/identity-validation";

type ConfirmPhonePayload = {
  phone?: unknown;
};

type ProfilePhoneRow = {
  phone_number: string | null;
  phone_verified: boolean | null;
  verification_status:
    | "not_submitted"
    | "pending"
    | "verified"
    | "rejected"
    | "resubmit_required"
    | null;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse("Your session expired. Please log in again.", 401);
    }

    let payload: ConfirmPhonePayload;
    try {
      payload = (await request.json()) as ConfirmPhonePayload;
    } catch {
      return errorResponse("Invalid request payload.", 400);
    }

    const phone = normalizeOptionalText(payload.phone);
    if (!phone) {
      return errorResponse("Please enter a valid phone number (e.g. +919876543210).", 400);
    }

    const phoneValidationError = validatePhoneNumber(phone);
    if (phoneValidationError) {
      return errorResponse(phoneValidationError, 400);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("phone_number, phone_verified, verification_status")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return errorResponse("Unable to load profile data.", 500);
    }

    if (!profile) {
      return errorResponse("Profile not found.", 404);
    }

    const typedProfile = profile as ProfilePhoneRow;
    const savedPhone = normalizeOptionalText(typedProfile.phone_number);
    if (!savedPhone || savedPhone !== phone) {
      return errorResponse("Phone verification mismatch. Save and verify again.", 409);
    }

    if (!user.phone || user.phone !== phone || !user.phone_confirmed_at) {
      return errorResponse("Phone verification mismatch. Save and verify again.", 409);
    }

    const verifiedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        phone_verified: true,
        phone_verified_at: verifiedAt,
      })
      .eq("id", user.id);

    if (updateError) {
      const message = updateError.message || "Unable to confirm phone verification.";
      if (
        /Identity details cannot be edited after verification/i.test(message) ||
        /Phone verification mismatch/i.test(message)
      ) {
        return errorResponse(message, 409);
      }

      return errorResponse(message, 500);
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
  } catch {
    return errorResponse("Unable to confirm phone verification right now. Please try again.", 500);
  }
}

