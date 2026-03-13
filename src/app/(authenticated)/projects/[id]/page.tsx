import { redirect } from "next/navigation";
import MarketplaceProductDetailClient from "@/components/projects/MarketplaceProductDetailClient";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getNormalizedProjectAiValuation,
  getSubmissionDescription,
  parseProjectReviewNotes,
} from "@/lib/utils/projectMetadata";
import { getProjectReference } from "@/lib/utils/projectReference";
import {
  resolveSignedMediaUrl,
  SIGNED_IMAGE_TRANSFORMS,
} from "@/lib/utils/signedMedia";
import { resolveAndPersistProjectAiValuation } from "@/lib/valuation/carbonValuation";

type ProjectRow = {
  id: string;
  user_id: string;
  project_name: string | null;
  project_type: string | null;
  status: string | null;
  created_at: string;
  submitted_at: string | null;
  latitude: number | null;
  longitude: number | null;
  polygon_geojson: object | null;
  land_area_hectares: number | null;
  estimated_co2_per_year: number | null;
  project_start_date: string | null;
  satellite_status: string | null;
  satellite_ndvi_current: number | null;
  satellite_ndvi_trend: string | null;
  satellite_confidence_score: number | null;
  satellite_confidence_badge: string | null;
  satellite_thumbnail_url: string | null;
  satellite_error_message: string | null;
  satellite_last_attempted_at: string | null;
  review_notes: string | null;
};

