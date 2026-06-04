"}
# CLAUDE.md

このリポジトリは「ミラマネ / Family Money App」です。  
親子でお金の使い方、お小遣い、投資シミュレーションを学ぶための個人開発Webアプリです。

Claude Codeは、作業前に必ずこのファイルを読んでください。

## 最重要方針

このプロジェクトでは、既存の本番動作を壊さないことを最優先にしてください。

特に以下の領域は慎重に扱ってください。

- Supabase Auth
- RLS
- Service Role Key
- 家族・メンバー権限
- 家族招待フロー
- お小遣い付与
- 子どもの受け取り・投資判断
- 現金化申請
- 投資価格同期
- 利用規約・プライバシーポリシー

## 作業スタイル

### 原則

- まず現状を読んで理解する
- 変更前に方針を説明する
- 影響範囲を明示する
- 小さな差分で進める
- 推測で仕様を断定しない
- 不明点は「要確認」と書く
- 本番環境に影響する変更は慎重に扱う

### 禁止事項

- いきなり大規模リファクタリングしない
- 認証・DB・RLSを事前説明なしに変更しない
- Service Role Keyをクライアント側へ露出させない
- マイグレーションを雑に追加しない
- RPCの戻り値を不用意に変更しない
- 法務文言を勝手に確定しない
- packageのメジャーアップデートを勝手に行わない
- 既存UIを大きく変える場合に説明なしで進めない

### 推奨される進め方

1. 関連ファイルを読む
2. 現状理解を短くまとめる
3. 変更案を出す
4. リスクを説明する
5. 変更対象ファイルを明示する
6. 実装する
7. `npm run lint` と `npm run build` の実行を推奨する
8. 必要に応じてスモークテストを案内する

## 技術スタック

- Next.js 16
- React 19
- TypeScript
- Supabase
- Vercel
- Resend
- GitHub Actions
- Tailwind CSS

## Next.jsに関する注意

このプロジェクトは Next.js 16 を使用しています。  
古いNext.jsの知識で判断せず、必要に応じて現在のプロジェクト内の実装や `node_modules/next/dist/docs/` を確認してください。

特に以下に注意してください。

- App Router
- Server Components / Client Components
- Route Handlers
- React 19との組み合わせ
- Next.js 16の仕様変更

既存の `AGENTS.md` にもNext.jsの注意が書かれています。必要に応じて参照してください。

## 主要ディレクトリ

```text
app/
  Next.js App Router配下の画面・API・コンポーネント

app/api/
  API Route

app/components/
  Reactコンポーネント

app/components/ui/
  汎用UIコンポーネント

lib/
  Supabase、認証、メール通知などの共通処理

scripts/
  運用・検証・価格同期・スモークテスト用スクリプト

supabase/
  SQL、RPC、マイグレーション、テンプレート

supabase/migrations/
  DBマイグレーション

.github/workflows/
  GitHub Actions
```

## 重要ファイル

```text
app/page.tsx
  メイン画面

app/layout.tsx
  メタデータ、OGP、全体レイアウト

app/login/page.tsx
  ログイン画面

app/register/page.tsx
  登録画面。利用規約・プライバシーポリシー同意チェックあり

app/setup-password/page.tsx
  初回パスワード設定・再設定

app/terms/page.tsx
  利用規約

app/privacy/page.tsx
  プライバシーポリシー

app/components/allowance-grants-panel.tsx
  お小遣い、投資、現金化まわりの中心コンポーネント
  非常に大きいので変更注意

app/components/family-invites-panel.tsx
  家族招待UI

app/components/family-members-list.tsx
  家族メンバー表示

app/components/family-setup.tsx
  家族作成・初期設定

lib/supabase.ts
  クライアント側Supabase

lib/server-supabase.ts
  サーバー側Supabase

lib/client-auth.ts
  クライアント認証補助

lib/email-notifications.ts
  Resend通知

scripts/sync-all-country-price.mjs
  投資対象価格同期

.github/workflows/sync-all-country-price.yml
  価格同期ワークフロー
```

## 機能概要

### 認証

- Supabase Authを使用
- メールアドレス・パスワード認証
- パスワード再設定
- 初回パスワード設定
- 登録時に利用規約・プライバシーポリシー同意チェックあり

関連ファイル：

```text
app/login/page.tsx
app/register/page.tsx
app/forgot-password/page.tsx
app/setup-password/page.tsx
lib/client-auth.ts
lib/supabase.ts
lib/server-supabase.ts
```

### 家族管理

- 家族作成
- 家族メンバー管理
- 家族招待
- 招待受諾
- 招待取り消し
- ロール管理

関連ファイル：

```text
app/family/page.tsx
app/family/invites/page.tsx
app/invites/[inviteId]/page.tsx
app/components/family-setup.tsx
app/components/family-members-list.tsx
app/components/family-invites-panel.tsx
app/api/family-invites/route.ts
app/api/family-members/[userId]/route.ts
```

