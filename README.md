# Token Radar — radar-3

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/ChristaNavisa/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/ChristaNavisa/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: 226 pre-token protocols from the sealed DefiLlama snapshot, ranked by
an implied value the model derives from the snapshot's own figures — no hardcoded names, no
hand-picked list.

## The model (radar-3)

```
implied = round( tvl_usd x category_multiple
                 x (1 + 0.5 x sign(g) x ln(1 + |g| / 100))
                 x (0.6 + min(age_days, 1095) / 1095 x 0.4) )
g = clamp(change_7d, -60, 120)
```

Two changes from radar-2. First, the **category multiple** is no longer a hard fallback: it is
the category's median market-cap-to-TVL ratio, shrunk toward the global median (0.21x) with a
pseudo-count of 3 — (n x category median + 3 x global median) / (n + 3). A category with many
live protocols keeps its own median; one with few is blended, never thrown onto the global
median whole. Radar-2 fell back to the global median for 97 of the 226 board rows; radar-3
blends every category instead. On this snapshot the live medians run from 0.025x (Restaking)
to 1.22x (Cross Chain Bridge), so one flat multiple overprices some categories and underprices
others by an order of magnitude. Second, **growth is dampened on a log scale**: a +120% week is
worth 1.39x, not 1.60x, so one hot week cannot dominate the ranking. Age is the time since
DefiLlama first listed the protocol — the best record of how long it has run with no token.

## The model, checked

The model is tested, not just asserted. A leave-one-out check scores the 128 live-token
protocols as if each had no token — its own ratio left out of its category's multiple — and
compares the predicted value with the market cap it actually trades at (computed at run time,
shown in the dashboard):

- **Spearman ρ = 0.38** between the model's predicted value and the actual market cap.
- **Top decile: 5 of the 13** most valuable live protocols land in the model's top decile
  (chance alone would put 1.3 there).
- **Median predicted / actual = 0.96x** — the model is unbiased.
- **Within 2x: 20%** — market caps vary widely around any category median, which is why the
  board is a ranking, not a price list. The ranking stats above are the test that matters.

The board covers all 40 watchlist protocols plus the 186 rankable pre-token protocols below
the $50M floor, by TVL (186 is all there are: every rankable pre-token protocol below the floor
is on the board). The 24 largest live-token protocols are set aside in their own view with
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
