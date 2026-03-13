-- ZeroCarbon payment/order ledger + credit reservation state.
-- Run manually in Supabase SQL Editor.
-- Idempotent migration.

ALTER TABLE public.carbon_projects
  ADD COLUMN IF NOT EXISTS credits_reserved integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credits_sold integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'carbon_projects_credits_non_negative_check'
  ) THEN
    ALTER TABLE public.carbon_projects
      ADD CONSTRAINT carbon_projects_credits_non_negative_check
      CHECK (
        credits_reserved >= 0
        AND credits_sold >= 0
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.project_credit_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_ref text NOT NULL UNIQUE,
  buyer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  buyer_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  seller_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.carbon_projects(id) ON DELETE CASCADE,

  buyer_company_name_snapshot text NOT NULL,
  project_name_snapshot text NOT NULL,
  reference_id_snapshot text NOT NULL,

  unit_price_inr numeric(18, 2) NOT NULL,
  quantity integer NOT NULL,
  subtotal_inr numeric(18, 2) NOT NULL,
  gst_rate_percent numeric(6, 3) NOT NULL DEFAULT 2.5,
  gst_amount_inr numeric(18, 2) NOT NULL,
  total_amount_inr numeric(18, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'INR',

  razorpay_order_id text,
  razorpay_payment_id text,
  razorpay_signature text,
  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  status text NOT NULL DEFAULT 'created_reserved',
  reservation_status text NOT NULL DEFAULT 'active',
  reservation_expires_at timestamptz,
  captured_at timestamptz,
  failed_at timestamptz,
  expired_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_credit_orders_status_check'
  ) THEN
    ALTER TABLE public.project_credit_orders
      ADD CONSTRAINT project_credit_orders_status_check
      CHECK (
        status IN (
          'created_reserved',
          'checkout_opened',
          'authorized_pending_webhook',
          'captured',
          'failed',
          'cancelled',
          'expired'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_credit_orders_reservation_status_check'
  ) THEN
    ALTER TABLE public.project_credit_orders
      ADD CONSTRAINT project_credit_orders_reservation_status_check
      CHECK (
        reservation_status IN ('active', 'released', 'finalized')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_credit_orders_quantity_check'
  ) THEN
    ALTER TABLE public.project_credit_orders
      ADD CONSTRAINT project_credit_orders_quantity_check
      CHECK (quantity > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_credit_orders_amount_non_negative_check'
  ) THEN
    ALTER TABLE public.project_credit_orders
      ADD CONSTRAINT project_credit_orders_amount_non_negative_check
      CHECK (
        unit_price_inr >= 0
        AND subtotal_inr >= 0
        AND gst_rate_percent >= 0
        AND gst_amount_inr >= 0
        AND total_amount_inr >= 0
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS project_credit_orders_buyer_created_idx
  ON public.project_credit_orders(buyer_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS project_credit_orders_seller_created_idx
  ON public.project_credit_orders(seller_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS project_credit_orders_project_created_idx
  ON public.project_credit_orders(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS project_credit_orders_status_created_idx
  ON public.project_credit_orders(status, created_at DESC);

CREATE INDEX IF NOT EXISTS project_credit_orders_reservation_idx
  ON public.project_credit_orders(project_id, reservation_status, reservation_expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS project_credit_orders_razorpay_order_id_idx
  ON public.project_credit_orders(razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.project_payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.project_credit_orders(id) ON DELETE CASCADE,
  provider_event_id text,
  source text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS project_payment_events_provider_event_id_idx
  ON public.project_payment_events(provider_event_id)
  WHERE provider_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS project_payment_events_order_created_idx
  ON public.project_payment_events(order_id, created_at DESC);

ALTER TABLE public.project_credit_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_payment_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'project_credit_orders'
      AND policyname = 'Project credit orders buyer/seller read'
  ) THEN
    CREATE POLICY "Project credit orders buyer/seller read"
      ON public.project_credit_orders
      FOR SELECT
      TO authenticated
      USING (buyer_user_id = auth.uid() OR seller_user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'project_payment_events'
      AND policyname = 'Project payment events buyer/seller read'
  ) THEN
    CREATE POLICY "Project payment events buyer/seller read"
      ON public.project_payment_events
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.project_credit_orders pco
          WHERE pco.id = order_id
            AND (pco.buyer_user_id = auth.uid() OR pco.seller_user_id = auth.uid())
        )
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.zc_reserve_project_credits(
  p_project_id uuid,
  p_quantity integer,
  p_max_credits integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows integer := 0;
BEGIN
  IF p_project_id IS NULL OR p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN FALSE;
  END IF;

  UPDATE public.carbon_projects cp
  SET credits_reserved = cp.credits_reserved + p_quantity
  WHERE cp.id = p_project_id
    AND cp.status = 'verified'
    AND GREATEST(COALESCE(p_max_credits, 0), 0) >= (cp.credits_sold + cp.credits_reserved + p_quantity);

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.zc_release_project_credits(
  p_project_id uuid,
  p_quantity integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quantity integer := GREATEST(COALESCE(p_quantity, 0), 0);
  v_released integer := 0;
BEGIN
  IF p_project_id IS NULL OR v_quantity <= 0 THEN
    RETURN 0;
  END IF;

  WITH locked AS (
    SELECT id, credits_reserved
    FROM public.carbon_projects
    WHERE id = p_project_id
    FOR UPDATE
  ),
  updated AS (
    UPDATE public.carbon_projects cp
    SET credits_reserved = GREATEST(0, locked.credits_reserved - v_quantity)
    FROM locked
    WHERE cp.id = locked.id
    RETURNING LEAST(locked.credits_reserved, v_quantity) AS released
  )
  SELECT COALESCE(SUM(released), 0)::integer INTO v_released
  FROM updated;

  RETURN v_released;
END;
$$;

CREATE OR REPLACE FUNCTION public.zc_finalize_project_sale(
  p_project_id uuid,
  p_quantity integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quantity integer := GREATEST(COALESCE(p_quantity, 0), 0);
  v_finalized integer := 0;
BEGIN
  IF p_project_id IS NULL OR v_quantity <= 0 THEN
    RETURN 0;
  END IF;

  WITH locked AS (
    SELECT id, credits_reserved
    FROM public.carbon_projects
    WHERE id = p_project_id
    FOR UPDATE
  ),
  updated AS (
    UPDATE public.carbon_projects cp
    SET
      credits_reserved = GREATEST(0, locked.credits_reserved - v_quantity),
      credits_sold = cp.credits_sold + LEAST(locked.credits_reserved, v_quantity)
    FROM locked
    WHERE cp.id = locked.id
    RETURNING LEAST(locked.credits_reserved, v_quantity) AS finalized
  )
  SELECT COALESCE(SUM(finalized), 0)::integer INTO v_finalized
  FROM updated;

  RETURN v_finalized;
END;
$$;

CREATE OR REPLACE FUNCTION public.zc_expire_project_reservations(
  p_project_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_released integer := 0;
BEGIN
  WITH expired AS (
    UPDATE public.project_credit_orders pco
    SET
      status = 'expired',
      reservation_status = 'released',
      expired_at = now(),
      updated_at = now()
    WHERE pco.reservation_status = 'active'
      AND pco.reservation_expires_at IS NOT NULL
      AND pco.reservation_expires_at <= now()
      AND pco.status IN ('created_reserved', 'checkout_opened', 'authorized_pending_webhook')
      AND (p_project_id IS NULL OR pco.project_id = p_project_id)
    RETURNING pco.project_id, pco.quantity
  ),
  released_per_project AS (
    SELECT project_id, COALESCE(SUM(quantity), 0)::integer AS qty
    FROM expired
    GROUP BY project_id
  ),
  updated_projects AS (
    UPDATE public.carbon_projects cp
    SET credits_reserved = GREATEST(0, cp.credits_reserved - rpp.qty)
    FROM released_per_project rpp
    WHERE cp.id = rpp.project_id
    RETURNING rpp.qty
  )
  SELECT COALESCE(SUM(qty), 0)::integer INTO v_total_released
  FROM updated_projects;

  RETURN v_total_released;
END;
$$;

GRANT EXECUTE ON FUNCTION public.zc_reserve_project_credits(uuid, integer, integer)
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.zc_release_project_credits(uuid, integer)
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.zc_finalize_project_sale(uuid, integer)
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.zc_expire_project_reservations(uuid)
  TO authenticated, service_role;