関連RPC：

```text
create_family_with_owner_membership
list_family_members_for_current_user
list_family_invites_for_current_user
get_family_invite_details
resolve_family_invite_status
accept_family_invite
revoke_family_invite
```

### お小遣い

- 保護者がお小遣いを付与
- 子どもがお小遣いを確認
- 子どもが「すぐもらう」「投資する」などを選択
- 履歴確認

関連ファイル：

```text
app/components/allowance-grants-panel.tsx
app/allowance-history/page.tsx
app/allowance-history/allowance-history-content.tsx
app/api/allowance-grants/route.ts
app/api/allowance-decisions/immediate-cash/route.ts
```

関連RPC：

```text
create_allowance_grant
list_allowance_grants_for_current_user
request_immediate_cash_for_allowance
request_investment_for_allowance
```

### 投資シミュレーション

このアプリの投資機能は教育目的のシミュレーションです。  
実際の金融商品の売買、仲介、運用、投資助言ではありません。

関連ファイル：

```text
app/api/investment-prices/refresh/route.ts
scripts/sync-all-country-price.mjs
scripts/check-all-country-price-sync.mjs
scripts/upsert-investment-asset-price.mjs
docs/price-source.md
```

関連RPC：

```text
list_investment_assets_for_current_user
request_investment_for_allowance
```

関連テーブル：

```text
investment_assets
investment_asset_prices
grant_decisions
```

### 現金化申請

- 子どもが投資中または受け取り対象のお小遣いについて現金化を申請
- 保護者が支払い完了処理
- 必要に応じて通知メール送信

関連ファイル：

```text
app/api/allowance-cashout-requests/route.ts
app/components/allowance-grants-panel.tsx
lib/email-notifications.ts
```

関連RPC：

```text
request_cashout_for_allowances
mark_allowance_cashout_paid
```

関連テーブル：

```text
allowance_cashout_requests
allowance_cashout_request_items
allowance_notification_logs
```

## 環境変数

### 公開可能なクライアント用

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SITE_URL
```

### サーバー専用

```text
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
NOTIFICATION_EMAIL_FROM
PRICE_SYNC_ALERT_EMAIL
INVESTMENT_ASSET_CODE
ALL_COUNTRY_PRICE_CSV_URL
INVESTMENT_PRICE_SOURCE
SUPABASE_DB_PASSWORD
```

### テスト・スクリプト用

```text
TEST_SUPABASE_URL
TEST_SUPABASE_ANON_KEY
TEST_SUPABASE_SERVICE_ROLE_KEY
INVITE_ID
INVITED_USER_EMAIL
INVITED_USER_PASSWORD
USER_EMAIL
TEMP_PASSWORD
DISPLAY_NAME
CREATE_IF_MISSING
PRICE_SYNC_DRY_RUN
INVESTMENT_PRICE_DATE
INVESTMENT_UNIT_PRICE_JPY
```

## 環境変数に関する注意

`SUPABASE_SERVICE_ROLE_KEY` は非常に強い権限を持ちます。  
絶対にクライアントコンポーネント、ブラウザに露出するコード、`NEXT_PUBLIC_` 付き変数に入れないでください。

現在、一部のサーバーサイド処理やスクリプトでは以下のようなfallbackがあります。

```text
SUPABASE_SERVICE_ROLE_KEY ?? TEST_SUPABASE_SERVICE_ROLE_KEY
```

開発上は便利ですが、本番環境では意図せずテスト用キーを使わないよう注意してください。  
この運用を変更する場合は、影響範囲を説明してから行ってください。

## DB / Supabaseに関する注意

このプロジェクトはSupabase RPCを多く使っています。  
DB変更やRPC変更は既存画面と密接につながっています。

変更前に必ず確認してください。

- 既存テーブルとの互換性
- 既存データへの影響
- RLSへの影響
- family_idによるスコープ制御
- guardian / child / admin などのロール制御
- RPCの戻り値が既存UIに与える影響
- スモークテストの有無

## 主要テーブル

コードとマイグレーションから確認できる主要領域です。

```text
families
family_members
family_memberships
family_invites
pending_admin_signups
profiles

allowance_grants
grant_decisions
allowance_cashout_requests
allowance_cashout_request_items
allowance_notification_logs

investment_assets
investment_asset_prices
```

注意：  
正確な最新スキーマは `supabase/migrations/` とSupabase側の実DBを確認してください。

## 主要RPC

```text
create_family_with_owner_membership
list_family_members_for_current_user
list_family_invites_for_current_user
get_family_invite_details
resolve_family_invite_status
accept_family_invite
revoke_family_invite

create_allowance_grant
list_allowance_grants_for_current_user
request_immediate_cash_for_allowance
request_investment_for_allowance
request_cashout_for_allowances
mark_allowance_cashout_paid

