import { isMarketChartPriceTarget } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/marketTokenDetailPrice';
import type {
  IMarketWidgetChartMode,
  IMarketWidgetQuoteUpdate,
} from '@onekeyhq/shared/src/modules/MarketWidget/types';
import type {
  IMarketStockPublicDetail,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/marketV2';

import { getMarketSimpleChartRangePriceChange } from './MarketSimpleChartRangeChangeContext';

import type { IReportedSimpleChartRange } from './MarketSimpleChartRangeChangeContext';

export type IMarketWidgetQuoteTarget = {
  active: boolean;
  assetId?: string;
  networkId: string;
  tokenAddress: string;
  isNative: boolean;
};

function isFreshPrice(
  price: string | undefined,
  fetchedAt: number | undefined,
) {
  return (
    typeof price === 'string' &&
    price.trim() !== '' &&
    Number.isFinite(Number(price)) &&
    Number(price) >= 0 &&
    fetchedAt !== undefined &&
    Number.isFinite(fetchedAt) &&
    fetchedAt > 0 &&
    fetchedAt <= Date.now() &&
    Date.now() - fetchedAt < 300_000
  );
}

export function buildMarketWidgetTokenQuote({
  assetId,
  networkId,
  tokenAddress,
  isNative,
  tokenDetail,
}: Omit<IMarketWidgetQuoteTarget, 'active'> & {
  tokenDetail?: IMarketTokenDetail;
}): IMarketWidgetQuoteUpdate | undefined {
  const detailQuote = tokenDetail?.widgetDetailQuote;
  if (
    !tokenDetail ||
    !detailQuote ||
    detailQuote.assetId !== assetId ||
    tokenDetail.networkId !== networkId ||
    (!tokenAddress && isNative && tokenDetail.isNative !== true) ||
    !isMarketChartPriceTarget({
      tokenDetail,
      networkId,
      tokenAddress,
      isNative,
    }) ||
    !isFreshPrice(detailQuote.price, detailQuote.fetchedAt)
  )
    return undefined;
  const metadata = {
    symbol: tokenDetail.symbol,
    name: tokenDetail.name,
    logoURL: tokenDetail.logoUrl,
  };
  return {
    currency: 'usd',
    quote: {
      asset: assetId
        ? { kind: 'asset', assetId, ...metadata }
        : {
            kind: 'token',
            chainId: networkId,
            contractAddress: tokenAddress,
            requestTokenAddress: tokenDetail.address,
            isNative,
            ...metadata,
          },
      price: detailQuote.price,
      change24h: detailQuote.change24h,
      fetchedAt: detailQuote.fetchedAt,
      isDetailQuote: true,
    },
  };
}

export function buildMarketWidgetChartQuote(
  detail: IMarketWidgetQuoteUpdate,
  mode: IMarketWidgetChartMode,
  tokenDetail: IMarketTokenDetail,
  target: IMarketWidgetQuoteTarget,
  range?: IReportedSimpleChartRange,
): IMarketWidgetQuoteUpdate | undefined {
  const { price, chartPriceUpdatedAt, chartPriceMode } = tokenDetail;
  if (mode === 'pro' && chartPriceMode !== 'pro') {
    return {
      ...detail,
      quote: {
        ...detail.quote,
        chartMode: mode,
        detailFetchedAt: detail.quote.fetchedAt,
      },
    };
  }
  if (
    chartPriceMode !== mode ||
    price === undefined ||
    chartPriceUpdatedAt === undefined ||
    !isFreshPrice(price, chartPriceUpdatedAt)
  )
    return undefined;

  let change24h = detail.quote.change24h;
  let fetchedAt = Math.max(chartPriceUpdatedAt, detail.quote.fetchedAt);
  if (mode === 'simple') {
    const scope = range?.widgetScope;
    if (
      !scope ||
      range?.range !== '1D' ||
      range.latest !== Number(price) ||
      scope.assetId !== target.assetId ||
      scope.networkId !== target.networkId ||
      scope.tokenAddress !== target.tokenAddress ||
      !isFreshPrice(price, scope.observedAt)
    )
      return undefined;
    change24h = getMarketSimpleChartRangePriceChange(
      range,
      'token',
    )?.priceChangePercent;
    if (change24h === undefined) return undefined;
    fetchedAt = Math.max(chartPriceUpdatedAt, scope.observedAt);
  }
  return {
    currency: 'usd',
    quote: {
      asset: detail.quote.asset,
      price,
      change24h,
      fetchedAt,
      chartMode: mode,
      ...(mode === 'pro' ? { detailFetchedAt: detail.quote.fetchedAt } : {}),
    },
  };
}

export function buildMarketWidgetStockQuote(
  stock: IMarketStockPublicDetail | null | undefined,
  fetchedAt: number | undefined,
): IMarketWidgetQuoteUpdate | undefined {
  if (
    !stock ||
    stock.currency !== 'USD' ||
    !isFreshPrice(stock.price, fetchedAt) ||
    stock.price === undefined ||
    fetchedAt === undefined
  )
    return undefined;
  const samples = stock.sparkline;
  const validSamples =
    samples &&
    samples.length >= 2 &&
    samples.length <= 10_000 &&
    samples.every((value) => Number.isFinite(value) && value > 0);
  const count = Math.min(samples?.length ?? 0, 96);
  const priceUpdatedAt = stock.priceUpdatedAt
    ? Date.parse(stock.priceUpdatedAt)
    : NaN;
  return {
    currency: 'usd',
    quote: {
      asset: {
        kind: 'stock',
        stockId: stock.stockId,
        symbol: stock.symbol,
        name: stock.name,
        logoURL: stock.logoUrl,
      },
      price: stock.price,
      change24h: stock.priceChange24hPercent,
      fetchedAt,
      stockSparkline: validSamples
        ? Array.from(
            { length: count },
            (_, index) =>
              samples[Math.floor((index * (samples.length - 1)) / (count - 1))],
          )
        : undefined,
      priceUpdatedAt:
        Number.isFinite(priceUpdatedAt) &&
        priceUpdatedAt > 0 &&
        priceUpdatedAt <= fetchedAt + 60_000
          ? priceUpdatedAt
          : undefined,
      marketClosed: stock.marketStatus ? !stock.marketStatus.isOpen : undefined,
    },
  };
}
