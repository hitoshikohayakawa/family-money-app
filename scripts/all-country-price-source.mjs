export const defaultAllCountryCsvUrl =
  "https://fs.bk.mufg.jp/webasp/mufg/fund/detail/chart/csv/m00355920.csv";

export const defaultAllCountryPriceSource = "mufg_bank_csv:m00355920";
export const defaultAssetCode = "emaxis_slim_all_country";
const defaultFetchTimeoutMs = 30_000;

function formatError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function parseLatestPrice(csvText) {
  const rows = csvText.split(/\r?\n/);

  for (const rawRow of rows) {
    const row = rawRow.trim();

    if (!/^\d{4}-\d{2}-\d{2},/.test(row)) {
      continue;
    }

    const [priceDate, unitPriceText] = row.split(",");
    const unitPriceJpy = Number.parseInt(unitPriceText, 10);

    if (!isIsoDate(priceDate)) {
      throw new Error(`Invalid price date in CSV row: ${row}`);
    }

    if (!Number.isInteger(unitPriceJpy) || unitPriceJpy <= 0) {
      throw new Error(`Invalid unit price in CSV row: ${row}`);
    }

    return {
      priceDate,
      unitPriceJpy,
    };
  }

  throw new Error("No price rows were found in CSV.");
}

/**
 * CSV テキストから sinceDate 以降の全行を返す。
 * CSV は最新→古い順にソートされている想定。
 * @param {string} csvText
 * @param {string} sinceDate  YYYY-MM-DD 形式
 * @returns {{ priceDate: string, unitPriceJpy: number }[]}
 */
export function parseAllPrices(csvText, sinceDate) {
  const rows = csvText.split(/\r?\n/);
  const result = [];

  for (const rawRow of rows) {
    const row = rawRow.trim();
    if (!/^\d{4}-\d{2}-\d{2},/.test(row)) continue;

    const [priceDate, unitPriceText] = row.split(",");
    if (!isIsoDate(priceDate)) continue;
    if (priceDate < sinceDate) break; // CSV は新→旧順なので以降は不要

    const unitPriceJpy = Number.parseInt(unitPriceText, 10);
    if (!Number.isInteger(unitPriceJpy) || unitPriceJpy <= 0) continue;

    result.push({ priceDate, unitPriceJpy });
  }

  return result;
}

export async function fetchLatestAllCountryPrice(csvUrl) {
  let response;

  try {
    response = await fetch(csvUrl, {
      headers: {
        "user-agent": "family-money-app price sync",
      },
      signal: AbortSignal.timeout(defaultFetchTimeoutMs),
    });
  } catch (error) {
    throw new Error(`Failed to fetch price CSV from ${csvUrl}: ${formatError(error)}`);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch price CSV from ${csvUrl}: HTTP ${response.status}`);
  }

  let csvText;

  try {
    csvText = await response.text();
  } catch (error) {
    throw new Error(`Failed to read price CSV response body: ${formatError(error)}`);
  }

  try {
    return parseLatestPrice(csvText);
  } catch (error) {
    throw new Error(`Failed to parse latest price row: ${formatError(error)}`);
  }
}
