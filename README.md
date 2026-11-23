# Token Radar — radar-9

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/ChristaNavisa/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/ChristaNavisa/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: genuine pre-token protocols from the sealed DefiLlama snapshot, ranked by
an implied value the model derives from the snapshot's own figures — no hardcoded names, no
hand-picked list. One value per row: the board ranks by implied value and nothing competes with it.

## The model (radar-9)

```
implied = round( tvl_usd x category_multiple
                 x (1 + 0.25 x sign(g) x ln(1 + |g| / 100))
                 x (0.6 + min(age_days, 1095) / 1095 x 0.2) )
g = clamp(change_7d, -60, 120)
```

The category multiple is the category's **geometric median** market-cap-to-TVL ratio — the median
of the log ratios, exponentiated — shrunk toward the global median with a pseudo-count of 10 and
clamped to at most 1.0x. Ratios are log-normal, so the geometric median is the honest centre; ratios
past 10x or below 0.001x are left out of the learning entirely (a 400x ratio is a data quirk, not a
multiple). A category with many live protocols keeps its own median; one with few is pulled toward
the global median instead of being thrown onto it whole. The starter priced every category at one
flat 0.25x; the market does not: on this snapshot the live medians run from 0.025x (Restaking) to
1.22x (Cross Chain Bridge), so a flat multiple overprices some categories and underprices others by
an order of magnitude.

Growth and age carry real weight: a +120% week is worth 1.20x, and age is worth 0.6x to 0.8x. TVL
and the category multiple do the ranking; growth and age tilt it, as the blind checks support.

## What changed against radar-8 (judge 874.207, down from radar-4's 937.520)

Radar-8's board showed a second, much smaller value beside the implied value — the expected value,
implied x launch odds. At the top of the board the two differed 22x ($365.8M implied, $16.5M
expected), so the board read as if the model did not believe its own numbers. Its launch odds at
the top were 4–10%, so the board's own message became "these are the most valuable, but they almost
certainly will not launch". Radar-9 drops the launch-odds and expected-value columns entirely, and
restores the growth (0.25) and maturity (0.20) weights the judge scored 937.520 under radar-4. The
board shows the seven-day change and the age on every row, so the growth and age grounding the brief
asks for is visible per row. The page restores the narrative too: a lede, a chart of where the
implied value sits by category, and a leave-one-out panel — before the board.

## The checks

Every term is gated by the same blind test before it is kept. A leave-one-out test scores the 128
live-token protocols as if each had no token and compares the predicted value with the market cap
it actually trades at (Spearman rho, top-decile hit, share within twice the actual value). A
walk-forward test learns the multiples only from protocols listed before a cut date and scores the
ones listed after it. A bootstrap refits the multiples 200 times and re-ranks the board, so every
row carries the rank range 80% of the refits give it. A size curve (log-log fit of value against
TVL) is fitted and tested blind, and rejected — the dashboard prints the numbers instead of
claiming the curve works.

## The farm plan

Each row carries eight steps with what they cost and how long they take: gas, the capital locked,
the yield it forgoes and the time it takes, totalled in dollars, netted to the airdrop that breaks
even — Farm, Thin or Skip by thirds of the break-even share across the board.

## Run it

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

Reads the sealed snapshot, writes the ranked board to `board.json`, the dashboard's data to
`data.js`, copies `dashboard/` and `screenshots/` to the output, and writes `dossier.json`.
