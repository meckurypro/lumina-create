ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS creator_type text,
  ADD COLUMN IF NOT EXISTS team_role text,
  ADD COLUMN IF NOT EXISTS primary_use_case text,
  ADD COLUMN IF NOT EXISTS referral_source text;