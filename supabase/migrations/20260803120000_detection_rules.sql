-- Memoria de asignaciones del asistente de movimientos.
-- Cuando el usuario asigna una detección a un bolsillo/tarjeta y elige
-- "recordar", guardamos aquí la regla para futuras detecciones del mismo
-- comercio (o app). `mode` decide el comportamiento: registrar automático,
-- confirmar con un toque, o preguntar siempre.

create table if not exists public.detection_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  match_scope text not null default 'merchant',      -- 'merchant' | 'package'
  match_value text not null,                          -- normalizado (lower, sin acentos)
  kind text not null default 'expense',              -- income | expense | payment
  pocket_id uuid references public.pockets(id) on delete cascade,
  debt_id uuid references public.debts(id) on delete cascade,
  counterparty_id uuid references public.counterparties(id) on delete set null,
  mode text not null default 'ask',                  -- 'auto' | 'confirm' | 'ask'
  hit_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, match_scope, match_value)
);

alter table public.detection_rules enable row level security;

create policy "Users manage own detection_rules"
  on public.detection_rules
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists detection_rules_lookup_idx
  on public.detection_rules (user_id, match_scope, match_value);
