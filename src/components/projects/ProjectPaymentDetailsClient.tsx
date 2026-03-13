"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  gstRatePercent: number;
  buyerCompanyName: string | null;
  buyerCompanyStatus: string | null;
}

type CreateOrderResponse = {
  reused: boolean;
  message: string | null;
  purchaseRef: string;
  order: {
    status: string;
    quantity: number;
    unitPriceInr: number;
    subtotalInr: number;
    gstRatePercent: number;
    gstAmountInr: number;
    totalAmountInr: number;
    currency: string;
    reservationExpiresAt: string | null;
    projectName: string;
    referenceId: string;
  };
  checkout: {
    keyId: string;
    razorpayOrderId: string;
    amountPaise: number;
    currency: string;
    name: string;
    description: string;
    notes: Record<string, string>;
  } | null;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
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
  gstRatePercent,
  buyerCompanyName,
  buyerCompanyStatus,
}: ProjectPaymentDetailsClientProps) {
  const router = useRouter();
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
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [isRazorpayScriptReady, setIsRazorpayScriptReady] = useState(false);

  const hasPrice =
    unitPricePerCreditInr !== null &&
    Number.isFinite(unitPricePerCreditInr) &&
    unitPricePerCreditInr > 0;
  const hasAvailableCredits =
    creditsAvailable !== null &&
    Number.isFinite(creditsAvailable) &&
    creditsAvailable > 0;

  const subtotalPrice = useMemo(() => {
    if (!hasPrice) return null;
    return unitPricePerCreditInr * quantity;
  }, [hasPrice, quantity, unitPricePerCreditInr]);

  const gstAmount = useMemo(() => {
    if (subtotalPrice === null) return null;
    if (!Number.isFinite(gstRatePercent) || gstRatePercent < 0) return null;
    return (subtotalPrice * gstRatePercent) / 100;
  }, [gstRatePercent, subtotalPrice]);

  const totalPrice = useMemo(() => {
    if (subtotalPrice === null) return null;
    if (gstAmount === null) return null;
    return subtotalPrice + gstAmount;
  }, [gstAmount, subtotalPrice]);

  const hasMissingPricingInputs = !hasPrice || !hasAvailableCredits;
  const isPurchaseBlocked = !isVerifiedCompany || !hasCertificateCompanyName || hasMissingPricingInputs;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.Razorpay) {
      setIsRazorpayScriptReady(true);
      return;
    }

    const existing = document.querySelector(
      'script[data-zerocarbon-razorpay="checkout"]',
    ) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === "true") {
        setIsRazorpayScriptReady(true);
      } else {
        existing.addEventListener("load", () => setIsRazorpayScriptReady(true), {
          once: true,
        });
      }
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.zerocarbonRazorpay = "checkout";
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      setIsRazorpayScriptReady(true);
    });
    script.addEventListener("error", () => {
      setIsRazorpayScriptReady(false);
      toast.error("Failed to load Razorpay checkout script.");
    });
    document.body.appendChild(script);
  }, []);

  const handleAddQuantity = () => {
    setQuantity((previous) => Math.min(previous + 1, maxQuantity));
  };

  const handleSubtractQuantity = () => {
    setQuantity((previous) => Math.max(previous - 1, 1));
  };

  const handleProceed = async () => {
    if (isPurchaseBlocked || isCheckoutLoading) return;
    if (!isRazorpayScriptReady || !window.Razorpay) {
      toast.error("Payment script is still loading. Please retry.");
      return;
    }

    setIsCheckoutLoading(true);
    try {
      const response = await fetch("/api/payments/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          quantity,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | CreateOrderResponse
        | { error?: string; purchaseRef?: string }
        | null;

      if (!response.ok) {
        if (response.status === 409 && payload && typeof payload.purchaseRef === "string") {
          const warningMessage =
            "error" in payload && typeof payload.error === "string"
              ? payload.error
              : "Payment is pending verification.";
          toast.warning(warningMessage);
          router.push(`/dashboard/buyer/orders/${payload.purchaseRef}`);
          return;
        }
        const errorMessage =
          payload &&
          typeof payload === "object" &&
          "error" in payload &&
          typeof payload.error === "string"
            ? payload.error
            : `Failed to initialize payment (${response.status})`;
        throw new Error(errorMessage);
      }

      if (!payload || !("checkout" in payload) || !payload.checkout) {
        throw new Error("Checkout payload is unavailable.");
      }

      if (payload.message) {
        toast.info(payload.message);
      }

      const purchaseRef = payload.purchaseRef;
      const checkout = payload.checkout;

      const options: Record<string, unknown> = {
        key: checkout.keyId,
        amount: checkout.amountPaise,
        currency: checkout.currency,
        order_id: checkout.razorpayOrderId,
        name: checkout.name,
        description: checkout.description,
        notes: checkout.notes,
        theme: {
          color: "#16a34a",
        },
        modal: {
          ondismiss: () => {
            toast.warning("Checkout closed. You can retry using the same active order.");
          },
        },
        handler: async (checkoutResult: {
          razorpay_payment_id?: string;
          razorpay_order_id?: string;
          razorpay_signature?: string;
        }) => {
          try {
            const verifyResponse = await fetch("/api/payments/checkout/verify", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                purchaseRef,
                razorpayOrderId: checkoutResult.razorpay_order_id,
                razorpayPaymentId: checkoutResult.razorpay_payment_id,
                razorpaySignature: checkoutResult.razorpay_signature,
              }),
            });

            const verifyPayload = (await verifyResponse.json().catch(() => null)) as
              | { redirectUrl?: string; error?: string }
              | null;

            if (!verifyResponse.ok) {
              const errorMessage =
                verifyPayload &&
                typeof verifyPayload === "object" &&
                "error" in verifyPayload &&
                typeof verifyPayload.error === "string"
                  ? verifyPayload.error
                  : `Checkout verification failed (${verifyResponse.status}).`;
              throw new Error(errorMessage);
            }

            const redirectUrl =
              verifyPayload?.redirectUrl || `/dashboard/buyer/orders/${purchaseRef}`;
            toast.success("Payment authorized. Waiting for final confirmation.");
            router.push(redirectUrl);
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "Checkout verification failed.",
            );
            router.push(`/dashboard/buyer/orders/${purchaseRef}`);
          }
        },
      };

      const checkoutInstance = new window.Razorpay(options);
      checkoutInstance.open();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unexpected payment initialization error.",
      );
    } finally {
      setIsCheckoutLoading(false);
    }
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
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-semibold text-slate-900">
                  {subtotalPrice === null ? "Pending" : formatCurrency(subtotalPrice)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-600">GST ({gstRatePercent}%)</span>
                <span className="font-semibold text-slate-900">
                  {gstAmount === null ? "Pending" : formatCurrency(gstAmount)}
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
              disabled={isPurchaseBlocked || isCheckoutLoading}
              className="mt-5 w-full rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCheckoutLoading ? "Opening Checkout..." : "Proceed"}
            </button>
          </article>
        </div>
      </section>
    </main>
  );
}
