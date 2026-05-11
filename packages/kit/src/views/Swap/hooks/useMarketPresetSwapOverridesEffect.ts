import { useEffect, useRef } from 'react';

import {
  useSwapProDirectionAtom,
  useSwapProSelectTokenAtom,
  useSwapProTradeTypeAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSlippageOverrideAtom,
  useSwapStepNetFeeLevelAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  ESwapNetworkFeeLevel,
  ESwapProTradeType,
  ESwapTabSwitchType,
  type IMarketPresetTokenContext,
  type ISwapProSpeedConfig,
} from '@onekeyhq/shared/types/swap/types';

import { EMarketPresetTradeSide } from '../../Market/MarketDetailV2/components/SwapPanel/hooks/marketPresetSettings';
import { loadMarketPresetSwapOverrides } from '../../Market/MarketDetailV2/components/SwapPanel/hooks/marketPresetSwapOverrides';
import { ESwapDirection } from '../../Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';

export function useMarketPresetSwapOverridesEffect({
  marketPresetToken,
  speedConfig,
  speedConfigReady,
}: {
  marketPresetToken?: IMarketPresetTokenContext;
  speedConfig?: ISwapProSpeedConfig;
  speedConfigReady?: boolean;
}) {
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [swapProDirection] = useSwapProDirectionAtom();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const [, setSwapStepNetFeeLevel] = useSwapStepNetFeeLevelAtom();
  const [, setSwapSlippageOverride] = useSwapSlippageOverrideAtom();
  const requestIdRef = useRef(0);

  useEffect(() => {
    // Bump request id at the very top so any in-flight async load from a prior
    // run is invalidated regardless of which branch we take below.
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const resetOverrides = () => {
      setSwapStepNetFeeLevel({ networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM });
      setSwapSlippageOverride(undefined);
    };

    if (!marketPresetToken?.networkId) {
      resetOverrides();
      return;
    }

    if (speedConfigReady === false) {
      resetOverrides();
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
    const focusSwapPro =
      platformEnv.isNative && swapTypeSwitch === ESwapTabSwitchType.LIMIT;
    const focusSwapProMarket =
      focusSwapPro && swapProTradeType === ESwapProTradeType.MARKET;
    if (focusSwapPro && !focusSwapProMarket) {
      resetOverrides();
      return;
    }

    if (focusSwapProMarket && matchToken(swapProSelectToken)) {
      tradeSide =
        swapProDirection === ESwapDirection.SELL
          ? EMarketPresetTradeSide.SELL
          : EMarketPresetTradeSide.BUY;
    } else if (matchToken(fromToken)) {
      tradeSide = EMarketPresetTradeSide.SELL;
    } else if (matchToken(toToken)) {
      tradeSide = EMarketPresetTradeSide.BUY;
    }

    if (!tradeSide) {
      resetOverrides();
      return;
    }

    resetOverrides();
    void (async () => {
      const overrides = await loadMarketPresetSwapOverrides({
        networkId: marketPresetToken.networkId,
        tradeSide,
        speedConfig,
        speedConfigReady,
      });
      if (requestIdRef.current !== requestId) {
        return;
      }
      setSwapStepNetFeeLevel({
        networkFeeLevel:
          overrides?.networkFeeLevel ?? ESwapNetworkFeeLevel.MEDIUM,
        customPriorityFee: overrides?.customPriorityFee,
      });
      setSwapSlippageOverride(overrides?.slippage);
    })();
  }, [
    marketPresetToken,
    fromToken,
    toToken,
    swapTypeSwitch,
    swapProSelectToken,
    swapProDirection,
    swapProTradeType,
    speedConfig,
    speedConfigReady,
    setSwapStepNetFeeLevel,
    setSwapSlippageOverride,
  ]);

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      setSwapStepNetFeeLevel({ networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM });
      setSwapSlippageOverride(undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
