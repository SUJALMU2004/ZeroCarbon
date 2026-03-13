import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { IdentityStatus } from "@/types/dashboard";

type CompanyRow = {
  id: string;
  status: IdentityStatus | null;
  company_name: string | null;
  legal_company_name: string | null;
};

type EmissionAssessmentRow = {
  total_corporate_tco2e: number | null;
  provider_diagnostics: Record<string, unknown> | null;
};

type EmissionsMode = "full" | "partial" | "none";

function resolveEmissionsMode(row: EmissionAssessmentRow | null): EmissionsMode {
  if (!row) return "none";
  const mode =
    row.provider_diagnostics &&
    typeof row.provider_diagnostics === "object" &&
    row.provider_diagnostics.result_mode === "partial"
      ? "partial"
      : "full";
  return mode;
}

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
      emissions_mode: "none" as EmissionsMode,
      emissions_note: null as string | null,
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
      .select("id, status, company_name, legal_company_name")
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
    let totalEmissionsTco2e: number | null = null;
    let emissionsMode: EmissionsMode = "none";
    let emissionsNote: string | null = null;

    if (typedCompany?.id) {
      const { data: emissionsData, error: emissionsError } = await supabase
        .from("company_emission_assessments")
        .select("total_corporate_tco2e, provider_diagnostics")
        .eq("user_id", user.id)
        .eq("company_id", typedCompany.id)
        .eq("audit_status", "SUCCESS_ZERO_TRUST_VERIFIED")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (emissionsError) {
        console.error("buyer_stats_emissions_query_failed", {
          userId: user.id,
          companyId: typedCompany.id,
          reason: emissionsError.message,
        });
      } else {
        const typedEmissions = (emissionsData ?? null) as EmissionAssessmentRow | null;
        totalEmissionsTco2e = typedEmissions?.total_corporate_tco2e ?? null;
        emissionsMode = resolveEmissionsMode(typedEmissions);
        emissionsNote =
          emissionsMode === "partial"
            ? "Partial result: Scope 3 spend unavailable due to provider plan limit."
            : null;
      }
    }

    return NextResponse.json(
      {
        _error: false,
        company: {
          status: typedCompany?.status ?? "not_submitted",
          company_name:
            typedCompany?.legal_company_name ??
            typedCompany?.company_name ??
            null,
        },
        stats: {
          credits_purchased: 0,
          offset_progress_percent: 0,
          total_spent_usd: 0,
          total_emissions_tco2e: totalEmissionsTco2e,
          emissions_mode: emissionsMode,
          emissions_note: emissionsNote,
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
