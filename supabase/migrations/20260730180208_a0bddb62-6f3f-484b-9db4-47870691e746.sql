CREATE TABLE public.debt_statements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  debt_id uuid NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  period_year int NOT NULL CHECK (period_year BETWEEN 2000 AND 2100),
  period_month int NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  amount numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at timestamptz,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (debt_id, period_year, period_month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.debt_statements TO authenticated;
GRANT ALL ON public.debt_statements TO service_role;

ALTER TABLE public.debt_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own debt_statements" ON public.debt_statements FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_debt_statements_updated_at BEFORE UPDATE ON public.debt_statements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_debt_statements_user_due ON public.debt_statements (user_id, due_date);
CREATE INDEX idx_debt_statements_debt ON public.debt_statements (debt_id);