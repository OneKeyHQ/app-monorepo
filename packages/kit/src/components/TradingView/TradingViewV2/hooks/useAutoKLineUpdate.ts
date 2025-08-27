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
      console.log('[PRICE_UPDATE] 🚫 K-line update skipped:', {
        enabled,
        networkId: !!networkId,
        webRef: !!webRef.current,
        tokenAddress: tokenAddress || 'NATIVE',
      });
      return;
    }

    console.log('[PRICE_UPDATE] 🔄 K-line update starting:', {
      tokenAddress: tokenAddress || 'NATIVE',
      networkId,
      timestamp: new Date().toLocaleTimeString(),
      hasTokenDetail: !!tokenDetail,
      currentPrice: tokenDetail?.price,
    });

    try {
      const now = Math.floor(Date.now() / 1000);
      const timeFrom = now - 200;
      const timeTo = now;

      // Skip if we just updated recently (avoid duplicate calls)
      if (now - lastUpdateTime.current < 4) {
        console.log('[PRICE_UPDATE] ⏭️ K-line update too frequent, skipping');
        return;
      }

      const kLineData = await fetchTradingViewV2Data({
        tokenAddress,
        networkId,
        interval: '1m', // 1 minute interval
        timeFrom,
        timeTo,
      });

      console.log('[PRICE_UPDATE] 📊 K-line data fetched:', {
        tokenAddress: tokenAddress || 'NATIVE',
        hasData: !!kLineData,
        pointsCount: kLineData?.points?.length || 0,
        latestPrice: kLineData?.points?.[kLineData.points.length - 1]?.c || 'N/A',
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

        // Update token detail price with latest K-line close price
        console.log('[PRICE_UPDATE] 🔍 K-line price update check:', {
          tokenAddress: tokenAddress || 'NATIVE',
          hasPoints: !!(kLineData.points && kLineData.points.length > 0),
          hasTokenDetail: !!tokenDetail,
          pointsLength: kLineData.points?.length || 0,
        });

        if (kLineData.points && kLineData.points.length > 0 && tokenDetail) {
          const latestPoint = kLineData.points[kLineData.points.length - 1];
          const latestPrice = latestPoint.c.toString(); // close price

          console.log('[PRICE_UPDATE] 💰 K-line price comparison:', {
            tokenAddress: tokenAddress || 'NATIVE',
            currentPrice: tokenDetail.price,
            latestPrice,
            areEqual: tokenDetail.price === latestPrice,
            symbol: tokenDetail.symbol,
          });

          // Only update if the price is different to avoid unnecessary updates
          if (tokenDetail.price !== latestPrice) {
            const updatedTokenDetail: typeof tokenDetail = {
              ...tokenDetail,
              price: latestPrice,
              lastUpdated: now * 1000, // Convert to milliseconds for JavaScript Date
            };

            console.log('[PRICE_UPDATE] 🚀 K-line updating token detail:', {
              tokenAddress: tokenAddress || 'NATIVE',
              oldPrice: tokenDetail.price,
              newPrice: latestPrice,
              lastUpdated: new Date(now * 1000).toLocaleTimeString(),
              symbol: tokenDetail.symbol,
            });

            tokenDetailActions.current.setTokenDetail(updatedTokenDetail);

            console.log('[PRICE_UPDATE] ✅ K-line token detail update completed');
          } else {
            console.log('[PRICE_UPDATE] ⏭️ K-line price unchanged, skipping update');
          }
        } else {
          console.log('[PRICE_UPDATE] ❌ Cannot update K-line price - missing data:', {
            tokenAddress: tokenAddress || 'NATIVE',
            hasPoints: !!(kLineData.points && kLineData.points.length > 0),
            hasTokenDetail: !!tokenDetail,
            pointsCount: kLineData.points?.length || 0,
            tokenDetailPrice: tokenDetail?.price,
            tokenDetailSymbol: tokenDetail?.symbol,
          });
        }

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
