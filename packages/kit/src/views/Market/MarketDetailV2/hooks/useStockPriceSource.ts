import { useCallback, useEffect, useRef } from 'react';

import {
  type IMarketPriceSource,
  useMarketPriceSourceAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { useStockDetail } from './StockDetailContext';

export function useStockPriceSource() {
  const { stockId, stockDetail } = useStockDetail();
  const isOpen = stockDetail?.marketStatus?.isOpen;
  const [{ source: priceMode }, setPriceSource] = useMarketPriceSourceAtom();
  const initializedRef = useRef(false);

  useEffect(() => {
    initializedRef.current = false;
    setPriceSource((prev) =>
      prev.source === 'share' ? prev : { source: 'share' },
    );
  }, [stockId, setPriceSource]);

  useEffect(() => {
    // Wait for this stock's market status, then apply its default only once.
    // Quote polling must not replace the user's choice on the same stock.
    if (!stockId || initializedRef.current || typeof isOpen !== 'boolean') {
      return;
    }
    initializedRef.current = true;
    const source = isOpen ? 'share' : 'token';
    setPriceSource((prev) => (prev.source === source ? prev : { source }));
  }, [isOpen, stockId, setPriceSource]);

  const handlePriceModeChange = useCallback(
    (source: IMarketPriceSource) => {
      // A manual choice made before the first response also takes precedence.
      initializedRef.current = true;
      setPriceSource({ source });
    },
    [setPriceSource],
  );

  return { priceMode, handlePriceModeChange };
}
