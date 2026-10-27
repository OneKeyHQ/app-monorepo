import { useCallback, useLayoutEffect, useMemo, useState } from 'react';

import {
  type IMarketPriceSource,
  useMarketPriceSourceAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

export function resolveDisplayedStockPriceMode({
  stockId,
  isStockDetailError,
  storedPriceMode,
}: {
  stockId?: string;
  isStockDetailError?: boolean;
  storedPriceMode: IMarketPriceSource;
}): IMarketPriceSource {
  return !stockId || isStockDetailError ? 'token' : storedPriceMode;
}

export function useStockPriceSourceState({
  stockId,
  stockDetail,
  isStockDetailError,
}: {
  stockId?: string;
  stockDetail?: { marketStatus?: { isOpen?: boolean } } | null;
  isStockDetailError?: boolean;
}) {
  const [, setPriceSource] = useMarketPriceSourceAtom();
  const [selection, setSelection] = useState<{
    stockId?: string;
    source?: IMarketPriceSource;
  }>({ stockId });
  if (selection.stockId !== stockId) setSelection({ stockId });
  const currentSelection =
    selection.stockId === stockId ? selection.source : undefined;
  const isOpen = stockDetail?.marketStatus?.isOpen;
  const hasMarketStatus = typeof isOpen === 'boolean' && !isStockDetailError;
  const defaultSource = hasMarketStatus && isOpen ? 'share' : 'token';
  const source = currentSelection ?? defaultSource;

  useLayoutEffect(() => {
    // Lock the first known default. Quote polling must preserve manual choices.
    if (stockId && hasMarketStatus && !currentSelection) {
      setSelection({ stockId, source: defaultSource });
    }
    if (stockId)
      setPriceSource((prev) => (prev.source === source ? prev : { source }));
  }, [
    stockId,
    hasMarketStatus,
    currentSelection,
    defaultSource,
    source,
    setPriceSource,
  ]);

  const handlePriceModeChange = useCallback(
    (nextSource: IMarketPriceSource) => {
      if (stockId) setSelection({ stockId, source: nextSource });
      else setPriceSource({ source: nextSource });
    },
    [stockId, setPriceSource],
  );

  return useMemo(
    () => ({
      priceMode: resolveDisplayedStockPriceMode({
        stockId,
        isStockDetailError,
        storedPriceMode: source,
      }),
      handlePriceModeChange,
      sharePriceAvailable: Boolean(stockId) && !isStockDetailError,
      isPriceSourceReady:
        !stockId ||
        Boolean(
          currentSelection ||
          hasMarketStatus ||
          stockDetail ||
          isStockDetailError,
        ),
    }),
    [
      stockId,
      isStockDetailError,
      source,
      handlePriceModeChange,
      currentSelection,
      hasMarketStatus,
      stockDetail,
    ],
  );
}
