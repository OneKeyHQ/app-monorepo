import { useEffect, useRef } from 'react';

import {
  useSwapProDirectionAtom,
  useSwapProSelectTokenAtom,
  useSwapProTradeTypeAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSlippageOverrideAtom,
  useSwapSlippageOverrideContextKeyAtom,
  useSwapSlippageOverrideSuppressedContextKeyAtom,
  useSwapSlippageOverrideUserRevisionAtom,
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
} from '@onekeyhq/shared/types/swap/types';

import {
  type EMarketPresetKey,
  EMarketPresetTradeSide,
} from '../../Market/MarketDetailV2/components/SwapPanel/hooks/marketPresetSettings';
import {
  type IMarketPresetSwapOverrides,
  loadMarketPresetSwapOverrides,
} from '../../Market/MarketDetailV2/components/SwapPanel/hooks/marketPresetSwapOverrides';
import { ESwapDirection } from '../../Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';

import { buildMarketPresetSwapOverrideContextKey } from './marketPresetSwapOverrideContext';

export function useMarketPresetSwapOverridesEffect({
  marketPresetToken,
  presetSwapOverrides,
  selectedPresetKey,
}: {
  marketPresetToken?: IMarketPresetTokenContext;
  presetSwapOverrides?: IMarketPresetSwapOverrides;
  selectedPresetKey?: EMarketPresetKey;
}) {
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [swapProDirection] = useSwapProDirectionAtom();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const [, setSwapStepNetFeeLevel] = useSwapStepNetFeeLevelAtom();
  const [, setSwapSlippageOverride] = useSwapSlippageOverrideAtom();
  const [, setSwapSlippageOverrideContextKey] =
    useSwapSlippageOverrideContextKeyAtom();
  const [
    swapSlippageOverrideSuppressedContextKey,
    setSwapSlippageOverrideSuppressedContextKey,
  ] = useSwapSlippageOverrideSuppressedContextKeyAtom();
  const [swapSlippageOverrideUserRevision] =
    useSwapSlippageOverrideUserRevisionAtom();
  const requestIdRef = useRef(0);
  const contextKeyRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    requestIdRef.current += 1;
  }, [swapSlippageOverrideUserRevision]);

  useEffect(() => {
    // Bump request id at the very top so any in-flight async load from a prior
    // run is invalidated regardless of which branch we take below.
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const resetPresetOverrides = () => {
      contextKeyRef.current = undefined;
      setSwapStepNetFeeLevel({ networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM });
      setSwapSlippageOverride(undefined);
      setSwapSlippageOverrideContextKey(undefined);
      setSwapSlippageOverrideSuppressedContextKey(undefined);
    };

    if (!marketPresetToken?.networkId) {
      resetPresetOverrides();
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
      resetPresetOverrides();
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
      resetPresetOverrides();
      return;
    }

    const contextKey = buildMarketPresetSwapOverrideContextKey({
      marketPresetToken,
      tradeSide,
    });
    setSwapSlippageOverrideContextKey(contextKey);
    if (contextKeyRef.current !== contextKey) {
      contextKeyRef.current = contextKey;
      setSwapSlippageOverrideSuppressedContextKey(undefined);
    }

    const applyOverrides = (overrides?: IMarketPresetSwapOverrides) => {
      setSwapStepNetFeeLevel({
        networkFeeLevel:
          overrides?.networkFeeLevel ?? ESwapNetworkFeeLevel.MEDIUM,
        customPriorityFee: overrides?.customPriorityFee,
      });
      if (swapSlippageOverrideSuppressedContextKey === contextKey) {
        setSwapSlippageOverride(undefined);
      } else {
        setSwapSlippageOverride(overrides?.slippage);
      }
    };

    if (presetSwapOverrides) {
      applyOverrides(presetSwapOverrides);
      return;
    }

    void (async () => {
      const overrides = await loadMarketPresetSwapOverrides({
        networkId: marketPresetToken.networkId,
        presetKey: selectedPresetKey,
        tradeSide,
      });
      if (requestIdRef.current !== requestId) {
        return;
      }
      applyOverrides(overrides);
    })();
  }, [
    marketPresetToken,
    presetSwapOverrides,
    selectedPresetKey,
    fromToken,
    toToken,
    swapTypeSwitch,
    swapProSelectToken,
    swapProDirection,
    swapProTradeType,
    setSwapStepNetFeeLevel,
    setSwapSlippageOverride,
    setSwapSlippageOverrideContextKey,
    setSwapSlippageOverrideSuppressedContextKey,
    swapSlippageOverrideSuppressedContextKey,
  ]);

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      contextKeyRef.current = undefined;
      setSwapStepNetFeeLevel({ networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM });
      setSwapSlippageOverride(undefined);
      setSwapSlippageOverrideContextKey(undefined);
      setSwapSlippageOverrideSuppressedContextKey(undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
