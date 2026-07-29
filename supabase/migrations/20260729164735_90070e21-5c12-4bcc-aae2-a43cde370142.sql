ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS statement_cutoff date;
CREATE INDEX IF NOT EXISTS transactions_debt_statement_idx ON public.transactions (debt_id, statement_cutoff);