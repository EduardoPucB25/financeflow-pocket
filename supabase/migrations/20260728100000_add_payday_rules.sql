ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payday_days smallint[],
  ADD COLUMN IF NOT EXISTS payday_offset_days smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payday_weekend_to_friday boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_payday_days_valid CHECK (
    payday_days IS NULL
    OR (
      array_length(payday_days, 1) BETWEEN 1 AND 4
      AND payday_days <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,
                               16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31]::smallint[]
    )
  ),
  ADD CONSTRAINT profiles_payday_offset_valid CHECK (payday_offset_days BETWEEN 0 AND 5);
