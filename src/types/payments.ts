export type PurchaseOrderStatus =
  | "created_reserved"
  | "checkout_opened"
  | "authorized_pending_webhook"
  | "captured"
  | "failed"
  | "cancelled"
  | "expired";

export type ReservationStatus = "active" | "released" | "finalized";

export interface PaymentOrderSummary {
  id: string;
  purchaseRef: string;
  projectId: string;
  projectNameSnapshot: string;
  referenceIdSnapshot: string;
  quantity: number;
  unitPriceInr: number;
  subtotalInr: number;
  gstRatePercent: number;
  gstAmountInr: number;
  totalAmountInr: number;
  currency: string;
  status: PurchaseOrderStatus;
  reservationStatus: ReservationStatus;
  reservationExpiresAt: string | null;
  createdAt: string;
  capturedAt: string | null;
  failedAt: string | null;
  expiredAt: string | null;
}

export interface PaymentOrderDetail extends PaymentOrderSummary {
  buyerUserId: string;
  sellerUserId: string;
  buyerCompanyId: string | null;
  buyerCompanyNameSnapshot: string;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  razorpaySignature: string | null;
  providerPayload: Record<string, unknown> | null;
}

export interface PaymentOrderHistoryResponse {
  items: PaymentOrderSummary[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

type UnknownRecord = Record<string, unknown>;

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asStatus(value: unknown): PurchaseOrderStatus | null {
  if (
    value === "created_reserved" ||
    value === "checkout_opened" ||
    value === "authorized_pending_webhook" ||
    value === "captured" ||
    value === "failed" ||
    value === "cancelled" ||
    value === "expired"
  ) {
    return value;
  }

  return null;
}

function asReservationStatus(value: unknown): ReservationStatus | null {
  if (value === "active" || value === "released" || value === "finalized") {
    return value;
  }
  return null;
}

function asObject(value: unknown): UnknownRecord | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as UnknownRecord;
  }
  return null;
}

export function normalizePaymentOrderSummary(
  value: UnknownRecord,
): PaymentOrderSummary | null {
  const id = asString(value.id);
  const purchaseRef = asString(value.purchase_ref);
  const projectId = asString(value.project_id);
  const projectNameSnapshot = asString(value.project_name_snapshot);
  const referenceIdSnapshot = asString(value.reference_id_snapshot);
  const quantity = asNumber(value.quantity);
  const unitPriceInr = asNumber(value.unit_price_inr);
  const subtotalInr = asNumber(value.subtotal_inr);
  const gstRatePercent = asNumber(value.gst_rate_percent);
  const gstAmountInr = asNumber(value.gst_amount_inr);
  const totalAmountInr = asNumber(value.total_amount_inr);
  const currency = asString(value.currency) ?? "INR";
  const status = asStatus(value.status);
  const reservationStatus = asReservationStatus(value.reservation_status);
  const createdAt = asString(value.created_at);

  if (
    !id ||
    !purchaseRef ||
    !projectId ||
    !projectNameSnapshot ||
    !referenceIdSnapshot ||
    quantity === null ||
    unitPriceInr === null ||
    subtotalInr === null ||
    gstRatePercent === null ||
    gstAmountInr === null ||
    totalAmountInr === null ||
    !status ||
    !reservationStatus ||
    !createdAt
  ) {
    return null;
  }

  return {
    id,
    purchaseRef,
    projectId,
    projectNameSnapshot,
    referenceIdSnapshot,
    quantity: Math.max(0, Math.floor(quantity)),
    unitPriceInr,
    subtotalInr,
    gstRatePercent,
    gstAmountInr,
    totalAmountInr,
    currency,
    status,
    reservationStatus,
    reservationExpiresAt: asString(value.reservation_expires_at),
    createdAt,
    capturedAt: asString(value.captured_at),
    failedAt: asString(value.failed_at),
    expiredAt: asString(value.expired_at),
  };
}

export function normalizePaymentOrderDetail(
  value: UnknownRecord,
): PaymentOrderDetail | null {
  const summary = normalizePaymentOrderSummary(value);
  const buyerUserId = asString(value.buyer_user_id);
  const sellerUserId = asString(value.seller_user_id);
  const buyerCompanyNameSnapshot = asString(value.buyer_company_name_snapshot);

  if (!summary || !buyerUserId || !sellerUserId || !buyerCompanyNameSnapshot) {
    return null;
  }

  return {
    ...summary,
    buyerUserId,
    sellerUserId,
    buyerCompanyId: asString(value.buyer_company_id),
    buyerCompanyNameSnapshot,
    razorpayOrderId: asString(value.razorpay_order_id),
    razorpayPaymentId: asString(value.razorpay_payment_id),
    razorpaySignature: asString(value.razorpay_signature),
    providerPayload: asObject(value.provider_payload),
  };
}

