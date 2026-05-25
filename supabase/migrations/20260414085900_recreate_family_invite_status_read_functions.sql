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

drop function if exists public.list_family_invites_for_current_user();

create function public.list_family_invites_for_current_user()
returns table (
  id uuid,
  email text,
  role text,
  stored_status text,
  effective_status text,
  created_at timestamptz,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with current_membership as (
    select fms.family_id
    from public.family_memberships fms
    where fms.user_id = auth.uid()
      and fms.status = 'active'::public.family_membership_status
    order by fms.created_at asc
    limit 1
  ),
  invites_with_membership as (
    select
      fi.id,
      fi.email,
      fi.role,
      fi.status as stored_status,
      fi.accepted_at,
      fi.expires_at,
      fi.created_at,
      exists (
        select 1
        from public.profiles p
        join public.family_memberships fms
          on fms.user_id = p.id
        where lower(p.email) = lower(fi.email)
          and fms.family_id = fi.family_id
          and fms.status = 'active'::public.family_membership_status
      ) as membership_exists
    from public.family_invites fi
    join current_membership cm
      on cm.family_id = fi.family_id
  )
  select
    iwm.id,
    iwm.email,
    iwm.role,
    iwm.stored_status,
    public.resolve_family_invite_status(
      iwm.membership_exists,
      iwm.stored_status,
      iwm.accepted_at,
      iwm.expires_at
    ) as effective_status,
    iwm.created_at,
    iwm.expires_at
  from invites_with_membership iwm
  order by iwm.created_at desc;
$$;

revoke all on function public.list_family_invites_for_current_user() from public;
grant execute on function public.list_family_invites_for_current_user() to authenticated;

drop function if exists public.get_family_invite_details(uuid);

create function public.get_family_invite_details(target_invite_id uuid)
returns table (
  invite_id uuid,
  email text,
  role text,
  stored_status text,
  effective_status text,
  expires_at timestamptz,
  membership_exists boolean,
  is_expired boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_record public.family_invites%rowtype;
  invite_membership_exists boolean;
  normalized_status text;
begin
  select *
    into invite_record
  from public.family_invites
  where id = target_invite_id;

  if invite_record.id is null then
    raise exception 'Invite not found';
  end if;

  select exists (
    select 1
    from public.profiles p
    join public.family_memberships fms
      on fms.user_id = p.id
    where lower(p.email) = lower(invite_record.email)
      and fms.family_id = invite_record.family_id
      and fms.status = 'active'::public.family_membership_status
  )
    into invite_membership_exists;

  normalized_status := public.resolve_family_invite_status(
    invite_membership_exists,
    invite_record.status,
    invite_record.accepted_at,
    invite_record.expires_at
  );

  return query
  select
    invite_record.id,
    invite_record.email,
    invite_record.role,
    invite_record.status,
    normalized_status,
    invite_record.expires_at,
    invite_membership_exists,
    (normalized_status = 'expired') as is_expired;
end;
$$;

revoke all on function public.get_family_invite_details(uuid) from public;
grant execute on function public.get_family_invite_details(uuid) to anon, authenticated;
