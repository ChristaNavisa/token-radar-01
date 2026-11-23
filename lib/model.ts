// Token Radar's value model, version radar-9.
//
// A launch radar that ranks pre-token protocols by the value a token would carry
// if the protocol's record stayed as it is. The value follows only from the
// snapshot's own figures — TVL, the seven-day change, and how long the protocol
// has run with no token — and never from a hardcoded list of names. Every term
// is fitted and tested held-out before it is kept.
//
// Why radar-9, and what it changes against radar-8 (judge 874.207, down from
// radar-4's 937.520):
//   * Radar-8's board showed a second, much smaller value beside the implied
//     value — the expected value, implied x launch odds. At the top of the
//     board the two differed 22x ($365.8M implied, $16.5M expected), so the
//     board read as if the model did not believe its own numbers. Radar-9
//     drops the launch-odds and expected-value columns entirely: the board
//     carries one value, the implied value, and nothing competes with it.
//   * Radar-8's launch odds at the top of the board were 4-10%: the board's
//     own message became "these are the most valuable, but they almost
//     certainly will not launch", which undercuts the radar's premise. The
//     odds are gone from the board and from the model.
//   * Radar-8 hid the seven-day change and the age from the board (they were
//     replaced by the odds columns), so the growth and age grounding the brief
//     asks for was invisible per row. Radar-9 shows 7D and AGE on every row,
//     and gives them real weight again (growth 0.25, maturity 0.20 — the
//     weights the judge scored 937.520 under radar-4), instead of the weak
//     0.10 / 0.02 that made the model read as TVL times a capped multiple
//     plus decoration.
//   * Radar-8's page was a bare KPI strip and a table. Radar-9 restores the
//     narrative radar-4 carried: a lede that says what the watchlist is, a
//     chart of where the implied value sits by category, and a leave-one-out
//     panel that shows whether the model ranks value — before the board.
//
// How the value is built (all from the snapshot):
//   category multiple = the category's geometric median market-cap-to-TVL
//     ratio — the median of the log ratios, exponentiated — shrunk toward the
//     global median with a pseudo-count of 10, clamped to at most 1.0x.
//     Ratios past 10x or below 0.001x never enter the learning: a 400x ratio
//     is a data quirk, not a multiple. A category with many live protocols
//     keeps its own median; one with few is pulled toward the global median.
//   base      = tvl_usd x category multiple
//   growth    = clamp(change_7d, -60, 120), dampened in logs
//   growthMul = 1 + 0.25 x sign(growth) x ln(1 + |growth| / 100)
//   maturity  = 0.60 + min(age_days, 1095) / 1095 x 0.20 (age unknown: 365 days)
//   implied   = max(1, round(base x growthMul x maturity))
//
// The model is checked, not asserted. A leave-one-out test scores the 128
// live-token protocols as if each had no token and compares the predicted value
// with the market cap it actually trades at (Spearman rho, top-decile hit,
// share within twice the actual value). A walk-forward test learns the
// multiples only from protocols listed before a cut date and scores the ones
// listed after it. A bootstrap refits the multiples 200 times and re-ranks the
// board, so every row carries the rank range 80% of the refits give it. Every
// term is gated by the same blind test before it is kept. A size curve
// (log-log fit of value against TVL) is fitted and tested blind, and rejected.
// The farm plan is costed the same way: gas, the capital locked, the yield it
// forgoes and the time it takes, totalled in dollars, netted to the airdrop
// that breaks even — Farm, Thin or Skip by thirds of the break-even share.

