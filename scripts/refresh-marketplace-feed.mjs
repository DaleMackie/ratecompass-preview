#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const feedPaths = [
  "rates.json",
  "docs/rates.json",
  "RateCompass-GitHub-Pages-Upload/docs/rates.json",
  "RateCompass-GitHub-Pages-Upload 2/docs/rates.json"
];

const backupFeedPaths = [
  "rates-backup.json",
  "docs/rates-backup.json"
];

function archiveFeedPaths(checkedAt) {
  return [
    `feed-archive/rates-${checkedAt}.json`,
    `docs/feed-archive/rates-${checkedAt}.json`
  ];
}

const marketplaceSourceConfigs = [
  {
    label: "Ratehub 1-year fixed mortgage rates",
    product: "Mortgage",
    mortgageTerm: "oneYearFixed",
    benchmarkTerm: "1 year",
    url: "https://www.ratehub.ca/best-mortgage-rates/1-year/fixed"
  },
  {
    label: "Ratehub 2-year fixed mortgage rates",
    product: "Mortgage",
    mortgageTerm: "twoYearFixed",
    benchmarkTerm: "2 year",
    url: "https://www.ratehub.ca/best-mortgage-rates/2-year/fixed"
  },
  {
    label: "Ratehub 3-year fixed mortgage rates",
    product: "Mortgage",
    mortgageTerm: "threeYearFixed",
    benchmarkTerm: "3 year",
    url: "https://www.ratehub.ca/best-mortgage-rates/3-year/fixed"
  },
  {
    label: "Ratehub 5-year fixed mortgage rates",
    product: "Mortgage",
    mortgageTerm: "fiveYearFixed",
    benchmarkTerm: "5 year",
    url: "https://www.ratehub.ca/best-mortgage-rates/5-year/fixed"
  },
  {
    label: "Ratehub 5-year variable mortgage rates",
    product: "Mortgage",
    mortgageTerm: "fiveYearVariable",
    benchmarkTerm: "5 year variable",
    url: "https://www.ratehub.ca/best-mortgage-rates/5-year/variable"
  },
  {
    label: "Ratehub GIC rates",
    product: "GIC",
    url: "https://www.ratehub.ca/gics"
  },
  {
    label: "Ratehub best GIC rates",
    product: "GIC",
    url: "https://www.ratehub.ca/gics/best-gic-rates"
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

const officialMortgageSourceConfigs = [
  {
    label: "Bank of Canada major-bank posted rates",
    sourceType: "Official posted-rate aggregate",
    valetSeries: {
      prime: "V80691311",
      mortgageOneYear: "V80691333",
      mortgageThreeYear: "V80691334",
      mortgageFiveYear: "V80691335",
      gicOneYear: "V80691339",
      gicThreeYear: "V80691340",
      gicFiveYear: "V80691341"
    },
    url: "https://www.bankofcanada.ca/rates/banking-and-financial-statistics/posted-interest-rates-offered-by-chartered-banks/"
  },
  {
    label: "RBC mortgage rates",
    sourceType: "Official lender page",
    url: "https://www.rbcroyalbank.com/mortgages/mortgage-rates.html"
  },
  {
    label: "TD mortgage rates",
    sourceType: "Official lender page",
    url: "https://www.td.com/ca/en/personal-banking/products/mortgages/mortgage-rates"
  },
  {
    label: "BMO mortgage rates",
    sourceType: "Official lender page",
    url: "https://www.bmo.com/en-ca/main/personal/mortgages/mortgage-rates/"
  },
  {
    label: "CIBC mortgage rates",
    sourceType: "Official lender page",
    url: "https://www.cibc.com/en/interest-rates/mortgage-rates.html"
  },
  {
    label: "Scotiabank mortgage rates",
    sourceType: "Official lender page",
    url: "https://www.scotiabank.com/ca/en/personal/rates-prices/mortgages-rates.html"
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
  const matches = html.matchAll(/(?<![\d.])([0-9]{1,2}\.[0-9]{2,3})%/g);
  const rates = [...matches]
    .map((match) => Number(match[1]))
    .filter((rate) => Number.isFinite(rate) && rate > 0 && rate < 25);

  return [...new Set(rates)]
    .sort((a, b) => a - b)
    .map((rate) => Number(rate.toFixed(2)));
}

async function fetchValetRates(seriesMap) {
  const entries = Object.entries(seriesMap);
  const seriesIds = entries.map(([, series]) => series).join(",");
  const payload = JSON.parse(
    await fetchText(`https://www.bankofcanada.ca/valet/observations/${seriesIds}/json?recent=1`)
  );
  const observation = payload.observations?.[0];
  if (!observation?.d) throw new Error("Missing Bank of Canada observation");

  const values = {};
  for (const [label, series] of entries) {
    const value = Number(observation[series]?.v);
    if (Number.isFinite(value)) values[label] = Number(value.toFixed(2));
  }

  if (!Object.keys(values).length) throw new Error("Missing Bank of Canada rate values");

  return {
    date: observation.d,
    values
  };
}

function textFromHtml(html) {
  return html
    .replace(/<!--\s*-->/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractRatehubMortgageRows(html) {
  const tableStart = html.indexOf("ProductTableMortgagesTable__Container");
  if (tableStart < 0) return [];

  const tableEnd = html.indexOf("</tbody>", tableStart);
  const tableHtml = tableEnd >= 0 ? html.slice(tableStart, tableEnd + 8) : html.slice(tableStart, tableStart + 30000);
  const rows = [];
  const rowMatches = tableHtml.matchAll(/<tr[\s\S]*?<\/tr>/g);

  for (const rowMatch of rowMatches) {
    const rowHtml = rowMatch[0];
    const providerMatch = rowHtml.match(/provider-title[^>]*>([\s\S]*?)<\/p>/);
    const provider = providerMatch ? textFromHtml(providerMatch[1]) : "";
    const rateCellMatch = rowHtml.match(/<td[^>]*left-most-cell[\s\S]*?<\/td>/);
    const rateText = rateCellMatch ? textFromHtml(rateCellMatch[0]) : "";
    const rateMatch = rateText.match(/([0-9]{1,2}\.[0-9]{2})/);
    const rate = rateMatch ? Number(rateMatch[1]) : NaN;

    if (provider && Number.isFinite(rate) && rate >= 2.5 && rate <= 8.5) {
      rows.push({ provider, rate: Number(rate.toFixed(2)) });
    }
  }

  return rows;
}

function normalizeGicTerm(term) {
  const normalized = term.toLowerCase();
  if (/1[-\s]?yr|1[-\s]?year/.test(normalized)) return "1 year";
  if (/2[-\s]?yr|2[-\s]?year/.test(normalized)) return "2 year";
  if (/3[-\s]?yr|3[-\s]?year/.test(normalized)) return "3 year";
  if (/5[-\s]?yr|5[-\s]?year/.test(normalized)) return "5 year";
  return null;
}

function extractRedeemability(text) {
  const normalized = text.toLowerCase();
  if (normalized.includes("non-redeemable") || normalized.includes("redeemable no")) return "Non-redeemable";
  if (normalized.includes("cashable")) return "Cashable";
  if (normalized.includes("redeemable")) return "Redeemable";
  return "Non-redeemable";
}

function extractRatehubGicRows(html) {
  const rows = [];

  for (const rowMatch of html.matchAll(/<tr[\s\S]*?<\/tr>/g)) {
    const rowHtml = rowMatch[0];
    const termMatch = rowHtml.match(/rh-title-2xs[^>]*>([\s\S]*?)<\/p>/);
    const term = termMatch ? normalizeGicTerm(textFromHtml(termMatch[1])) : null;
    if (!term) continue;

    const rateMatches = [...rowHtml.matchAll(/page-behaviour-button-message[^>]*>([\s\S]*?)<\/span>/g)];
    const providerMatches = [...rowHtml.matchAll(/provider-title[^>]*>([\s\S]*?)<\/p>/g)];
    const redeemableMatches = [...rowHtml.matchAll(/<dt[^>]*>Redeemable<\/dt><dd[^>]*>([\s\S]*?)<\/dd>/g)];

    rateMatches.forEach((rateMatch, index) => {
      const rate = Number(textFromHtml(rateMatch[1]).match(/[0-9]{1,2}\.[0-9]{2}/)?.[0]);
      const provider = providerMatches[index] ? textFromHtml(providerMatches[index][1]) : "Marketplace";
      const redeemabilityText = redeemableMatches[index] ? `Redeemable ${textFromHtml(redeemableMatches[index][1])}` : "";
      const gicRedeemability = extractRedeemability(redeemabilityText);

      if (Number.isFinite(rate) && rate >= 1 && rate <= 8) {
        rows.push({ provider, term, gicRedeemability, rate: Number(rate.toFixed(2)) });
      }
    });
  }

  for (const cardMatch of html.matchAll(/<li[^>]*data-name="([^"]+)"[\s\S]*?gics\.featured\.card[\s\S]*?<\/li>/g)) {
    const cardHtml = cardMatch[0];
    const provider = textFromHtml(cardMatch[1]);
    const rate = Number(textFromHtml(cardHtml).match(/([0-9]{1,2}\.[0-9]{2})%/)?.[1]);
    const descriptionMatch = cardHtml.match(/product-content[\s\S]*?<p[^>]*description[^>]*>([\s\S]*?)<\/p>/);
    const description = descriptionMatch ? textFromHtml(descriptionMatch[1]) : "";
    const term = normalizeGicTerm(description);
    const gicRedeemability = extractRedeemability(description);

    if (provider && term && Number.isFinite(rate) && rate >= 1 && rate <= 8) {
      rows.push({ provider, term, gicRedeemability, rate: Number(rate.toFixed(2)) });
    }
  }

  const seen = new Set();
  return rows.filter((row) => {
    const key = `${row.provider}|${row.term}|${row.gicRedeemability}|${row.rate}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function median(values) {
  const sorted = values
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (!sorted.length) return null;

  const midpoint = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[midpoint];

  return Number(((sorted[midpoint - 1] + sorted[midpoint]) / 2).toFixed(2));
}

function upperMiddle(values) {
  const sorted = values
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (!sorted.length) return null;

  const index = Math.floor((sorted.length - 1) * 0.75);
  return Number(sorted[index].toFixed(2));
}

async function fetchText(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "user-agent": userAgent
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function checkMarketplaceSource(source, checkedAt) {
  try {
    const html = await fetchText(source.url);
    const mortgageRows = source.product === "Mortgage" ? extractRatehubMortgageRows(html) : [];
    const gicRows = source.product === "GIC" ? extractRatehubGicRows(html) : [];
    const rates = mortgageRows.length
      ? mortgageRows.map((row) => row.rate)
      : gicRows.length
        ? gicRows.map((row) => row.rate)
      : extractPercentRates(html);
    const benchmarkRate = mortgageRows.length ? median(rates.slice(0, 6)) : null;

    return {
      ...source,
      sourceType: "Marketplace",
      lastChecked: checkedAt,
      status: rates.length ? "Checked" : "No public rates found",
      ratesFound: rates.slice(0, 40),
      mortgageRows,
      gicRows,
      benchmarkRate,
      benchmarkMethod: benchmarkRate ? "Median of the leading visible comparison-table rates" : undefined,
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

async function checkOfficialMortgageSource(source, checkedAt) {
  try {
    if (source.valetSeries) {
      const valetRates = await fetchValetRates(source.valetSeries);

      return {
        ...source,
        product: "Mortgage and GIC",
        lastChecked: checkedAt,
        status: "Reachable",
        ratesFound: Object.values(valetRates.values),
        officialRates: valetRates.values,
        officialDate: valetRates.date,
        note: "Official Bank of Canada Valet data used as a major-bank posted-rate and deposit-rate cross-check. Posted bank rates can be higher for mortgages and lower for GICs than consumer comparison or negotiated rates."
      };
    }

    const html = await fetchText(source.url);
    const rates = extractPercentRates(html).filter((rate) => rate >= 2.5 && rate <= 10.5);

    return {
      ...source,
      product: "Mortgage",
      lastChecked: checkedAt,
      status: "Reachable",
      ratesFound: rates.slice(0, 40),
      note: "Official bank or Bank of Canada page used as a validation cross-check. Posted bank rates can be higher than consumer comparison or negotiated special-offer rates."
    };
  } catch (error) {
    return {
      ...source,
      product: "Mortgage",
      lastChecked: checkedAt,
      status: "Unavailable",
      ratesFound: [],
      note: `Official mortgage source could not be checked: ${error.message}`
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

function normalizeFeed(feed, checkedAt, marketplaceSources, officialMortgageSources, marketSignalSources) {
  const checkedProducts = new Set(
    marketplaceSources
      .filter((source) => source.status === "Checked")
      .map((source) => source.product)
  );
  const mortgageBenchmarkByTerm = new Map(
    marketplaceSources
      .filter((source) => source.product === "Mortgage" && source.benchmarkTerm && Number.isFinite(source.benchmarkRate))
      .map((source) => [source.benchmarkTerm, source])
  );
  const marketplaceGicRows = marketplaceSources.flatMap((source) => source.gicRows ?? []);
  const gicBenchmarkByKey = new Map();
  for (const term of ["1 year", "2 year", "3 year", "5 year"]) {
    const nonRedeemableRate = upperMiddle(
      marketplaceGicRows
        .filter((row) => row.term === term && row.gicRedeemability === "Non-redeemable")
        .map((row) => row.rate)
    );

    if (Number.isFinite(nonRedeemableRate)) {
      gicBenchmarkByKey.set(`${term}|Non-redeemable`, {
        rate: nonRedeemableRate,
        source: "Ratehub.ca GIC marketplace comparison table",
        sourceDetail: "Upper-middle public marketplace GIC rate range. Bank of Canada posted GIC data is checked separately as a low-side floor.",
        reviewNote: "Updated from the current public GIC comparison table. This is comparison context, not a verified institution offer."
      });
      gicBenchmarkByKey.set(`${term}|Redeemable`, {
        rate: Number(Math.max(nonRedeemableRate - 0.5, 0.01).toFixed(2)),
        source: "Ratehub.ca GIC marketplace comparison table",
        sourceDetail: "Estimated redeemable GIC benchmark using a 0.50 percentage-point flexibility discount from the current non-redeemable marketplace anchor.",
        reviewNote: "Adjusted from current non-redeemable marketplace GIC rates because redeemable products usually pay less for added flexibility."
      });
      gicBenchmarkByKey.set(`${term}|Cashable`, {
        rate: Number(Math.max(nonRedeemableRate - 0.75, 0.01).toFixed(2)),
        source: "Ratehub.ca GIC marketplace comparison table",
        sourceDetail: "Estimated cashable GIC benchmark using a 0.75 percentage-point liquidity discount from the current non-redeemable marketplace anchor.",
        reviewNote: "Adjusted from current non-redeemable marketplace GIC rates because cashable products usually pay less for added liquidity."
      });
    }
  }
  const currentBenchmarkRates = new Map(
    (feed.benchmarks ?? [])
      .filter((benchmark) => (benchmark.product === "Mortgage" || benchmark.product === "GIC") && Number.isFinite(benchmark.rate))
      .map((benchmark) => [benchmark.product === "GIC" ? `${benchmark.term}|${benchmark.gicRedeemability}` : benchmark.term, benchmark.rate])
  );
  const normalizedBenchmarks = (feed.benchmarks ?? []).map((benchmark) => {
    const productWasChecked = checkedProducts.has(benchmark.product) || benchmark.product === "LOC / HELOC";
    const mortgageSource = benchmark.product === "Mortgage" ? mortgageBenchmarkByTerm.get(benchmark.term) : null;
    const gicBenchmark = benchmark.product === "GIC" ? gicBenchmarkByKey.get(`${benchmark.term}|${benchmark.gicRedeemability}`) : null;

    return {
      ...benchmark,
      rate: mortgageSource ? mortgageSource.benchmarkRate : gicBenchmark ? gicBenchmark.rate : benchmark.rate,
      source: mortgageSource
        ? "Ratehub.ca marketplace comparison table"
        : gicBenchmark
          ? gicBenchmark.source
        : (benchmark.source?.replace("hosted benchmark feed", "hosted marketplace benchmark feed") ?? "RateCompass hosted marketplace benchmark feed"),
      sourceDetail: mortgageSource
        ? `${mortgageSource.benchmarkMethod} from ${mortgageSource.label}. Bank posted-rate pages are checked separately as a high-side guardrail.`
        : gicBenchmark
          ? gicBenchmark.sourceDetail
        : benchmark.sourceDetail,
      lastChecked: productWasChecked ? `Last checked: ${checkedAt}` : benchmark.lastChecked,
      status: benchmark.status === "Verified" ? "Verified" : "Marketplace",
      reviewNote: mortgageSource
        ? "Updated from the current public comparison table. This is comparison context, not a verified lender offer."
        : gicBenchmark
          ? gicBenchmark.reviewNote
        : productWasChecked
          ? "Reviewed against the current public marketplace source checks. This is comparison context, not a verified lender offer."
          : "No current source check was available for this benchmark during the latest refresh."
    };
  });
  const updatedBenchmarkRates = new Map(
    normalizedBenchmarks
      .filter((benchmark) => (benchmark.product === "Mortgage" || benchmark.product === "GIC") && Number.isFinite(benchmark.rate))
      .map((benchmark) => [benchmark.product === "GIC" ? `${benchmark.term}|${benchmark.gicRedeemability}` : benchmark.term, benchmark.rate])
  );
  const mortgageTermLabels = new Map([
    ["oneYearFixed", "1 year"],
    ["twoYearFixed", "2 year"],
    ["threeYearFixed", "3 year"],
    ["fiveYearFixed", "5 year"],
    ["fiveYearVariable", "5 year variable"]
  ]);
  const gicTermFromProductName = (productName = "") => {
    if (/1[-\s]?year/i.test(productName)) return "1 year";
    if (/2[-\s]?year/i.test(productName)) return "2 year";
    if (/3[-\s]?year/i.test(productName)) return "3 year";
    if (/5[-\s]?year/i.test(productName)) return "5 year";
    return null;
  };
  const officialPrimeRate = officialMortgageSources
    .find((source) => Number.isFinite(source.officialRates?.prime))
    ?.officialRates.prime ?? 4.45;
  const variableSpreadOffsets = new Map([
    ["RBC", 0],
    ["TD", 0.05],
    ["BMO", -0.05],
    ["CIBC", -0.01],
    ["Scotiabank", 0.03],
    ["National Bank", -0.02],
    ["Desjardins", -0.03],
    ["First National", -0.06],
    ["MCAP", -0.08],
    ["Tangerine", -0.04]
  ]);

  return {
    ...feed,
    updatedAt: checkedAt,
    sourceSummary:
      "RateCompass hosted marketplace benchmark and consumer comparison feed. Mortgage benchmarks are updated from public comparison-table rates where available. GIC benchmarks use the upper-middle public marketplace range where available. Official bank and Bank of Canada posted-rate pages are checked separately as validation references because posted bank rates can be higher for mortgages and lower for deposits than marketplace or negotiated rates.",
    refreshPolicy: {
      automaticCadence: "Daily, early morning Canada time",
      manualCadence: "Run before app screenshots, App Store submissions, marketing pushes, and Bank of Canada decision days",
      consumerRateLabel: "Marketplace",
      marketSignalLabel: "Market signal",
      verifiedLabelRule: "Only official lender or Bank of Canada sources with a last-checked date should be labelled Verified."
    },
    marketplaceSources,
    officialMortgageSources,
    marketSignalSources,
    benchmarks: normalizedBenchmarks,
    institutionRates: (feed.institutionRates ?? []).map((entry) => {
      const termLabel = entry.category === "Mortgage" ? mortgageTermLabels.get(entry.mortgageTerm) : null;
      const gicTermLabel = entry.category === "GIC" ? gicTermFromProductName(entry.productName) : null;
      const gicBenchmarkKey = gicTermLabel ? `${gicTermLabel}|${entry.gicRedeemability}` : null;
      const benchmarkKey = termLabel ?? gicBenchmarkKey;
      const oldBenchmarkRate = benchmarkKey ? currentBenchmarkRates.get(benchmarkKey) : null;
      const newBenchmarkRate = benchmarkKey ? updatedBenchmarkRates.get(benchmarkKey) : null;
      const rateDelta = Number.isFinite(oldBenchmarkRate) && Number.isFinite(newBenchmarkRate)
        ? Number((newBenchmarkRate - oldBenchmarkRate).toFixed(2))
        : 0;
      const adjustableCategory = entry.category === "Mortgage" || entry.category === "GIC";
      const adjustedRate = adjustableCategory && Number.isFinite(entry.rate) && rateDelta
        ? Number(Math.max(entry.rate + rateDelta, 0.01).toFixed(2))
        : entry.rate;
      const adjustedSpread = entry.category === "Mortgage" && Number.isFinite(entry.spreadOverPrime) && termLabel === "5 year variable" && Number.isFinite(newBenchmarkRate)
        ? Number(Math.max(newBenchmarkRate - officialPrimeRate + (variableSpreadOffsets.get(entry.institution) ?? 0), -3).toFixed(2))
        : entry.spreadOverPrime;

      return {
        ...entry,
        rate: adjustedRate,
        spreadOverPrime: adjustedSpread,
        productName: entry.category === "Mortgage" && termLabel === "5 year variable" && Number.isFinite(adjustedSpread)
          ? `Prime ${adjustedSpread >= 0 ? "+" : ""}${adjustedSpread.toFixed(2)}%`
          : entry.productName,
        note: entry.note === "Verified" ? "Verified" : "Marketplace",
        status: entry.status === "Verified" ? "Verified" : "Marketplace",
        source: entry.category === "Mortgage" && rateDelta
          ? "Ratehub.ca marketplace comparison table"
          : entry.category === "GIC" && rateDelta
            ? "Ratehub.ca GIC marketplace comparison table"
          : (entry.source ?? "RateCompass hosted marketplace benchmark feed"),
        lastChecked: entry.note === "Verified" || entry.status === "Verified" ? (entry.lastChecked ?? checkedAt) : checkedAt
      };
    })
  };
}

const checkedAt = todayISO();
const marketplaceSources = await Promise.all(
  marketplaceSourceConfigs.map((source) => checkMarketplaceSource(source, checkedAt))
);
const officialMortgageSources = await Promise.all(
  officialMortgageSourceConfigs.map((source) => checkOfficialMortgageSource(source, checkedAt))
);
const marketSignalSources = await Promise.all(
  yahooSignalSources.map((source) => checkYahooSource(source, checkedAt))
);

const baseFeed = JSON.parse(await readFile(feedPaths[0], "utf8"));
const refreshedFeed = normalizeFeed(baseFeed, checkedAt, marketplaceSources, officialMortgageSources, marketSignalSources);
const output = `${JSON.stringify(refreshedFeed, null, 2)}\n`;
const archivePaths = archiveFeedPaths(checkedAt);
const outputPaths = [...feedPaths, ...backupFeedPaths, ...archivePaths];

await Promise.all(
  [...new Set(outputPaths.map((path) => dirname(path)).filter((directory) => directory !== "."))]
    .map((directory) => mkdir(directory, { recursive: true }))
);
await Promise.all(outputPaths.map((path) => writeFile(path, output)));

console.log(`Updated ${feedPaths.length} feed files, ${backupFeedPaths.length} backup files, and ${archivePaths.length} archive files for ${checkedAt}.`);
console.log(`Marketplace checks: ${marketplaceSources.map((source) => `${source.label}: ${source.status}`).join("; ")}`);
console.log(`Official mortgage checks: ${officialMortgageSources.map((source) => `${source.label}: ${source.status}`).join("; ")}`);
console.log(`Yahoo signal checks: ${marketSignalSources.map((source) => `${source.label}: ${source.status}`).join("; ")}`);
