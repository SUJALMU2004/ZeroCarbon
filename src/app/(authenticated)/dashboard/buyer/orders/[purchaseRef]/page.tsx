import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import BuyerOrderConfirmationClient from "@/components/payments/BuyerOrderConfirmationClient";
import { normalizePaymentOrderDetail } from "@/types/payments";

export default async function BuyerOrderConfirmationPage({
  params,
}: {
  params: Promise<{ purchaseRef: string }>;
}) {
  const { purchaseRef } = await params;
  const normalizedRef = purchaseRef.trim();

  if (!normalizedRef) {
    redirect("/dashboard/buyer/orders");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(`/dashboard/buyer/orders/${normalizedRef}`)}`);
  }

  const { data, error } = await supabase
    .from("project_credit_orders")
    .select(
      "id, purchase_ref, buyer_user_id, buyer_company_id, seller_user_id, project_id, buyer_company_name_snapshot, project_name_snapshot, reference_id_snapshot, unit_price_inr, quantity, subtotal_inr, gst_rate_percent, gst_amount_inr, total_amount_inr, currency, razorpay_order_id, razorpay_payment_id, razorpay_signature, provider_payload, status, reservation_status, reservation_expires_at, captured_at, failed_at, expired_at, created_at, updated_at",
    )
    .eq("purchase_ref", normalizedRef)
    .eq("buyer_user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("buyer_order_confirmation_query_failed", {
      userId: user.id,
      purchaseRef: normalizedRef,
      reason: error.message,
    });
    redirect("/dashboard/buyer/orders");
  }

  const order = normalizePaymentOrderDetail((data ?? null) as Record<string, unknown>);
  if (!order) {
    redirect("/dashboard/buyer/orders");
  }

  return <BuyerOrderConfirmationClient initialOrder={order} />;
}

