import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  BUYER_DASHBOARD_EMISSIONS_HISTORY_SELECT,
  normalizeBuyerDashboardEmissionRun,
} from "@/types/dashboard-emissions";

type CompanyRow = {
  id: string;
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function parsePositiveInt(
  value: string | null,
  fallback: number,
  max: number,
): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.floor(parsed);
  if (normalized <= 0) return fallback;
  return Math.min(normalized, max);
}

function unauthorizedResponse() {
  return NextResponse.json(
    {
      error: "Unauthorized. Please log in.",
    },
    { status: 401 },
  );
}

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const page = parsePositiveInt(
      searchParams.get("page"),
      DEFAULT_PAGE,
      Number.MAX_SAFE_INTEGER,
    );
    const pageSize = parsePositiveInt(
      searchParams.get("pageSize"),
      DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE,
    );

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data: companyData, error: companyError } = await supabase
      .from("companies")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (companyError) {
      console.error("buyer_emissions_history_company_query_failed", {
        userId: user.id,
        reason: companyError.message,
      });
      return NextResponse.json(
        {
          error: "Failed to load company for emission history.",
        },
        { status: 500 },
      );
    }

    const typedCompany = (companyData ?? null) as CompanyRow | null;
    if (!typedCompany?.id) {
      return NextResponse.json(
        {
          items: [],
          page,
          pageSize,
          hasMore: false,
        },
        { status: 200 },
      );
    }

    const { data, count, error } = await supabase
      .from("company_emission_assessments")
      .select(BUYER_DASHBOARD_EMISSIONS_HISTORY_SELECT, { count: "exact" })
      .eq("user_id", user.id)
      .eq("company_id", typedCompany.id)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("buyer_emissions_history_query_failed", {
        userId: user.id,
        companyId: typedCompany.id,
        reason: error.message,
      });
      return NextResponse.json(
        {
          error: "Failed to load emission history.",
        },
        { status: 500 },
      );
    }

    const items = ((data ?? []) as Array<Record<string, unknown>>)
      .map((row) => normalizeBuyerDashboardEmissionRun(row))
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const hasMore =
      typeof count === "number"
        ? from + items.length < count
        : items.length === pageSize;

    return NextResponse.json(
      {
        items,
        page,
        pageSize,
        hasMore,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("buyer_emissions_history_unhandled_error", {
      reason: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json(
      {
        error: "Unexpected error while loading emission history.",
      },
      { status: 500 },
    );
  }
}
