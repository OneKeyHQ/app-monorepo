import { getTradingViewNativeSourceKey } from '../../getTradingViewNativeSource';

import { tradingViewNativeHyperliquidGateway } from './tradingViewNativeHyperliquidGateway';

import type { ITradingViewNativeSource } from '../../../types';
import type { ITradingViewNativeDataProvider } from '../types';

const HYPERLIQUID_HISTORY_BATCH_SIZE = 5000;

export function createTradingViewNativeHyperliquidDataProvider(
  source: Extract<ITradingViewNativeSource, { kind: 'hyperliquid' }>,
): ITradingViewNativeDataProvider {
  return {
    getHistoryRequestCandleCount: () => HYPERLIQUID_HISTORY_BATCH_SIZE,
    hasMoreHistory: ({ receivedPointCount }) =>
      receivedPointCount >= HYPERLIQUID_HISTORY_BATCH_SIZE,
    isReady: Boolean(source.coin),
    key: getTradingViewNativeSourceKey(source),
    supportsRealtime: true,
    fetchHistory: ({ interval, signal, timeFrom, timeTo }) =>
      tradingViewNativeHyperliquidGateway.fetchCandles({
        coin: source.coin,
        environment: source.environment,
        interval: interval.hyperliquidValue,
        signal,
        timeFrom,
        timeTo,
      }),
    subscribeRealtime: ({ interval, onPoint, signal, subscriberId }) =>
      signal.aborted
        ? Promise.resolve(null)
        : tradingViewNativeHyperliquidGateway.subscribeCandle({
            coin: source.coin,
            environment: source.environment,
            interval: interval.hyperliquidValue,
            listener: onPoint,
            subscriberId,
          }),
  };
}
