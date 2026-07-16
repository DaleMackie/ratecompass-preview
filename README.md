# RateCompass

RateCompass is a SwiftUI iOS starter app affiliated with The Wealth Map. It keeps the sibling app's simple navigation, strong brand mark, rounded controls, and Canadian finance tone, but uses a cooler blue/cyan rate-intelligence palette.

## Current Screens

- Five-step onboarding.
- Login, sign-up, and preview-without-account flow.
- Home dashboard with RateCompass Signal, Bank of Canada decision card, personal impact, and suggested action.
- Rates tab with Mortgage, Savings, GIC, and Prime categories, including common mortgage term views, Big 5 watchlist coverage, and a Prime reference card that separates Bank of Canada policy rate from bank-set prime rate.
- My Impact tab with mortgage, GIC, and debt profile inputs for balance, rate, and renewal or maturity timing.
- RateCompass Core and RateCompass Plus annual plan positioning, both with a 14-day free trial. Core includes 2 active alerts; Plus includes unlimited alerts and saved alert history.
- Profile tab with notification toggles, Data Sources, V1 scope notes, and plan positioning.
- Plus-framed prototype interaction for dragging institution watchlist rows into a custom order.

## Data Note

The app fetches Bank of Canada policy and prime references from the Bank of Canada Valet API. Rate Check benchmarks and consumer comparison rows are loaded from `docs/rates.json` on GitHub Pages and cached on device. Consumer comparison rows are labelled Marketplace unless they are verified directly against an official lender source.

## Refresh Cadence

- Bank of Canada policy and prime references refresh in-app and cache on device.
- The hosted marketplace feed refreshes once per day through `.github/workflows/refresh-rates.yml`.
- The workflow can also be run manually from GitHub Actions before screenshots, App Store submissions, marketing pushes, or Bank of Canada decision days.
- Ratehub, WOWA, and NerdWallet checks are marketplace comparisons, not live lender rates.
- Yahoo Finance Canada pages are checked as market-signal context only, not lender product rates.

Manual local refresh:

```sh
node scripts/refresh-marketplace-feed.mjs
```
