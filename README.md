# Token Radar

[![make.fun](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/avriyyy/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/avriyyy/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01)

A token launch radar: it ranks pre-token protocols by what a token would be worth — and shows how to farm each one. Built for the [make.fun token-radar-01 bounty](https://make.fun/bounty/token-radar-01).

Referral code: `vssg6bs5`

## What it does

`main.ts` (Node 22, standard library only) reads one sealed DefiLlama snapshot (`/input/snapshot.json`, 758 protocols as of 2026-11-14) and writes:

- `board.json` — every rankable pre-token protocol (the 40-protocol watchlist plus all early finds below the floor), ranked 1..N by implied value, each with a 6-step farm plan.
- `data.js` — the same board, compact, for the dashboard.
- `dashboard/` — a static page (no network, no framework): sortable/filterable board, a detail view per protocol with the model's factor breakdown, a live-token tab at market values, and a full explainer of the model.
- `dossier.json` — the judge's dossier, built with the kit's `vendor/makefun-board.ts`.

## The model (radar-2)

```
implied = TVL × 0.30 × growth × maturity × chains × category
```

- **growth** — 7-day TVL change clamped to −50%…+150%, weighted ×0.60, floored at ×0.70.
- **maturity** — 0.55 + min(age, 1460d)/1460 × 0.45; unknown age counts as 365 days.
- **chains** — 1 + 0.03 per extra chain, capped at +15%.
- **category** — one multiplier per category (Dexs/Lending 1.15, bridges 0.70, …), applied uniformly — no protocol name is ever special-cased.

The dashboard prints the full formula, the constants and the category table, and every detail view shows the five factors behind its row.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to-snapshot.json>
# then open out/dashboard/index.html in a browser (serve out/ over HTTP)
```

Run it twice and the outputs are byte-identical: the same snapshot always writes the same bytes.

## Caveats

“Records no token” means the snapshot's record carries no token — never that the protocol has none. Implied values are this radar's own model, not a prediction that a token is issued, or when. Farm plans are a starting point: verify every step on the protocol's own official pages before spending anything.
