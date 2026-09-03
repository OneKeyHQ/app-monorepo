import { fetchMarketAssetKLineData } from '@onekeyhq/kit/src/components/TradingView/utils/fetchMarketAssetKLineData';

import { getTradingViewNativeSourceKey } from '../../getTradingViewNativeSource';

import type { ITradingViewNativeSource } from '../../../types';
import type { ITradingViewNativeDataProvider } from '../types';

const ASSET_HISTORY_REQUEST_CANDLE_COUNT = 2000;

export function createTradingViewNativeAssetDataProvider(
  source: Extract<ITradingViewNativeSource, { kind: 'asset' }>,
): ITradingViewNativeDataProvider {
  return {
    getHistoryRequestCandleCount: () => ASSET_HISTORY_REQUEST_CANDLE_COUNT,
    hasMoreHistory: ({ receivedPointCount }) => receivedPointCount > 0,
    isReady: Boolean(source.assetId.trim()),
    key: getTradingViewNativeSourceKey(source),
    supportsRealtime: false,
    fetchHistory: async ({ interval, signal, timeFrom, timeTo }) => {
      if (signal.aborted) {
        return null;
      }
      const data = await fetchMarketAssetKLineData({
        assetId: source.assetId,
        interval: interval.label,
        timeFrom,
        timeTo,
      });
      return signal.aborted ? null : data;
    },
    subscribeRealtime: async () => null,
  };
}
