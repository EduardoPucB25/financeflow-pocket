
# FinFlow Copilot — MVP Plan

Bilingual approach: user-facing text in **Spanish**, code/components in **English**. Email + password auth only. Dark financial theme.

## 1. Backend (Lovable Cloud / Supabase)

Enable Lovable Cloud, then one migration creating:

- `profiles` — id (FK auth.users), full_name, biweekly_salary, salary_frequency, annual_yield_rate, timestamps. Auto-created via `handle_new_user` trigger on `auth.users`.
- `pockets` — user's allocation buckets (Growth/Stability/Values/Essential + custom), with target_percentage, current_balance, is_locked_savings, color.
- `credit_cards` — card_name, credit_limit, current_balance, cutoff_day, due_day, status. Includes computed grace-period info in UI.
- `scheduled_flows` — recurring deposits/withdrawals tied to a pocket, with frequency + next_execution_date.
- `yield_simulations` — saved compound-interest scenarios.

RLS: every table `user_id = auth.uid()` for select/insert/update/delete. GRANTs to `authenticated` + `service_role`. Roles table not needed for MVP (single-user scope).

Seed on first login (client-side, idempotent): create the default 4 pockets (Growth 25%, Valores 20%, Stability 15%, Essential 40%) if none exist.

## 2. Auth

- `/auth` public route — email/password sign in + sign up (Spanish UI). Uses browser `supabase` client with `emailRedirectTo: window.location.origin`.
- Managed `_authenticated/route.tsx` gates the app.
- Header shows user email + "Cerrar sesión" with proper sign-out hygiene (cancel queries, clear cache, replace nav).

## 3. Routes

- `/` — public landing: brief pitch + "Entrar" CTA (redirects to `/auth` or `/dashboard` if signed in).
- `/auth` — login/signup.
- `/_authenticated/dashboard` — main overview (default post-login).
- `/_authenticated/pockets` — CRUD for pockets, allocation ring chart, rebalance helper.
- `/_authenticated/cards` — credit cards list with grace-period countdown + "Invisible Cash" available.
- `/_authenticated/flows` — scheduled inflows/outflows calendar list.
- `/_authenticated/simulator` — daily-compound yield simulator with Recharts line chart; save scenarios.
- `/_authenticated/settings` — profile: salary, frequency, annual yield rate.

Each route defines its own `head()` (Spanish titles/descriptions).

## 4. Core Calculations (client-side utilities)

- **Daily compound yield**: `balance * (1 + rate/365)^days`; simulator supports periodic deposits/withdrawals iterated day-by-day.
- **Grace period / Invisible Cash**: given `cutoff_day` + `due_day`, compute days until cutoff, days until due, and max float window; show "dinero disponible sin intereses" per card.
- **Allocation check**: sum of pocket percentages should equal 100; warn if not.
- **Per-paycheck distribution**: given biweekly_salary + pockets, show peso amount per pocket.

## 5. Dashboard

Mobile-first single scroll, desktop 3-column grid:

- Hero: total balance across pockets + next payday countdown.
- Pocket allocation ring (Recharts PieChart) + list with balances vs targets.
- Credit cards strip: grace-period progress bars + total invisible cash.
- Upcoming scheduled flows (next 7/14 days).
- Yield projection sparkline (30/90/365 days at current rate).

## 6. Design System

Update `src/styles.css`:
- Force dark theme by default (add `dark` class to `<html>` in root shell).
- Tokens: background `#0F172A`, card `#1E293B`, primary emerald `#10B981`, accent violet `#8B5CF6`, warning amber `#F59E0B`, destructive rose `#EF4444`, muted slate.
- All colors as `oklch` semantic tokens in `@theme inline`.

Components use existing shadcn/ui (Card, Button, Input, Dialog, Tabs, Progress, Chart wrappers).

## 7. Out of scope (later iterations)

Survival algorithm, Notion CSV/JSON export, advanced projections library, realtime multi-device sync, keyboard shortcuts, week/month recurring engine execution (MVP shows next dates only; no cron job runs mutations).

## 8. Technical notes

- TanStack Query for data fetching (`ensureQueryData` in loaders under `_authenticated/`, `useSuspenseQuery` in components).
- All mutations via browser supabase client (RLS enforces ownership); no server functions needed for MVP.
- Forms with react-hook-form + zod.
- Recharts for pie + line charts.
- Sidebar collapsible on desktop; bottom tab nav on mobile.
