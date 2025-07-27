import { type RefObject, useCallback, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useInterval } from '@onekeyhq/kit/src/hooks/useInterval';

import type { IWebViewRef } from '../../../WebView/types';

interface IAutoTokenDetailUpdateParams {
  tokenAddress: string;
  networkId: string;
  webRef: RefObject<IWebViewRef | null>;
  enabled?: boolean;
  interval?: number; // in milliseconds, default 1000 (1 second)
}

export function useAutoTokenDetailUpdate({
  tokenAddress,
  networkId,
  webRef,
  enabled = true,
  interval = 1000, // 1 second
}: IAutoTokenDetailUpdateParams) {
  const lastUpdateTime = useRef<number>(0);

  const pushLatestTokenDetailData = useCallback(async () => {
    // Skip if disabled or missing required params
    if (!enabled || !tokenAddress || !networkId || !webRef.current) {
      return;
    }

    try {
      const now = Math.floor(Date.now() / 1000);

      // Skip if we just updated recently (avoid duplicate calls)
      if (now - lastUpdateTime.current < 1) {
        return;
      }

      const tokenDetail =
        await backgroundApiProxy.serviceMarketV2.fetchMarketTokenDetailByTokenAddress(
          tokenAddress,
          networkId,
        );

      if (webRef.current && tokenDetail) {
        webRef.current.sendMessageViaInjectedScript({
          type: 'tokenDetailUpdate',
          payload: {
            tokenDetail,
            timestamp: now,
            tokenAddress,
            networkId,
          },
        });

        lastUpdateTime.current = now;
      }
    } catch (error) {
      console.error('Failed to push auto token detail data:', error);
    }
  }, [enabled, tokenAddress, networkId, webRef]);

  // Use the existing useInterval hook pattern
  useInterval(
    enabled && tokenAddress && networkId ? pushLatestTokenDetailData : () => {},
    interval,
  );
}
