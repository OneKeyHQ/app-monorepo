import { type RefObject, useCallback, useEffect, useRef } from 'react';

import { useTokenDetailAtom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/atoms';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import type { IWebViewRef } from '../../../WebView/types';

interface IAutoTokenDetailUpdateParams {
  tokenAddress: string;
  networkId: string;
  webRef: RefObject<IWebViewRef | null>;
  enabled?: boolean;
}

function buildChartTokenDetailSnapshot(tokenDetail: IMarketTokenDetail) {
  const stableTokenDetail = { ...tokenDetail };
  delete stableTokenDetail.price;
  delete stableTokenDetail.priceConverted;
  delete stableTokenDetail.priceChange24hPercent;
  delete stableTokenDetail.lastUpdated;
  delete stableTokenDetail.realtimePriceSource;
  return stableTokenDetail;
}

export function useAutoTokenDetailUpdate({
  tokenAddress,
  networkId,
  webRef,
  enabled = true,
}: IAutoTokenDetailUpdateParams) {
  const [tokenDetail] = useTokenDetailAtom();
  const lastPushedTokenDetailRef = useRef<string>('');

  const pushLatestTokenDetailData = useCallback(() => {
    // Skip if disabled or missing required params
    // For native tokens, tokenAddress might be empty, but networkId is required
    if (!enabled || !networkId || !webRef.current || !tokenDetail) {
      return;
    }

    try {
      const tokenDetailSnapshot = JSON.stringify(
        buildChartTokenDetailSnapshot(tokenDetail),
      );
      if (lastPushedTokenDetailRef.current === tokenDetailSnapshot) {
        return;
      }

      const now = Math.floor(Date.now() / 1000);

      webRef.current.sendMessageViaInjectedScript({
        type: 'tokenDetailUpdate',
        payload: {
          tokenDetail,
          timestamp: now,
          tokenAddress,
          networkId,
        },
      });

      lastPushedTokenDetailRef.current = tokenDetailSnapshot;
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
