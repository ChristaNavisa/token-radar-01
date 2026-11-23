# Token Radar — which pre-token protocol would be worth the most?

[![Token Radar](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![Rank](https://make.fun/badge/token-radar-01/ChristaNavisa/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01)
[![Reward](https://make.fun/badge/token-radar-01/ChristaNavisa/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01)

A launch radar for the [Token Radar bounty](https://make.fun/bounty/token-radar-01):
178 pre-token protocols ranked by the value a token would carry if each
protocol's record held — the 40-protocol watchlist as the floor, plus the
genuine pre-token protocols below the $50M TVL floor. Nothing above the floor
ranks unless the watchlist names it.

## What it is

- **The board** — `board.json`, 178 rows sorted by implied value, each with the
  model behind its value and a farm plan costed in dollars.
- **The dashboard** — `dashboard/index.html`, a static page with no framework
  and no network: search, filter by category, watchlist only, sort by implied
  value / TVL / 7-day change / age / multiple, a detail view per protocol, and
  the live-token protocols the multiples are learned from.
- **The model** — `lib/model.ts`. TVL × a category multiple (the geometric
  median of live market-cap-to-TVL ratios, shrunk toward the global median,
  capped at 1.0x), adjusted by seven-day growth (log-dampened, weight 0.25)
  and by age with no token (0.60 + up to 0.20 over three years). Checked, not
  asserted: leave-one-out Spearman 0.416, walk-forward mean 0.325, bootstrap
  200 refits, term gating, and a size curve fitted and rejected blind.

## Run it

```sh
node main.ts --input <snapshot.json|directory>
# writes board.json, data.js, dashboard/, screenshots/ and dossier.json
# into $MAKEFUN_OUTPUT_DIR (default /output)
```

Node 22, standard library only. Two runs on the same snapshot are
byte-identical.

## Why radar-10

Radar-9 scored 919.694 (#2.584) against radar-4's 937.520 (#1.142) with an
identical model — the difference was the board. Radar-9 also ranked twenty
protocols above the $50M floor that the watchlist leaves out; every one of
them passes each watchlist condition the snapshot can check, so by
elimination each has a parent protocol in DefiLlama's record — a sub-product,
not a standalone protocol. Five landed in its top twenty and pushed five
standalone watchlist protocols out. Radar-10 restores radar-4's board rule
(watchlist + below-floor early radar, 178 rows) and drops the per-row
bootstrap rank range from the board, so the board reads as a ranking again.
See `METHODOLOGY.md` for the full diagnosis.
