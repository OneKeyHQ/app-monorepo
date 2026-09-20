import { useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
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
} from '../utils/marketKlineLivePrice';

/**
 * Keeps the detail quote on the traded price while no Pro chart is mounted.
 *
 * `/market/token/detail` answers from a snapshot that can hold one price for
 * minutes, so the 6s poll behind `tokenDetail` is not what makes the header
 * live. The Pro chart stays live because TradingView runs its own K-line feed
 * and reports the price back; the Simple chart mounts no TradingView, so it
 * polls the same K-line endpoint here and overlays the newest bucket's close.
 *
 * The ohlcv websocket is deliberately not used: it only emits on a trade, so
 * exactly the thin markets whose snapshot sits still are the ones it never
 * corrects.
 */
export function useMarketKlineLivePrice({
  enabled,
  networkId,
  tokenAddress,
}: {
  enabled: boolean;
  networkId: string;
  tokenAddress: string;
}): void {
  const actions = useTokenDetailActions();
  const { store } = useMarketV2ContextData();
  const lastWrittenAtRef = useRef(0);

  usePromiseResult(
    async () => {
      if (!enabled) {
        return;
      }

      const timeTo = Math.floor(Date.now() / 1000);
      const response =
        await backgroundApiProxy.serviceMarketV2.fetchMarketTokenKline({
          interval: MARKET_KLINE_LIVE_PRICE_INTERVAL,
          networkId,
          tokenAddress,
          timeFrom: timeTo - MARKET_KLINE_LIVE_PRICE_WINDOW_SECONDS,
          timeTo,
          autoHandleError: false,
        });

      const price = extractMarketKlineLivePrice(response?.points);
      if (price === undefined) {
        return;
      }

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
    [actions, enabled, networkId, store, tokenAddress],
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
