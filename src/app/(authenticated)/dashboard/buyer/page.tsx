import Link from "next/link";
import { BarChart2, Lock, TrendingUp, Wallet, XCircle } from "lucide-react";
import BuyerEmissionsSummaryPanel from "@/components/dashboard/buyer/BuyerEmissionsSummaryPanel";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import {
  BUYER_DASHBOARD_EMISSIONS_HISTORY_SELECT,
  normalizeBuyerDashboardEmissionRun,
  parseDatabaseNumber,
  resolveRunResultMode,
  type BuyerDashboardEmissionRun,
} from "@/types/dashboard-emissions";
import type { IdentityStatus } from "@/types/dashboard";
import { parseNumeric } from "@/lib/payments/orders";
import { computeOffsetProgressPercent } from "@/lib/payments/math";

type ProfileRow = {
  phone_verified: boolean | null;
  verification_status: IdentityStatus | null;
};

type CompanyRow = {
  id: string;
  status: IdentityStatus | null;
  legal_company_name: string | null;
  rejection_reason: string | null;
};

type LatestEmissionAssessmentRow = {
  total_corporate_tco2e: unknown;
  provider_diagnostics: Record<string, unknown> | null;
};

type RecentOrderRow = {
  id: string;
  purchase_ref: string;
  project_name_snapshot: string;
  reference_id_snapshot: string;
  quantity: number | null;
  total_amount_inr: number | string | null;
  status: string;
  created_at: string;
};

const EMISSIONS_HISTORY_PAGE_SIZE = 20;

function renderLockedOverlay(isVisible: boolean) {
  if (!isVisible) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-white/80 backdrop-blur-sm">
      <Lock className="h-5 w-5 text-gray-400" />
      <p className="mt-1 text-xs text-gray-400">Locked</p>
    </div>
  );
}

