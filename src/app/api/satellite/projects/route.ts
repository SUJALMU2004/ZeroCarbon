import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type IdentityStatus =
  | "not_submitted"
  | "pending"
  | "verified"
  | "rejected"
  | "resubmit_required";

type ProfileRow = {
  phone_verified: boolean | null;
  verification_status: IdentityStatus | null;
};

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("phone_verified, verification_status")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("satellite_projects_profile_query_failed", {
        userId: user.id,
        reason: profileError.message,
      });
      return NextResponse.json({ error: "Unable to load projects." }, { status: 500 });
    }

    const profile = (profileData ?? null) as ProfileRow | null;
    const canAccess =
      profile?.phone_verified === true &&
      profile?.verification_status === "verified";

    if (!canAccess) {
      return NextResponse.json(
        {
          error: "Identity verification required.",
          code: "IDENTITY_NOT_VERIFIED",
        },
        { status: 403 },
      );
    }

    const { data: projectsData, error: projectsError } = await supabase
      .from("carbon_projects")
      .select(
        `
          id, project_name, project_type,
          latitude, longitude,
          land_area_hectares, estimated_co2_per_year,
          satellite_status, satellite_ndvi_current,
          satellite_ndvi_2020, satellite_ndvi_2022,
          satellite_ndvi_2024, satellite_ndvi_trend,
          satellite_confidence_score, satellite_confidence_badge,
          satellite_thumbnail_url, satellite_verified_at
        `,
      )
      .eq("status", "verified")
      .order("created_at", { ascending: false });

    if (projectsError) {
      console.error("satellite_projects_query_failed", {
        userId: user.id,
        reason: projectsError.message,
      });
      return NextResponse.json({ error: "Unable to load projects." }, { status: 500 });
    }

    const projects = (projectsData ?? []).map((project) => ({
      ...project,
      project_image_url: null,
      price_per_credit_inr: null,
    }));

    return NextResponse.json({ projects }, { status: 200 });
  } catch (error) {
    console.error("satellite_projects_unhandled_error", {
      reason: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json({ error: "Unable to load projects." }, { status: 500 });
  }
}
