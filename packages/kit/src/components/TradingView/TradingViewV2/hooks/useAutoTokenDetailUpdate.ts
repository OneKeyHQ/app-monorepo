import { type RefObject, useCallback, useEffect, useRef } from 'react';

import { useTokenDetailAtom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/atoms';

import type { IWebViewRef } from '../../../WebView/types';

interface IAutoTokenDetailUpdateParams {
  tokenAddress: string;
  networkId: string;
  webRef: RefObject<IWebViewRef | null>;
  enabled?: boolean;
}

export function useAutoTokenDetailUpdate({
  tokenAddress,
  networkId,
  webRef,
  enabled = true,
}: IAutoTokenDetailUpdateParams) {
  const [tokenDetail] = useTokenDetailAtom();
  const lastUpdateTime = useRef<number>(0);

  const pushLatestTokenDetailData = useCallback(() => {
    // Skip if disabled or missing required params
    if (
      !enabled ||
      !tokenAddress ||
      !networkId ||
      !webRef.current ||
      !tokenDetail
    ) {
      return;
    }

    try {
      const now = Math.floor(Date.now() / 1000);

      // Skip if we just updated recently (avoid duplicate calls)
      if (now - lastUpdateTime.current < 1) {
        return;
      }

      console.log('🔍 Pushing token detail update from atom:', tokenDetail);
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
    } catch (error) {
      console.error('Failed to push auto token detail data:', error);
    }
  }, [enabled, tokenAddress, networkId, webRef, tokenDetail]);

  // Watch for tokenDetail changes and push updates immediately
  useEffect(() => {
    if (tokenDetail) {
      pushLatestTokenDetailData();
    }
  }, [tokenDetail, pushLatestTokenDetailData]);
}
