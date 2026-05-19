import { useMemo } from 'react';

import { BigNumber } from 'bignumber.js';

import {
  useActiveTradeInstrumentAtom,
  usePerpsMidByCoin,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsActiveAssetCtxAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { useSpotActiveAssetCtxAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/spot';

export interface IUseTradingPriceReturn {
  midPrice: string | undefined;
  midPriceBN: BigNumber;
  isValid: boolean;
}

export function useTradingPrice(): IUseTradingPriceReturn {
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const activeMidPrice = usePerpsMidByCoin(activeTradeInstrument?.coin ?? '');
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
          activeMidPrice
        : activeAssetCtx?.ctx?.midPrice || activeMidPrice;

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
    activeMidPrice,
    activeTradeInstrument,
  ]);

  return result;
}
