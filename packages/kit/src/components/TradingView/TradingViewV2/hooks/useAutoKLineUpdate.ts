import { type RefObject, useCallback, useRef } from 'react';

import { useInterval } from '@onekeyhq/kit/src/hooks/useInterval';

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

  const pushLatestKLineData = useCallback(async () => {
    // Skip if disabled or missing required params
    if (!enabled || !tokenAddress || !networkId || !webRef.current) {
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

      if (webRef.current && kLineData) {
        webRef.current.sendMessageViaInjectedScript({
          type: 'autoKLineUpdate',
          payload: {
            type: 'realtime',
            kLineData,
            timestamp: now,
          },
        });

        lastUpdateTime.current = now;
        // console.log('Auto K-line data pushed:', {
        //   kLineData,
        //   tokenAddress,
        //   networkId,
        //   timeFrom,
        //   timeTo,
        //   dataPoints: kLineData.points?.length || 0,
        // });
      }
    } catch (error) {
      console.error('Failed to push auto K-line data:', error);
    }
  }, [enabled, tokenAddress, networkId, webRef]);

  // Use the existing useInterval hook pattern
  useInterval(
    enabled && tokenAddress && networkId ? pushLatestKLineData : () => {},
    interval,
  );
}
