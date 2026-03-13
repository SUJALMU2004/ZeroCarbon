import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { PaymentConfigError } from "@/lib/payments/config";
import {
  parseNumeric,
  type ProjectCreditOrderRow,
} from "@/lib/payments/orders";
import { verifyRazorpayWebhookSignature } from "@/lib/payments/razorpay";

export const runtime = "nodejs";

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        amount?: number;
        currency?: string;
        status?: string;
        error_code?: string | null;
        error_description?: string | null;
      };
    };
    order?: {
      entity?: {
        id?: string;
        amount?: number;
        currency?: string;
        status?: string;
      };
    };
  };
};

type DbOrderRow = ProjectCreditOrderRow;

function asOrderRow(value: unknown): DbOrderRow | null {
  if (!value || typeof value !== "object") return null;
  return value as DbOrderRow;
}

function asPayload(value: unknown): RazorpayWebhookPayload | null {
  if (!value || typeof value !== "object") return null;
  return value as RazorpayWebhookPayload;
}

export async function POST(request: Request) {
  try {
    const signature = request.headers.get("x-razorpay-signature")?.trim() ?? "";
    const providerEventId = request.headers.get("x-razorpay-event-id")?.trim() ?? null;
    const rawBody = await request.text();

    if (!signature) {
      return NextResponse.json(
        { error: "Missing webhook signature header." },
        { status: 400 },
      );
    }

    let isValid = false;
    try {
      isValid = verifyRazorpayWebhookSignature({
        rawBody,
        signature,
      });
    } catch (error) {
      if (error instanceof PaymentConfigError) {
        return NextResponse.json({ error: error.message }, { status: 503 });
      }
      throw error;
    }

    if (!isValid) {
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
    }

    let parsedJson: unknown = null;
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
    }

    const parsed = asPayload(parsedJson);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
    }

    const eventType = parsed.event ?? "unknown";
    const paymentEntity = parsed.payload?.payment?.entity;
    const orderEntity = parsed.payload?.order?.entity;
    const razorpayOrderId =
      paymentEntity?.order_id?.trim() || orderEntity?.id?.trim() || null;
    const razorpayPaymentId = paymentEntity?.id?.trim() || null;

    const service = createServiceSupabaseClient();

    let order: DbOrderRow | null = null;
    if (razorpayOrderId) {
      const { data: orderData, error: orderError } = await service
        .from("project_credit_orders")
        .select(
          "id, purchase_ref, buyer_user_id, buyer_company_id, seller_user_id, project_id, buyer_company_name_snapshot, project_name_snapshot, reference_id_snapshot, unit_price_inr, quantity, subtotal_inr, gst_rate_percent, gst_amount_inr, total_amount_inr, currency, razorpay_order_id, razorpay_payment_id, razorpay_signature, provider_payload, status, reservation_status, reservation_expires_at, captured_at, failed_at, expired_at, created_at, updated_at",
        )
        .eq("razorpay_order_id", razorpayOrderId)
        .maybeSingle();

      if (orderError) {
        console.error("payment_webhook_order_lookup_failed", {
          stage: "order_lookup",
          razorpayOrderId,
          reason: orderError.message,
        });
      } else {
        order = asOrderRow(orderData ?? null);
      }
    }

    const { error: eventInsertError } = await service
      .from("project_payment_events")
      .insert({
        order_id: order?.id ?? null,
        provider_event_id: providerEventId,
        source: "webhook",
        event_type: eventType,
        payload: parsed,
      });

    if (eventInsertError?.code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
    }

    if (eventInsertError) {
      console.error("payment_webhook_event_insert_failed", {
        stage: "event_insert",
        reason: eventInsertError.message,
        providerEventId,
      });
      return NextResponse.json({ error: "Failed to persist payment event." }, { status: 500 });
    }

    if (!order) {
      return NextResponse.json(
        { ok: true, processed: false, reason: "order_not_found" },
        { status: 200 },
      );
    }

    const existingPayload =
      order.provider_payload && typeof order.provider_payload === "object"
        ? order.provider_payload
        : {};

    if (eventType === "payment.captured" || eventType === "order.paid") {
      if (order.status !== "captured") {
        if (order.reservation_status === "active") {
          await service.rpc("zc_finalize_project_sale", {
            p_project_id: order.project_id,
            p_quantity: order.quantity,
          });
        }

        const { error: updateError } = await service
          .from("project_credit_orders")
          .update({
            status: "captured",
            reservation_status: "finalized",
            captured_at: new Date().toISOString(),
            razorpay_payment_id: razorpayPaymentId ?? order.razorpay_payment_id,
            provider_payload: {
              ...existingPayload,
              webhook_last_event: eventType,
              webhook_captured_at: new Date().toISOString(),
              webhook_payment_status: paymentEntity?.status ?? null,
            },
          })
          .eq("id", order.id)
          .neq("status", "captured");

        if (updateError) {
          console.error("payment_webhook_capture_update_failed", {
            orderId: order.id,
            eventType,
            reason: updateError.message,
          });
          return NextResponse.json({ error: "Failed to capture order state." }, { status: 500 });
        }
      }
    } else if (eventType === "payment.failed") {
      if (order.status !== "captured" && order.status !== "failed") {
        if (order.reservation_status === "active") {
          await service.rpc("zc_release_project_credits", {
            p_project_id: order.project_id,
            p_quantity: order.quantity,
          });
        }

        const { error: updateError } = await service
          .from("project_credit_orders")
          .update({
            status: "failed",
            reservation_status: "released",
            failed_at: new Date().toISOString(),
            razorpay_payment_id: razorpayPaymentId ?? order.razorpay_payment_id,
            provider_payload: {
              ...existingPayload,
              webhook_last_event: eventType,
              webhook_failed_at: new Date().toISOString(),
              webhook_error_code: paymentEntity?.error_code ?? null,
              webhook_error_description: paymentEntity?.error_description ?? null,
            },
          })
          .eq("id", order.id)
          .neq("status", "captured");

        if (updateError) {
          console.error("payment_webhook_failure_update_failed", {
            orderId: order.id,
            eventType,
            reason: updateError.message,
          });
          return NextResponse.json({ error: "Failed to update failed order state." }, { status: 500 });
        }
      }
    } else if (
      order.reservation_status === "active" &&
      order.reservation_expires_at &&
      new Date(order.reservation_expires_at).getTime() <= Date.now()
    ) {
      await service.rpc("zc_release_project_credits", {
        p_project_id: order.project_id,
        p_quantity: order.quantity,
      });

      await service
        .from("project_credit_orders")
        .update({
          status: "expired",
          reservation_status: "released",
          expired_at: new Date().toISOString(),
          provider_payload: {
            ...existingPayload,
            webhook_last_event: eventType,
            expired_from_webhook: true,
          },
        })
        .eq("id", order.id)
        .eq("reservation_status", "active")
        .in("status", ["created_reserved", "checkout_opened", "authorized_pending_webhook"]);
    }

    return NextResponse.json(
      {
        ok: true,
        processed: true,
        eventType,
        purchaseRef: order.purchase_ref,
        orderStatus: order.status,
        amountInr: parseNumeric(order.total_amount_inr),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("payment_webhook_unhandled_error", {
      reason: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json(
      {
        error: "Unexpected webhook processing error.",
      },
      { status: 500 },
    );
  }
}
