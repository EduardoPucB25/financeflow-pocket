
CREATE TABLE public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paddle_transaction_id text NOT NULL,
  paddle_subscription_id text,
  event_type text NOT NULL,
  status text NOT NULL,
  amount_total text,
  currency_code text,
  invoice_url text,
  environment text NOT NULL DEFAULT 'sandbox',
  billed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (paddle_transaction_id, event_type)
);

CREATE INDEX idx_billing_events_user ON public.billing_events(user_id, created_at DESC);

GRANT SELECT ON public.billing_events TO authenticated;
GRANT ALL ON public.billing_events TO service_role;

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own billing events"
  ON public.billing_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages billing events"
  ON public.billing_events FOR ALL
  USING (auth.role() = 'service_role');
