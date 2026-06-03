import type { IMarketTokenDetailRealtimePriceSource } from '@onekeyhq/shared/types/marketV2';

export const MARKET_TOKEN_DETAIL_REALTIME_PRICE_SOURCE = {
  hyperLiquid: 'hyperliquid',
  marketWs: 'market-ws',
  kLinePolling: 'kline-polling',
} as const satisfies Record<string, IMarketTokenDetailRealtimePriceSource>;
