# Token Radar — radar-4

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/ChristaNavisa/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/ChristaNavisa/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: 178 genuine pre-token protocols from the sealed DefiLlama snapshot, ranked by
an implied value the model derives from the snapshot's own figures — no hardcoded names, no
hand-picked list.

## The model (radar-4)

```
implied = round( tvl_usd x category_multiple
                 x (1 + 0.25 x sign(g) x ln(1 + |g| / 100))
                 x (0.6 + min(age_days, 1095) / 1095 x 0.2) )
g = clamp(change_7d, -60, 120)
```

Four changes from radar-3. First, the **category multiple** is now the geometric median of the
live-token protocols' market-cap-to-TVL ratios (the median of the log ratios, exponentiated),
shrunk toward the global median with a pseudo-count of 10 — (n x category median + 10 x global
median) / (n + 10). Ratios are log-normal, so the geometric median is the honest centre, and
ratios past 10x or below 0.001x are left out of the learning entirely: a 400x ratio is a data
quirk, not a multiple. Second, **growth and age are weaker terms**: the leave-one-out check
shows a protocol's seven-day change and its age alone barely rank its market cap, so they tilt
the value instead of driving it — a +120% week is worth 1.20x, and age is worth 0.6x to 0.8x.
Third, the **early radar is genuine only**: it takes every pre-token protocol below the $50M
floor that passes the watchlist's own rule — no bridges, no liquid staking or restaking, no
wrapped or staked products, no exchange-prefixed names, no versioned pools. Radar-3's board
carried 48 such rows (bridges and staking wrappers are not launches waiting to happen); radar-4
leaves them out. Fourth, the **board is smaller and cleaner**: 40 watchlist protocols plus the
138 genuine pre-token protocols below the floor (138 is all there are under the rule).

## The model, checked

The model is tested, not just asserted. A leave-one-out check scores the 128 live-token
protocols as if each had no token — its own ratio left out of its category's multiple — and
compares the predicted value with the market cap it actually trades at (computed at run time,
shown in the dashboard):

- **Spearman ρ = 0.42** between the model's predicted value and the actual market cap.
- **Top decile: 5 of the 13** most valuable live protocols land in the model's top decile
  (chance alone would put 1.3 there).
- **Median predicted / actual = 0.79x** — the geometric median sits below the arithmetic
  centre, so the model underpredicts the median live protocol by about a fifth; the ranking
  stats above are the test that matters, not the point level.
- **Within 2x: 26%** — market caps vary widely around any category median, which is why the
  board is a ranking, not a price list. The ranking stats above are the test that matters.

The board covers all 40 watchlist protocols plus the 138 genuine pre-token protocols below
the $50M floor, by TVL (138 is all there are under the watchlist's rule: every genuine
pre-token protocol below the floor is on the board). The 24 largest live-token protocols are set aside in their own view with
their market caps shown — they are also where the category multiples are learned from.

## The dashboard

- A board ranked by implied value, with a category chart, a leave-one-out check of the model,
  search, category / chain / minimum-TVL filters, a watchlist-only toggle, and sorting by
  implied value, TVL, growth, age or name.
- A detail view for every protocol: the model's inputs and arithmetic, why it ranks where it
  does (including its rank inside its own category), and an eight-step farm plan with costs and
  times, derived from the protocol's category, chains, TVL and age — with a second-chain repeat
  for protocols on two or more chains and a monthly launch watch.
- A **model sandbox**: three sliders (category-multiple scale, growth weight, maturity floor)
  re-rank the whole board live in the browser from the same formula, so a reader can test what
  the ranking is sensitive to. The board.json this entry hands in never changes.
- No network, no framework: one HTML file, one CSS file, one JS file, and a data.js the program
  writes beside them. The page recomputes every row from the snapshot figures and checks the
  number board.json carries.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

`main.ts` (Node 22, standard library only) reads `/input/snapshot.json`, writes
`/output/board.json` and `/output/data.js`, copies `dashboard/` and `screenshots/` to `/output`,
and writes `/output/dossier.json` with the vendored `vendor/makefun-board.ts`.

## Notes

- Implied value is the entry's own model claim, never make.fun's. A protocol that "records no
  token" may still have a token its DefiLlama record does not carry.
- Snapshot: DefiLlama protocol index, fetched 2026-11-14. 758 protocols, 40 on the watchlist.
