import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, ChevronLeft } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { IdentityStatus } from "@/types/dashboard";

type CompanyRow = {
  status: IdentityStatus;
  legal_company_name: string | null;
  registration_number: string | null;
  country: string | null;
  industry_type: string | null;
  custom_industry_text: string | null;
  company_size: string | null;
  official_website: string | null;
  business_email: string | null;
  reviewed_at: string | null;
  created_at: string | null;
};

function formatDate(value: string | null): string {
  if (!value) return "Not available";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not available";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(parsed);
}

function industryValue(company: CompanyRow): string {
  if (company.industry_type === "Other" && company.custom_industry_text) {
    return `Other: ${company.custom_industry_text}`;
  }

  return company.industry_type ?? "Not provided";
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
      <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-2 text-sm font-medium text-gray-900">{value}</p>
    </div>
  );
}

export default async function BuyerCompanyProfilePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: companyData, error: companyError } = await supabase
    .from("companies")
    .select(
      "status, legal_company_name, registration_number, country, industry_type, custom_industry_text, company_size, official_website, business_email, reviewed_at, created_at",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (companyError) {
    console.error("buyer_company_profile_query_failed", {
      userId: user.id,
      reason: companyError.message,
    });
    redirect("/verify-company");
  }

  const company = (companyData ?? null) as CompanyRow | null;
  if (!company || company.status !== "verified") {
    redirect("/verify-company");
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <Link
        href="/dashboard/buyer"
        className="inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-900"
      >
        <ChevronLeft className="h-4 w-4" />
        <span>Back to Dashboard</span>
      </Link>

      <header className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white">
            <Building2 className="h-8 w-8 text-green-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-gray-900">{company.legal_company_name ?? "Company Profile"}</h1>
            <p className="mt-1 text-sm text-gray-600">Your verified company details</p>
            <span className="mt-3 inline-flex rounded-full border border-green-300 bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
              Verified Company ?
            </span>
          </div>
          <p className="text-sm text-gray-600">Verified {formatDate(company.reviewed_at)}</p>
        </div>
      </header>

      <section className="mt-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <DetailCard label="Legal Company Name" value={company.legal_company_name ?? "Not provided"} />
          <DetailCard label="Registration Number" value={company.registration_number ?? "Not provided"} />
          <DetailCard label="Country" value={company.country ?? "Not provided"} />
          <DetailCard label="Industry" value={industryValue(company)} />
          <DetailCard label="Company Size" value={company.company_size ?? "Not provided"} />
          <DetailCard label="Business Email" value={company.business_email ?? "Not provided"} />
          <div className="rounded-2xl border border-gray-100 bg-white p-5 md:col-span-2">
            <p className="text-xs uppercase tracking-wide text-gray-400">Official Website</p>
            {company.official_website ? (
              <a
                href={company.official_website}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex text-sm font-medium text-green-700 hover:text-green-800"
              >
                {company.official_website}
              </a>
            ) : (
              <p className="mt-2 text-sm font-medium text-gray-900">Not provided</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

