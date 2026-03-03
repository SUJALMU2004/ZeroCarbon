import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeVerificationState } from "@/lib/dashboard/verification-banner";
import type { DashboardApiResponse, IdentityStatus } from "@/types/dashboard";

type ProfileRow = {
  role: string | null;
  created_at: string | null;
  phone_verified: boolean | null;
  verification_status: IdentityStatus | null;
};

function formatCreatedAt(value: string | null): string {
  if (!value) {
    return "Unavailable";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function unauthorizedResponse() {
  return NextResponse.json(
    {
      message: "Unauthorized. Please log in again.",
    },
    { status: 401 },
  );
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedResponse();
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, created_at, phone_verified, verification_status")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { message: "Unable to load dashboard data." },
        { status: 500 },
      );
    }

    const typedProfile = (profile ?? null) as ProfileRow | null;
    const verificationState = normalizeVerificationState({
      phone_verified: typedProfile?.phone_verified ?? false,
      identity_status: typedProfile?.verification_status ?? "not_submitted",
    });

    const isVerified =
      verificationState.phone_verified === true &&
      verificationState.identity_status === "verified";

    const payload: DashboardApiResponse = {
      is_verified: isVerified,
      verification_state: verificationState,
      dashboard: {
        email: user.email ?? "Unavailable",
        role: typedProfile?.role ?? "Not set",
        created_at: formatCreatedAt(typedProfile?.created_at ?? null),
      },
    };

    return NextResponse.json(payload, { status: 200 });
  } catch {
    return NextResponse.json(
      { message: "Unable to load dashboard data." },
      { status: 500 },
    );
  }
}
