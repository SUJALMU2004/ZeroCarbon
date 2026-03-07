import Link from "next/link";
import { BarChart2, Lock, TrendingUp, Wallet, XCircle } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { IdentityStatus } from "@/types/dashboard";

type ProfileRow = {
  phone_verified: boolean | null;
  verification_status: IdentityStatus | null;
};

type CompanyRow = {
  status: IdentityStatus | null;
  legal_company_name: string | null;
  rejection_reason: string | null;
};

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
      .select("status, legal_company_name, rejection_reason")
      .eq("user_id", user.id)
      .maybeSingle();

    if (companyError) {
      console.error("buyer_dashboard_company_query_failed", {
        userId: user.id,
        reason: companyError.message,
      });
    } else {
      companyData = (fetchedCompany ?? null) as CompanyRow | null;
    }
  }

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
          <p className="mt-3 text-xl font-bold text-gray-900 md:text-2xl">- tCO2e</p>
          <p className="mt-1 text-xs font-medium text-gray-500 md:text-sm">Total Emissions</p>
          <p className="mt-1 text-xs text-gray-400">Not calculated yet</p>
        </article>

        <article className="relative rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:p-5">
          {renderLockedOverlay(!isCompanyVerified)}
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50">
            <TrendingUp className="h-5 w-5 text-green-500" />
          </div>
          <p className="mt-3 text-xl font-bold text-gray-900 md:text-2xl">0</p>
          <p className="mt-1 text-xs font-medium text-gray-500 md:text-sm">Credits Purchased</p>
          <p className="mt-1 text-xs text-gray-400">Marketplace not live yet</p>
        </article>

        <article className="relative rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:p-5">
          {renderLockedOverlay(!isCompanyVerified)}
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
            <TrendingUp className="h-5 w-5 text-amber-500" />
          </div>
          <p className="mt-3 text-xl font-bold text-gray-900 md:text-2xl">0%</p>
          <p className="mt-1 text-xs font-medium text-gray-500 md:text-sm">Offset Progress</p>
          <p className="mt-1 text-xs text-gray-400">No offsets tracked yet</p>
        </article>

        <article className="relative rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:p-5">
          {renderLockedOverlay(!isCompanyVerified)}
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50">
            <Wallet className="h-5 w-5 text-purple-500" />
          </div>
          <p className="mt-3 text-xl font-bold text-gray-900 md:text-2xl">$0.00</p>
          <p className="mt-1 text-xs font-medium text-gray-500 md:text-sm">Total Spent</p>
          <p className="mt-1 text-xs text-gray-400">No purchases yet</p>
        </article>
      </div>

      <div className="mt-6 flex flex-col gap-6">
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Your Emission Summary</h2>

          {isCompanyVerified ? (
            <div className="mt-6 flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 text-center">
              <BarChart2 className="h-12 w-12 text-gray-300" />
              <p className="mt-4 text-sm font-medium text-gray-700">
                {companyName ? `${companyName} emissions` : "Emissions"} tracking will appear here.
              </p>
              <p className="mt-1 text-sm text-gray-500">Connect your emissions data to start tracking progress.</p>
            </div>
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
