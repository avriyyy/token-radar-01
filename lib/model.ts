// Token Radar — the scoring model (radar-2).
//
// One sealed snapshot of the protocol universe in, one ranked board out. The
// board ranks every pre-token protocol the snapshot can rank: the 40 on the
// watchlist (the floor, never the ceiling) plus every other pre-token protocol
// below it, so the radar finds launches early instead of re-listing a floor.
// Wrapped, staked and bridged products are left out by the watchlist's own
// rule: they are a token that already trades in another form, not a launch.
//
// A protocol is pre-token when its DefiLlama record carries no token at all
// (no market cap, no CoinGecko id, no symbol). Live-token protocols are kept
// apart and shown at the market's own value, never mixed into the ranking.
//
// Implied value follows only from the snapshot's own figures — never from a
// name. Five factors, each stated in the dashboard so a reader can check the
// maths on any row:
//
//   base      = tvl_usd x 0.30
//               (a token's fully diluted value has historically run near a
//               third of a healthy protocol's TVL at launch)
//   growth    = clamp(change_7d, -50, 150) per cent
//   growthMul = max(0.70, 1 + growth / 100 x 0.60)
//               (a week's TVL momentum, capped so one hot week cannot crown
//               a protocol, floored so a cold week cannot zero one)
//   maturity  = 0.55 + min(age_days, 1460) / 1460 x 0.45
//               (age_days from listed_at to the snapshot date; unknown age
//               counts as 365 days. A protocol that survived years without a
//               token has a longer runway of users to reward.)
//   chainsMul = 1 + 0.03 x min(chains - 1, 5)
//               (each extra chain is more surface: more users, more fees,
//               capped at +15% so a chain list cannot carry a ranking)
//   category  = a fixed multiplier per DefiLlama category, applied the same
//               way to every protocol in it (see CATEGORY_MULT). Fee-earning
//               categories price higher per dollar of TVL than pass-through
//               ones such as bridges; the table is the model's one judgement
//               call and it is printed whole in the dashboard.
//
//   implied   = max(1, round(base x growthMul x maturity x chainsMul x category))
//
// No protocol name is ever special-cased: the same function scores every row,
// and the dashboard shows the five factors beside every implied value.

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

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  base_multiple: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  growth_min_mult: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  chain_step: number;
  chain_max_extra: number;
}

export const MODEL: ModelConstants = {
  base_multiple: 0.3,
  growth_weight: 0.6,
  growth_floor: -50,
  growth_cap: 150,
  growth_min_mult: 0.7,
  maturity_floor: 0.55,
  maturity_range: 0.45,
  maturity_days: 1460,
  unknown_age_days: 365,
  chain_step: 0.03,
  chain_max_extra: 5,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-2';

/** How many live-token protocols the Live view carries, by market cap. */
export const LIVE_ROWS = 30;

/**
 * One multiplier per category, the model's single judgement call. Fee-earning
 * categories (exchanges, lenders, derivatives) price above 1; pass-through
 * categories (bridges, wrappers) price below 1; everything unlisted is 1.
 * The same table scores every protocol in a category — no name is special.
 */
export const CATEGORY_MULT: Record<string, number> = {
  'Dexs': 1.15,
  'Lending': 1.15,
  'Derivatives': 1.1,
  'RWA': 1.1,
  'Restaking': 1.1,
  'Yield': 1.08,
  'Yield Aggregator': 1.08,
  'Liquid Restaking': 1.05,
  'Launchpad': 1.05,
  'Prediction Market': 1.05,
  'CDP': 1.05,
  'Synthetics': 1.05,
  'Options': 1.05,
  'Options Vault': 1.05,
  'Perps': 1.1,
  'Basis Trading': 1.05,
  'Liquid Staking': 0.8,
  'Bridge': 0.7,
  'Canonical Bridge': 0.7,
  'Cross Chain Bridge': 0.7,
};

/** The multiplier a category gets; 1 when the table names none. */
export function categoryMult(category: string | null): number {
  if (category === null) return 1;
  return CATEGORY_MULT[category] ?? 1;
}

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
    base_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chains_multiplier: number;
    category_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans rendered in the page. */
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
  growth_multiplier: number;
  maturity_multiplier: number;
  chains_multiplier: number;
  category_multiplier: number;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  symbol: string | null;
}

