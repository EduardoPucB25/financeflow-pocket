ALTER TABLE public.pockets
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'spending',
  ADD COLUMN IF NOT EXISTS accessibility text NOT NULL DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS earns_yield boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS yield_rate numeric,
  ADD COLUMN IF NOT EXISTS yield_start_date date,
  ADD COLUMN IF NOT EXISTS yield_base_balance numeric,
  ADD COLUMN IF NOT EXISTS spend_limit_daily numeric,
  ADD COLUMN IF NOT EXISTS spend_limit_weekly numeric,
  ADD COLUMN IF NOT EXISTS spend_limit_monthly numeric;

ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS statement_balance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spend_limit_daily numeric,
  ADD COLUMN IF NOT EXISTS spend_limit_weekly numeric,
  ADD COLUMN IF NOT EXISTS spend_limit_monthly numeric,
  ADD COLUMN IF NOT EXISTS auto_apply_transactions boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS global_spend_limit_monthly numeric;

UPDATE public.pockets SET accessibility = 'locked', purpose = 'savings' WHERE is_locked_savings = true;

CREATE OR REPLACE FUNCTION public.apply_tx_effects(
  _kind text,
  _amount numeric,
  _pocket_id uuid,
  _debt_id uuid,
  _include boolean,
  _sign numeric
) RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  amt numeric := COALESCE(_amount, 0) * _sign;
BEGIN
  IF NOT COALESCE(_include, true) OR amt = 0 THEN
    RETURN;
  END IF;

  IF _kind = 'income' THEN
    IF _pocket_id IS NOT NULL THEN
      UPDATE public.pockets SET current_balance = current_balance + amt WHERE id = _pocket_id;
    END IF;
  ELSIF _kind = 'expense' THEN
    IF _pocket_id IS NOT NULL THEN
      UPDATE public.pockets SET current_balance = current_balance - amt WHERE id = _pocket_id;
    END IF;
    IF _debt_id IS NOT NULL THEN
      UPDATE public.debts SET current_balance = current_balance + amt
      WHERE id = _debt_id AND auto_apply_transactions = true;
    END IF;
  ELSIF _kind = 'payment' THEN
    IF _pocket_id IS NOT NULL THEN
      UPDATE public.pockets SET current_balance = current_balance - amt WHERE id = _pocket_id;
    END IF;
    IF _debt_id IS NOT NULL THEN
      UPDATE public.debts SET current_balance = current_balance - amt
      WHERE id = _debt_id AND auto_apply_transactions = true;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.tx_balance_sync() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.apply_tx_effects(NEW.kind, NEW.amount, NEW.pocket_id, NEW.debt_id, NEW.include_in_totals, 1);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.apply_tx_effects(OLD.kind, OLD.amount, OLD.pocket_id, OLD.debt_id, OLD.include_in_totals, -1);
    PERFORM public.apply_tx_effects(NEW.kind, NEW.amount, NEW.pocket_id, NEW.debt_id, NEW.include_in_totals, 1);
    RETURN NEW;
  ELSE
    PERFORM public.apply_tx_effects(OLD.kind, OLD.amount, OLD.pocket_id, OLD.debt_id, OLD.include_in_totals, -1);
    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_tx_balance_sync ON public.transactions;
CREATE TRIGGER trg_tx_balance_sync
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.tx_balance_sync();