export default async function BuyerDashboardPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profileData: ProfileRow | null = null;
  let companyData: CompanyRow | null = null;
  let totalEmissionsTco2e: number | null = null;
  let emissionsMode: "full" | "partial" | "none" = "none";
  let creditsPurchased = 0;
  let totalSpentInr = 0;
  let offsetProgressPercent = 0;
  let emissionHistoryItems: BuyerDashboardEmissionRun[] = [];
  let emissionHistoryHasMore = false;
  let emissionHistoryTotalRuns = 0;
  let recentOrders: Array<{
    id: string;
    purchaseRef: string;
    projectName: string;
    referenceId: string;
    quantity: number;
    totalAmountInr: number;
    status: string;
    createdAt: string;
  }> = [];

  if (user?.id) {
    const { data: fetchedProfile, error: profileError } = await supabase
      .from("profiles")
      .select("phone_verified, verification_status")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("buyer_dashboard_profile_query_failed", {
        userId: user.id,
        reason: profileError.message,
      });
    } else {
      profileData = (fetchedProfile ?? null) as ProfileRow | null;
    }

    const { data: fetchedCompany, error: companyError } = await supabase
      .from("companies")
      .select("id, status, legal_company_name, rejection_reason")
      .eq("user_id", user.id)
      .maybeSingle();

    if (companyError) {
      console.error("buyer_dashboard_company_query_failed", {
        userId: user.id,
        reason: companyError.message,
      });
    } else {
      companyData = (fetchedCompany ?? null) as CompanyRow | null;

      if (companyData?.id) {
        const { data: emissionsData, error: emissionsError } = await supabase
          .from("company_emission_assessments")
          .select("total_corporate_tco2e, provider_diagnostics")
          .eq("user_id", user.id)
          .eq("company_id", companyData.id)
          .eq("audit_status", "SUCCESS_ZERO_TRUST_VERIFIED")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (emissionsError) {
          console.error("buyer_dashboard_emissions_query_failed", {
            userId: user.id,
            companyId: companyData.id,
            reason: emissionsError.message,
          });
        } else {
          const typedEmissions = (emissionsData ?? null) as LatestEmissionAssessmentRow | null;
          totalEmissionsTco2e = parseDatabaseNumber(
            typedEmissions?.total_corporate_tco2e ?? null,
          );
          if (typedEmissions) {
            emissionsMode = resolveRunResultMode(typedEmissions.provider_diagnostics);
          } else {
            emissionsMode = "none";
          }
        }

        if (companyData.status === "verified") {
          const { data: historyData, count: historyCount, error: historyError } =
            await supabase
              .from("company_emission_assessments")
              .select(BUYER_DASHBOARD_EMISSIONS_HISTORY_SELECT, { count: "exact" })
              .eq("user_id", user.id)
              .eq("company_id", companyData.id)
              .order("created_at", { ascending: false })
              .range(0, EMISSIONS_HISTORY_PAGE_SIZE - 1);

          if (historyError) {
            console.error("buyer_dashboard_emissions_history_query_failed", {
              userId: user.id,
              companyId: companyData.id,
              reason: historyError.message,
            });
          } else {
            const normalized = ((historyData ?? []) as Array<Record<string, unknown>>)
              .map((row) => normalizeBuyerDashboardEmissionRun(row))
              .filter((row): row is NonNullable<typeof row> => row !== null);

            emissionHistoryItems = normalized;
            emissionHistoryTotalRuns = typeof historyCount === "number" ? historyCount : normalized.length;
            emissionHistoryHasMore = normalized.length < emissionHistoryTotalRuns;
          }
        }
      }

      try {
        const service = createServiceSupabaseClient();
        const { data: ordersData, error: ordersError } = await service
          .from("project_credit_orders")
          .select(
            "id, purchase_ref, project_name_snapshot, reference_id_snapshot, quantity, total_amount_inr, status, created_at",
          )
          .eq("buyer_user_id", user.id)
          .eq("status", "captured")
          .order("created_at", { ascending: false });

        if (ordersError) {
          console.error("buyer_dashboard_orders_query_failed", {
            userId: user.id,
            reason: ordersError.message,
          });
        } else {
          const typedOrders = (ordersData ?? []) as RecentOrderRow[];
          creditsPurchased = typedOrders.reduce((sum, order) => {
            return sum + Math.max(0, Math.floor(parseNumeric(order.quantity ?? 0)));
          }, 0);

          totalSpentInr = typedOrders.reduce((sum, order) => {
            return sum + parseNumeric(order.total_amount_inr ?? 0);
          }, 0);

          recentOrders = typedOrders.slice(0, 5).map((order) => ({
            id: order.id,
            purchaseRef: order.purchase_ref,
            projectName: order.project_name_snapshot,
            referenceId: order.reference_id_snapshot,
            quantity: Math.max(0, Math.floor(parseNumeric(order.quantity ?? 0))),
            totalAmountInr: parseNumeric(order.total_amount_inr ?? 0),
            status: order.status,
            createdAt: order.created_at,
          }));
        }
      } catch (error) {
        console.error("buyer_dashboard_orders_service_init_failed", {
          userId: user.id,
          reason: error instanceof Error ? error.message : "unknown_error",
        });
      }
    }
  }

  offsetProgressPercent = computeOffsetProgressPercent({
    purchasedCredits: creditsPurchased,
    latestEmissionsTco2e: totalEmissionsTco2e,
  });

  const phoneVerified = profileData?.phone_verified === true;
  const verificationStatus = profileData?.verification_status ?? "not_submitted";
  const isIdentityVerified = phoneVerified && verificationStatus === "verified";
  const companyStatus = companyData?.status ?? "not_submitted";
  const rejectionReason = companyData?.rejection_reason?.trim() || null;
  const companyName = companyData?.legal_company_name ?? null;
  const isCompanyVerified = companyStatus === "verified";

  return (
    <div className="text-gray-900">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Buyer Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your carbon offset portfolio and emissions.</p>
      </div>

      {companyStatus === "rejected" && rejectionReason ? (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <XCircle className="mt-0.5 h-5 w-5 text-rose-500" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-rose-900">Company Registration Rejected</h2>
            <p className="mt-1 text-sm text-rose-700">{rejectionReason}</p>
            <Link href="/verify-company" className="mt-2 inline-flex text-sm font-semibold text-rose-700 hover:text-rose-800">
              Resubmit Registration
            </Link>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="relative rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:p-5">
          {renderLockedOverlay(!isCompanyVerified)}
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
            <BarChart2 className="h-5 w-5 text-blue-500" />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <p className="text-xl font-bold text-gray-900 md:text-2xl">
              {typeof totalEmissionsTco2e === "number"
                ? `${totalEmissionsTco2e.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} tCO2e`
                : "- tCO2e"}
            </p>
            {emissionsMode === "partial" ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                Partial
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs font-medium text-gray-500 md:text-sm">Total Emissions</p>
          <p className="mt-1 text-xs text-gray-400">
            {emissionsMode === "partial"
              ? "Scope 3 spend unavailable due to provider plan limit"
              : typeof totalEmissionsTco2e === "number"
                ? "Latest calculated run"
                : "Not calculated yet"}
          </p>
        </article>

        <article className="relative rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:p-5">
          {renderLockedOverlay(!isCompanyVerified)}
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50">
            <TrendingUp className="h-5 w-5 text-green-500" />
          </div>
          <p className="mt-3 text-xl font-bold text-gray-900 md:text-2xl">
            {creditsPurchased.toLocaleString("en-IN")}
          </p>
          <p className="mt-1 text-xs font-medium text-gray-500 md:text-sm">Credits Purchased</p>
          <p className="mt-1 text-xs text-gray-400">
            {creditsPurchased > 0 ? "Captured purchases only" : "No captured purchases yet"}
          </p>
        </article>

        <article className="relative rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:p-5">
          {renderLockedOverlay(!isCompanyVerified)}
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
            <TrendingUp className="h-5 w-5 text-amber-500" />
          </div>
          <p className="mt-3 text-xl font-bold text-gray-900 md:text-2xl">
            {offsetProgressPercent.toLocaleString("en-IN", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            })}
            %
          </p>
          <p className="mt-1 text-xs font-medium text-gray-500 md:text-sm">Offset Progress</p>
          <p className="mt-1 text-xs text-gray-400">
            {totalEmissionsTco2e !== null
              ? "Credits purchased vs latest emissions run"
              : "Requires at least one emissions run"}
          </p>
        </article>

        <article className="relative rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:p-5">
          {renderLockedOverlay(!isCompanyVerified)}
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50">
            <Wallet className="h-5 w-5 text-purple-500" />
          </div>
          <p className="mt-3 text-xl font-bold text-gray-900 md:text-2xl">
            INR{" "}
            {totalSpentInr.toLocaleString("en-IN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="mt-1 text-xs font-medium text-gray-500 md:text-sm">Total Spent</p>
          <p className="mt-1 text-xs text-gray-400">
            {totalSpentInr > 0 ? "Captured payments only" : "No purchases yet"}
          </p>
        </article>
      </div>

      <div className="mt-6 flex flex-col gap-6">
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-900">Your Emission Summary</h2>
            {isCompanyVerified ? (
              <Link
                href="/projects"
                className="inline-flex rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 transition-colors hover:bg-green-100"
              >
                Offset Emission
              </Link>
            ) : null}
          </div>

          {isCompanyVerified ? (
            <BuyerEmissionsSummaryPanel
              companyName={companyName}
              initialItems={emissionHistoryItems}
              initialPage={1}
              pageSize={EMISSIONS_HISTORY_PAGE_SIZE}
              initialHasMore={emissionHistoryHasMore}
              initialTotalRuns={emissionHistoryTotalRuns}
            />
          ) : (
            <div className="mt-6 flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 text-center">
              <Lock className="h-10 w-10 text-gray-300" />
              <p className="mt-4 text-base font-semibold text-gray-700">Register Your Company First</p>
              {companyStatus === "pending" ? (
                <>
                  <p className="mt-2 max-w-md text-sm text-gray-500">
                    Your company registration is under review. Emissions tracking will unlock once approved.
                  </p>
                  <span className="mt-4 inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                    Under Review
                  </span>
                </>
              ) : (
                <>
                  <p className="mt-2 max-w-md text-sm text-gray-500">
                    {isIdentityVerified
                      ? "Register and verify your company to unlock emissions tracking and carbon credit purchasing."
                      : "Complete identity verification, then register your company to unlock emissions tracking and carbon credit purchasing."}
                  </p>
                  <Link
                    href="/verify-company"
                    className="mt-4 inline-flex rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-green-700"
                  >
                    Register Your Company
                  </Link>
                </>
              )}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-900">Recent Orders</h2>
            {isCompanyVerified ? (
              <Link
                href="/dashboard/buyer/orders"
                className="inline-flex rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                View All
              </Link>
            ) : null}
          </div>

          {!isCompanyVerified ? (
            <div className="mt-6 flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 text-center">
              <Lock className="h-10 w-10 text-gray-300" />
              <p className="mt-4 text-sm font-medium text-gray-700">
                Available after company verification
              </p>
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="mt-6 flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 text-center">
              <p className="text-sm font-medium text-gray-700">No captured orders yet.</p>
              <p className="mt-1 text-sm text-gray-500">
                Purchase credits to see order confirmations here.
              </p>
              <Link
                href="/projects"
                className="mt-4 inline-flex rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-green-700"
              >
                Offset Emission
              </Link>
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[660px] border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3">Reference</th>
                    <th className="py-2 pr-3">Project</th>
                    <th className="py-2 pr-3">Quantity</th>
                    <th className="py-2 pr-3">Total</th>
                    <th className="py-2 pr-3">Created</th>
                    <th className="py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="border-b border-gray-100 text-sm text-gray-700">
                      <td className="py-3 pr-3 font-semibold text-gray-900">
                        {order.purchaseRef}
                      </td>
                      <td className="py-3 pr-3">
                        <p className="font-medium text-gray-900">{order.projectName}</p>
                        <p className="text-xs text-gray-500">{order.referenceId}</p>
                      </td>
                      <td className="py-3 pr-3">{order.quantity.toLocaleString("en-IN")}</td>
                      <td className="py-3 pr-3 font-semibold text-gray-900">
                        INR{" "}
                        {order.totalAmountInr.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-3 pr-3 text-xs text-gray-500">
                        {new Intl.DateTimeFormat("en-IN", {
                          year: "numeric",
                          month: "short",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(order.createdAt))}
                      </td>
                      <td className="py-3">
                        <Link
                          href={`/dashboard/buyer/orders/${order.purchaseRef}`}
                          className="text-xs font-semibold text-green-700 underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">AI Portfolio Recommendation</h2>
          {isCompanyVerified ? (
            <div className="mt-6 flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 text-center">
              <TrendingUp className="h-12 w-12 text-gray-300" />
              <p className="mt-4 text-sm font-medium text-gray-700">AI recommendations will appear here.</p>
              <p className="mt-1 text-sm text-gray-500">Run emissions calculations to generate your portfolio strategy.</p>
            </div>
          ) : (
            <div className="mt-6 flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 text-center">
              <Lock className="h-10 w-10 text-gray-300" />
              <p className="mt-4 text-sm font-medium text-gray-700">Available after company verification</p>
              <p className="mt-1 text-sm text-gray-500">
                Once your company is approved, AI portfolio recommendations will become available.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
