import { type RefObject, useCallback, useRef } from 'react';

import { useInterval } from '@onekeyhq/kit/src/hooks/useInterval';

import {
  debugMarketTradingViewLog,
  shortMarketId,
  summarizeMarketKLineData,
} from '../debugLog';

import { fetchTradingViewV2Data } from './useTradingViewV2';

import type { IWebViewRef } from '../../../WebView/types';

interface IAutoKLineUpdateParams {
  tokenAddress: string;
  networkId: string;
  webRef: RefObject<IWebViewRef | null>;
  enabled?: boolean;
  interval?: number; // in milliseconds, default 60000 (1 minute)
  autoHandleError?: boolean;
}

export function useAutoKLineUpdate({
  tokenAddress,
  networkId,
  webRef,
  enabled = true,
  interval = 5000, // 1 minute
  autoHandleError,
}: IAutoKLineUpdateParams) {
  const lastUpdateTime = useRef<number>(0);

  const pushLatestKLineData = useCallback(async () => {
    // Skip if disabled or missing required params
    // For native tokens, tokenAddress might be empty, but networkId is required
    if (!enabled || !networkId || !webRef.current) {
      return;
    }

    try {
      const now = Math.floor(Date.now() / 1000);
      const timeFrom = now - 200;
      const timeTo = now;

      // Skip if we just updated recently (avoid duplicate calls)
      if (now - lastUpdateTime.current < 4) {
        debugMarketTradingViewLog('polling-realtime-skip-throttle', {
          tokenAddress: shortMarketId(tokenAddress),
          networkId,
          now,
          lastUpdateTime: lastUpdateTime.current,
        });
        return;
      }

      debugMarketTradingViewLog('polling-realtime-fetch', {
        tokenAddress: shortMarketId(tokenAddress),
        networkId,
        timeFrom,
        timeTo,
        autoHandleError,
      });

      const kLineData = await fetchTradingViewV2Data({
        tokenAddress,
        networkId,
        interval: '1m', // 1 minute interval
        timeFrom,
        timeTo,
        autoHandleError,
      });

      // Sort K-line data by timestamp to ensure we get the actual latest price
      if (kLineData?.points && kLineData.points.length > 0) {
        kLineData.points.sort((a, b) => a.t - b.t);
      }

      debugMarketTradingViewLog('polling-realtime-fetched', {
        tokenAddress: shortMarketId(tokenAddress),
        networkId,
        summary: summarizeMarketKLineData(kLineData),
      });

      if (webRef.current && kLineData) {
        debugMarketTradingViewLog('polling-realtime-send', {
          tokenAddress: shortMarketId(tokenAddress),
          networkId,
          summary: summarizeMarketKLineData(kLineData),
          timestamp: now,
        });

        webRef.current.sendMessageViaInjectedScript({
          type: 'autoKLineUpdate',
          payload: {
            type: 'realtime',
            kLineData,
            timestamp: now,
          },
        });

        lastUpdateTime.current = now;
      } else {
        debugMarketTradingViewLog('polling-realtime-send-skip', {
          tokenAddress: shortMarketId(tokenAddress),
          networkId,
          hasWebRef: Boolean(webRef.current),
          hasKLineData: Boolean(kLineData),
        });
      }
    } catch (error) {
      debugMarketTradingViewLog('polling-realtime-error', {
        tokenAddress: shortMarketId(tokenAddress),
        networkId,
        error: error instanceof Error ? error.message : String(error),
      });
      console.error('Failed to push auto K-line data:', error);
    }
  }, [enabled, tokenAddress, networkId, webRef, autoHandleError]);

  // Use the existing useInterval hook pattern
  // For native tokens, tokenAddress might be empty, but networkId is required
  useInterval(enabled && networkId ? pushLatestKLineData : () => {}, interval);
}