/** Everything the dashboard needs: the board, the live set, and the model. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  category_mult: Record<string, number>;
  watchlist: string[];
  watchlist_size: number;
  board_size: number;
  live_size: number;
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

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The five factors and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
): {
  implied: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  chainsMult: number;
  categoryMultValue: number;
  age: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = Math.max(model.growth_min_mult, 1 + (growthPct / 100) * model.growth_weight);
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult =
    model.maturity_floor +
    (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const chainCount = Array.isArray(protocol.chains) ? protocol.chains.length : 0;
  const chainsMult = 1 + model.chain_step * Math.min(Math.max(chainCount - 1, 0), model.chain_max_extra);
  const categoryMultValue = categoryMult(protocol.category);
  const base = protocol.tvl_usd * model.base_multiple;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult * chainsMult * categoryMultValue));
  return { implied, growthPct, growthMult, maturityMult, chainsMult, categoryMultValue, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/**
 * The watchlist's own exclusion rule, applied to the whole board: a wrapped,
 * staked or bridged product is a token that already trades in another form,
 * not a launch still to come (WBTC is Bitcoin on Ethereum, Binance staked
 * ETH is ETH in Binance's staking product). The same rule the house drew the
 * watchlist with, so no watchlist slug can ever fail it.
 */
const EXCLUDED_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, not an exchange,
 * not a versioned pool, and not a wrapped, staked or bridged product of a
 * token that already trades.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !EXCLUDED_CATEGORIES.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !WRAPPED_WORD.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name)
  );
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

// ---------------------------------------------------------------- farm plans

/** Gas tier of a chain, for honest cost estimates in the farm steps. */
function gasTier(chain: string): 'l1' | 'l2' | 'cheap' {
  const l2 = new Set([
    'Base', 'Arbitrum', 'Optimism', 'zkSync Era', 'Linea', 'Scroll', 'Unichain', 'Blast',
    'Mode', 'Manta', 'Mantle', 'Polygon', 'Berachain', 'Soneium', 'Abstract', 'Ink', 'MegaETH',
  ]);
  const cheap = new Set(['Solana', 'BNB', 'Binance', 'Avalanche', 'Tron', 'Sui', 'Aptos', 'Near', 'TON', 'Starknet']);
  if (l2.has(chain)) return 'l2';
  if (cheap.has(chain)) return 'cheap';
  return 'l1';
}

/** What one transaction costs on the protocol's home chain, in plain words. */
function gasNote(chain: string): string {
  const tier = gasTier(chain);
  if (tier === 'l2') return 'about $0.10-$1 of gas per transaction on this L2';
  if (tier === 'cheap') return 'a few cents of gas per transaction on this chain';
  return 'about $3-$15 of gas per transaction on Ethereum mainnet';
}

/** The protocol's main action, by category: what "using it" actually means. */
function coreAction(category: string | null): string {
  switch (category) {
    case 'Dexs':
      return 'swap a small amount and add liquidity to one pool, so the position earns fees';
    case 'Lending':
      return 'supply collateral and borrow a small amount against it, keeping the loan healthy';
    case 'Derivatives':
    case 'Perps':
      return 'open a small leveraged position and close it after a day, paying the funding';
    case 'Yield':
    case 'Yield Aggregator':
      return 'deposit into the highest-TVL vault and let the yield accrue';
    case 'Restaking':
    case 'Liquid Restaking':
      return 'restake the deposit and hold the receipt token in your wallet';
    case 'Liquid Staking':
      return 'stake the deposit and hold the liquid receipt token';
    case 'RWA':
      return 'buy a small position in the tokenised real-world asset vault';
    case 'Bridge':
    case 'Canonical Bridge':
    case 'Cross Chain Bridge':
      return 'bridge a small amount across the route and back, so both directions are used';
    case 'Launchpad':
      return 'join the current sale or staking round with a small allocation';
    case 'Prediction Market':
      return 'place two small opposing trades on live markets';
    case 'CDP':
      return 'mint a small amount of the stablecoin against collateral';
    case 'Synthetics':
      return 'mint a small synthetic position and hold it for a week';
    case 'Options':
    case 'Options Vault':
      return 'deposit into the options vault for one epoch';
    case 'Insurance':
      return 'buy a small cover policy on a pool you already use';
    case 'Payments':
      return 'send two small payments through the network to real recipients';
    case 'NFT Marketplace':
      return 'list one item and buy one low-value item on the marketplace';
    case 'Privacy':
      return 'run one private transfer through the shielded pool';
    default:
      return 'make a first deposit into the protocol and use its main feature once';
  }
}

