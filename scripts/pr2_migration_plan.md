# PR2 Migration Plan

## 目的

PR1 で追加した `family_memberships` を、将来的な正規 membership テーブルとして育てるための移行土台を整える。

この段階の主目的は以下。

- 既存の `family_members` ベース導線を止めずに、`family_memberships` へ既存データを写す
- 既存データと新テーブルの差分を把握できる状態にする
- 次段階で RPC / RLS / UI 参照先を切り替えられるように、最低限の互換層を置く

## 前提

- baseline migration は `supabase/migrations/20260413092326_remote_schema.sql`
- PR1 migration は remote / local に適用済み
- 追加済みテーブル:
  - `family_memberships`
  - `pending_admin_signups`
  - `allowance_grants`
  - `grant_decisions`
- 既存アプリはまだ `family_members` を正として動いている
- 現在の家族系導線は以下を経由している
  - `create_family_with_owner_membership`
  - `accept_family_invite`
  - `list_family_members_for_current_user`
  - `revoke_family_invite`
  - `family_invites` の RLS policy
  - フロントの `family-setup.tsx` と `family-invites-panel.tsx` の direct query

## 現在の関係整理

### `family_members` と `family_memberships` の役割差分

`family_members`

- 現在の実稼働 membership テーブル
- 主キーは `(family_id, user_id)` の複合キー
- `role` は text + check
- `status` を持たない
- `invited_by_user_id` を持たない
- RLS と RPC がすでに依存している

`family_memberships`

- PR1 で追加した正式化先の membership テーブル
- surrogate key `id` を持つ
- `role` は `family_member_role` enum
- `status` は `family_membership_status` enum
- `invited_by_user_id` を持つ
- 現時点ではアプリ未参照

### `profiles` / `families` / `family_invites` との関係

- `profiles`
  - `accept_family_invite` が `profiles.email` を参照して招待メール一致を判定している
  - `list_family_members_for_current_user` でも表示情報に使っている
- `families`
  - `family_members` / `family_memberships` の共通親テーブル
  - 現在の family 名カラムは `family_name`
- `family_invites`
  - 招待受諾後に `family_members` へ insert している
  - `role`, `status` は text
  - `invited_by_user_id` は持っているので、`family_memberships.invited_by_user_id` の backfill 元になり得る

### 既存アプリがどちらを参照しているか

`family_members` に依存している箇所:

- `supabase/create-family-with-owner-membership.sql`
- `supabase/accept-family-invite.sql`
- `supabase/revoke-family-invite.sql`
- `supabase/create-family-invites.sql`
- `supabase/list-family-members-for-current_user.sql`
- `app/components/family-setup.tsx`
- `app/components/family-invites-panel.tsx`
- baseline 内の RLS / grant / function 定義

`family_memberships` に依存している箇所:

- 現時点では PR1 migration のみ
- アプリ本体からの参照はまだない

### `family_memberships` を正にする場合の移行リスク

- 既存 RPC がすべて `family_members` を読んでいるため、テーブル差し替えは一括で行うと壊れやすい
- `family_members` には `status` が無いため、backfill 時の status 付与ルールを決める必要がある
- `invited_by_user_id` は既存 `family_members` には無いため、完全復元はできない可能性がある
- `family_invites` の accepted 済みデータが整っていないと、由来不明の membership が生じる
- RLS と policy の参照先変更を migration と同時に行うと、切り戻しが難しい

## PR2 でやること

### 1. backfill migration

目的:

- `family_members` の既存行を `family_memberships` へ写す
- すでに PR1 適用済み環境でも再実行できるようにする

基本方針:

- `insert ... select ... on conflict do update` で idempotent にする
- `family_members` を source of truth として扱う
- `family_memberships` の既存行があれば上書きせず、最低限の不足列だけ埋める

想定マッピング:

- `family_members.family_id` -> `family_memberships.family_id`
- `family_members.user_id` -> `family_memberships.user_id`
- `family_members.role` -> `family_memberships.role`
- `family_memberships.status` -> 原則 `active`
- `family_memberships.invited_by_user_id` -> 後述のルールで埋める

