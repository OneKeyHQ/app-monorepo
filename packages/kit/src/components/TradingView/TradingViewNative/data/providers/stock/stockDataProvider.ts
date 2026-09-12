import { fetchMarketStockKLineData } from '@onekeyhq/kit/src/components/TradingView/utils/fetchMarketStockKLineData';

import { getTradingViewNativeSourceKey } from '../../getTradingViewNativeSource';

import type { ITradingViewNativeSource } from '../../../types';
import type { ITradingViewNativeDataProvider } from '../types';

const STOCK_HISTORY_REQUEST_CANDLE_COUNT = 100;
const DAY_SECONDS = 24 * 60 * 60;
const MAX_EMPTY_HISTORY_WINDOWS = 8;

export function createTradingViewNativeStockDataProvider(
  source: Extract<ITradingViewNativeSource, { kind: 'stock' }>,
): ITradingViewNativeDataProvider {
  return {
    getHistoryRequestCandleCount: () => STOCK_HISTORY_REQUEST_CANDLE_COUNT,
    hasMoreHistory: ({ receivedPointCount }) => receivedPointCount > 0,
    isReady: Boolean(source.stockId.trim()),
    key: getTradingViewNativeSourceKey(source),
    supportsRealtime: false,
    fetchHistory: async ({
      interval,
      timeFrom,
      timeTo,
      signal,
      allowEarlierHistory,
    }) => {
      let from = timeFrom;
      let to = timeTo;
      let windowSeconds = Math.max(timeTo - timeFrom, DAY_SECONDS);
      const maxWindowSeconds = Math.max(windowSeconds, 30 * DAY_SECONDS);
      for (let attempt = 0; ; attempt += 1) {
        if (signal.aborted) {
          return null;
        }
        const data = await fetchMarketStockKLineData({
          interval: interval.label,
          stockId: source.stockId,
          timeFrom: from,
          timeTo: to,
        });
        if (signal.aborted) {
          return null;
        }
        if (
          data.points.length ||
          !allowEarlierHistory ||
          from <= 0 ||
          attempt >= MAX_EMPTY_HISTORY_WINDOWS - 1
        ) {
          return data;
        }
        // An empty window can be a weekend/holiday, not the end of history.
        // Keep requests bounded when a symbol has no older minute/hour coverage.
        to = from - 1;
        from = Math.max(to - windowSeconds, 0);
        windowSeconds = Math.min(windowSeconds * 2, maxWindowSeconds);
      }
    },
    subscribeRealtime: async () => null,
  };
}
