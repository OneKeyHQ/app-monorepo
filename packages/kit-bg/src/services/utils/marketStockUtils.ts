import type {
  IMarketStockDetail,
  IMarketStockInfo,
} from '@onekeyhq/shared/types/marketV2';

export interface IMarketStockUnderlyingMetaApiData {
  debtToEquityRatioTTM?: string;
  dividendPerShareTTM?: string;
  dividendYieldTTM?: string;
  introduction?: string;
  marketCap?: string;
  netProfitMarginTTM?: string;
  peRatioTTM?: string;
  priceToBookRatioTTM?: string;
  priceToSalesRatioTTM?: string;
  returnOnAssetsTTM?: string;
  returnOnEquityTTM?: string;
  sharesOutstanding?: string;
  turnoverRate24h?: string;
  volume24h?: string;
  volumeShares?: string;
  weekHigh52?: string;
  weekLow52?: string;
}

export interface IMarketStockAssetApiData {
  ticker: string;
  name: string;
  logoUrl?: string;
  underlyingMeta?: IMarketStockUnderlyingMetaApiData;
  underlyingUpdatedAt?: string;
}

export function buildMarketStockDetail(
  data: IMarketStockAssetApiData,
): IMarketStockDetail {
  const meta = data.underlyingMeta;
  const stock: IMarketStockInfo = {
    title: data.ticker,
    subtitle: data.name,
    sourceLogoUri: data.logoUrl ?? '',
    assetAnalysis: {
      volume24h: meta?.volume24h,
      volumeShares: meta?.volumeShares,
      turnoverRate: meta?.turnoverRate24h,
      weekHigh52: meta?.weekHigh52,
      weekLow52: meta?.weekLow52,
    },
    tradingActivity: {
      peRatio: meta?.peRatioTTM,
      pbRatio: meta?.priceToBookRatioTTM,
      psRatio: meta?.priceToSalesRatioTTM,
      roe: meta?.returnOnEquityTTM,
      roa: meta?.returnOnAssetsTTM,
      netProfitMargin: meta?.netProfitMarginTTM,
      debtToEquity: meta?.debtToEquityRatioTTM,
      dividendYield: meta?.dividendYieldTTM,
    },
    dividendPerShare: meta?.dividendPerShareTTM,
    marketCap: meta?.marketCap,
    sharesOutstanding: meta?.sharesOutstanding,
    underlyingAssetTicker: data.ticker,
    underlyingAssetName: data.name,
  };

  return {
    ticker: data.ticker,
    name: data.name,
    logoUrl: data.logoUrl,
    introduction: meta?.introduction,
    underlyingUpdatedAt: data.underlyingUpdatedAt,
    stock,
  };
}
