export class PaymentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentConfigError";
  }
}

function parseNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw || raw.trim().length === 0) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new PaymentConfigError(`Invalid numeric environment variable: ${name}`);
  }
  return parsed;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new PaymentConfigError(`Missing required environment variable: ${name}`);
  }
  return value;
}

export interface PaymentRuntimeConfig {
  razorpayKeyId: string;
  razorpayKeySecret: string;
  razorpayWebhookSecret: string;
  razorpayApiBaseUrl: string;
  gstRatePercent: number;
  reservationMinutes: number;
}

export function getPaymentRuntimeConfig(): PaymentRuntimeConfig {
  return {
    razorpayKeyId: requiredEnv("RAZORPAY_KEY_ID"),
    razorpayKeySecret: requiredEnv("RAZORPAY_KEY_SECRET"),
    razorpayWebhookSecret: requiredEnv("RAZORPAY_WEBHOOK_SECRET"),
    razorpayApiBaseUrl:
      process.env.RAZORPAY_API_BASE_URL?.trim() || "https://api.razorpay.com",
    gstRatePercent: parseNumberEnv("PAYMENT_GST_RATE_PERCENT", 2.5),
    reservationMinutes: Math.max(
      1,
      Math.floor(parseNumberEnv("PAYMENT_ORDER_RESERVATION_MINUTES", 30)),
    ),
  };
}
