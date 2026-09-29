import { useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { fetchMarketAssetKLineData } from '@onekeyhq/kit/src/components/TradingView/utils/fetchMarketAssetKLineData';
import { useIsMounted } from '@onekeyhq/kit/src/hooks/useIsMounted';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  tokenDetailAtom,
  useMarketV2ContextData,
  useTokenDetailActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';

import {
  MARKET_KLINE_LIVE_PRICE_INTERVAL,
  MARKET_KLINE_LIVE_PRICE_POLLING_MS,
  MARKET_KLINE_LIVE_PRICE_WINDOW_SECONDS,
  extractMarketKlineLivePrice,
  formatMarketKlineLivePrice,
  shouldApplyMarketKlineLivePrice,
} from '../utils/marketKlineLivePrice';

/**
 * Keeps the detail quote live for Simple charts and Native charts without WS.
 *
 * Detail responses only initialize the quote. Charts without a live quote feed
 * poll the matching token or aggregate asset feed here and overlay the newest
 * bucket's close.
 *
 * The ohlcv websocket is deliberately not used: it only emits on a trade, so
 * exactly the thin markets whose snapshot sits still are the ones it never
 * corrects.
 */
export function useMarketKlineLivePrice({
  enabled,
  marketAssetId,
  networkId,
  tokenAddress,
}: {
  enabled: boolean;
  marketAssetId?: string;
  networkId: string;
  tokenAddress: string;
}): void {
  const actions = useTokenDetailActions();
  const { store } = useMarketV2ContextData();
  const lastWrittenAtRef = useRef(0);
  const isMountedRef = useIsMounted();
  // `usePromiseResult` can drop a stale return value, but this hook writes to a
  // shared atom as a side effect, which no nonce can roll back. The scope this
  // request was started for has to be re-checked once it resolves.
  const requestScope = `${String(enabled)}|${networkId}|${tokenAddress}|${marketAssetId ?? ''}`;
  const requestScopeRef = useRef(requestScope);
  requestScopeRef.current = requestScope;
  // Ordering for overlapping polls of the same scope, so a slow older response
  // cannot land after a newer one has already updated the quote.
  const requestSeqRef = useRef(0);
  const appliedSeqRef = useRef(0);

  usePromiseResult(
    async () => {
      if (!enabled) {
        return;
      }

      requestSeqRef.current += 1;
      const requestSeq = requestSeqRef.current;
      const timeTo = Math.floor(Date.now() / 1000);
      let response;
      try {
        const timeFrom = timeTo - MARKET_KLINE_LIVE_PRICE_WINDOW_SECONDS;
        response = marketAssetId
          ? await fetchMarketAssetKLineData({
              assetId: marketAssetId,
              // Asset history serves buckets no finer than five minutes.
              interval: '5m',
              timeFrom,
              timeTo,
            })
          : await backgroundApiProxy.serviceMarketV2.fetchMarketTokenKline({
              interval: MARKET_KLINE_LIVE_PRICE_INTERVAL,
              networkId,
              tokenAddress,
              timeFrom,
              timeTo,
              autoHandleError: false,
            });
      } catch (_error) {
        // A refresh that fails keeps the price already on screen. Rethrowing
        // would surface as an unhandled rejection on every polling tick, since
        // the polling chain discards this promise.
        return;
      }

      const price = extractMarketKlineLivePrice(response?.points);
      if (price === undefined) {
        return;
      }

      // Price mode and Simple-vs-Pro can change while the request is in flight.
      // `applyChartPriceUpdate` only guards token identity, not the active feed.
      if (
        !isMountedRef.current ||
        !shouldApplyMarketKlineLivePrice({
          appliedSeq: appliedSeqRef.current,
          currentRequestScope: requestScopeRef.current,
          requestScope,
          requestSeq,
        })
      ) {
        return;
      }
      appliedSeqRef.current = requestSeq;

      // The header price cache drops any write that is not strictly newer than
      // the one it holds, so a quote timestamp is only useful while it stays
      // ahead of both the polled snapshot's and this hook's previous write.
      const detailLastUpdated = Number(
        store?.get(tokenDetailAtom())?.lastUpdated ?? 0,
      );
      const lastUpdated = Math.max(
        Date.now(),
        lastWrittenAtRef.current + 1,
        Number.isFinite(detailLastUpdated) ? detailLastUpdated + 1 : 0,
      );
      lastWrittenAtRef.current = lastUpdated;

      actions.current.applyChartPriceUpdate({
        networkId,
        tokenAddress,
        price: formatMarketKlineLivePrice(price),
        lastUpdated,
      });
    },
    [
      actions,
      enabled,
      isMountedRef,
      marketAssetId,
      networkId,
      requestScope,
      store,
      tokenAddress,
    ],
    {
      pollingInterval: MARKET_KLINE_LIVE_PRICE_POLLING_MS,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      // A modal left in the navigation stack makes this route report itself as
      // unfocused, which gates the runner into a no-op. The detail poll and the
      // chart series both opt out of that check for the same reason.
      checkIsFocused: false,
    },
  );
}
