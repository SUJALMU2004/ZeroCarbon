import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import {
  isOrderExpired,
  parseNumeric,
  toOrderDetail,
  type ProjectCreditOrderRow,
} from "@/lib/payments/orders";

type DbOrderRow = ProjectCreditOrderRow;

function asOrderRow(value: unknown): DbOrderRow | null {
  if (!value || typeof value !== "object") return null;
  return value as DbOrderRow;
}

async function fetchAuthorizedOrder(params: {
  purchaseRef: string;
  userId: string;
}): Promise<DbOrderRow | null> {
  const service = createServiceSupabaseClient();
  const { data, error } = await service
    .from("project_credit_orders")
    .select(
      "id, purchase_ref, buyer_user_id, buyer_company_id, seller_user_id, project_id, buyer_company_name_snapshot, project_name_snapshot, reference_id_snapshot, unit_price_inr, quantity, subtotal_inr, gst_rate_percent, gst_amount_inr, total_amount_inr, currency, razorpay_order_id, razorpay_payment_id, razorpay_signature, provider_payload, status, reservation_status, reservation_expires_at, captured_at, failed_at, expired_at, created_at, updated_at",
    )
    .eq("purchase_ref", params.purchaseRef)
    .or(`buyer_user_id.eq.${params.userId},seller_user_id.eq.${params.userId}`)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return asOrderRow(data ?? null);
}

export async function GET(
  _: Request,
  context: { params: Promise<{ purchaseRef: string }> },
) {
  try {
    const { purchaseRef } = await context.params;
    const normalizedRef = purchaseRef.trim();

    if (!normalizedRef) {
      return NextResponse.json({ error: "Invalid purchase reference." }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }

    let order = await fetchAuthorizedOrder({
      purchaseRef: normalizedRef,
      userId: user.id,
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (isOrderExpired(order)) {
      const service = createServiceSupabaseClient();
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
            ...(order.provider_payload ?? {}),
            system_expired_at: new Date().toISOString(),
            expiry_reason: "reservation_ttl_elapsed",
          },
        })
        .eq("id", order.id)
        .eq("reservation_status", "active");

      await service.from("project_payment_events").insert({
        order_id: order.id,
        provider_event_id: null,
        source: "system",
        event_type: "reservation.expired",
        payload: {
          project_id: order.project_id,
          quantity: order.quantity,
          purchase_ref: order.purchase_ref,
          credits_released: parseNumeric(order.quantity),
        },
      });

      order = await fetchAuthorizedOrder({
        purchaseRef: normalizedRef,
        userId: user.id,
      });

      if (!order) {
        return NextResponse.json({ error: "Order not found." }, { status: 404 });
      }
    }

    return NextResponse.json(
      {
        item: toOrderDetail(order),
        actorRole: order.buyer_user_id === user.id ? "buyer" : "seller",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("payment_order_detail_unhandled_error", {
      reason: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json(
      {
        error: "Unexpected error while loading order detail.",
      },
      { status: 500 },
    );
  }
}
