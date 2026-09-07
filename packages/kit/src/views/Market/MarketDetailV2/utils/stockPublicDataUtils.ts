import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IMarketStockAnalystRatings,
  IMarketStockEvent,
  IMarketStockInfo,
  IMarketStockPublicDetail,
} from '@onekeyhq/shared/types/marketV2';

import { STAT_FALLBACK_VALUE } from './statValue';

import type { IntlShape } from 'react-intl';

/**
 * The public stock endpoint describes the underlying listing, not the token
 * that wraps it, so it carries no issuer. `source` and `isPaused` have to be
 * threaded in from the token variant the page is showing — without a source
 * `resolveUSMarketStatusVariant` resolves to undefined and the market status
 * badge silently renders nothing.
 */
export function buildStockInfoFromPublicDetail(
  detail: IMarketStockPublicDetail,
  tokenStockInfo?: Pick<IMarketStockInfo, 'source' | 'isPaused'>,
): IMarketStockInfo {
  return {
    title: detail.symbol,
    subtitle: detail.name,
    source: tokenStockInfo?.source,
    isPaused: tokenStockInfo?.isPaused,
    sourceLogoUri: detail.logoUrl,
    isOpen: detail.marketStatus?.isOpen,
    // `session` is a raw backend enum (e.g. PRE_MARKET); the badge resolves the
    // session itself, so only the localized reason belongs in the tooltip.
    description: detail.marketStatus?.reason ?? undefined,
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

/**
 * The provider sends the consensus as a free-form English string, so it is
 * matched case-insensitively against the ratings vocabulary. Anything outside
 * that vocabulary is rendered as received rather than guessed at.
 */
const STOCK_ANALYST_CONSENSUS_LABEL_IDS: Record<string, ETranslations> = {
  buy: ETranslations.global_buy,
  sell: ETranslations.global_sell,
  hold: ETranslations.market_stock_rating_hold,
  'strong buy': ETranslations.market_stock_rating_strong_buy,
  'strong sell': ETranslations.market_stock_rating_strong_sell,
  neutral: ETranslations.market_stock_rating_neutral,
};

export function formatStockAnalystConsensus({
  intl,
  analystRatings,
}: {
  intl: IntlShape;
  analystRatings?: IMarketStockAnalystRatings;
}) {
  const consensus = getStockAnalystConsensus(analystRatings);
  const labelId =
    STOCK_ANALYST_CONSENSUS_LABEL_IDS[consensus.trim().toLowerCase()];
  return labelId ? intl.formatMessage({ id: labelId }) : consensus;
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