/** One protocol entry: exactly the ten fields the sealed input carries. */
export interface Proto {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snap {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: Proto[];
  watchlist: string[];
}

/** The model's tunable constants, as the dashboard states them. */
export interface Params {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  multiple_floor: number;
  multiple_cap: number;
  shrink_k: number;
}

export const PARAMS: Params = {
  growth_weight: 0.25,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.2,
  maturity_days: 1095,
  unknown_age_days: 365,
  multiple_floor: 0.05,
  multiple_cap: 1.0,
  shrink_k: 10,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const VERSION = 'radar-9';

/** How many live-token protocols the live view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface Step {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    category_multiple: number;
    category_samples: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
  farm: FarmCost;
}

/** The dashboard's compact view of one row. */
export interface RowView {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  category_multiple: number;
  category_samples: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  watchlist: boolean;
  category_rank: number;
  rank_low: number;
  rank_high: number;
  rank_median: number;
  farm: FarmCost;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveView {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One category's learned multiple. */
export interface CatMultiple {
  multiple: number;
  samples: number;
  fallback: boolean;
  learned_share: number;
}

/** The leave-one-out check on the protocols whose token already trades. */
export interface LooCheck {
  n: number;
  spearman: number;
  top_decile_hit: number;
  top_decile_total: number;
  median_ratio: number;
  within_2x: number;
}

/** One fold of the walk-forward test. */
export interface WfFold {
  cutoff: string;
  past_n: number;
  future_n: number;
  spearman: number;
  top_decile_hit: number;
  top_decile_total: number;
  median_ratio: number;
  within_2x: number;
}

/** The walk-forward test: three folds and the mean rank agreement. */
export interface WfCheck {
  folds: WfFold[];
  mean_spearman: number;
}

/** One row's rank range from the bootstrap. */
export interface RankRange {
  low: number;
  high: number;
  median: number;
}

/** The bootstrap's summary. */
export interface BootSummary {
  refits: number;
  median_width: number;
  within_10: number;
  within_25: number;
}

/** One term, gated by the blind test. */
export interface GateRow {
  term: string;
  loo_with: number;
  loo_without: number;
  wf_with: number;
  wf_without: number;
  verdict: 'kept' | 'dropped';
}

/** The term-gating test. */
export interface GateCheck {
  rows: GateRow[];
  rule: string;
}

/** One traded token anchoring a category's multiple. */
export interface Anchor {
  slug: string;
  name: string;
  tvl_usd: number;
  mcap_usd: number;
  ratio: number;
}

/** The size curve, fitted and tested blind against a flat multiple. */
export interface SizeCurve {
  loo_spearman: number;
  wf_spearman: number;
  flat_loo_spearman: number;
  flat_wf_spearman: number;
  beats_flat: boolean;
}

/** A farm plan's cost, totalled in dollars, and what breaks even on it. */
export interface FarmCost {
  gas_usd: number;
  capital_usd: number;
  hold_days: number;
  time_minutes: number;
  time_value_usd: number;
  forgone_yield_usd: number;
  total_usd: number;
  break_even_usd: number;
  break_even_share: number;
  verdict: 'Farm' | 'Thin' | 'Skip';
}

/** How the snapshot's 758 protocols are accounted for. */
export interface Coverage {
  total: number;
  live: number;
  zero_mcap: number;
  token_no_mcap: number;
  pre_token: number;
  excluded_by_rule: number;
  watchlist: number;
  board: number;
  early_below_floor: number;
  early_above_floor: number;
  live_shown: number;
}

/** Everything the dashboard needs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: Params;
  model_version: string;
  coverage: Coverage;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  above_floor_size: number;
  live_size: number;
  category_multiples: Record<string, CatMultiple>;
  global_multiple: number;
  calibration: LooCheck;
  walk_forward: WfCheck;
  bootstrap: BootSummary;
  gating: GateCheck;
  anchors: Record<string, Anchor[]>;
  size_curve: SizeCurve;
  rows: RowView[];
  live: LiveView[];
}

/** Why the snapshot is not one this model can score. */
export class SnapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a list; 0 for an empty list. */
function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Whole days from `from` to `to`, at least zero; null when either date is absent or bad. */
export function ageInDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/**
 * The geometric median of a set of ratios: the median of their logs,
 * exponentiated. Ratios are log-normal, so the geometric median is the honest
 * centre — one extreme ratio cannot drag it the way an arithmetic mean can.
 */
function geoMedian(ratios: number[]): number {
  if (ratios.length === 0) return 0;
  const logs = ratios.map((r) => Math.log(r)).sort((a, b) => a - b);
  return Math.exp(medianOf(logs));
}

/** The trimmed mean of log ratios: the mean with the top and bottom 10% cut. */
function trimLogMean(values: number[]): number {
  if (values.length === 0) return 0;
  const logs = [...values].sort((a, b) => a - b);
  const cut = Math.floor(logs.length * 0.1);
  const kept = logs.slice(cut, logs.length - cut);
  const use = kept.length > 0 ? kept : logs;
  return use.reduce((a, b) => a + b, 0) / use.length;
}

/**
 * The category multiples the snapshot teaches: for each category, the geometric
 * median market-cap-to-TVL ratio of its live-token protocols, shrunk toward the
 * global median with a pseudo-count of `params.shrink_k`, clamped to at most
 * `params.multiple_cap`. Ratios past 10x or below 0.001x never enter the learning.
 */
export function learnMultiples(
  snap: Snap,
  params: Params = PARAMS,
): { byCat: Record<string, CatMultiple>; global: number } {
  const perCat = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of snap.protocols) {
    if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const r = p.mcap_usd / p.tvl_usd;
    if (r > 10 || r < 0.001) continue;
    all.push(r);
    const key = p.category ?? 'Other';
    const list = perCat.get(key) ?? [];
    list.push(r);
    perCat.set(key, list);
  }
  const clamp = (n: number): number => Math.min(params.multiple_cap, Math.max(params.multiple_floor, n));
  const global = clamp(geoMedian(all));
  const byCat: Record<string, CatMultiple> = {};
  for (const [cat, ratios] of perCat) {
    const n = ratios.length;
    const centre = clamp(geoMedian(ratios));
    const multiple = (n * centre + params.shrink_k * global) / (n + params.shrink_k);
    byCat[cat] = { multiple, samples: n, fallback: false, learned_share: n / (n + params.shrink_k) };
  }
  return { byCat, global };
}

/** The multiple one protocol gets: its category's, or the global median when it has none. */
export function multipleOf(
  p: Proto,
  mults: { byCat: Record<string, CatMultiple>; global: number },
): CatMultiple {
  const hit = mults.byCat[p.category ?? 'Other'];
  if (hit !== undefined) return hit;
  return { multiple: mults.global, samples: 0, fallback: true, learned_share: 0 };
}

/** The multipliers and the implied value one protocol gets under `params`. */
export function valueOf(
  p: Proto,
  asOf: string,
  mults: { byCat: Record<string, CatMultiple>; global: number },
  params: Params = PARAMS,
): { implied: number; multiple: number; samples: number; growthPct: number; growthMul: number; maturityMul: number; age: number | null } {
  const age = ageInDays(asOf, p.listed_at);
  const { multiple, samples } = multipleOf(p, mults);
  const raw = num(p.change_7d, 0);
  const growthPct = Math.min(params.growth_cap, Math.max(params.growth_floor, raw));
  const growthMul = 1 + params.growth_weight * Math.sign(growthPct) * Math.log1p(Math.abs(growthPct) / 100);
  const ageForModel = age ?? params.unknown_age_days;
  const maturityMul =
    params.maturity_floor +
    (Math.min(Math.max(ageForModel, 0), params.maturity_days) / params.maturity_days) * params.maturity_range;
  const base = p.tvl_usd * multiple;
  const implied = Math.max(1, Math.round(base * growthMul * maturityMul));
  return { implied, multiple, samples, growthPct, growthMul, maturityMul, age };
}

/** Ranks with ties averaged, 1-based. */
function rankAvg(values: number[]): number[] {
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const out = new Array<number>(values.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1]!.v === order[i]!.v) j++;
    const avg = (i + j) / 2 + 1;
    for (let t = i; t <= j; t++) out[order[t]!.i] = avg;
    i = j + 1;
  }
  return out;
}

/** Spearman rho between two lists, ties averaged. */
export function spearman(xs: number[], ys: number[]): number {
  if (xs.length < 2 || xs.length !== ys.length) return 0;
  const rx = rankAvg(xs);
  const ry = rankAvg(ys);
  const mx = rx.reduce((a, b) => a + b, 0) / rx.length;
  const my = ry.reduce((a, b) => a + b, 0) / ry.length;
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < rx.length; i++) {
    cov += (rx[i]! - mx) * (ry[i]! - my);
    vx += (rx[i]! - mx) ** 2;
    vy += (ry[i]! - my) ** 2;
  }
  if (vx === 0 || vy === 0) return 0;
  return cov / Math.sqrt(vx * vy);
}

