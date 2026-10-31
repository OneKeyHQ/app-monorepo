import { isMarketChartPriceTarget } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/marketTokenDetailPrice';
import type { IMarketWidgetQuoteUpdate } from '@onekeyhq/shared/src/modules/MarketWidget/types';
import type {
  IMarketStockPublicDetail,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/marketV2';

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
  const fetchedAt = tokenDetail?.priceObservedAt;
  if (
    !tokenDetail ||
    tokenDetail.networkId !== networkId ||
    !isMarketChartPriceTarget({
      tokenDetail,
      networkId,
      tokenAddress,
      isNative,
    }) ||
    !isFreshPrice(tokenDetail.price, fetchedAt) ||
    tokenDetail.price === undefined ||
    fetchedAt === undefined
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
      // priceConverted belongs to the App's display currency, not the widget.
      price: tokenDetail.price,
      change24h: tokenDetail.priceChange24hPercent,
      fetchedAt,
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
