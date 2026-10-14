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
  | 'perps'
  | 'native'
  | 'stock'
  | 'swap'
  | 'token';

interface IStoredTradingViewNativeInterval {
  interval: string;
  timestamp: number;
  version: 1;
}

export function normalizeTradingViewStoredInterval(interval: string) {
  const hourMatch = interval.match(/^(\d+)H$/);
  const value = hourMatch ? String(Number(hourMatch[1]) * 60) : interval;
  return (
    getTradingViewNativeKLineInterval(value)?.value ??
    (['3', '120', '480', '720', '3D'].includes(value) ? value : undefined)
  );
}

function getStorageKey(namespace: ITradingViewNativeIntervalStorageNamespace) {
  if (namespace === 'perps') {
    return EAppSyncStorageKeys.onekey_perps_trading_view_native_active_intervals_v1;
  }
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
  if (storageNamespace === 'perps') {
    return 'perps';
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

export function readStoredTradingViewActiveInterval(
  namespace: ITradingViewNativeIntervalStorageNamespace,
): string | undefined {
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
    return normalizeTradingViewStoredInterval(interval);
  } catch {
    return undefined;
  }
}

export function readStoredTradingViewNativeActiveInterval(
  namespace: ITradingViewNativeIntervalStorageNamespace,
): ITradingViewNativeChartInterval | undefined {
  const interval = readStoredTradingViewActiveInterval(namespace);
  return interval
    ? getTradingViewNativeKLineInterval(interval)?.value
    : undefined;
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

  return saveTradingViewActiveInterval({
    interval: supportedInterval.value,
    namespace,
  });
}

export async function saveTradingViewActiveInterval({
  interval,
  namespace,
}: {
  interval: string;
  namespace: ITradingViewNativeIntervalStorageNamespace;
}) {
  const supportedInterval = normalizeTradingViewStoredInterval(interval);
  if (!supportedInterval) {
    return;
  }

  try {
    const storageKey = getStorageKey(namespace);
    const storedIntervals =
      appStorage.syncStorage.getObject<Record<string, unknown>>(storageKey) ??
      {};
    const storedInterval: IStoredTradingViewNativeInterval = {
      interval: supportedInterval,
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