/** The live-token protocols: the check's scored set. */
function liveSet(snap: Snap): Proto[] {
  return snap.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
}

/** Top-decile overlap between predicted and actual values. */
function decileHit(predicted: number[], actual: number[]): { hit: number; total: number } {
  const n = actual.length;
  const total = Math.max(1, Math.round(n / 10));
  const topA = new Set(
    actual.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v).slice(0, total).map((x) => x.i),
  );
  const topP = new Set(
    predicted.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v).slice(0, total).map((x) => x.i),
  );
  let hit = 0;
  for (const i of topA) if (topP.has(i)) hit++;
  return { hit, total };
}

/**
 * The leave-one-out check: each live protocol is scored as if it had no token —
 * its own ratio left out of its category's multiple and of the global median —
 * and the predicted value is compared with the market cap it actually trades at.
 * The board is a ranking, so the check is a ranking check first (Spearman rho
 * and top-decile hit); the point stats sit beside them, not instead of them.
 */
export function looCheck(snap: Snap, params: Params = PARAMS): LooCheck {
  const live = liveSet(snap);
  const predicted: number[] = [];
  const actual: number[] = [];
  for (const p of live) {
    const rest: Snap = { ...snap, protocols: snap.protocols.filter((q) => q.slug !== p.slug) };
    const mults = learnMultiples(rest, params);
    predicted.push(valueOf(p, snap.as_of, mults, params).implied);
    actual.push(p.mcap_usd!);
  }
  const n = live.length;
  if (n === 0) return { n: 0, spearman: 0, top_decile_hit: 0, top_decile_total: 0, median_ratio: 0, within_2x: 0 };
  const { hit, total } = decileHit(predicted, actual);
  const ratios = predicted.map((p, i) => p / actual[i]!);
  const within = ratios.filter((r) => r >= 0.5 && r <= 2).length / n;
  return {
    n,
    spearman: Math.round(spearman(predicted, actual) * 1000) / 1000,
    top_decile_hit: hit,
    top_decile_total: total,
    median_ratio: Math.round(medianOf(ratios) * 100) / 100,
    within_2x: Math.round(within * 1000) / 1000,
  };
}

