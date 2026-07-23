CREATE TABLE public.detected_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(14,2),
  currency TEXT NOT NULL DEFAULT 'MXN',
  merchant TEXT,
  type TEXT NOT NULL DEFAULT 'unknown',
  raw_text TEXT NOT NULL,
  package_name TEXT NOT NULL,
  notification_title TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending',
  approved_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  dedupe_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT detected_transactions_status_check CHECK (status IN ('pending','approved','rejected')),
  CONSTRAINT detected_transactions_type_check CHECK (type IN ('charge','credit','transfer','payment','unknown'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.detected_transactions TO authenticated;
GRANT ALL ON public.detected_transactions TO service_role;

ALTER TABLE public.detected_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own detections" ON public.detected_transactions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX detected_transactions_user_status_idx
  ON public.detected_transactions (user_id, status, detected_at DESC);

CREATE UNIQUE INDEX detected_transactions_dedupe_idx
  ON public.detected_transactions (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE TRIGGER detected_transactions_set_updated_at
  BEFORE UPDATE ON public.detected_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();