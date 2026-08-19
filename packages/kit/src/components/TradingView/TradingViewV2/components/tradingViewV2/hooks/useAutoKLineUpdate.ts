import { type RefObject, useCallback, useEffect, useRef } from 'react';

import type { IWebViewRef } from '@onekeyhq/kit/src/components/WebView/types';
import { useInterval } from '@onekeyhq/kit/src/hooks/useInterval';
import type { IMarketKLineProvider } from '@onekeyhq/shared/types/marketV2';

import { sendVolumeVisibilityUpdate } from '../messageHandlers/volumeVisibilityHandler';

import { fetchTradingViewV2Data } from './useTradingViewV2';

interface IAutoKLineUpdateParams {
  tokenAddress: string;
  networkId: string;
  kLineProvider?: IMarketKLineProvider;
  kLineProviderSymbol?: string;
  webRef: RefObject<IWebViewRef | null>;
  enabled?: boolean;
  interval?: number; // in milliseconds, default 5000
  autoHandleError?: boolean;
  symbol?: string;
  resolution?: string;
}

function normalizePollingKLineInterval(resolution: string): string {
  switch (resolution.trim()) {
    case '1':
      return '1m';
    case '3':
      return '3m';
    case '5':
      return '5m';
    case '15':
      return '15m';
    case '30':
      return '30m';
    case '60':
    case '1h':
      return '1H';
    case '120':
    case '2h':
      return '2H';
    case '240':
    case '4h':
      return '4H';
    case '480':
    case '8h':
      return '8H';
    case '720':
    case '12h':
      return '12H';
    case '1d':
      return '1D';
    case '3d':
      return '3D';
    case '1w':
      return '1W';
    case '1M':
      return '1M';
    default:
      return resolution.trim() || '1m';
  }
}

function getPollingKLineHistoryWindowSeconds(resolution: string): number {
  const match =
    normalizePollingKLineInterval(resolution).match(/^(\d+)([mHDWMy])$/);
  if (!match) {
    return 200;
  }

  const [, count, unit] = match;
  const secondsByUnit = {
    m: 60,
    H: 60 * 60,
    D: 24 * 60 * 60,
    W: 7 * 24 * 60 * 60,
    M: 30 * 24 * 60 * 60,
    y: 365 * 24 * 60 * 60,
  } as const;
  const intervalSeconds =
    Number(count) * secondsByUnit[unit as keyof typeof secondsByUnit];
  return Math.max(200, intervalSeconds * 2);
}

export function useAutoKLineUpdate({
  tokenAddress,
  networkId,
  kLineProvider = 'onekey',
  kLineProviderSymbol,
  webRef,
  enabled = true,
  interval = 5000,
  autoHandleError,
  symbol,
  resolution = '1m',
}: IAutoKLineUpdateParams) {
  const lastUpdateTime = useRef<number>(0);
  const activeRequestIdentityRef = useRef('');
  const pollingInterval = normalizePollingKLineInterval(resolution);
  const historyWindowSeconds =
    getPollingKLineHistoryWindowSeconds(pollingInterval);
  const requestIdentity = [
    enabled ? 'enabled' : 'disabled',
    networkId,
    tokenAddress,
    kLineProvider,
    kLineProviderSymbol,
    pollingInterval,
    symbol,
  ].join(':');
  activeRequestIdentityRef.current = requestIdentity;

  const pushLatestKLineData = useCallback(async () => {
    // Skip if disabled or missing required params
    // For native tokens, tokenAddress might be empty, but networkId is required
    if (!enabled || !networkId || !webRef.current) {
      return;
    }

    try {
      const requestWebView = webRef.current;
      const pendingRequestIdentity = requestIdentity;
      const now = Math.floor(Date.now() / 1000);
      const timeFrom = now - historyWindowSeconds;
      const timeTo = now;

      // Skip if we just updated recently (avoid duplicate calls)
      if (now - lastUpdateTime.current < 4) {
        return;
      }

      const kLineData = await fetchTradingViewV2Data({
        tokenAddress,
        networkId,
        kLineProvider,
        kLineProviderSymbol,
        interval: pollingInterval,
        timeFrom,
        timeTo,
        autoHandleError,
      });

      if (
        activeRequestIdentityRef.current !== pendingRequestIdentity ||
        webRef.current !== requestWebView
      ) {
        return;
      }

      // Sort K-line data by timestamp to ensure we get the actual latest price
      if (kLineData?.points && kLineData.points.length > 0) {
        kLineData.points.sort((a, b) => a.t - b.t);
      }

      if (webRef.current && kLineData) {
        webRef.current.sendMessageViaInjectedScript({
          type: 'autoKLineUpdate',
          payload: {
            type: 'realtime',
            kLineData,
            timestamp: now,
            subscriptionIdentity: {
              networkId,
              tokenAddress,
              resolution: pollingInterval,
            },
          },
        });
        sendVolumeVisibilityUpdate({
          allowHide: false,
          kLineData,
          source: 'realtime',
          symbol,
          webRef,
        });

        lastUpdateTime.current = now;
      }
    } catch (error) {
      console.error('Failed to push auto K-line data:', error);
    }
  }, [
    autoHandleError,
    enabled,
    historyWindowSeconds,
    networkId,
    kLineProvider,
    kLineProviderSymbol,
    pollingInterval,
    requestIdentity,
    symbol,
    tokenAddress,
    webRef,
  ]);

  useEffect(() => {
    lastUpdateTime.current = 0;
  }, [
    kLineProvider,
    kLineProviderSymbol,
    networkId,
    pollingInterval,
    tokenAddress,
  ]);

  useEffect(() => {
    if (enabled) {
      void pushLatestKLineData();
    }
  }, [enabled, pushLatestKLineData]);

  // Use the existing useInterval hook pattern
  // For native tokens, tokenAddress might be empty, but networkId is required
  useInterval(pushLatestKLineData, enabled && networkId ? interval : null);
}
