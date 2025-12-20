import { useMemo } from 'react';

import { BigNumber } from 'bignumber.js';

import { usePerpsAllMidsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetCtxAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

export interface IUseTradingPriceReturn {
  midPrice: string | undefined;
  midPriceBN: BigNumber;
  isValid: boolean;
}

export function useTradingPrice(): IUseTradingPriceReturn {
  const [allMids] = usePerpsAllMidsAtom();
  const [activeAsset] = usePerpsActiveAssetAtom();
  const [activeAssetCtx] = usePerpsActiveAssetCtxAtom();

  const result = useMemo<IUseTradingPriceReturn>(() => {
    const coin = activeAsset?.coin;
    if (!coin) {
      return {
        midPrice: undefined,
        midPriceBN: new BigNumber(0),
        isValid: false,
      };
    }

    // Priority 1: Use activeAssetCtx.ctx.midPrice (higher update frequency for active token)
    // Priority 2: Fallback to allMids (lower frequency but covers all tokens)
    const midPrice = activeAssetCtx?.ctx?.midPrice || allMids?.mids?.[coin];

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
  }, [activeAssetCtx?.ctx?.midPrice, allMids?.mids, activeAsset?.coin]);

  return result;
}
