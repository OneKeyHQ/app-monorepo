import { type RefObject, useCallback, useRef } from 'react';

import { useInterval } from '@onekeyhq/kit/src/hooks/useInterval';
import {
  useTokenDetailActions,
  useTokenDetailAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { MARKET_TOKEN_DETAIL_REALTIME_PRICE_SOURCE } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/constants';
import {
  buildRealtimeTokenDetail,
  isMarketTokenDetailMatched,
  isValidRealtimePrice,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/priceUtils';

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
  const tokenDetailActions = useTokenDetailActions();
  const [tokenDetail] = useTokenDetailAtom();
  const tokenDetailRef = useRef(tokenDetail);
  const isFetchingRef = useRef(false);
  const requestGenerationRef = useRef(0);
  const previousParamsRef = useRef({ tokenAddress, networkId, enabled });
  const latestParamsRef = useRef({
    tokenAddress,
    networkId,
    enabled,
    generation: requestGenerationRef.current,
  });

  tokenDetailRef.current = tokenDetail;

  if (
    previousParamsRef.current.tokenAddress !== tokenAddress ||
    previousParamsRef.current.networkId !== networkId ||
    previousParamsRef.current.enabled !== enabled
  ) {
    requestGenerationRef.current += 1;
    previousParamsRef.current = { tokenAddress, networkId, enabled };
  }

  latestParamsRef.current = {
    tokenAddress,
    networkId,
    enabled,
    generation: requestGenerationRef.current,
  };

  const pushLatestKLineData = useCallback(async () => {
    // Skip if disabled or missing required params
    // For native tokens, tokenAddress might be empty, but networkId is required
    if (!enabled || !networkId || !webRef.current || isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;
    const requestParams = { ...latestParamsRef.current };

    try {
      const nowMs = Date.now();
      const now = Math.floor(nowMs / 1000);
      const timeFrom = now - 200;
      const timeTo = now;

      const kLineData = await fetchTradingViewV2Data({
        tokenAddress,
        networkId,
        interval: '1m', // 1 minute interval
        timeFrom,
        timeTo,
        autoHandleError,
      });

      const latestParams = latestParamsRef.current;
      if (
        !latestParams.enabled ||
        latestParams.generation !== requestParams.generation ||
        latestParams.tokenAddress !== requestParams.tokenAddress ||
        latestParams.networkId !== requestParams.networkId ||
        !webRef.current
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
          },
        });

        // Update token detail price with latest K-line close price

        const latestTokenDetail = tokenDetailRef.current;
        if (
          kLineData.points &&
          kLineData.points.length > 0 &&
          latestTokenDetail
        ) {
          const latestPoint = kLineData.points[kLineData.points.length - 1];
          const latestPrice = latestPoint.c.toString(); // close price

          if (
            isValidRealtimePrice(latestPrice) &&
            isMarketTokenDetailMatched({
              tokenDetail: latestTokenDetail,
              tokenAddress: requestParams.tokenAddress,
              networkId: requestParams.networkId,
            })
          ) {
            tokenDetailActions.current.setTokenDetail(
              buildRealtimeTokenDetail({
                tokenDetail: latestTokenDetail,
                realtimePrice: latestPrice,
                realtimePriceSource:
                  MARKET_TOKEN_DETAIL_REALTIME_PRICE_SOURCE.kLinePolling,
                lastUpdated: nowMs,
              }),
            );
          }
        }
      }
    } catch (error) {
      console.error('Failed to push auto K-line data:', error);
    } finally {
      isFetchingRef.current = false;
    }
  }, [
    enabled,
    tokenAddress,
    networkId,
    webRef,
    tokenDetailActions,
    autoHandleError,
  ]);

  // Use the existing useInterval hook pattern
  // For native tokens, tokenAddress might be empty, but networkId is required
  useInterval(enabled && networkId ? pushLatestKLineData : () => {}, interval);
}
