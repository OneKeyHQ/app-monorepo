import { useCallback, useEffect, useRef } from 'react';

import { prewarmMarketTokenImages } from '../../utils/marketDetailImagePreload';

import { prefetchMarketTokenSelection } from './navigateToMarketTokenDetail';

import type { IMarketToken } from '../../../MarketHomeV2/components/MarketTokenList/MarketTokenData';

export const MARKET_TOKEN_SELECTOR_HOVER_PREFETCH_DELAY_MS = 150;

export function useMarketTokenSelectorRowPrefetch(item: IMarketToken) {
  const hoverPrefetchTimerRef = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);

  const cancelHoverPrefetch = useCallback(() => {
    if (hoverPrefetchTimerRef.current !== undefined) {
      clearTimeout(hoverPrefetchTimerRef.current);
      hoverPrefetchTimerRef.current = undefined;
    }
  }, []);

  const prefetchSelection = useCallback(() => {
    if (item.perpsCoin) {
      return;
    }

    prefetchMarketTokenSelection({
      address: item.address,
      networkId: item.networkId,
      firstTradeTime: item.firstTradeTime,
    });
  }, [item.address, item.firstTradeTime, item.networkId, item.perpsCoin]);

  const handleHoverIn = useCallback(() => {
    prewarmMarketTokenImages(item);
    cancelHoverPrefetch();
    hoverPrefetchTimerRef.current = setTimeout(() => {
      hoverPrefetchTimerRef.current = undefined;
      prefetchSelection();
    }, MARKET_TOKEN_SELECTOR_HOVER_PREFETCH_DELAY_MS);
  }, [cancelHoverPrefetch, item, prefetchSelection]);

  const handlePressIn = useCallback(() => {
    prewarmMarketTokenImages(item);
    cancelHoverPrefetch();
    prefetchSelection();
  }, [cancelHoverPrefetch, item, prefetchSelection]);

  useEffect(
    () => cancelHoverPrefetch,
    [cancelHoverPrefetch, item.address, item.networkId],
  );

  return {
    cancelHoverPrefetch,
    handleHoverIn,
    handlePressIn,
  };
}
