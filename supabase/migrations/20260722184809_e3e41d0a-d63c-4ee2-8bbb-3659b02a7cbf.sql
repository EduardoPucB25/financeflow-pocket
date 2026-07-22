
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  biweekly_salary NUMERIC(12,2) NOT NULL DEFAULT 5600.00,
  salary_frequency TEXT NOT NULL DEFAULT 'biweekly',
  annual_yield_rate NUMERIC(6,3) NOT NULL DEFAULT 15.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own profile" ON public.profiles FOR ALL
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Pockets
CREATE TABLE public.pockets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_percentage NUMERIC(6,2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_locked_savings BOOLEAN NOT NULL DEFAULT false,
  color TEXT NOT NULL DEFAULT '#10B981',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pockets TO authenticated;
GRANT ALL ON public.pockets TO service_role;
ALTER TABLE public.pockets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own pockets" ON public.pockets FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX pockets_user_idx ON public.pockets(user_id);

-- Credit cards
CREATE TABLE public.credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_name TEXT NOT NULL,
  credit_limit NUMERIC(12,2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  cutoff_day INTEGER NOT NULL CHECK (cutoff_day BETWEEN 1 AND 31),
  due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_cards TO authenticated;
GRANT ALL ON public.credit_cards TO service_role;
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cards" ON public.credit_cards FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX credit_cards_user_idx ON public.credit_cards(user_id);

-- Scheduled flows
CREATE TABLE public.scheduled_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pocket_id UUID REFERENCES public.pockets(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  flow_type TEXT NOT NULL CHECK (flow_type IN ('deposit','withdrawal')),
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly','biweekly','monthly','one_time')),
  day_of_week INTEGER CHECK (day_of_week BETWEEN 1 AND 7),
  day_of_month INTEGER CHECK (day_of_month BETWEEN 1 AND 31),
  next_execution_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_flows TO authenticated;
GRANT ALL ON public.scheduled_flows TO service_role;
ALTER TABLE public.scheduled_flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own flows" ON public.scheduled_flows FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX scheduled_flows_user_idx ON public.scheduled_flows(user_id);

-- Yield simulations
CREATE TABLE public.yield_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  initial_balance NUMERIC(12,2) NOT NULL,
  annual_rate NUMERIC(6,3) NOT NULL,
  deposit_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  deposit_freq TEXT NOT NULL DEFAULT 'biweekly',
  withdrawal_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  withdrawal_freq TEXT NOT NULL DEFAULT 'weekly',
  horizon_months INTEGER NOT NULL DEFAULT 12,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.yield_simulations TO authenticated;
GRANT ALL ON public.yield_simulations TO service_role;
ALTER TABLE public.yield_simulations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own simulations" ON public.yield_simulations FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX yield_simulations_user_idx ON public.yield_simulations(user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER pockets_updated BEFORE UPDATE ON public.pockets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER credit_cards_updated BEFORE UPDATE ON public.credit_cards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER scheduled_flows_updated BEFORE UPDATE ON public.scheduled_flows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
