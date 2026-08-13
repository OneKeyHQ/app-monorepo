import { useMemo } from 'react';

import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveAssetCtxMarkPriceAtom,
  usePerpsActiveAssetDataAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getTwapTriggerReferencePrice } from '@onekeyhq/shared/src/utils/hyperliquidTwapUtils';

import type { BigNumber } from 'bignumber.js';

// Single source of the TWAP reference price so form display, CTA validation,
// and submit agree; falls back to webData2 markPx while activeAssetCtx lags.
// midPriceBN comes from the caller's useTradingPrice to avoid an extra live
// mid subscription in callers that are on the display source.
export function useTwapReferencePrice({
  midPriceBN,
}: {
  midPriceBN: BigNumber;
}): BigNumber {
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const [ctxMarkPrice] = usePerpsActiveAssetCtxMarkPriceAtom();
  const [activeAssetData] = usePerpsActiveAssetDataAtom();
  const isSpot = activeTradeInstrument.mode === 'spot';
  const markPrice = ctxMarkPrice ?? activeAssetData?.markPx;
  return useMemo(
    () =>
      getTwapTriggerReferencePrice({
        isSpot,
        midPrice: midPriceBN,
        markPrice,
      }),
    [isSpot, markPrice, midPriceBN],
  );
}
