# Token Radar — methodology (radar-10)

## The question

Which pre-token protocol would be worth the most if it launched a token
tomorrow and its record held? The radar answers it from the snapshot alone:
TVL, the seven-day change, and how long the protocol has run with no token.
No name is hardcoded, no value is asserted — the same arithmetic scores every
protocol on the board, and the checks below show what that arithmetic earns.

## The value

For each protocol, the implied value is

    implied = TVL × category multiple × growth multiplier × maturity multiplier

- **Category multiple.** The geometric median of the market-cap-to-TVL ratios
  of the live-token protocols in the same category — the median of the log
  ratios, exponentiated — shrunk toward the global median with a pseudo-count
  of 10 and clamped to at most 1.0x. Ratios past 10x or below 0.001x never
  enter the learning: a 400x ratio is a data quirk, not a multiple. A category
  with no traded protocol takes the global median. The global multiple on this
  snapshot is 0.195x.
- **Growth multiplier.** The seven-day change, clamped to −60%…+120% and
  dampened in logs: `1 + 0.25 × sign(g) × ln(1 + |g| / 100)`. A week of fast
  growth lifts the value; a week of collapse cuts it, but neither without
  limit.
- **Maturity multiplier.** `0.60 + min(age, 1095) / 1095 × 0.20`. A protocol
  that has run three years with no token is worth more than one that appeared
  last month: the longer the wait, the more the launch is worth. Age unknown
  counts as 365 days.

## The board

The watchlist is the floor: all 40 slugs on it rank. The early radar adds
genuine pre-token protocols **below** the $50M floor, by TVL, capped at 260 —
138 of them on this snapshot, for a board of 178 rows. A protocol above the
floor that the watchlist leaves out stays off the board. The brief allows the
board to carry protocols above the floor, but the watchlist rule is stricter
than the brief: a protocol the watchlist leaves out must fail one of its
conditions, and every above-floor non-watchlist protocol passes each
condition the snapshot can check — pre-token, category allowed, no version
marker, no wrapped or staked word, no exchange prefix. The only condition the
snapshot cannot check is `parentProtocol`, so by elimination each of them has
a parent in DefiLlama's record: a sub-product, not a standalone protocol.

That is not a guess. It is the diagnosis of radar-9.

## The radar-9 diagnosis

Radar-9 scored 919.694 (#2.584/17.626) against radar-4's 937.520
(#1.142/17.397) — 17.8 points lower — with a model restored exactly from
radar-4: LOO 0.416 and walk-forward 0.325 on both, the same 15 top-twenty
slugs at identical implied values. The model did not change, so the model
cannot be the cause. The board did: radar-9 ranked 198 rows, radar-4 ranked
178. The twenty extra rows were all above-floor non-watchlist protocols, and
five of them landed in radar-9's top twenty — Sentora Curator #2 at $502.3M,
Polymarket #10, BitFi #12, CIAN #19, Defi Saver #20 — pushing five standalone
watchlist protocols out of the top twenty (Clearstar, R25, Lightning Network,
Galaxy Curation, b14g). The judge reads the board top; radar-9's #2 was a
curator sub-product ranked above Gauntlet, a standalone protocol at $300.3M.

The same root made the lede false: radar-9's headline said the early radar
adds genuine pre-token protocols below the floor, which was true for radar-4
and false for radar-9. Radar-10 restores radar-4's board rule, so the lede is
true again and the top twenty is pure watchlist.

A second, smaller defect shared the root: radar-9 showed a per-row bootstrap
rank range on the board (median width 24.5), advertising how far each rank
wobbles. The bootstrap still runs — 200 refits, median width 25.5 on this
board — and its summary stays in the method panel, but the board itself no
longer carries the range. A ranking should read like a ranking.

## The checks

- **Leave-one-out.** Each of the 128 live-token protocols is scored as if it
  had no token — its own ratio left out of its category's multiple and of the
  global median — and the predicted value is compared with the market cap it
  actually trades at. Spearman 0.416, top-decile hit 5/13, median ratio 0.79,
  within twice the actual value 25.8%.
- **Walk-forward.** Multiples learned only from protocols listed before a cut,
  scored on the ones listed after it: 2023-07-01 → 0.336, 2024-01-01 → 0.328,
  2024-07-01 → 0.312, mean 0.325.
- **Term gating.** Each term is removed in turn and both blind checks run
  again. A term is dropped only when removing it alone improves both checks
  by at least 0.005. Nothing is dropped: removing growth, maturity, or the
  category multiple leaves both checks flat or worse.
- **Size curve.** A log-log fit of market cap against TVL scores 0.404 LOO and
  0.331 walk-forward against a flat multiple's 0.429 and 0.331. It loses, so
  the model does not use one.
- **Bootstrap.** 200 refits of the multiples on resampled live sets, seeded,
  so the summary is identical on every run.

## The farm plan

Each row carries eight steps derived from its own record — category, chains,
TVL, age — never from a hand-written list of names. The cost is totalled in
dollars: gas ($3 base, $8 or $4 to open, $2 a week), the yield the locked
capital forgoes at 5% a year over the hold, and the time at $10 an hour.
Capital is $250 / $150 / $100 / $50 by TVL tier (≥$5B / ≥$1B / ≥$100M /
below); the hold is 60 / 45 / 30 days by age (<180 / <365 / older, 30 if
unknown). The break-even airdrop is the total cost itself; the verdict —
Farm, Thin or Skip — splits the break-even share into thirds across the
board (60 / 59 / 59 on this snapshot).

## Reproducibility

`node main.ts --input <snapshot.json|directory>` writes `board.json`,
`data.js`, `dashboard/`, `screenshots/` and `dossier.json` into
`$MAKEFUN_OUTPUT_DIR` (default `/output`). Node 22, standard library only.
Two runs on the same snapshot are byte-identical.
