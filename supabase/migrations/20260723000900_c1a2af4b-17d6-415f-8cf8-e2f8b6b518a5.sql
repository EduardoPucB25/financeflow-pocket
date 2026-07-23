
-- 1) DEBTS TABLE (supersedes credit_cards)
CREATE TABLE public.debts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  debt_type TEXT NOT NULL DEFAULT 'card',
  current_balance NUMERIC NOT NULL DEFAULT 0,
  credit_limit NUMERIC,
  interest_rate NUMERIC NOT NULL DEFAULT 0,
  minimum_payment NUMERIC NOT NULL DEFAULT 0,
  cutoff_day INTEGER,
  due_day INTEGER,
  target_payoff_date DATE,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.debts TO authenticated;
GRANT ALL ON public.debts TO service_role;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own debts" ON public.debts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_debts_updated_at BEFORE UPDATE ON public.debts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Migrate existing credit_cards into debts
INSERT INTO public.debts (user_id, name, debt_type, current_balance, credit_limit, cutoff_day, due_day, status, created_at, updated_at)
SELECT user_id, card_name, 'card', current_balance, credit_limit, cutoff_day, due_day, status, created_at, updated_at
FROM public.credit_cards;

DROP TABLE public.credit_cards;

-- 2) COUNTERPARTIES
CREATE TABLE public.counterparties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'person',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.counterparties TO authenticated;
GRANT ALL ON public.counterparties TO service_role;
ALTER TABLE public.counterparties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own counterparties" ON public.counterparties FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_counterparties_updated_at BEFORE UPDATE ON public.counterparties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) TRANSACTIONS
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  amount NUMERIC NOT NULL,
  kind TEXT NOT NULL DEFAULT 'expense',
  counterparty_id UUID REFERENCES public.counterparties(id) ON DELETE SET NULL,
  description TEXT NOT NULL DEFAULT '',
  purpose TEXT,
  pocket_id UUID REFERENCES public.pockets(id) ON DELETE SET NULL,
  debt_id UUID REFERENCES public.debts(id) ON DELETE SET NULL,
  include_in_totals BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own transactions" ON public.transactions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_transactions_updated_at BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_transactions_user_date ON public.transactions (user_id, occurred_at DESC);
CREATE INDEX idx_transactions_pocket ON public.transactions (pocket_id);
CREATE INDEX idx_transactions_debt ON public.transactions (debt_id);
