create or replace function public.list_family_invites_for_current_user()
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
