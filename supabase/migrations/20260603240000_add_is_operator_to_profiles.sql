-- Add is_operator flag to profiles.
-- Only the service operator should have this set to true.
-- Set via Supabase Studio (service role) only — never exposed to client code.
--
-- Usage:
--   UPDATE public.profiles SET is_operator = true WHERE email = 'operator@example.com';

alter table public.profiles
  add column if not exists is_operator boolean not null default false;

comment on column public.profiles.is_operator is
  'Service operator flag. Set to true via Supabase Studio only. Required to send marketing email campaigns.';
