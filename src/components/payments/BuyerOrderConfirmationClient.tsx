"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PaymentOrderDetail, PurchaseOrderStatus } from "@/types/payments";

interface BuyerOrderConfirmationClientProps {
  initialOrder: PaymentOrderDetail;
}

type OrderDetailResponse = {
  item?: PaymentOrderDetail;
  error?: string;
};

function formatCurrencyInr(value: number): string {
  return `INR ${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function isFinalStatus(status: PurchaseOrderStatus): boolean {
  return (
    status === "captured" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "expired"
  );
}

function getStatusMeta(status: PurchaseOrderStatus): { label: string; className: string } {
  if (status === "captured") {
    return {
      label: "Captured",
      className: "bg-emerald-100 text-emerald-700",
    };
  }
  if (status === "failed") {
    return {
      label: "Failed",
      className: "bg-rose-100 text-rose-700",
    };
  }
  if (status === "expired") {
    return {
      label: "Expired",
      className: "bg-amber-100 text-amber-700",
    };
  }
  if (status === "cancelled") {
    return {
      label: "Cancelled",
      className: "bg-slate-100 text-slate-700",
    };
  }
  if (status === "authorized_pending_webhook") {
    return {
      label: "Pending Finalization",
      className: "bg-blue-100 text-blue-700",
    };
  }
  if (status === "checkout_opened") {
    return {
      label: "Checkout Opened",
      className: "bg-indigo-100 text-indigo-700",
    };
  }
  return {
    label: "Reserved",
    className: "bg-violet-100 text-violet-700",
  };
}

export default function BuyerOrderConfirmationClient({
  initialOrder,
}: BuyerOrderConfirmationClientProps) {
  const [order, setOrder] = useState<PaymentOrderDetail>(initialOrder);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const statusMeta = useMemo(() => getStatusMeta(order.status), [order.status]);
  const shouldPoll = !isFinalStatus(order.status);

  useEffect(() => {
    if (!shouldPoll) return;

    let cancelled = false;
    const interval = setInterval(async () => {
      if (cancelled) return;

      try {
        setIsRefreshing(true);
        const response = await fetch(`/api/payments/orders/${order.purchaseRef}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });
        const payload = (await response.json().catch(() => null)) as OrderDetailResponse | null;

        if (!response.ok) {
          setRefreshError(payload?.error ?? `Failed to refresh order (${response.status})`);
          return;
        }

        if (payload?.item) {
          setOrder(payload.item);
          setRefreshError(null);
        }
      } catch (error) {
        setRefreshError(
          error instanceof Error ? error.message : "Unexpected refresh error.",
        );
      } finally {
        setIsRefreshing(false);
      }
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [order.purchaseRef, shouldPoll]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 md:px-8">
      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Order Confirmation</h1>
            <p className="mt-1 text-sm text-gray-600">
              Unique Reference:{" "}
              <span className="font-semibold text-gray-900">{order.purchaseRef}</span>
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusMeta.className}`}
          >
            {statusMeta.label}
          </span>
        </header>

        {!isFinalStatus(order.status) ? (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            Final payment state is waiting for webhook confirmation.
            {isRefreshing ? " Refreshing..." : " Auto-refresh runs every 5 seconds."}
          </div>
        ) : null}

        {refreshError ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {refreshError}
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
              Project Snapshot
            </h2>
            <div className="mt-3 space-y-1.5 text-sm text-gray-700">
              <p>
                <span className="font-semibold text-gray-900">Project:</span>{" "}
                {order.projectNameSnapshot}
              </p>
              <p>
                <span className="font-semibold text-gray-900">Reference ID:</span>{" "}
                {order.referenceIdSnapshot}
              </p>
              <p>
                <span className="font-semibold text-gray-900">Quantity:</span>{" "}
                {order.quantity.toLocaleString("en-IN")}
              </p>
              <p>
                <span className="font-semibold text-gray-900">Buyer Company:</span>{" "}
                {order.buyerCompanyNameSnapshot}
              </p>
            </div>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
              Payment Breakdown
            </h2>
            <div className="mt-3 space-y-1.5 text-sm text-gray-700">
              <p className="flex items-center justify-between gap-3">
                <span>Unit Price</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrencyInr(order.unitPriceInr)}
                </span>
              </p>
              <p className="flex items-center justify-between gap-3">
                <span>Subtotal</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrencyInr(order.subtotalInr)}
                </span>
              </p>
              <p className="flex items-center justify-between gap-3">
                <span>GST ({order.gstRatePercent}%)</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrencyInr(order.gstAmountInr)}
                </span>
              </p>
              <p className="mt-2 flex items-center justify-between gap-3 border-t border-gray-200 pt-2">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="text-base font-bold text-gray-900">
                  {formatCurrencyInr(order.totalAmountInr)}
                </span>
              </p>
            </div>
          </article>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700 md:grid-cols-2">
          <p>
            <span className="font-semibold text-gray-900">Created:</span>{" "}
            {formatDateTime(order.createdAt)}
          </p>
          <p>
            <span className="font-semibold text-gray-900">Reservation Expires:</span>{" "}
            {formatDateTime(order.reservationExpiresAt)}
          </p>
          <p>
            <span className="font-semibold text-gray-900">Captured:</span>{" "}
            {formatDateTime(order.capturedAt)}
          </p>
          <p>
            <span className="font-semibold text-gray-900">Failed:</span>{" "}
            {formatDateTime(order.failedAt)}
          </p>
          <p>
            <span className="font-semibold text-gray-900">Razorpay Order ID:</span>{" "}
            {order.razorpayOrderId ?? "-"}
          </p>
          <p>
            <span className="font-semibold text-gray-900">Razorpay Payment ID:</span>{" "}
            {order.razorpayPaymentId ?? "-"}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/dashboard/buyer/orders"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            View All Orders
          </Link>
          <Link
            href="/projects"
            className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
          >
            Browse Projects
          </Link>
        </div>
      </section>
    </main>
  );
}