list_investment_assets_for_current_user
```

## `allowance-grants-panel.tsx` の扱い

`app/components/allowance-grants-panel.tsx` は現時点で非常に大きく、お小遣い・投資・現金化・表示ロジックが集中しています。

このファイルを触る場合は特に慎重に進めてください。

### 禁止

- いきなり全面リファクタリングしない
- UI変更とロジック変更を同時に大きく行わない
- 型整理、状態管理変更、API変更を一度に混ぜない

### 推奨

まず分割方針だけ提案してください。

候補：

```text
types/allowance.ts
utils/formatters.ts
utils/allowance-status.ts

hooks/useAllowanceGrants.ts
hooks/useInvestmentAssets.ts
hooks/useCashoutRequests.ts

components/allowance/
components/investment/
components/cashout/
components/guardian/
components/child/
```

段階的に進める場合の推奨順：

1. 型定義の切り出し
2. 表示用formatterの切り出し
3. 小さなUI部品の切り出し
4. API呼び出しhooksの切り出し
5. 親・子ども・投資・現金化の責務分離

## 法務ページの扱い

以下のページがあります。

```text
app/terms/page.tsx
app/privacy/page.tsx
```

このアプリは以下の要素を含みます。

- 子どもが利用する可能性
- 個人情報を扱う
- 家族情報を扱う
- 投資シミュレーションを扱う
- 金銭の受け取り・申請を扱う

そのため、法務文言を変更する場合は「修正案」として提示し、勝手に最終確定しないでください。

特に注意する観点：

- 運営主体
- 免責
- 金融商品取引ではないこと
- 投資助言ではないこと
- 子どもの利用
- 個人情報の取り扱い
- データ消失・バックアップ
- 通知メール

## メール通知

Resendを利用しています。

関連ファイル：

```text
lib/email-notifications.ts
scripts/notify-price-sync-failure.mjs
```

注意：

- `RESEND_API_KEY` はサーバー専用
- `NOTIFICATION_EMAIL_FROM` の送信元表記を確認
- 送信先メールアドレスの扱いに注意
- 本番環境でテスト送信しない

## GitHub Actions

投資対象価格の同期にGitHub Actionsを使っています。

関連ファイル：

```text
.github/workflows/sync-all-country-price.yml
scripts/sync-all-country-price.mjs
scripts/check-all-country-price-sync.mjs
scripts/notify-price-sync-failure.mjs
```

変更時は以下を確認してください。

- secrets
- schedule
- 手動実行
- dry-run
- 失敗通知
- Supabase Service Role Keyの扱い

## 実行コマンド

### 基本

```bash
npm run dev
npm run lint
npm run build
npm run start
```

### Supabase

```bash
npm run sb:start
npm run sb:stop
npm run sb:status
npm run sb:push
npm run sb:push:raw
```

### スモークテスト

```bash
npm run test:prices-sync-all-country-smoke
npm run test:allowance-immediate-cash-smoke
npm run test:allowance-investment-smoke
npm run test:allowance-multi-child-smoke
npm run test:allowance-cashout-smoke
npm run test:invite-accept-smoke
```

### 価格同期

```bash
npm run prices:upsert
npm run prices:sync:all-country
npm run prices:check:all-country
npm run prices:notify-failure
```

## 変更後の確認

通常の変更では以下を推奨します。

```bash
npm run lint
npm run build
```

DB・RPC・価格同期・招待・お小遣い・現金化に関わる場合は、関連するスモークテストも確認してください。

## 初回にやるべきおすすめタスク

Claude Codeがこのリポジトリを初めて扱う場合、いきなりコード変更せず、まず以下を行ってください。

1. リポジトリ全体の現状理解
2. 主要機能の整理
3. DB / RPC / API / UI の接続関係の整理
4. 壊しやすい箇所の特定
5. 優先度付き改善ロードマップ作成

最初の作業指示例：

```text
まずコード変更はしないでください。
このリポジトリを読み、現在の機能、技術構成、認証・家族招待・お小遣い・投資・現金化・価格同期の処理フロー、壊しやすい箇所、最初に改善すべき技術的負債を整理してください。
そのうえで、変更案を優先度順に提示してください。
```

## 優先改善候補

現時点で優先度が高そうなもの：

1. `allowance-grants-panel.tsx` の段階的分割
2. Supabase型生成の導入検討
3. Service Role Key / TEST系環境変数の運用整理
4. スモークテストの実行手順整理
5. DB / RPC / UI の対応表作成
6. 法務ページの運営主体・免責文言確認
7. エラーハンドリングとユーザー表示の整理
8. README / docs の継続更新

## 返答スタイル

作業時は、できるだけ以下の形式で返答してください。

```text
## 現状理解
## 変更方針
## 影響範囲
## リスク
## 変更ファイル
## 確認方法
## 次にやること
```

## 最後に

このプロジェクトは個人開発ですが、認証・家族情報・子ども・お金・投資シミュレーションを扱うため、雑な変更は避けてください。

小さく、安全に、確認しながら進めてくださ

@AGENTS.md
