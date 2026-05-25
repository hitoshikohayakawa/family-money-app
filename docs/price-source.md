# Price Source

## Selected Source

For the first daily price sync, use the Mitsubishi UFJ Bank fund CSV for:

- Asset: `eMAXIS Slim 全世界株式（オール・カントリー）`
- App asset code: `emaxis_slim_all_country`
- CSV URL: `https://fs.bk.mufg.jp/webasp/mufg/fund/detail/chart/csv/m00355920.csv`
- Source label saved to DB: `mufg_bank_csv:m00355920`

## Why This Source

- It provides a machine-readable CSV, so the app can fetch the latest daily value without scraping HTML.
- The current `scripts/sync-all-country-price.mjs` already supports this source.
- The latest row can be upserted into `investment_asset_prices` by `(asset_id, price_date)`, so repeated runs are safe.

## Verified Dry Run

The source was verified with:

```bash
PRICE_SYNC_DRY_RUN=1 npm run prices:sync:all-country
```

Latest dry-run result:

- Price date: `2026-05-22`
- Unit price: `37074`
- DB asset: `emaxis_slim_all_country`
- No database write was performed.

## Environment Overrides

The sync script can be pointed at another source without code changes:

- `ALL_COUNTRY_PRICE_CSV_URL`
- `INVESTMENT_ASSET_CODE`
- `INVESTMENT_PRICE_SOURCE`
- `PRICE_SYNC_DRY_RUN`

## Step 2 Completed

The daily sync entrypoint has been hardened in `scripts/sync-all-country-price.mjs`:

- Catch fetch and parse errors with clear messages.
- Validate the parsed CSV date and price before DB access.
- Keep failed price sync isolated in a standalone Node script.
- Add a smoke command that runs dry-run validation:

```bash
npm run test:prices-sync-all-country-smoke
```

## Step 3 Completed

The existing sync entrypoint is now wired to GitHub Actions:

- Workflow file: `.github/workflows/sync-all-country-price.yml`
- Scheduled run: weekdays at `01:00 UTC` (`10:00 JST`)
- Manual run: supported with `workflow_dispatch`
- Manual default: dry-run enabled unless unchecked in the Actions UI
- Required GitHub Actions secrets:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

The workflow runs:

```bash
npm run prices:sync:all-country
```

and sets `PRICE_SYNC_DRY_RUN=1` automatically for manual dry-run execution.

## Step 4 Completed

Basic operational visibility is now in place:

- Verification command: `npm run prices:check:all-country`
- The verification script fetches the latest source CSV row and compares it with the latest DB row in `investment_asset_prices`
- It fails if `price_date`, `unit_price_jpy`, or `source` do not match
- The scheduled GitHub Actions workflow now runs this verification step after the sync step

This gives a simple post-sync signal that the latest source value was actually persisted.

## Initial Live Sync

The first non-dry-run sync was executed successfully on `2026-05-25`.

- Synced price date: `2026-05-22`
- Synced unit price: `37074`
- Stored source: `mufg_bank_csv:m00355920`
- Post-sync verification: passed

## Step 5 Completed

Outward failure notification is now configured in the GitHub Actions flow:

- Failure email recipient: `h.kohayakawa@petsallright.net`
- Delivery path: Resend API from the workflow
- Trigger: when the scheduled or manual non-dry-run workflow fails
- Required GitHub Actions secret: `RESEND_API_KEY`
- Optional GitHub Actions secret: `NOTIFICATION_EMAIL_FROM`

## Step 6 Completed

Daily price freshness now follows a lazy on-access model instead of a scheduled daily fetch:

- When a signed-in user opens the app, the client calls `POST /api/investment-prices/refresh`
- The route first checks the latest stored `investment_asset_prices` row
- If the stored price is already up to date for the previous business day in JST, it skips external fetch
- If the stored price is stale, it fetches the latest CSV row and upserts it before the UI reloads grants and investment asset data
- The GitHub Actions workflow remains available as a manual fallback and verification tool, but no longer runs on a daily schedule

This keeps the normal experience light while still making the displayed current price catch up automatically when someone actually uses the service.

## Next Step

Step 7 should refine the “staleness” UX, such as showing a small “latest price checked” timestamp or a subtle note when the latest market price could not be refreshed during access.
