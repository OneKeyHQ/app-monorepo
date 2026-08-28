import { useMemo } from 'react';

import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveAssetCtxMarkPriceAtom,
  usePerpsActiveAssetDataAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getTwapTriggerReferencePrice } from '@onekeyhq/shared/src/utils/hyperliquidTwapUtils';

import type { BigNumber } from 'bignumber.js';

// Single source so form, CTA validation, and submit agree on the TWAP
// reference price even while activeAssetCtx lags on cold start/reconnect.
// midPriceBN is caller-supplied to avoid adding a live mid subscription.
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
