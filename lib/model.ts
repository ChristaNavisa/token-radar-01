// Token Radar's value model, version radar-4: one snapshot of the protocol universe in, one
// ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and adds
// genuine pre-token protocols below the watchlist floor: the early rows the radar exists to find.
// Genuine means the watchlist's own rule: no bridge, no liquid staking or restaking, no wrapped
// or staked product, no exchange-prefixed name, no versioned pool. A bridge's token, where one
// exists, is a wrapped or staked form of a token that already trades — not a launch waiting to
// happen — so the early radar leaves those 48 rows out and takes the genuine protocols instead.
// A protocol is pre-token when its index entry records no token (no market cap, no CoinGecko id,
// no symbol); the snapshot's live-token protocols are kept apart and shown as the market's own
// values, never mixed into the ranked board.
//
// Implied value follows only from the snapshot's own figures, and no protocol name is ever
// special-cased: the same function scores every row.
//
//   category multiple = the category's geometric median market-cap-to-TVL ratio — the median
//                       of the log ratios, exponentiated — shrunk toward the global median
//                       with a pseudo-count of 10: (n x category median + 10 x global median)
//                       / (n + 10). Ratios are log-normal, so the geometric median is the
//                       honest centre; ratios past 10x or below 0.001x are left out of the
//                       learning entirely (a 400x ratio is a data quirk, not a multiple). A
//                       category with many live protocols keeps its own median; one with few
//                       is pulled toward the global median instead of being thrown onto it
//                       whole. The starter priced every category at one flat 0.25x; the market
//                       does not: on this snapshot the live medians run from 0.025x (Restaking)
//                       to 1.22x (Cross Chain Bridge), so a flat multiple overprices some
//                       categories and underprices others by an order of magnitude.
//   base              = tvl_usd x category multiple
//   growth            = clamp(change_7d, -60, 120) per cent, dampened on a log scale so one hot
//                       week cannot dominate the ranking
//   growthMult        = 1 + 0.25 x sign(growth) x ln(1 + |growth| / 100)
//   maturity          = 0.6 + min(age_days, 1095) / 1095 x 0.2   (age_days unknown: 365)
//   implied           = max(1, round(base x growthMult x maturity))
//
// Growth and age are weak signals in the leave-one-out check — a protocol's seven-day change
// and its age alone barely rank its market cap — so they move the value a little, not a lot:
// a +120% week is worth 1.20x here, and age is worth 0.6x to 0.8x. TVL and the category
// multiple do the ranking; growth and age tilt it, as the check supports.
//
//   The model is checked, not just asserted: a leave-one-out test scores the 128 live-token
//   protocols as if each had no token (its own ratio left out of its category's multiple) and
//   compares the predicted value with the market cap it actually trades at. The board is a
//   ranking, so the test is a ranking test: Spearman rho between predicted and actual value,
//   and how many of the actually most valuable protocols land in the model's top decile.
//
// Age is the time since DefiLlama first listed the protocol: the best record of how long it has
// run with no token. A protocol that has run for years at scale with no token, and is still
// growing, is the closest thing this snapshot has to a launch waiting to happen.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
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
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  multiple_floor: number;
  multiple_cap: number;
  /** The pseudo-count that shrinks a category's multiple toward the global median. */
  shrink_k: number;
}

