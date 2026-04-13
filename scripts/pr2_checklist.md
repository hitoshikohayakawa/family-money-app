# PR2 Checklist

## 目的

- `family_members` から `family_memberships` への backfill 方針を、安全に実装できる状態にする
- 既存導線を止めず、差分確認を経て次段階へ進める

## 前提

- PR1 migration は local / remote に適用済み
- `family_memberships` は存在するが、まだアプリ未参照
- 既存アプリは `family_members` を使っている

## 変更対象

- backfill migration
- 差分確認用 SQL / helper view
- PR2 の検証ドキュメント

## 非変更対象

- 既存アプリコード
- 現行 RPC の参照先
- 既存 `family_members` テーブル定義
- 認証方式

## 実装前チェック

- `supabase/migrations` の順番が壊れていない
- local Supabase が起動している
- PR1 の確認 SQL が通る
- `family_members` の現行件数を把握している

## migration 設計チェック

- backfill は再実行可能か
- `on conflict` のキーが `family_id, user_id` 前提になっているか
- `status` は一律 `active` とするか、条件分岐を持たせるかが明確か
- `invited_by_user_id` を埋められない場合に null を許容する設計か
- `family_members` を update / delete しないことが明確か

## 検証チェック

- `family_members` 件数と `family_memberships` 件数が一致する
- role ごとの件数が一致する
- `family_members` に存在する全行が `family_memberships` に存在する
- 想定外の重複がない
- `invited_by_user_id is null` の件数を把握できる
- local で `db reset` 後に再実行しても同じ結果になる

## 本番適用前チェック

- 差分確認 SQL を local で通している
- remote に適用しても既存導線へ影響しないことを確認している
- PR3 で trigger / RPC 変更を行う前提が共有されている

## rollback 観点

- `family_memberships` を再 backfill できる
- `family_members` には破壊的変更がない
- migration を失敗させても source of truth は残る

## 次段階への出口条件

- backfill 後の差分が許容範囲に収まる
- null の `invited_by_user_id` 件数に説明がつく
- `family_memberships` を参照する trigger / RPC 設計へ進めるだけの根拠が揃う