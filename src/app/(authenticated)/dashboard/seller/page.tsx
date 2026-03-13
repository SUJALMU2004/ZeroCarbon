import Link from "next/link";
import {
  Award,
  BarChart2,
  DollarSign,
  TreePine,
  TrendingUp,
} from "lucide-react";
import ProjectCard from "@/components/dashboard/seller/ProjectCard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import {
  getNormalizedProjectAiValuation,
  getSubmissionDescription,
  parseProjectReviewNotes,
  type ProjectAiValuation,
} from "@/lib/utils/projectMetadata";
import { resolveAndPersistProjectAiValuation } from "@/lib/valuation/carbonValuation";
import type { IdentityStatus } from "@/types/dashboard";
import { parseNumeric } from "@/lib/payments/orders";

type ProjectRow = {
  id: string;
  project_name: string | null;
  project_type: string | null;
  status: IdentityStatus | null;
  latitude: number | null;
  longitude: number | null;
  polygon_geojson: object | null;
  review_notes: string | null;
  project_start_date: string | null;
  land_area_hectares: number | null;
  satellite_ndvi_current: number | null;
  satellite_status: string | null;
  satellite_error_message: string | null;
  satellite_last_attempted_at: string | null;
  submitted_at: string | null;
  created_at: string | null;
};

interface SellerProjectCardModel {
  id: string;
  projectName: string;
  projectType: string | null;
  status: string;
  submittedAt: string | null;
  description: string;
  rejectionReason: string;
  valuation: ProjectAiValuation;
}

type RecentSaleRow = {
  id: string;
  purchase_ref: string;
  project_name_snapshot: string;
  reference_id_snapshot: string;
  buyer_company_name_snapshot: string;
  quantity: number | null;
  total_amount_inr: number | string | null;
  created_at: string;
};

function parseRejectionReason(status: string, reviewNotes: string | null): string {
  if (status !== "rejected" || !reviewNotes) {
    return "";
  }

  const parsed = parseProjectReviewNotes(reviewNotes);
  if (parsed.submissionMetadata.rejection_reason) {
    return parsed.submissionMetadata.rejection_reason;
  }

  if (reviewNotes.trim().startsWith("{")) {
    return "";
  }

  return reviewNotes.trim();
}

