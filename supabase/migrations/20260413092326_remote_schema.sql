


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."create_family_with_owner_membership"("input_family_name" "text") RETURNS TABLE("family_id" "uuid", "family_name" "text", "role" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  current_user_id uuid := auth.uid();
  normalized_family_name text := trim(coalesce(input_family_name, ''));
  created_family public.families%rowtype;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if normalized_family_name = '' then
    raise exception 'Family name is required';
  end if;

  if exists (
    select 1
    from public.family_members
    where user_id = current_user_id
  ) then
    raise exception 'User already belongs to a family';
  end if;

  insert into public.families (
    family_name,
    created_by_user_id
  )
  values (
    normalized_family_name,
    current_user_id
  )
  returning * into created_family;

  insert into public.family_members (
    family_id,
    user_id,
    role
  )
  values (
    created_family.id,
    current_user_id,
    'guardian_admin'
  );

  return query
  select created_family.id, created_family.family_name, 'guardian_admin'::text;
end;
$$;


ALTER FUNCTION "public"."create_family_with_owner_membership"("input_family_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_family_invite_details"("target_invite_id" "uuid") RETURNS TABLE("invite_id" "uuid", "email" "text", "role" "text", "status" "text", "expires_at" timestamp with time zone, "is_expired" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  invite_record public.family_invites%rowtype;
begin
  select *
    into invite_record
  from public.family_invites
  where id = target_invite_id;

  if invite_record.id is null then
    raise exception 'Invite not found';
  end if;

  return query
  select
    invite_record.id,
    invite_record.email,
    invite_record.role,
    invite_record.status,
    invite_record.expires_at,
    (invite_record.status = 'expired' or invite_record.expires_at <= now()) as is_expired;
end;
$$;


ALTER FUNCTION "public"."get_family_invite_details"("target_invite_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_family_members_for_current_user"() RETURNS TABLE("family_id" "uuid", "user_id" "uuid", "role" "text", "email" "text", "display_name" "text", "display_label" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  current_user_id uuid := auth.uid();
  current_family_id uuid;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select fm.family_id
    into current_family_id
  from public.family_members fm
  where fm.user_id = current_user_id
  limit 1;

  if current_family_id is null then
    return;
  end if;

  return query
  select
    fm.family_id,
    fm.user_id,
    fm.role,
    p.email,
    p.display_name,
    coalesce(nullif(p.display_name, ''), p.email, fm.user_id::text) as display_label
  from public.family_members fm
  left join public.profiles p
    on p.id = fm.user_id
  where fm.family_id = current_family_id
  order by
    case fm.role
      when 'guardian_admin' then 1
      when 'guardian' then 2
      when 'child' then 3
      else 4
    end,
    coalesce(nullif(p.display_name, ''), p.email, fm.user_id::text);
end;
$$;


ALTER FUNCTION "public"."list_family_members_for_current_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_family_invite"("target_invite_id" "uuid") RETURNS TABLE("invite_id" "uuid", "status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  current_user_id uuid := auth.uid();
  invite_record public.family_invites%rowtype;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
    into invite_record
  from public.family_invites
  where id = target_invite_id;

  if invite_record.id is null then
    raise exception 'Invite not found';
  end if;

  if invite_record.status <> 'pending' then
    raise exception 'Only pending invites can be revoked';
  end if;

  if not exists (
    select 1
    from public.family_members fm
    where fm.family_id = invite_record.family_id
      and fm.user_id = current_user_id
      and fm.role = 'guardian_admin'
  ) then
    raise exception 'Only guardian_admin can revoke invites';
  end if;

  update public.family_invites
  set status = 'revoked'
  where id = invite_record.id;

  return query
  select invite_record.id, 'revoked'::text;
end;
$$;


ALTER FUNCTION "public"."revoke_family_invite"("target_invite_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."families" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "family_name" "text" NOT NULL,
    "created_by_user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."families" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."family_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "family_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "invited_by_user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "family_invites_check" CHECK (((("status" = 'accepted'::"text") AND ("accepted_at" IS NOT NULL)) OR ("status" <> 'accepted'::"text"))),
    CONSTRAINT "family_invites_role_check" CHECK (("role" = ANY (ARRAY['guardian'::"text", 'child'::"text"]))),
    CONSTRAINT "family_invites_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'expired'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."family_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."family_members" (
    "family_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "family_members_role_check" CHECK (("role" = ANY (ARRAY['guardian_admin'::"text", 'guardian'::"text", 'child'::"text"])))
);


ALTER TABLE "public"."family_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "display_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."families"
    ADD CONSTRAINT "families_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."family_invites"
    ADD CONSTRAINT "family_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_pkey" PRIMARY KEY ("family_id", "user_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



CREATE INDEX "families_created_by_user_id_idx" ON "public"."families" USING "btree" ("created_by_user_id");



CREATE INDEX "family_invites_family_id_idx" ON "public"."family_invites" USING "btree" ("family_id");



CREATE INDEX "family_invites_invited_by_user_id_idx" ON "public"."family_invites" USING "btree" ("invited_by_user_id");



CREATE UNIQUE INDEX "family_invites_pending_unique_idx" ON "public"."family_invites" USING "btree" ("family_id", "lower"("email")) WHERE ("status" = 'pending'::"text");



CREATE INDEX "family_invites_status_idx" ON "public"."family_invites" USING "btree" ("status");



CREATE INDEX "family_members_family_id_idx" ON "public"."family_members" USING "btree" ("family_id");



CREATE INDEX "family_members_user_id_idx" ON "public"."family_members" USING "btree" ("user_id");



ALTER TABLE ONLY "public"."families"
    ADD CONSTRAINT "families_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."family_invites"
    ADD CONSTRAINT "family_invites_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."family_invites"
    ADD CONSTRAINT "family_invites_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."families" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "families_insert_creator_only" ON "public"."families" FOR INSERT TO "authenticated" WITH CHECK (("created_by_user_id" = "auth"."uid"()));



CREATE POLICY "families_select_member_or_creator" ON "public"."families" FOR SELECT TO "authenticated" USING ((("created_by_user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."family_members" "fm"
  WHERE (("fm"."family_id" = "families"."id") AND ("fm"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."family_invites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "family_invites_insert_guardian_admin" ON "public"."family_invites" FOR INSERT TO "authenticated" WITH CHECK ((("invited_by_user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."family_members" "fm"
  WHERE (("fm"."family_id" = "family_invites"."family_id") AND ("fm"."user_id" = "auth"."uid"()) AND ("fm"."role" = 'guardian_admin'::"text"))))));



CREATE POLICY "family_invites_select_family_members" ON "public"."family_invites" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."family_members" "fm"
  WHERE (("fm"."family_id" = "family_invites"."family_id") AND ("fm"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."family_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "family_members_insert_own_rows" ON "public"."family_members" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "family_members_select_own_rows" ON "public"."family_members" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































REVOKE ALL ON FUNCTION "public"."create_family_with_owner_membership"("input_family_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_family_with_owner_membership"("input_family_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_family_with_owner_membership"("input_family_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_family_with_owner_membership"("input_family_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_family_invite_details"("target_invite_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_family_invite_details"("target_invite_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_family_invite_details"("target_invite_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_family_invite_details"("target_invite_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_family_members_for_current_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_family_members_for_current_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."list_family_members_for_current_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_family_members_for_current_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."revoke_family_invite"("target_invite_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."revoke_family_invite"("target_invite_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."revoke_family_invite"("target_invite_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_family_invite"("target_invite_id" "uuid") TO "service_role";


















GRANT ALL ON TABLE "public"."families" TO "anon";
GRANT ALL ON TABLE "public"."families" TO "authenticated";
GRANT ALL ON TABLE "public"."families" TO "service_role";



GRANT ALL ON TABLE "public"."family_invites" TO "anon";
GRANT ALL ON TABLE "public"."family_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."family_invites" TO "service_role";



GRANT ALL ON TABLE "public"."family_members" TO "anon";
GRANT ALL ON TABLE "public"."family_members" TO "authenticated";
GRANT ALL ON TABLE "public"."family_members" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";


