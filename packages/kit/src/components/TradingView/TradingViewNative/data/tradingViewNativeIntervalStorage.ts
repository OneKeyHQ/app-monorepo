import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorage';

import {
  DEFAULT_TRADING_VIEW_NATIVE_KLINE_INTERVAL,
  getTradingViewNativeKLineInterval,
} from './tradingViewNativeIntervals';

import type { ITradingViewNativeChartInterval } from './tradingViewNativeIntervals';
import type {
  ITradingViewNativeSource,
  ITradingViewNativeStorageNamespace,
} from '../types';

export type ITradingViewNativeIntervalStorageNamespace =
  | 'asset'
  | 'market-hyperliquid'
  | 'native'
  | 'stock'
  | 'swap'
  | 'token';

interface IStoredTradingViewNativeInterval {
  interval: ITradingViewNativeChartInterval;
  timestamp: number;
  version: 1;
}

function getStorageKey(namespace: ITradingViewNativeIntervalStorageNamespace) {
  return namespace === 'swap'
    ? EAppSyncStorageKeys.onekey_swap_trading_view_native_active_intervals_v1
    : EAppSyncStorageKeys.onekey_trading_view_native_active_intervals_v1;
}

export function getTradingViewNativeIntervalStorageNamespace(
  source: ITradingViewNativeSource,
  storageNamespace?: ITradingViewNativeStorageNamespace,
): ITradingViewNativeIntervalStorageNamespace {
  if (storageNamespace === 'swap') {
    return 'swap';
  }
  if (source.kind === 'hyperliquid') {
    return 'market-hyperliquid';
  }
  if (source.kind === 'stock') {
    return 'stock';
  }
  if (source.kind === 'asset') {
    return 'asset';
  }
  return source.isNative || !source.tokenAddress.trim() ? 'native' : 'token';
}

export function readTradingViewNativeActiveInterval(
  namespace: ITradingViewNativeIntervalStorageNamespace,
): ITradingViewNativeChartInterval {
  try {
    const storedIntervals = appStorage.syncStorage.getObject<
      Record<string, unknown>
    >(getStorageKey(namespace));
    const storedInterval = storedIntervals?.[namespace];
    if (!storedInterval || typeof storedInterval !== 'object') {
      return DEFAULT_TRADING_VIEW_NATIVE_KLINE_INTERVAL;
    }
    const interval = (storedInterval as { interval?: unknown }).interval;
    if (typeof interval !== 'string') {
      return DEFAULT_TRADING_VIEW_NATIVE_KLINE_INTERVAL;
    }
    return (
      getTradingViewNativeKLineInterval(interval)?.value ??
      DEFAULT_TRADING_VIEW_NATIVE_KLINE_INTERVAL
    );
  } catch {
    return DEFAULT_TRADING_VIEW_NATIVE_KLINE_INTERVAL;
  }
}

export async function saveTradingViewNativeActiveInterval({
  interval,
  namespace,
}: {
  interval: ITradingViewNativeChartInterval;
  namespace: ITradingViewNativeIntervalStorageNamespace;
}) {
  const supportedInterval = getTradingViewNativeKLineInterval(interval);
  if (!supportedInterval) {
    return;
  }

  try {
    const storageKey = getStorageKey(namespace);
    const storedIntervals =
      appStorage.syncStorage.getObject<Record<string, unknown>>(storageKey) ??
      {};
    const storedInterval: IStoredTradingViewNativeInterval = {
      interval: supportedInterval.value,
      timestamp: Date.now(),
      version: 1,
    };
    await appStorage.syncStorage.setObject(storageKey, {
      ...storedIntervals,
      [namespace]: storedInterval,
    });
  } catch {
    // Keep the active in-memory interval when preference storage is unavailable.
  }
}
