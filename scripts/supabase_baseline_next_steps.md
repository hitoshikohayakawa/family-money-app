# Supabase Baseline Next Steps

1. `npx supabase login`
2. `npx supabase link --project-ref YOUR_PROJECT_REF`
3. `npx supabase db pull --linked`
4. `supabase/migrations` に生成された baseline ファイル名を確認する
5. `supabase/migrations_pr1_tmp` に退避した以下の 5 本を、baseline より後ろの timestamp 名へ変更して `supabase/migrations` に戻す
   - `001_create_family_core_enums.sql`
   - `002_create_family_memberships.sql`
   - `003_create_pending_admin_signups.sql`
   - `004_create_allowance_grants.sql`
   - `005_create_grant_decisions.sql`
6. `npx supabase db reset`
7. `npx supabase db push`

補足:
- PR1 migration の中身は変更せず、ファイル名だけ timestamp 形式へ合わせる
- baseline 生成前に `supabase/migrations` を空にしておくことで、既存本番 schema を基準として取り込みやすくする
- `scripts/check_pr1.sql` を使って、PR1 migration 適用後に enum / table の存在確認を行う