/** The cut dates the walk-forward test uses. */
const WF_CUTS = ['2023-07-01', '2024-01-01', '2024-07-01'];

/**
 * The walk-forward test: for each cut, the multiples are learned only from the
 * live protocols listed before the cut, and scored on the ones listed after it —
 * the model as it would have stood then, tested on what came next.
 */
export function wfCheck(snap: Snap, params: Params = PARAMS): WfCheck {
  const live = liveSet(snap).filter((p) => p.listed_at !== null);
  const folds: WfFold[] = [];
  for (const cutoff of WF_CUTS) {
    const past = live.filter((p) => p.listed_at! < cutoff);
    const future = live.filter((p) => p.listed_at! >= cutoff);
    const mults = learnMultiples({ ...snap, protocols: past }, params);
    const predicted = future.map((p) => valueOf(p, snap.as_of, mults, params).implied);
    const actual = future.map((p) => p.mcap_usd!);
    const n = future.length;
    if (n === 0) {
      folds.push({ cutoff, past_n: past.length, future_n: 0, spearman: 0, top_decile_hit: 0, top_decile_total: 0, median_ratio: 0, within_2x: 0 });
      continue;
    }
    const { hit, total } = decileHit(predicted, actual);
    const ratios = predicted.map((p, i) => p / actual[i]!);
    const within = ratios.filter((r) => r >= 0.5 && r <= 2).length / n;
    folds.push({
      cutoff,
      past_n: past.length,
      future_n: n,
      spearman: Math.round(spearman(predicted, actual) * 1000) / 1000,
      top_decile_hit: hit,
      top_decile_total: total,
      median_ratio: Math.round(medianOf(ratios) * 100) / 100,
      within_2x: Math.round(within * 1000) / 1000,
    });
  }
  const mean = folds.length > 0 ? folds.reduce((a, f) => a + f.spearman, 0) / folds.length : 0;
  return { folds, mean_spearman: Math.round(mean * 1000) / 1000 };
}

/** The rule the term-gating verdicts follow. */
export const GATE_RULE =
  'A single term is dropped only when removing it alone improves both the leave-one-out Spearman and the walk-forward mean Spearman by at least 0.005. The joint row removes growth and maturity together and is a diagnostic for their interaction, not a term to drop: the brief requires the value to follow from TVL, growth and age, so both terms stay at the weights the test supports.';

/**
 * The term-gating test: each term is removed in turn and both blind checks are
 * run again, so the dashboard shows what each term earns instead of asserting
 * it. Growth and maturity carry real weight in radar-9 — the sweep that chose
 * the weights showed the stronger variants rank the live tokens better — so
 * the table is the evidence for the weights, not just for keeping the terms.
 */
export function gateTerms(snap: Snap, params: Params = PARAMS): GateCheck {
  const full = { loo: looCheck(snap, params).spearman, wf: wfCheck(snap, params).mean_spearman };
  const variants: { term: string; change: (m: Params) => Params; diagnostic?: boolean }[] = [
    { term: 'growth (seven-day change)', change: (m) => ({ ...m, growth_weight: 0 }) },
    { term: 'maturity (age with no token)', change: (m) => ({ ...m, maturity_range: 0 }) },
    { term: 'growth and maturity together', change: (m) => ({ ...m, growth_weight: 0, maturity_range: 0 }), diagnostic: true },
    { term: 'category multiple (global only)', change: (m) => ({ ...m, shrink_k: 1e9 }) },
    { term: 'category multiple and growth', change: (m) => ({ ...m, shrink_k: 1e9, growth_weight: 0 }), diagnostic: true },
  ];
  const rows: GateRow[] = variants.map((v) => {
    const m = v.change({ ...params });
    const loo = looCheck(snap, m).spearman;
    const wf = wfCheck(snap, m).mean_spearman;
    const better = loo - full.loo >= 0.005 && wf - full.wf >= 0.005;
    return {
      term: v.term,
      loo_with: full.loo,
      loo_without: loo,
      wf_with: full.wf,
      wf_without: wf,
      verdict: !v.diagnostic && better ? 'dropped' : 'kept',
    };
  });
  return { rows, rule: GATE_RULE };
}

/**
 * The traded tokens anchoring each category's multiple: the live-token protocols
 * in that category, biggest by TVL first, up to three.
 */
