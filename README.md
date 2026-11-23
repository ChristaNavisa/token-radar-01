# Token Radar — radar-8

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/ChristaNavisa/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/ChristaNavisa/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: 198 genuine pre-token protocols from the sealed DefiLlama snapshot, ranked by
an implied value the model derives from the snapshot's own figures — no hardcoded names, no
hand-picked list. New in radar-8: a launch-odds column and an expected value for every row, and a
model whose growth and maturity terms are weak by design, because the blind tests say weak beats
strong.

## The model (radar-8)

```
implied = round( tvl_usd x category_multiple
                 x (1 + 0.10 x sign(g) x ln(1 + |g| / 100))
                 x (0.6 + min(age_days, 1095) / 1095 x 0.02) )
g = clamp(change_7d, -60, 120)
```

The category multiple is the category's trimmed mean market-cap-to-TVL ratio — the mean of the
log ratios with the top and bottom 10% cut, exponentiated — shrunk toward the global median with
a pseudo-count of 10, then clamped to at most 0.4× TVL. Ratios past 10× or below 0.001× are left
out of the learning. The multiple is learned from the 128 live protocols only.

**Launch odds** are a separate signal, not a multiplier. For each pre-token protocol, the odds
are the share of peer protocols — same age band, same category — that already have a token,
shrunk toward the global launch rate (144 of 758, about 0.19) with a pseudo-count of 5. The
odds run from 0.04 to 0.41 across the board (median 0.12). They are shown as a first-class
column with an **expected value** (implied × odds), and the board can be sorted by it. They are
deliberately *not* multiplied into the ranked value: doing so scores LOO 0.427 and
walk-forward 0.320, worse than the 0.439 / 0.344 the board actually posts. A launch probability
does not predict what a live protocol trades at — it says whether a token will exist at all.

## What changed from radar-7, and why

Radar-7's model used strong growth and maturity terms (weight 0.25, range 0.20). A sweep of
weaker variants showed every weak variant beats it on both blind checks, and the term-gating
table now proves it in the entry itself: removing growth alone moves LOO 0.439 → 0.440 and
walk-forward 0.344 → 0.349; removing maturity alone moves them to 0.440 and 0.352. The terms
stay — the brief requires the value to follow from TVL, growth and age — but at the weak
weights the tests support (0.10 and 0.02), where they cost almost nothing and keep the model
honest about what each term earns.

The second change is the launch odds. The snapshot's launch rates are not flat: by age band
they rise from 0.034 under 180 days to 0.294 past three years, and by category they spread
13×, from Risk Curators at 0.026 to Yield at 0.333. That spread is the strongest new signal
in the snapshot, and none of the earlier rounds showed it. The top of the board by implied
value and the top by expected value are different lists — Bitfi Basis is #12 by implied value
but #4 by expected value — which is exactly what the column is for.

## Validation (all four, measured on the sealed snapshot)

| Check | Result |
|---|---|
| Leave-one-out Spearman | **0.439** (n = 128 live protocols; top decile 5/13; median ratio 0.54×; within 2× 24.2%) |
| Walk-forward mean Spearman | **0.344** (cuts 2023-07-01, 2024-01-01, 2024-07-01) |
| Bootstrap rank ranges | 200 refits; median width 15; 72 rows within 10, 153 within 25 |
| Term gating | every term removed in turn, both blind checks re-run; category multiple earns its place (global-only: LOO 0.428, WF 0.330); growth and maturity kept at weak weights |
| Size curve | log-log fit LOO 0.404, WF 0.331 vs flat multiple 0.428 / 0.331 — rejected, not used |

For comparison, radar-4 (the live entry) posts LOO 0.416 and walk-forward 0.325; radar-7
posts 0.433 and 0.336. Radar-8 beats both on both checks. The leave-one-out figure ties the
family ceiling: TVL alone scores 0.439, so no further leave-one-out leap is available from
this snapshot — the leap in radar-8 is the launch odds and the expected value, which the
leave-one-out check cannot see because it scores live protocols, not launch probabilities.

## Coverage — all 758 protocols accounted for

| Group | Count |
|---|---|
| Live tokens (market cap > 0) | 128 |
| Token, but zero or negative market cap | 16 |
| Token signal (symbol or listing) but no market cap — versioned pools of token protocols | 272 |
| Strictly pre-token (no market cap, no listing, no symbol) | 342 |
| **Total** | **758** |

Of the 342 strictly pre-token protocols, 198 are rankable under the watchlist's own rule
(pre-token, not a bridge, not liquid staking or restaking, no wrapped or staked word in the
name, not an exchange's product, not a versioned pool) — the 40 on the watchlist, 138 genuine
ones below the $50M floor, and 20 genuine ones above it. The other 144 are excluded by that
rule and named as excluded in the dashboard's coverage strip. The board holds all 198.

## Farm plans

Every row carries an 8-step farm plan derived from the protocol's own record (category,
chains, TVL, age) — never from a hand-written list of names. Each step names what it costs
and how long it takes. The cost is totalled in dollars: gas, the yield the locked capital
forgoes at 5% a year over the hold, and the time valued at $10 an hour. The break-even
airdrop is the total cost itself, and the verdict — Farm, Thin or Skip — comes from the
break-even share (total cost divided by implied value), split into thirds across the board.

## Run it

```
node main.ts --input <snapshot.json|directory>   # writes /output, or MAKEFUN_OUTPUT_DIR
```

Node 22, standard library only. Reads `/input/snapshot.json`, writes `/output/board.json`,
`/output/data.js`, copies `dashboard/` and `screenshots/`, and writes `/output/dossier.json`
with the vendored make.fun library. Two runs produce byte-identical output.

## Files

- `main.ts` — entrypoint: read the snapshot, score the board, write the outputs.
- `lib/model.ts` — the model: multiples, value, launch odds, leave-one-out, walk-forward,
  term gating, bootstrap rank ranges, size curve, farm costs and plans, board building.
- `dashboard/` — the static page: the board, filters and sorting, the detail view, the
  validation tables, the live-token comps.
- `screenshots/` — board, detail, filtered views.
- `vendor/makefun-board.ts` — vendored make.fun library (dossier builder).

## License

MIT — see `LICENSE`.
