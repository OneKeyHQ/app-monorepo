import BigNumber from 'bignumber.js';

import type { IPerpsFormattedAssetCtx } from '@onekeyhq/shared/types/hyperliquid';
import type { IUserFunding } from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  type IPortfolioTimePeriod,
  buildCumulativeFundingChartData,
} from '../../Portfolio/portfolioStats';

export type IPositionFundingProjection = {
  currentRate: string;
  currentPayment: string;
  next24hRate: string;
  next24hPayment: string;
  annualizedRate: string;
  annualizedPayment: string;
};

export function resolvePositionFundingAssetCtx({
  positionCoin,
  activeMode,
  activeCoin,
  activeAssetCtx,
  fallbackAssetCtx,
  preferActiveAssetCtx,
}: {
  positionCoin: string;
  activeMode: 'perp' | 'spot';
  activeCoin: string;
  activeAssetCtx:
    | {
        coin: string;
        ctx: IPerpsFormattedAssetCtx;
      }
    | undefined;
  fallbackAssetCtx: IPerpsFormattedAssetCtx;
  preferActiveAssetCtx: boolean;
}): {
  assetCtx: IPerpsFormattedAssetCtx;
  usesActiveAssetCtx: boolean;
} {
  const activeMarkPrice = Number.parseFloat(
    activeAssetCtx?.ctx.markPrice ?? '0',
  );
  if (
    preferActiveAssetCtx &&
    activeMode === 'perp' &&
    activeCoin === positionCoin &&
    activeAssetCtx?.coin === positionCoin &&
    Number.isFinite(activeMarkPrice) &&
    activeMarkPrice > 0
  ) {
    return {
      assetCtx: activeAssetCtx.ctx,
      usesActiveAssetCtx: true,
    };
  }

  return { assetCtx: fallbackAssetCtx, usesActiveAssetCtx: false };
}

const positionFundingDateTimeFormatters = new Map<
  string,
  Intl.DateTimeFormat
>();

export function formatPositionFundingDateTime({
  timestampSeconds,
  timeZone,
}: {
  timestampSeconds: number;
  timeZone: string;
}) {
  let formatter = positionFundingDateTimeFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    positionFundingDateTimeFormatters.set(timeZone, formatter);
  }

  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date(timestampSeconds * 1000))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

export function buildPositionFundingProjection({
  signedSize,
  oraclePrice,
  fundingRate,
  fundingIntervalHours = 1,
}: {
  signedSize: string;
  oraclePrice: string;
  fundingRate: string;
  fundingIntervalHours?: number;
}): IPositionFundingProjection | null {
  const sizeBN = new BigNumber(signedSize);
  const oraclePriceBN = new BigNumber(oraclePrice);
  const fundingRateBN = new BigNumber(fundingRate);
  const intervalHoursBN = new BigNumber(fundingIntervalHours);

  if (
    !sizeBN.isFinite() ||
    !oraclePriceBN.isFinite() ||
    !fundingRateBN.isFinite() ||
    !intervalHoursBN.isFinite() ||
    sizeBN.isZero() ||
    intervalHoursBN.lte(0)
  ) {
    return null;
  }

  // Hyperliquid's positive rate is paid by longs. Negate the signed-position
  // formula so positive projected payments always mean money received.
  const currentPaymentBN = sizeBN
    .multipliedBy(oraclePriceBN)
    .multipliedBy(fundingRateBN)
    .negated();
  const settlementsPerDayBN = new BigNumber(24).dividedBy(intervalHoursBN);
  const annualSettlementsBN = settlementsPerDayBN.multipliedBy(365);

  return {
    currentRate: fundingRateBN.toFixed(),
    currentPayment: currentPaymentBN.toFixed(),
    next24hRate: fundingRateBN.multipliedBy(settlementsPerDayBN).toFixed(),
    next24hPayment: currentPaymentBN
      .multipliedBy(settlementsPerDayBN)
      .toFixed(),
    annualizedRate: fundingRateBN.multipliedBy(annualSettlementsBN).toFixed(),
    annualizedPayment: currentPaymentBN
      .multipliedBy(annualSettlementsBN)
      .toFixed(),
  };
}

export function buildPositionCumulativeFundingChartData({
  records,
  coin,
  timePeriod,
  now,
}: {
  records: IUserFunding[];
  coin: string;
  timePeriod: IPortfolioTimePeriod;
  now?: number;
}) {
  return buildCumulativeFundingChartData({
    records: records.filter((record) => record.delta.coin === coin),
    timePeriod,
    now,
  });
}
