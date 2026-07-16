#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";

const feedPaths = [
  "rates.json",
  "docs/rates.json",
  "RateCompass-GitHub-Pages-Upload/docs/rates.json",
  "RateCompass-GitHub-Pages-Upload 2/docs/rates.json"
];

const marketplaceSourceConfigs = [
  {
    label: "Ratehub best mortgage rates",
    product: "Mortgage",
    url: "https://www.ratehub.ca/best-mortgage-rates"
  },
  {
    label: "Ratehub 5-year fixed mortgage rates",
    product: "Mortgage",
    url: "https://www.ratehub.ca/best-mortgage-rates/5-year/fixed"
  },
  {
    label: "Ratehub 5-year variable mortgage rates",
    product: "Mortgage",
    url: "https://www.ratehub.ca/best-mortgage-rates/5-year/variable"
  },
  {
    label: "Ratehub GIC rates",
    product: "GIC",
    url: "https://www.ratehub.ca/gics"
  },
  {
    label: "Ratehub savings account rates",
    product: "Savings",
    url: "https://www.ratehub.ca/savings-accounts"
  },
  {
    label: "WOWA mortgage rates",
    product: "Mortgage",
    url: "https://wowa.ca/mortgage-rates"
  },
  {
    label: "NerdWallet Canada GIC rates",
    product: "GIC",
    url: "https://www.nerdwallet.com/ca/p/best/banking/best-gic-rates-in-canada"
  }
];

const yahooSignalSources = [
  {
    label: "Royal Bank of Canada",
    signal: "Canadian bank equity",
    url: "https://ca.finance.yahoo.com/quote/RY.TO"
  },
  {
    label: "Toronto-Dominion Bank",
    signal: "Canadian bank equity",
    url: "https://ca.finance.yahoo.com/quote/TD.TO"
  },
  {
    label: "Bank of Montreal",
    signal: "Canadian bank equity",
    url: "https://ca.finance.yahoo.com/quote/BMO.TO"
  },
  {
    label: "Bank of Nova Scotia",
    signal: "Canadian bank equity",
    url: "https://ca.finance.yahoo.com/quote/BNS.TO"
  },
  {
    label: "Canadian Imperial Bank of Commerce",
    signal: "Canadian bank equity",
    url: "https://ca.finance.yahoo.com/quote/CM.TO"
  },
  {
    label: "CAD/USD",
    signal: "Currency",
    url: "https://ca.finance.yahoo.com/quote/CADUSD=X"
  }
];

const userAgent = "RateCompass marketplace refresh (+https://dalemackie.github.io/ratecompass-preview/)";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function extractPercentRates(html) {
  const matches = html.matchAll(/(?<![\d.])([0-9]{1,2}\.[0-9]{2})%/g);
  const rates = [...matches]
    .map((match) => Number(match[1]))
    .filter((rate) => Number.isFinite(rate) && rate > 0 && rate < 25);

  return [...new Set(rates)]
    .sort((a, b) => a - b)
    .map((rate) => Number(rate.toFixed(2)));
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "user-agent": userAgent
    }
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function checkMarketplaceSource(source, checkedAt) {
  try {
    const html = await fetchText(source.url);
    const rates = extractPercentRates(html);

    return {
      ...source,
      sourceType: "Marketplace",
      lastChecked: checkedAt,
      status: rates.length ? "Checked" : "No public rates found",
      ratesFound: rates.slice(0, 40),
      note: "Public marketplace page check. These values are comparison signals, not verified lender rates."
    };
  } catch (error) {
    return {
      ...source,
      sourceType: "Marketplace",
      lastChecked: checkedAt,
      status: "Unavailable",
      ratesFound: [],
      note: `Public marketplace page could not be checked: ${error.message}`
    };
  }
}

async function checkYahooSource(source, checkedAt) {
  try {
    await fetchText(source.url);

    return {
      ...source,
      sourceType: "Market signal",
      lastChecked: checkedAt,
      status: "Reachable",
      note: "Yahoo Finance Canada context page. Use for market direction, not lender product rates."
    };
  } catch (error) {
    return {
      ...source,
      sourceType: "Market signal",
      lastChecked: checkedAt,
      status: "Unavailable",
      note: `Yahoo Finance Canada context page could not be checked: ${error.message}`
    };
  }
}

function normalizeFeed(feed, checkedAt, marketplaceSources, marketSignalSources) {
  return {
    ...feed,
    updatedAt: checkedAt,
    sourceSummary:
      "RateCompass hosted marketplace benchmark and consumer comparison feed. Values can include Ratehub, WOWA, and NerdWallet marketplace comparisons plus curated fallback rows; they are not live lender rates unless explicitly marked Verified with an official source.",
    refreshPolicy: {
      automaticCadence: "Daily, early morning Canada time",
      manualCadence: "Run before app screenshots, App Store submissions, marketing pushes, and Bank of Canada decision days",
      consumerRateLabel: "Marketplace",
      marketSignalLabel: "Market signal",
      verifiedLabelRule: "Only official lender or Bank of Canada sources with a last-checked date should be labelled Verified."
    },
    marketplaceSources,
    marketSignalSources,
    benchmarks: (feed.benchmarks ?? []).map((benchmark) => ({
      ...benchmark,
      source: benchmark.source?.replace("hosted benchmark feed", "hosted marketplace benchmark feed") ?? "RateCompass hosted marketplace benchmark feed",
      status: benchmark.status === "Verified" ? "Verified" : "Marketplace"
    })),
    institutionRates: (feed.institutionRates ?? []).map((entry) => ({
      ...entry,
      note: entry.note === "Verified" ? "Verified" : "Marketplace"
    }))
  };
}

const checkedAt = todayISO();
const marketplaceSources = await Promise.all(
  marketplaceSourceConfigs.map((source) => checkMarketplaceSource(source, checkedAt))
);
const marketSignalSources = await Promise.all(
  yahooSignalSources.map((source) => checkYahooSource(source, checkedAt))
);

const baseFeed = JSON.parse(await readFile(feedPaths[0], "utf8"));
const refreshedFeed = normalizeFeed(baseFeed, checkedAt, marketplaceSources, marketSignalSources);
const output = `${JSON.stringify(refreshedFeed, null, 2)}\n`;

await Promise.all(feedPaths.map((path) => writeFile(path, output)));

console.log(`Updated ${feedPaths.length} feed files for ${checkedAt}.`);
console.log(`Marketplace checks: ${marketplaceSources.map((source) => `${source.label}: ${source.status}`).join("; ")}`);
console.log(`Yahoo signal checks: ${marketSignalSources.map((source) => `${source.label}: ${source.status}`).join("; ")}`);
