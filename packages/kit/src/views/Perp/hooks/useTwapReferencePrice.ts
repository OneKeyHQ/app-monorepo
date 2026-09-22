import { useMemo } from 'react';

import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsTwapMarkPrice } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getTwapTriggerReferencePrice } from '@onekeyhq/shared/src/utils/hyperliquidTwapUtils';

import type { BigNumber } from 'bignumber.js';

// Single source so form, CTA validation, and submit agree on the TWAP
// reference price even while activeAssetCtx lags on cold start/reconnect.
// midPriceBN is caller-supplied to avoid adding a live mid subscription.
export function useTwapReferencePrice({
  midPriceBN,
  enabled,
}: {
  midPriceBN: BigNumber;
  enabled: boolean;
}): BigNumber {
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const isSpot = activeTradeInstrument.mode === 'spot';
  const markPrice = usePerpsTwapMarkPrice(enabled && !isSpot);
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
