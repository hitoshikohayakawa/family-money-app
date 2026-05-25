create or replace function public.resolve_family_invite_status(
  membership_exists boolean,
  stored_status text,
  target_accepted_at timestamptz,
  target_expires_at timestamptz
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when coalesce(membership_exists, false) then 'accepted'
    when target_accepted_at is not null then 'accepted'
    when stored_status = 'revoked' then 'revoked'
    when target_expires_at <= now() then 'expired'
    else 'pending'
  end;
$$;

revoke all on function public.resolve_family_invite_status(boolean, text, timestamptz, timestamptz) from public;
grant execute on function public.resolve_family_invite_status(boolean, text, timestamptz, timestamptz) to anon, authenticated;
