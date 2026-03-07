import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  normalizeOptionalText,
  validateDateOfBirth,
  validatePhoneNumber,
  validatePostalCode,
  type IdentityFields,
} from "@/lib/profile/identity-validation";

type UpdatePayload = {
  full_name?: unknown;
  date_of_birth?: unknown;
  phone_number?: unknown;
  address_line1?: unknown;
  address_line2?: unknown;
  city?: unknown;
  state?: unknown;
  postal_code?: unknown;
  country?: unknown;
};

type ProfileRow = {
  full_name: string | null;
  verification_status:
    | "not_submitted"
    | "pending"
    | "verified"
    | "rejected"
    | "resubmit_required"
    | null;
  phone_verified: boolean | null;
  phone_verified_at: string | null;
  date_of_birth: string | null;
  phone_number: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

function parseOptionalTextField(value: unknown, fieldName: string): { value: string | null; error?: string } {
  if (value === null || typeof value === "undefined") {
    return { value: null };
  }

  if (typeof value !== "string") {
    return { value: null, error: `Invalid payload for ${fieldName}.` };
  }

  return { value: normalizeOptionalText(value) };
}

function identityFromProfileRow(profile: ProfileRow): IdentityFields {
  return {
    date_of_birth: profile.date_of_birth,
    phone_number: profile.phone_number,
    address_line1: profile.address_line1,
    address_line2: profile.address_line2,
    city: profile.city,
    state: profile.state,
    postal_code: profile.postal_code,
    country: profile.country,
  };
}

function hasIdentityDifference(current: IdentityFields, next: IdentityFields): boolean {
  return (
    current.date_of_birth !== next.date_of_birth ||
    current.phone_number !== next.phone_number ||
    current.address_line1 !== next.address_line1 ||
    current.address_line2 !== next.address_line2 ||
    current.city !== next.city ||
    current.state !== next.state ||
    current.postal_code !== next.postal_code ||
    current.country !== next.country
  );
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

    let payload: UpdatePayload;
    try {
      payload = (await request.json()) as UpdatePayload;
    } catch {
      return errorResponse("Invalid request payload.", 400);
    }

    const fullNameResult = parseOptionalTextField(payload.full_name, "full_name");
    const dobResult = parseOptionalTextField(payload.date_of_birth, "date_of_birth");
    const phoneResult = parseOptionalTextField(payload.phone_number, "phone_number");
    const line1Result = parseOptionalTextField(payload.address_line1, "address_line1");
    const line2Result = parseOptionalTextField(payload.address_line2, "address_line2");
    const cityResult = parseOptionalTextField(payload.city, "city");
    const stateResult = parseOptionalTextField(payload.state, "state");
    const postalResult = parseOptionalTextField(payload.postal_code, "postal_code");
    const countryResult = parseOptionalTextField(payload.country, "country");

    const parseError =
      fullNameResult.error ||
      dobResult.error ||
      phoneResult.error ||
      line1Result.error ||
      line2Result.error ||
      cityResult.error ||
      stateResult.error ||
      postalResult.error ||
      countryResult.error;
    if (parseError) {
      return errorResponse(parseError, 400);
    }

    const nextIdentity: IdentityFields = {
      date_of_birth: dobResult.value,
      phone_number: phoneResult.value,
      address_line1: line1Result.value,
      address_line2: line2Result.value,
      city: cityResult.value,
      state: stateResult.value,
      postal_code: postalResult.value,
      country: countryResult.value,
    };

    const dobValidationError = validateDateOfBirth(nextIdentity.date_of_birth);
    if (dobValidationError) {
      return errorResponse(dobValidationError, 400);
    }

    const phoneValidationError = validatePhoneNumber(nextIdentity.phone_number);
    if (phoneValidationError) {
      return errorResponse(phoneValidationError, 400);
    }

    const postalValidationError = validatePostalCode(nextIdentity.postal_code);
    if (postalValidationError) {
      return errorResponse(postalValidationError, 400);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        "full_name, verification_status, phone_verified, phone_verified_at, date_of_birth, phone_number, address_line1, address_line2, city, state, postal_code, country",
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return errorResponse("Unable to load profile data.", 500);
    }

    if (!profile) {
      return errorResponse("Profile not found.", 404);
    }

    const currentIdentity = identityFromProfileRow(profile as ProfileRow);
    const identityChanged = hasIdentityDifference(currentIdentity, nextIdentity);
    const phoneChanged = currentIdentity.phone_number !== nextIdentity.phone_number;

    if (profile.verification_status === "verified" && identityChanged) {
      return errorResponse("Identity details cannot be edited after verification.", 409);
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: fullNameResult.value,
        date_of_birth: nextIdentity.date_of_birth,
        phone_number: nextIdentity.phone_number,
        address_line1: nextIdentity.address_line1,
        address_line2: nextIdentity.address_line2,
        city: nextIdentity.city,
        state: nextIdentity.state,
        postal_code: nextIdentity.postal_code,
        country: nextIdentity.country,
      })
      .eq("id", user.id);

    if (updateError) {
      const message = updateError.message || "Unable to update profile right now.";
      if (
        /Identity details cannot be edited after verification/i.test(message) ||
        /Phone verification mismatch/i.test(message)
      ) {
        return errorResponse(message, 409);
      }

      return errorResponse(message, 500);
    }

    const { data: refreshedProfile, error: refreshedProfileError } = await supabase
      .from("profiles")
      .select("phone_number, phone_verified, phone_verified_at")
      .eq("id", user.id)
      .maybeSingle();

    if (refreshedProfileError || !refreshedProfile) {
      return NextResponse.json(
        { message: "Profile updated, but refresh failed. Please reload." },
        { status: 200 },
      );
    }

    const phoneVerificationReset =
      phoneChanged && Boolean(profile.phone_verified) && !(refreshedProfile.phone_verified ?? false);

    return NextResponse.json(
      {
        message: "Profile updated successfully.",
        phone_number: refreshedProfile.phone_number,
        phone_verified: Boolean(refreshedProfile.phone_verified),
        phone_verified_at: refreshedProfile.phone_verified_at,
        phone_verification_reset: phoneVerificationReset,
      },
      { status: 200 },
    );
  } catch {
    return errorResponse("Unable to update profile right now. Please try again.", 500);
  }
}
