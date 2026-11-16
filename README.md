# Token Radar — radar-2

[![make.fun](https://make.fun/badge.svg)](https://make.fun/bounty/token-radar-01)

A token launch radar: 226 pre-token protocols from the sealed DefiLlama snapshot, ranked by
an implied value the model derives from the snapshot's own figures — no hardcoded names, no
hand-picked list.

## The model (radar-2)

```
implied = round( tvl_usd x category_multiple
                 x (1 + clamp(change_7d, -60, 120) / 100 x 0.5)
                 x (0.6 + min(age_days, 1095) / 1095 x 0.4) )
```

The one change from the starter's flat 0.25x: the **category multiple** is the median
market-cap-to-TVL ratio of the live-token protocols in the row's own category, learned from this
snapshot at run time and clamped to 0.05–1.00 (a category with fewer than three live protocols
takes the global median, 0.21x). On this snapshot the live medians run from 0.025x (Restaking)
to 1.22x (Cross Chain Bridge), so one flat multiple overprices some categories and underprices
others by an order of magnitude. Age is the time since DefiLlama first listed the protocol — the
best record of how long it has run with no token.

The board covers all 40 watchlist protocols plus the 186 rankable pre-token protocols below
the $50M floor, by TVL (186 is all there are: every rankable pre-token protocol below the floor
is on the board). The 24 largest live-token protocols are set aside in their own view with
their market caps shown — they are also where the category multiples are learned from.

## The dashboard

- A board ranked by implied value, with a category chart, search, category / chain / minimum-TVL
  filters, a watchlist-only toggle, and sorting by implied value, TVL, growth, age or name.
- A detail view for every protocol: the model's inputs and arithmetic, why it ranks where it
  does, and a seven-step farm plan with costs and times, derived from the protocol's category,
  chains, TVL and age.
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
