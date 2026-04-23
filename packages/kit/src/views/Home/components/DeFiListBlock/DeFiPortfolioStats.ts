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
  protocol?: IDeFiProtocol;
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

  const ranked = protocols
    .map((protocol, originalIndex) => ({
      protocol,
      originalIndex,
      netWorth: getNetWorth(protocol),
    }))
    .toSorted((a, b) => {
      if (a.netWorth !== b.netWorth) return b.netWorth - a.netWorth;
      return a.originalIndex - b.originalIndex;
    });

  const total = ranked.reduce((acc, entry) => {
    const next = acc + entry.netWorth;
    return Number.isFinite(next) ? next : acc;
  }, 0);

  const headEntries = ranked.slice(0, PORTFOLIO_TOP_N);
  const tailEntries = ranked.slice(PORTFOLIO_TOP_N);

  const slices: IPortfolioSlice[] = headEntries.map((entry, rank) => {
    const percent =
      total > 0 ? roundToOneDecimal((entry.netWorth / total) * 100) : 0;
    return {
      key: defiUtils.buildProtocolMapKey({
        protocol: entry.protocol.protocol,
        networkId: entry.protocol.networkId,
      }),
      label: resolveLabel(entry.protocol, protocolMap),
      netWorth: entry.netWorth,
      percent,
      colorToken:
        PORTFOLIO_PALETTE_TOKENS[rank] ??
        PORTFOLIO_PALETTE_TOKENS[PORTFOLIO_PALETTE_TOKENS.length - 1],
      protocol: entry.protocol,
    };
  });

  const tailSum = tailEntries.reduce((acc, entry) => acc + entry.netWorth, 0);
  if (tailSum > 0) {
    slices.push({
      key: PORTFOLIO_OTHERS_KEY,
      label: 'Others',
      netWorth: tailSum,
      percent: total > 0 ? roundToOneDecimal((tailSum / total) * 100) : 0,
      colorToken: PORTFOLIO_OTHERS_TOKEN,
    });
  }

  return { total, slices };
}
