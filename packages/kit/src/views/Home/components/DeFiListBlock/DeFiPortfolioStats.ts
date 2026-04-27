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

export function roundToOneDecimal(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}

export function buildPortfolioStats(
  input: IBuildPortfolioStatsInput,
): IPortfolioStats {
  const { protocols, protocolMap, getNetWorth } = input;
  if (!protocols || protocols.length === 0) {
    return { total: 0, slices: [] };
  }

  // Aggregate same protocol across networks. All Networks mode lists an
  // entry per (protocol, network); the pie's semantic unit is "protocol",
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

  const headEntries = aggregated.slice(0, PORTFOLIO_TOP_N);
  const tailEntries = aggregated.slice(PORTFOLIO_TOP_N);

  const slices: IPortfolioSlice[] = headEntries.map((entry, rank) => {
    const percent =
      exposureTotal > 0
        ? roundToOneDecimal((entry.exposure / exposureTotal) * 100)
        : 0;
    return {
      key: entry.slug,
      label: entry.label,
      netWorth: entry.netWorth,
      percent,
      colorToken:
        PORTFOLIO_PALETTE_TOKENS[rank] ??
        PORTFOLIO_PALETTE_TOKENS[PORTFOLIO_PALETTE_TOKENS.length - 1],
      networkIds: entry.networkIds,
    };
  });

  const tailSum = tailEntries.reduce((acc, entry) => acc + entry.netWorth, 0);
  const tailExposureSum = tailEntries.reduce(
    (acc, entry) => acc + entry.exposure,
    0,
  );
  if (tailExposureSum > 0) {
    slices.push({
      key: PORTFOLIO_OTHERS_KEY,
      label: 'Others',
      netWorth: tailSum,
      percent:
        exposureTotal > 0
          ? roundToOneDecimal((tailExposureSum / exposureTotal) * 100)
          : 0,
      colorToken: PORTFOLIO_OTHERS_TOKEN,
      networkIds: [],
    });
  }

  return { total, slices };
}
