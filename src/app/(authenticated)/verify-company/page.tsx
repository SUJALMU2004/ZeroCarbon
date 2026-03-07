import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, CheckCircle2, ChevronLeft, Clock } from "lucide-react";
import { CompanyVerifyForm } from "@/app/(authenticated)/verify-company/CompanyVerifyForm";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { IdentityStatus } from "@/types/dashboard";

type ProfileRow = {
  phone_verified: boolean | null;
  verification_status: IdentityStatus | null;
};

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
  rejection_reason: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
};

function formatDate(value: string | null): string {
  if (!value) return "Not available";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not available";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function industryDisplay(company: CompanyRow | null): string {
  if (!company?.industry_type) return "Not provided";
  if (company.industry_type === "Other" && company.custom_industry_text) {
    return `Other: ${company.custom_industry_text}`;
  }
  return company.industry_type;
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-sm text-gray-800">{value}</p>
    </div>
  );
}

export default async function VerifyCompanyPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("phone_verified, verification_status")
    .eq("id", user.id)
    .maybeSingle();

  const profile = (profileData ?? null) as ProfileRow | null;
  const isIdentityVerified =
    profile?.phone_verified === true && profile?.verification_status === "verified";

  const { data: companyData, error: companyError } = await supabase
    .from("companies")
    .select(
      "status, legal_company_name, registration_number, country, industry_type, custom_industry_text, company_size, official_website, business_email, rejection_reason, submitted_at, reviewed_at",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (companyError) {
    console.error("verify_company_page_company_query_failed", {
      userId: user.id,
      reason: companyError.message,
    });
  }

  const company = (companyData ?? null) as CompanyRow | null;
  const companyStatus = company?.status ?? "not_submitted";

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link
        href="/dashboard/buyer"
        className="inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-900"
      >
        <ChevronLeft className="h-4 w-4" />
        <span>Back to Dashboard</span>
      </Link>

      <header className="mt-6">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50">
          <Building2 className="h-6 w-6 text-green-600" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-gray-900">Register Your Company</h1>
        <p className="mt-2 text-sm text-gray-500">
          Complete your company profile to start purchasing carbon credits on ZeroCarbon.
        </p>
      </header>

      {companyStatus === "verified" ? (
        <section className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-6 md:p-8">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-14 w-14 text-green-600" />
            <div>
              <h2 className="text-xl font-semibold text-green-900">Company Verified</h2>
              <p className="mt-1 text-lg font-medium text-green-800">{company?.legal_company_name ?? "Verified Company"}</p>
              <span className="mt-2 inline-flex rounded-full border border-green-300 bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                Verified
              </span>
              <p className="mt-2 text-sm text-green-800">Approved on {formatDate(company?.reviewed_at ?? null)}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <ReadOnlyField label="Registration No" value={company?.registration_number ?? "Not provided"} />
            <ReadOnlyField label="Country" value={company?.country ?? "Not provided"} />
            <ReadOnlyField label="Industry" value={industryDisplay(company)} />
            <ReadOnlyField label="Company Size" value={company?.company_size ?? "Not provided"} />
            <ReadOnlyField label="Website" value={company?.official_website ?? "Not provided"} />
            <ReadOnlyField label="Email" value={company?.business_email ?? "Not provided"} />
          </div>

          <Link
            href="/dashboard/buyer"
            className="mt-5 inline-flex text-sm font-semibold text-green-800 hover:text-green-900"
          >
            Go to Dashboard -&gt;
          </Link>
        </section>
      ) : null}

      {companyStatus === "pending" ? (
        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 md:p-8">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-12 w-12 text-amber-500" />
            <div>
              <h2 className="text-xl font-semibold text-amber-900">Registration Under Review</h2>
              <span className="mt-1 inline-flex rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                Pending Review
              </span>
              <p className="mt-2 text-sm text-amber-800">
                Your company details have been submitted and are currently under review. We&apos;ll notify you at {user.email ?? "your registered email"} once a decision has been made.
              </p>
              <p className="mt-2 text-sm text-amber-800">Submitted at {formatDate(company?.submitted_at ?? null)}</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-amber-100 bg-white p-4">
            <p className="mb-3 text-sm font-semibold text-amber-900">Submitted Details:</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <ReadOnlyField label="Company" value={company?.legal_company_name ?? "Not provided"} />
              <ReadOnlyField label="Registration" value={company?.registration_number ?? "Not provided"} />
              <ReadOnlyField label="Country" value={company?.country ?? "Not provided"} />
              <ReadOnlyField label="Industry" value={industryDisplay(company)} />
              <ReadOnlyField label="Size" value={company?.company_size ?? "Not provided"} />
              <ReadOnlyField label="Website" value={company?.official_website ?? "Not provided"} />
              <ReadOnlyField label="Email" value={company?.business_email ?? "Not provided"} />
            </div>
          </div>

          <Link
            href="/dashboard/buyer"
            className="mt-5 inline-flex text-sm font-semibold text-amber-800 hover:text-amber-900"
          >
            &larr; Return to Dashboard
          </Link>
        </section>
      ) : null}

      {companyStatus !== "verified" && companyStatus !== "pending" ? (
        <div className="mt-6">
          <CompanyVerifyForm
            existingCompany={
              company
                ? {
                    status: company.status,
                    legal_company_name: company.legal_company_name,
                    registration_number: company.registration_number,
                    country: company.country,
                    industry_type: company.industry_type,
                    custom_industry_text: company.custom_industry_text,
                    company_size: company.company_size,
                    official_website: company.official_website,
                    business_email: company.business_email,
                    rejection_reason: company.rejection_reason,
                  }
                : null
            }
            userEmail={user.email ?? ""}
            isIdentityVerified={isIdentityVerified}
          />
        </div>
      ) : null}
    </div>
  );
}