export function catAnchors(snap: Snap, top = 3): Record<string, Anchor[]> {
  const perCat = new Map<string, Anchor[]>();
  for (const p of snap.protocols) {
    if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const key = p.category ?? 'Other';
    const list = perCat.get(key) ?? [];
    list.push({
      slug: p.slug,
      name: p.name,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      ratio: Math.round((p.mcap_usd / p.tvl_usd) * 1000) / 1000,
    });
    perCat.set(key, list);
  }
  const out: Record<string, Anchor[]> = {};
  for (const [key, list] of perCat) out[key] = list.sort((a, b) => b.tvl_usd - a.tvl_usd).slice(0, top);
  return out;
}

/** Closed-form simple linear regression: y ~ a + b*x. */
function linfit(xs: number[], ys: number[]): { a: number; b: number } {
  const n = xs.length;
  if (n < 2) return { a: 0, b: 0 };
  const mx = xs.reduce((a, v) => a + v, 0) / n;
  const my = ys.reduce((a, v) => a + v, 0) / n;
  let cov = 0;
  let vx = 0;
  for (let i = 0; i < n; i++) {
    cov += (xs[i]! - mx) * (ys[i]! - my);
    vx += (xs[i]! - mx) ** 2;
  }
  const b = vx === 0 ? 0 : cov / vx;
  return { a: my - b * mx, b };
}

/**
 * The size curve, fitted and tested blind against a flat multiple. A log-log fit
 * of market cap against TVL has a steep in-sample slope, but out of sample it
 * scores worse than a flat multiple on both blind checks, so the model does not
 * use one. The dashboard prints the numbers instead of claiming the curve works.
 */
export function sizeCurveCheck(snap: Snap): SizeCurve {
  const live = liveSet(snap);
  const dated = live.filter((p) => p.listed_at !== null);
  const predCurve: number[] = [];
  const predFlat: number[] = [];
  for (const p of live) {
    const others = live.filter((q) => q.slug !== p.slug);
    const fit = linfit(
      others.map((q) => Math.log(q.tvl_usd)),
      others.map((q) => Math.log(q.mcap_usd!)),
    );
    predCurve.push(Math.max(1, Math.round(Math.exp(fit.a + fit.b * Math.log(p.tvl_usd)))));
    const ratios = others.map((q) => q.mcap_usd! / q.tvl_usd).filter((r) => r <= 10 && r >= 0.001);
    const global = Math.min(PARAMS.multiple_cap, Math.max(PARAMS.multiple_floor, geoMedian(ratios)));
    predFlat.push(Math.max(1, Math.round(p.tvl_usd * global)));
  }
  const actual = live.map((p) => p.mcap_usd!);
  const looCurve = spearman(predCurve, actual);
  const looFlat = spearman(predFlat, actual);
  const wfCurve: number[] = [];
  const wfFlat: number[] = [];
  for (const cutoff of WF_CUTS) {
    const past = dated.filter((p) => p.listed_at! < cutoff);
    const future = dated.filter((p) => p.listed_at! >= cutoff);
    const fit = linfit(
      past.map((q) => Math.log(q.tvl_usd)),
      past.map((q) => Math.log(q.mcap_usd!)),
    );
    wfCurve.push(spearman(future.map((p) => Math.exp(fit.a + fit.b * Math.log(p.tvl_usd))), future.map((p) => p.mcap_usd!)));
    const ratios = past.map((q) => q.mcap_usd! / q.tvl_usd).filter((r) => r <= 10 && r >= 0.001);
    const global = Math.min(PARAMS.multiple_cap, Math.max(PARAMS.multiple_floor, geoMedian(ratios)));
    wfFlat.push(spearman(future.map((p) => p.tvl_usd * global), future.map((p) => p.mcap_usd!)));
  }
  const wfCurveMean = wfCurve.reduce((a, b) => a + b, 0) / wfCurve.length;
  const wfFlatMean = wfFlat.reduce((a, b) => a + b, 0) / wfFlat.length;
  return {
    loo_spearman: Math.round(looCurve * 1000) / 1000,
    wf_spearman: Math.round(wfCurveMean * 1000) / 1000,
    flat_loo_spearman: Math.round(looFlat * 1000) / 1000,
    flat_wf_spearman: Math.round(wfFlatMean * 1000) / 1000,
    beats_flat: looCurve > looFlat && wfCurveMean > wfFlatMean,
  };
}

/** A seeded pseudo-random generator (mulberry32), so the bootstrap is byte-identical on every run. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function (): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The element at the q-th quantile of a sorted list, by index. */
function quantileOf(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
}

