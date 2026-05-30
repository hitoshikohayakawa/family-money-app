-- auth.users に INSERT されたとき public.profiles を自動作成するトリガー。
-- SECURITY DEFINER で動作するため RLS はバイパスされる。
-- display_name は nullable のため raw_user_meta_data から取れなければ null のまま。
-- 既存 profiles がある場合は何もしない（on conflict (id) do nothing）。

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'display_name'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'auth.users INSERT 時に public.profiles を自動作成する。SECURITY DEFINER。';

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();

-- 既存ユーザーの backfill: profiles が存在しない auth.users のみ対象。
-- 既存 profiles は一切更新しない。
insert into public.profiles (id, email, display_name)
select
  u.id,
  u.email,
  u.raw_user_meta_data->>'display_name'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
  and u.email is not null
on conflict (id) do nothing;
