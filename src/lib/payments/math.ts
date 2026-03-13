import type { PurchaseOrderStatus } from "@/types/payments";

export function roundInr(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function toPaise(amountInr: number): number {
  if (!Number.isFinite(amountInr)) return 0;
  return Math.round(amountInr * 100);
}

export function fromPaise(amountPaise: number): number {
  if (!Number.isFinite(amountPaise)) return 0;
  return roundInr(amountPaise / 100);
}

export function computeOrderTotals(input: {
  unitPriceInr: number;
  quantity: number;
  gstRatePercent: number;
}): {
  subtotalInr: number;
  gstAmountInr: number;
  totalAmountInr: number;
} {
  const quantity = Math.max(1, Math.floor(input.quantity));
  const unitPriceInr = Math.max(0, input.unitPriceInr);
  const gstRatePercent = Math.max(0, input.gstRatePercent);

  const subtotalInr = roundInr(unitPriceInr * quantity);
  const gstAmountInr = roundInr((subtotalInr * gstRatePercent) / 100);
  const totalAmountInr = roundInr(subtotalInr + gstAmountInr);

  return {
    subtotalInr,
    gstAmountInr,
    totalAmountInr,
  };
}

export function computeRemainingCredits(input: {
  valuationCredits: number | null;
  creditsSold: number | null;
  creditsReserved: number | null;
}): number | null {
  if (input.valuationCredits === null || !Number.isFinite(input.valuationCredits)) {
    return null;
  }

  const valuationCredits = Math.max(0, Math.floor(input.valuationCredits));
  const creditsSold = Math.max(0, Math.floor(input.creditsSold ?? 0));
  const creditsReserved = Math.max(0, Math.floor(input.creditsReserved ?? 0));
  const remaining = valuationCredits - creditsSold - creditsReserved;
  return Math.max(0, remaining);
}

export function isPaymentFinalStatus(status: PurchaseOrderStatus): boolean {
  return status === "captured" || status === "failed" || status === "cancelled" || status === "expired";
}

export function computeOffsetProgressPercent(input: {
  purchasedCredits: number;
  latestEmissionsTco2e: number | null;
}): number {
  const purchasedCredits = Math.max(0, input.purchasedCredits);
  const emissions = input.latestEmissionsTco2e;
  if (emissions === null || !Number.isFinite(emissions) || emissions <= 0) {
    return 0;
  }

  const ratio = (purchasedCredits / emissions) * 100;
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;
  return Math.min(100, roundInr(ratio));
}

