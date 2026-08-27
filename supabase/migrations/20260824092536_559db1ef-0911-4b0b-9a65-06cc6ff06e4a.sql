ALTER TABLE public.providers_config
  ADD COLUMN IF NOT EXISTS payment_number text,
  ADD COLUMN IF NOT EXISTS out_of_balance boolean NOT NULL DEFAULT false;