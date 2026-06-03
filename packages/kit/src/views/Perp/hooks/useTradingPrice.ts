import { useMemo } from 'react';

import { BigNumber } from 'bignumber.js';

import {
  useActiveTradeInstrumentAtom,
  usePerpsMidByCoin,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsActiveAssetCtxMidPriceAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  useSpotActiveAssetCtxMarkPriceAtom,
  useSpotActiveAssetCtxMidPriceAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/spot';

export interface IUseTradingPriceReturn {
  midPrice: string | undefined;
  midPriceBN: BigNumber;
  isValid: boolean;
}

function buildTradingPriceResult(
  midPrice: string | undefined,
): IUseTradingPriceReturn {
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
}

export function useTradingPrice(): IUseTradingPriceReturn {
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const activeMidPrice = usePerpsMidByCoin(activeTradeInstrument?.coin ?? '');
  const [activeAssetCtxMidPrice] = usePerpsActiveAssetCtxMidPriceAtom();
  const [activeSpotAssetCtxMidPrice] = useSpotActiveAssetCtxMidPriceAtom();
  const [activeSpotAssetCtxMarkPrice] = useSpotActiveAssetCtxMarkPriceAtom();

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
        ? activeSpotAssetCtxMidPrice ||
          activeSpotAssetCtxMarkPrice ||
          activeMidPrice
        : activeAssetCtxMidPrice || activeMidPrice;

    return buildTradingPriceResult(midPrice);
  }, [
    activeAssetCtxMidPrice,
    activeSpotAssetCtxMarkPrice,
    activeSpotAssetCtxMidPrice,
    activeMidPrice,
    activeTradeInstrument,
  ]);

  return result;
}
