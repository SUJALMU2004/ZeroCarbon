import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { getPaymentRuntimeConfig, PaymentConfigError } from "@/lib/payments/config";
import {
  PAYMENT_ACTIVE_ORDER_STATUSES,
  generatePurchaseRef,
  isOrderExpired,
  parseNumeric,
  parsePageParam,
  type ProjectCreditOrderRow,
} from "@/lib/payments/orders";
import {
  computeOrderTotals,
  computeRemainingCredits,
  toPaise,
} from "@/lib/payments/math";
import { createRazorpayOrder, RazorpayProviderError } from "@/lib/payments/razorpay";
import {
  getNormalizedProjectAiValuation,
  parseProjectReviewNotes,
} from "@/lib/utils/projectMetadata";
import { resolveAndPersistProjectAiValuation } from "@/lib/valuation/carbonValuation";
import { getProjectReference } from "@/lib/utils/projectReference";

export const runtime = "nodejs";

type CreateOrderPayload = {
  projectId?: unknown;
  quantity?: unknown;
};

type CompanyRow = {
  id: string;
  status: string | null;
  legal_company_name: string | null;
};

type ProjectRow = {
  id: string;
  user_id: string;
  project_name: string | null;
  project_type: string | null;
  status: string | null;
  created_at: string;
  review_notes: string | null;
  latitude: number | null;
  longitude: number | null;
  polygon_geojson: object | null;
  land_area_hectares: number | null;
  project_start_date: string | null;
  satellite_status: string | null;
  satellite_ndvi_current: number | null;
  satellite_error_message: string | null;
  satellite_last_attempted_at: string | null;
  credits_reserved: number | null;
  credits_sold: number | null;
};

type DbOrderRow = ProjectCreditOrderRow;

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function parseQuantity(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = Math.floor(value);
    return parsed > 0 ? parsed : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (!Number.isFinite(parsed)) return null;
    const quantity = Math.floor(parsed);
    return quantity > 0 ? quantity : null;
  }
  return null;
}

function isUniqueViolation(errorCode: string | undefined): boolean {
  return errorCode === "23505";
}

function asOrderRow(value: unknown): DbOrderRow | null {
  if (!value || typeof value !== "object") return null;
  return value as DbOrderRow;
}

function buildOrderResponse(params: {
  keyId: string;
  order: DbOrderRow;
  reused: boolean;
  message?: string;
}) {
  const totalAmountInr = parseNumeric(params.order.total_amount_inr);
  const subtotalInr = parseNumeric(params.order.subtotal_inr);
  const gstAmountInr = parseNumeric(params.order.gst_amount_inr);
  const unitPriceInr = parseNumeric(params.order.unit_price_inr);
  const gstRatePercent = parseNumeric(params.order.gst_rate_percent);

  return {
    reused: params.reused,
    message: params.message ?? null,
    purchaseRef: params.order.purchase_ref,
    order: {
      status: params.order.status,
      quantity: params.order.quantity,
      unitPriceInr,
      subtotalInr,
      gstRatePercent,
      gstAmountInr,
      totalAmountInr,
      currency: params.order.currency,
      reservationExpiresAt: params.order.reservation_expires_at,
      projectName: params.order.project_name_snapshot,
      referenceId: params.order.reference_id_snapshot,
    },
    checkout: params.order.razorpay_order_id
      ? {
          keyId: params.keyId,
          razorpayOrderId: params.order.razorpay_order_id,
          amountPaise: toPaise(totalAmountInr),
          currency: params.order.currency,
          name: "ZeroCarbon",
          description: `${params.order.project_name_snapshot} Carbon Credits`,
          notes: {
            purchase_ref: params.order.purchase_ref,
            project_id: params.order.project_id,
          },
        }
      : null,
  };
}

