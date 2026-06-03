import { useMemo } from 'react';

import { BigNumber } from 'bignumber.js';

import {
  useActiveTradeInstrumentAtom,
  useTradingFormCalculationParams,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetDataAtom,
  useSpotBalancesAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  computeMaxTradeSize,
  resolveTradingSizeBN,
  sanitizeManualSize,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import { EPerpsSizeInputMode } from '@onekeyhq/shared/types/hyperliquid/types';

import { useOrderPrice } from './useOrderPrice';
import { useTradingPrice } from './useTradingPrice';

export function useTradingCalculationsForSide(side: 'long' | 'short') {
  const formData = useTradingFormCalculationParams();
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const [activeAsset] = usePerpsActiveAssetAtom();
  const [activeAssetData] = usePerpsActiveAssetDataAtom();
  const [{ balances: spotBalances }] = useSpotBalancesAtom();

  const orderPrice = useOrderPrice(side);
  const { midPriceBN } = useTradingPrice();
  const { price: effectivePriceBN, error: priceError } = orderPrice;
  const isSpot = activeTradeInstrument.mode === 'spot';
  const spotUniverse =
    activeTradeInstrument.mode === 'spot'
      ? activeTradeInstrument.universe
      : undefined;
  const spotSzDecimals = spotUniverse?.baseSzDecimals ?? 2;

  const spotAvailableBaseBN = useMemo(() => {
    if (!spotUniverse?.baseName) {
      return new BigNumber(0);
    }
    const balance = spotBalances.find(
      (item) => item.coin === spotUniverse.baseName,
    );
    if (!balance) {
      return new BigNumber(0);
    }
    return BigNumber.max(
      new BigNumber(balance.total).minus(balance.hold ?? 0),
      0,
    );
  }, [spotBalances, spotUniverse?.baseName]);

  const spotAvailableQuoteBN = useMemo(() => {
    if (!spotUniverse?.quoteName) {
      return new BigNumber(0);
    }
    const balance = spotBalances.find(
      (item) => item.coin === spotUniverse.quoteName,
    );
    if (!balance) {
      return new BigNumber(0);
    }
    return BigNumber.max(
      new BigNumber(balance.total).minus(balance.hold ?? 0),
      0,
    );
  }, [spotBalances, spotUniverse?.quoteName]);

  const leverage = useMemo(
    () => (isSpot ? 1 : activeAssetData?.leverage?.value || 1),
    [isSpot, activeAssetData?.leverage?.value],
  );

  const effectiveSpotPriceBN = useMemo(() => {
    if (effectivePriceBN.isFinite() && effectivePriceBN.gt(0)) {
      return effectivePriceBN;
    }
    return midPriceBN.isFinite() && midPriceBN.gt(0)
      ? midPriceBN
      : new BigNumber(0);
  }, [effectivePriceBN, midPriceBN]);

  const spotMaxTradeSzs = useMemo(() => {
    if (!isSpot) {
      return undefined;
    }
    const buyMax = effectiveSpotPriceBN.gt(0)
      ? spotAvailableQuoteBN.dividedBy(effectiveSpotPriceBN)
      : new BigNumber(0);
    return [
      buyMax.decimalPlaces(spotSzDecimals, BigNumber.ROUND_FLOOR).toFixed(),
      spotAvailableBaseBN
        .decimalPlaces(spotSzDecimals, BigNumber.ROUND_FLOOR)
        .toFixed(),
    ] as [string, string];
  }, [
    isSpot,
    effectiveSpotPriceBN,
    spotAvailableQuoteBN,
    spotAvailableBaseBN,
    spotSzDecimals,
  ]);

  const effectiveMaxTradeSzs = useMemo(() => {
    if (isSpot) {
      return spotMaxTradeSzs;
    }
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
    isSpot,
    side,
    spotMaxTradeSzs,
  ]);

  const maxTradeSzBN = useMemo(() => {
    const maxTradeSzs = effectiveMaxTradeSzs || [0, 0];
    return new BigNumber(maxTradeSzs[side === 'long' ? 0 : 1] ?? 0);
  }, [effectiveMaxTradeSzs, side]);

  const markPxBN = useMemo(() => {
    const markPx = isSpot
      ? effectiveSpotPriceBN.toFixed()
      : activeAssetData?.markPx;
    return new BigNumber(markPx ?? 0);
  }, [activeAssetData?.markPx, effectiveSpotPriceBN, isSpot]);

  const availableMarginBN = useMemo(() => {
    if (isSpot) {
      if (side === 'long') {
        return spotAvailableQuoteBN;
      }
      if (!markPxBN.gt(0)) {
        return new BigNumber(0);
      }
      return spotAvailableBaseBN.multipliedBy(markPxBN);
    }

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
    isSpot,
    side,
    maxTradeSzBN,
    markPxBN,
    leverage,
    spotAvailableBaseBN,
    spotAvailableQuoteBN,
  ]);

  const availableToTrade = useMemo(
    () => ({
      display: availableMarginBN.toFixed(2, BigNumber.ROUND_DOWN),
      value: availableMarginBN.toNumber(),
    }),
    [availableMarginBN],
  );

  const maxPositionSizeBN = useMemo(() => {
    if (isSpot) {
      return maxTradeSzBN.decimalPlaces(spotSzDecimals, BigNumber.ROUND_FLOOR);
    }
    return computeMaxTradeSize({
      side,
      price: effectivePriceBN.isFinite() ? effectivePriceBN.toFixed() : '',
      markPrice: activeAssetData?.markPx,
      maxTradeSzs: effectiveMaxTradeSzs,
      leverageValue: activeAssetData?.leverage?.value,
      fallbackLeverage: activeAsset?.universe?.maxLeverage,
      szDecimals: activeAsset?.universe?.szDecimals,
    });
  }, [
    side,
    effectivePriceBN,
    activeAssetData?.markPx,
    effectiveMaxTradeSzs,
    activeAssetData?.leverage?.value,
    activeAsset?.universe?.maxLeverage,
    activeAsset?.universe?.szDecimals,
    isSpot,
    maxTradeSzBN,
    spotSzDecimals,
  ]);

  const maxPositionSize = useMemo(
    () => maxPositionSizeBN.toNumber(),
    [maxPositionSizeBN],
  );

  const computedSizeForSide = useMemo(() => {
    if (isSpot) {
      if (
        (formData.sizeInputMode ?? EPerpsSizeInputMode.MANUAL) ===
        EPerpsSizeInputMode.SLIDER
      ) {
        const sliderPercent = Number.isFinite(formData.sizePercent)
          ? Math.max(0, Math.min(100, formData.sizePercent ?? 0))
          : 0;
        return maxPositionSizeBN
          .multipliedBy(sliderPercent)
          .dividedBy(100)
          .decimalPlaces(spotSzDecimals, BigNumber.ROUND_FLOOR);
      }
      const manualBN = new BigNumber(sanitizeManualSize(formData.size));
      return manualBN.isFinite() && manualBN.gte(0)
        ? manualBN.decimalPlaces(spotSzDecimals, BigNumber.ROUND_FLOOR)
        : new BigNumber(0);
    }
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
    isSpot,
    maxPositionSizeBN,
    spotSzDecimals,
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
    if (isSpot) {
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
      if (side === 'long') {
        return orderValue.isFinite() && orderValue.gt(spotAvailableQuoteBN);
      }
      return computedSizeForSide.gt(spotAvailableBaseBN);
    }

    // Trigger orders do not lock margin at placement time (HL checks margin
    // only when the trigger fires). Reduce-only triggers need no margin at all.
    if (formData.orderMode === 'trigger') {
      return false;
    }
    if (
      (formData.orderMode === 'scale' && formData.scaleReduceOnly) ||
      (formData.orderMode === 'twap' && formData.twapReduceOnly)
    ) {
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
    formData.scaleReduceOnly,
    formData.sizeInputMode,
    formData.sizePercent,
    formData.twapReduceOnly,
    isSpot,
    orderValue,
    side,
    spotAvailableBaseBN,
    spotAvailableQuoteBN,
  ]);

  return {
    computedSizeForSide,
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
