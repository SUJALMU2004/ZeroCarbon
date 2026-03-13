import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import {
  verifyRazorpayCheckoutSignature,
  verifyRazorpayWebhookSignature,
} from "@/lib/payments/razorpay";

describe("razorpay signature verification", () => {
  it("verifies checkout signature", () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_123";
    process.env.RAZORPAY_KEY_SECRET = "secret_checkout";
    process.env.RAZORPAY_WEBHOOK_SECRET = "secret_webhook";

    const payload = "order_abc|pay_xyz";
    const signature = crypto
      .createHmac("sha256", "secret_checkout")
      .update(payload)
      .digest("hex");

    expect(
      verifyRazorpayCheckoutSignature({
        razorpayOrderId: "order_abc",
        razorpayPaymentId: "pay_xyz",
        razorpaySignature: signature,
      }),
    ).toBe(true);
  });

  it("verifies webhook signature", () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_123";
    process.env.RAZORPAY_KEY_SECRET = "secret_checkout";
    process.env.RAZORPAY_WEBHOOK_SECRET = "secret_webhook";

    const rawBody = JSON.stringify({ event: "payment.captured" });
    const signature = crypto
      .createHmac("sha256", "secret_webhook")
      .update(rawBody)
      .digest("hex");

    expect(
      verifyRazorpayWebhookSignature({
        rawBody,
        signature,
      }),
    ).toBe(true);
  });
});

