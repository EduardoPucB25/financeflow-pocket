create table if not exists public.detection_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  match_scope text not null default 'merchant',
  match_value text not null,
  kind text not null default 'expense',
  pocket_id uuid references public.pockets(id) on delete cascade,
  debt_id uuid references public.debts(id) on delete cascade,
  counterparty_id uuid references public.counterparties(id) on delete set null,
  mode text not null default 'ask',
  hit_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, match_scope, match_value)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.detection_rules TO authenticated;
GRANT ALL ON public.detection_rules TO service_role;

alter table public.detection_rules enable row level security;

drop policy if exists "Users manage own detection_rules" on public.detection_rules;
create policy "Users manage own detection_rules"
  on public.detection_rules for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists detection_rules_lookup_idx
  on public.detection_rules (user_id, match_scope, match_value);

drop trigger if exists detection_rules_set_updated_at on public.detection_rules;
create trigger detection_rules_set_updated_at
  before update on public.detection_rules
  for each row execute function public.set_updated_at();

alter table public.profiles
  add column if not exists detection_default_mode text not null default 'ask',
  add column if not exists detection_autopilot boolean not null default false,
  add column if not exists self_aliases text[] not null default '{}'::text[];

alter table public.detected_transactions
  add column if not exists sender_name text,
  add column if not exists is_self_transfer boolean not null default false,
  add column if not exists account_hint text,
  add column if not exists occurred_at timestamptz,
  add column if not exists direction text,
  add column if not exists confidence numeric;

do $$
begin
  alter publication supabase_realtime add table public.detected_transactions;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

alter table public.detected_transactions replica identity full;