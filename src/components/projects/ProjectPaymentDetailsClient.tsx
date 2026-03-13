"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Building2, Lock, ReceiptText } from "lucide-react";
import ProjectQuantitySelector from "@/components/projects/ProjectQuantitySelector";

interface ProjectPaymentDetailsClientProps {
  projectId: string;
  projectTitle: string;
  projectReferenceId: string;
  projectTypeLabel: string;
  unitPricePerCreditInr: number | null;
  creditsAvailable: number | null;
  initialQuantity: number;
  buyerCompanyName: string | null;
  buyerCompanyStatus: string | null;
}

function formatCurrency(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "Pending";
  }
  return `INR ${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatCredits(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "Pending";
  }
  return value.toLocaleString("en-IN");
}

export default function ProjectPaymentDetailsClient({
  projectId,
  projectTitle,
  projectReferenceId,
  projectTypeLabel,
  unitPricePerCreditInr,
  creditsAvailable,
  initialQuantity,
  buyerCompanyName,
  buyerCompanyStatus,
}: ProjectPaymentDetailsClientProps) {
  const isVerifiedCompany = buyerCompanyStatus === "verified";
  const hasCertificateCompanyName =
    typeof buyerCompanyName === "string" && buyerCompanyName.trim().length > 0;

  const maxQuantity = useMemo(() => {
    if (
      creditsAvailable === null ||
      !Number.isFinite(creditsAvailable) ||
      creditsAvailable <= 0
    ) {
      return 1;
    }
    return Math.max(1, Math.min(Math.floor(creditsAvailable), 1_000_000));
  }, [creditsAvailable]);

  const [quantity, setQuantity] = useState(() =>
    Math.min(Math.max(1, Math.floor(initialQuantity)), maxQuantity),
  );

  const hasPrice =
    unitPricePerCreditInr !== null &&
    Number.isFinite(unitPricePerCreditInr) &&
    unitPricePerCreditInr > 0;
  const hasAvailableCredits =
    creditsAvailable !== null &&
    Number.isFinite(creditsAvailable) &&
    creditsAvailable > 0;

  const totalPrice = useMemo(() => {
    if (!hasPrice) return null;
    return unitPricePerCreditInr * quantity;
  }, [hasPrice, quantity, unitPricePerCreditInr]);

  const hasMissingPricingInputs = !hasPrice || !hasAvailableCredits;
  const isPurchaseBlocked = !isVerifiedCompany || !hasCertificateCompanyName || hasMissingPricingInputs;

  const handleAddQuantity = () => {
    setQuantity((previous) => Math.min(previous + 1, maxQuantity));
  };

  const handleSubtractQuantity = () => {
    setQuantity((previous) => Math.max(previous - 1, 1));
  };

  const handleProceed = () => {
    if (isPurchaseBlocked) return;
    toast.info("Payment gateway integration is coming soon.");
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 md:px-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Payment Details
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Review your credit purchase details before payment gateway handoff.
            </p>
          </div>
          <Link
            href={`/projects/${projectId}`}
            className="inline-flex rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            Back to Project
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-slate-700">
              <ReceiptText className="h-4 w-4" />
              <h2 className="text-sm font-semibold uppercase tracking-[0.08em]">
                Project Order
              </h2>
            </div>

            <div className="mt-4 space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">Project:</span> {projectTitle}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Reference ID:</span>{" "}
                {projectReferenceId}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Type:</span> {projectTypeLabel}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Credits Available:</span>{" "}
                {formatCredits(creditsAvailable)}
              </p>
            </div>

            <div className="mt-4 space-y-3">
              <label className="text-sm font-semibold text-slate-900">
                Credits to Buy
              </label>
              <ProjectQuantitySelector
                quantity={quantity}
                maxQuantity={maxQuantity}
                onAdd={handleAddQuantity}
                onSubtract={handleSubtractQuantity}
              />
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-slate-700">
              <Building2 className="h-4 w-4" />
              <h2 className="text-sm font-semibold uppercase tracking-[0.08em]">
                Billing and Certificate
              </h2>
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-600">Single Credit Price</span>
                <span className="font-semibold text-slate-900">
                  {formatCurrency(unitPricePerCreditInr)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-600">Quantity</span>
                <span className="font-semibold text-slate-900">
                  {quantity.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2">
                <span className="font-semibold text-slate-700">Total</span>
                <span className="text-lg font-bold text-slate-900">
                  {totalPrice === null ? "Pending" : formatCurrency(totalPrice)}
                </span>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Certificate Company Name
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {hasCertificateCompanyName ? buyerCompanyName : "Unavailable"}
              </p>
            </div>

            {!isVerifiedCompany || !hasCertificateCompanyName ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <div className="flex items-start gap-2">
                  <Lock className="mt-0.5 h-4 w-4" />
                  <div>
                    <p className="font-semibold">Company verification required</p>
                    <p className="mt-1 text-xs text-amber-700">
                      A verified company profile with legal company name is required to continue.
                    </p>
                    <Link
                      href="/verify-company"
                      className="mt-2 inline-flex rounded-lg bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-200"
                    >
                      Verify Company
                    </Link>
                  </div>
                </div>
              </div>
            ) : null}

            {hasMissingPricingInputs ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                Price or available credits are pending for this project. Proceed is disabled.
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleProceed}
              disabled={isPurchaseBlocked}
              className="mt-5 w-full rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Proceed
            </button>
          </article>
        </div>
      </section>
    </main>
  );
}
