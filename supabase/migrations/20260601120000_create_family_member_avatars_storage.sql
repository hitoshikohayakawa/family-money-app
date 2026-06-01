-- Create private Storage bucket for family member avatars and attach RLS policies.
--
-- Bucket:  family-member-avatars  (private)
-- Path:    family-members/{familyId}/{userId}/{timestamp}.{ext}
-- Limits:  5 MB, jpeg / png / webp only
--
-- RLS summary:
--   SELECT  – any active member of the same family
--   INSERT  – self, OR guardian/guardian_admin uploading for a child in the same family
--   UPDATE  – same as INSERT
--   DELETE  – same as INSERT

-- ── bucket ───────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'family-member-avatars',
  'family-member-avatars',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public             = false,
  file_size_limit    = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- ── RLS policies ─────────────────────────────────────────────────────────────

-- SELECT: same-family members can view avatars
drop policy if exists "family_member_avatars_select" on storage.objects;
create policy "family_member_avatars_select"
on storage.objects for select
to authenticated
using (
  bucket_id = 'family-member-avatars'
  and exists (
    select 1
    from public.family_memberships viewer
    where viewer.user_id   = auth.uid()
      and viewer.status    = 'active'
      and viewer.family_id::text = (storage.foldername(name))[2]
  )
);

-- INSERT: self-upload, OR guardian(+admin) uploading for a child in the same family
drop policy if exists "family_member_avatars_insert" on storage.objects;
create policy "family_member_avatars_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'family-member-avatars'
  and (
    -- own avatar
    auth.uid()::text = (storage.foldername(name))[3]
    -- guardian uploading for child
    or exists (
      select 1
      from public.family_memberships uploader
      join public.family_memberships target
        on  target.family_id  = uploader.family_id
        and target.user_id::text = (storage.foldername(name))[3]
        and target.role::text    = 'child'
        and target.status        = 'active'
      where uploader.user_id        = auth.uid()
        and uploader.status         = 'active'
        and uploader.role::text     in ('guardian_admin', 'guardian')
        and uploader.family_id::text = (storage.foldername(name))[2]
    )
  )
);

-- UPDATE: same rules as INSERT
drop policy if exists "family_member_avatars_update" on storage.objects;
create policy "family_member_avatars_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'family-member-avatars'
  and (
    auth.uid()::text = (storage.foldername(name))[3]
    or exists (
      select 1
      from public.family_memberships uploader
      join public.family_memberships target
        on  target.family_id  = uploader.family_id
        and target.user_id::text = (storage.foldername(name))[3]
        and target.role::text    = 'child'
        and target.status        = 'active'
      where uploader.user_id        = auth.uid()
        and uploader.status         = 'active'
        and uploader.role::text     in ('guardian_admin', 'guardian')
        and uploader.family_id::text = (storage.foldername(name))[2]
    )
  )
);

-- DELETE: same rules as INSERT
drop policy if exists "family_member_avatars_delete" on storage.objects;
create policy "family_member_avatars_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'family-member-avatars'
  and (
    auth.uid()::text = (storage.foldername(name))[3]
    or exists (
      select 1
      from public.family_memberships uploader
      join public.family_memberships target
        on  target.family_id  = uploader.family_id
        and target.user_id::text = (storage.foldername(name))[3]
        and target.role::text    = 'child'
        and target.status        = 'active'
      where uploader.user_id        = auth.uid()
        and uploader.status         = 'active'
        and uploader.role::text     in ('guardian_admin', 'guardian')
        and uploader.family_id::text = (storage.foldername(name))[2]
    )
  )
);
