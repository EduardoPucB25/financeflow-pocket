ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payday_days integer[] DEFAULT ARRAY[15,31],
  ADD COLUMN IF NOT EXISTS payday_offset_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payday_weekend_to_friday boolean NOT NULL DEFAULT false;