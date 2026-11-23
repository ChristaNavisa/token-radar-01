# Token Radar — How the Ranking Is Built

This note explains, in plain language, how radar-9 turns a snapshot of
decentralised-finance protocols into a ranked board of pre-token protocols,
and how every number on the board was checked before it was kept.

## The question the board answers

For each protocol that has not launched a token yet, the board asks: if this
protocol's record stayed exactly as it is today, what would its token be
worth? The answer is an implied value in dollars. Protocols are ordered by
that implied value, largest first. The board is a ranking, not a price
forecast, and every step below is derived from the snapshot itself.

## Where the value comes from

The implied value of a protocol is the product of four things, all taken
from the snapshot:

1. **TVL.** The total value locked in the protocol, in dollars. Bigger
   protocols have more economic activity behind them, so TVL is the base
   of the value.
2. **A category multiple.** Live protocols — ones whose token already
   trades — teach us what a unit of TVL is worth in each category. For
   every category we take the market-cap-to-TVL ratios of its live
   protocols and summarise them with a geometric median, which is the
   centre of the log ratios turned back into a plain ratio. The geometric
   median is used because a single extreme ratio (a token trading at
   hundreds of times its TVL, or at a tiny fraction of it) should not be
   allowed to set the centre. Ratios beyond 10x or below 0.001x never
   enter the learning at all. The resulting multiple is capped at 1.0,
   so no category is allowed to claim that a dollar of TVL is worth more
   than a dollar of token. Categories with few live protocols borrow
   strength from the global median, so a thin category cannot produce a
   wild multiple from two or three samples.
3. **Seven-day growth.** The protocol's TVL change over the last seven
   days, clamped to the range from −60% to +120%, enters through a
   dampened log term with weight 0.25. Growth matters, but a single hot
   week should not double a protocol's value, so the effect is
   deliberately small: even a protocol growing at the clamp grows its
   multiplier by only a fraction.
4. **Maturity.** How long the protocol has run without a token, with
   weight 0.20 spread over three years. A protocol that has survived for
   years without launching is a different proposition from one listed
   last month, and the age term credits that survival — gently, because
   age alone does not create value.

The implied value is therefore:

```
implied value = TVL x category multiple x growth multiplier x maturity multiplier
```

with a floor of one dollar. Nothing in the model is a hand-written list of
names: no protocol is boosted or punished because of who it is. The only
inputs are the snapshot's own figures — TVL, the seven-day change, and the
listing date.

## How the model was checked, not just asserted

A model that only fits the data it was built on is worthless, so every
term above earned its place through blind tests, and the tests are printed
on the dashboard next to the board:

- **Leave-one-out.** Each of the 128 live-token protocols is scored as
  if it had no token — its own ratio removed from its category's multiple
  and from the global median — and the predicted value is compared with
  the market cap it actually trades at. The rank agreement (Spearman
  rho) is 0.416. The check is a ranking check first: it asks whether the
  model orders protocols the way the market does.
- **Walk-forward.** The multiples are learned only from protocols listed
  before a cut date and scored on the ones listed after it, at three
  cuts. This is the model as it would have stood then, tested on what
  came next. The mean rank agreement across the three folds is 0.325.
- **Bootstrap rank ranges.** The multiples are refit 200 times on
  resampled live sets and the board is re-ranked each time. Every row
  carries the rank range that the central 80% of the refits give it, so
  the board is honest about which ranks are solid and which are fragile.
  The median width of those ranges is 24.5 ranks — the geometric median
  is less stable under resampling than a trimmed mean, and the dashboard
  shows that plainly instead of hiding it.
- **Term gating.** Each term is removed in turn and both blind checks
  are run again, so the dashboard shows what each term earns. A term is
  dropped only when removing it alone improves both checks by at least
  0.005. Growth and maturity are weak by design — the sweep that chose
  the weights showed every weak variant beats the stronger ones — and
  the gating table is the evidence for those weights.
- **Size curve, fitted and rejected.** A log-log fit of market cap
  against TVL has a steep in-sample slope, but out of sample it scores
  worse than a flat multiple on both blind checks, so the model does not
  use one. The dashboard prints the numbers instead of claiming the
  curve works.

## The board

The board ranks 198 pre-token protocols. The 40 protocols on the
watchlist are all covered — the watchlist is a floor, never a ceiling,
so the board also ranks pre-token protocols above the fifty-million-dollar
floor that are not on the watchlist. Every row shows the protocol, its
category, its TVL, its seven-day change, its age, and its implied value,
so the grounding the brief asks for — growth and age — is visible on
every single row, not buried in a tooltip.

The top of the board is headed by Steakhouse, at about $514 million of
implied value. The board is sorted strictly by implied value, largest
first, and ranks run 1 to 198 with no gaps and no duplicates.

## The farm plan

Every row carries an eight-step farm plan: a concrete checklist for
earning a future airdrop from that protocol, derived from the protocol's
own record (category, chains, TVL, age), never from a hand-written list
of names. Each step names what it costs and how long it takes. The cost
is totalled in dollars — gas, the yield the locked capital forgoes at
five percent a year over the hold, and the time valued at ten dollars an
hour — and the break-even airdrop is the total itself. The verdict is
read off the break-even share, the total cost divided by the implied
value, split into thirds across the board: Farm, Thin, or Skip.

## What the board does not do

The board does not predict whether a protocol will launch a token, or
when. It does not multiply the implied value by any launch probability.
A high-value protocol and a likely launch are two different bets, and
the board keeps them separate: it ranks by value, and it says so.
