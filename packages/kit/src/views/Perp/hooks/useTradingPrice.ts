import { useMemo } from 'react';

import { BigNumber } from 'bignumber.js';

import {
  useActiveTradeInstrumentAtom,
  usePerpsAllMidsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsActiveAssetCtxAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { useSpotActiveAssetCtxAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/spot';

export interface IUseTradingPriceReturn {
  midPrice: string | undefined;
  midPriceBN: BigNumber;
  isValid: boolean;
}

export function useTradingPrice(): IUseTradingPriceReturn {
  const [allMids] = usePerpsAllMidsAtom();
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const [activeAssetCtx] = usePerpsActiveAssetCtxAtom();
  const [activeSpotAssetCtx] = useSpotActiveAssetCtxAtom();

  const result = useMemo<IUseTradingPriceReturn>(() => {
    const coin = activeTradeInstrument?.coin;
    if (!coin) {
      return {
        midPrice: undefined,
        midPriceBN: new BigNumber(0),
        isValid: false,
      };
    }

    const midPrice =
      activeTradeInstrument.mode === 'spot'
        ? activeSpotAssetCtx?.ctx?.midPrice ||
          activeSpotAssetCtx?.ctx?.markPrice ||
          allMids?.mids?.[coin]
        : activeAssetCtx?.ctx?.midPrice || allMids?.mids?.[coin];

    if (!midPrice) {
      return {
        midPrice: undefined,
        midPriceBN: new BigNumber(0),
        isValid: false,
      };
    }

    const midPriceBN = new BigNumber(midPrice);
    const isValid = midPriceBN.isFinite() && midPriceBN.gt(0);

    return {
      midPrice,
      midPriceBN,
      isValid,
    };
  }, [
    activeAssetCtx?.ctx?.midPrice,
    activeSpotAssetCtx?.ctx?.markPrice,
    activeSpotAssetCtx?.ctx?.midPrice,
    allMids?.mids,
    activeTradeInstrument,
  ]);

  return result;
}
