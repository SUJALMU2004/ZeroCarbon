import crypto from "node:crypto";
import { getPaymentRuntimeConfig } from "@/lib/payments/config";

export class RazorpayProviderError extends Error {
  stage: string;
  statusCode: number;
  responseBody: string | null;

  constructor(params: {
    stage: string;
    message: string;
    statusCode: number;
    responseBody?: string | null;
  }) {
    super(params.message);
    this.name = "RazorpayProviderError";
    this.stage = params.stage;
    this.statusCode = params.statusCode;
    this.responseBody = params.responseBody ?? null;
  }
}

function buildAuthHeader(keyId: string, keySecret: string): string {
  const token = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  return `Basic ${token}`;
}

function createHmacSignature(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const aBuffer = Buffer.from(a, "utf8");
  const bBuffer = Buffer.from(b, "utf8");
  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

async function requestRazorpay<T>(params: {
  stage: string;
  method: "GET" | "POST";
  path: string;
  body?: unknown;
}): Promise<T> {
  const config = getPaymentRuntimeConfig();
  const url = `${config.razorpayApiBaseUrl}${params.path}`;
  const response = await fetch(url, {
    method: params.method,
    headers: {
      Authorization: buildAuthHeader(
        config.razorpayKeyId,
        config.razorpayKeySecret,
      ),
      "Content-Type": "application/json",
    },
    body: params.body !== undefined ? JSON.stringify(params.body) : undefined,
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new RazorpayProviderError({
      stage: params.stage,
      message: `Razorpay API request failed at ${params.stage} (${response.status})`,
      statusCode: response.status,
      responseBody: responseText,
    });
  }

  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw new RazorpayProviderError({
      stage: params.stage,
      message: `Razorpay API returned invalid JSON at ${params.stage}`,
      statusCode: 502,
      responseBody: responseText,
    });
  }
}

export interface RazorpayOrderCreateRequest {
  amountPaise: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResponse {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  created_at: number;
  notes?: Record<string, string>;
}

export interface RazorpayPaymentResponse {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: string;
  order_id: string | null;
  invoice_id: string | null;
  international?: boolean;
  method?: string;
  amount_refunded?: number;
  refunded?: boolean;
  captured?: boolean;
  description?: string;
  created_at?: number;
  notes?: Record<string, string>;
}

export async function createRazorpayOrder(
  input: RazorpayOrderCreateRequest,
): Promise<RazorpayOrderResponse> {
  return requestRazorpay<RazorpayOrderResponse>({
    stage: "create_order",
    method: "POST",
    path: "/v1/orders",
    body: {
      amount: input.amountPaise,
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes ?? {},
    },
  });
}

export async function fetchRazorpayOrder(
  razorpayOrderId: string,
): Promise<RazorpayOrderResponse> {
  return requestRazorpay<RazorpayOrderResponse>({
    stage: "fetch_order",
    method: "GET",
    path: `/v1/orders/${encodeURIComponent(razorpayOrderId)}`,
  });
}

export async function fetchRazorpayPayment(
  razorpayPaymentId: string,
): Promise<RazorpayPaymentResponse> {
  return requestRazorpay<RazorpayPaymentResponse>({
    stage: "fetch_payment",
    method: "GET",
    path: `/v1/payments/${encodeURIComponent(razorpayPaymentId)}`,
  });
}

export function verifyRazorpayCheckoutSignature(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): boolean {
  const config = getPaymentRuntimeConfig();
  const payload = `${input.razorpayOrderId}|${input.razorpayPaymentId}`;
  const expectedSignature = createHmacSignature(payload, config.razorpayKeySecret);
  return safeEqualHex(expectedSignature, input.razorpaySignature);
}

export function verifyRazorpayWebhookSignature(input: {
  rawBody: string;
  signature: string;
}): boolean {
  const config = getPaymentRuntimeConfig();
  const expectedSignature = createHmacSignature(
    input.rawBody,
    config.razorpayWebhookSecret,
  );
  return safeEqualHex(expectedSignature, input.signature);
}
