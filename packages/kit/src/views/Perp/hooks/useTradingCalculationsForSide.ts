import { useMemo } from 'react';

import { BigNumber } from 'bignumber.js';

import { useTradingFormAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetDataAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  computeMaxTradeSize,
  resolveTradingSizeBN,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import { EPerpsSizeInputMode } from '@onekeyhq/shared/types/hyperliquid/types';

import { useLiquidationPrice } from './useLiquidationPrice';
import { useOrderPrice } from './useOrderPrice';

export function useTradingCalculationsForSide(side: 'long' | 'short') {
  const [formData] = useTradingFormAtom();
  const [activeAsset] = usePerpsActiveAssetAtom();
  const [activeAssetData] = usePerpsActiveAssetDataAtom();

  const { price: effectivePriceBN, error: priceError } = useOrderPrice(side);
  const liquidationPrice = useLiquidationPrice(side);

  const leverage = useMemo(
    () => activeAssetData?.leverage?.value || 1,
    [activeAssetData?.leverage?.value],
  );

  const effectiveMaxTradeSzs = useMemo(() => {
    if (formData.orderMode !== 'trigger') {
      return activeAssetData?.maxTradeSzs;
    }

    const leverageBN = new BigNumber(
      activeAssetData?.leverage?.value ??
        activeAsset?.universe?.maxLeverage ??
        1,
    );
    const effectivePrice =
      effectivePriceBN.isFinite() && effectivePriceBN.gt(0)
        ? effectivePriceBN
        : new BigNumber(activeAssetData?.markPx ?? 0);
    const availableIdx = side === 'long' ? 0 : 1;
    const balanceBN = new BigNumber(
      activeAssetData?.availableToTrade?.[availableIdx] ?? 0,
    );

    const markPriceBN = new BigNumber(activeAssetData?.markPx ?? 0);

    if (
      !effectivePrice.gt(0) ||
      !leverageBN.gt(0) ||
      !balanceBN.gt(0) ||
      !markPriceBN.gt(0)
    ) {
      return activeAssetData?.maxTradeSzs;
    }

    // Produce tokens-at-markPrice so computeMaxTradeSize converts correctly
    const triggerMax = balanceBN
      .multipliedBy(leverageBN)
      .dividedBy(markPriceBN);
    return [
      side === 'long' ? triggerMax.toFixed() : '0',
      side === 'short' ? triggerMax.toFixed() : '0',
    ] as [string, string];
  }, [
    formData.orderMode,
    activeAssetData?.maxTradeSzs,
    activeAssetData?.leverage?.value,
    activeAssetData?.availableToTrade,
    activeAssetData?.markPx,
    activeAsset?.universe?.maxLeverage,
    effectivePriceBN,
    side,
  ]);

  const maxTradeSzBN = useMemo(() => {
    const maxTradeSzs = effectiveMaxTradeSzs || [0, 0];
    return new BigNumber(maxTradeSzs[side === 'long' ? 0 : 1] ?? 0);
  }, [effectiveMaxTradeSzs, side]);

  const markPxBN = useMemo(() => {
    const markPx = activeAssetData?.markPx;
    return new BigNumber(markPx ?? 0);
  }, [activeAssetData?.markPx]);

  const availableMarginBN = useMemo(() => {
    if (formData.orderMode === 'trigger') {
      const availableIdx = side === 'long' ? 0 : 1;
      return new BigNumber(
        activeAssetData?.availableToTrade?.[availableIdx] ?? 0,
      );
    }

    if (!maxTradeSzBN.gt(0) || !markPxBN.gt(0) || leverage <= 0) {
      return new BigNumber(0);
    }
    return maxTradeSzBN.multipliedBy(markPxBN).dividedBy(leverage);
  }, [
    formData.orderMode,
    activeAssetData?.availableToTrade,
    side,
    maxTradeSzBN,
    markPxBN,
    leverage,
  ]);

  const availableToTrade = useMemo(
    () => ({
      display: availableMarginBN.toFixed(2, BigNumber.ROUND_DOWN),
      value: availableMarginBN.toNumber(),
    }),
    [availableMarginBN],
  );

  const maxPositionSizeBN = useMemo(
    () =>
      computeMaxTradeSize({
        side,
        price: effectivePriceBN.isFinite() ? effectivePriceBN.toFixed() : '',
        markPrice: activeAssetData?.markPx,
        maxTradeSzs: effectiveMaxTradeSzs,
        leverageValue: activeAssetData?.leverage?.value,
        fallbackLeverage: activeAsset?.universe?.maxLeverage,
        szDecimals: activeAsset?.universe?.szDecimals,
      }),
    [
      side,
      effectivePriceBN,
      activeAssetData?.markPx,
      effectiveMaxTradeSzs,
      activeAssetData?.leverage?.value,
      activeAsset?.universe?.maxLeverage,
      activeAsset?.universe?.szDecimals,
    ],
  );

  const maxPositionSize = useMemo(
    () => maxPositionSizeBN.toNumber(),
    [maxPositionSizeBN],
  );

  const computedSizeForSide = useMemo(() => {
    return resolveTradingSizeBN({
      sizeInputMode: formData.sizeInputMode ?? EPerpsSizeInputMode.MANUAL,
      manualSize: formData.size,
      sizePercent: formData.sizePercent,
      side,
      price: effectivePriceBN.isFinite() ? effectivePriceBN.toFixed() : '',
      markPrice: activeAssetData?.markPx,
      maxTradeSzs: effectiveMaxTradeSzs,
      leverageValue: activeAssetData?.leverage?.value,
      fallbackLeverage: activeAsset?.universe?.maxLeverage,
      szDecimals: activeAsset?.universe?.szDecimals,
    });
  }, [
    formData.sizeInputMode,
    formData.size,
    formData.sizePercent,
    side,
    effectivePriceBN,
    activeAssetData?.markPx,
    effectiveMaxTradeSzs,
    activeAssetData?.leverage?.value,
    activeAsset?.universe?.maxLeverage,
    activeAsset?.universe?.szDecimals,
  ]);

  const orderValue = useMemo(
    () => computedSizeForSide.multipliedBy(effectivePriceBN),
    [computedSizeForSide, effectivePriceBN],
  );

  const marginRequired = useMemo(
    () => orderValue.dividedBy(leverage || 1),
    [orderValue, leverage],
  );

  const isNoEnoughMargin = useMemo(() => {
    // Trigger orders do not lock margin at placement time (HL checks margin
    // only when the trigger fires). Reduce-only triggers need no margin at all.
    if (formData.orderMode === 'trigger') {
      return false;
    }

    // No margin for this side (guard on markPxBN to skip initial loading)
    if (markPxBN.gt(0) && availableMarginBN.lte(0)) {
      return true;
    }

    // Slider set but computed size rounds to 0 after szDecimals truncation
    const isSlider =
      (formData.sizeInputMode ?? EPerpsSizeInputMode.MANUAL) ===
      EPerpsSizeInputMode.SLIDER;
    if (
      isSlider &&
      (formData.sizePercent ?? 0) > 0 &&
      computedSizeForSide.lte(0)
    ) {
      return true;
    }

    if (
      !computedSizeForSide.isFinite() ||
      computedSizeForSide.lte(0) ||
      !effectivePriceBN.isFinite() ||
      effectivePriceBN.lte(0)
    ) {
      return false;
    }

    const requiredMargin = computedSizeForSide
      .multipliedBy(effectivePriceBN)
      .dividedBy(leverage || 1);

    return requiredMargin.isFinite() && requiredMargin.gt(availableMarginBN);
  }, [
    computedSizeForSide,
    effectivePriceBN,
    availableMarginBN,
    leverage,
    markPxBN,
    formData.orderMode,
    formData.sizeInputMode,
    formData.sizePercent,
  ]);

  return {
    computedSizeForSide,
    liquidationPrice,
    orderValue,
    marginRequired,
    availableToTrade,
    maxTradeSz: maxTradeSzBN.toNumber(),
    maxPositionSize,
    isNoEnoughMargin,
    leverage,
    effectivePriceBN,
    priceError,
  };
}
