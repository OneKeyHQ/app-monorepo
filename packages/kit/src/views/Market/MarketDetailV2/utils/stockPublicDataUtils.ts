import type {
  IMarketStockAnalystRatings,
  IMarketStockEvent,
  IMarketStockInfo,
  IMarketStockPublicDetail,
} from '@onekeyhq/shared/types/marketV2';

import { STAT_FALLBACK_VALUE } from './statValue';

export const STOCK_ABOUT_IPO_DATE_LABEL = 'IPO Date';

export function buildStockInfoFromPublicDetail(
  detail: IMarketStockPublicDetail,
): IMarketStockInfo {
  return {
    title: detail.symbol,
    subtitle: detail.name,
    sourceLogoUri: detail.logoUrl,
    isOpen: detail.marketStatus?.isOpen,
    description:
      detail.marketStatus?.reason ?? detail.marketStatus?.session ?? undefined,
    assetAnalysis: {
      volume24h: detail.volume24h,
      volumeShares: detail.volumeShares,
      turnoverRate: detail.turnoverRate24h,
      avgDailyVolume1y: detail.averageVolume1y,
      weekHigh52: detail.weekHigh52,
      weekLow52: detail.weekLow52,
    },
    tradingActivity: {
      peRatio: detail.peRatio,
      pbRatio: detail.pbRatio,
      psRatio: detail.psRatio,
      debtToEquity: detail.debtToEquityTtm,
      dividendYield: detail.dividendYieldTtm,
    },
    dividendPerShare: detail.dividendPerShareTtm,
    marketCap: detail.marketCap,
    sharesOutstanding: detail.sharesOutstanding,
    underlyingAssetTicker: detail.symbol,
    underlyingAssetName: detail.name,
    analystRatings: detail.analystRatings,
    about: detail.about,
  };
}

export function formatDirectPercentValue(
  value?: string | number | null,
): string {
  if (value === null || value === undefined || value === '') {
    return STAT_FALLBACK_VALUE;
  }
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return STAT_FALLBACK_VALUE;
  }
  const roundedValue = Math.round((numericValue + Number.EPSILON) * 100) / 100;
  return `${roundedValue}%`;
}

export function getStockAnalystConsensus(
  analystRatings?: IMarketStockAnalystRatings,
) {
  return analystRatings?.consensus ?? STAT_FALLBACK_VALUE;
}

export function getStockEventMetadataRows(event?: IMarketStockEvent) {
  if (!event?.metadata) return [];
  return Object.entries(event.metadata)
    .filter(([, value]) => value !== null)
    .slice(0, 4)
    .map(([key, value]) => ({
      key,
      label: key
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/^./, (character) => character.toUpperCase()),
      value: String(value),
    }));
}
