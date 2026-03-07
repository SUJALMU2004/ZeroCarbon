import Link from "next/link";
import {
  Award,
  BarChart2,
  DollarSign,
  TreePine,
  TrendingUp,
} from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { IdentityStatus } from "@/types/dashboard";

type ProjectRow = {
  id: string;
  project_name: string;
  project_type: string;
  status: IdentityStatus;
  review_notes: string | null;
  submitted_at: string | null;
  created_at: string | null;
};

function getStatusBadgeClass(status: IdentityStatus): string {
  if (status === "pending") {
    return "border border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "verified") {
    return "border border-green-200 bg-green-50 text-green-700";
  }

  if (status === "rejected") {
    return "border border-red-200 bg-red-50 text-red-700";
  }

  if (status === "resubmit_required") {
    return "border border-orange-200 bg-orange-50 text-orange-700";
  }

  return "border border-gray-200 bg-gray-50 text-gray-600";
}

function formatStatusLabel(status: IdentityStatus): string {
  if (status === "resubmit_required") {
    return "Resubmit Required";
  }

  if (status === "not_submitted") {
    return "Not Submitted";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatProjectTypeLabel(type: string): string {
  if (!type) {
    return "Unknown";
  }

  return type.charAt(0).toUpperCase() + type.slice(1);
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Unknown date";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

export default async function SellerDashboardPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let projects: ProjectRow[] = [];

  if (user?.id) {
    const { data: projectsData, error: projectsError } = await supabase
      .from("carbon_projects")
      .select("id, project_name, project_type, status, review_notes, submitted_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (projectsError) {
      console.error("seller_dashboard_projects_query_failed", {
        userId: user.id,
        reason: projectsError.message,
      });
    } else {
      projects = ((projectsData ?? []) as ProjectRow[]).map((project) => ({
        ...project,
        status: project.status ?? "not_submitted",
      }));
    }
  }

  const totalProjects = projects.length;
  const verifiedProjects = projects.filter((project) => project.status === "verified").length;
  const latestRejectedProject = projects.find(
    (project) =>
      project.status === "rejected" &&
      typeof project.review_notes === "string" &&
      project.review_notes.trim().length > 0,
  ) ?? null;
  const displayedProjects = projects.slice(0, 3);
  const remainingProjects = totalProjects > displayedProjects.length ? totalProjects - displayedProjects.length : 0;

  return (
    <div className="text-gray-900">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Seller Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your carbon projects and track sales.</p>
      </div>

      {latestRejectedProject ? (
        <section className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-semibold text-rose-900">Project Rejected</p>
          <p className="mt-1 text-sm text-rose-700">{latestRejectedProject.review_notes}</p>
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
          <p className="mt-3 text-xl font-bold text-gray-900 md:text-2xl">0</p>
          <p className="mt-1 text-xs font-medium text-gray-500 md:text-sm">Credits Issued</p>
          <p className="mt-1 text-xs text-gray-400">Total tCO2e issued</p>
        </article>

        <article className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="mt-3 text-xl font-bold text-gray-900 md:text-2xl">0</p>
          <p className="mt-1 text-xs font-medium text-gray-500 md:text-sm">Credits Sold</p>
          <p className="mt-1 text-xs text-gray-400">Lifetime sales</p>
        </article>

        <article className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50">
            <DollarSign className="h-5 w-5 text-purple-500" />
          </div>
          <p className="mt-3 text-xl font-bold text-gray-900 md:text-2xl">$0.00</p>
          <p className="mt-1 text-xs font-medium text-gray-500 md:text-sm">Revenue Earned</p>
          <p className="mt-1 text-xs text-gray-400">Total earnings</p>
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
              <p className="mt-4 text-sm font-medium text-gray-700">No projects listed yet</p>
              <p className="mt-1 text-sm text-gray-500">
                Submit your carbon project for verification to start selling credits.
              </p>
              <Link
                href="/verify-project"
                className="mt-5 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-green-700"
              >
                Verify Your Project
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex flex-col gap-2 rounded-xl border border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{project.project_name}</p>
                    <p className="mt-1 text-xs text-gray-500">Submitted {formatDate(project.submitted_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {formatProjectTypeLabel(project.project_type)}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(project.status)}`}>
                      {formatStatusLabel(project.status)}
                    </span>
                  </div>
                </div>
              ))}

              {remainingProjects > 0 ? (
                <p className="text-xs text-gray-500">and {remainingProjects} more project(s)...</p>
              ) : null}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-base font-semibold text-gray-900">Sales Overview</h2>
          <div className="flex min-h-55 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50">
            <BarChart2 className="h-12 w-12 text-gray-300" />
            <p className="mt-4 max-w-sm text-center text-sm text-gray-500">
              Sales data will appear here once your first project is approved.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
