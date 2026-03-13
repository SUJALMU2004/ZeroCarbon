import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  normalizePaymentOrderSummary,
  type PaymentOrderSummary,
} from "@/types/payments";

type SearchParams = {
  page?: string | string[];
};

const PAGE_SIZE = 20;

function getSingleValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function normalizePage(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return parsed;
}

function formatCurrencyInr(value: number): string {
  return `INR ${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(value: string): string {
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

function statusClass(status: PaymentOrderSummary["status"]): string {
  if (status === "captured") return "bg-emerald-100 text-emerald-700";
  if (status === "failed") return "bg-rose-100 text-rose-700";
  if (status === "expired") return "bg-amber-100 text-amber-700";
  if (status === "cancelled") return "bg-slate-100 text-slate-700";
  if (status === "authorized_pending_webhook") return "bg-blue-100 text-blue-700";
  if (status === "checkout_opened") return "bg-indigo-100 text-indigo-700";
  return "bg-violet-100 text-violet-700";
}

function statusLabel(status: PaymentOrderSummary["status"]): string {
  if (status === "authorized_pending_webhook") return "Pending";
  if (status === "checkout_opened") return "Checkout Opened";
  if (status === "created_reserved") return "Reserved";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default async function BuyerOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const requestedPage = normalizePage(getSingleValue(params.page));

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/dashboard/buyer/orders");
  }

  const from = (requestedPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count, error } = await supabase
    .from("project_credit_orders")
    .select(
      "id, purchase_ref, project_id, project_name_snapshot, reference_id_snapshot, quantity, unit_price_inr, subtotal_inr, gst_rate_percent, gst_amount_inr, total_amount_inr, currency, status, reservation_status, reservation_expires_at, created_at, captured_at, failed_at, expired_at",
      { count: "exact" },
    )
    .eq("buyer_user_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("buyer_orders_page_query_failed", {
      userId: user.id,
      reason: error.message,
    });
  }

  const orders = ((data ?? []) as Array<Record<string, unknown>>)
    .map((row) => normalizePaymentOrderSummary(row))
    .filter((row): row is PaymentOrderSummary => row !== null);

  const totalItems = typeof count === "number" ? count : orders.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);

  const pageHref = (page: number): string =>
    page <= 1 ? "/dashboard/buyer/orders" : `/dashboard/buyer/orders?page=${page}`;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 md:px-8">
      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Purchase Orders</h1>
            <p className="mt-1 text-sm text-gray-600">
              Review payment states and unique confirmation references.
            </p>
          </div>
          <Link
            href="/projects"
            className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
          >
            Offset Emission
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
            <p className="text-sm font-medium text-gray-700">No orders yet.</p>
            <p className="mt-1 text-sm text-gray-500">
              Start by purchasing credits from the marketplace.
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-3">Reference</th>
                  <th className="py-2 pr-3">Project</th>
                  <th className="py-2 pr-3">Quantity</th>
                  <th className="py-2 pr-3">Total</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Created</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-100 text-sm text-gray-700">
                    <td className="py-3 pr-3 font-semibold text-gray-900">{order.purchaseRef}</td>
                    <td className="py-3 pr-3">
                      <p className="font-medium text-gray-900">{order.projectNameSnapshot}</p>
                      <p className="text-xs text-gray-500">{order.referenceIdSnapshot}</p>
                    </td>
                    <td className="py-3 pr-3">{order.quantity.toLocaleString("en-IN")}</td>
                    <td className="py-3 pr-3 font-semibold text-gray-900">
                      {formatCurrencyInr(order.totalAmountInr)}
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusClass(order.status)}`}
                      >
                        {statusLabel(order.status)}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-xs text-gray-500">
                      {formatDateTime(order.createdAt)}
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

        {totalPages > 1 ? (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              {currentPage > 1 ? (
                <Link
                  href={pageHref(currentPage - 1)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Previous
                </Link>
              ) : (
                <span className="rounded-lg border border-gray-100 px-3 py-1.5 text-sm font-medium text-gray-300">
                  Previous
                </span>
              )}
              {currentPage < totalPages ? (
                <Link
                  href={pageHref(currentPage + 1)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Next
                </Link>
              ) : (
                <span className="rounded-lg border border-gray-100 px-3 py-1.5 text-sm font-medium text-gray-300">
                  Next
                </span>
              )}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

