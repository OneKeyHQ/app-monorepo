import { useCallback, useEffect, useRef } from 'react';

import {
  type IMarketPriceSource,
  useMarketPriceSourceAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { useStockDetail } from './StockDetailContext';

export function resolveDisplayedStockPriceMode({
  stockId,
  isStockDetailError,
  storedPriceMode,
}: {
  stockId?: string;
  isStockDetailError?: boolean;
  storedPriceMode: IMarketPriceSource;
}): IMarketPriceSource {
  // A failed share quote has no series to draw. Callers that read the stored
  // atom directly would otherwise keep the share chart beside a token header.
  if (!stockId || isStockDetailError) {
    return 'token';
  }
  return storedPriceMode;
}

export function useStockPriceSource() {
  const { stockId, stockDetail, isStockDetailError } = useStockDetail();
  const isOpen = stockDetail?.marketStatus?.isOpen;
  const [{ source: storedPriceMode }, setPriceSource] =
    useMarketPriceSourceAtom();
  const initializedRef = useRef(false);
  const sharePriceAvailable = Boolean(stockId) && !isStockDetailError;

  useEffect(() => {
    // No listing id means there is no share quote to select. Leave the stored
    // mode alone so the next stock can still apply its own default.
    if (!stockId) {
      return;
    }
    initializedRef.current = false;
    setPriceSource((prev) =>
      prev.source === 'share' ? prev : { source: 'share' },
    );
  }, [stockId, setPriceSource]);

  useEffect(() => {
    // Wait for this stock's market status, then apply its default only once.
    // Quote polling must not replace the user's choice on the same stock.
    if (
      !stockId ||
      isStockDetailError ||
      initializedRef.current ||
      typeof isOpen !== 'boolean'
    ) {
      return;
    }
    initializedRef.current = true;
    const source = isOpen ? 'share' : 'token';
    setPriceSource((prev) => (prev.source === source ? prev : { source }));
  }, [isOpen, isStockDetailError, stockId, setPriceSource]);

  const handlePriceModeChange = useCallback(
    (source: IMarketPriceSource) => {
      // A manual choice made before the first response also takes precedence.
      initializedRef.current = true;
      setPriceSource({ source });
    },
    [setPriceSource],
  );

  const priceMode = resolveDisplayedStockPriceMode({
    stockId,
    isStockDetailError,
    storedPriceMode,
  });

  return { priceMode, handlePriceModeChange, sharePriceAvailable };
}
