import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import MapClientLoader from "@/components/satellite/MapClientLoader";
import type { ProjectSatelliteData } from "@/types/satellite";

type ProfileRow = {
  phone_verified: boolean | null;
  verification_status: string | null;
};

type ProjectRow = Omit<ProjectSatelliteData, "price_per_credit">;

export default async function ProjectsMapPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/projects/map");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("phone_verified, verification_status")
    .eq("id", user.id)
    .maybeSingle();

  const typedProfile = (profile ?? null) as ProfileRow | null;
  const isVerified =
    typedProfile?.phone_verified === true &&
    typedProfile?.verification_status === "verified";

  if (!isVerified) {
    redirect("/profile?message=verify-to-access-map");
  }

  const { data: projects, error } = await supabase
    .from("carbon_projects")
    .select(
      `
      id, project_name, project_type,
      latitude, longitude,
      land_area_hectares, estimated_co2_per_year,
      satellite_status,
      satellite_ndvi_current,
      satellite_ndvi_2020,
      satellite_ndvi_2022,
      satellite_ndvi_2024,
      satellite_ndvi_trend,
      satellite_confidence_score,
      satellite_confidence_badge,
      satellite_thumbnail_url,
      satellite_verified_at
    `,
    )
    .eq("status", "verified")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch projects for map:", error);
  }

  const validProjects: ProjectSatelliteData[] = ((projects ?? []) as ProjectRow[])
    .filter(
      (project) =>
        project.latitude !== null &&
        project.longitude !== null &&
        !Number.isNaN(Number(project.latitude)) &&
        !Number.isNaN(Number(project.longitude)),
    )
    .map((project) => ({
      ...project,
      latitude: Number(project.latitude),
      longitude: Number(project.longitude),
      price_per_credit: null,
    }));

  return (
    <div className="min-h-full p-4">
      <div className="min-h-[400px] w-full overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-black/5">
        <MapClientLoader projects={validProjects} />
      </div>
    </div>
  );
}
