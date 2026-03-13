import { redirect } from "next/navigation";
import ProjectDetailClient from "@/components/projects/ProjectDetailClient";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseProjectReviewNotes } from "@/lib/utils/projectMetadata";
import { getProjectReference } from "@/lib/utils/projectReference";
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
  satellite_ndvi_current: number | null;
  satellite_status: string | null;
  satellite_error_message: string | null;
  satellite_last_attempted_at: string | null;
  review_notes: string | null;
  edit_permitted: boolean | null;
};

function fileNameFromPath(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

function extensionFromPath(path: string): string {
  const filename = fileNameFromPath(path).toLowerCase();
  const index = filename.lastIndexOf(".");
  return index >= 0 ? filename.slice(index + 1) : "";
}

export default async function ProjectDetailPage({
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
    redirect("/login");
  }

  const { data: projectData, error: projectError } = await supabase
    .from("carbon_projects")
    .select(
      "id, user_id, project_name, project_type, status, created_at, submitted_at, latitude, longitude, polygon_geojson, land_area_hectares, estimated_co2_per_year, project_start_date, satellite_ndvi_current, satellite_status, satellite_error_message, satellite_last_attempted_at, review_notes, edit_permitted",
    )
    .eq("id", id)
    .maybeSingle();

  if (projectError) {
    console.error("project_detail_query_failed", {
      userId: user.id,
      projectId: id,
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
  const aiValuation = await resolveAndPersistProjectAiValuation({
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
  });

  const photoItems: Array<{ path: string; name: string; url: string }> = [];
  const photoPaths = metadata.project_photo_urls ?? [];

  for (const path of photoPaths) {
    const { data, error } = await supabase.storage
      .from("project-photos")
      .createSignedUrl(path, 3600);

    if (error) {
      console.error("project_detail_photo_signed_url_failed", {
        userId: user.id,
        projectId: project.id,
        path,
        reason: error.message,
      });
      continue;
    }

    if (data?.signedUrl) {
      photoItems.push({
        path,
        name: fileNameFromPath(path),
        url: data.signedUrl,
      });
    }
  }

  const ownershipDocumentItems: Array<{
    path: string;
    name: string;
    url: string;
    extension: string;
  }> = [];
  const ownershipDocumentPaths = metadata.ownership_document_urls ?? [];

  for (const path of ownershipDocumentPaths) {
    const { data, error } = await supabase.storage
      .from("verification-documents")
      .createSignedUrl(path, 3600);

    if (error) {
      console.error("project_detail_document_signed_url_failed", {
        userId: user.id,
        projectId: project.id,
        path,
        reason: error.message,
      });
      continue;
    }

    if (data?.signedUrl) {
      ownershipDocumentItems.push({
        path,
        name: fileNameFromPath(path),
        url: data.signedUrl,
        extension: extensionFromPath(path),
      });
    }
  }

  return (
    <div className="min-h-full p-4">
      <div className="mx-auto max-w-5xl">
        <ProjectDetailClient
          projectId={project.id}
          userId={user.id}
          referenceId={referenceId}
          projectName={project.project_name ?? ""}
          projectType={project.project_type}
          status={project.status}
          createdAt={project.created_at}
          submittedAt={project.submitted_at}
          latitude={project.latitude}
          longitude={project.longitude}
          polygonGeojson={project.polygon_geojson}
          landAreaHectares={project.land_area_hectares}
          estimatedCo2PerYear={project.estimated_co2_per_year}
          satelliteNdviCurrent={project.satellite_ndvi_current}
          aiValuation={aiValuation}
          editPermitted={project.edit_permitted === true}
          metadata={metadata}
          photoItems={photoItems}
          ownershipDocumentItems={ownershipDocumentItems}
        />
      </div>
    </div>
  );
}

