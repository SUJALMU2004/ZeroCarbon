import { redirect } from "next/navigation";
import ProjectPaymentDetailsClient from "@/components/projects/ProjectPaymentDetailsClient";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getNormalizedProjectAiValuation,
  parseProjectReviewNotes,
} from "@/lib/utils/projectMetadata";
import { getProjectReference } from "@/lib/utils/projectReference";
import { resolveAndPersistProjectAiValuation } from "@/lib/valuation/carbonValuation";
import { computeRemainingCredits } from "@/lib/payments/math";

type SearchParams = {
  quantity?: string | string[];
};

type ProjectRow = {
  id: string;
  project_name: string | null;
  project_type: string | null;
  status: string | null;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
  polygon_geojson: object | null;
  land_area_hectares: number | null;
  project_start_date: string | null;
  satellite_status: string | null;
  satellite_ndvi_current: number | null;
  satellite_error_message: string | null;
  satellite_last_attempted_at: string | null;
  credits_reserved: number | null;
  credits_sold: number | null;
  review_notes: string | null;
};

type CompanyRow = {
  status: string | null;
  legal_company_name: string | null;
};

function getSingleSearchValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function normalizeQuantity(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
}

function getProjectTypeLabel(projectType: string | null): string {
  if (projectType === "forestry") return "Forestry";
  if (projectType === "agricultural") return "Agricultural";
  if (projectType === "solar") return "Solar";
  if (projectType === "methane") return "Methane";
  if (projectType === "windmill") return "Windmill";
  return "Project";
}

function getGstRatePercent(): number {
  const raw = process.env.PAYMENT_GST_RATE_PERCENT;
  if (!raw) return 2.5;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return 2.5;
  return parsed;
}

export default async function ProjectPaymentDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const requestedQuantity = normalizeQuantity(
    getSingleSearchValue(query.quantity),
  );

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(`/projects/${id}/payment`)}`);
  }

  const { data: projectData, error: projectError } = await supabase
    .from("carbon_projects")
    .select(
      "id, project_name, project_type, status, created_at, latitude, longitude, polygon_geojson, land_area_hectares, project_start_date, satellite_status, satellite_ndvi_current, satellite_error_message, satellite_last_attempted_at, credits_reserved, credits_sold, review_notes",
    )
    .eq("id", id)
    .eq("status", "verified")
    .maybeSingle();

  if (projectError) {
    console.error("project_payment_details_query_failed", {
      userId: user.id,
      projectId: id,
      reason: projectError.message,
    });
    redirect("/projects");
  }

  const project = (projectData ?? null) as ProjectRow | null;
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
  const valuation = getNormalizedProjectAiValuation(
    resolvedValuation ?? parsedNotes.submissionMetadata.ai_valuation,
  );

  const creditsAvailable = computeRemainingCredits({
    valuationCredits: valuation.creditsAvailable,
    creditsReserved: project.credits_reserved,
    creditsSold: project.credits_sold,
  });
  const maxQuantity =
    creditsAvailable !== null &&
    Number.isFinite(creditsAvailable) &&
    creditsAvailable > 0
      ? Math.max(1, Math.min(Math.floor(creditsAvailable), 1_000_000))
      : 1;

  const clampedInitialQuantity = Math.min(
    Math.max(requestedQuantity, 1),
    maxQuantity,
  );

  const { data: companyData, error: companyError } = await supabase
    .from("companies")
    .select("status, legal_company_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (companyError) {
    console.error("project_payment_details_company_query_failed", {
      userId: user.id,
      reason: companyError.message,
    });
  }

  const company = (companyData ?? null) as CompanyRow | null;

  return (
    <ProjectPaymentDetailsClient
      projectId={project.id}
      projectTitle={project.project_name?.trim() || "Untitled Project"}
      projectReferenceId={getProjectReference(project.id, project.created_at)}
      projectTypeLabel={getProjectTypeLabel(project.project_type)}
      unitPricePerCreditInr={valuation.pricePerCreditInr}
      creditsAvailable={creditsAvailable}
      initialQuantity={clampedInitialQuantity}
      gstRatePercent={getGstRatePercent()}
      buyerCompanyName={company?.legal_company_name?.trim() || null}
      buyerCompanyStatus={company?.status ?? null}
    />
  );
}
