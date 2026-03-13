import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, Lock } from "lucide-react";
import EmissionsCalculatorWizard from "@/components/emissions/EmissionsCalculatorWizard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { IdentityStatus } from "@/types/dashboard";

type CompanyRow = {
  status: IdentityStatus | null;
  legal_company_name: string | null;
};

export default async function BuyerEmissionsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/dashboard/buyer/emissions");
  }

  let companyStatus: IdentityStatus = "not_submitted";
  let companyName: string | null = null;

  const { data: companyData, error: companyError } = await supabase
    .from("companies")
    .select("status, legal_company_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (companyError) {
    console.error("buyer_emissions_company_query_failed", {
      userId: user.id,
      reason: companyError.message,
    });
  } else {
    const typedCompany = (companyData ?? null) as CompanyRow | null;
    companyStatus = typedCompany?.status ?? "not_submitted";
    companyName = typedCompany?.legal_company_name ?? null;
  }

  const isCompanyVerified = companyStatus === "verified";

  return (
    <div className="text-gray-900">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Emissions Calculator</h1>
        <p className="mt-1 text-sm text-gray-500">
          Capture your corporate emissions baseline and run a zero-trust emissions calculation.
        </p>
      </div>

      {!isCompanyVerified ? (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
              <Lock className="h-6 w-6 text-gray-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-gray-900">
                Company Verification Required
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Verify your company to unlock emissions calculations and reporting.
              </p>
              {companyName ? (
                <p className="mt-2 text-sm text-gray-500">
                  Company: <span className="font-medium text-gray-700">{companyName}</span>
                </p>
              ) : null}
              <p className="mt-1 text-sm text-gray-500">
                Current status: <span className="font-medium capitalize text-gray-700">{companyStatus.replace(/_/g, " ")}</span>
              </p>
              <Link
                href="/verify-company"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
              >
                <Building2 className="h-4 w-4" />
                Register / Verify Company
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <EmissionsCalculatorWizard userId={user.id} />
      )}
    </div>
  );
}
