import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { VerificationBanner } from "@/components/dashboard/verification-banner";
import { getVerificationBannerModel, normalizeVerificationState } from "@/lib/dashboard/verification-banner";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { IdentityStatus } from "@/types/dashboard";

type ProfileRow = {
  role: string | null;
  created_at: string | null;
  phone_verified: boolean | null;
  verification_status: IdentityStatus | null;
};

type CompanyRow = {
  status: IdentityStatus | null;
  legal_company_name: string | null;
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, created_at, phone_verified, verification_status")
    .eq("id", user.id)
    .maybeSingle();

  const typedProfile = (profile ?? null) as ProfileRow | null;

  const verificationState = normalizeVerificationState({
    phone_verified: typedProfile?.phone_verified ?? false,
    identity_status: typedProfile?.verification_status ?? "not_submitted",
  });

  const isVerified =
    verificationState.phone_verified === true &&
    verificationState.identity_status === "verified";

  const bannerModel = getVerificationBannerModel({
    isVerified,
    verificationState,
  });

  let companyStatus: IdentityStatus = "not_submitted";
  let companyName: string | null = null;

  try {
    const { data: companyData, error: companyError } = await supabase
      .from("companies")
      .select("status, legal_company_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (companyError) {
      console.error("dashboard_layout_company_query_failed", {
        userId: user.id,
        reason: companyError.message,
      });
    } else {
      const typedCompany = (companyData ?? null) as CompanyRow | null;
      companyStatus = typedCompany?.status ?? "not_submitted";
      companyName = typedCompany?.legal_company_name ?? null;
    }
  } catch (companyQueryError) {
    console.error("dashboard_layout_company_query_unhandled", {
      userId: user.id,
      reason:
        companyQueryError instanceof Error
          ? companyQueryError.message
          : "unknown_error",
    });
  }

  return (
    <div className="min-h-screen flex flex-col bg-transparent md:p-4">
      <div className="flex flex-1 bg-white min-h-0 md:rounded-2xl md:overflow-hidden md:shadow-lg md:ring-1 md:ring-black/5">
        <DashboardSidebar
          phoneVerified={verificationState.phone_verified}
          verificationStatus={verificationState.identity_status}
          userEmail={user.email ?? ""}
          companyStatus={companyStatus}
          companyName={companyName}
        />

        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {bannerModel ? (
            <div className="px-4 pt-4 sm:px-6 md:px-8">
              <VerificationBanner model={bannerModel} />
            </div>
          ) : null}

          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