export default async function SellerDashboardPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let projects: SellerProjectCardModel[] = [];
  let recentSales: Array<{
    id: string;
    purchaseRef: string;
    projectName: string;
    referenceId: string;
    buyerCompanyName: string;
    quantity: number;
    totalAmountInr: number;
    createdAt: string;
  }> = [];

  if (user?.id) {
    const { data: projectsData, error: projectsError } = await supabase
      .from("carbon_projects")
      .select(
        "id, project_name, project_type, status, latitude, longitude, polygon_geojson, review_notes, project_start_date, land_area_hectares, satellite_ndvi_current, satellite_status, satellite_error_message, satellite_last_attempted_at, submitted_at, created_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (projectsError) {
      console.error("seller_dashboard_projects_query_failed", {
        userId: user.id,
        reason: projectsError.message,
      });
    } else {
      const typedProjects = (projectsData ?? []) as ProjectRow[];
      const hydratedProjects: SellerProjectCardModel[] = [];

      for (const project of typedProjects) {
        const parsed = parseProjectReviewNotes(project.review_notes);
        const status = project.status ?? "not_submitted";
        const valuation = await resolveAndPersistProjectAiValuation({
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

        hydratedProjects.push({
          id: project.id,
          projectName: project.project_name ?? "Untitled Project",
          projectType: project.project_type,
          status,
          submittedAt: project.submitted_at ?? project.created_at,
          description: getSubmissionDescription(parsed.submissionMetadata),
          rejectionReason: parseRejectionReason(status, project.review_notes),
          valuation,
        });
      }

      projects = hydratedProjects;
    }

    try {
      const service = createServiceSupabaseClient();
      const { data: salesData, error: salesError } = await service
        .from("project_credit_orders")
        .select(
          "id, purchase_ref, project_name_snapshot, reference_id_snapshot, buyer_company_name_snapshot, quantity, total_amount_inr, created_at",
        )
        .eq("seller_user_id", user.id)
        .eq("status", "captured")
        .order("created_at", { ascending: false });

      if (salesError) {
        console.error("seller_dashboard_sales_query_failed", {
          userId: user.id,
          reason: salesError.message,
        });
      } else {
        recentSales = ((salesData ?? []) as RecentSaleRow[]).map((sale) => ({
          id: sale.id,
          purchaseRef: sale.purchase_ref,
          projectName: sale.project_name_snapshot,
          referenceId: sale.reference_id_snapshot,
          buyerCompanyName: sale.buyer_company_name_snapshot,
          quantity: Math.max(0, Math.floor(parseNumeric(sale.quantity ?? 0))),
          totalAmountInr: parseNumeric(sale.total_amount_inr ?? 0),
          createdAt: sale.created_at,
        }));
      }
    } catch (error) {
      console.error("seller_dashboard_sales_service_init_failed", {
        userId: user.id,
        reason: error instanceof Error ? error.message : "unknown_error",
      });
    }
  }

  const totalProjects = projects.length;
  const verifiedProjects = projects.filter((project) => project.status === "verified").length;
  const latestRejectedProject = projects.find(
    (project) => project.status === "rejected" && project.rejectionReason.length > 0,
  );
  const readyValuations = projects
    .map((project) => getNormalizedProjectAiValuation(project.valuation))
    .filter(
      (valuation) =>
        valuation.status === "ready" &&
        typeof valuation.creditsAvailable === "number" &&
        typeof valuation.pricePerCreditInr === "number",
    );
  const totalCreditsAvailable = readyValuations.reduce(
    (sum, valuation) => sum + (valuation.creditsAvailable ?? 0),
    0,
  );
  const weightedPriceNumerator = readyValuations.reduce((sum, valuation) => {
    const credits = valuation.creditsAvailable ?? 0;
    const price = valuation.pricePerCreditInr ?? 0;
    return sum + credits * price;
  }, 0);
  const weightedAveragePrice =
    totalCreditsAvailable > 0
      ? Math.round(weightedPriceNumerator / totalCreditsAvailable)
      : null;
  const hasEligibleVerifiedProjects = projects.some(
    (project) =>
      project.status === "verified" &&
      (project.projectType === "forestry" ||
        project.projectType === "agricultural" ||
        project.projectType === "solar" ||
        project.projectType === "methane" ||
        project.projectType === "windmill"),
  );

  const totalCreditsSold = recentSales.reduce((sum, sale) => sum + sale.quantity, 0);
  const totalRevenueEarnedInr = recentSales.reduce(
    (sum, sale) => sum + sale.totalAmountInr,
    0,
  );
  const visibleRecentSales = recentSales.slice(0, 8);

  return (
    <div className="text-gray-900">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Seller Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your carbon projects and track sales.</p>
      </div>

      {latestRejectedProject ? (
        <section className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-semibold text-rose-900">Project Rejected</p>
          <p className="mt-1 text-sm text-rose-700">{latestRejectedProject.rejectionReason}</p>
          <Link
            href="/verify-project"
            className="mt-2 inline-flex text-sm font-semibold text-rose-700 transition-colors hover:text-rose-800"
          >
            Resubmit Project
          </Link>
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50">
            <TreePine className="h-5 w-5 text-green-500" />
          </div>
          <p className="mt-3 text-xl font-bold text-gray-900 md:text-2xl">{verifiedProjects}</p>
          <p className="mt-1 text-xs font-medium text-gray-500 md:text-sm">Active Projects</p>
          <p className="mt-1 text-xs text-gray-400">
            {verifiedProjects > 0 ? "Verified projects" : "No verified projects yet"}
          </p>
        </article>

        <article className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
            <Award className="h-5 w-5 text-blue-500" />
          </div>
          <p className="mt-3 text-xl font-bold text-gray-900 md:text-2xl">
            {totalCreditsAvailable.toLocaleString()}
          </p>
          <p className="mt-1 text-xs font-medium text-gray-500 md:text-sm">Credits Available</p>
          <p className="mt-1 text-xs text-gray-400">
            {weightedAveragePrice !== null
              ? `Price per credit: INR ${weightedAveragePrice.toLocaleString()}`
              : hasEligibleVerifiedProjects
                ? "Awaiting satellite and AI valuation."
                : "No eligible verified projects."}
          </p>
        </article>

        <article className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="mt-3 text-xl font-bold text-gray-900 md:text-2xl">
            {totalCreditsSold.toLocaleString("en-IN")}
          </p>
          <p className="mt-1 text-xs font-medium text-gray-500 md:text-sm">Credits Sold</p>
          <p className="mt-1 text-xs text-gray-400">
            {totalCreditsSold > 0 ? "Captured sales" : "No captured sales yet"}
          </p>
        </article>

        <article className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50">
            <DollarSign className="h-5 w-5 text-purple-500" />
          </div>
          <p className="mt-3 text-xl font-bold text-gray-900 md:text-2xl">
            INR{" "}
            {totalRevenueEarnedInr.toLocaleString("en-IN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="mt-1 text-xs font-medium text-gray-500 md:text-sm">Revenue Earned</p>
          <p className="mt-1 text-xs text-gray-400">
            {totalRevenueEarnedInr > 0 ? "Gross captured revenue" : "No revenue yet"}
          </p>
        </article>
      </div>

      <div className="mt-6 flex flex-col gap-6">
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-8 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-900">Your Carbon Projects</h2>
            <Link
              href="/verify-project"
              className="rounded-xl bg-green-600 px-3 py-2 text-xs font-semibold text-white transition-all duration-200 hover:bg-green-700"
            >
              Submit New Project
            </Link>
          </div>

          {totalProjects === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/70 px-6 py-14 text-center">
              <TreePine className="h-12 w-12 text-gray-300" />
              <p className="mt-4 text-sm font-medium text-gray-700">No projects yet</p>
              <p className="mt-1 text-sm text-gray-500">
                Submit your first carbon project to start the verification flow.
              </p>
              <Link
                href="/verify-project"
                className="mt-5 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-green-700"
              >
                Submit your first project
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  id={project.id}
                  projectName={project.projectName}
                  projectType={project.projectType}
                  status={project.status}
                  description={project.description}
                  submittedAt={project.submittedAt}
                />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-base font-semibold text-gray-900">Sales Overview</h2>
          {visibleRecentSales.length === 0 ? (
            <div className="flex min-h-55 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50">
              <BarChart2 className="h-12 w-12 text-gray-300" />
              <p className="mt-4 max-w-sm text-center text-sm text-gray-500">
                Captured sales will appear here after buyers complete payments.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3">Purchase Ref</th>
                    <th className="py-2 pr-3">Project</th>
                    <th className="py-2 pr-3">Buyer</th>
                    <th className="py-2 pr-3">Quantity</th>
                    <th className="py-2 pr-3">Total</th>
                    <th className="py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRecentSales.map((sale) => (
                    <tr key={sale.id} className="border-b border-gray-100 text-sm text-gray-700">
                      <td className="py-3 pr-3 font-semibold text-gray-900">{sale.purchaseRef}</td>
                      <td className="py-3 pr-3">
                        <p className="font-medium text-gray-900">{sale.projectName}</p>
                        <p className="text-xs text-gray-500">{sale.referenceId}</p>
                      </td>
                      <td className="py-3 pr-3">{sale.buyerCompanyName}</td>
                      <td className="py-3 pr-3">{sale.quantity.toLocaleString("en-IN")}</td>
                      <td className="py-3 pr-3 font-semibold text-gray-900">
                        INR{" "}
                        {sale.totalAmountInr.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-3 text-xs text-gray-500">
                        {new Intl.DateTimeFormat("en-IN", {
                          year: "numeric",
                          month: "short",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(sale.createdAt))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}


