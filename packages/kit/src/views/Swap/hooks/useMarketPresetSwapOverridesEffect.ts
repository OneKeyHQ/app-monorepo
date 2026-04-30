import { useEffect, useRef } from 'react';

import {
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapStepNetFeeLevelAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap/atoms';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  ESwapNetworkFeeLevel,
  type IMarketPresetTokenContext,
} from '@onekeyhq/shared/types/swap/types';

import { EMarketPresetTradeSide } from '../../Market/MarketDetailV2/components/SwapPanel/hooks/marketPresetSettings';
import { loadMarketPresetSwapOverrides } from '../../Market/MarketDetailV2/components/SwapPanel/hooks/marketPresetSwapOverrides';

export function useMarketPresetSwapOverridesEffect({
  marketPresetToken,
}: {
  marketPresetToken?: IMarketPresetTokenContext;
}) {
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [, setSwapStepNetFeeLevel] = useSwapStepNetFeeLevelAtom();
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!marketPresetToken?.networkId) {
      return;
    }

    const matchToken = (token?: {
      networkId?: string;
      contractAddress?: string;
    }) =>
      equalTokenNoCaseSensitive({
        token1: token,
        token2: marketPresetToken,
      });

    let tradeSide: EMarketPresetTradeSide | undefined;
    if (matchToken(fromToken)) {
      tradeSide = EMarketPresetTradeSide.SELL;
    } else if (matchToken(toToken)) {
      tradeSide = EMarketPresetTradeSide.BUY;
    }

    if (!tradeSide) {
      setSwapStepNetFeeLevel({ networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM });
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    void (async () => {
      const overrides = await loadMarketPresetSwapOverrides({
        networkId: marketPresetToken.networkId,
        tradeSide,
      });
      if (requestIdRef.current !== requestId) {
        return;
      }
      setSwapStepNetFeeLevel({
        networkFeeLevel:
          overrides?.networkFeeLevel ?? ESwapNetworkFeeLevel.MEDIUM,
        customPriorityFee: overrides?.customPriorityFee,
      });
    })();
  }, [marketPresetToken, fromToken, toToken, setSwapStepNetFeeLevel]);

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      setSwapStepNetFeeLevel({ networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM });
    };
  }, [setSwapStepNetFeeLevel]);
}
