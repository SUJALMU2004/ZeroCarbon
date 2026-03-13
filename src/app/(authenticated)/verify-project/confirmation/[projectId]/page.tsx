import Link from "next/link";
import { FileText } from "lucide-react";
import { redirect } from "next/navigation";
import ConfirmationHero from "@/components/projects/ConfirmationHero";
import ProjectDetailMapLoader from "@/components/projects/ProjectDetailMapLoader";
import ProjectPhotoGrid from "@/components/projects/ProjectPhotoGrid";
import ProjectSummarySection from "@/components/projects/ProjectSummarySection";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseProjectReviewNotes, getSubmissionDescription } from "@/lib/utils/projectMetadata";
import { getProjectReference } from "@/lib/utils/projectReference";
import { getProjectStatusMeta } from "@/lib/utils/projectStatus";


type ProjectRow = {
  id: string;
  user_id: string;
  project_name: string | null;
  project_type: string | null;
  status: string | null;
  created_at: string;
  submitted_at: string | null;
  project_start_date: string | null;
  latitude: number | null;
  longitude: number | null;
  polygon_geojson: object | null;
  land_area_hectares: number | null;
  estimated_co2_per_year: number | null;
  review_notes: string | null;
};

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

function getProjectTypeLabel(type: string | null): string {
  if (type === "forestry") return "Forestry";
  if (type === "agricultural") return "Agricultural";
  if (type === "solar") return "Solar";
  if (type === "methane") return "Methane";
  if (type === "windmill") return "Windmill";
  return "Other";
}

function fileNameFromPath(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
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

export default async function VerifyProjectConfirmationPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/verify-project");
  }

  const { data: projectData, error: projectError } = await supabase
    .from("carbon_projects")
    .select(
      "id, user_id, project_name, project_type, status, created_at, submitted_at, project_start_date, latitude, longitude, polygon_geojson, land_area_hectares, estimated_co2_per_year, review_notes",
    )
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (projectError) {
    console.error("project_confirmation_query_failed", {
      userId: user.id,
      projectId,
      reason: projectError.message,
    });
    redirect("/dashboard/seller");
  }

  const project = (projectData ?? null) as ProjectRow | null;
  if (!project || project.user_id !== user.id) {
    redirect("/dashboard/seller");
  }

  const parsedNotes = parseProjectReviewNotes(project.review_notes);
  const metadata = parsedNotes.submissionMetadata;
  const referenceId = getProjectReference(project.id, project.created_at);
  const statusMeta = getProjectStatusMeta(project.status ?? "pending");
  const description = getSubmissionDescription(metadata);

  const photoPaths = metadata.project_photo_urls ?? [];
  const signedPhotoItems: Array<{ url: string; name: string }> = [];

  for (const path of photoPaths) {
    const { data } = await supabase.storage
      .from("project-photos")
      .createSignedUrl(path, 3600);

    if (data?.signedUrl) {
      signedPhotoItems.push({
        url: data.signedUrl,
        name: fileNameFromPath(path),
      });
    }
  }

  const isLandProject =
    project.project_type === "forestry" || project.project_type === "agricultural";
  const isPolygonProject =
    project.project_type === "forestry" ||
    project.project_type === "agricultural" ||
    project.project_type === "solar";

  return (
    <div className="min-h-full p-4">
      <div className="mx-auto max-w-5xl space-y-6">
        <ConfirmationHero referenceId={referenceId} />

        <ProjectSummarySection
          title="Project Overview"
          rows={[
            { label: "Project Name", value: project.project_name ?? "-" },
            { label: "Project Type", value: getProjectTypeLabel(project.project_type) },
            { label: "Description", value: description || "-" },
            {
              label: "Estimated Carbon Credits",
              value:
                project.estimated_co2_per_year !== null
                  ? `${project.estimated_co2_per_year}`
                  : "-",
            },
            {
              label: "Submission Date",
              value: formatDateTime(project.submitted_at ?? project.created_at),
            },
            { label: "Status", value: statusMeta.label },
          ]}
        />

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Location</h2>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusMeta.className}`}>
              {statusMeta.label}
            </span>
          </div>

          <div className="mt-4">
            <ProjectDetailMapLoader
              projectType={project.project_type}
              latitude={project.latitude}
              longitude={project.longitude}
              polygonGeojson={project.polygon_geojson}
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {isPolygonProject ? (
              <div>
                <p className="text-sm font-medium text-gray-500">Hectares</p>
                <p className="mt-1 text-sm text-gray-800">
                  {project.land_area_hectares !== null
                    ? `${project.land_area_hectares} ha`
                    : "-"}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-gray-500">Coordinates</p>
                <p className="mt-1 text-sm text-gray-800">
                  {project.latitude !== null && project.longitude !== null
                    ? `${project.latitude.toFixed(6)}, ${project.longitude.toFixed(6)}`
                    : "-"}
                </p>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-gray-500">Country</p>
              <p className="mt-1 text-sm text-gray-800">{metadata.country || "-"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Region / State</p>
              <p className="mt-1 text-sm text-gray-800">{metadata.state || "-"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-sm font-medium text-gray-500">Address</p>
              <p className="mt-1 text-sm text-gray-800">{metadata.street_address || "-"}</p>
            </div>
          </div>
        </section>

        <ProjectSummarySection
          title="Seller Information"
          rows={[
            { label: "Organization Name", value: metadata.organization_name || "-" },
            { label: "Organization Type", value: metadata.organization_type || "-" },
            {
              label: "Organization Type (Other)",
              value: metadata.organization_type_other || "-",
            },
            { label: "Seller Name", value: metadata.seller_name || "-" },
            { label: "Seller Email", value: metadata.seller_email || "-" },
          ]}
        />

        {project.project_type === "solar" ? (
          <ProjectSummarySection
            title="Solar Details"
            rows={[
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
              { label: "Grid Region", value: metadata.grid_region || "-" },
            ]}
          />
        ) : null}

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <h2 className="text-lg font-semibold text-gray-900">Ownership Documents</h2>
          {metadata.ownership_document_urls && metadata.ownership_document_urls.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {metadata.ownership_document_urls.map((path) => (
                <li key={path} className="flex items-center gap-2 text-sm text-gray-700">
                  <FileText className="h-4 w-4 text-gray-400" />
                  <span>{fileNameFromPath(path)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-gray-500">No ownership documents available.</p>
          )}
        </section>

        {isLandProject ? (
          <ProjectSummarySection
            title="Land Details"
            rows={[
              {
                label: "Species",
                value: metadata.species && metadata.species.length > 0 ? metadata.species.join(", ") : "-",
              },
              {
                label: "Number of Trees / Plants",
                value: metadata.number_of_trees || "-",
              },
              { label: "Planting Year", value: metadata.planting_year || "-" },
              {
                label: "Plantation Density",
                value: metadata.plantation_density || "-",
              },
            ]}
          />
        ) : null}

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <h2 className="text-lg font-semibold text-gray-900">Evidence Photos</h2>
          <div className="mt-4">
            <ProjectPhotoGrid photos={signedPhotoItems} />
          </div>
          <p className="mt-4 text-xs text-gray-500">
            GPS metadata advisory - photos reviewed manually.
          </p>
        </section>

        <ProjectSummarySection
          title="Agreement"
          rows={[
            {
              label: "Accepted",
              value: `Agreement accepted on ${formatDateTime(project.submitted_at ?? project.created_at)}`,
            },
          ]}
        />

        <div className="pb-4">
          <Link
            href="/dashboard/seller"
            className="inline-flex rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}


