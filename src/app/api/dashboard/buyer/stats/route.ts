import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { IdentityStatus } from "@/types/dashboard";

type CompanyRow = {
  status: IdentityStatus | null;
  company_name: string | null;
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
    company: {
      status: "not_submitted" as IdentityStatus,
      company_name: null as string | null,
    },
    stats: {
      credits_purchased: 0,
      offset_progress_percent: 0,
      total_spent_usd: 0,
      total_emissions_tco2e: null as number | null,
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

    const { data: companyData, error: companyError } = await supabase
      .from("companies")
      .select("status, company_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (companyError) {
      console.error("buyer_stats_company_query_failed", {
        userId: user.id,
        reason: companyError.message,
      });
      return NextResponse.json(buildDefaultResponse(true), { status: 200 });
    }

    const typedCompany = (companyData ?? null) as CompanyRow | null;

    return NextResponse.json(
      {
        _error: false,
        company: {
          status: typedCompany?.status ?? "not_submitted",
          company_name: typedCompany?.company_name ?? null,
        },
        stats: {
          credits_purchased: 0,
          offset_progress_percent: 0,
          total_spent_usd: 0,
          total_emissions_tco2e: null,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("buyer_stats_unhandled_error", {
      reason: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json(buildDefaultResponse(true), { status: 200 });
  }
}
