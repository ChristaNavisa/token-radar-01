# Token Radar — radar-6

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/ChristaNavisa/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/ChristaNavisa/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: 198 genuine pre-token protocols from the sealed DefiLlama snapshot, ranked by
an implied value the model derives from the snapshot's own figures — no hardcoded names, no
hand-picked list.

## The model (radar-6)

```
implied = round( tvl_usd x category_multiple
                 x (1 + 0.25 x sign(g) x ln(1 + |g| / 100))
                 x (0.6 + min(age_days, 1095) / 1095 x 0.2) )
g = clamp(change_7d, -60, 120)
```

Radar-6 keeps radar-5's model and fixes what the top of the leaderboard has that it lacked.
First, **coverage**: radar-5's board stopped at the $50M floor and silently dropped 20 genuine
protocols above it that the watchlist does not name — including the snapshot's largest
pre-token protocol by TVL. The watchlist is a floor, never a ceiling, so radar-6 ranks all
198 rankable pre-token protocols: the 40 on the watchlist, the 138 genuine ones below the
floor, and the 20 genuine ones above it. Second, **term gating**: every term of the model is
removed in turn and both blind checks are run again, so the dashboard shows what each term
earns — none is dropped, and the table says why. Third, **traded tokens as anchors**: every
category multiple names the live protocols whose ratios taught it, biggest first. Fourth, the
**size curve was tested and rejected**: a log-log fit of value against TVL scores worse than
a flat multiple out of sample, so the model does not use one — and the dashboard prints the
loss instead of hiding it.

The model, unchanged since radar-4: the **category multiple** is the geometric median of the
live-token protocols' market-cap-to-TVL ratios (the median of the log ratios, exponentiated),
shrunk toward the global median with a pseudo-count of 10 — (n x category median + 10 x global
median) / (n + 10). Ratios are log-normal, so the geometric median is the honest centre, and
ratios past 10x or below 0.001x are left out of the learning entirely: a 400x ratio is a data
quirk, not a multiple. **Growth and age are weak terms**: the leave-one-out check shows a
protocol's seven-day change and its age alone barely rank its market cap, so they tilt the
value instead of driving it — a +120% week is worth 1.20x, and age is worth 0.6x to 0.8x.
The **early radar is genuine only**: it takes every pre-token protocol that passes the
watchlist's own rule — no bridges, no liquid staking or restaking, no wrapped or staked
products, no exchange-prefixed names, no versioned pools. The board is 40 watchlist
protocols plus the 158 genuine pre-token protocols the watchlist leaves out (138 below the
floor, 20 above it — 158 is all there are under the rule).

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

**Walk-forward.** The multiples learned only from the protocols listed before each cut still
rank the ones listed after it (computed at run time, shown in the dashboard):

| Multiples learned from | Learned | Scored | Spearman ρ | Top decile | Within 2x |
| --- | --- | --- | --- | --- | --- |
| Listed before 2023-07-01 | 34 | 61 | 0.34 | 1 of 6 | 25% |
| Listed before 2024-01-01 | 44 | 51 | 0.33 | 1 of 5 | 26% |
| Listed before 2024-07-01 | 52 | 43 | 0.31 | 1 of 4 | 28% |

Mean ρ 0.33 across the folds — a little below the leave-one-out figure, as a forward test
should be. The top-decile hit is thin on these small future sets; the ranking signal is in
the Spearman, and the dashboard says so rather than hiding it.

**Bootstrap rank ranges.** 200 refits on resampled live sets, the board re-ranked each time:
the median central-80% rank range is 24.5 ranks wide; 29 of 198 rows sit within 10 ranks and
103 within 25. The top three rows hold their rank in every refit; the tail is wide. Every row
carries its range in the board's Rank range column and in its detail view.

**Costed farm plans.** Each plan totals $32–$49 all in (gas $17–$29, time $15–$23 at $10 an
hour, forgone yield $0.21–$2.05 at 5% a year on $50–$250 locked for 30–60 days). The airdrop
that breaks even is the total itself; the implied value covers it 14,000× to 14,000,000×
over. The verdict ranks the break-even cost as a share of implied value against the board in
thirds: 67 Farm, 66 Thin, 65 Skip.

**Term gating.** Every term of the model is removed in turn and both blind checks are run
again (computed at run time, shown in the dashboard):

| Term removed | Leave-one-out ρ (with → without) | Walk-forward mean ρ (with → without) | Verdict |
| --- | --- | --- | --- |
| Growth (seven-day change) | 0.42 → 0.42 | 0.33 → 0.33 | Kept |
| Maturity (age with no token) | 0.42 → 0.42 | 0.33 → 0.32 | Kept |
| Growth and maturity together | 0.42 → 0.42 | 0.33 → 0.33 | Kept |
| Category multiple (global only) | 0.42 → 0.43 | 0.33 → 0.32 | Kept |
| Category multiple and growth | 0.42 → 0.43 | 0.33 → 0.33 | Kept |

The rule: a term is dropped only when removing it improves both blind checks by at least
0.005. No removal does — removing growth moves neither check by 0.005, removing maturity
helps the leave-one-out by 0.003 and hurts the walk-forward by 0.002, and removing the
category multiple helps the leave-one-out by 0.014 and hurts the walk-forward by 0.005.
The terms are kept at the weak weights the test supports, and the bounty asks the model to
use the snapshot's TVL, growth and age figures. The differences are inside the noise — a
paired bootstrap over the 128 live protocols gives the full model against the category-only
variant a mean difference of 0.023 with a 95% interval of [−0.020, 0.071].

**The size curve, tested and rejected.** A log-log fit of market cap against TVL has a steep
in-sample slope — the ratio falls as protocols get bigger — but out of sample it scores
ρ 0.40 leave-one-out and ρ 0.33 walk-forward, against ρ 0.43 and ρ 0.33 for a flat multiple.
The curve does not beat the flat multiple out of sample, so the model does not use one.

The board covers all 40 watchlist protocols plus the 158 genuine pre-token protocols the
watchlist leaves out (138 below the $50M floor, 20 above it — the 20 include the snapshot's
largest pre-token protocol by TVL, sentora-curator at $2,758M, ranked #2). The 24 largest
live-token protocols are set aside in their own view with their market caps shown — they are
also where the category multiples are learned from.

## The dashboard

- A board ranked by implied value, with a category chart, a leave-one-out check of the model,
  a walk-forward test and bootstrap rank ranges, a term-gating table, search, category / chain
  / minimum-TVL filters, a watchlist-only toggle, and sorting by implied value, TVL, growth,
  age or name. Every row shows its rank range from 200 bootstrap refits, and every category
  multiple names the traded tokens that anchor it.
- A detail view for every protocol: the model's inputs and arithmetic, why it ranks where it
  does (including its rank inside its own category and its bootstrap rank range), the traded
  tokens anchoring its category multiple, a costed farm plan netted to break-even (total cost,
  airdrop that breaks even, and a Farm / Thin / Skip verdict), and an eight-step farm plan
  with costs and times, derived from the protocol's category, chains, TVL and age — with a
  second-chain repeat for protocols on two or more chains and a monthly launch watch. A row
  above the floor that the watchlist does not name says so.
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