async function expireReservationsForProject(
  projectId: string,
): Promise<{ ok: boolean; errorMessage: string | null }> {
  const service = createServiceSupabaseClient();
  const { error } = await service.rpc("zc_expire_project_reservations", {
    p_project_id: projectId,
  });

  if (error) {
    return {
      ok: false,
      errorMessage: error.message,
    };
  }

  return { ok: true, errorMessage: null };
}

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parsePageParam(searchParams.get("page"), DEFAULT_PAGE, Number.MAX_SAFE_INTEGER);
    const pageSize = parsePageParam(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const service = createServiceSupabaseClient();
    const { data, count, error } = await service
      .from("project_credit_orders")
      .select(
        "id, purchase_ref, buyer_user_id, buyer_company_id, seller_user_id, project_id, buyer_company_name_snapshot, project_name_snapshot, reference_id_snapshot, unit_price_inr, quantity, subtotal_inr, gst_rate_percent, gst_amount_inr, total_amount_inr, currency, razorpay_order_id, razorpay_payment_id, razorpay_signature, provider_payload, status, reservation_status, reservation_expires_at, captured_at, failed_at, expired_at, created_at, updated_at",
        { count: "exact" },
      )
      .eq("buyer_user_id", user.id)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("payment_orders_history_query_failed", {
        userId: user.id,
        reason: error.message,
      });
      return NextResponse.json({ error: "Failed to load order history." }, { status: 500 });
    }

    const rows = ((data ?? []) as unknown[])
      .map((row) => asOrderRow(row))
      .filter((row): row is DbOrderRow => row !== null)
      .map((row) => ({
        id: row.id,
        purchaseRef: row.purchase_ref,
        projectId: row.project_id,
        projectNameSnapshot: row.project_name_snapshot,
        referenceIdSnapshot: row.reference_id_snapshot,
        quantity: row.quantity,
        unitPriceInr: parseNumeric(row.unit_price_inr),
        subtotalInr: parseNumeric(row.subtotal_inr),
        gstRatePercent: parseNumeric(row.gst_rate_percent),
        gstAmountInr: parseNumeric(row.gst_amount_inr),
        totalAmountInr: parseNumeric(row.total_amount_inr),
        currency: row.currency,
        status: row.status,
        reservationStatus: row.reservation_status,
        reservationExpiresAt: row.reservation_expires_at,
        createdAt: row.created_at,
        capturedAt: row.captured_at,
        failedAt: row.failed_at,
        expiredAt: row.expired_at,
      }));

    const hasMore =
      typeof count === "number"
        ? from + rows.length < count
        : rows.length === pageSize;

    return NextResponse.json(
      {
        items: rows,
        page,
        pageSize,
        hasMore,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("payment_orders_history_unhandled_error", {
      reason: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json(
      {
        error: "Unexpected error while loading order history.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    let config;
    try {
      config = getPaymentRuntimeConfig();
    } catch (error) {
      if (error instanceof PaymentConfigError) {
        return NextResponse.json(
          { error: error.message },
          { status: 503 },
        );
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

    const payload = (await request.json().catch(() => null)) as CreateOrderPayload | null;
    const projectId = typeof payload?.projectId === "string" ? payload.projectId.trim() : "";
    const quantity = parseQuantity(payload?.quantity);

    if (!projectId || quantity === null) {
      return NextResponse.json(
        { error: "projectId and quantity are required." },
        { status: 400 },
      );
    }

    const service = createServiceSupabaseClient();

    const { data: companyData, error: companyError } = await service
      .from("companies")
      .select("id, status, legal_company_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (companyError) {
      console.error("payment_order_company_query_failed", {
        userId: user.id,
        reason: companyError.message,
      });
      return NextResponse.json({ error: "Failed to load buyer company." }, { status: 500 });
    }

    const company = (companyData ?? null) as CompanyRow | null;
    const buyerCompanyName = company?.legal_company_name?.trim() ?? "";

    if (!company || company.status !== "verified" || buyerCompanyName.length === 0) {
      return NextResponse.json(
        { error: "Verified buyer company with legal company name is required." },
        { status: 403 },
      );
    }

    const { data: projectData, error: projectError } = await service
      .from("carbon_projects")
      .select(
        "id, user_id, project_name, project_type, status, created_at, review_notes, latitude, longitude, polygon_geojson, land_area_hectares, project_start_date, satellite_status, satellite_ndvi_current, satellite_error_message, satellite_last_attempted_at, credits_reserved, credits_sold",
      )
      .eq("id", projectId)
      .eq("status", "verified")
      .maybeSingle();

    if (projectError) {
      console.error("payment_order_project_query_failed", {
        userId: user.id,
        projectId,
        reason: projectError.message,
      });
      return NextResponse.json({ error: "Failed to load project." }, { status: 500 });
    }

    const project = (projectData ?? null) as ProjectRow | null;
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    if (project.user_id === user.id) {
      return NextResponse.json(
        { error: "Self purchase is not allowed for this project." },
        { status: 403 },
      );
    }

    const expireResult = await expireReservationsForProject(project.id);
    if (!expireResult.ok) {
      console.error("payment_order_reservation_expire_failed", {
        projectId: project.id,
        reason: expireResult.errorMessage,
      });
      return NextResponse.json(
        {
          error:
            "Payment reservation migration is missing or unavailable. Run latest Supabase migration.",
        },
        { status: 500 },
      );
    }

    const { data: activeData, error: activeError } = await service
      .from("project_credit_orders")
      .select(
        "id, purchase_ref, buyer_user_id, buyer_company_id, seller_user_id, project_id, buyer_company_name_snapshot, project_name_snapshot, reference_id_snapshot, unit_price_inr, quantity, subtotal_inr, gst_rate_percent, gst_amount_inr, total_amount_inr, currency, razorpay_order_id, razorpay_payment_id, razorpay_signature, provider_payload, status, reservation_status, reservation_expires_at, captured_at, failed_at, expired_at, created_at, updated_at",
      )
      .eq("buyer_user_id", user.id)
      .eq("project_id", project.id)
      .eq("reservation_status", "active")
      .in("status", PAYMENT_ACTIVE_ORDER_STATUSES)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeError) {
      console.error("payment_order_active_query_failed", {
        userId: user.id,
        projectId: project.id,
        reason: activeError.message,
      });
      return NextResponse.json({ error: "Failed to load active order state." }, { status: 500 });
    }

    const activeOrder = asOrderRow(activeData ?? null);
    if (activeOrder && isOrderExpired(activeOrder)) {
      await service.rpc("zc_release_project_credits", {
        p_project_id: activeOrder.project_id,
        p_quantity: activeOrder.quantity,
      });

      await service
        .from("project_credit_orders")
        .update({
          status: "expired",
          reservation_status: "released",
          expired_at: new Date().toISOString(),
          provider_payload: {
            ...(activeOrder.provider_payload ?? {}),
            system_expired_at: new Date().toISOString(),
            expiry_reason: "reservation_ttl_elapsed",
          },
        })
        .eq("id", activeOrder.id)
        .eq("reservation_status", "active");
    }

    if (activeOrder && !isOrderExpired(activeOrder)) {
      if (activeOrder.status === "authorized_pending_webhook") {
        return NextResponse.json(
          {
            error:
              "Payment authorization already submitted. Waiting for final webhook confirmation.",
            purchaseRef: activeOrder.purchase_ref,
          },
          { status: 409 },
        );
      }

      if (!activeOrder.razorpay_order_id) {
        try {
          const recreatedOrder = await createRazorpayOrder({
            amountPaise: toPaise(parseNumeric(activeOrder.total_amount_inr)),
            currency: "INR",
            receipt: activeOrder.purchase_ref,
            notes: {
              purchase_ref: activeOrder.purchase_ref,
              project_id: activeOrder.project_id,
              buyer_id: user.id,
            },
          });

          const { data: updatedActiveData, error: updatedActiveError } = await service
            .from("project_credit_orders")
            .update({
              razorpay_order_id: recreatedOrder.id,
              status: "checkout_opened",
              provider_payload: {
                ...(activeOrder.provider_payload ?? {}),
                razorpay_order: recreatedOrder,
                order_recreated_at: new Date().toISOString(),
              },
            })
            .eq("id", activeOrder.id)
            .select(
              "id, purchase_ref, buyer_user_id, buyer_company_id, seller_user_id, project_id, buyer_company_name_snapshot, project_name_snapshot, reference_id_snapshot, unit_price_inr, quantity, subtotal_inr, gst_rate_percent, gst_amount_inr, total_amount_inr, currency, razorpay_order_id, razorpay_payment_id, razorpay_signature, provider_payload, status, reservation_status, reservation_expires_at, captured_at, failed_at, expired_at, created_at, updated_at",
            )
            .single();

          if (!updatedActiveError && updatedActiveData) {
            const updatedActiveOrder = asOrderRow(updatedActiveData);
            if (updatedActiveOrder) {
              return NextResponse.json(
                buildOrderResponse({
                  keyId: config.razorpayKeyId,
                  order: updatedActiveOrder,
                  reused: true,
                  message: "Recovered and reused your active order.",
                }),
                { status: 200 },
              );
            }
          }
        } catch (error) {
          console.error("payment_order_active_recreate_failed", {
            userId: user.id,
            purchaseRef: activeOrder.purchase_ref,
            reason: error instanceof Error ? error.message : "unknown_error",
          });
        }

        return NextResponse.json(
          {
            error: "Unable to recover active checkout order. Please retry shortly.",
            purchaseRef: activeOrder.purchase_ref,
          },
          { status: 502 },
        );
      }

      return NextResponse.json(
        buildOrderResponse({
          keyId: config.razorpayKeyId,
          order: activeOrder,
          reused: true,
          message:
            quantity !== activeOrder.quantity
              ? "Reused your existing active order for this project."
              : "Reused active order.",
        }),
        { status: 200 },
      );
    }

    const resolvedValuation =
      project.project_type === "solar" ||
      project.project_type === "methane" ||
      project.project_type === "windmill"
        ? await resolveAndPersistProjectAiValuation({
            projectId: project.id,
            status: project.status,
            projectType: project.project_type,
            latitude: project.latitude,
            longitude: project.longitude,
            polygonGeojson: project.polygon_geojson,
            landAreaHectares: project.land_area_hectares,
            satelliteNdviCurrent: project.satellite_ndvi_current,
            satelliteStatus: project.satellite_status,
            satelliteErrorMessage: project.satellite_error_message,
            satelliteLastAttemptedAt: project.satellite_last_attempted_at,
            projectStartDate: project.project_start_date,
            reviewNotes: project.review_notes,
          })
        : null;

    const parsedNotes = parseProjectReviewNotes(project.review_notes);
    const valuation = getNormalizedProjectAiValuation(
      resolvedValuation ?? parsedNotes.submissionMetadata.ai_valuation,
    );

    const valuationCredits =
      valuation.creditsAvailable !== null &&
      Number.isFinite(valuation.creditsAvailable)
        ? Math.floor(valuation.creditsAvailable)
        : null;

    const unitPriceInr =
      valuation.pricePerCreditInr !== null && Number.isFinite(valuation.pricePerCreditInr)
        ? valuation.pricePerCreditInr
        : null;

    if (unitPriceInr === null || unitPriceInr <= 0 || valuationCredits === null) {
      return NextResponse.json(
        {
          error:
            "Project pricing or credits are pending. Payment cannot be initiated.",
        },
        { status: 409 },
      );
    }

    const { data: projectCountersData, error: counterError } = await service
      .from("carbon_projects")
      .select("credits_reserved, credits_sold")
      .eq("id", project.id)
      .maybeSingle();

    if (counterError) {
      console.error("payment_order_project_counter_query_failed", {
        projectId: project.id,
        reason: counterError.message,
      });
      return NextResponse.json(
        { error: "Failed to load project inventory state." },
        { status: 500 },
      );
    }

    const creditsReserved = parseNumeric(projectCountersData?.credits_reserved ?? 0);
    const creditsSold = parseNumeric(projectCountersData?.credits_sold ?? 0);
    const remainingCredits = computeRemainingCredits({
      valuationCredits,
      creditsReserved,
      creditsSold,
    });

    if (remainingCredits === null || remainingCredits <= 0) {
      return NextResponse.json(
        { error: "Credits are sold out for this project." },
        { status: 409 },
      );
    }

    if (quantity > remainingCredits) {
      return NextResponse.json(
        {
          error: `Requested quantity exceeds remaining credits (${remainingCredits}).`,
          remainingCredits,
        },
        { status: 409 },
      );
    }

    const { data: reserveSuccess, error: reserveError } = await service.rpc(
      "zc_reserve_project_credits",
      {
        p_project_id: project.id,
        p_quantity: quantity,
        p_max_credits: valuationCredits,
      },
    );

    if (reserveError) {
      console.error("payment_order_reserve_rpc_failed", {
        projectId: project.id,
        reason: reserveError.message,
      });
      return NextResponse.json(
        { error: "Failed to reserve project credits." },
        { status: 500 },
      );
    }

    if (reserveSuccess !== true) {
      return NextResponse.json(
        { error: "Unable to reserve credits. Please retry with lower quantity." },
        { status: 409 },
      );
    }

    const totals = computeOrderTotals({
      unitPriceInr,
      quantity,
      gstRatePercent: config.gstRatePercent,
    });
    const projectNameSnapshot = project.project_name?.trim() || "Untitled Project";
    const referenceIdSnapshot = getProjectReference(project.id, project.created_at);
    const reservationExpiresAt = new Date(
      Date.now() + config.reservationMinutes * 60 * 1000,
    ).toISOString();

    let insertedOrder: DbOrderRow | null = null;
    let insertErrorMessage: string | null = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const purchaseRef = generatePurchaseRef();
      const { data: insertedData, error: insertError } = await service
        .from("project_credit_orders")
        .insert({
          purchase_ref: purchaseRef,
          buyer_user_id: user.id,
          buyer_company_id: company.id,
          seller_user_id: project.user_id,
          project_id: project.id,
          buyer_company_name_snapshot: buyerCompanyName,
          project_name_snapshot: projectNameSnapshot,
          reference_id_snapshot: referenceIdSnapshot,
          unit_price_inr: unitPriceInr,
          quantity,
          subtotal_inr: totals.subtotalInr,
          gst_rate_percent: config.gstRatePercent,
          gst_amount_inr: totals.gstAmountInr,
          total_amount_inr: totals.totalAmountInr,
          currency: "INR",
          status: "created_reserved",
          reservation_status: "active",
          reservation_expires_at: reservationExpiresAt,
        })
        .select(
          "id, purchase_ref, buyer_user_id, buyer_company_id, seller_user_id, project_id, buyer_company_name_snapshot, project_name_snapshot, reference_id_snapshot, unit_price_inr, quantity, subtotal_inr, gst_rate_percent, gst_amount_inr, total_amount_inr, currency, razorpay_order_id, razorpay_payment_id, razorpay_signature, provider_payload, status, reservation_status, reservation_expires_at, captured_at, failed_at, expired_at, created_at, updated_at",
        )
        .single();

      if (!insertError && insertedData) {
        insertedOrder = asOrderRow(insertedData);
        break;
      }

      if (!isUniqueViolation(insertError?.code)) {
        insertErrorMessage = insertError?.message ?? "insert_failed";
        break;
      }
    }

    if (!insertedOrder) {
      await service.rpc("zc_release_project_credits", {
        p_project_id: project.id,
        p_quantity: quantity,
      });

      console.error("payment_order_insert_failed", {
        userId: user.id,
        projectId: project.id,
        reason: insertErrorMessage ?? "unique_collision_exhausted",
      });
      return NextResponse.json(
        { error: "Failed to create order record." },
        { status: 500 },
      );
    }

    try {
      const razorpayOrder = await createRazorpayOrder({
        amountPaise: toPaise(totals.totalAmountInr),
        currency: "INR",
        receipt: insertedOrder.purchase_ref,
        notes: {
          purchase_ref: insertedOrder.purchase_ref,
          project_id: project.id,
          buyer_id: user.id,
        },
      });

      const { data: updatedData, error: updateError } = await service
        .from("project_credit_orders")
        .update({
          razorpay_order_id: razorpayOrder.id,
          provider_payload: {
            razorpay_order: razorpayOrder,
            result_mode: "checkout_opened",
          },
          status: "checkout_opened",
        })
        .eq("id", insertedOrder.id)
        .select(
          "id, purchase_ref, buyer_user_id, buyer_company_id, seller_user_id, project_id, buyer_company_name_snapshot, project_name_snapshot, reference_id_snapshot, unit_price_inr, quantity, subtotal_inr, gst_rate_percent, gst_amount_inr, total_amount_inr, currency, razorpay_order_id, razorpay_payment_id, razorpay_signature, provider_payload, status, reservation_status, reservation_expires_at, captured_at, failed_at, expired_at, created_at, updated_at",
        )
        .single();

      if (updateError || !updatedData) {
        throw new Error(updateError?.message ?? "failed_to_update_checkout_order");
      }

      const readyOrder = asOrderRow(updatedData);
      if (!readyOrder) {
        throw new Error("failed_to_parse_checkout_order");
      }

      return NextResponse.json(
        buildOrderResponse({
          keyId: config.razorpayKeyId,
          order: readyOrder,
          reused: false,
        }),
        { status: 200 },
      );
    } catch (error) {
      await service.rpc("zc_release_project_credits", {
        p_project_id: project.id,
        p_quantity: quantity,
      });

      await service
        .from("project_credit_orders")
        .update({
          status: "failed",
          reservation_status: "released",
          failed_at: new Date().toISOString(),
          provider_payload: {
            failure_stage: error instanceof RazorpayProviderError ? error.stage : "create_order",
            failure_reason: error instanceof Error ? error.message : "unknown_error",
            provider_status:
              error instanceof RazorpayProviderError ? error.statusCode : null,
            provider_response:
              error instanceof RazorpayProviderError ? error.responseBody : null,
          },
        })
        .eq("id", insertedOrder.id);

      return NextResponse.json(
        {
          error:
            error instanceof RazorpayProviderError
              ? `Razorpay create order failed (${error.statusCode}).`
              : "Failed to initialize Razorpay checkout order.",
        },
        { status: 502 },
      );
    }
  } catch (error) {
    console.error("payment_order_create_unhandled_error", {
      reason: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json(
      {
        error: "Unexpected error while creating payment order.",
      },
      { status: 500 },
    );
  }
}
