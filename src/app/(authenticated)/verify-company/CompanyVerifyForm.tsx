"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { COUNTRIES } from "@/lib/data/countries";
import {
  BLOCKED_EMAIL_MESSAGE,
  isBlockedEmailDomain,
} from "@/lib/validation/blocked-email-domains";

type ExistingCompany = {
  status: string;
  legal_company_name: string | null;
  registration_number: string | null;
  country: string | null;
  industry_type: string | null;
  custom_industry_text: string | null;
  company_size: string | null;
  official_website: string | null;
  business_email: string | null;
  rejection_reason: string | null;
};

type CompanyVerifyFormProps = {
  existingCompany: ExistingCompany | null;
  userEmail: string;
  isIdentityVerified: boolean;
};

type CompanyFormData = {
  legal_company_name: string;
  registration_number: string;
  country: string;
  industry_type: string;
  custom_industry_text: string;
  company_size: string;
  official_website: string;
  business_email: string;
};

const INDUSTRY_TYPES = [
  "Manufacturing",
  "Technology",
  "Logistics",
  "Energy",
  "Retail",
  "Agriculture",
  "Finance",
  "Other",
] as const;

const COMPANY_SIZES = ["1–10", "10–50", "50–200", "200–1000", "1000+"] as const;

function validateCompanyForm(data: CompanyFormData): Record<string, string> {
  const errors: Record<string, string> = {};

  const legalCompanyName = data.legal_company_name.trim();
  if (!legalCompanyName || legalCompanyName.length < 2 || legalCompanyName.length > 200) {
    errors.legal_company_name = "Please enter your legal company name";
  }

  const registrationNumber = data.registration_number.trim();
  if (!registrationNumber || registrationNumber.length < 2 || registrationNumber.length > 100) {
    errors.registration_number = "Please enter your company registration number";
  }

  if (!data.country) {
    errors.country = "Please select your country";
  }

  if (!data.industry_type) {
    errors.industry_type = "Please select your industry";
  }

  if (data.industry_type === "Other") {
    const customIndustry = data.custom_industry_text.trim();
    if (!customIndustry || customIndustry.length < 2 || customIndustry.length > 100) {
      errors.custom_industry_text = "Please describe your industry";
    }
  }

  if (!data.company_size) {
    errors.company_size = "Please select your company size";
  }

  const officialWebsite = data.official_website.trim();
  if (!officialWebsite || officialWebsite.length > 500) {
    errors.official_website = "Please enter a valid website URL starting with https://";
  } else if (!officialWebsite.startsWith("https://") && !officialWebsite.startsWith("http://")) {
    errors.official_website = "Please enter a valid website URL starting with https://";
  }

  const businessEmail = data.business_email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!businessEmail || !emailRegex.test(businessEmail)) {
    errors.business_email = "Please enter a valid email address";
  } else if (isBlockedEmailDomain(businessEmail)) {
    errors.business_email = BLOCKED_EMAIL_MESSAGE;
  }

  return errors;
}

function industrySummaryValue(data: CompanyFormData): string {
  if (data.industry_type === "Other") {
    const custom = data.custom_industry_text.trim();
    return custom ? `Other: ${custom}` : "Other";
  }

  return data.industry_type;
}