type MarketplaceSignerClient = ReturnType<typeof createServiceSupabaseClient>;

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function fileNameFromPath(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

function extensionFromPath(path: string): string {
  const filename = fileNameFromPath(path).toLowerCase();
  const index = filename.lastIndexOf(".");
  return index >= 0 ? filename.slice(index + 1) : "";
}

function isImageExtension(extension: string): boolean {
  return ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(extension);
}

function toDisplay(value: string | null | undefined): string {
  if (!value) return "-";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "-";
}

function getProjectTypeLabel(projectType: string | null): string {
  if (projectType === "forestry") return "Forestry";
  if (projectType === "agricultural") return "Agricultural";
  if (projectType === "solar") return "Solar";
  if (projectType === "methane") return "Methane";
  if (projectType === "windmill") return "Windmill";
  return "Project";
}

function getPanelTechnologyLabel(value: string | null | undefined): string {
  if (!value) return "-";
  const normalized = value.toLowerCase().replaceAll("-", "_");
  if (normalized === "monocrystalline") return "Monocrystalline";
  if (normalized === "polycrystalline") return "Polycrystalline";
  if (normalized === "thin_film") return "Thin-Film";
  if (normalized === "bifacial") return "Bifacial";
  return value;
}

async function resolveSignedUrl(
  signer: MarketplaceSignerClient | null,
  projectId: string,
  bucket: "project-photos" | "verification-documents",
  path: string,
  transform?: (typeof SIGNED_IMAGE_TRANSFORMS)[keyof typeof SIGNED_IMAGE_TRANSFORMS],
): Promise<string | null> {
  return resolveSignedMediaUrl({
    signer,
    bucket,
    path,
    projectId,
    logContext: "marketplace_product_signed_url_failed",
    transform,
  });
}

export default async function MarketplaceProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(`/projects/${id}`)}`);
  }

  let marketplaceSigner: MarketplaceSignerClient | null = null;
  try {
    marketplaceSigner = createServiceSupabaseClient();
  } catch (error) {
    console.error("marketplace_product_signer_init_failed", {
      projectId: id,
      reason: error instanceof Error ? error.message : "unknown_error",
    });
  }

  const { data, error } = await supabase
    .from("carbon_projects")
    .select(
      "id, user_id, project_name, project_type, status, created_at, submitted_at, latitude, longitude, polygon_geojson, land_area_hectares, estimated_co2_per_year, project_start_date, satellite_status, satellite_ndvi_current, satellite_ndvi_trend, satellite_confidence_score, satellite_confidence_badge, satellite_thumbnail_url, satellite_error_message, satellite_last_attempted_at, review_notes",
    )
    .eq("id", id)
    .eq("status", "verified")
    .maybeSingle();

  if (error) {
    console.error("marketplace_product_query_failed", {
      userId: user.id,
      projectId: id,
      reason: error.message,
    });
    redirect("/projects");
  }

  const project = (data ?? null) as ProjectRow | null;
  if (!project) {
    redirect("/projects");
  }

  const resolvedValuation =
    project.project_type === "solar" ||
    project.project_type === "methane" ||
    project.project_type === "windmill"
      ? await resolveAndPersistProjectAiValuation({
          projectId: project.id,
          status: project.status,
          projectType: project.project_type,
          latitude: project.latitude,
          longitude: project.longitude,
          polygonGeojson: project.polygon_geojson,
          landAreaHectares: project.land_area_hectares,
          satelliteNdviCurrent: project.satellite_ndvi_current,
          satelliteStatus: project.satellite_status,
          satelliteErrorMessage: project.satellite_error_message,
          satelliteLastAttemptedAt: project.satellite_last_attempted_at,
          projectStartDate: project.project_start_date,
          reviewNotes: project.review_notes,
        })
      : null;

  const parsedNotes = parseProjectReviewNotes(project.review_notes);
  const metadata = parsedNotes.submissionMetadata;
  const referenceId = getProjectReference(project.id, project.created_at);
  const description = getSubmissionDescription(metadata) || "Project description not available.";
  const submittedAtLabel = formatDateTime(project.submitted_at ?? project.created_at);

  const galleryPaths = metadata.project_photo_urls ?? [];
  const gallerySignedUrls = (
    await Promise.all(
      galleryPaths.map(async (path) => {
        const [mainUrl, thumbUrl] = await Promise.all([
          resolveSignedUrl(
            marketplaceSigner,
            project.id,
            "project-photos",
            path,
            SIGNED_IMAGE_TRANSFORMS.productMain,
          ),
          resolveSignedUrl(
            marketplaceSigner,
            project.id,
            "project-photos",
            path,
            SIGNED_IMAGE_TRANSFORMS.productThumb,
          ),
        ]);

        if (!mainUrl) return null;
        return {
          mainUrl,
          thumbUrl: thumbUrl ?? mainUrl,
        };
      }),
    )
  ).filter(
    (item): item is { mainUrl: string; thumbUrl: string } => Boolean(item),
  );

  const ownershipPath = metadata.ownership_document_urls?.[0] ?? null;
  const ownershipExtension = ownershipPath ? extensionFromPath(ownershipPath) : "";
  const ownershipProofUrl =
    ownershipPath !== null
      ? await resolveSignedUrl(
          marketplaceSigner,
          project.id,
          "verification-documents",
          ownershipPath,
          isImageExtension(ownershipExtension)
            ? SIGNED_IMAGE_TRANSFORMS.productProof
            : undefined,
        )
      : null;

  const valuation = getNormalizedProjectAiValuation(
    resolvedValuation ?? metadata.ai_valuation,
  );
  const creditsAvailable = valuation.creditsAvailable;
  const pricePerCreditInr = valuation.pricePerCreditInr;

  const locationLabel =
    metadata.state || metadata.country
      ? [metadata.state, metadata.country].filter(Boolean).join(", ")
      : "-";

  const specifications = [
    { label: "Project Type", value: getProjectTypeLabel(project.project_type) },
    { label: "Status", value: toDisplay(project.status) },
    { label: "Area (hectares)", value: project.land_area_hectares?.toString() ?? "-" },
    {
      label: "Estimated Credits/Year",
      value: project.estimated_co2_per_year?.toString() ?? "-",
    },
    { label: "Planting Year", value: toDisplay(metadata.planting_year) },
    {
      label: "Species",
      value: metadata.species && metadata.species.length > 0 ? metadata.species.join(", ") : "-",
    },
    { label: "Ownership Type", value: toDisplay(metadata.ownership_type) },
    { label: "Region", value: locationLabel },
    { label: "Address", value: toDisplay(metadata.street_address) },
    { label: "Seller", value: toDisplay(metadata.seller_name) },
    { label: "Organization", value: toDisplay(metadata.organization_name) },
    { label: "Submitted", value: submittedAtLabel },
  ];

  if (project.project_type === "solar") {
    specifications.push(
      {
        label: "Claimed Capacity (MW)",
        value:
          metadata.claimed_capacity_mw !== null &&
          metadata.claimed_capacity_mw !== undefined &&
          `${metadata.claimed_capacity_mw}`.trim().length > 0
            ? `${metadata.claimed_capacity_mw}`
            : "-",
      },
      {
        label: "Panel Technology",
        value: getPanelTechnologyLabel(metadata.panel_technology),
      },
      {
        label: "Grid Region",
        value: toDisplay(metadata.grid_region),
      },
    );
  }

  return (
    <MarketplaceProductDetailClient
      projectId={project.id}
      isOwner={project.user_id === user.id}
      manageHref={`/dashboard/seller/projects/${project.id}`}
      projectName={project.project_name?.trim() || "Untitled Project"}
      referenceId={referenceId}
      projectType={project.project_type}
      status={project.status}
      submittedAtLabel={submittedAtLabel}
      description={description}
      latitude={project.latitude}
      longitude={project.longitude}
      polygonGeojson={project.polygon_geojson}
      galleryImages={gallerySignedUrls}
      pricePerCreditInr={pricePerCreditInr}
      creditsAvailable={creditsAvailable}
      ndviCurrent={project.satellite_ndvi_current}
      ndviTrend={project.satellite_ndvi_trend}
      confidenceBadge={project.satellite_confidence_badge}
      confidenceScore={project.satellite_confidence_score}
      satelliteStatus={project.satellite_status}
      satelliteThumbnailUrl={project.satellite_thumbnail_url}
      ownershipProof={
        ownershipPath && ownershipProofUrl
          ? {
              name: fileNameFromPath(ownershipPath),
              extension: ownershipExtension,
              url: ownershipProofUrl,
            }
          : null
      }
      specifications={specifications}
    />
  );
}
