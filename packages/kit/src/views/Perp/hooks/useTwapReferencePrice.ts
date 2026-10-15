import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsTwapMarkPrice } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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
    () => (isSpot ? midPriceBN : new BigNumber(markPrice ?? '')),
    [isSpot, markPrice, midPriceBN],
  );
}