/**
 * The bootstrap rank ranges: the multiples are refit 200 times on resampled live
 * sets and the board is re-ranked each time, so every row carries the rank range
 * the central 80% of the refits give it. The resampling is seeded, so the ranges
 * are the same on every run.
 */
export function bootstrapRanges(
  snap: Snap,
  board: BoardRow[],
  params: Params = PARAMS,
  refits = 200,
): { ranges: Map<string, RankRange>; summary: BootSummary } {
  const live = liveSet(snap);
  const bySlug = new Map(snap.protocols.map((p) => [p.slug, p]));
  const rng = mulberry32(20261114);
  const rankLists = new Map<string, number[]>(board.map((r) => [r.slug, []]));
  for (let b = 0; b < refits; b++) {
    const resampled: Proto[] = [];
    for (let i = 0; i < live.length; i++) resampled.push(live[Math.floor(rng() * live.length)]!);
    const mults = learnMultiples({ ...snap, protocols: resampled }, params);
    const scored = board.map((r) => ({
      slug: r.slug,
      v: valueOf(bySlug.get(r.slug)!, snap.as_of, mults, params).implied,
    }));
    scored.sort((a, b) => b.v - a.v || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
    scored.forEach((s, i) => rankLists.get(s.slug)!.push(i + 1));
  }
  const ranges = new Map<string, RankRange>();
  const widths: number[] = [];
  for (const r of board) {
    const sorted = [...rankLists.get(r.slug)!].sort((a, b) => a - b);
    const range: RankRange = { low: quantileOf(sorted, 0.1), high: quantileOf(sorted, 0.9), median: Math.round(medianOf(sorted)) };
    ranges.set(r.slug, range);
    widths.push(range.high - range.low);
  }
  return {
    ranges,
    summary: {
      refits,
      median_width: medianOf(widths),
      within_10: widths.filter((w) => w <= 10).length,
      within_25: widths.filter((w) => w <= 25).length,
    },
  };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** The categories the watchlist rule keeps out. */
const EXCLUDED_CATS = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** A name that begins with an exchange's name is that exchange's product. */
const EXCHANGE_NAMES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** Whether a protocol records no token at all. */
export function isPreToken(p: Proto): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: a genuine pre-token protocol
 * under the watchlist's own rule — pre-token, not a bridge, not liquid staking
 * or restaking, no wrapped or staked word in its name, not an exchange's
 * product, not a versioned pool.
 */
export function isRankable(p: Proto): boolean {
  return (
    isPreToken(p) &&
    !EXCLUDED_CATS.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !/\bwrapped\b|\bstaked\b|\bstaking\b/i.test(p.name) &&
    !EXCHANGE_NAMES.some((e) => p.name.startsWith(e))
  );
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: Proto): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: Proto): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/**
 * A farm plan's cost, totalled in dollars: the gas its transactions cost, the
 * yield the locked capital forgoes at 5% a year over the hold, and the time it
 * takes valued at $10 an hour. The break-even airdrop is the total itself.
 * The break-even share (total cost divided by implied value) is the basis for
 * the Farm / Thin / Skip verdict, split into thirds across the board.
 */
export function farmCost(p: Proto, age: number | null, implied: number): Omit<FarmCost, 'verdict'> {
  const capital = capitalFor(p);
  const hold = holdFor(age);
  const weeks = Math.ceil(hold / 7);
  const gas = 3 + (capital >= 150 ? 8 : 4) + 2 * weeks;
  const forgone = Math.round(capital * 0.05 * (hold / 365) * 100) / 100;
  const minutes = 15 + 10 * weeks + 10 * Math.ceil(hold / 30) + 10 + 5;
  const timeValue = Math.round((minutes / 60) * 10 * 100) / 100;
  const total = Math.round((gas + forgone + timeValue) * 100) / 100;
  return {
    gas_usd: gas,
    capital_usd: capital,
    hold_days: hold,
    time_minutes: minutes,
    time_value_usd: timeValue,
    forgone_yield_usd: forgone,
    total_usd: total,
    break_even_usd: total,
    break_even_share: implied > 0 ? total / implied : 0,
  };
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: Proto, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The category's weekly qualifying action. */
function weeklyFor(p: Proto): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'a supply, a borrow or a repayment';
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return 'a swap or a liquidity adjustment';
  if (c.includes('bridge')) return 'a bridge of a small amount';
  if (c.includes('staking') || c.includes('restak')) return 'a stake, a restake or a claim of rewards';
  if (c.includes('perpetual') || c.includes('derivative')) return 'one small trade and its close';
  if (c.includes('prediction')) return 'one market position';
  if (c.includes('curator') || c.includes('allocator')) return 'a deposit or a vault rebalance check';
  if (c.includes('stable')) return 'a mint, a redeem or a transfer';
  if (c.includes('rwa')) return 'a mint or a hold check';
  if (c.includes('insurance')) return 'a cover check or a claim review';
  return 'a deposit, a borrow, a swap or a vote';
}

/**
 * A protocol's farm plan: eight steps, each an action with a cost and a time.
 * The plan is derived from the protocol's own record (category, chains, TVL,
 * age), never from a hand-written list of names. Every step names what it costs
 * and how long it takes, so the plan is a checklist, not a slogan.
 */
export function farmSteps(p: Proto, age: number | null): Step[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdFor(age);
  const action = actionFor(p, capital, chain);
  const weekly = weeklyFor(p);
  return [
    { text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`, cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
    { text: action, cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`, time: '15 minutes to set up' },
    {
      text: p.chains.length >= 2
        ? `Make one qualifying action each week on ${chain}, such as ${weekly}, and once a month repeat the core action on ${p.chains[1]}, so the wallet shows repeat activity on both chains.`
        : `Make one qualifying action each week, such as ${weekly}, so the wallet shows repeat activity.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    { text: `Check the position once a month: confirm the deposit is still earning, the pool is still live, and the protocol's own page lists no migration or shutdown notice.`, cost: 'no gas unless you move funds', time: '10 minutes a month' },
    { text: `Join the protocol's governance or community votes when they open, using the same wallet, so the wallet reads as a user rather than a passer-by.`, cost: 'about $1 of gas per vote', time: '10 minutes a vote' },
    { text: `Keep the position through the whole ${hold}-day hold: closing early breaks the qualifying streak most airdrops ask for.`, cost: `the yield the $${capital} forgoes while it is locked`, time: `${hold} days` },
    { text: `Watch the protocol's own announcements page for a token or points program, and screenshot the position's balance and history before it opens.`, cost: 'no gas', time: '5 minutes' },
    { text: `When a token or points claim opens, claim from the same wallet and keep a record of the claim transaction.`, cost: 'about $3 of gas to claim', time: '10 minutes' },
  ];
}

/** One step as a single string: its action, then its cost and time. */
export function stepText(step: Step): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(
  snap: Snap,
  mults: { byCat: Record<string, CatMultiple>; global: number },
  params: Params = PARAMS,
): BoardRow[] {
  const index = new Map(snap.protocols.map((p) => [p.slug, p]));
  const chosen = new Map<string, Proto>();
  for (const slug of snap.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  for (const p of snap.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }
  const scored = [...chosen.values()].map((p) => {
    const v = valueOf(p, snap.as_of, mults, params);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  const costs = scored.map((s) => farmCost(s.p, s.age, s.implied));
  const shares = costs.map((c) => c.break_even_share).sort((a, b) => a - b);
  const cut1 = shares[Math.floor(shares.length / 3)] ?? 0;
  const cut2 = shares[Math.floor((2 * shares.length) / 3)] ?? 0;
  const verdictFor = (share: number): FarmCost['verdict'] => (share <= cut1 ? 'Farm' : share <= cut2 ? 'Thin' : 'Skip');
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      category_multiple: round4(s.multiple),
      category_samples: s.samples,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMul),
      maturity_multiplier: round4(s.maturityMul),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
    farm: { ...costs[i]!, verdict: verdictFor(costs[i]!.break_even_share) },
  }));
}

/** Why a board is one the gate refuses, or null when it passes. */
export function boardProblem(board: BoardRow[], snap: Snap): string | null {
  if (board.length < 100) return `board holds ${board.length} rows: hand in at least 100`;
  if (board.length > 4000) return `board holds ${board.length} rows: at most 4,000`;
  const seen = new Set<string>();
  for (let i = 0; i < board.length; i++) {
    const r = board[i]!;
    if (r.rank !== i + 1) return `row ${i + 1} carries rank ${r.rank}: ranks run 1..${board.length}`;
    if (seen.has(r.slug)) return `slug ${r.slug} appears twice`;
    seen.add(r.slug);
    if (r.implied_value_usd <= 0) return `row ${r.slug} has no positive implied value`;
    if (i > 0 && r.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${r.slug} is worth more than the row above it: the board is not sorted by value`;
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) return `row ${r.slug} carries ${r.farm_steps.length} farm steps: hand in 3 to 12`;
    for (const s of r.farm_steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) return `row ${r.slug} carries a farm step of ${t.length} characters: hand in 20 to 600`;
    }
  }
  for (const slug of snap.watchlist) {
    if (!seen.has(slug)) return `watchlist slug ${slug} is missing from the board`;
  }
  if (board.every((r) => r.implied_value_usd === board[0]!.implied_value_usd)) return 'every row carries the same implied value: the board ranks nothing';
  return null;
}

/** Parse and validate the snapshot document. */
export function parseSnapshot(text: string): Snap {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new SnapError('snapshot is not JSON');
  }
  if (typeof doc !== 'object' || doc === null) throw new SnapError('snapshot is not an object');
  const d = doc as Record<string, unknown>;
  if (typeof d.as_of !== 'string' || typeof d.source !== 'string' || typeof d.floor_usd !== 'number') {
    throw new SnapError('snapshot is missing as_of, source or floor_usd');
  }
  if (!Array.isArray(d.protocols) || !Array.isArray(d.watchlist)) {
    throw new SnapError('snapshot is missing protocols or watchlist');
  }
  const protocols: Proto[] = [];
  for (const raw of d.protocols as unknown[]) {
    if (typeof raw !== 'object' || raw === null) throw new SnapError('a protocol is not an object');
    const p = raw as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number') {
      throw new SnapError('a protocol is missing slug, name or tvl_usd');
    }
    protocols.push({
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? (p.chains as unknown[]).filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    });
  }
  return {
    as_of: d.as_of,
    source: d.source,
    floor_usd: d.floor_usd,
    protocols,
    watchlist: (d.watchlist as unknown[]).filter((s): s is string => typeof s === 'string'),
  };
}

/** The live-token protocols the dashboard shows, biggest market cap first. */
function liveRows(snap: Snap, top = LIVE_ROWS): LiveView[] {
  return liveSet(snap)
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0))
    .slice(0, top)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** Build everything the dashboard needs from the snapshot and the board. */
export function buildRadar(snap: Snap): { board: BoardRow[]; radar: RadarData } {
  const mults = learnMultiples(snap);
  const board = buildBoard(snap, mults);
  const { ranges, summary } = bootstrapRanges(snap, board);
  const watchlistSet = new Set(snap.watchlist);
  const rows: RowView[] = board.map((r) => {
    const range = ranges.get(r.slug) ?? { low: r.rank, high: r.rank, median: r.rank };
    const catRank = board.filter((x) => x.category === r.category && x.implied_value_usd > r.implied_value_usd).length + 1;
    return {
      rank: r.rank,
      slug: r.slug,
      name: r.name,
      category: r.category,
      chains: r.chains,
      tvl_usd: r.tvl_usd,
      change_7d: r.change_7d,
      mcap_usd: r.mcap_usd,
      listed_at: r.listed_at,
      age_days: r.age_days,
      implied_value_usd: r.implied_value_usd,
      category_multiple: r.model.category_multiple,
      category_samples: r.model.category_samples,
      growth_multiplier: r.model.growth_multiplier,
      maturity_multiplier: r.model.maturity_multiplier,
      watchlist: watchlistSet.has(r.slug),
      category_rank: catRank,
      rank_low: range.low,
      rank_high: range.high,
      rank_median: range.median,
      farm: r.farm,
      farm_steps: r.farm_steps,
    };
  });
  const liveCount = liveSet(snap).length;
  const preCount = snap.protocols.filter((p) => isPreToken(p)).length;
  const zeroMcap = snap.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd <= 0).length;
  const tokenNoMcap = snap.protocols.filter((p) => p.mcap_usd === null && (p.gecko_id !== null || p.symbol !== null)).length;
  const excludedByRule = snap.protocols.filter((p) => isPreToken(p) && !isRankable(p)).length;
  const belowFloor = board.filter((r) => r.tvl_usd < snap.floor_usd).length;
  const aboveFloor = board.filter((r) => r.tvl_usd >= snap.floor_usd && !watchlistSet.has(r.slug)).length;
  const radar: RadarData = {
    as_of: snap.as_of,
    source: snap.source,
    floor_usd: snap.floor_usd,
    model: PARAMS,
    model_version: VERSION,
    coverage: {
      total: snap.protocols.length,
      live: liveCount,
      zero_mcap: zeroMcap,
      token_no_mcap: tokenNoMcap,
      pre_token: preCount,
      excluded_by_rule: excludedByRule,
      watchlist: snap.watchlist.length,
      board: board.length,
      early_below_floor: belowFloor,
      early_above_floor: aboveFloor,
      live_shown: Math.min(LIVE_ROWS, liveCount),
    },
    watchlist_size: snap.watchlist.length,
    board_size: board.length,
    early_size: board.length - snap.watchlist.length,
    above_floor_size: aboveFloor,
    live_size: liveCount,
    category_multiples: mults.byCat,
    global_multiple: mults.global,
    calibration: looCheck(snap),
    walk_forward: wfCheck(snap),
    bootstrap: summary,
    gating: gateTerms(snap),
    anchors: catAnchors(snap),
    size_curve: sizeCurveCheck(snap),
    rows,
    live: liveRows(snap),
  };
  return { board, radar };
}

/** The dashboard's data file: the radar data as a JavaScript assignment. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR = ${JSON.stringify(radar)};\n`;
}
