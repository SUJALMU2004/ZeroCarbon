import { describe, expect, it } from "vitest";
import {
  computeOffsetProgressPercent,
  computeOrderTotals,
  computeRemainingCredits,
  fromPaise,
  toPaise,
} from "@/lib/payments/math";

describe("payments math", () => {
  it("computes gst totals at 2.5%", () => {
    const totals = computeOrderTotals({
      unitPriceInr: 1277,
      quantity: 10,
      gstRatePercent: 2.5,
    });

    expect(totals.subtotalInr).toBe(12770);
    expect(totals.gstAmountInr).toBe(319.25);
    expect(totals.totalAmountInr).toBe(13089.25);
  });

  it("converts inr<->paise safely", () => {
    expect(toPaise(13089.25)).toBe(1308925);
    expect(fromPaise(1308925)).toBe(13089.25);
  });

  it("computes remaining credits with sold and reserved counters", () => {
    expect(
      computeRemainingCredits({
        valuationCredits: 5000,
        creditsSold: 1300,
        creditsReserved: 200,
      }),
    ).toBe(3500);
  });

  it("caps offset progress between 0 and 100", () => {
    expect(
      computeOffsetProgressPercent({
        purchasedCredits: 500,
        latestEmissionsTco2e: 1000,
      }),
    ).toBe(50);

    expect(
      computeOffsetProgressPercent({
        purchasedCredits: 5000,
        latestEmissionsTco2e: 1000,
      }),
    ).toBe(100);
  });
});

