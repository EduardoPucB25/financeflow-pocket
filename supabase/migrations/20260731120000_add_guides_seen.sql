ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS guides_seen text[] NOT NULL DEFAULT '{}';