/** The protocol's second action: a different surface of the same product. */
function secondAction(category: string | null): string {
  switch (category) {
    case 'Dexs':
      return 'route a second swap through a different pool on the same exchange';
    case 'Lending':
      return 'supply a second asset to the same market to widen the position';
    case 'Derivatives':
    case 'Perps':
      return 'open a second, smaller position on a different market of the same exchange';
    case 'Yield':
    case 'Yield Aggregator':
      return 'split the deposit across a second vault with a different strategy';
    case 'Restaking':
    case 'Liquid Restaking':
    case 'Liquid Staking':
      return 'delegate a second, smaller stake to a different operator or validator';
    case 'Bridge':
    case 'Canonical Bridge':
    case 'Cross Chain Bridge':
      return 'bridge a second amount on a different route the bridge supports';
    case 'Launchpad':
      return 'stake the launchpad token, if one is needed to qualify for allocations';
    default:
      return 'use a second feature of the same protocol, such as its other pool, market or vault';
  }
}

/** Suggested farming capital by rank: the top of the board earns a bigger position. */
function capitalForRank(rank: number): number {
  if (rank <= 25) return 500;
  if (rank <= 100) return 200;
  return 100;
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = s.slice(0, 597) + '...';
  return s;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time.
 * The plan is derived from the protocol's own record — its name, its chains,
 * its category and its rank — never from a list of names, so the same plan
 * shape fits every protocol and still reads as written for this one.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, rank: number): FarmStep[] {
  const home = p.chains.length > 0 ? p.chains[0]! : 'Ethereum';
  const gas = gasNote(home);
  const capital = capitalForRank(rank);
  const ageNote = age === null ? 'a protocol with no listing date on record' : `running since ${p.listed_at}`;
  const steps: FarmStep[] = [
    {
      text: `Set up for ${p.name}: bridge $${capital} to ${home} in your own wallet and keep a little native gas aside, then open the protocol's official app and connect that wallet`,
      cost: `${gas}, plus the bridge fee`,
      time: 'about 20 minutes once',
    },
    {
      text: `Use ${p.name} for real: ${coreAction(p.category)} — this is the on-chain footprint a future token drop would look for`,
      cost: `$${capital} of capital and ${gas}`,
      time: 'about 30 minutes once',
    },
    {
      text: `Widen the footprint: ${secondAction(p.category)} on ${p.name}, so the wallet shows more than one interaction with the protocol`,
      cost: `about $${Math.round(capital / 2)} of extra capital and ${gas}`,
      time: 'about 20 minutes once',
    },
    {
      text: `Keep the position alive: return once a week and repeat a small interaction on ${p.name} (${ageNote}), because airdrops reward months of use, not one afternoon`,
      cost: `${gas} a week`,
      time: 'about 10 minutes a week',
    },
    {
      text: `Stay in the loop: follow ${p.name}'s official announcements and check whether it runs a points, quest or testnet programme, then do the free tasks it lists`,
      cost: 'no fee to check, and never pay to claim a drop',
      time: 'about 10 minutes a week',
    },
    {
      text: `Manage the risk: check ${p.name}'s TVL and your position monthly, keep the total at money you can afford to lose, and have an exit ready if the TVL falls for two months running`,
      cost: 'nothing but the log',
      time: 'about 15 minutes a month',
    },
  ];
  return steps;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug on it is ranked, whatever its size.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other pre-token protocol the snapshot can rank.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }
  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model);
    return { p, v };
  });
  // Strongest first; ties break by TVL, then by slug, so the order is fixed.
  scored.sort((a, b) => {
    if (b.v.implied !== a.v.implied) return b.v.implied - a.v.implied;
    if (b.p.tvl_usd !== a.p.tvl_usd) return b.p.tvl_usd - a.p.tvl_usd;
    return a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0;
  });
  return scored.map(({ p, v }, i) => {
    const rank = i + 1;
    const steps = farmSteps(p, v.age, rank).map(stepText);
    return {
      rank,
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      mcap_usd: p.mcap_usd,
      listed_at: p.listed_at,
      gecko_id: p.gecko_id,
      symbol: p.symbol,
      token_status: 'pre-token' as const,
      age_days: v.age,
      implied_value_usd: v.implied,
      model: {
        base_multiple: model.base_multiple,
        growth_pct: v.growthPct,
        growth_multiplier: v.growthMult,
        maturity_multiplier: v.maturityMult,
        chains_multiplier: v.chainsMult,
        category_multiplier: v.categoryMultValue,
        age_days: v.age,
      },
      farm_steps: steps,
    };
  });
}

