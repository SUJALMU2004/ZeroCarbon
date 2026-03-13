import crypto from "node:crypto";
import type {
  PaymentOrderDetail,
  PurchaseOrderStatus,
  ReservationStatus,
} from "@/types/payments";

export const PAYMENT_ACTIVE_ORDER_STATUSES: PurchaseOrderStatus[] = [
  "created_reserved",
  "checkout_opened",
  "authorized_pending_webhook",
];

export const PAYMENT_FINAL_ORDER_STATUSES: PurchaseOrderStatus[] = [
  "captured",
  "failed",
  "cancelled",
  "expired",
];

export type ProjectCreditOrderRow = {
  id: string;
  purchase_ref: string;
  buyer_user_id: string;
  buyer_company_id: string | null;
  seller_user_id: string;
  project_id: string;
  buyer_company_name_snapshot: string;
  project_name_snapshot: string;
  reference_id_snapshot: string;
  unit_price_inr: number | string;
  quantity: number;
  subtotal_inr: number | string;
  gst_rate_percent: number | string;
  gst_amount_inr: number | string;
  total_amount_inr: number | string;
  currency: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  provider_payload: Record<string, unknown> | null;
  status: PurchaseOrderStatus;
  reservation_status: ReservationStatus;
  reservation_expires_at: string | null;
  captured_at: string | null;
  failed_at: string | null;
  expired_at: string | null;
  created_at: string;
  updated_at: string;
};

export function parsePageParam(
  value: string | null,
  fallback: number,
  max: number,
): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.floor(parsed);
  if (normalized <= 0) return fallback;
  return Math.min(normalized, max);
}

export function parseNumeric(value: number | string | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function generatePurchaseRef(): string {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `ORD-${year}${month}${day}-${suffix}`;
}

export function isOrderExpired(
  order: Pick<ProjectCreditOrderRow, "reservation_status" | "reservation_expires_at" | "status">,
): boolean {
  if (order.reservation_status !== "active") return false;
  if (!order.reservation_expires_at) return false;
  if (
    order.status !== "created_reserved" &&
    order.status !== "checkout_opened" &&
    order.status !== "authorized_pending_webhook"
  ) {
    return false;
  }
  const expiresAt = new Date(order.reservation_expires_at);
  if (Number.isNaN(expiresAt.getTime())) return false;
  return expiresAt.getTime() <= Date.now();
}

export function toOrderDetail(row: ProjectCreditOrderRow): PaymentOrderDetail {
  return {
    id: row.id,
    purchaseRef: row.purchase_ref,
    buyerUserId: row.buyer_user_id,
    buyerCompanyId: row.buyer_company_id,
    sellerUserId: row.seller_user_id,
    projectId: row.project_id,
    buyerCompanyNameSnapshot: row.buyer_company_name_snapshot,
    projectNameSnapshot: row.project_name_snapshot,
    referenceIdSnapshot: row.reference_id_snapshot,
    quantity: row.quantity,
    unitPriceInr: parseNumeric(row.unit_price_inr),
    subtotalInr: parseNumeric(row.subtotal_inr),
    gstRatePercent: parseNumeric(row.gst_rate_percent),
    gstAmountInr: parseNumeric(row.gst_amount_inr),
    totalAmountInr: parseNumeric(row.total_amount_inr),
    currency: row.currency || "INR",
    razorpayOrderId: row.razorpay_order_id,
    razorpayPaymentId: row.razorpay_payment_id,
    razorpaySignature: row.razorpay_signature,
    providerPayload: row.provider_payload,
    status: row.status,
    reservationStatus: row.reservation_status,
    reservationExpiresAt: row.reservation_expires_at,
    createdAt: row.created_at,
    capturedAt: row.captured_at,
    failedAt: row.failed_at,
    expiredAt: row.expired_at,
  };
}
