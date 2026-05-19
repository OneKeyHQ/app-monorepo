import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import type {
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

import {
  PORTFOLIO_OTHERS_TOKEN,
  PORTFOLIO_PALETTE_TOKENS,
} from './DeFiPortfolioPalette';

export const PORTFOLIO_TOP_N = 5;
export const PORTFOLIO_OTHERS_KEY = 'others';

/**
 * Minimum exposure share (percent) a protocol must hold to claim a
 * Top-N slot. Anything below the floor is demoted to "Others", even
 * if it would rank in the top 5 by raw exposure.
 *
 * Why 3%: a 1.2% sliver next to a 60% leader looks broken and
 * carries no real signal at the bar's typical width. Industry
 * convention sits at 3-5%; we use the lenient end since wallets are
 * highly asymmetric.
 */
export const PORTFOLIO_MIN_RANK_PERCENT = 3;

export type IPortfolioSlice = {
  key: string;
  label: string;
  netWorth: number;
  percent: number;
  colorToken: string;
  networkIds: string[];
};

export type IPortfolioStats = {
  total: number;
  slices: IPortfolioSlice[];
};

/**
 * Lookup from protocol slug -> slice. Tail protocols (those merged
 * into the Others slice) intentionally do NOT appear here: their bar
 * representation is the aggregate Others band. This is intentionally
 * separate from the overview tile grid: stacked bar consumers may use
 * it to look up aggregate protocol slices, but individual protocol
 * cards should keep rendering their own per-network/value data.
 */
export type IPortfolioSliceLookup = ReadonlyMap<string, IPortfolioSlice>;

export function buildPortfolioSliceLookup(
  slices: IPortfolioSlice[],
): IPortfolioSliceLookup {
  const map = new Map<string, IPortfolioSlice>();
  for (const slice of slices) {
    if (slice.key !== PORTFOLIO_OTHERS_KEY) {
      map.set(slice.key, slice);
    }
  }
  return map;
}

type IBuildPortfolioStatsInput = {
  protocols: IDeFiProtocol[] | undefined;
  protocolMap: Record<string, IProtocolSummary>;
  getNetWorth: (p: IDeFiProtocol) => number;
};

type IAggregatedProtocol = {
  slug: string;
  label: string;
  netWorth: number;
  exposure: number;
  networkIds: string[];
  firstIndex: number;
};

function resolveLabel(
  protocol: IDeFiProtocol,
  protocolMap: Record<string, IProtocolSummary>,
): string {
  const key = defiUtils.buildProtocolMapKey({
    protocol: protocol.protocol,
    networkId: protocol.networkId,
  });
  return protocolMap[key]?.protocolName ?? protocol.protocol;
}

/**
 * Largest-remainder method, applied at one-decimal precision.
 *
 * Returns percents (one decimal) whose sum is exactly 100.0 when
 * `values` has a positive total. Without this, six 16.667% segments
 * round independently to 16.7 each and the labels show 100.2%; six
 * 33.333% segments show 99.8 or 100.2 depending on rounding direction.
 *
 * Steps (working in tenth-of-percent integers, range 0..1000):
 *   1. raw_i = (v_i / total) * 1000
 *   2. floor each, sum the floors (sum <= 1000)
 *   3. distribute the remainder by largest fractional residue
 *      (ties resolved by input order via toSorted's stable sort)
 *   4. divide back by 10 -> one-decimal percent
 *
 * When total <= 0 the function returns all zeros (no signal to
 * distribute), and the bar's empty state takes over upstream.
 */
export function distributePercents(values: number[]): number[] {
  const total = values.reduce((acc, v) => acc + v, 0);
  if (!Number.isFinite(total) || total <= 0) {
    return values.map(() => 0);
  }
  const raws = values.map((v) => (v / total) * 1000);
  const floors = raws.map((r) => Math.floor(r));
  const residues = raws.map((r, i) => r - floors[i]);
  const assignedSum = floors.reduce((acc, n) => acc + n, 0);
  let remainder = 1000 - assignedSum;
  const order = residues
    .map((res, i) => ({ res, i }))
    .toSorted((a, b) => b.res - a.res);
  const tenths = [...floors];
  for (let k = 0; k < order.length && remainder > 0; k += 1) {
    tenths[order[k].i] += 1;
    remainder -= 1;
  }
  return tenths.map((t) => t / 10);
}

export function buildPortfolioStats(
  input: IBuildPortfolioStatsInput,
): IPortfolioStats {
  const { protocols, protocolMap, getNetWorth } = input;
  if (!protocols || protocols.length === 0) {
    return { total: 0, slices: [] };
  }

  // Aggregate same protocol across networks. All Networks mode lists an
  // entry per (protocol, network); the bar's semantic unit is "protocol",
  // so collapse by `protocol.protocol` slug and sum netWorth.
  const aggregateMap = new Map<string, IAggregatedProtocol>();
  protocols.forEach((p, index) => {
    const existing = aggregateMap.get(p.protocol);
    const rawNetWorth = getNetWorth(p);
    const netWorth = Number.isFinite(rawNetWorth) ? rawNetWorth : 0;
    if (existing) {
      existing.netWorth += netWorth;
      existing.exposure = Math.abs(existing.netWorth);
      if (p.networkId && !existing.networkIds.includes(p.networkId)) {
        existing.networkIds.push(p.networkId);
      }
    } else {
      aggregateMap.set(p.protocol, {
        slug: p.protocol,
        label: resolveLabel(p, protocolMap),
        netWorth,
        exposure: Math.abs(netWorth),
        networkIds: p.networkId ? [p.networkId] : [],
        firstIndex: index,
      });
    }
  });

  const aggregated = Array.from(aggregateMap.values()).toSorted((a, b) => {
    if (a.exposure !== b.exposure) return b.exposure - a.exposure;
    return a.firstIndex - b.firstIndex;
  });

  const total = aggregated.reduce((acc, entry) => {
    const next = acc + entry.netWorth;
    return Number.isFinite(next) ? next : acc;
  }, 0);
  const exposureTotal = aggregated.reduce((acc, entry) => {
    const next = acc + entry.exposure;
    return Number.isFinite(next) ? next : acc;
  }, 0);

  // No exposure -> nothing to show. Upstream renders the empty strip.
  if (exposureTotal <= 0) {
    return { total, slices: [] };
  }

  // Apply the 3% min-rank floor: a protocol must hold at least
  // PORTFOLIO_MIN_RANK_PERCENT of the exposure to claim a Top-N slot.
  // Below the floor it joins the Others tail. Iteration order is
  // exposure-descending, so the floor demotes the *bottom* of the
  // would-be Top-N first.
  const headEntries: IAggregatedProtocol[] = [];
  const tailEntries: IAggregatedProtocol[] = [];
  for (const entry of aggregated) {
    const sharePercent = (entry.exposure / exposureTotal) * 100;
    const qualifies =
      headEntries.length < PORTFOLIO_TOP_N &&
      sharePercent >= PORTFOLIO_MIN_RANK_PERCENT;
    if (qualifies) {
      headEntries.push(entry);
    } else {
      tailEntries.push(entry);
    }
  }

  const tailNetWorthSum = tailEntries.reduce(
    (acc, entry) => acc + entry.netWorth,
    0,
  );
  const tailExposureSum = tailEntries.reduce(
    (acc, entry) => acc + entry.exposure,
    0,
  );
  const includesOthers = tailExposureSum > 0;

  // Largest-remainder distribution over [...head, optional Others].
  // This guarantees the displayed percents sum to exactly 100.0.
  const exposuresForDistribution = includesOthers
    ? [...headEntries.map((e) => e.exposure), tailExposureSum]
    : headEntries.map((e) => e.exposure);
  const distributedPercents = distributePercents(exposuresForDistribution);

  const slices: IPortfolioSlice[] = headEntries.map((entry, rank) => ({
    key: entry.slug,
    label: entry.label,
    netWorth: entry.netWorth,
    percent: distributedPercents[rank],
    colorToken:
      PORTFOLIO_PALETTE_TOKENS[rank] ??
      PORTFOLIO_PALETTE_TOKENS[PORTFOLIO_PALETTE_TOKENS.length - 1],
    networkIds: entry.networkIds,
  }));

  if (includesOthers) {
    slices.push({
      key: PORTFOLIO_OTHERS_KEY,
      label: 'Others',
      netWorth: tailNetWorthSum,
      percent: distributedPercents[distributedPercents.length - 1],
      colorToken: PORTFOLIO_OTHERS_TOKEN,
      networkIds: [],
    });
  }

  return { total, slices };
}
