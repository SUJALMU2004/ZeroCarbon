import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import type { IdentityStatus } from "@/types/dashboard";
import { parseNumeric } from "@/lib/payments/orders";

type ProjectRow = {
  id: string;
  project_name: string;
  project_type: string;
  status: IdentityStatus;
  submitted_at: string | null;
  created_at: string | null;
};

function unauthorizedResponse() {
  return NextResponse.json(
    {
      error: "Unauthorized. Please log in.",
    },
    { status: 401 },
  );
}

function buildDefaultResponse(errorState: boolean) {
  return {
    _error: errorState,
    projects: {
      total: 0,
      pending: 0,
      verified: 0,
      rejected: 0,
      latest_project: null as {
        name: string;
        type: string;
        status: string;
      } | null,
    },
    stats: {
      credits_issued: 0,
      credits_sold: 0,
      revenue_earned_inr: 0,
      revenue_earned_usd: 0,
    },
  };
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedResponse();
    }

    const { data: projects, count, error: projectsError } = await supabase
      .from("carbon_projects")
      .select("id, project_name, project_type, status, submitted_at, created_at", {
        count: "exact",
      })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (projectsError) {
      console.error("seller_stats_projects_query_failed", {
        userId: user.id,
        reason: projectsError.message,
      });
      return NextResponse.json(buildDefaultResponse(true), { status: 200 });
    }

    const typedProjects = (projects ?? []) as ProjectRow[];
    const pendingCount = typedProjects.filter((project) => project.status === "pending").length;
    const verifiedCount = typedProjects.filter((project) => project.status === "verified").length;
    const rejectedCount = typedProjects.filter((project) => project.status === "rejected").length;
    const latestProject = typedProjects[0] ?? null;

    const service = createServiceSupabaseClient();
    const { data: capturedSalesData, error: capturedSalesError } = await service
      .from("project_credit_orders")
      .select("quantity, total_amount_inr")
      .eq("seller_user_id", user.id)
      .eq("status", "captured");

    let creditsSold = 0;
    let revenueEarnedInr = 0;

    if (capturedSalesError) {
      console.error("seller_stats_sales_query_failed", {
        userId: user.id,
        reason: capturedSalesError.message,
      });
    } else {
      const salesRows = (capturedSalesData ?? []) as Array<{
        quantity: number | null;
        total_amount_inr: number | string | null;
      }>;

      creditsSold = salesRows.reduce((sum, row) => {
        const quantity = parseNumeric(row.quantity ?? 0);
        return sum + Math.max(0, Math.floor(quantity));
      }, 0);

      revenueEarnedInr = salesRows.reduce((sum, row) => {
        return sum + parseNumeric(row.total_amount_inr ?? 0);
      }, 0);
    }

    return NextResponse.json(
      {
        _error: false,
        projects: {
          total: count ?? typedProjects.length,
          pending: pendingCount,
          verified: verifiedCount,
          rejected: rejectedCount,
          latest_project: latestProject
            ? {
                name: latestProject.project_name,
                type: latestProject.project_type,
                status: latestProject.status,
              }
            : null,
        },
        stats: {
          credits_issued: 0,
          credits_sold: creditsSold,
          revenue_earned_inr: revenueEarnedInr,
          revenue_earned_usd: 0,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("seller_stats_unhandled_error", {
      reason: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json(buildDefaultResponse(true), { status: 200 });
  }
}
