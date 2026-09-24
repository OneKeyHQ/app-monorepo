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

type ITradingViewNativeBaseIntervalStorageNamespace =
  | 'asset'
  | 'market-hyperliquid'
  | 'native'
  | 'stock'
  | 'swap'
  | 'token';

export type ITradingViewNativeIntervalStorageNamespace =
  | ITradingViewNativeBaseIntervalStorageNamespace
  | `${ITradingViewNativeBaseIntervalStorageNamespace}:panel:${string}`;

interface IStoredTradingViewNativeInterval {
  interval: ITradingViewNativeChartInterval;
  timestamp: number;
  version: 1;
}

function getStorageKey(namespace: ITradingViewNativeIntervalStorageNamespace) {
  return namespace === 'swap' || namespace.startsWith('swap:panel:')
    ? EAppSyncStorageKeys.onekey_swap_trading_view_native_active_intervals_v1
    : EAppSyncStorageKeys.onekey_trading_view_native_active_intervals_v1;
}

export function getTradingViewNativeIntervalStorageNamespace(
  source: ITradingViewNativeSource,
  storageNamespace?: ITradingViewNativeStorageNamespace,
  panelId?: string,
): ITradingViewNativeIntervalStorageNamespace {
  if (panelId) {
    return `${getTradingViewNativeIntervalStorageNamespace(source, storageNamespace)}:panel:${panelId}`;
  }
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

export function readStoredTradingViewNativeActiveInterval(
  namespace: ITradingViewNativeIntervalStorageNamespace,
): ITradingViewNativeChartInterval | undefined {
  try {
    const storedIntervals = appStorage.syncStorage.getObject<
      Record<string, unknown>
    >(getStorageKey(namespace));
    const storedInterval = storedIntervals?.[namespace];
    if (!storedInterval || typeof storedInterval !== 'object') {
      return undefined;
    }
    const interval = (storedInterval as { interval?: unknown }).interval;
    if (typeof interval !== 'string') {
      return undefined;
    }
    return getTradingViewNativeKLineInterval(interval)?.value;
  } catch {
    return undefined;
  }
}

export function readTradingViewNativeActiveInterval(
  namespace: ITradingViewNativeIntervalStorageNamespace,
): ITradingViewNativeChartInterval {
  return (
    readStoredTradingViewNativeActiveInterval(namespace) ??
    DEFAULT_TRADING_VIEW_NATIVE_KLINE_INTERVAL
  );
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
