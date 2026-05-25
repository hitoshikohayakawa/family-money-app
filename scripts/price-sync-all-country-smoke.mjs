process.env.PRICE_SYNC_DRY_RUN = process.env.PRICE_SYNC_DRY_RUN ?? "1";

await import("./sync-all-country-price.mjs");
