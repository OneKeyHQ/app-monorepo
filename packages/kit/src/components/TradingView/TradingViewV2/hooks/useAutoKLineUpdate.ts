import { type RefObject, useCallback, useRef } from 'react';

import { useInterval } from '@onekeyhq/kit/src/hooks/useInterval';
import {
  useTokenDetailActions,
  useTokenDetailAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';

import { fetchTradingViewV2Data } from './useTradingViewV2';

import type { IWebViewRef } from '../../../WebView/types';

interface IAutoKLineUpdateParams {
  tokenAddress: string;
  networkId: string;
  webRef: RefObject<IWebViewRef | null>;
  enabled?: boolean;
  interval?: number; // in milliseconds, default 60000 (1 minute)
}

export function useAutoKLineUpdate({
  tokenAddress,
  networkId,
  webRef,
  enabled = true,
  interval = 5000, // 1 minute
}: IAutoKLineUpdateParams) {
  const lastUpdateTime = useRef<number>(0);
  const tokenDetailActions = useTokenDetailActions();
  const [tokenDetail] = useTokenDetailAtom();

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
        return;
      }

      const kLineData = await fetchTradingViewV2Data({
        tokenAddress,
        networkId,
        interval: '1m', // 1 minute interval
        timeFrom,
        timeTo,
      });

      // Sort K-line data by timestamp to ensure we get the actual latest price
      if (kLineData?.points && kLineData.points.length > 0) {
        kLineData.points.sort((a, b) => a.t - b.t);
      }

      if (webRef.current && kLineData) {
        console.log('pushLatestKLineData2', kLineData);
        webRef.current.sendMessageViaInjectedScript({
          type: 'autoKLineUpdate',
          payload: {
            type: 'realtime',
            kLineData,
            timestamp: now,
          },
        });

        // Update token detail price with latest K-line close price

        if (kLineData.points && kLineData.points.length > 0 && tokenDetail) {
          const latestPoint = kLineData.points[kLineData.points.length - 1];
          const latestPrice = latestPoint.c.toString(); // close price

          // Only update if the price is different to avoid unnecessary updates
          if (tokenDetail.price !== latestPrice) {
            const updatedTokenDetail: typeof tokenDetail = {
              ...tokenDetail,
              price: latestPrice,
              lastUpdated: now * 1000, // Convert to milliseconds for JavaScript Date
            };

            tokenDetailActions.current.setTokenDetail(updatedTokenDetail);
          }
        }

        lastUpdateTime.current = now;
      }
    } catch (error) {
      console.error('Failed to push auto K-line data:', error);
    }
  }, [
    enabled,
    tokenAddress,
    networkId,
    webRef,
    tokenDetail,
    tokenDetailActions,
  ]);

  // Use the existing useInterval hook pattern
  // For native tokens, tokenAddress might be empty, but networkId is required
  useInterval(enabled && networkId ? pushLatestKLineData : () => {}, interval);
}
