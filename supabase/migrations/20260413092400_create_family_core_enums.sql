do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'family_member_role'
  ) then
    create type public.family_member_role as enum (
      'guardian_admin',
      'guardian',
      'child'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'family_membership_status'
  ) then
    create type public.family_membership_status as enum (
      'active',
      'invited',
      'disabled'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'grant_decision_status'
  ) then
    create type public.grant_decision_status as enum (
      'pending',
      'immediate_cash_requested',
      'invested'
    );
  end if;
end
$$;