import { redirect } from "next/navigation";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  resolveSignedMediaUrl,
  SIGNED_IMAGE_TRANSFORMS,
} from "@/lib/utils/signedMedia";
import MapClientLoader from "@/components/satellite/MapClientLoader";
import {
  getNormalizedProjectAiValuation,
  parseProjectReviewNotes,
} from "@/lib/utils/projectMetadata";
import type { ProjectSatelliteData, ProjectType } from "@/types/satellite";

type ProfileRow = {
  phone_verified: boolean | null;
  verification_status: string | null;
};

type RawProjectRow = Omit<ProjectSatelliteData, "project_image_url" | "price_per_credit_inr"> & {
  review_notes: string | null;
};

type MarketplaceSignerClient = ReturnType<typeof createServiceSupabaseClient>;

const MAP_PROJECT_TYPES: readonly ProjectType[] = [
  "forestry",
  "agricultural",
  "solar",
  "methane",
  "windmill",
];

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

  let marketplaceSigner: MarketplaceSignerClient | null = null;
  try {
    marketplaceSigner = createServiceSupabaseClient();
  } catch (error) {
    console.error("satellite_map_signer_init_failed", {
      reason: error instanceof Error ? error.message : "unknown_error",
    });
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
      satellite_verified_at,
      review_notes
    `,
    )
    .eq("status", "verified")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch projects for map:", error);
  }

  const validProjects = ((projects ?? []) as RawProjectRow[]).filter(
    (project) =>
      MAP_PROJECT_TYPES.includes(project.project_type) &&
      project.latitude !== null &&
      project.longitude !== null &&
      !Number.isNaN(Number(project.latitude)) &&
      !Number.isNaN(Number(project.longitude)),
  );

  const mapProjects: ProjectSatelliteData[] = await Promise.all(
    validProjects.map(async (project) => {
      const { submissionMetadata } = parseProjectReviewNotes(project.review_notes);
      const firstProjectPhotoPath = submissionMetadata.project_photo_urls?.[0] ?? null;
      const projectImageUrl = await resolveSignedMediaUrl({
        signer: marketplaceSigner,
        bucket: "project-photos",
        path: firstProjectPhotoPath,
        projectId: project.id,
        logContext: "satellite_map_photo_signed_url_failed",
        transform: SIGNED_IMAGE_TRANSFORMS.mapCard,
      });
      const aiPrice = getNormalizedProjectAiValuation(
        submissionMetadata.ai_valuation,
      ).pricePerCreditInr;

      return {
        ...project,
        latitude: Number(project.latitude),
        longitude: Number(project.longitude),
        project_image_url: projectImageUrl,
        price_per_credit_inr: Number.isFinite(aiPrice) ? Number(aiPrice) : null,
      };
    }),
  );

  return (
    <div className="min-h-full p-4">
      <div className="min-h-[400px] w-full overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-black/5">
        <MapClientLoader projects={mapProjects} />
      </div>
    </div>
  );
}
