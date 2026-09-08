import { fetchMarketStockKLineData } from '@onekeyhq/kit/src/components/TradingView/utils/fetchMarketStockKLineData';

import { getTradingViewNativeSourceKey } from '../../getTradingViewNativeSource';

import type { ITradingViewNativeSource } from '../../../types';
import type { ITradingViewNativeDataProvider } from '../types';

const STOCK_HISTORY_REQUEST_CANDLE_COUNT = 100;

export function createTradingViewNativeStockDataProvider(
  source: Extract<ITradingViewNativeSource, { kind: 'stock' }>,
): ITradingViewNativeDataProvider {
  return {
    getHistoryRequestCandleCount: () => STOCK_HISTORY_REQUEST_CANDLE_COUNT,
    hasMoreHistory: ({ receivedPointCount }) => receivedPointCount > 0,
    isReady: Boolean(source.stockId.trim()),
    key: getTradingViewNativeSourceKey(source),
    supportsRealtime: false,
    fetchHistory: ({ interval, timeFrom, timeTo }) =>
      fetchMarketStockKLineData({
        interval: interval.label,
        stockId: source.stockId,
        timeFrom,
        timeTo,
      }),
    subscribeRealtime: async () => null,
  };
}