/** The live-token set: the biggest tokens by market cap, shown at the market's own value. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.mcap_usd !== null)
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0))
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      symbol: p.symbol,
    }));
}

/** The dashboard's compact view of one board row. */
export function radarRow(row: BoardRow): RadarRow {
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
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chains_multiplier: row.model.chains_multiplier,
    category_multiplier: row.model.category_multiplier,
    farm_steps: row.farm_steps,
  };
}

/** The board and everything the dashboard needs, from one snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    category_mult: CATEGORY_MULT,
    watchlist: snapshot.watchlist,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** Read and check the snapshot's shape before the model trusts it. */
export function parseSnapshot(text: string): Snapshot {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot is not JSON');
  }
  if (typeof doc !== 'object' || doc === null) throw new SnapshotError('snapshot is not an object');
  const d = doc as Record<string, unknown>;
  if (typeof d.as_of !== 'string') throw new SnapshotError('snapshot.as_of is not a string');
  if (typeof d.source !== 'string') throw new SnapshotError('snapshot.source is not a string');
  if (typeof d.floor_usd !== 'number' || !Number.isFinite(d.floor_usd)) {
    throw new SnapshotError('snapshot.floor_usd is not a finite number');
  }
  if (!Array.isArray(d.protocols)) throw new SnapshotError('snapshot.protocols is not an array');
  if (!Array.isArray(d.watchlist) || !d.watchlist.every((s) => typeof s === 'string')) {
    throw new SnapshotError('snapshot.watchlist is not an array of strings');
  }
  for (const p of d.protocols as Record<string, unknown>[]) {
    if (typeof p !== 'object' || p === null) throw new SnapshotError('snapshot.protocols holds a non-object');
    for (const key of ['slug', 'name', 'tvl_usd'] as const) {
      if (p[key] === undefined || p[key] === null) throw new SnapshotError(`protocol is missing ${key}`);
    }
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number') {
      throw new SnapshotError('protocol slug, name or tvl_usd has the wrong type');
    }
    if (!Array.isArray(p.chains) || !p.chains.every((c) => typeof c === 'string')) {
      throw new SnapshotError(`protocol ${p.slug} has a bad chains array`);
    }
  }
  return doc as Snapshot;
}

/** The first reason the gate would refuse this board, or null when it is valid. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) return `board holds ${board.length} rows, not 100 to 4000`;
  const slugs = new Set(snapshot.protocols.map((p) => p.slug));
  const seen = new Set<string>();
  for (let i = 0; i < board.length; i++) {
    const row = board[i]!;
    if (row.rank !== i + 1) return `row ${i} has rank ${row.rank}, not ${i + 1}`;
    if (!slugs.has(row.slug)) return `row ${row.slug} is not one of the snapshot's protocols`;
    if (seen.has(row.slug)) return `slug ${row.slug} appears twice`;
    seen.add(row.slug);
    if (typeof row.name !== 'string' || row.name.length === 0) return `row ${row.slug} has no name`;
    if (!Number.isSafeInteger(row.implied_value_usd) || row.implied_value_usd <= 0) {
      return `row ${row.slug} has a bad implied value`;
    }
    if (row.implied_value_usd > 100_000_000_000_000) return `row ${row.slug} claims over $100T`;
    if (i > 0 && row.implied_value_usd > board[i - 1]!.implied_value_usd) {
      return `row ${row.slug} is worth more than the row ranked above it`;
    }
    if (!Array.isArray(row.farm_steps) || row.farm_steps.length < 3 || row.farm_steps.length > 12) {
      return `row ${row.slug} holds ${row.farm_steps.length} farm steps, not 3 to 12`;
    }
    for (const step of row.farm_steps) {
      const len = step.trim().length;
      if (len < 20 || len > 600) return `row ${row.slug} holds a farm step of ${len} characters, not 20 to 600`;
    }
  }
  const allSame = board.every((r) => r.implied_value_usd === board[0]!.implied_value_usd);
  if (board.length >= 2 && allSame) return 'every row claims the same implied value: not a ranking';
  for (const slug of snapshot.watchlist) {
    if (!seen.has(slug)) return `watchlist slug ${slug} is missing from the board`;
  }
  return null;
}

/** The dashboard's data, as a script the page loads beside itself: `window.RADAR = {...};`. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR = ${JSON.stringify(radar)};\n`;
}
