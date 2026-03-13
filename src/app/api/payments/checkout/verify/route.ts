import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { PaymentConfigError, getPaymentRuntimeConfig } from "@/lib/payments/config";
import { parseNumeric, type ProjectCreditOrderRow } from "@/lib/payments/orders";
import { toPaise } from "@/lib/payments/math";
import {
  fetchRazorpayOrder,
  fetchRazorpayPayment,
  RazorpayProviderError,
  verifyRazorpayCheckoutSignature,
} from "@/lib/payments/razorpay";

export const runtime = "nodejs";

type VerifyPayload = {
  purchaseRef?: unknown;
  razorpayOrderId?: unknown;
  razorpayPaymentId?: unknown;
  razorpaySignature?: unknown;
};

type DbOrderRow = ProjectCreditOrderRow;

function asOrderRow(value: unknown): DbOrderRow | null {
  if (!value || typeof value !== "object") return null;
  return value as DbOrderRow;
}

export async function POST(request: Request) {
  try {
    try {
      getPaymentRuntimeConfig();
    } catch (error) {
      if (error instanceof PaymentConfigError) {
        return NextResponse.json({ error: error.message }, { status: 503 });
      }
      throw error;
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }

    const payload = (await request.json().catch(() => null)) as VerifyPayload | null;
    const purchaseRef =
      typeof payload?.purchaseRef === "string" ? payload.purchaseRef.trim() : "";
    const razorpayOrderId =
      typeof payload?.razorpayOrderId === "string" ? payload.razorpayOrderId.trim() : "";
    const razorpayPaymentId =
      typeof payload?.razorpayPaymentId === "string"
        ? payload.razorpayPaymentId.trim()
        : "";
    const razorpaySignature =
      typeof payload?.razorpaySignature === "string"
        ? payload.razorpaySignature.trim()
        : "";

    if (!purchaseRef || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json(
        { error: "Missing required checkout verification fields." },
        { status: 400 },
      );
    }

    const service = createServiceSupabaseClient();
    const { data: orderData, error: orderError } = await service
      .from("project_credit_orders")
      .select(
        "id, purchase_ref, buyer_user_id, buyer_company_id, seller_user_id, project_id, buyer_company_name_snapshot, project_name_snapshot, reference_id_snapshot, unit_price_inr, quantity, subtotal_inr, gst_rate_percent, gst_amount_inr, total_amount_inr, currency, razorpay_order_id, razorpay_payment_id, razorpay_signature, provider_payload, status, reservation_status, reservation_expires_at, captured_at, failed_at, expired_at, created_at, updated_at",
      )
      .eq("purchase_ref", purchaseRef)
      .eq("buyer_user_id", user.id)
      .maybeSingle();

    if (orderError) {
      console.error("payment_checkout_verify_order_query_failed", {
        userId: user.id,
        purchaseRef,
        reason: orderError.message,
      });
      return NextResponse.json({ error: "Failed to load order." }, { status: 500 });
    }

    const order = asOrderRow(orderData ?? null);
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (order.status === "captured") {
      return NextResponse.json(
        {
          redirectUrl: `/dashboard/buyer/orders/${order.purchase_ref}`,
          status: order.status,
        },
        { status: 200 },
      );
    }

    if (
      order.status === "failed" ||
      order.status === "cancelled" ||
      order.status === "expired"
    ) {
      return NextResponse.json(
        { error: `Order is already ${order.status}. Create a fresh payment attempt.` },
        { status: 409 },
      );
    }

    if (order.razorpay_order_id && order.razorpay_order_id !== razorpayOrderId) {
      return NextResponse.json(
        { error: "Razorpay order mismatch." },
        { status: 409 },
      );
    }

    const isValidCheckoutSignature = verifyRazorpayCheckoutSignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    if (!isValidCheckoutSignature) {
      return NextResponse.json({ error: "Invalid Razorpay signature." }, { status: 400 });
    }

    const localTotalPaise = toPaise(parseNumeric(order.total_amount_inr));

    try {
      const [providerOrder, providerPayment] = await Promise.all([
        fetchRazorpayOrder(razorpayOrderId),
        fetchRazorpayPayment(razorpayPaymentId),
      ]);

      if (providerOrder.amount !== localTotalPaise || providerOrder.currency !== "INR") {
        return NextResponse.json(
          { error: "Amount or currency mismatch during verification." },
          { status: 409 },
        );
      }

      if (providerPayment.order_id !== razorpayOrderId) {
        return NextResponse.json(
          { error: "Payment does not belong to order." },
          { status: 409 },
        );
      }
    } catch (error) {
      if (error instanceof RazorpayProviderError) {
        console.error("payment_checkout_verify_provider_fetch_failed", {
          userId: user.id,
          purchaseRef,
          stage: error.stage,
          statusCode: error.statusCode,
          reason: error.message,
        });
        return NextResponse.json(
          { error: `Razorpay verification fetch failed (${error.statusCode}).` },
          { status: 502 },
        );
      }
      throw error;
    }

    const nextStatus = "authorized_pending_webhook";

    const providerPayload = {
      ...(order.provider_payload ?? {}),
      callback_verified_at: new Date().toISOString(),
      callback_order_id: razorpayOrderId,
      callback_payment_id: razorpayPaymentId,
    };

    const { error: updateError } = await service
      .from("project_credit_orders")
      .update({
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: razorpaySignature,
        status: nextStatus,
        provider_payload: providerPayload,
      })
      .eq("id", order.id)
      .in("status", ["created_reserved", "checkout_opened", "authorized_pending_webhook", "captured"]);

    if (updateError) {
      console.error("payment_checkout_verify_update_failed", {
        userId: user.id,
        purchaseRef,
        reason: updateError.message,
      });
      return NextResponse.json({ error: "Failed to update order." }, { status: 500 });
    }

    await service.from("project_payment_events").insert({
      order_id: order.id,
      source: "callback",
      event_type: "checkout.verified",
      payload: {
        purchase_ref: purchaseRef,
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
      },
    });

    return NextResponse.json(
      {
        redirectUrl: `/dashboard/buyer/orders/${purchaseRef}`,
        status: nextStatus,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("payment_checkout_verify_unhandled_error", {
      reason: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json(
      {
        error: "Unexpected error during checkout verification.",
      },
      { status: 500 },
    );
  }
}
