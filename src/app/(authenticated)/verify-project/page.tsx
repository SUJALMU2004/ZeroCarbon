import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, FileText, TreePine } from "lucide-react";
import { ProjectVerifyForm } from "@/app/(authenticated)/verify-project/ProjectVerifyForm";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { IdentityStatus } from "@/types/dashboard";

type ExistingProject = {
  id: string;
  project_name: string;
  project_type: string;
  status: IdentityStatus;
  submitted_at: string;
  review_notes: string | null;
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

function formatDate(value: string): string {
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

export default async function VerifyProjectPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: projectsData, error: projectsError } = await supabase
    .from("carbon_projects")
    .select("id, project_name, project_type, status, submitted_at, review_notes")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (projectsError) {
    console.error("verify_project_page_projects_query_failed", {
      userId: user.id,
      reason: projectsError.message,
    });
  }

  const existingProjects = ((projectsData ?? []) as ExistingProject[]).map((project) => ({
    ...project,
    status: project.status ?? "not_submitted",
  }));

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <Link
        href="/dashboard/seller"
        className="inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-900"
      >
        <ChevronLeft className="h-4 w-4" />
        <span>Back to Dashboard</span>
      </Link>

      <header className="mt-6">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50">
          <TreePine className="h-6 w-6 text-green-600" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-gray-900">Verify Your Carbon Project</h1>
        <p className="mt-2 text-sm text-gray-500">
          Submit your project details for review. Approved projects will be listed on the ZeroCarbon marketplace.
        </p>
      </header>

      {existingProjects.length > 0 ? (
        <section className="mt-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Your Submitted Projects</h2>
          <div className="mt-4 space-y-3">
            {existingProjects.map((project) => (
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
                    {project.project_type}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(project.status)}`}>
                    {formatStatusLabel(project.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm md:p-8">
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
          <FileText className="mt-0.5 h-4 w-4 text-gray-500" />
          <p>
            Provide accurate project data. Submissions are reviewed by the ZeroCarbon team before approval.
          </p>
        </div>

        <ProjectVerifyForm existingProjects={existingProjects} userEmail={user.email ?? ""} />
      </section>
    </div>
  );
}