### 2. invited_by_user_id の補完ルール

原則:

- `family_invites` に同一 `family_id + email + role` の accepted 招待があり、かつ `profiles.email` が一致するなら `family_invites.invited_by_user_id` を採用する
- 一致しない場合は `NULL` を許容する

要確認事項:

- accepted invite と membership の 1:1 対応が保証されるか
- 招待を使わず作成された初期 owner row には `invited_by_user_id` が無いので `NULL` か `created_by_user_id` を採用するか

安全側の推奨:

- owner の `invited_by_user_id` は `NULL` のまま
- accepted invite 由来のものだけ埋める

### 3. 差分確認用 SQL / view / checklist の追加

PR2 では少なくとも以下が必要。

- row count 比較
- role 別件数比較
- `family_members` にあるのに `family_memberships` に無い行の検出
- `family_memberships` にのみ存在する行の検出
- `invited_by_user_id is null` 行の確認

### 4. 最低限の互換層

PR2 で許容される互換層は、アプリ参照切り替えではなく、移行確認のための補助 view / helper SQL までに留めるのが安全。

推奨:

- 互換チェック view
- 差分確認 query

まだやらない:

- trigger による双方向同期
- RPC の参照先変更
- `family_members` を view 化する変更

## PR3 以降に送ること

### PR3

- `family_members` -> `family_memberships` の一方向同期 trigger
- 新規作成 / 受諾導線を両書きにするための RPC 差し替え
- `family_invites` の policy / helper を `family_memberships` ベースへ寄せ始める

### PR4

- アプリ側の direct query 切り替え
- `family_members` を直接読む箇所の解消
- `list_family_members_for_current_user` などの read RPC 差し替え

### PR5

- `family_members` 依存の撤去
- 不要な policy / function の削除
- 旧テーブルの read-only 化、または最終的な廃止計画

## 非変更対象

- 認証方式
- `families` カラム命名の正式化
- `profiles` の制約強化
- `family_invites` の enum 化や構造見直し
- `allowance_grants` / `grant_decisions` を使う UI

## 想定 migration の粒度

PR2 は 7 ファイル以内なら以下が妥当。

1. backfill migration
2. 差分確認用 helper view migration
3. 検証用 SQL or doc
4. `scripts/pr2_checklist.md`

必要に応じて SQL を 2 本に分ける。

## 実装順

1. 現状件数の確認
2. backfill migration 作成
3. local `db reset`
4. 差分確認 SQL 実行
5. 問題がなければ remote へ適用
6. PR3 の trigger / RPC 差し替えへ進む

## rollback の考え方

PR2 の rollback は「新テーブル側をやり直せるか」が中心。

- source of truth はまだ `family_members`
- `family_memberships` は失敗しても truncate / delete 後に再 backfill 可能にしておく
- `family_members` は更新しない
- destructive な alter / drop は行わない

## 検証項目

- `family_members` 件数 = `family_memberships` 件数 になるか
- role ごとの件数が一致するか
- `family_members` にあって `family_memberships` に無い行が 0 件か
- `family_memberships` にだけ存在する行が意図したものだけか
- `invited_by_user_id` の null 件数が想定内か
- 現行の家族作成 / 招待 / 受諾 / メンバー一覧が引き続き動くか

## 本番適用時の注意点

- 本番で source of truth はまだ `family_members`
- backfill を先に本番へ入れても、アプリ参照先は変えない
- accepted invite の履歴品質によって `invited_by_user_id` は完全再現できない可能性がある
- backfill 後に差分確認を行うまで、次段階の trigger 導入へ進まない

## 要確認事項

- `family_members` 内に role 不正値が存在しないか
- `profiles.email` が null / 空の既存 user がいるか
- accepted 済み `family_invites` の email / role が membership と一致するか
- owner row の `invited_by_user_id` を null のまま許容するか