export function CompanyVerifyForm({
  existingCompany,
  userEmail,
  isIdentityVerified,
}: CompanyVerifyFormProps) {
  const initialFormData = useMemo<CompanyFormData>(
    () => ({
      legal_company_name: existingCompany?.legal_company_name ?? "",
      registration_number: existingCompany?.registration_number ?? "",
      country: existingCompany?.country ?? "",
      industry_type: existingCompany?.industry_type ?? "",
      custom_industry_text: existingCompany?.custom_industry_text ?? "",
      company_size: existingCompany?.company_size ?? "",
      official_website: existingCompany?.official_website ?? "",
      business_email: existingCompany?.business_email ?? "",
    }),
    [existingCompany],
  );

  const [formData, setFormData] = useState<CompanyFormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<"idle" | "success" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const [serverIdentityBlocked, setServerIdentityBlocked] = useState(false);

  const showCustomIndustry = formData.industry_type === "Other";
  const showRejectedBanner =
    existingCompany?.status === "rejected" && Boolean(existingCompany.rejection_reason);

  const showIdentityGate = !isIdentityVerified || serverIdentityBlocked;

  const setFieldValue = (field: keyof CompanyFormData, value: string) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));

    setErrors((previous) => {
      if (!previous[field]) {
        return previous;
      }

      const next = { ...previous };
      delete next[field];
      return next;
    });

    if (field === "industry_type" && value !== "Other") {
      setFormData((previous) => ({
        ...previous,
        industry_type: value,
        custom_industry_text: "",
      }));
      setErrors((previous) => {
        if (!previous.custom_industry_text) return previous;
        const next = { ...previous };
        delete next.custom_industry_text;
        return next;
      });
    }
  };

  const validateBusinessEmailOnBlur = () => {
    const businessEmail = formData.business_email.trim().toLowerCase();
    if (!businessEmail) return;

    if (isBlockedEmailDomain(businessEmail)) {
      setErrors((previous) => ({
        ...previous,
        business_email: BLOCKED_EMAIL_MESSAGE,
      }));
    }
  };

  const scrollToFirstError = (validationErrors: Record<string, string>) => {
    const [firstErrorField] = Object.keys(validationErrors);
    if (!firstErrorField) return;

    const element = document.getElementById(`company-${firstErrorField}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) {
        element.focus();
      }
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setServerIdentityBlocked(false);
    setSubmitResult("idle");
    setSubmitMessage("");

    const validationErrors = validateCompanyForm(formData);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      scrollToFirstError(validationErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/verify-company", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          legal_company_name: formData.legal_company_name.trim(),
          registration_number: formData.registration_number.trim(),
          country: formData.country,
          industry_type: formData.industry_type,
          custom_industry_text:
            formData.industry_type === "Other" ? formData.custom_industry_text.trim() : null,
          company_size: formData.company_size,
          official_website: formData.official_website.trim(),
          business_email: formData.business_email.trim().toLowerCase(),
        }),
      });

      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        field?: string;
        code?: string;
        message?: string;
        success?: boolean;
      };

      if (!response.ok) {
        if (response.status === 400 && body.field) {
          setErrors({ [body.field]: body.error ?? "Please review this field." });
          scrollToFirstError({ [body.field]: body.error ?? "Please review this field." });
        }

        if (response.status === 401) {
          setSubmitResult("error");
          setSubmitMessage("Please log in again.");
          return;
        }

        if (response.status === 403 && body.code === "IDENTITY_NOT_VERIFIED") {
          setServerIdentityBlocked(true);
          setSubmitResult("error");
          setSubmitMessage(body.message ?? body.error ?? "Identity verification required.");
          return;
        }

        if (response.status === 409 && body.code === "ALREADY_VERIFIED") {
          setSubmitResult("error");
          setSubmitMessage("Your company is already verified.");
          return;
        }

        if (response.status === 409 && body.code === "ALREADY_PENDING") {
          setSubmitResult("error");
          setSubmitMessage("Your company registration is already under review.");
          return;
        }

        if (response.status === 429) {
          setSubmitResult("error");
          setSubmitMessage("Please wait before resubmitting.");
          return;
        }

        setSubmitResult("error");
        setSubmitMessage(body.error ?? "Unable to submit registration. Please try again.");
        return;
      }

      setSubmitResult("success");
      setSubmitMessage("Company registration submitted successfully.");
    } catch {
      setSubmitResult("error");
      setSubmitMessage("Unable to submit registration. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showIdentityGate) {
    return (
      <section className="mx-auto max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm md:p-8">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-6 w-6 text-amber-600" />
          <div>
            <h2 className="text-lg font-semibold text-amber-900">Identity Verification Required</h2>
            <p className="mt-2 text-sm text-amber-800">
              You must complete phone and identity verification before you can register your company.
            </p>
            {submitMessage ? <p className="mt-2 text-sm text-amber-800">{submitMessage}</p> : null}
            <Link
              href="/profile"
              className="mt-4 inline-flex items-center rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
            >
              Complete Verification -&gt;
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (submitResult === "success") {
    return (
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="mx-auto max-w-2xl rounded-2xl border border-green-200 bg-green-50 p-6 shadow-sm md:p-8"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-12 w-12 text-green-600" />
          <div>
            <h2 className="text-xl font-semibold text-green-900">Registration Submitted!</h2>
            <p className="mt-2 text-sm text-green-800">{submitMessage}</p>
            <p className="mt-2 text-sm text-green-800">
              We&apos;ll notify you at {userEmail || "your registered email"} once your registration has been reviewed.
              This typically takes 24-48 hours.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-white p-4">
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-800">Company:</span> {formData.legal_company_name.trim()}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            <span className="font-semibold text-gray-800">Registration:</span> {formData.registration_number.trim()}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            <span className="font-semibold text-gray-800">Country:</span> {formData.country}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            <span className="font-semibold text-gray-800">Industry:</span> {industrySummaryValue(formData)}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            <span className="font-semibold text-gray-800">Size:</span> {formData.company_size}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            <span className="font-semibold text-gray-800">Website:</span> {formData.official_website.trim()}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            <span className="font-semibold text-gray-800">Email:</span> {formData.business_email.trim().toLowerCase()}
          </p>
        </div>

        <Link
          href="/dashboard/buyer"
          className="mt-4 inline-flex text-sm font-semibold text-green-800 hover:text-green-900"
        >
          &larr; Return to Dashboard
        </Link>
      </motion.section>
    );
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      onSubmit={handleSubmit}
      className="mx-auto max-w-2xl rounded-2xl border border-gray-100 bg-white p-6 shadow-sm md:p-8"
    >
      {showRejectedBanner ? (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4"
        >
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 text-red-500" />
            <div>
              <p className="text-sm font-semibold text-red-900">Registration Rejected</p>
              <p className="mt-1 text-sm text-red-800">{existingCompany?.rejection_reason}</p>
              <p className="mt-2 text-xs text-red-700">Please address the reason above and resubmit.</p>
            </div>
          </div>
        </motion.div>
      ) : null}

      <section>
        <h3 className="mb-4 border-b border-gray-100 pb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Company Identity
        </h3>

        <div className="space-y-4">
          <div>
            <label htmlFor="company-legal_company_name" className="mb-1.5 block text-sm font-medium text-gray-700">
              Legal Company Name
            </label>
            <input
              id="company-legal_company_name"
              type="text"
              value={formData.legal_company_name}
              onChange={(event) => setFieldValue("legal_company_name", event.target.value)}
              placeholder="e.g. Tata Consultancy Services Ltd."
              maxLength={200}
              className={`w-full rounded-xl border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-all duration-150 focus:border-transparent focus:outline-none focus:ring-2 ${
                errors.legal_company_name ? "border-red-300 focus:ring-red-500" : "border-gray-200 focus:ring-green-500"
              }`}
            />
            {errors.legal_company_name ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                <AlertCircle className="h-3 w-3" />
                {errors.legal_company_name}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="company-registration_number" className="mb-1.5 block text-sm font-medium text-gray-700">
              Registration Number
            </label>
            <input
              id="company-registration_number"
              type="text"
              value={formData.registration_number}
              onChange={(event) => setFieldValue("registration_number", event.target.value)}
              placeholder="e.g. U12345MH2020PTC123456"
              maxLength={100}
              className={`w-full rounded-xl border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-all duration-150 focus:border-transparent focus:outline-none focus:ring-2 ${
                errors.registration_number ? "border-red-300 focus:ring-red-500" : "border-gray-200 focus:ring-green-500"
              }`}
            />
            {errors.registration_number ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                <AlertCircle className="h-3 w-3" />
                {errors.registration_number}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-gray-400">Company registration or incorporation number</p>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <h3 className="mb-4 border-b border-gray-100 pb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Location &amp; Classification
        </h3>

        <div className="space-y-4">
          <div>
            <label htmlFor="company-country" className="mb-1.5 block text-sm font-medium text-gray-700">
              Country
            </label>
            <select
              id="company-country"
              value={formData.country}
              onChange={(event) => setFieldValue("country", event.target.value)}
              className={`w-full rounded-xl border px-4 py-2.5 text-sm text-gray-900 transition-all duration-150 focus:border-transparent focus:outline-none focus:ring-2 ${
                errors.country ? "border-red-300 focus:ring-red-500" : "border-gray-200 focus:ring-green-500"
              }`}
            >
              <option value="">Select your country</option>
              {COUNTRIES.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
            {errors.country ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                <AlertCircle className="h-3 w-3" />
                {errors.country}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="company-industry_type" className="mb-1.5 block text-sm font-medium text-gray-700">
              Industry
            </label>
            <select
              id="company-industry_type"
              value={formData.industry_type}
              onChange={(event) => setFieldValue("industry_type", event.target.value)}
              className={`w-full rounded-xl border px-4 py-2.5 text-sm text-gray-900 transition-all duration-150 focus:border-transparent focus:outline-none focus:ring-2 ${
                errors.industry_type ? "border-red-300 focus:ring-red-500" : "border-gray-200 focus:ring-green-500"
              }`}
            >
              <option value="">Select your industry</option>
              {INDUSTRY_TYPES.map((industry) => (
                <option key={industry} value={industry}>
                  {industry}
                </option>
              ))}
            </select>
            {errors.industry_type ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                <AlertCircle className="h-3 w-3" />
                {errors.industry_type}
              </p>
            ) : null}
          </div>

          <AnimatePresence>
            {showCustomIndustry ? (
              <motion.div
                key="custom-industry"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <label htmlFor="company-custom_industry_text" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Describe Industry
                </label>
                <input
                  id="company-custom_industry_text"
                  type="text"
                  value={formData.custom_industry_text}
                  onChange={(event) => setFieldValue("custom_industry_text", event.target.value)}
                  placeholder="Please describe your industry"
                  maxLength={100}
                  className={`w-full rounded-xl border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-all duration-150 focus:border-transparent focus:outline-none focus:ring-2 ${
                    errors.custom_industry_text
                      ? "border-red-300 focus:ring-red-500"
                      : "border-gray-200 focus:ring-green-500"
                  }`}
                />
                <div className="mt-1 flex items-center justify-between">
                  {errors.custom_industry_text ? (
                    <p className="flex items-center gap-1 text-xs text-red-500">
                      <AlertCircle className="h-3 w-3" />
                      {errors.custom_industry_text}
                    </p>
                  ) : (
                    <span className="text-xs text-gray-400">&nbsp;</span>
                  )}
                  <span className="text-xs text-gray-400">{formData.custom_industry_text.length}/100</span>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div>
            <label htmlFor="company-company_size" className="mb-1.5 block text-sm font-medium text-gray-700">
              Company Size
            </label>
            <select
              id="company-company_size"
              value={formData.company_size}
              onChange={(event) => setFieldValue("company_size", event.target.value)}
              className={`w-full rounded-xl border px-4 py-2.5 text-sm text-gray-900 transition-all duration-150 focus:border-transparent focus:outline-none focus:ring-2 ${
                errors.company_size ? "border-red-300 focus:ring-red-500" : "border-gray-200 focus:ring-green-500"
              }`}
            >
              <option value="">Select company size</option>
              {COMPANY_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            {errors.company_size ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                <AlertCircle className="h-3 w-3" />
                {errors.company_size}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-6">
        <h3 className="mb-4 border-b border-gray-100 pb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Contact &amp; Online Presence
        </h3>

        <div className="space-y-4">
          <div>
            <label htmlFor="company-official_website" className="mb-1.5 block text-sm font-medium text-gray-700">
              Official Website
            </label>
            <input
              id="company-official_website"
              type="url"
              value={formData.official_website}
              onChange={(event) => setFieldValue("official_website", event.target.value)}
              placeholder="https://yourcompany.com"
              maxLength={500}
              className={`w-full rounded-xl border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-all duration-150 focus:border-transparent focus:outline-none focus:ring-2 ${
                errors.official_website ? "border-red-300 focus:ring-red-500" : "border-gray-200 focus:ring-green-500"
              }`}
            />
            {errors.official_website ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                <AlertCircle className="h-3 w-3" />
                {errors.official_website}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-gray-400">Must be your company&apos;s official domain</p>
          </div>

          <div>
            <label htmlFor="company-business_email" className="mb-1.5 block text-sm font-medium text-gray-700">
              Business Email
            </label>
            <input
              id="company-business_email"
              type="email"
              value={formData.business_email}
              onChange={(event) => {
                setFieldValue("business_email", event.target.value);
                if (errors.business_email) {
                  setErrors((previous) => {
                    const next = { ...previous };
                    delete next.business_email;
                    return next;
                  });
                }
              }}
              onBlur={validateBusinessEmailOnBlur}
              placeholder="contact@yourcompany.com"
              maxLength={254}
              className={`w-full rounded-xl border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-all duration-150 focus:border-transparent focus:outline-none focus:ring-2 ${
                errors.business_email ? "border-red-300 focus:ring-red-500" : "border-gray-200 focus:ring-green-500"
              }`}
            />
            {errors.business_email ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                <AlertCircle className="h-3 w-3" />
                {errors.business_email}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-gray-400">Personal email addresses are not accepted</p>
          </div>
        </div>
      </section>

      {submitResult === "error" && submitMessage ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {submitMessage}
        </p>
      ) : null}

      <motion.button
        whileTap={{ scale: 0.98 }}
        type="submit"
        disabled={isSubmitting}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-80"
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        <span>{isSubmitting ? "Submitting..." : "Submit Registration"}</span>
      </motion.button>
    </motion.form>
  );
}

