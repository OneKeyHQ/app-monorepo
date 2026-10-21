import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsTwapMarkPrice,
  useSpotActiveAssetCtxMarkPriceAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
export function useTwapReferencePrice({
  midPriceBN,
  enabled,
}: {
  midPriceBN: BigNumber;
  enabled: boolean;
}) {
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const isSpot = activeTradeInstrument.mode === 'spot';
  const perpMarkPrice = usePerpsTwapMarkPrice(enabled && !isSpot);
  const [spotMarkPrice] = useSpotActiveAssetCtxMarkPriceAtom();
  return useMemo(() => {
    const markPriceBN = new BigNumber(
      (isSpot ? spotMarkPrice : perpMarkPrice) ?? '',
    );
    return { sizePriceBN: isSpot ? midPriceBN : markPriceBN, markPriceBN };
  }, [isSpot, spotMarkPrice, perpMarkPrice, midPriceBN]);
}