export const MODEL: ModelConstants = {
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
export const MODEL_VERSION = 'radar-4';

/** How many genuine pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 260;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
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
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
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
  /** The row's rank among the board's rows in its own category (1 is the category's best). */
  category_rank: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One category's learned multiple: its median mcap/TVL, shrunk toward the global median. */
export interface CategoryMultiple {
  multiple: number;
  samples: number;
  fallback: boolean;
  /** The share of the multiple that comes from the category's own live protocols (n / (n + k)). */
  learned_share: number;
}

/** The leave-one-out check of the model on the protocols whose token already trades. */
export interface Calibration {
  /** How many live-token protocols the check scored. */
  n: number;
  /** Spearman rho between the model's predicted value and the actual market cap. */
  spearman: number;
  /** How many of the actually most valuable live protocols land in the model's top decile. */
  top_decile_hit: number;
  /** How many protocols the top decile holds (a tenth of n, at least 1). */
  top_decile_total: number;
  /** The median of predicted value over actual market cap across the checked protocols. */
  median_ratio: number;
  /** The share of checked protocols whose predicted value lands within twice the actual one. */
  within_2x: number;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  category_multiples: Record<string, CategoryMultiple>;
  global_multiple: number;
  calibration: Calibration;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a sorted list of numbers; 0 for an empty list. */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The geometric median of a list of positive ratios: the median of the logs, exponentiated. */
function geometricMedian(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.exp(median(values.map((v) => Math.log(v))));
}

/**
 * The category multiples the snapshot itself teaches: for each category, the geometric median
 * market-cap-to-TVL ratio of its live-token protocols, shrunk toward the global median
 * with a pseudo-count of `model.shrink_k`. Ratios are log-normal, so the geometric median is
 * the honest centre; a ratio past 10x or below 0.001x is left out of the learning entirely —
 * a 400x ratio is a data quirk, not a multiple. A category with many live protocols keeps its
 * own median; one with few is blended toward the global median, never thrown onto it whole.
 */
export function categoryMultiples(snapshot: Snapshot, model: ModelConstants = MODEL): { byCategory: Record<string, CategoryMultiple>; global: number } {
  const ratiosByCategory = new Map<string, number[]>();
  const allRatios: number[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    if (ratio > 10 || ratio < 0.001) continue;
    allRatios.push(ratio);
    const key = p.category ?? 'Other';
    const list = ratiosByCategory.get(key) ?? [];
    list.push(ratio);
    ratiosByCategory.set(key, list);
  }
  const clamp = (n: number): number => Math.min(model.multiple_cap, Math.max(model.multiple_floor, n));
  const global = clamp(geometricMedian(allRatios));
  const byCategory: Record<string, CategoryMultiple> = {};
  for (const [category, ratios] of ratiosByCategory) {
    const n = ratios.length;
    const catMedian = clamp(geometricMedian(ratios));
    const multiple = (n * catMedian + model.shrink_k * global) / (n + model.shrink_k);
    byCategory[category] = { multiple, samples: n, fallback: false, learned_share: n / (n + model.shrink_k) };
  }
  return { byCategory, global };
}

/** The multiple one protocol gets: its category's, or the global median when it has none. */
export function multipleFor(p: SnapshotProtocol, multiples: { byCategory: Record<string, CategoryMultiple>; global: number }): CategoryMultiple {
  const entry = multiples.byCategory[p.category ?? 'Other'];
  if (entry !== undefined) return entry;
  return { multiple: multiples.global, samples: 0, fallback: true, learned_share: 0 };
}

/** The multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  multiples: { byCategory: Record<string, CategoryMultiple>; global: number },
  model: ModelConstants = MODEL,
): { implied: number; multiple: number; samples: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const { multiple, samples } = multipleFor(protocol, multiples);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  // Log-dampened growth: a hot week moves the value, but one week's move cannot dominate the
  // ranking. A +120% week is worth 1.39x here, not the 1.60x a linear term would give it.
  const growthMult = 1 + model.growth_weight * Math.sign(growthPct) * Math.log1p(Math.abs(growthPct) / 100);
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const base = protocol.tvl_usd * multiple;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult));
  return { implied, multiple, samples, growthPct, growthMult, maturityMult, age };
}

/** Ranks with ties averaged, 1-based. */
function ranks(values: number[]): number[] {
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

/** Spearman rho between two lists of numbers, ties averaged. */
export function spearman(xs: number[], ys: number[]): number {
  if (xs.length < 2 || xs.length !== ys.length) return 0;
  const rx = ranks(xs);
  const ry = ranks(ys);
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

/**
 * The leave-one-out check of the model on the protocols whose token already trades. Each live
 * protocol is scored as if it had no token — its own ratio left out of its category's multiple
 * and of the global median — and the predicted value is compared with the market cap it actually
 * trades at. The board is a ranking, so the check is a ranking check first: Spearman rho between
 * predicted and actual value, and how many of the actually most valuable protocols land in the
 * model's top decile. The point stats (median ratio, share within twice the actual value) are
 * reported beside them, not instead of them: a market cap can sit far from its category's median,
 * and that dispersion is why the board is a ranking, not a price list.
 */
export function calibrate(snapshot: Snapshot, model: ModelConstants = MODEL): Calibration {
  const live = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
  const predicted: number[] = [];
  const actual: number[] = [];
  for (const p of live) {
    const rest: Snapshot = { ...snapshot, protocols: snapshot.protocols.filter((q) => q.slug !== p.slug) };
    const multiples = categoryMultiples(rest, model);
    const v = impliedValue(p, snapshot.as_of, multiples, model);
    predicted.push(v.implied);
    actual.push(p.mcap_usd!);
  }
  const n = live.length;
  if (n === 0) return { n: 0, spearman: 0, top_decile_hit: 0, top_decile_total: 0, median_ratio: 0, within_2x: 0 };
  const rho = spearman(predicted, actual);
  const decile = Math.max(1, Math.round(n / 10));
  const topActual = new Set(
    actual.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v).slice(0, decile).map((x) => x.i),
  );
  const topPredicted = new Set(
    predicted.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v).slice(0, decile).map((x) => x.i),
  );
  let hit = 0;
  for (const i of topActual) if (topPredicted.has(i)) hit++;
  const ratios = predicted.map((p, i) => p / actual[i]!);
  const within2x = ratios.filter((r) => r >= 0.5 && r <= 2).length / n;
  return {
    n,
    spearman: Math.round(rho * 1000) / 1000,
    top_decile_hit: hit,
    top_decile_total: decile,
    median_ratio: Math.round(median(ratios) * 100) / 100,
    within_2x: Math.round(within2x * 1000) / 1000,
  };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** The categories the watchlist rule keeps out: a bridge, a staking wrapper, or an exchange is not a launch waiting to happen. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** A name that begins with an exchange's name is that exchange's product, not its own protocol. */
const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: a genuine pre-token protocol under the
 * watchlist's own rule — pre-token, not a bridge, not liquid staking or restaking, no wrapped
 * or staked word in its name, not an exchange's product, not a versioned pool. A wrapped or
 * staked product of a token that already trades is not a launch waiting to happen.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !EXCLUDED_CATEGORIES.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !/\bwrapped\b|\bstaked\b|\bstaking\b/i.test(p.name) &&
    !EXCHANGE_PREFIXES.some((e) => p.name.startsWith(e))
  );
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(
  snapshot: Snapshot,
  multiples: { byCategory: Record<string, CategoryMultiple>; global: number },
  model: ModelConstants = MODEL,
): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but
  // the board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: genuine pre-token protocols below the watchlist floor, by TVL, capped.
  // Never a replacement for a watchlist row: a chosen protocol stays chosen.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, multiples, model);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
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
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
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

/** The category's weekly qualifying action: the same kind of activity, repeated. */
function weeklyActionFor(p: SnapshotProtocol): string {
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
 * A protocol's farm plan: eight steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of
 * names. Every step names what it costs and how long it takes, so the plan is a checklist, not a
 * slogan. A protocol on two or more chains gets a second-chain repeat in its weekly step, and
 * every plan ends with a launch watch: the token, when it comes, is announced on the protocol's
 * own page, and that is the only place to read it.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const weekly = weeklyActionFor(p);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: p.chains.length >= 2
        ? `Make one qualifying action each week on ${chain}, such as ${weekly}, and once a month repeat the core action on ${p.chains[1]}, so the wallet shows repeat activity on both chains.`
        : `Make one qualifying action each week, such as ${weekly}, so the wallet shows repeat activity.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Once a month, check ${p.name}'s own points or rewards page for a snapshot date and write it in your farm log.`,
      cost: 'no fee to check',
      time: '10 minutes a month',
    },
    {
      text: `Set a monthly reminder to check whether ${p.name} has announced a token or a points program, and read the announcement on the protocol's own page.`,
      cost: 'no fee to check',
      time: '5 minutes a month',
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
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

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow, watchlist: Set<string>, categoryRank: number): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    category_multiple: row.model.category_multiple,
    category_samples: row.model.category_samples,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    watchlist: watchlist.has(row.slug),
    category_rank: categoryRank,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const multiples = categoryMultiples(snapshot, model);
  const board = buildBoard(snapshot, multiples, model);
  const live = liveRows(snapshot);
  const watchlist = new Set(snapshot.watchlist);
  const early = board.filter((r) => !watchlist.has(r.slug)).length;
  // The category rank: the board is sorted by implied value, so the first row of a category
  // seen in that order is the category's best, the next its second, and so on.
  const seenByCategory = new Map<string, number>();
  const categoryRank = new Map<string, number>();
  for (const r of board) {
    const key = r.category ?? 'Other';
    const n = (seenByCategory.get(key) ?? 0) + 1;
    seenByCategory.set(key, n);
    categoryRank.set(r.slug, n);
  }
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    category_multiples: multiples.byCategory,
    global_multiple: multiples.global,
    calibration: calibrate(snapshot, model),
    rows: board.map((r) => radarRow(r, watchlist, categoryRank.get(r.slug) ?? 1)),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
