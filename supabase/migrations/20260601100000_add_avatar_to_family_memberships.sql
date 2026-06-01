-- Add avatar_path and avatar_emoji to family_memberships.
-- avatar_path: Storage object path (not a URL). Signed URL is generated at display time.
-- avatar_emoji: single emoji character chosen by the member or a guardian.

alter table public.family_memberships
  add column if not exists avatar_path  text,
  add column if not exists avatar_emoji text;
